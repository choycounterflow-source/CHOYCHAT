import crypto from 'crypto';
import {
  normalizeMediaMime,
  sanitizeUploadFolder,
  type MediaCategory,
} from './supabaseStorage.ts';

export interface R2StorageStatus {
  configured: boolean;
  bucket: string;
  hasAccountId: boolean;
  hasAccessKeyId: boolean;
  hasSecretAccessKey: boolean;
  hasPublicUrl: boolean;
  publicUrlOrigin: string;
}

export interface R2UploadResult {
  url: string;
  path: string;
  bucket: string;
  provider: 'r2';
  mediaType: MediaCategory;
  mimeType: string;
  sizeBytes: number;
}

interface MimeSpec {
  ext: string;
  category: MediaCategory;
  maxBytes: number;
}

// Cloudflare R2 allows larger videos (up to 60 MB) with zero egress fees so Supabase stays lightweight
const R2_ALLOWED_MIME_MAP: Record<string, MimeSpec> = {
  'image/jpeg': { ext: '.jpg', category: 'image', maxBytes: 10 * 1024 * 1024 },
  'image/jpg': { ext: '.jpg', category: 'image', maxBytes: 10 * 1024 * 1024 },
  'image/png': { ext: '.png', category: 'image', maxBytes: 10 * 1024 * 1024 },
  'image/webp': { ext: '.webp', category: 'image', maxBytes: 10 * 1024 * 1024 },
  'image/gif': { ext: '.gif', category: 'image', maxBytes: 10 * 1024 * 1024 },
  'video/mp4': { ext: '.mp4', category: 'video', maxBytes: 60 * 1024 * 1024 },
  'video/webm': { ext: '.webm', category: 'video', maxBytes: 60 * 1024 * 1024 },
  'video/quicktime': { ext: '.mov', category: 'video', maxBytes: 60 * 1024 * 1024 },
  'audio/webm': { ext: '.webm', category: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/ogg': { ext: '.ogg', category: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/mp4': { ext: '.m4a', category: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/mpeg': { ext: '.mp3', category: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/mp3': { ext: '.mp3', category: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/wav': { ext: '.wav', category: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/aac': { ext: '.aac', category: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/x-m4a': { ext: '.m4a', category: 'audio', maxBytes: 20 * 1024 * 1024 },
};

function stripOuterQuotes(val: string): string {
  const t = val.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function getValidatedR2AccountId(): string {
  const raw = stripOuterQuotes(
    process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || ''
  );
  if (!raw) return '';
  // Direct Cloudflare Account ID (hex string, typically 32 chars)
  if (/^[a-f0-9]{16,64}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  // If user pasted the full Cloudflare R2 S3 API URL (e.g. https://<id>.r2.cloudflarestorage.com/choychat)
  try {
    const candidate = raw.includes('://') ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith('.r2.cloudflarestorage.com')) {
      const sub = host.slice(0, -'.r2.cloudflarestorage.com'.length);
      if (/^[a-f0-9]{16,64}$/i.test(sub)) {
        return sub.toLowerCase();
      }
    }
  } catch {
    // ignore invalid URL
  }
  return '';
}

function getR2AccessKeyId(): string {
  return stripOuterQuotes(
    process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || ''
  );
}

function getR2SecretAccessKey(): string {
  return stripOuterQuotes(
    process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''
  );
}

function getSanitizedR2Bucket(): string {
  const raw = stripOuterQuotes(
    process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET || 'choychat'
  ).toLowerCase();
  if (/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(raw)) {
    return raw;
  }
  return 'choychat';
}

function isBlockedPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  ) {
    return true;
  }
  return false;
}

function getValidatedR2PublicBaseUrl(): { baseUrl: string; origin: string } {
  const raw = stripOuterQuotes(
    process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || ''
  );
  if (!raw) return { baseUrl: '', origin: '' };
  try {
    const normalized = raw.includes('://') ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:') return { baseUrl: '', origin: '' };
    if (isBlockedPrivateHost(parsed.hostname)) return { baseUrl: '', origin: '' };
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    return {
      baseUrl: `${parsed.origin}${cleanPath}`,
      origin: parsed.origin,
    };
  } catch {
    return { baseUrl: '', origin: '' };
  }
}

export function getR2StorageStatus(): R2StorageStatus {
  const accountId = getValidatedR2AccountId();
  const accessKeyId = getR2AccessKeyId();
  const secretAccessKey = getR2SecretAccessKey();
  const bucket = getSanitizedR2Bucket();
  const { baseUrl, origin } = getValidatedR2PublicBaseUrl();

  return {
    configured: Boolean(accountId && accessKeyId && secretAccessKey && baseUrl),
    bucket,
    hasAccountId: Boolean(accountId),
    hasAccessKeyId: Boolean(accessKeyId),
    hasSecretAccessKey: Boolean(secretAccessKey),
    hasPublicUrl: Boolean(baseUrl),
    publicUrlOrigin: origin,
  };
}

function sha256Hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmacSha256(key: Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

interface SignedR2RequestOptions {
  method: 'GET' | 'HEAD' | 'PUT';
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  canonicalUri: string;
  canonicalQueryString?: string;
  payload?: Buffer;
  extraHeaders?: Record<string, string>;
}

function signR2Request(opts: SignedR2RequestOptions): {
  url: string;
  headers: Record<string, string>;
} {
  const now = new Date();
  const host = `${opts.accountId}.r2.cloudflarestorage.com`;
  const payloadHash = sha256Hex(opts.payload ?? Buffer.alloc(0));
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const headerMap: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const outgoingHeaders: Record<string, string> = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  if (opts.extraHeaders) {
    for (const [k, v] of Object.entries(opts.extraHeaders)) {
      const lower = k.toLowerCase();
      headerMap[lower] = v.trim();
      outgoingHeaders[k] = v.trim();
    }
  }

  const sortedKeys = Object.keys(headerMap).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headerMap[k]}`).join('\n');
  const signedHeaders = sortedKeys.join(';');
  const query = opts.canonicalQueryString || '';

  const canonicalRequest = [
    opts.method,
    opts.canonicalUri,
    query,
    canonicalHeaders,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(Buffer.from(`AWS4${opts.secretAccessKey}`, 'utf8'), dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  outgoingHeaders.Authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${opts.canonicalUri}${query ? `?${query}` : ''}`;
  return { url, headers: outgoingHeaders };
}

export async function uploadToR2Storage(
  buffer: Buffer,
  rawMimeType: string,
  rawFolder: string
): Promise<R2UploadResult> {
  const accountId = getValidatedR2AccountId();
  const accessKeyId = getR2AccessKeyId();
  const secretAccessKey = getR2SecretAccessKey();
  const bucket = getSanitizedR2Bucket();
  const { baseUrl } = getValidatedR2PublicBaseUrl();

  if (!accountId || !accessKeyId || !secretAccessKey || !baseUrl) {
    throw new Error('Cloudflare R2 Storage is not fully configured');
  }

  const mimeType = normalizeMediaMime(rawMimeType);
  const spec = R2_ALLOWED_MIME_MAP[mimeType];
  if (!spec) {
    throw new Error('Unsupported media format. Allowed: JPG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, OGG, M4A, WAV.');
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file upload');
  }

  if (buffer.length > spec.maxBytes) {
    const maxMb = Math.round(spec.maxBytes / (1024 * 1024));
    throw new Error(`File exceeds maximum allowed size (${maxMb} MB for ${spec.category} on Cloudflare R2).`);
  }

  const folder = sanitizeUploadFolder(rawFolder);
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const objectPath = `${folder}/${ym}/${crypto.randomUUID()}${spec.ext}`;

  const canonicalUri = `/${bucket}/${objectPath}`;
  const contentType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  const cacheControl = 'public, max-age=31536000, immutable';

  const signed = signR2Request({
    method: 'PUT',
    accountId,
    accessKeyId,
    secretAccessKey,
    canonicalUri,
    payload: buffer,
    extraHeaders: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    },
  });

  const uploadRes = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => '');
    throw new Error(`Cloudflare R2 upload failed (HTTP ${uploadRes.status})${detail ? `: ${detail.slice(0, 140)}` : ''}`);
  }

  return {
    url: `${baseUrl}/${objectPath}`,
    path: objectPath,
    bucket,
    provider: 'r2',
    mediaType: spec.category,
    mimeType: contentType,
    sizeBytes: buffer.length,
  };
}

