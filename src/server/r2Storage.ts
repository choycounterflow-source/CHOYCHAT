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

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${objectPath}`;
  const contentType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  const cacheControl = 'public, max-age=31536000, immutable';
  const payloadHash = sha256Hex(buffer);

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const signedHeaders = 'cache-control;content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    `cache-control:${cacheControl}`,
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
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

  const kDate = hmacSha256(Buffer.from(`AWS4${secretAccessKey}`, 'utf8'), dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const uploadUrl = `https://${host}${canonicalUri}`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
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