export interface R2EnvKeyDiagnostic {
  key: string;
  present: boolean;
  valid: boolean;
  detail: string;
}

export interface R2SampleObject {
  key: string;
  sizeBytes: number;
  lastModified: string;
}

export type R2DiagnosticCategory =
  | 'healthy'
  | 'env_missing'
  | 'env_invalid'
  | 'bucket_not_found'
  | 'permissions_error'
  | 'connectivity_error'
  | 'public_url_error';

export interface R2DiagnosticResult {
  checkedAt: string;
  bucket: string;
  accountIdMasked: string;
  endpointHost: string;
  publicUrlOrigin: string;
  category: R2DiagnosticCategory;
  summary: string;
  nextStep: string;
  envChecks: R2EnvKeyDiagnostic[];
  detectedR2EnvNames: string[];
  bucketExistsCheck: {
    ran: boolean;
    ok: boolean;
    httpStatus: number | null;
    latencyMs: number | null;
    detail: string;
  };
  listObjectsCheck: {
    ran: boolean;
    ok: boolean;
    httpStatus: number | null;
    latencyMs: number | null;
    errorCode?: string;
    errorMessage?: string;
    objectCount: number;
    sampleFiles: R2SampleObject[];
    detail: string;
  };
  publicAccessCheck: {
    ran: boolean;
    ok: boolean;
    httpStatus: number | null;
    latencyMs: number | null;
    testedPath: string;
    detail: string;
  };
}

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractXmlTag(xml: string, tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open);
  if (start === -1) return '';
  const end = xml.indexOf(close, start + open.length);
  if (end === -1) return '';
  return decodeXmlEntities(xml.slice(start + open.length, end).trim());
}

function parseListObjectsXml(xml: string): R2SampleObject[] {
  const results: R2SampleObject[] = [];
  let cursor = 0;
  while (results.length < 5) {
    const start = xml.indexOf('<Contents>', cursor);
    if (start === -1) break;
    const end = xml.indexOf('</Contents>', start + 10);
    if (end === -1) break;
    const block = xml.slice(start + 10, end);
    const key = extractXmlTag(block, 'Key');
    const sizeRaw = extractXmlTag(block, 'Size');
    const lastModified = extractXmlTag(block, 'LastModified');
    if (key) {
      results.push({
        key,
        sizeBytes: Number.isFinite(Number(sizeRaw)) ? Number(sizeRaw) : 0,
        lastModified,
      });
    }
    cursor = end + 11;
  }
  return results;
}

function maskIdentifier(val: string): string {
  if (!val) return '';
  if (val.length <= 8) return '****';
  return `${val.slice(0, 4)}...${val.slice(-4)}`;
}

export async function runR2Diagnostic(): Promise<R2DiagnosticResult> {
  const checkedAt = new Date().toISOString();
  const rawAccountId = stripOuterQuotes(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '');
  const rawAccessKeyId = stripOuterQuotes(process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '');
  const rawSecretAccessKey = stripOuterQuotes(process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '');
  const rawBucket = stripOuterQuotes(process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET || '');
  const rawPublicUrl = stripOuterQuotes(process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || '');

  const accountId = getValidatedR2AccountId();
  const accessKeyId = getR2AccessKeyId();
  const secretAccessKey = getR2SecretAccessKey();
  const bucket = getSanitizedR2Bucket();
  const { baseUrl: publicBaseUrl, origin: publicUrlOrigin } = getValidatedR2PublicBaseUrl();

  // Strictly expose ONLY env var key names matching R2/Cloudflare (never secret values)
  const detectedR2EnvNames = Object.keys(process.env)
    .filter((k) => /(^r2_|_r2_|cloudflare)/i.test(k))
    .sort();

  const bucketValid = !rawBucket || /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(rawBucket.toLowerCase());

  const envChecks: R2EnvKeyDiagnostic[] = [
    {
      key: 'R2_ACCOUNT_ID',
      present: Boolean(rawAccountId),
      valid: Boolean(accountId),
      detail: !rawAccountId
        ? 'Not set in server environment'
        : accountId
        ? `Valid Cloudflare Account ID (${maskIdentifier(accountId)})`
        : 'Present, but invalid format (expected 32-char hex Account ID or *.r2.cloudflarestorage.com URL)',
    },
    {
      key: 'R2_ACCESS_KEY_ID',
      present: Boolean(rawAccessKeyId),
      valid: Boolean(accessKeyId),
      detail: rawAccessKeyId ? `Configured (${maskIdentifier(rawAccessKeyId)})` : 'Not set in server environment',
    },
    {
      key: 'R2_SECRET_ACCESS_KEY',
      present: Boolean(rawSecretAccessKey),
      valid: Boolean(secretAccessKey),
      detail: rawSecretAccessKey ? 'Configured (hidden on server)' : 'Not set in server environment',
    },
    {
      key: 'R2_BUCKET',
      present: Boolean(rawBucket),
      valid: bucketValid,
      detail: !rawBucket
        ? `Not explicitly set — using default "${bucket}"`
        : bucketValid
        ? `Configured ("${bucket}")`
        : `Invalid bucket name format — fell back to "${bucket}"`,
    },
    {
      key: 'R2_PUBLIC_URL',
      present: Boolean(rawPublicUrl),
      valid: Boolean(publicBaseUrl),
      detail: !rawPublicUrl
        ? 'Not set in server environment'
        : publicBaseUrl
        ? `Valid HTTPS origin (${publicUrlOrigin})`
        : 'Present, but invalid or non-HTTPS/private URL',
    },
  ];

  const endpointHost = accountId ? `${accountId}.r2.cloudflarestorage.com` : '';

  const bucketExistsCheck: R2DiagnosticResult['bucketExistsCheck'] = {
    ran: false,
    ok: false,
    httpStatus: null,
    latencyMs: null,
    detail: 'Skipped until R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are valid.',
  };

  const listObjectsCheck: R2DiagnosticResult['listObjectsCheck'] = {
    ran: false,
    ok: false,
    httpStatus: null,
    latencyMs: null,
    objectCount: 0,
    sampleFiles: [],
    detail: 'Skipped until R2 S3 credentials are configured.',
  };

  const publicAccessCheck: R2DiagnosticResult['publicAccessCheck'] = {
    ran: false,
    ok: false,
    httpStatus: null,
    latencyMs: null,
    testedPath: '',
    detail: 'Skipped until R2_PUBLIC_URL is valid.',
  };

  const missingCore = !rawAccountId || !rawAccessKeyId || !rawSecretAccessKey;
  const invalidCore = !missingCore && (!accountId || !bucketValid);

  // Run S3 HEAD + ListObjectsV2 whenever core S3 credentials are valid
  if (accountId && accessKeyId && secretAccessKey) {
    // 1) HEAD /<bucket> — checks if bucket exists and credentials are accepted
    bucketExistsCheck.ran = true;
    const headStart = Date.now();
    try {
      const signedHead = signR2Request({
        method: 'HEAD',
        accountId,
        accessKeyId,
        secretAccessKey,
        canonicalUri: `/${bucket}`,
      });
      const headRes = await fetch(signedHead.url, {
        method: 'HEAD',
        headers: signedHead.headers,
        signal: AbortSignal.timeout(10000),
      });
      bucketExistsCheck.httpStatus = headRes.status;
      bucketExistsCheck.latencyMs = Date.now() - headStart;
      if (headRes.ok) {
        bucketExistsCheck.ok = true;
        bucketExistsCheck.detail = `Bucket "${bucket}" exists and responded HTTP ${headRes.status}.`;
      } else if (headRes.status === 404) {
        bucketExistsCheck.detail = `Bucket "${bucket}" was NOT found (HTTP 404). Check the exact bucket name in Cloudflare R2.`;
      } else if (headRes.status === 403 || headRes.status === 401) {
        bucketExistsCheck.detail = `Access denied (HTTP ${headRes.status}) for bucket "${bucket}". Check API token permissions or key values.`;
      } else {
        bucketExistsCheck.detail = `Unexpected HTTP ${headRes.status} from R2 endpoint.`;
      }
    } catch (err: unknown) {
      bucketExistsCheck.latencyMs = Date.now() - headStart;
      const msg = err instanceof Error ? err.message : 'Network error';
      bucketExistsCheck.detail = `Connectivity error reaching ${endpointHost}: ${msg.slice(0, 140)}`;
    }

    // 2) GET /<bucket>?list-type=2&max-keys=5 — checks list permission + retrieves sample files & detailed S3 XML error
    listObjectsCheck.ran = true;
    const listStart = Date.now();
    try {
      const signedList = signR2Request({
        method: 'GET',
        accountId,
        accessKeyId,
        secretAccessKey,
        canonicalUri: `/${bucket}`,
        canonicalQueryString: 'list-type=2&max-keys=5',
      });
      const listRes = await fetch(signedList.url, {
        method: 'GET',
        headers: signedList.headers,
        signal: AbortSignal.timeout(10000),
      });
      listObjectsCheck.httpStatus = listRes.status;
      listObjectsCheck.latencyMs = Date.now() - listStart;
      const bodyText = await listRes.text().catch(() => '');

      if (listRes.ok) {
        const files = parseListObjectsXml(bodyText);
        listObjectsCheck.ok = true;
        listObjectsCheck.objectCount = files.length;
        listObjectsCheck.sampleFiles = files;
        listObjectsCheck.detail =
          files.length > 0
            ? `Listed ${files.length} sample file(s) from "${bucket}".`
            : `Successfully connected & listed "${bucket}" (bucket is currently empty — 0 files).`;
      } else {
        const errCode = extractXmlTag(bodyText, 'Code');
        const errMessage = extractXmlTag(bodyText, 'Message');
        if (errCode) listObjectsCheck.errorCode = errCode.slice(0, 80);
        if (errMessage) listObjectsCheck.errorMessage = errMessage.slice(0, 200);
        listObjectsCheck.detail = errCode
          ? `R2 returned HTTP ${listRes.status} (${errCode})${errMessage ? `: ${errMessage.slice(0, 140)}` : ''}`
          : `ListObjectsV2 failed with HTTP ${listRes.status}.`;
      }
    } catch (err: unknown) {
      listObjectsCheck.latencyMs = Date.now() - listStart;
      const msg = err instanceof Error ? err.message : 'Network error';
      listObjectsCheck.detail = `Connectivity error during ListObjectsV2: ${msg.slice(0, 140)}`;
    }
  }

  // 3) Public URL reachability test (tests first actual file if present, otherwise origin)
  if (publicBaseUrl) {
    publicAccessCheck.ran = true;
    const pubStart = Date.now();
    const firstKey = listObjectsCheck.sampleFiles[0]?.key || '';
    const encodedKey = firstKey
      ? firstKey
          .split('/')
          .map((seg) => encodeURIComponent(seg))
          .join('/')
      : '';
    const targetUrl = encodedKey ? `${publicBaseUrl}/${encodedKey}` : `${publicBaseUrl}/`;
    publicAccessCheck.testedPath = encodedKey ? `/${firstKey}` : '/';

    try {
      const pubRes = await fetch(targetUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      publicAccessCheck.httpStatus = pubRes.status;
      publicAccessCheck.latencyMs = Date.now() - pubStart;

      if (encodedKey) {
        publicAccessCheck.ok = pubRes.ok;
        publicAccessCheck.detail = pubRes.ok
          ? `Public file access verified (HTTP ${pubRes.status} on ${publicAccessCheck.testedPath}).`
          : `Public file returned HTTP ${pubRes.status}. Verify Public Development URL is enabled for bucket "${bucket}".`;
      } else {
        // Empty bucket root usually returns 404 or 403 from r2.dev/Cloudflare; 200/403/404 confirms DNS + HTTPS works
        publicAccessCheck.ok = pubRes.status >= 200 && pubRes.status < 500;
        publicAccessCheck.detail = publicAccessCheck.ok
          ? `Public endpoint is reachable (HTTP ${pubRes.status} on empty bucket root).`
          : `Public endpoint returned server error HTTP ${pubRes.status}.`;
      }
    } catch (err: unknown) {
      publicAccessCheck.latencyMs = Date.now() - pubStart;
      const msg = err instanceof Error ? err.message : 'Network error';
      publicAccessCheck.detail = `Could not reach R2_PUBLIC_URL (${publicUrlOrigin}): ${msg.slice(0, 140)}`;
    }
  }

  // Determine exact root-cause category & actionable summary
  let category: R2DiagnosticCategory = 'healthy';
  let summary = `Cloudflare R2 bucket "${bucket}" is healthy, reachable, and ready for video uploads.`;
  let nextStep = 'No action needed — Newsfeed and Chat videos will automatically save to Cloudflare R2.';

  if (missingCore) {
    category = 'env_missing';
    const missingNames = envChecks
      .filter((c) => c.key !== 'R2_BUCKET' && !c.present)
      .map((c) => c.key)
      .join(', ');
    summary = `Server environment is missing required R2 variables: ${missingNames}.`;
    nextStep =
      detectedR2EnvNames.length > 0
        ? `Check Render -> Environment for typos (detected server keys: ${detectedR2EnvNames.join(', ')}), then click "Save, rebuild, and deploy".`
        : 'Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_URL in Render -> Environment (not GitHub Secrets), then click "Save, rebuild, and deploy".';
  } else if (invalidCore || (!rawPublicUrl && !publicBaseUrl) || (rawPublicUrl && !publicBaseUrl)) {
    category = !rawPublicUrl ? 'env_missing' : 'env_invalid';
    const bad = envChecks.filter((c) => !c.valid).map((c) => c.key).join(', ');
    summary = !rawPublicUrl
      ? 'R2_PUBLIC_URL is missing in the server environment.'
      : `Invalid value format detected for: ${bad}.`;
    nextStep = !rawPublicUrl
      ? 'Enable Public Development URL (https://pub-xxxx.r2.dev) in Cloudflare R2 -> Bucket Settings, add it as R2_PUBLIC_URL in Render -> Environment, and redeploy.'
      : 'Fix the highlighted variable format in Render -> Environment and redeploy.';
  } else if (bucketExistsCheck.httpStatus === null || listObjectsCheck.httpStatus === null) {
    category = 'connectivity_error';
    summary = `Network connectivity error while contacting Cloudflare R2 (${endpointHost}).`;
    nextStep = 'Verify R2_ACCOUNT_ID matches your Cloudflare Account ID and retry the diagnostic.';
  } else if (
    bucketExistsCheck.httpStatus === 404 ||
    listObjectsCheck.errorCode === 'NoSuchBucket'
  ) {
    category = 'bucket_not_found';
    summary = `Cloudflare R2 connected, but bucket "${bucket}" does NOT exist in this account (NoSuchBucket).`;
    nextStep = `Check your exact bucket name in Cloudflare R2 and set R2_BUCKET in Render -> Environment to match it (currently "${bucket}").`;
  } else if (
    bucketExistsCheck.httpStatus === 403 ||
    bucketExistsCheck.httpStatus === 401 ||
    listObjectsCheck.httpStatus === 403 ||
    listObjectsCheck.httpStatus === 401 ||
    listObjectsCheck.errorCode === 'AccessDenied' ||
    listObjectsCheck.errorCode === 'InvalidAccessKeyId' ||
    listObjectsCheck.errorCode === 'SignatureDoesNotMatch'
  ) {
    category = 'permissions_error';
    summary = `Authentication or permission error on bucket "${bucket}" (${listObjectsCheck.errorCode || `HTTP ${listObjectsCheck.httpStatus ?? bucketExistsCheck.httpStatus}`}).`;
    nextStep =
      'Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (use S3 Access Key ID + Secret Access Key, not Token Value) and ensure the R2 API Token has "Object Read & Write" permission on this bucket.';
  } else if (!bucketExistsCheck.ok || !listObjectsCheck.ok) {
    category = 'connectivity_error';
    summary = `R2 responded with an unexpected status (HEAD: ${bucketExistsCheck.httpStatus}, LIST: ${listObjectsCheck.httpStatus}).`;
    nextStep = 'Double-check your Cloudflare R2 account status and bucket settings, then run the diagnostic again.';
  } else if (!publicAccessCheck.ok) {
    category = 'public_url_error';
    summary = `Bucket "${bucket}" is accessible via S3 API, but R2_PUBLIC_URL (${publicUrlOrigin}) failed reachability check.`;
    nextStep = 'Enable "Public Development URL" (r2.dev) or connect a Custom Domain in Cloudflare R2 -> Bucket Settings and update R2_PUBLIC_URL in Render.';
  }

  return {
    checkedAt,
    bucket,
    accountIdMasked: maskIdentifier(accountId),
    endpointHost,
    publicUrlOrigin,
    category,
    summary,
    nextStep,
    envChecks,
    detectedR2EnvNames,
    bucketExistsCheck,
    listObjectsCheck,
    publicAccessCheck,
  };
}

