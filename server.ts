import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import type WebPushType from 'web-push';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof WebPushType;
import {
  ChoyStore,
  ALLOWED_CHAT_ROOMS,
  normalizeUserNewsfeed,
  normalizePostNewsfeed,
  normalizeAnnouncementTarget,
  normalizeAnnouncementBadge,
  normalizeAnnouncementTone,
  signSessionToken,
  verifySessionToken,
  hashPin,
  verifyPin,
  timingSafeStringEqual,
  normalizePhone,
  sanitizeMediaUrl,
  sanitizeWebsiteUrl,
  sanitizePaymentTerminalConfig,
  clampNum,
  decryptSensitiveField,
  type StoredUser,
  type NewsfeedChannel,
  type StoredAnnouncement,
  type StoredChatGroup,
  type WalletTxItem,
  type PaymentTerminalChannelId,
  type PaymentTerminalPurpose,
  type StoredPaymentTerminalTx,
  type StoredMusicTrack,
  type StoredLongVideo,
  type StoredInvestProduct,
  type StoredUserInvestment,
  type StoredPrivateKycAsset,
  type StoredBlogPost,
} from './src/server/choyStore.ts';
import {
  getSupabaseStorageStatus,
  getSupabasePrivateKycStatus,
  getSanitizedPrivateKycBucket,
  normalizeMediaMime,
  uploadToSupabaseStorage,
  uploadToSupabasePrivateKycBucket,
  downloadFromSupabasePrivateKycBucket,
  type PrivateKycSubfolder,
} from './src/server/supabaseStorage.ts';
import {
  fetchR2MediaStream,
  getR2StorageStatus,
  getR2VaultBackupStatus,
  inferMediaContentTypeFromPath,
  isR2VaultConfigured,
  loadEncryptedVaultFromR2,
  rewriteBrokenR2MediaUrl,
  runR2Diagnostic,
  saveEncryptedVaultToR2,
  uploadToR2Storage,
} from './src/server/r2Storage.ts';

dotenv.config();
if (fs.existsSync('/etc/secrets/.env')) {
  dotenv.config({ path: '/etc/secrets/.env', override: false });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new ChoyStore();
interface SseClient {
  res: Response;
  userId: string;
  userName: string;
  role: 'admin' | 'member';
}

const DEFAULT_PROFILE_ICON = '/assets/aistudio/image_20261121_145253_f477cbfa.webp';

function getSafePushIcon(avatar?: string): string {
  const clean = typeof avatar === 'string' ? avatar.trim() : '';
  if (clean && (clean.startsWith('https://') || clean.startsWith('/assets/'))) {
    return clean;
  }
  return DEFAULT_PROFILE_ICON;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const sseClients = new Set<SseClient>();
const userLastSeenMap = new Map<string, number>();

function getChannelsForNewsfeed(nf?: string): Set<'a' | 'b' | 'c'> {
  const v = (nf || '').trim().toLowerCase();
  if (v === 'feed_b') return new Set(['b']);
  if (v === 'feed_c') return new Set(['c']);
  if (v === 'feed_bc') return new Set(['b', 'c']);
  if (v === 'both') return new Set(['a', 'b', 'c']);
  return new Set(['a']);
}

function hasNewsfeedOverlap(nfA?: string, nfB?: string): boolean {
  const setA = getChannelsForNewsfeed(nfA);
  const setB = getChannelsForNewsfeed(nfB);
  for (const ch of setA) {
    if (setB.has(ch)) return true;
  }
  return false;
}

function canViewerSeeUser(
  viewer: { id: string; role: 'admin' | 'member'; newsfeed?: string },
  candidate: { id: string; role: 'admin' | 'member'; newsfeed?: string }
): boolean {
  if (viewer.role === 'admin') return true;
  if (candidate.id === viewer.id) return true;
  if (candidate.role === 'admin') return true;
  return hasNewsfeedOverlap(normalizeUserNewsfeed(viewer.newsfeed), normalizeUserNewsfeed(candidate.newsfeed));
}

function canViewerSeePost(
  viewer: { id: string; role: 'admin' | 'member'; newsfeed?: string },
  post: { authorId: string; newsfeed?: string }
): boolean {
  if (viewer.role === 'admin') return true;
  if (post.authorId === viewer.id) return true;
  if ((post.newsfeed || '').trim().toLowerCase() === 'both') return true;
  return hasNewsfeedOverlap(normalizeUserNewsfeed(viewer.newsfeed), normalizePostNewsfeed(post.newsfeed));
}

function canViewerSeeAnnouncement(
  viewer: { role: 'admin' | 'member'; newsfeed?: string },
  ann: StoredAnnouncement
): boolean {
  if (viewer.role === 'admin') return true;
  if (!ann.active) return false;
  if (ann.target === 'all') return true;
  return hasNewsfeedOverlap(normalizeUserNewsfeed(viewer.newsfeed), normalizeAnnouncementTarget(ann.target));
}

function verifyCookieCsrf(req: AuthedRequest): boolean {
  const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
  if (hasBearer) return true;
  const origin = req.headers.origin;
  const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
  let originMatches = false;
  if (typeof origin === 'string' && expectedHost) {
    try {
      originMatches = new URL(origin).host === expectedHost;
    } catch {
      originMatches = false;
    }
  }
  return originMatches || hasRequestedWith;
}

let vapidReadyPromise: Promise<string> | null = null;
async function ensureWebPushConfigured(): Promise<string> {
  if (!vapidReadyPromise) {
    vapidReadyPromise = (async () => {
      const keys = await store.getOrCreateVapidKeys(() => webpush.generateVAPIDKeys());
      const subject = (process.env.VAPID_SUBJECT || 'mailto:choyjiez07@gmail.com').trim();
      webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
      return keys.publicKey;
    })().catch((err) => {
      vapidReadyPromise = null;
      throw err;
    });
  }
  return vapidReadyPromise;
}

async function sendWebPushToTarget(
  targetName: string,
  excludeUserId: string,
  payload: Record<string, unknown>,
  urgency: 'normal' | 'high' = 'normal',
  targetUserIds?: string[]
): Promise<number> {
  try {
    await ensureWebPushConfigured();
    const subs =
      Array.isArray(targetUserIds) && targetUserIds.length > 0
        ? await store.listPushSubscriptionsForUserIds(targetUserIds, excludeUserId)
        : await store.listPushSubscriptionsForTarget(targetName, excludeUserId);
    if (subs.length === 0) return 0;

    const body = JSON.stringify(payload);
    const ttl = urgency === 'high' ? 90 : 86400; // 24h TTL for messages so turning mobile data ON delivers queued alerts
    let sent = 0;

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            },
            body,
            { TTL: ttl, urgency }
          );
          sent += 1;
        } catch (err: unknown) {
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: number }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            await store.removePushSubscription(sub.endpoint).catch(() => {});
          }
        }
      })
    );
    return sent;
  } catch (err) {
    console.warn('[WebPush] Dispatch skipped:', err instanceof Error ? err.message : err);
    return 0;
  }
}

interface QueuedRtcSignal {
  seq: number;
  signalId: string;
  targetNameLower: string;
  targetUserId?: string;
  targetMemberIds?: string[];
  senderUserId: string;
  createdAtMs: number;
  payload: Record<string, unknown>;
}

const rtcSignalQueue: QueuedRtcSignal[] = [];
let rtcSignalSeq = 0;

interface ActiveGroupCallRoom {
  callId: string;
  roomId: string;
  groupName: string;
  hostUserId: string;
  hostUserName: string;
  startedAtMs: number;
  participants: Map<string, { userId: string; userName: string; lastSeenMs: number }>;
}

const activeGroupCallsMap = new Map<string, ActiveGroupCallRoom>();

function pruneActiveGroupCalls(now = Date.now()) {
  const maxParticipantIdleMs = 2 * 60 * 60 * 1000; // 2h safety cap
  for (const [roomKey, roomCall] of activeGroupCallsMap.entries()) {
    for (const [uid, p] of roomCall.participants.entries()) {
      if (now - p.lastSeenMs > maxParticipantIdleMs) {
        roomCall.participants.delete(uid);
      }
    }
    if (roomCall.participants.size === 0 || now - roomCall.startedAtMs > 6 * 60 * 60 * 1000) {
      activeGroupCallsMap.delete(roomKey);
    }
  }
}

function getActiveGroupCallsSnapshot(now = Date.now()) {
  pruneActiveGroupCalls(now);
  return Array.from(activeGroupCallsMap.values()).map((c) => ({
    callId: c.callId,
    roomId: c.roomId,
    groupName: c.groupName,
    hostUserId: c.hostUserId,
    hostUserName: c.hostUserName,
    startedAtMs: c.startedAtMs,
    participantIds: Array.from(c.participants.keys()),
    participantNames: Array.from(c.participants.values()).map((p) => p.userName),
    participantCount: c.participants.size,
  }));
}

function pruneRtcQueue(now = Date.now()) {
  const cutoff = now - 90_000;
  while (rtcSignalQueue.length > 0 && rtcSignalQueue[0].createdAtMs < cutoff) {
    rtcSignalQueue.shift();
  }
  if (rtcSignalQueue.length > 500) {
    rtcSignalQueue.splice(0, rtcSignalQueue.length - 500);
  }
}

function touchUserPresence(userName: string) {
  const key = userName.trim().toLowerCase();
  if (key) {
    userLastSeenMap.set(key, Date.now());
  }
}

function getOnlineUserNames(now = Date.now()): string[] {
  const online = new Set<string>();
  for (const client of sseClients) {
    const key = client.userName.trim().toLowerCase();
    if (key) online.add(key);
  }
  for (const [key, lastSeen] of userLastSeenMap.entries()) {
    if (now - lastSeen <= 20_000) {
      online.add(key);
    }
  }
  return Array.from(online);
}

let r2VaultBackupTimer: ReturnType<typeof setTimeout> | null = null;
let r2VaultBackupInFlight = false;
let r2VaultLastAutoSavedAt: string | null = null;

function scheduleR2VaultAutoBackup(reason: string) {
  if (!isR2VaultConfigured()) return;
  if (r2VaultBackupTimer) {
    clearTimeout(r2VaultBackupTimer);
  }
  r2VaultBackupTimer = setTimeout(async () => {
    r2VaultBackupTimer = null;
    if (r2VaultBackupInFlight) return;
    r2VaultBackupInFlight = true;
    try {
      const snapshot = await store.exportCloudBackup();
      const saved = await saveEncryptedVaultToR2(snapshot);
      r2VaultLastAutoSavedAt = saved.savedAt;
      console.log(
        `[R2Vault] Auto-backed up ${snapshot.users.length} account(s) to encrypted R2 vault (${reason}, ${saved.sizeBytes} bytes).`
      );
    } catch (err: unknown) {
      console.warn('[R2Vault] Auto-backup skipped/failed:', err instanceof Error ? err.message : err);
    } finally {
      r2VaultBackupInFlight = false;
    }
  }, 2500);
}

const R2_VAULT_AUTO_TOPICS = new Set(['users', 'settings', 'ledger', 'knowledge', 'announcements', 'newsfeed_config', 'groups']);

function broadcastSync(topic: string) {
  const payload = `event: sync\ndata: ${JSON.stringify({ topic, ts: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
  if (R2_VAULT_AUTO_TOPICS.has(topic)) {
    scheduleR2VaultAutoBackup(topic);
  }
}

function broadcastGpsToAdmins(userId: string) {
  const payload = `event: gps\ndata: ${JSON.stringify({ userId, ts: Date.now() })}\n\n`;
  for (const client of sseClients) {
    if (client.role !== 'admin') continue;
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function sendRtcSignal(
  targetName: string,
  senderUserId: string,
  eventPayload: Record<string, unknown>,
  options?: {
    targetUserId?: string;
    targetMemberIds?: string[];
  }
): { delivered: number; targetOnline: boolean; signalId: string; seq: number } {
  const now = Date.now();
  pruneRtcQueue(now);
  rtcSignalSeq += 1;
  const seq = rtcSignalSeq;
  const signalId = `sig_${seq}_${now}`;
  const enrichedPayload: Record<string, unknown> = {
    ...eventPayload,
    signalId,
    seq,
  };

  const normalizedTarget = targetName.trim().toLowerCase();
  const targetUserId = options?.targetUserId?.trim() || undefined;
  const targetMemberIds =
    Array.isArray(options?.targetMemberIds) && options.targetMemberIds.length > 0
      ? Array.from(new Set(options.targetMemberIds.map((id) => id.trim()).filter(Boolean)))
      : undefined;
  const targetMemberIdSet = targetMemberIds ? new Set(targetMemberIds) : null;
  const isBroadcastAll = !targetUserId && !targetMemberIdSet && (normalizedTarget === 'vip group' || normalizedTarget === '');

  rtcSignalQueue.push({
    seq,
    signalId,
    targetNameLower: isBroadcastAll ? 'vip group' : normalizedTarget,
    targetUserId,
    targetMemberIds,
    senderUserId,
    createdAtMs: now,
    payload: enrichedPayload,
  });

  const payload = `event: rtc\ndata: ${JSON.stringify(enrichedPayload)}\n\n`;
  let delivered = 0;

  for (const client of sseClients) {
    if (client.userId === senderUserId) continue;
    let isMatch = false;
    if (targetUserId) {
      isMatch = client.userId === targetUserId;
    } else if (targetMemberIdSet) {
      isMatch = targetMemberIdSet.has(client.userId);
    } else {
      isMatch = isBroadcastAll || client.userName.trim().toLowerCase() === normalizedTarget;
    }
    if (!isMatch) continue;
    try {
      client.res.write(payload);
      delivered += 1;
    } catch {
      sseClients.delete(client);
    }
  }

  let targetOnline = delivered > 0;
  if (!targetOnline) {
    if (isBroadcastAll || targetMemberIdSet) {
      for (const [, lastSeen] of userLastSeenMap.entries()) {
        if (now - lastSeen <= 15_000) {
          targetOnline = true;
          break;
        }
      }
    } else {
      const lastSeen = userLastSeenMap.get(normalizedTarget) || 0;
      targetOnline = now - lastSeen <= 15_000;
    }
  }

  return { delivered, targetOnline, signalId, seq };
}

const SESSION_COOKIE_NAME = 'choy_session';

function readSessionCookie(req: Request): string {
  const raw = req.headers.cookie || '';
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return '';
}

function setSessionCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 7}`,
  ];
  if (isHttps) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function stripOuterQuotes(val: string): string {
  const t = val.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

interface AuthedRequest extends Request {
  choyUser?: StoredUser;
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = bearerToken || readSessionCookie(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  try {
    const user = await store.getUserById(session.uid);
    if (!user) {
      return res.status(401).json({ error: 'Account not found' });
    }
    req.choyUser = user;
    next();
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Session lookup failed' });
  }
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.choyUser || req.choyUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

const app = express();
app.set('trust proxy', 1);
app.use(
  express.json({
    limit: '15mb',
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Health check endpoint for Render hosting (immediate 200 response to prevent deploy timeouts)
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    host: 'render',
    storageMode: store.storageMode,
    storageStatus: store.storageStatus,
    timestamp: new Date().toISOString(),
  });
});

// ---- CHOY CHAT AUTH & CROSS-DEVICE SYNC API ----
app.get('/api/auth/status', async (_req, res) => {
  await store.ready();
  const hasAdmin = await store.hasAnyAdmin();
  res.json({
    needsAdminSetup: !hasAdmin,
    storageMode: store.storageMode,
    storageStatus: store.storageStatus,
  });
});

app.get('/api/admin/env-status', requireAuth, requireAdmin, async (_req, res) => {
  await store.ready();
  const mediaStorage = getSupabaseStorageStatus();
  const r2Storage = getR2StorageStatus();
  const mediaStorageMode =
    r2Storage.configured && mediaStorage.configured
      ? 'r2+supabase'
      : r2Storage.configured
      ? 'r2'
      : mediaStorage.configured
      ? 'supabase'
      : 'inline';
  res.json({
    storageMode: store.storageMode,
    connectionPool: store.getPoolStats(),
    mediaStorageMode,
    r2Storage: {
      configured: r2Storage.configured,
      bucket: r2Storage.bucket,
      hasAccountId: r2Storage.hasAccountId,
      hasAccessKeyId: r2Storage.hasAccessKeyId,
      hasSecretAccessKey: r2Storage.hasSecretAccessKey,
      hasPublicUrl: r2Storage.hasPublicUrl,
      publicUrlOrigin: r2Storage.publicUrlOrigin,
    },
    defaults: {
      APP_URL: (process.env.APP_URL || 'https://chat-9-si9x.onrender.com').trim(),
      ADMIN_PHONE: (process.env.ADMIN_PHONE || '09361223978').trim(),
      SUPABASE_URL: (process.env.SUPABASE_URL || '').trim(),
      SUPABASE_BUCKET: mediaStorage.bucket,
      R2_BUCKET: r2Storage.bucket,
    },
    configured: {
      DATABASE_URL: Boolean((process.env.DATABASE_URL || '').trim()),
      DATABASE_POOL_URL: Boolean((process.env.DATABASE_POOL_URL || '').trim()),
      ADMIN_PHONE: Boolean((process.env.ADMIN_PHONE || '').trim()),
      ADMIN_PIN: Boolean((process.env.ADMIN_PIN || '').trim()),
      APP_URL: Boolean((process.env.APP_URL || 'https://chat-9-si9x.onrender.com').trim()),
      GEMINI_API_KEY: Boolean((process.env.GEMINI_API_KEY || '').trim()),
      R2_ACCOUNT_ID: r2Storage.hasAccountId,
      R2_ACCESS_KEY_ID: r2Storage.hasAccessKeyId,
      R2_SECRET_ACCESS_KEY: r2Storage.hasSecretAccessKey,
      R2_BUCKET: Boolean(r2Storage.bucket),
      R2_PUBLIC_URL: r2Storage.hasPublicUrl,
      GITHUB_CLIENT_ID: Boolean((process.env.GITHUB_CLIENT_ID || process.env.OAUTH_CLIENT_ID || '').trim()),
      GITHUB_CLIENT_SECRET: Boolean((process.env.GITHUB_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || '').trim()),
      GITHUB_TOKEN: Boolean((process.env.GITHUB_TOKEN || '').trim()),
      SUPABASE_URL: mediaStorage.hasUrl,
      SUPABASE_ANON_KEY: Boolean((process.env.SUPABASE_ANON_KEY || '').trim()),
      SUPABASE_SERVICE_ROLE_KEY: mediaStorage.hasServiceKey,
      SUPABASE_BUCKET: Boolean(mediaStorage.bucket),
    },
  });
});

// ---- ADMIN CLOUDFLARE R2 BUCKET DIAGNOSTIC ENDPOINT ----
app.post('/api/admin/r2-diagnostic', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    // CSRF protection when authenticated via session cookie
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin diagnostic blocked' });
      }
    }

    const report = await runR2Diagnostic();
    return res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'R2 diagnostic failed';
    return res.status(500).json({ error: message });
  }
});

// ---- SAME-ORIGIN CLOUDFLARE R2 MEDIA STREAMING (206 PARTIAL CONTENT RANGE SUPPORT) ----
app.get('/api/media/r2/:folder/:ym/:filename', async (req: Request, res: Response) => {
  try {
    const folder = String(req.params.folder || '');
    const ym = String(req.params.ym || '');
    const filename = String(req.params.filename || '');
    const objectPath = `${folder}/${ym}/${filename}`;

    const upstream = await fetchR2MediaStream(objectPath, req.headers.range);
    if (!upstream) {
      return res.status(404).json({ error: 'Media file not found' });
    }
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status === 404 ? 404 : 502).json({
        error: `Media stream error (HTTP ${upstream.status})`,
      });
    }

    const upstreamCt = upstream.headers.get('content-type');
    const contentType =
      upstreamCt && upstreamCt !== 'application/octet-stream' && upstreamCt !== 'video/quicktime'
        ? upstreamCt
        : inferMediaContentTypeFromPath(objectPath);

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const etag = upstream.headers.get('etag');
    if (etag) res.setHeader('ETag', etag);

    if (!upstream.body) {
      return res.end();
    }
    const nodeStream = Readable.fromWeb(upstream.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
    nodeStream.on('error', () => {
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });
    req.on('close', () => {
      nodeStream.destroy();
    });
    nodeStream.pipe(res);
  } catch (err: unknown) {
    if (!res.headersSent) {
      return res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to stream media' });
    }
    res.end();
  }
});

// ---- LOCAL DISK MEDIA STORAGE (CHUNKED UP TO 500MB FOR 25-30+ MIN VIDEOS & MP3s + HTTP 206 RANGE STREAMING) ----
const LOCAL_MEDIA_ROOT = path.resolve(process.cwd(), '.choychat-media');
const LOCAL_MEDIA_TMP_ROOT = path.resolve(LOCAL_MEDIA_ROOT, '.tmp');
const ALLOWED_LOCAL_MEDIA_FOLDERS = new Set([
  'posts',
  'messages',
  'voice',
  'avatars',
  'music',
  'videos',
  'kyc',
  'marketplace',
  'receipts',
]);

const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB (25-30+ minute videos)
const MAX_AUDIO_UPLOAD_BYTES = 60 * 1024 * 1024;  // 60 MB (MP3/audio)
const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;  // 20 MB

function resolveMediaExtAndKind(
  mimeType: string,
  originalFileName?: string
): { ext: string; mediaType: 'image' | 'video' | 'audio'; maxBytes: number } | null {
  const mime = normalizeMediaMime(mimeType || '').toLowerCase();
  const extFromName = (originalFileName || '').split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v', 'mkv', '3gp', 'ogv'].includes(extFromName)) {
    const extMap: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mp4',
      'video/x-m4v': 'm4v',
      'video/x-matroska': 'mkv',
      'video/3gpp': '3gp',
      'video/ogg': 'ogv',
    };
    const safeExt =
      ['mp4', 'webm', 'mov', 'm4v', 'mkv', '3gp', 'ogv'].includes(extFromName)
        ? extFromName
        : extMap[mime] || 'mp4';
    return { ext: safeExt, mediaType: 'video', maxBytes: MAX_VIDEO_UPLOAD_BYTES };
  }

  if (mime.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'].includes(extFromName)) {
    const extMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/aac': 'aac',
      'audio/flac': 'flac',
    };
    const safeExt =
      ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'].includes(extFromName)
        ? extFromName
        : extMap[mime] || 'mp3';
    return { ext: safeExt, mediaType: 'audio', maxBytes: MAX_AUDIO_UPLOAD_BYTES };
  }

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extFromName)) {
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const safeExt =
      ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extFromName)
        ? extFromName === 'jpeg'
          ? 'jpg'
          : extFromName
        : extMap[mime] || 'jpg';
    return { ext: safeExt, mediaType: 'image', maxBytes: MAX_IMAGE_UPLOAD_BYTES };
  }

  return null;
}

function sanitizeLocalFolder(raw: unknown): string {
  const clean = String(raw || 'posts').trim().toLowerCase();
  return ALLOWED_LOCAL_MEDIA_FOLDERS.has(clean) ? clean : 'posts';
}

function resolveConfinedLocalMediaPath(folder: string, filename: string): string | null {
  if (!ALLOWED_LOCAL_MEDIA_FOLDERS.has(folder)) return null;
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(filename) || filename.includes('..')) return null;
  const resolved = path.resolve(LOCAL_MEDIA_ROOT, folder, filename);
  if (!resolved.startsWith(LOCAL_MEDIA_ROOT + path.sep)) return null;
  return resolved;
}

function sanitizeDownloadFileName(raw: unknown, fallback: string): string {
  const cleaned = String(raw || '')
    .replace(/[\r\n"\\/:*?<>|]/g, '_')
    .replace(/[^a-zA-Z0-9 ._-]/g, '')
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

interface ChunkedUploadSession {
  uploadId: string;
  userId: string;
  folder: string;
  ext: string;
  mediaType: 'image' | 'video' | 'audio';
  totalSize: number;
  receivedBytes: number;
  tmpPath: string;
  createdAtMs: number;
}

const activeChunkedUploads = new Map<string, ChunkedUploadSession>();

function cleanupExpiredChunkedUploads() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, sess] of activeChunkedUploads.entries()) {
    if (sess.createdAtMs < cutoff) {
      activeChunkedUploads.delete(id);
      void fs.promises.unlink(sess.tmpPath).catch(() => {});
    }
  }
}

app.get('/api/media/local/:folder/:filename', async (req: Request, res: Response) => {
  try {
    const folder = String(req.params.folder || '').trim().toLowerCase();
    // STRICT SECURITY RULE: Valid IDs & Real Profile Pictures are PRIVATE — never readable via public media URLs
    if (folder === 'kyc' || folder === 'private_kyc' || folder === 'valid-ids' || folder === 'real-avatars') {
      return res.status(403).json({
        error: 'Access denied. Valid IDs and private profile photos are restricted to Admin review only.',
      });
    }
    const filename = String(req.params.filename || '').trim();
    const fullPath = resolveConfinedLocalMediaPath(folder, filename);
    if (!fullPath) {
      return res.status(400).json({ error: 'Invalid media path' });
    }

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) return res.status(404).json({ error: 'Media file not found' });
    } catch {
      return res.status(404).json({ error: 'Media file not found' });
    }

    const totalSize = stat.size;
    const contentType = inferMediaContentTypeFromPath(filename);
    const wantsDownload = req.query.download === '1' || req.query.download === 'true';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (wantsDownload) {
      const safeName = sanitizeDownloadFileName(req.query.name, filename);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
      const [startRaw, endRaw] = rangeHeader.replace(/^bytes=/, '').split('-');
      const start = startRaw ? Number.parseInt(startRaw, 10) : 0;
      const end = endRaw ? Number.parseInt(endRaw, 10) : Math.min(totalSize - 1, start + 2 * 1024 * 1024 - 1);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end >= totalSize ||
        start > end
      ) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }
      const chunkLen = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', String(chunkLen));
      const stream = fs.createReadStream(fullPath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      req.on('close', () => stream.destroy());
      return stream.pipe(res);
    }

    res.status(200);
    res.setHeader('Content-Length', String(totalSize));
    const stream = fs.createReadStream(fullPath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    req.on('close', () => stream.destroy());
    return stream.pipe(res);
  } catch (err: unknown) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to stream local media' });
    }
    res.end();
  }
});

function isSafeUploadOrigin(req: Request): boolean {
  if (req.headers.authorization?.startsWith('Bearer ')) return true;
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  const origin = req.headers.origin;
  const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  if (typeof origin === 'string' && expectedHost) {
    try {
      return new URL(origin).host === expectedHost;
    } catch {
      return false;
    }
  }
  return false;
}

app.post('/api/media/chunked/init', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (!isSafeUploadOrigin(req)) {
      return res.status(403).json({ error: 'Cross-origin upload blocked' });
    }
    cleanupExpiredChunkedUploads();
    const user = req.choyUser!;
    const folder = sanitizeLocalFolder(req.body?.folder);
    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim().slice(0, 180) : '';
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim().slice(0, 120) : '';
    const totalSize = Math.floor(Number(req.body?.totalSize));

    const resolved = resolveMediaExtAndKind(mimeType, fileName);
    if (!resolved) {
      return res.status(400).json({ error: 'Unsupported media file format. Use MP3/audio, MP4/WebM video, or JPG/PNG image.' });
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0) {
      return res.status(400).json({ error: 'File is empty.' });
    }
    if (totalSize > resolved.maxBytes) {
      const maxMb = Math.round(resolved.maxBytes / (1024 * 1024));
      return res.status(400).json({ error: `File exceeds maximum allowed size of ${maxMb} MB.` });
    }

    await fs.promises.mkdir(LOCAL_MEDIA_TMP_ROOT, { recursive: true });
    const uploadId = `up_${Date.now().toString(36)}_${crypto.randomBytes(10).toString('hex')}`;
    const tmpPath = path.resolve(LOCAL_MEDIA_TMP_ROOT, `${uploadId}.part`);
    if (!tmpPath.startsWith(LOCAL_MEDIA_TMP_ROOT + path.sep)) {
      return res.status(400).json({ error: 'Invalid upload path' });
    }
    await fs.promises.writeFile(tmpPath, Buffer.alloc(0));

    activeChunkedUploads.set(uploadId, {
      uploadId,
      userId: user.id,
      folder,
      ext: resolved.ext,
      mediaType: resolved.mediaType,
      totalSize,
      receivedBytes: 0,
      tmpPath,
      createdAtMs: Date.now(),
    });

    return res.status(201).json({
      ok: true,
      uploadId,
      chunkSize: 4 * 1024 * 1024,
      mediaType: resolved.mediaType,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to initialize upload' });
  }
});

app.post(
  '/api/media/chunked/:uploadId/chunk',
  requireAuth,
  express.raw({ type: () => true, limit: '8mb' }),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!isSafeUploadOrigin(req)) {
        return res.status(403).json({ error: 'Cross-origin upload blocked' });
      }
      const user = req.choyUser!;
      const uploadId = String(req.params.uploadId || '').trim();
      const session = activeChunkedUploads.get(uploadId);
      if (!session || session.userId !== user.id) {
        return res.status(404).json({ error: 'Upload session not found or expired.' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Empty chunk received.' });
      }
      if (session.receivedBytes + req.body.length > session.totalSize + 1024) {
        activeChunkedUploads.delete(uploadId);
        void fs.promises.unlink(session.tmpPath).catch(() => {});
        return res.status(400).json({ error: 'Uploaded data exceeds declared file size.' });
      }

      await fs.promises.appendFile(session.tmpPath, req.body);
      session.receivedBytes += req.body.length;
      return res.json({ ok: true, receivedBytes: session.receivedBytes, totalSize: session.totalSize });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to store upload chunk' });
    }
  }
);

app.post('/api/media/chunked/:uploadId/complete', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (!isSafeUploadOrigin(req)) {
      return res.status(403).json({ error: 'Cross-origin upload blocked' });
    }
    const user = req.choyUser!;
    const uploadId = String(req.params.uploadId || '').trim();
    const session = activeChunkedUploads.get(uploadId);
    if (!session || session.userId !== user.id) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }
    activeChunkedUploads.delete(uploadId);

    const folderDir = path.resolve(LOCAL_MEDIA_ROOT, session.folder);
    if (!folderDir.startsWith(LOCAL_MEDIA_ROOT + path.sep)) {
      void fs.promises.unlink(session.tmpPath).catch(() => {});
      return res.status(400).json({ error: 'Invalid media folder' });
    }
    await fs.promises.mkdir(folderDir, { recursive: true });

    const finalName = `${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}.${session.ext}`;
    const finalPath = resolveConfinedLocalMediaPath(session.folder, finalName);
    if (!finalPath) {
      void fs.promises.unlink(session.tmpPath).catch(() => {});
      return res.status(400).json({ error: 'Invalid destination path' });
    }

    await fs.promises.rename(session.tmpPath, finalPath);
    const stat = await fs.promises.stat(finalPath);
    const url = `/api/media/local/${session.folder}/${finalName}`;
    return res.status(201).json({
      ok: true,
      uploaded: true,
      provider: 'local',
      url,
      mediaType: session.mediaType,
      sizeBytes: stat.size,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to complete upload' });
  }
});

// ---- CLOUDFLARE R2 + SUPABASE + LOCAL DISK MEDIA UPLOAD ENDPOINT ----
app.post(
  '/api/media/upload',
  requireAuth,
  express.raw({ type: () => true, limit: '62mb' }),
  async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.choyUser;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required to upload media' });
      }

      // CSRF protection when authenticated via session cookie
      const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
      if (!hasBearer) {
        const origin = req.headers.origin;
        const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
        const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
        let originMatches = false;
        if (typeof origin === 'string' && expectedHost) {
          try {
            originMatches = new URL(origin).host === expectedHost;
          } catch {
            originMatches = false;
          }
        }
        if (!originMatches && !hasRequestedWith) {
          return res.status(403).json({ error: 'Cross-origin upload blocked' });
        }
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'No media data received' });
      }

      const contentType = String(req.headers['content-type'] || '');
      const normalizedMime = normalizeMediaMime(contentType);
      const isVideo = normalizedMime.startsWith('video/');
      const folder = sanitizeLocalFolder(req.headers['x-media-folder'] || 'posts');

      const r2Status = getR2StorageStatus();
      const supabaseStatus = getSupabaseStorageStatus();
      if (!r2Status.configured && !supabaseStatus.configured) {
        const resolved = resolveMediaExtAndKind(contentType);
        if (!resolved) {
          return res.status(400).json({ error: 'Unsupported media format.' });
        }
        if (req.body.length > resolved.maxBytes) {
          return res.status(400).json({ error: 'File exceeds maximum allowed size.' });
        }
        const folderDir = path.resolve(LOCAL_MEDIA_ROOT, folder);
        if (!folderDir.startsWith(LOCAL_MEDIA_ROOT + path.sep)) {
          return res.status(400).json({ error: 'Invalid upload folder.' });
        }
        await fs.promises.mkdir(folderDir, { recursive: true });
        const finalName = `${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}.${resolved.ext}`;
        const finalPath = resolveConfinedLocalMediaPath(folder, finalName);
        if (!finalPath) {
          return res.status(400).json({ error: 'Invalid media path.' });
        }
        await fs.promises.writeFile(finalPath, req.body);
        return res.status(201).json({
          uploaded: true,
          configured: true,
          provider: 'local',
          url: `/api/media/local/${folder}/${finalName}`,
          mediaType: resolved.mediaType,
          sizeBytes: req.body.length,
        });
      }
      const r2VideosOnly = (process.env.R2_VIDEOS_ONLY || '').trim().toLowerCase() === 'true';

      // Priority: Videos always go to Cloudflare R2 first when configured (keeps Supabase small & zero egress).
      // Non-video media also uses R2 unless R2_VIDEOS_ONLY=true with Supabase active.
      const preferR2 =
        r2Status.configured && (isVideo || !supabaseStatus.configured || !r2VideosOnly);

      if (preferR2) {
        try {
          const result = await uploadToR2Storage(req.body, contentType, folder);
          return res.status(201).json({
            uploaded: true,
            configured: true,
            ...result,
          });
        } catch (r2Err: unknown) {
          const msg = r2Err instanceof Error ? r2Err.message : '';
          const isValidationErr =
            msg.includes('Unsupported media') ||
            msg.includes('Empty file') ||
            msg.includes('exceeds maximum');
          // Gracefully fall back to Supabase only for non-validation failures when payload fits Supabase limits
          if (!isValidationErr && supabaseStatus.configured && req.body.length <= 25 * 1024 * 1024) {
            const fallbackResult = await uploadToSupabaseStorage(req.body, contentType, folder);
            return res.status(201).json({
              uploaded: true,
              configured: true,
              provider: 'supabase',
              ...fallbackResult,
            });
          }
          throw r2Err;
        }
      }

      const result = await uploadToSupabaseStorage(req.body, contentType, folder);
      return res.status(201).json({
        uploaded: true,
        configured: true,
        provider: 'supabase',
        ...result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Media upload failed';
      const isClientErr =
        message.includes('Unsupported media') ||
        message.includes('Empty file') ||
        message.includes('exceeds maximum');
      return res.status(isClientErr ? 400 : 502).json({ error: message });
    }
  }
);

app.get('/api/auth/session', async (req, res) => {
  await store.ready();
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = bearerToken || readSessionCookie(req);
  if (!token) {
    return res.json({ authenticated: false });
  }
  const session = verifySessionToken(token);
  if (!session) {
    clearSessionCookie(req, res);
    return res.json({ authenticated: false });
  }
  try {
    const user = await store.getUserById(session.uid);
    if (!user) {
      clearSessionCookie(req, res);
      return res.json({ authenticated: false });
    }
    return res.json({
      authenticated: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        blockedUsers: user.blockedUsers,
        avatar: user.avatar,
        newsfeed: user.newsfeed,
      },
    });
  } catch {
    return res.json({ authenticated: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(req, res);
  return res.json({ ok: true });
});

let adminSetupLock = false;
app.post('/api/auth/setup-admin', async (req, res) => {
  if (adminSetupLock) {
    return res.status(409).json({ error: 'Admin setup already in progress' });
  }
  adminSetupLock = true;
  try {
    await store.ready();
    if (await store.hasAnyAdmin()) {
      return res.status(409).json({ error: 'Admin account is already configured. Please log in.' });
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? normalizePhone(req.body.phone) : '';
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!name || name.length > 80) {
      return res.status(400).json({ error: 'Valid admin name is required' });
    }
    if (!phone || phone.length < 4 || phone.length > 40) {
      return res.status(400).json({ error: 'Valid phone or username is required' });
    }
    if (!pin || pin.length < 4 || pin.length > 64) {
      return res.status(400).json({ error: 'PIN must be between 4 and 64 characters' });
    }
    const user = await store.createUser({
      name,
      phone,
      pin,
      role: 'admin',
      status: 'approved',
    });
    const token = signSessionToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastSync('users');
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        blockedUsers: user.blockedUsers,
        avatar: user.avatar,
        newsfeed: user.newsfeed,
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Admin setup failed' });
  } finally {
    adminSetupLock = false;
  }
});

// ============================================================================
// PRIVATE KYC STORAGE UPLOAD & ADMIN-ONLY FETCH (Valid IDs & Real Profile Pics)
// ============================================================================
const PRIVATE_KYC_VAULT_DIR = path.resolve(process.cwd(), '.choy_private_kyc_vault');
const privateUploadRateMap = new Map<string, { count: number; resetAt: number }>();

function checkPrivateUploadRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = privateUploadRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    privateUploadRateMap.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (entry.count >= 25) return false;
  entry.count += 1;
  return true;
}

async function storePrivateKycImage(
  buffer: Buffer,
  contentType: string,
  kind: 'valid_id' | 'real_avatar',
  ownerUserId?: string
): Promise<StoredPrivateKycAsset> {
  const mime = normalizeMediaMime(contentType);
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const ext = extMap[mime];
  if (!ext) {
    throw new Error('Only JPG, PNG, or WebP images are accepted for Valid ID and Profile Picture.');
  }
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file upload.');
  }
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Image exceeds maximum allowed size of 8 MB.');
  }

  const subfolder: PrivateKycSubfolder = kind === 'real_avatar' ? 'real-avatars' : 'valid-ids';
  const id = `priv_kyc_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const supaPrivate = getSupabasePrivateKycStatus();

  if (supaPrivate.configured) {
    try {
      const uploaded = await uploadToSupabasePrivateKycBucket(buffer, mime, subfolder);
      const asset: StoredPrivateKycAsset = {
        id,
        ownerUserId,
        kind,
        storage: 'supabase_private',
        bucket: uploaded.bucket,
        path: uploaded.path,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        createdAt,
      };
      return await store.savePrivateKycAsset(asset);
    } catch (supaErr) {
      await store.appendErrorLog({
        source: 'storage',
        severity: 'warning',
        message: `Supabase private bucket upload fallback to local vault: ${supaErr instanceof Error ? supaErr.message : 'unknown error'}`,
      });
    }
  }

  // Confined local private vault (strictly outside public media folders; never served publicly)
  const targetDir = path.resolve(PRIVATE_KYC_VAULT_DIR, subfolder);
  if (!targetDir.startsWith(PRIVATE_KYC_VAULT_DIR + path.sep)) {
    throw new Error('Invalid private vault directory');
  }
  await fs.promises.mkdir(targetDir, { recursive: true });
  const fileName = `${id}${ext}`;
  const fullPath = path.resolve(targetDir, fileName);
  if (!fullPath.startsWith(targetDir + path.sep)) {
    throw new Error('Invalid private vault path');
  }
  await fs.promises.writeFile(fullPath, buffer);

  const asset: StoredPrivateKycAsset = {
    id,
    ownerUserId,
    kind,
    storage: 'local_private',
    bucket: getSanitizedPrivateKycBucket(),
    path: `${subfolder}/${fileName}`,
    mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
    sizeBytes: buffer.length,
    createdAt,
  };
  return await store.savePrivateKycAsset(asset);
}

app.post(
  '/api/auth/register/private-upload',
  express.raw({ type: () => true, limit: '9mb' }),
  async (req: Request, res: Response) => {
    try {
      const clientIp = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
      if (!checkPrivateUploadRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many uploads. Please wait a few minutes and try again.' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'No image data received.' });
      }
      const rawKind = String(req.headers['x-kyc-kind'] || 'valid_id').trim().toLowerCase();
      const kind: 'valid_id' | 'real_avatar' = rawKind === 'real_avatar' ? 'real_avatar' : 'valid_id';
      const contentType = String(req.headers['content-type'] || 'image/jpeg');
      const asset = await storePrivateKycImage(req.body, contentType, kind);
      // NEVER return a public URL — only an opaque assetId locked to Admin review
      return res.status(201).json({
        ok: true,
        assetId: asset.id,
        kind: asset.kind,
        bucket: asset.bucket,
        isPrivate: true,
        sizeBytes: asset.sizeBytes,
      });
    } catch (err: unknown) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Private upload failed' });
    }
  }
);

app.post(
  '/api/choy/profile-kyc/private-upload',
  requireAuth,
  express.raw({ type: () => true, limit: '9mb' }),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!isSafeUploadOrigin(req)) {
        return res.status(403).json({ error: 'Cross-origin upload blocked' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'No image data received.' });
      }
      const rawKind = String(req.headers['x-kyc-kind'] || 'valid_id').trim().toLowerCase();
      const kind: 'valid_id' | 'real_avatar' = rawKind === 'real_avatar' ? 'real_avatar' : 'valid_id';
      const contentType = String(req.headers['content-type'] || 'image/jpeg');
      const asset = await storePrivateKycImage(req.body, contentType, kind, req.choyUser!.id);
      return res.status(201).json({
        ok: true,
        assetId: asset.id,
        kind: asset.kind,
        bucket: asset.bucket,
        isPrivate: true,
        sizeBytes: asset.sizeBytes,
      });
    } catch (err: unknown) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Private KYC upload failed' });
    }
  }
);

// ADMIN-ONLY PRIVATE KYC IMAGE STREAM: Regular users, customers, and riders get 403 Forbidden!
app.get('/api/admin/private-kyc/file/:assetId', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const assetId = String(req.params.assetId || '').trim();
    if (!/^priv_kyc_[a-zA-Z0-9_-]{6,64}$/.test(assetId)) {
      return res.status(400).json({ error: 'Invalid private KYC asset ID.' });
    }
    const asset = await store.getPrivateKycAssetById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Private KYC file not found.' });
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (asset.storage === 'supabase_private') {
      const { buffer, contentType } = await downloadFromSupabasePrivateKycBucket(asset.bucket, asset.path);
      res.setHeader('Content-Type', contentType || asset.mimeType || 'image/jpeg');
      res.setHeader('Content-Length', String(buffer.length));
      return res.status(200).send(buffer);
    }

    const cleanRel = asset.path.replace(/^\/+/, '');
    const resolved = path.resolve(PRIVATE_KYC_VAULT_DIR, cleanRel);
    if (!resolved.startsWith(PRIVATE_KYC_VAULT_DIR + path.sep)) {
      return res.status(400).json({ error: 'Invalid private file path.' });
    }
    const stat = await fs.promises.stat(resolved).catch(() => null);
    if (!stat || !stat.isFile()) {
      return res.status(404).json({ error: 'Private KYC file missing on disk.' });
    }
    res.setHeader('Content-Type', asset.mimeType || 'image/jpeg');
    res.setHeader('Content-Length', String(stat.size));
    return fs.createReadStream(resolved).pipe(res);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch private KYC file.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    await store.ready();
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const realName = typeof req.body?.realName === 'string' ? req.body.realName.trim().slice(0, 120) : '';
    const phone = typeof req.body?.phone === 'string' ? normalizePhone(req.body.phone) : '';
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const privateValidIdAssetId =
      typeof req.body?.privateValidIdAssetId === 'string' ? req.body.privateValidIdAssetId.trim() : '';
    const privateRealAvatarAssetId =
      typeof req.body?.privateRealAvatarAssetId === 'string' ? req.body.privateRealAvatarAssetId.trim() : '';
    const privacyConsentAccepted = req.body?.privacyConsentAccepted === true;

    if (!name || name.length > 80) {
      return res.status(400).json({ error: 'Display Name / Username is required (max 80 chars)' });
    }
    if (!phone || phone.length < 4 || phone.length > 40) {
      return res.status(400).json({ error: 'Cellphone number is required' });
    }
    if (!pin || pin.length < 4 || pin.length > 64) {
      return res.status(400).json({ error: 'PIN must be at least 4 characters' });
    }
    if ((privateValidIdAssetId || privateRealAvatarAssetId) && !privacyConsentAccepted) {
      return res.status(400).json({
        error: 'You must accept the Privacy Policy consent checkbox before uploading your Valid ID or profile picture.',
      });
    }
    if (privateValidIdAssetId && !/^priv_kyc_[a-zA-Z0-9_-]{6,64}$/.test(privateValidIdAssetId)) {
      return res.status(400).json({ error: 'Invalid Valid ID reference.' });
    }
    if (privateRealAvatarAssetId && !/^priv_kyc_[a-zA-Z0-9_-]{6,64}$/.test(privateRealAvatarAssetId)) {
      return res.status(400).json({ error: 'Invalid Profile Picture reference.' });
    }

    const existing = await store.getUserByPhone(phone);
    if (existing) {
      return res.status(409).json({ error: 'Phone number is already registered. Please log in.' });
    }

    const user = await store.createUser({
      name,
      phone,
      pin,
      role: 'member',
      status: 'approved',
      realNamePlaintext: realName || undefined,
      privateValidIdAssetId: privateValidIdAssetId || undefined,
      privateRealAvatarAssetId: privateRealAvatarAssetId || undefined,
      privacyConsentAccepted,
    });

    if (privateValidIdAssetId) {
      await store.bindPrivateKycAssetOwner(privateValidIdAssetId, user.id);
    }
    if (privateRealAvatarAssetId) {
      await store.bindPrivateKycAssetOwner(privateRealAvatarAssetId, user.id);
    }

    // If customer uploaded a Valid ID during registration, queue it for Admin User Verification
    if (privateValidIdAssetId || realName) {
      const dash = await store.getUserDashboard(user.id);
      dash.kycCompleteName = realName || name;
      dash.kycValidIdName = realName || name;
      dash.kycValidIdType = 'Registration Valid ID';
      dash.kycStatus = 'pending';
      dash.kycSubmittedAt = new Date().toISOString();
      await store.saveUserDashboard(dash);
    }

    await store.appendActivityLog({
      category: 'auth',
      actor: user.name,
      message: `${user.name} registered a new customer account${privateValidIdAssetId ? ' with private KYC upload' : ''}.`,
    });

    const token = signSessionToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastSync('users');
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        blockedUsers: user.blockedUsers,
        avatar: user.avatar,
        newsfeed: user.newsfeed,
      },
    });
  } catch (err: unknown) {
    await store.appendErrorLog({
      source: 'auth',
      severity: 'error',
      message: `Registration error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await store.ready();
    const phone = typeof req.body?.phone === 'string' ? normalizePhone(req.body.phone) : '';
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!phone || !pin) {
      return res.status(400).json({ error: 'Phone and PIN are required' });
    }

    // Check configured process.env ADMIN_PIN override first
    const envAdminPin = stripOuterQuotes(process.env.ADMIN_PIN || '');
    const envAdminPhone = normalizePhone(stripOuterQuotes(process.env.ADMIN_PHONE || '09361223978'));
    if (envAdminPin && timingSafeStringEqual(phone, envAdminPhone) && timingSafeStringEqual(pin, envAdminPin)) {
      const adminUser = await store.ensureEnvAdminUser(envAdminPhone);
      const token = signSessionToken(adminUser.id, 'admin');
      setSessionCookie(req, res, token);
      return res.json({
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          phone: adminUser.phone,
          role: adminUser.role,
          status: adminUser.status,
          blockedUsers: adminUser.blockedUsers,
          avatar: adminUser.avatar,
          newsfeed: adminUser.newsfeed,
        },
      });
    }

    const user = await store.getUserByPhone(phone);
    if (!user || !verifyPin(pin, user.pinHash)) {
      return res.status(401).json({ error: 'Invalid phone or PIN' });
    }
    if (user.status !== 'approved') {
      await store.updateUserStatus(user.id, 'approved');
      user.status = 'approved';
    }
    const token = signSessionToken(user.id, user.role);
    setSessionCookie(req, res, token);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        blockedUsers: user.blockedUsers,
        avatar: user.avatar,
        newsfeed: user.newsfeed,
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Login failed' });
  }
});

app.post('/api/auth/avatar', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const user = req.choyUser!;
    const rawAvatar = req.body?.avatarUrl;
    let nextAvatar: string | undefined;

    if (rawAvatar === null || rawAvatar === undefined || (typeof rawAvatar === 'string' && !rawAvatar.trim())) {
      nextAvatar = undefined;
    } else if (typeof rawAvatar === 'string') {
      const trimmed = rawAvatar.trim();
      const safe = sanitizeMediaUrl(trimmed);
      const isAllowedImage =
        Boolean(safe) &&
        (safe!.startsWith('https://') ||
          safe!.startsWith('/assets/') ||
          safe!.startsWith('data:image/'));
      if (!isAllowedImage) {
        return res.status(400).json({ error: 'Please upload a valid image (JPG, PNG, WebP, or GIF).' });
      }
      nextAvatar = safe;
    } else {
      return res.status(400).json({ error: 'Invalid profile picture format.' });
    }

    const updated = await store.updateUserAvatar(user.id, nextAvatar);
    if (!updated) {
      return res.status(404).json({ error: 'Account not found' });
    }
    broadcastSync('users');
    broadcastSync('posts');
    return res.json({
      ok: true,
      avatar: updated.avatar || null,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update profile picture' });
  }
});

app.post('/api/auth/name', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const user = req.choyUser!;
    const rawName = typeof req.body?.name === 'string' ? req.body.name.replace(/\s+/g, ' ').trim() : '';
    if (!rawName || rawName.length < 2 || rawName.length > 60 || /[\x00-\x1f\x7f]/.test(rawName)) {
      return res.status(400).json({ error: 'Name must be between 2 and 60 characters.' });
    }
    const reserved = new Set(['vip group', 'all', 'everyone', 'system', 'member']);
    if (reserved.has(rawName.toLowerCase())) {
      return res.status(400).json({ error: 'That name is reserved. Please choose another display name.' });
    }

    const result = await store.updateUserName(user.id, rawName);
    if (!result.ok) {
      return res.status(result.code === 'conflict' ? 409 : 404).json({ error: result.error });
    }

    // Keep live SSE sessions & online presence map synchronized with the new name
    const oldKey = result.previousName.trim().toLowerCase();
    const newKey = result.user.name.trim().toLowerCase();
    if (oldKey && oldKey !== newKey && userLastSeenMap.has(oldKey)) {
      userLastSeenMap.delete(oldKey);
    }
    userLastSeenMap.set(newKey, Date.now());
    for (const client of sseClients) {
      if (client.userId === user.id) {
        client.userName = result.user.name;
      }
    }

    broadcastSync('users');
    broadcastSync('posts');
    broadcastSync('messages');

    return res.json({
      ok: true,
      name: result.user.name,
      previousName: result.previousName,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update name' });
  }
});

const handleSelfDeleteAccount = async (req: AuthedRequest, res: Response) => {
  try {
    // CSRF guard when authenticated via session cookie
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const user = req.choyUser;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin account cannot be self-deleted.' });
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!pin || !verifyPin(pin, user.pinHash)) {
      return res.status(401).json({ error: 'Incorrect PIN. Enter your current PIN to confirm account deletion.' });
    }

    const deleted = await store.deleteUser(user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Account could not be deleted.' });
    }

    clearSessionCookie(req, res);
    broadcastSync('users');
    return res.json({ deleted: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete account' });
  }
};

app.post('/api/auth/delete-account', requireAuth, handleSelfDeleteAccount);
app.delete('/api/auth/account', requireAuth, handleSelfDeleteAccount);

app.get('/api/choy/stream', requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.choyUser!;
  touchUserPresence(user.name);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.flushHeaders?.();
  res.write(`:${' '.repeat(2048)}\n\n`);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, uid: user.id, latestRtcSeq: rtcSignalSeq })}\n\n`);
  const client: SseClient = { res, userId: user.id, userName: user.name, role: user.role };
  sseClients.add(client);

  const keepAlive = setInterval(() => {
    try {
      touchUserPresence(user.name);
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(client);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(client);
  });
});

// ---- BACKGROUND WEB PUSH NOTIFICATIONS & LIVE PRESENCE ----
app.get('/api/choy/push/vapid-public-key', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const publicKey = await ensureWebPushConfigured();
    return res.json({ publicKey });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Push service unavailable' });
  }
});

app.post('/api/choy/push/subscribe', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    touchUserPresence(user.name);
    const sub = req.body?.subscription || req.body;
    const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint.trim() : '';
    const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh.trim() : '';
    const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth.trim() : '';

    if (!endpoint || !endpoint.startsWith('https://') || !p256dh || !auth) {
      return res.status(400).json({ error: 'Valid push subscription with HTTPS endpoint and keys is required' });
    }

    await store.savePushSubscription({
      endpoint,
      userId: user.id,
      userName: user.name,
      keys: { p256dh, auth },
    });

    return res.json({ ok: true, subscribed: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save push subscription' });
  }
});

app.post('/api/choy/push/unsubscribe', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
    if (endpoint) {
      await store.removePushSubscription(endpoint);
    }
    return res.json({ ok: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to unsubscribe' });
  }
});

app.post('/api/choy/presence', requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.choyUser!;
  touchUserPresence(user.name);
  broadcastSync('presence');
  return res.json({ ok: true, onlineUsers: getOnlineUserNames() });
});

// ---- REAL-TIME WEBRTC VIDEO CALL SIGNALING (SSE + RELIABLE POLL FALLBACK) ----
app.get('/api/choy/rtc/poll', requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.choyUser!;
  const now = Date.now();
  touchUserPresence(user.name);
  pruneRtcQueue(now);

  const rawSince = Number(req.query.since);
  const since = Number.isFinite(rawSince) && rawSince > 0 ? rawSince : 0;
  const myNameLower = user.name.trim().toLowerCase();
  const minFreshTs = since === 0 ? now - 75_000 : 0;

  const matched = rtcSignalQueue.filter((item) => {
    if (item.seq <= since) return false;
    if (since === 0 && item.createdAtMs < minFreshTs) return false;
    if (item.senderUserId === user.id) return false;
    if (item.targetUserId) {
      return item.targetUserId === user.id;
    }
    if (item.targetMemberIds && item.targetMemberIds.length > 0) {
      return item.targetMemberIds.includes(user.id);
    }
    return (
      item.targetNameLower === 'vip group' ||
      item.targetNameLower === '' ||
      item.targetNameLower === myNameLower
    );
  });

  return res.json({
    signals: matched.map((m) => m.payload),
    latestSeq: rtcSignalSeq,
  });
});

const ipGeoCache = new Map<
  string,
  { lat: number; lng: number; label: string; fetchedAt: number }
>();

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (!clean) return true;
  if (
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('127.') ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('169.254.') ||
    clean.startsWith('0.') ||
    clean.startsWith('fc') ||
    clean.startsWith('fd') ||
    clean.startsWith('fe80:')
  ) {
    return true;
  }
  const m172 = clean.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function extractClientPublicIp(req: Request): string | null {
  const candidates: string[] = [];
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    for (const part of xff.split(',')) {
      candidates.push(part.trim());
    }
  } else if (Array.isArray(xff)) {
    for (const entry of xff) {
      for (const part of entry.split(',')) {
        candidates.push(part.trim());
      }
    }
  }
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string') candidates.push(cfIp.trim());
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') candidates.push(realIp.trim());
  if (req.socket?.remoteAddress) candidates.push(req.socket.remoteAddress.trim());

  for (const raw of candidates) {
    const cleaned = raw.replace(/^::ffff:/i, '').replace(/^\[|\]$/g, '').trim();
    if (!cleaned || isPrivateOrLocalIp(cleaned)) continue;
    if (/^[0-9a-fA-F:.]{3,45}$/.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

async function resolveIpGeolocation(
  ip: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  const cached = ipGeoCache.get(ip);
  if (cached && Date.now() - cached.fetchedAt < 30 * 60 * 1000) {
    return { lat: cached.lat, lng: cached.lng, label: cached.label };
  }

  const fetchWithTimeout = async (url: string): Promise<Record<string, unknown> | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'ChoyChat/2.6' },
      });
      if (!resp.ok) return null;
      return (await resp.json()) as Record<string, unknown>;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Provider 1: ipwho.is (HTTPS, free, no API key)
  const p1 = await fetchWithTimeout(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (
    p1 &&
    p1.success !== false &&
    typeof p1.latitude === 'number' &&
    typeof p1.longitude === 'number' &&
    Number.isFinite(p1.latitude) &&
    Number.isFinite(p1.longitude)
  ) {
    const label = [p1.city, p1.region, p1.country_code]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, 2)
      .join(', ') || 'IP Approx';
    const result = { lat: p1.latitude, lng: p1.longitude, label };
    ipGeoCache.set(ip, { ...result, fetchedAt: Date.now() });
    return result;
  }

  // Provider 2 fallback: ipapi.co (HTTPS, free, no API key)
  const p2 = await fetchWithTimeout(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
  if (
    p2 &&
    !p2.error &&
    typeof p2.latitude === 'number' &&
    typeof p2.longitude === 'number' &&
    Number.isFinite(p2.latitude) &&
    Number.isFinite(p2.longitude)
  ) {
    const label = [p2.city, p2.region, p2.country_code]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, 2)
      .join(', ') || 'IP Approx';
    const result = { lat: p2.latitude, lng: p2.longitude, label };
    ipGeoCache.set(ip, { ...result, fetchedAt: Date.now() });
    return result;
  }

  return null;
}

app.post('/api/choy/gps/ping', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const { lat, lng, accuracy, speed, heading } = req.body || {};
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({ error: 'Valid lat and lng required' });
    }
    const safeAcc = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined;
    const safeSpeed = typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed : undefined;
    const safeHeading =
      typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : undefined;
    await store.upsertLocation(user.id, user.name, lat, lng, safeAcc, safeSpeed, safeHeading, 'gps');
    broadcastGpsToAdmins(user.id);
    res.json({ success: true, source: 'gps' });
  } catch (err) {
    console.error('[GPS Ping Error]:', err);
    res.status(500).json({ error: 'Failed to record location' });
  }
});

app.post('/api/choy/gps/ip-ping', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const clientIp = extractClientPublicIp(req);
    if (!clientIp) {
      return res.json({ success: false, skipped: 'local_ip' });
    }
    const geo = await resolveIpGeolocation(clientIp);
    if (!geo) {
      return res.json({ success: false, skipped: 'ip_lookup_unavailable' });
    }
    const updated = await store.upsertLocation(
      user.id,
      user.name,
      geo.lat,
      geo.lng,
      5000,
      undefined,
      undefined,
      'ip',
      geo.label
    );
    if (updated) {
      broadcastGpsToAdmins(user.id);
    }
    return res.json({ success: updated, source: 'ip', label: geo.label });
  } catch (err) {
    console.error('[IP Fallback GPS Error]:', err);
    return res.status(500).json({ error: 'Failed to record IP location fallback' });
  }
});

app.get('/api/admin/gps/locations', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const [locations, users] = await Promise.all([store.getAllLocations(), store.listUsers(true)]);
    const avatarById = new Map<string, string | undefined>();
    for (const u of users) {
      avatarById.set(u.id, u.avatar);
    }
    res.json({
      locations: locations.map((l) => ({
        ...l,
        avatar: avatarById.get(l.userId),
      })),
    });
  } catch (err) {
    console.error('[Get GPS Locations Error]:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Emoji Link Vault & App Icon Auto-Sync Endpoints
app.get('/api/choy/emoji-links', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const emojiLinks = await store.listEmojiLinks();
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;
    return res.json({ emojiLinks, activeEmojiLink });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load emoji links' });
  }
});

app.post('/api/choy/emoji-links', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const rawEmoji = typeof req.body?.emojiCode === 'string' ? req.body.emojiCode.trim() : '';
    const safeUrl = sanitizeWebsiteUrl(req.body?.targetUrl);
    if (!rawEmoji || rawEmoji.length > 64) {
      return res.status(400).json({ error: 'Valid emoji code (1–64 chars) is required' });
    }
    if (!safeUrl) {
      return res.status(400).json({ error: 'Valid http:// or https:// live website URL is required' });
    }
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = (rawTitle || 'Choy Chat Live').slice(0, 80);
    const iconUrl = sanitizeMediaUrl(req.body?.iconUrl) || DEFAULT_PROFILE_ICON;
    const pinnedToAppIcon = req.body?.pinnedToAppIcon !== false;
    const autoPush = req.body?.autoPush !== false;

    const saved = await store.createEmojiLink({
      emojiCode: rawEmoji,
      targetUrl: safeUrl,
      title,
      iconUrl,
      pinnedToAppIcon,
      createdBy: user.name,
    });
    const emojiLinks = await store.listEmojiLinks();
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;

    broadcastSync('emoji-links');
    if (autoPush) {
      sendWebPushToTarget('VIP Group', user.id, {
        title: `${saved.emojiCode} ${saved.title}`,
        body: 'Live app emoji link updated & synced to App Icon!',
        url: `/go?e=${encodeURIComponent(saved.emojiCode)}`,
        icon: getSafePushIcon(saved.iconUrl),
        tag: 'choy-emoji-link',
      }).catch(() => {});
    }

    return res.status(201).json({ link: saved, emojiLinks, activeEmojiLink });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save emoji link' });
  }
});

app.post('/api/choy/emoji-links/:id/pin', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const pinned = await store.pinEmojiLink(req.params.id);
    if (!pinned) {
      return res.status(404).json({ error: 'Emoji link not found' });
    }
    const emojiLinks = await store.listEmojiLinks();
    broadcastSync('emoji-links');
    if (req.body?.autoPush !== false) {
      sendWebPushToTarget('VIP Group', user.id, {
        title: `${pinned.emojiCode} ${pinned.title}`,
        body: 'App Icon Emoji Link pinned & synced across devices!',
        url: `/go?e=${encodeURIComponent(pinned.emojiCode)}`,
        icon: getSafePushIcon(pinned.iconUrl),
        tag: 'choy-emoji-link',
      }).catch(() => {});
    }
    return res.json({ link: pinned, emojiLinks, activeEmojiLink: pinned });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to pin emoji link' });
  }
});

app.delete('/api/choy/emoji-links/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await store.deleteEmojiLink(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Emoji link not found' });
    }
    const emojiLinks = await store.listEmojiLinks();
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;
    broadcastSync('emoji-links');
    return res.json({ deleted: true, emojiLinks, activeEmojiLink });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete emoji link' });
  }
});

// Public Rich Preview & Redirect for Shared Emoji Links (/go?e=...)
app.get('/go', async (req: Request, res: Response) => {
  try {
    const codeParam = typeof req.query?.e === 'string' ? req.query.e.trim() : '';
    const resolved = await store.resolveEmojiLink(codeParam);
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.get('host') || 'chat-9-si9x.onrender.com').split(',')[0].trim();
    const baseOrigin = `${proto}://${host}`;

    const safeTargetUrl = sanitizeWebsiteUrl(resolved?.targetUrl) || baseOrigin;
    const emojiCode = resolved?.emojiCode || codeParam || '🔐🟢💬✨🚀';
    const title = resolved?.title || 'Choy Chat Live App';
    const rawIcon = resolved?.iconUrl || DEFAULT_PROFILE_ICON;
    const absoluteIconUrl =
      rawIcon.startsWith('http://') || rawIcon.startsWith('https://')
        ? rawIcon
        : `${baseOrigin}${rawIcon.startsWith('/') ? rawIcon : '/' + rawIcon}`;

    const escapedTitle = escapeHtml(`${emojiCode} ${title}`);
    const escapedDesc = escapeHtml(`Tap to open ${title} (${emojiCode}) • Live App Link`);
    const escapedIcon = escapeHtml(absoluteIconUrl);
    const escapedTarget = escapeHtml(safeTargetUrl);
    const escapedEmoji = escapeHtml(emojiCode);

    return res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDesc}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDesc}" />
    <meta property="og:image" content="${escapedIcon}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapedIcon}" />
  </head>
  <body style="margin:0;min-height:100vh;background:#022c22;color:#ecfdf5;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="max-width:380px;width:100%;background:#064e3b;border:1px solid rgba(52,211,153,0.45);border-radius:24px;padding:28px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.45);">
      <div style="position:relative;display:inline-block;margin-bottom:16px;">
        <img src="${escapedIcon}" alt="" style="width:128px;height:160px;object-fit:contain;border-radius:18px;border:2px solid #34d399;background:#022c22;padding:4px;" />
        <div style="margin-top:-18px;display:inline-block;background:#022c22;border:2px solid #fbbf24;border-radius:999px;padding:6px 14px;font-size:22px;letter-spacing:2px;box-shadow:0 6px 18px rgba(0,0,0,0.4);">
          ${escapedEmoji}
        </div>
      </div>
      <h1 style="margin:8px 0 6px;font-size:18px;font-weight:800;color:#ffffff;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 18px;font-size:12px;color:#a7f3d0;">Redirecting to live website...</p>
      <a href="${escapedTarget}" rel="noopener noreferrer" style="display:inline-block;width:100%;box-sizing:border-box;padding:12px 18px;border-radius:14px;background:#34d399;color:#022c22;font-weight:800;font-size:14px;text-decoration:none;">
        Open Live Website →
      </a>
    </div>
    <script>
      setTimeout(function () {
        window.location.replace(${JSON.stringify(safeTargetUrl)});
      }, 450);
    </script>
  </body>
</html>`);
  } catch {
    return res.redirect('/');
  }
});

app.post('/api/choy/rtc/signal', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    touchUserPresence(user.name);
    const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
    const allowedTypes = [
      'offer',
      'answer',
      'ice',
      'hangup',
      'decline',
      'group_invite',
      'group_join',
      'group_here',
      'group_leave',
    ];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid signaling event type' });
    }
    const callId = typeof req.body?.callId === 'string' ? req.body.callId.trim().slice(0, 80) : '';
    const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.trim().slice(0, 80) : 'VIP Group';
    const targetUserId =
      typeof req.body?.targetUserId === 'string' && req.body.targetUserId.trim()
        ? req.body.targetUserId.trim().slice(0, 128)
        : undefined;
    const targetName =
      typeof req.body?.targetName === 'string' && req.body.targetName.trim()
        ? req.body.targetName.trim().slice(0, 80)
        : roomId;
    const callMode: 'direct' | 'group' =
      req.body?.callMode === 'group' ||
      type.startsWith('group_') ||
      roomId.trim().toLowerCase() === 'vip group' ||
      roomId.startsWith('grp_')
        ? 'group'
        : 'direct';

    if (!callId) {
      return res.status(400).json({ error: 'callId is required' });
    }

    let customGroup: StoredChatGroup | null = null;
    if (roomId.startsWith('grp_')) {
      customGroup = await store.getChatGroupById(roomId);
      if (!customGroup) {
        return res.status(404).json({ error: 'Group chat not found' });
      }
      const isMember =
        user.role === 'admin' ||
        customGroup.createdById === user.id ||
        (customGroup.adminId || customGroup.createdById) === user.id ||
        customGroup.memberIds.includes(user.id);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this group.' });
      }
    }

    const resolvedGroupName =
      typeof req.body?.groupName === 'string' && req.body.groupName.trim()
        ? req.body.groupName.trim().slice(0, 80)
        : customGroup?.name || (roomId.trim().toLowerCase() === 'vip group' ? 'VIP Group' : targetName);

    if (type === 'offer' && !targetUserId && user.role !== 'admin' && !customGroup) {
      const targetLower = targetName.toLowerCase();
      if (targetLower !== 'vip group' && targetLower !== 'choy admin') {
        const allUsers = await store.listUsers(false);
        const targetUser = allUsers.find((u) => u.name.trim().toLowerCase() === targetLower);
        if (targetUser && !canViewerSeeUser(user, targetUser)) {
          return res.status(403).json({ error: 'User is outside your assigned newsfeed channel.' });
        }
      }
    }

    // Track active group calls on server so late joiners see a Join Call banner
    const now = Date.now();
    if (callMode === 'group') {
      const roomKey = roomId.trim();
      if (type === 'group_invite' || type === 'group_join' || type === 'group_here') {
        let entry = activeGroupCallsMap.get(roomKey);
        if (!entry || entry.callId !== callId) {
          if (type === 'group_invite' || !entry) {
            entry = {
              callId,
              roomId: roomKey,
              groupName: resolvedGroupName,
              hostUserId: user.id,
              hostUserName: user.name,
              startedAtMs: now,
              participants: new Map(),
            };
            activeGroupCallsMap.set(roomKey, entry);
          }
        }
        if (entry && entry.callId === callId) {
          entry.participants.set(user.id, { userId: user.id, userName: user.name, lastSeenMs: now });
          if (type === 'group_invite' || type === 'group_join') {
            broadcastSync('calls');
          }
        }
      } else if (type === 'group_leave' || type === 'hangup') {
        const entry = activeGroupCallsMap.get(roomKey);
        if (entry && entry.callId === callId) {
          entry.participants.delete(user.id);
          if (entry.participants.size === 0) {
            activeGroupCallsMap.delete(roomKey);
          }
          broadcastSync('calls');
        }
      }
    }

    const groupMemberIds =
      customGroup && !targetUserId
        ? Array.from(
            new Set([...customGroup.memberIds, customGroup.createdById, customGroup.adminId || customGroup.createdById])
          )
        : undefined;

    const result = sendRtcSignal(
      targetName,
      user.id,
      {
        type,
        callId,
        roomId,
        callMode,
        groupName: callMode === 'group' ? resolvedGroupName : undefined,
        targetUserId,
        targetName,
        fromUserId: user.id,
        fromUserName: user.name,
        sdp: req.body?.sdp ?? undefined,
        candidate: req.body?.candidate ?? undefined,
        ts: now,
      },
      {
        targetUserId,
        targetMemberIds: groupMemberIds,
      }
    );

    // Wake closed/backgrounded devices on mobile data with Caller Profile Icon alert
    if (type === 'offer' && callMode === 'direct') {
      void sendWebPushToTarget(
        targetName,
        user.id,
        {
          kind: 'call',
          title: `Incoming Video Call · ${user.name}`,
          body: `${user.name} is calling you on Choy Chat. Tap Answer to join live video.`,
          icon: getSafePushIcon(user.avatar),
          badge: '/pwa-192x192.png',
          tag: `choy-call-${callId}`,
          callId,
          roomId,
          callerName: user.name,
          url: `/?incomingCall=${encodeURIComponent(callId)}&caller=${encodeURIComponent(
            user.name
          )}&room=${encodeURIComponent(roomId)}`,
        },
        'high'
      );
    } else if (type === 'group_invite') {
      void sendWebPushToTarget(
        customGroup ? '' : 'VIP Group',
        user.id,
        {
          kind: 'call',
          title: `Group Video Call · ${resolvedGroupName}`,
          body: `${user.name} started a group video call in ${resolvedGroupName}. Tap Answer to join!`,
          icon: getSafePushIcon(user.avatar),
          badge: '/pwa-192x192.png',
          tag: `choy-call-${callId}`,
          callId,
          roomId,
          groupName: resolvedGroupName,
          callMode: 'group',
          callerName: user.name,
          url: `/?incomingCall=${encodeURIComponent(callId)}&caller=${encodeURIComponent(
            user.name
          )}&room=${encodeURIComponent(roomId)}&callMode=group`,
        },
        'high',
        groupMemberIds
      );
    } else if (type === 'hangup' || type === 'decline' || (type === 'group_leave' && !activeGroupCallsMap.has(roomId.trim()))) {
      void sendWebPushToTarget(
        targetName,
        user.id,
        {
          kind: 'call_ended',
          callId,
          callerName: user.name,
        },
        'high',
        groupMemberIds
      );
    }

    return res.json({ ok: true, ...result });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Signaling failed' });
  }
});

app.get('/api/choy/state', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    touchUserPresence(user.name);
    const isAdmin = user.role === 'admin';
    const [posts, allMessages, allUsers, knowledge, leaderboard, emojiLinks, newsfeedConfig, allAnnouncements, rawChatGroups, userDashboard, userDashboardMeta, choyProgramsConfig, musicTracks, longVideos] = await Promise.all([
      store.listPosts(),
      store.listMessages(),
      store.listUsers(isAdmin),
      store.listKnowledge(),
      store.getPublicLeaderboard(),
      store.listEmojiLinks(),
      store.getNewsfeedConfig(),
      store.listAnnouncements(),
      store.listChatGroupsForUser(user.id, isAdmin),
      processDueTrialAutoDeduct(user.id),
      store.listUserDashboardMeta(),
      store.getChoyProgramsConfig(),
      store.listMusicTracks(),
      store.listLongVideos(),
    ]);
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;

    const visibleUsers = isAdmin
      ? allUsers
      : allUsers.filter((candidate) => canViewerSeeUser(user, candidate));
    const visibleUserIds = new Set(visibleUsers.map((u) => u.id));
    const visibleUserNamesLower = new Set(visibleUsers.map((u) => u.name.trim().toLowerCase()));
    const allUsersById = new Map(allUsers.map((u) => [u.id, u]));

    const chatGroups = rawChatGroups.map((g) => ({
      ...g,
      members: g.memberIds
        .map((id) => allUsersById.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar })),
    }));
    const memberGroupIdSet = new Set(chatGroups.map((g) => g.id));

    const myNameLower = user.name.trim().toLowerCase();
    const messages = isAdmin
      ? allMessages
      : allMessages.filter((m) => {
          if (memberGroupIdSet.has(m.roomId)) {
            return true;
          }
          const roomLower = m.roomId.trim().toLowerCase();
          const senderLower = m.senderName.trim().toLowerCase();
          const isSenderVisible =
            m.senderId === 'system' ||
            m.senderId === user.id ||
            visibleUserIds.has(m.senderId) ||
            visibleUserNamesLower.has(senderLower);
          if (roomLower === 'vip group') {
            return isSenderVisible;
          }
          if (m.senderId === user.id || senderLower === myNameLower) {
            return roomLower === 'choy admin' || visibleUserNamesLower.has(roomLower);
          }
          if (roomLower === myNameLower) {
            return isSenderVisible;
          }
          return false;
        });

    const filteredPosts = isAdmin
      ? posts
      : posts.filter((p) => canViewerSeePost(user, p));

    const visibleAnnouncements = isAdmin
      ? allAnnouncements
      : allAnnouncements.filter((a) => canViewerSeeAnnouncement(user, a));

    const activeGroupCalls = getActiveGroupCallsSnapshot().filter(
      (c) => isAdmin || c.roomId.toLowerCase() === 'vip group' || memberGroupIdSet.has(c.roomId)
    );

    let ledger = undefined;
    let settings = undefined;
    if (isAdmin) {
      [ledger, settings] = await Promise.all([store.listLedger(), store.getSettings()]);
    }

    return res.json({
      storageMode: store.storageMode,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        blockedUsers: user.blockedUsers,
        avatar: user.avatar,
        newsfeed: normalizeUserNewsfeed(user.newsfeed),
      },
      posts: filteredPosts.map((p) =>
        p.mediaUrl ? { ...p, mediaUrl: rewriteBrokenR2MediaUrl(p.mediaUrl) } : p
      ),
      messages: messages.map((m) =>
        m.mediaUrl ? { ...m, mediaUrl: rewriteBrokenR2MediaUrl(m.mediaUrl) } : m
      ),
      chatGroups,
      activeGroupCalls,
      users: visibleUsers,
      knowledge,
      leaderboard,
      emojiLinks,
      activeEmojiLink,
      newsfeedConfig,
      choyProgramsConfig,
      announcements: visibleAnnouncements,
      onlineUsers: getOnlineUserNames(),
      userDashboard: (() => {
        const { withdrawalPinHash: _hidden, ...safeDash } = userDashboard;
        return safeDash;
      })(),
      userDashboardMeta,
      musicTracks,
      longVideos,
      ...(isAdmin ? { ledger, settings } : {}),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load synced state' });
  }
});

app.post('/api/choy/posts', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const safeUrl = sanitizeMediaUrl(req.body?.mediaUrl);
    if ((!content && !safeUrl) || content.length > 2000) {
      return res.status(400).json({ error: 'Post text or an image/video is required (max 2000 chars)' });
    }
    const rawType = req.body?.mediaType;
    const mediaType: 'text' | 'image' | 'video' =
      rawType === 'image' || rawType === 'video' ? rawType : 'text';
    const rawCat = req.body?.category;
    const category: 'feed' | 'myday' | 'video' =
      rawCat === 'myday' || rawCat === 'video' ? rawCat : 'feed';
    const userNf = normalizeUserNewsfeed(user.newsfeed);
    let postNewsfeed: NewsfeedChannel = userNf;
    if (user.role === 'admin') {
      const rawNf = typeof req.body?.newsfeed === 'string' ? req.body.newsfeed.trim().toLowerCase() : '';
      if (rawNf === 'feed_a' || rawNf === 'feed_b' || rawNf === 'feed_c' || rawNf === 'feed_bc' || rawNf === 'both') {
        postNewsfeed = rawNf;
      }
    } else {
      postNewsfeed = userNf;
    }

    const safeHandle = user.name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'member';
    const post = await store.createPost({
      authorId: user.id,
      authorName: user.name,
      authorHandle: `@${safeHandle}`,
      authorAvatar: user.avatar || DEFAULT_PROFILE_ICON,
      content,
      mediaUrl: safeUrl,
      mediaType: safeUrl ? mediaType : 'text',
      category,
      newsfeed: postNewsfeed,
    });
    broadcastSync('posts');
    return res.status(201).json(post);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create post' });
  }
});

app.delete('/api/choy/posts/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const ok = await store.deletePost(req.params.id, user.id, user.role === 'admin');
    if (!ok) return res.status(404).json({ error: 'Post not found or not authorized' });
    broadcastSync('posts');
    return res.json({ deleted: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete post' });
  }
});

app.post('/api/choy/posts/views', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const postIds = Array.isArray(req.body?.postIds) ? req.body.postIds.map(String) : [];
    if (postIds.length === 0) {
      return res.json({ recorded: 0 });
    }
    const recorded = await store.recordPostViews(postIds, user.id);
    if (recorded > 0) {
      broadcastSync('posts');
    }
    return res.json({ recorded });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to record post views' });
  }
});

app.post('/api/choy/posts/:id/like', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const updated = await store.togglePostLike(req.params.id, user.id);
    if (!updated) return res.status(404).json({ error: 'Post not found' });
    broadcastSync('posts');
    return res.json(updated);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to toggle like' });
  }
});

app.post('/api/choy/posts/:id/comments', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 500) {
      return res.status(400).json({ error: 'Comment text is required (max 500 characters)' });
    }
    const updated = await store.addPostComment(
      req.params.id,
      { id: user.id, name: user.name, avatar: user.avatar || DEFAULT_PROFILE_ICON },
      text
    );
    if (!updated) return res.status(404).json({ error: 'Post not found' });
    broadcastSync('posts');
    return res.status(201).json(updated);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add comment' });
  }
});

app.delete('/api/choy/posts/:id/comments/:commentId', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const updated = await store.deletePostComment(
      req.params.id,
      req.params.commentId,
      user.id,
      user.role === 'admin'
    );
    if (!updated) return res.status(404).json({ error: 'Comment not found or not authorized' });
    broadcastSync('posts');
    return res.json(updated);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete comment' });
  }
});

app.post('/api/choy/posts/:id/share', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const updated = await store.incrementPostShare(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Post not found' });
    broadcastSync('posts');
    return res.json(updated);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to record share' });
  }
});

app.post('/api/choy/groups', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const rawName = typeof req.body?.name === 'string' ? req.body.name.replace(/[\x00-\x1f\x7f]/g, '').trim() : '';
    if (rawName.length < 2 || rawName.length > 60) {
      return res.status(400).json({ error: 'Group name must be between 2 and 60 characters.' });
    }
    const rawMemberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : [];
    const allUsers = await store.listUsers(true);
    const allUsersById = new Map(allUsers.map((u) => [u.id, u]));

    const validMemberIds = new Set<string>([user.id]);
    for (const id of rawMemberIds) {
      const candidate = allUsersById.get(id.trim());
      if (!candidate) continue;
      if (user.role !== 'admin' && !canViewerSeeUser(user, candidate)) continue;
      validMemberIds.add(candidate.id);
    }

    if (validMemberIds.size < 2) {
      return res.status(400).json({ error: 'Please select at least 1 other member for the group chat.' });
    }

    const group = await store.createChatGroup({
      name: rawName,
      memberIds: Array.from(validMemberIds),
      createdById: user.id,
      createdByName: user.name,
    });

    await store.createMessage({
      senderId: 'system',
      senderName: 'Choy System',
      roomId: group.id,
      text: `${user.name} created group "${group.name}" with ${group.memberIds.length} members.`,
      mediaType: 'text',
    });

    broadcastSync('groups');
    broadcastSync('messages');

    const members = group.memberIds
      .map((id) => allUsersById.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));

    return res.status(201).json({ group: { ...group, members } });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create group chat' });
  }
});

app.patch('/api/choy/groups/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const groupId = String(req.params.id || '').trim();
    const existing = await store.getChatGroupById(groupId);
    if (!existing) {
      return res.status(404).json({ error: 'Group chat not found' });
    }
    const currentAdminId = existing.adminId || existing.createdById;
    const canManage = user.role === 'admin' || currentAdminId === user.id;
    if (!canManage) {
      return res.status(403).json({ error: 'Only the group admin can update group settings.' });
    }

    const hasNameUpdate = req.body?.name !== undefined;
    const hasAdminUpdate = req.body?.adminId !== undefined;
    if (!hasNameUpdate && !hasAdminUpdate) {
      return res.status(400).json({ error: 'No group changes were provided.' });
    }

    const patch: { name?: string; adminId?: string; adminName?: string } = {};
    if (hasNameUpdate) {
      const rawName = typeof req.body.name === 'string' ? req.body.name.replace(/[\x00-\x1f\x7f]/g, '').trim() : '';
      if (rawName.length < 2 || rawName.length > 60) {
        return res.status(400).json({ error: 'Group name must be between 2 and 60 characters.' });
      }
      patch.name = rawName;
    }

    const allUsers = await store.listUsers(true);
    const allUsersById = new Map(allUsers.map((u) => [u.id, u]));

    if (hasAdminUpdate) {
      const nextAdminId = typeof req.body.adminId === 'string' ? req.body.adminId.trim() : '';
      if (!nextAdminId || !existing.memberIds.includes(nextAdminId)) {
        return res.status(400).json({ error: 'Selected admin must be a current member of this group.' });
      }
      const targetAdmin = allUsersById.get(nextAdminId);
      if (!targetAdmin || (user.role !== 'admin' && !canViewerSeeUser(user, targetAdmin))) {
        return res.status(404).json({ error: 'Selected member account was not found.' });
      }
      patch.adminId = targetAdmin.id;
      patch.adminName = targetAdmin.name;
    }

    const updated = await store.updateChatGroupDetails(groupId, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Group chat not found' });
    }

    const notices: string[] = [];
    if (patch.name && updated.name !== existing.name) {
      notices.push(`${user.name} renamed the group to "${updated.name}".`);
      const activeCall = activeGroupCallsMap.get(groupId);
      if (activeCall) {
        activeCall.groupName = updated.name;
        broadcastSync('calls');
      }
    }
    if (patch.adminId && updated.adminId !== currentAdminId) {
      notices.push(`${user.name} transferred group admin to ${updated.adminName || 'a member'}.`);
    }

    for (const notice of notices) {
      await store.createMessage({
        senderId: 'system',
        senderName: 'Choy System',
        roomId: updated.id,
        text: notice,
        mediaType: 'text',
      });
    }

    broadcastSync('groups');
    if (notices.length > 0) {
      broadcastSync('messages');
    }

    const members = updated.memberIds
      .map((id) => allUsersById.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));

    return res.json({ group: { ...updated, members } });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update group' });
  }
});

app.patch('/api/choy/groups/:id/members', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const groupId = String(req.params.id || '').trim();
    const existing = await store.getChatGroupById(groupId);
    if (!existing) {
      return res.status(404).json({ error: 'Group chat not found' });
    }
    const groupAdminId = existing.adminId || existing.createdById;
    const isCreatorOrAdmin = user.role === 'admin' || groupAdminId === user.id;
    const isCurrentMember = existing.memberIds.includes(user.id);
    if (!isCreatorOrAdmin && !isCurrentMember) {
      return res.status(403).json({ error: 'Not authorized to update this group.' });
    }

    const addMemberIds = Array.isArray(req.body?.addMemberIds) ? req.body.addMemberIds.map(String) : [];
    const removeMemberId = typeof req.body?.removeMemberId === 'string' ? req.body.removeMemberId.trim() : '';

    const allUsers = await store.listUsers(true);
    const allUsersById = new Map(allUsers.map((u) => [u.id, u]));

    const nextSet = new Set(existing.memberIds);
    if (addMemberIds.length > 0) {
      for (const id of addMemberIds) {
        const candidate = allUsersById.get(id.trim());
        if (!candidate) continue;
        if (user.role !== 'admin' && !canViewerSeeUser(user, candidate)) continue;
        nextSet.add(candidate.id);
      }
    }
    if (removeMemberId) {
      if (removeMemberId !== user.id && !isCreatorOrAdmin) {
        return res.status(403).json({ error: 'Only the group admin can remove other members.' });
      }
      if (removeMemberId === groupAdminId && existing.memberIds.length > 1) {
        return res.status(400).json({ error: 'Transfer group admin to another member before removing or leaving.' });
      }
      nextSet.delete(removeMemberId);
    }

    const updated = await store.updateChatGroupMembers(groupId, Array.from(nextSet));
    if (!updated) {
      return res.status(404).json({ error: 'Group chat not found' });
    }
    broadcastSync('groups');
    const members = updated.memberIds
      .map((id) => allUsersById.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
    return res.json({ group: { ...updated, members } });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update group members' });
  }
});

app.delete('/api/choy/groups/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const groupId = String(req.params.id || '').trim();
    const existing = await store.getChatGroupById(groupId);
    if (!existing) {
      return res.status(404).json({ error: 'Group chat not found' });
    }
    const groupAdminId = existing.adminId || existing.createdById;
    if (user.role !== 'admin' && groupAdminId !== user.id) {
      return res.status(403).json({ error: 'Only the group admin can delete this group.' });
    }
    const deleted = await store.deleteChatGroup(groupId);
    if (!deleted) {
      return res.status(404).json({ error: 'Group chat not found' });
    }
    activeGroupCallsMap.delete(groupId);
    broadcastSync('groups');
    broadcastSync('messages');
    return res.json({ ok: true, deletedId: groupId });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete group chat' });
  }
});

app.post('/api/choy/messages', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const rawRoomId = typeof req.body?.roomId === 'string' ? req.body.roomId.trim() : '';
    if (!rawRoomId || rawRoomId.length > 80 || /[\x00-\x1f\x7f]/.test(rawRoomId)) {
      return res.status(400).json({ error: 'Invalid chat room' });
    }

    let resolvedGroup: StoredChatGroup | null = null;
    let resolvedRoomId = (ALLOWED_CHAT_ROOMS as readonly string[]).find(
      (r) => r.toLowerCase() === rawRoomId.toLowerCase()
    );
    if (!resolvedRoomId && rawRoomId.startsWith('grp_')) {
      const group = await store.getChatGroupById(rawRoomId);
      if (group) {
        const isMember =
          user.role === 'admin' ||
          group.createdById === user.id ||
          (group.adminId || group.createdById) === user.id ||
          group.memberIds.includes(user.id);
        if (!isMember) {
          return res.status(403).json({ error: 'You are not a member of this group chat.' });
        }
        resolvedGroup = group;
        resolvedRoomId = group.id;
      }
    }
    if (!resolvedRoomId) {
      const allUsers = await store.listUsers(true);
      const matchedUser = allUsers.find((u) => u.name.trim().toLowerCase() === rawRoomId.toLowerCase());
      if (matchedUser) {
        if (!canViewerSeeUser(user, matchedUser)) {
          return res.status(403).json({ error: 'You can only message users in your assigned newsfeed channel.' });
        }
        resolvedRoomId = matchedUser.name.trim();
      }
    }
    if (!resolvedRoomId) {
      return res.status(400).json({ error: 'Chat recipient not found' });
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 2000) : '';
    const safeUrl = sanitizeMediaUrl(req.body?.mediaUrl);
    if (!text && !safeUrl) {
      return res.status(400).json({ error: 'Message text or valid media is required' });
    }
    const rawType = req.body?.mediaType;
    const mediaType: 'text' | 'image' | 'video' | 'audio' | 'file' =
      rawType === 'image' || rawType === 'video' || rawType === 'audio' || rawType === 'file' ? rawType : 'text';
    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript.trim().slice(0, 2000) : undefined;

    const msg = await store.createMessage({
      senderId: user.id,
      senderName: user.name,
      roomId: resolvedRoomId,
      text,
      mediaUrl: safeUrl,
      mediaType: safeUrl ? mediaType : 'text',
      transcript,
    });
    broadcastSync('messages');

    // Dispatch background Web Push Notification (delivers on home screen even when app is closed)
    const isVipGroupRoom = resolvedRoomId.trim().toLowerCase() === 'vip group';
    const openRoom = resolvedGroup ? resolvedGroup.id : isVipGroupRoom ? 'VIP Group' : user.name;
    const roomTitleLabel = resolvedGroup ? resolvedGroup.name : 'VIP Group';
    const previewBody =
      text ||
      (mediaType === 'image'
        ? 'Sent you a photo'
        : mediaType === 'video'
        ? 'Sent you a video'
        : mediaType === 'audio'
        ? transcript || 'Sent you a voice message'
        : 'Sent you a file');
    void sendWebPushToTarget(
      resolvedRoomId,
      user.id,
      {
        kind: 'message',
        title: resolvedGroup || isVipGroupRoom ? `${user.name} · ${roomTitleLabel}` : user.name,
        body: previewBody.slice(0, 180),
        icon: getSafePushIcon(user.avatar),
        badge: '/pwa-192x192.png',
        tag: `choy-msg-${openRoom.toLowerCase()}`,
        roomId: openRoom,
        url: `/?openChat=${encodeURIComponent(openRoom)}`,
      },
      'normal',
      resolvedGroup ? resolvedGroup.memberIds : undefined
    );

    return res.status(201).json(msg);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send message' });
  }
});

app.delete('/api/choy/messages/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const messageId = String(req.params.id || '').trim();
    if (!messageId) {
      return res.status(400).json({ error: 'Message ID required' });
    }
    const isAdminUser = user.role === 'admin' || user.phone === '09361223978' || user.phone === 'choycounterflow@gmail.com';
    const success = await store.deleteMessage(messageId, user.id, isAdminUser);
    if (!success) {
      return res.status(403).json({ error: 'Message not found or unauthorized to delete' });
    }
    broadcastSync('messages');
    return res.json({ success: true, deletedId: messageId });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete message' });
  }
});

app.put('/api/choy/blocked-users', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const list = Array.isArray(req.body?.blockedUsers) ? req.body.blockedUsers : [];
    const updated = await store.updateBlockedUsers(user.id, list);
    broadcastSync('users');
    return res.json({ blockedUsers: updated });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update blocked users' });
  }
});

app.post('/api/choy/user-dashboard/action', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const action = typeof req.body?.action === 'string' ? req.body.action.trim() : '';
    const dash = await store.getUserDashboard(user.id);
    const now = new Date().toISOString();
    const makeTxId = () => `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const prependTx = (list: WalletTxItem[], item: WalletTxItem): WalletTxItem[] => [item, ...list].slice(0, 60);

    if (action === 'toggle_public_name') {
      dash.publicShowName = Boolean(req.body?.publicShowName);
      const saved = await store.saveUserDashboard(dash);
      broadcastSync('users');
      return res.json({ ok: true, userDashboard: saved });
    }

    if (action === 'wallet_topup') {
      const amount = Math.round(Number(req.body?.amount) * 100) / 100;
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 120) : '';
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
        return res.status(400).json({ error: 'Enter a valid cash-in amount (₱1 – ₱100,000).' });
      }
      dash.walletBalance = Math.round((dash.walletBalance + amount) * 100) / 100;
      dash.transactions = prependTx(dash.transactions, {
        id: makeTxId(),
        walletType: 'wallet',
        kind: 'topup',
        amount,
        note: note || 'Wallet Cash-In Deposit',
        createdAt: now,
      });
      const saved = await store.saveUserDashboard(dash);
      return res.json({ ok: true, userDashboard: saved });
    }

    if (action === 'set_withdrawal_pin') {
      const newPin = String(req.body?.withdrawalPin || '').trim();
      if (!/^\d{4,6}$/.test(newPin)) {
        return res.status(400).json({ error: 'Withdrawal PIN must be 4 to 6 numeric digits.' });
      }
      dash.withdrawalPinHash = hashPin(newPin);
      dash.hasWithdrawalPin = true;
      const saved = await store.saveUserDashboard(dash);
      const { withdrawalPinHash: _hidden, ...safeDash } = saved;
      return res.json({ ok: true, userDashboard: { ...safeDash, hasWithdrawalPin: true } });
    }

    if (action === 'update_cover_photo') {
      const rawCover = typeof req.body?.coverPhotoUrl === 'string' ? req.body.coverPhotoUrl.trim() : '';
      const cleanCover = rawCover ? sanitizeMediaUrl(rawCover) : '';
      dash.coverPhotoUrl = cleanCover || undefined;
      const saved = await store.saveUserDashboard(dash);
      broadcastSync('users');
      const { withdrawalPinHash: _hidden, ...safeDash } = saved;
      return res.json({ ok: true, userDashboard: safeDash });
    }

    if (action === 'save_media_folders') {
      const rawFolders = Array.isArray(req.body?.mediaFolders) ? req.body.mediaFolders : [];
      const sanitizedFolders = rawFolders.slice(0, 50).map((f: Record<string, unknown>, idx: number) => {
        const cat = f?.category === 'video' || f?.category === 'music' ? f.category : 'photo';
        const items = Array.isArray(f?.items)
          ? (f.items as Array<Record<string, unknown>>)
              .slice(0, 60)
              .map((it, iIdx) => ({
                id: String(it?.id || `item_${Date.now()}_${iIdx}`).slice(0, 64),
                title: String(it?.title || 'Untitled File').trim().slice(0, 100),
                url: sanitizeMediaUrl(String(it?.url || '')) || '',
                createdAt: typeof it?.createdAt === 'string' ? it.createdAt : now,
              }))
              .filter((it) => Boolean(it.url))
          : [];
        return {
          id: String(f?.id || `fld_${Date.now()}_${idx}`).slice(0, 64),
          name: String(f?.name || 'My Folder').trim().slice(0, 80),
          category: cat as 'photo' | 'video' | 'music',
          items,
          createdAt: typeof f?.createdAt === 'string' ? f.createdAt : now,
        };
      });
      dash.mediaFolders = sanitizedFolders;
      const saved = await store.saveUserDashboard(dash);
      const { withdrawalPinHash: _hidden, ...safeDash } = saved;
      return res.json({ ok: true, userDashboard: safeDash });
    }

    if (action === 'wallet_withdraw') {
      const amount = Math.round(Number(req.body?.amount) * 100) / 100;
      const receiverName =
        typeof req.body?.receiverName === 'string' && req.body.receiverName.trim()
          ? req.body.receiverName.trim().slice(0, 100)
          : user.name;
      const walletType =
        typeof req.body?.walletType === 'string' && req.body.walletType.trim()
          ? req.body.walletType.trim().slice(0, 50)
          : 'GCash';
      const rawAccountNum =
        typeof req.body?.accountNumber === 'string' && req.body.accountNumber.trim()
          ? req.body.accountNumber
          : typeof req.body?.withdrawalNumber === 'string'
          ? req.body.withdrawalNumber
          : '';
      const accountNumber = rawAccountNum.trim().slice(0, 60);
      const withdrawalPin = String(req.body?.withdrawalPin || '').trim();
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 160) : '';

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Enter a valid cash-out amount.' });
      }
      if (!receiverName || !accountNumber) {
        return res.status(400).json({ error: 'Enter Receiver Name and Withdrawal Number / Account Number.' });
      }
      if (!withdrawalPin) {
        return res.status(400).json({ error: 'Enter your Withdrawal PIN to confirm cash-out.' });
      }
      if (dash.withdrawalPinHash) {
        if (!verifyPin(withdrawalPin, dash.withdrawalPinHash)) {
          return res.status(403).json({ error: 'Incorrect Withdrawal PIN. Please try again.' });
        }
      } else {
        const storedUser = await store.getUserById(user.id);
        if (!storedUser || !verifyPin(withdrawalPin, storedUser.pinHash)) {
          return res.status(403).json({
            error: 'Incorrect PIN. Use your account login PIN or set a custom Withdrawal PIN first.',
          });
        }
      }
      if (dash.walletBalance < amount) {
        return res.status(400).json({ error: 'Insufficient Wallet balance.' });
      }
      const balanceBefore = dash.walletBalance;
      dash.walletBalance = Math.round((dash.walletBalance - amount) * 100) / 100;
      const reqId = `wd_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      dash.withdrawalRequests = [
        {
          id: reqId,
          receiverName,
          walletType,
          accountNumber,
          walletBalanceBefore: balanceBefore,
          amount,
          status: 'pending' as const,
          createdAt: now,
        },
        ...(dash.withdrawalRequests || []),
      ].slice(0, 40);
      dash.transactions = prependTx(dash.transactions, {
        id: makeTxId(),
        walletType: 'wallet',
        kind: 'withdraw',
        amount: -amount,
        note:
          note ||
          `Cash-Out (${walletType} • ${accountNumber} • Receiver: ${receiverName}) — Est. 10 mins to 1 hr`,
        createdAt: now,
      });
      const saved = await store.saveUserDashboard(dash);
      broadcastSync('users');
      const { withdrawalPinHash: _hidden, ...safeDash } = saved;
      return res.json({ ok: true, userDashboard: safeDash, withdrawalId: reqId });
    }

    if (action === 'wallet_transfer') {
      const walletType: 'wallet' | 'choy_wallet' =
        req.body?.walletType === 'choy_wallet' ? 'choy_wallet' : 'wallet';
      const recipientId = typeof req.body?.recipientId === 'string' ? req.body.recipientId.trim() : '';
      const amount = Math.round(Number(req.body?.amount) * 100) / 100;
      const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 120) : '';
      if (!recipientId || recipientId === user.id) {
        return res.status(400).json({ error: 'Select a valid member to transfer to.' });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Enter a valid transfer amount.' });
      }
      const allUsers = await store.listUsers(true);
      const recipient = allUsers.find((u) => u.id === recipientId);
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient user not found.' });
      }
      if (walletType === 'wallet') {
        if (dash.walletBalance < amount) {
          return res.status(400).json({ error: 'Insufficient Wallet balance.' });
        }
        dash.walletBalance = Math.round((dash.walletBalance - amount) * 100) / 100;
      } else {
        const programsCfg = await store.getChoyProgramsConfig();
        if (!programsCfg.choyWallet.allowTransfers && user.role !== 'admin') {
          return res.status(403).json({ error: 'CHOY Coin transfers are currently paused by Admin.' });
        }
        if (dash.choyWalletBalance < amount) {
          return res.status(400).json({ error: 'Insufficient Choy Wallet balance.' });
        }
        dash.choyWalletBalance = Math.round((dash.choyWalletBalance - amount) * 100) / 100;
      }
      dash.transactions = prependTx(dash.transactions, {
        id: makeTxId(),
        walletType,
        kind: 'transfer_out',
        amount: -amount,
        note: note || `Sent to ${recipient.name}`,
        counterparty: recipient.name,
        createdAt: now,
      });
      const saved = await store.saveUserDashboard(dash);

      const recipientDash = await store.getUserDashboard(recipient.id);
      if (walletType === 'wallet') {
        recipientDash.walletBalance = Math.round((recipientDash.walletBalance + amount) * 100) / 100;
      } else {
        recipientDash.choyWalletBalance = Math.round((recipientDash.choyWalletBalance + amount) * 100) / 100;
      }
      recipientDash.transactions = prependTx(recipientDash.transactions, {
        id: makeTxId(),
        walletType,
        kind: 'transfer_in',
        amount,
        note: note || `Received from ${user.name}`,
        counterparty: user.name,
        createdAt: now,
      });
      await store.saveUserDashboard(recipientDash);
      return res.json({ ok: true, userDashboard: saved });
    }

    if (action === 'choy_wallet_convert') {
      const programsCfg = await store.getChoyProgramsConfig();
      if (!programsCfg.choyWallet.allowConvert && user.role !== 'admin') {
        return res.status(403).json({ error: 'Wallet-to-CHOY conversion is currently paused by Admin.' });
      }
      const phpAmount = Math.round(Number(req.body?.amount) * 100) / 100;
      if (!Number.isFinite(phpAmount) || phpAmount <= 0) {
        return res.status(400).json({ error: 'Enter a valid Wallet amount to convert.' });
      }
      if (phpAmount < programsCfg.choyWallet.minConvertPhp) {
        return res.status(400).json({ error: `Minimum conversion amount is ₱${programsCfg.choyWallet.minConvertPhp}.` });
      }
      if (phpAmount > programsCfg.choyWallet.maxConvertPhp) {
        return res.status(400).json({ error: `Maximum conversion amount is ₱${programsCfg.choyWallet.maxConvertPhp}.` });
      }
      if (dash.walletBalance < phpAmount) {
        return res.status(400).json({ error: 'Insufficient Cash Wallet balance.' });
      }
      const rate = programsCfg.choyWallet.conversionRate;
      const choyCoins = Math.round(phpAmount * rate * 100) / 100;
      dash.walletBalance = Math.round((dash.walletBalance - phpAmount) * 100) / 100;
      dash.choyWalletBalance = Math.round((dash.choyWalletBalance + choyCoins) * 100) / 100;
      dash.transactions = [
        {
          id: makeTxId(),
          walletType: 'choy_wallet' as const,
          kind: 'convert' as const,
          amount: choyCoins,
          note: `Converted ₱${phpAmount.toFixed(2)} → +${choyCoins} CHOY (Rate ₱1=${rate})`,
          createdAt: now,
        },
        {
          id: makeTxId(),
          walletType: 'wallet' as const,
          kind: 'convert' as const,
          amount: -phpAmount,
          note: `Converted to ${choyCoins} CHOY`,
          createdAt: now,
        },
        ...dash.transactions,
      ].slice(0, 60);
      const saved = await store.saveUserDashboard(dash);
      return res.json({ ok: true, userDashboard: saved });
    }

    const resolvePromoDiscount = (
      promos: Array<{
        code: string;
        discountType: 'percent' | 'fixed';
        discountValue: number;
        appliesTo: 'all' | 'marketplace' | 'subscription';
        minSpend: number;
        active: boolean;
        expiresAt?: string;
      }>,
      rawCode: unknown,
      scope: 'marketplace' | 'subscription',
      baseAmount: number
    ): { code?: string; discount: number; finalAmount: number; error?: string } => {
      const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
      if (!code) return { discount: 0, finalAmount: baseAmount };
      const promo = promos.find((p) => p.code.toUpperCase() === code && p.active);
      if (!promo) return { discount: 0, finalAmount: baseAmount, error: `Promo code "${code}" is invalid or inactive.` };
      if (promo.appliesTo !== 'all' && promo.appliesTo !== scope) {
        return { discount: 0, finalAmount: baseAmount, error: `Promo code "${code}" does not apply to ${scope}.` };
      }
      if (promo.expiresAt) {
        const expMs = Date.parse(promo.expiresAt);
        if (Number.isFinite(expMs) && expMs < Date.now()) {
          return { discount: 0, finalAmount: baseAmount, error: `Promo code "${code}" has expired.` };
        }
      }
      if (baseAmount < promo.minSpend) {
        return { discount: 0, finalAmount: baseAmount, error: `Promo "${code}" requires minimum spend of ${promo.minSpend}.` };
      }
      const rawDiscount =
        promo.discountType === 'percent'
          ? (baseAmount * promo.discountValue) / 100
          : promo.discountValue;
      const discount = Math.min(baseAmount, Math.max(0, Math.round(rawDiscount * 100) / 100));
      const finalAmount = Math.max(0, Math.round((baseAmount - discount) * 100) / 100);
      return { code: promo.code, discount, finalAmount };
    };

    if (action === 'activate_choy_pro') {
      const programsCfg = await store.getChoyProgramsConfig();
      if (!programsCfg.choyPro.enabled && user.role !== 'admin') {
        return res.status(403).json({ error: 'Choy Pro upgrades are currently paused by Admin.' });
      }
      const paymentMethod: 'wallet' | 'choy_wallet' =
        req.body?.paymentMethod === 'choy_wallet' ? 'choy_wallet' : 'wallet';
      if (dash.choyProActive) {
        return res.json({ ok: true, userDashboard: dash });
      }
      if (paymentMethod === 'wallet') {
        const baseFee = programsCfg.choyPro.monthlyPhp;
        const promoRes = resolvePromoDiscount(programsCfg.promos, req.body?.promoCode, 'subscription', baseFee);
        if (promoRes.error) return res.status(400).json({ error: promoRes.error });
        const fee = promoRes.finalAmount;
        if (dash.walletBalance < fee) {
          return res.status(400).json({ error: `Need ₱${fee.toFixed(2)} in Cash Wallet (or pay with ${programsCfg.choyPro.monthlyChoy} CHOY).` });
        }
        dash.walletBalance = Math.round((dash.walletBalance - fee) * 100) / 100;
        dash.transactions = prependTx(dash.transactions, {
          id: makeTxId(),
          walletType: 'wallet',
          kind: 'choy_pro',
          amount: -fee,
          note: promoRes.code
            ? `Activated Choy Pro Membership (Promo ${promoRes.code}: -₱${promoRes.discount.toFixed(2)})`
            : 'Activated Choy Pro Membership',
          createdAt: now,
        });
      } else {
        const baseFee = programsCfg.choyPro.monthlyChoy;
        const promoRes = resolvePromoDiscount(programsCfg.promos, req.body?.promoCode, 'subscription', baseFee);
        if (promoRes.error) return res.status(400).json({ error: promoRes.error });
        const fee = promoRes.finalAmount;
        if (dash.choyWalletBalance < fee) {
          return res.status(400).json({ error: `Need ${fee} CHOY in Choy Wallet (or pay ₱${programsCfg.choyPro.monthlyPhp} via Wallet).` });
        }
        dash.choyWalletBalance = Math.round((dash.choyWalletBalance - fee) * 100) / 100;
        dash.transactions = prependTx(dash.transactions, {
          id: makeTxId(),
          walletType: 'choy_wallet',
          kind: 'choy_pro',
          amount: -fee,
          note: promoRes.code
            ? `Activated Choy Pro with CHOY Coins (Promo ${promoRes.code}: -${promoRes.discount} CHOY)`
            : 'Activated Choy Pro with CHOY Coins',
          createdAt: now,
        });
      }
      dash.choyProActive = true;
      dash.choyProActivatedAt = now;
      if (dash.subscriptionPlan === 'free') {
        dash.subscriptionPlan = 'choy_pro_monthly';
        dash.subscriptionStatus = 'active';
        dash.subscriptionRenewAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      const saved = await store.saveUserDashboard(dash);
      broadcastSync('users');
      return res.json({ ok: true, userDashboard: saved });
    }

    if (action === 'update_subscription') {
      const subAction = req.body?.subAction;
      if (subAction === 'toggle_renew') {
        dash.subscriptionAutoRenew = !dash.subscriptionAutoRenew;
        const saved = await store.saveUserDashboard(dash);
        return res.json({ ok: true, userDashboard: saved });
      }
      if (subAction === 'cancel') {
        dash.subscriptionStatus = 'cancelled';
        dash.subscriptionAutoRenew = false;
        const saved = await store.saveUserDashboard(dash);
        const { withdrawalPinHash: _hidden, ...safeDash } = saved;
        return res.json({ ok: true, userDashboard: safeDash });
      }
      if (subAction === 'start_trial') {
        const rawTrialPlan = req.body?.plan;
        const trialPlan: 'choy_pro_monthly' | 'choy_pro_annual' | 'vip_supporter' =
          rawTrialPlan === 'choy_pro_annual' || rawTrialPlan === 'vip_supporter'
            ? rawTrialPlan
            : 'choy_pro_monthly';
        const pm: 'stripe_card' | 'gcash' = req.body?.paymentMethod === 'gcash' ? 'gcash' : 'stripe_card';
        const paymentLabel = String(req.body?.paymentLabel || '').trim().slice(0, 80);
        if (!paymentLabel) {
          return res.status(400).json({
            error: 'Please enter your Stripe Card holder/last-4 or GCash number to start your free trial.',
          });
        }
        const trialEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        dash.subscriptionPlan = trialPlan;
        dash.subscriptionStatus = 'trialing';
        dash.subscriptionAutoRenew = true;
        dash.subscriptionPaymentMethod = pm;
        dash.subscriptionPaymentLabel = paymentLabel;
        dash.subscriptionTrialEndsAt = trialEndIso;
        dash.subscriptionRenewAt = trialEndIso;
        dash.choyProActive = true;
        if (!dash.choyProActivatedAt) dash.choyProActivatedAt = now;
        dash.transactions = prependTx(dash.transactions, {
          id: makeTxId(),
          walletType: 'wallet',
          kind: 'subscription',
          amount: 0,
          note: `Started 30-Day Free Trial (${trialPlan}, Due Today ₱0, Auto-Deduct via ${pm === 'gcash' ? 'GCash' : 'Stripe Card'})`,
          createdAt: now,
        });
        const saved = await store.saveUserDashboard(dash);
        broadcastSync('users');
        const { withdrawalPinHash: _hidden, ...safeDash } = saved;
        return res.json({ ok: true, userDashboard: safeDash });
      }
      const programsCfg = await store.getChoyProgramsConfig();
      type SubPlan = 'free' | 'choy_pro_monthly' | 'choy_pro_annual' | 'vip_supporter';
      const rawPlan = req.body?.plan;
      const plan: SubPlan =
        rawPlan === 'choy_pro_monthly' ||
        rawPlan === 'choy_pro_annual' ||
        rawPlan === 'vip_supporter'
          ? rawPlan
          : 'free';
      if (plan !== 'free' && !programsCfg.choyPro.enabled && user.role !== 'admin') {
        return res.status(403).json({ error: 'Paid subscriptions are currently paused by Admin.' });
      }
      const paymentMethod: 'wallet' | 'choy_wallet' =
        req.body?.paymentMethod === 'choy_wallet' ? 'choy_wallet' : 'wallet';
      const planTable: Record<SubPlan, { php: number; choy: number; days: number; label: string }> = {
        free: { php: 0, choy: 0, days: 0, label: 'Free Starter Plan' },
        choy_pro_monthly: { php: programsCfg.choyPro.monthlyPhp, choy: programsCfg.choyPro.monthlyChoy, days: 30, label: 'Choy Pro Monthly' },
        choy_pro_annual: { php: programsCfg.choyPro.annualPhp, choy: programsCfg.choyPro.annualChoy, days: 365, label: 'Choy Pro Annual' },
        vip_supporter: { php: programsCfg.choyPro.vipPhp, choy: programsCfg.choyPro.vipChoy, days: 30, label: 'VIP Supporter Pass' },
      };
      const planMeta = planTable[plan];

      if (plan !== 'free') {
        if (paymentMethod === 'wallet') {
          const promoRes = resolvePromoDiscount(programsCfg.promos, req.body?.promoCode, 'subscription', planMeta.php);
          if (promoRes.error) return res.status(400).json({ error: promoRes.error });
          const chargePhp = promoRes.finalAmount;
          if (dash.walletBalance < chargePhp) {
            return res.status(400).json({ error: `Need ₱${chargePhp.toFixed(2)} in Cash Wallet for ${planMeta.label}.` });
          }
          dash.walletBalance = Math.round((dash.walletBalance - chargePhp) * 100) / 100;
          dash.transactions = prependTx(dash.transactions, {
            id: makeTxId(),
            walletType: 'wallet',
            kind: 'subscription',
            amount: -chargePhp,
            note: promoRes.code
              ? `Subscribed: ${planMeta.label} (Promo ${promoRes.code}: -₱${promoRes.discount.toFixed(2)})`
              : `Subscribed: ${planMeta.label}`,
            createdAt: now,
          });
        } else {
          const promoRes = resolvePromoDiscount(programsCfg.promos, req.body?.promoCode, 'subscription', planMeta.choy);
          if (promoRes.error) return res.status(400).json({ error: promoRes.error });
          const chargeChoy = promoRes.finalAmount;
          if (dash.choyWalletBalance < chargeChoy) {
            return res.status(400).json({ error: `Need ${chargeChoy} CHOY in Choy Wallet for ${planMeta.label}.` });
          }
          dash.choyWalletBalance = Math.round((dash.choyWalletBalance - chargeChoy) * 100) / 100;
          dash.transactions = prependTx(dash.transactions, {
            id: makeTxId(),
            walletType: 'choy_wallet',
            kind: 'subscription',
            amount: -chargeChoy,
            note: promoRes.code
              ? `Subscribed: ${planMeta.label} (Promo ${promoRes.code}: -${promoRes.discount} CHOY)`
              : `Subscribed: ${planMeta.label}`,
            createdAt: now,
          });
        }
        dash.choyProActive = true;
        if (!dash.choyProActivatedAt) dash.choyProActivatedAt = now;
        dash.subscriptionRenewAt = new Date(Date.now() + planMeta.days * 24 * 60 * 60 * 1000).toISOString();
      } else {
        dash.subscriptionRenewAt = undefined;
      }

      dash.subscriptionPlan = plan;
      dash.subscriptionStatus = 'active';
      dash.subscriptionAutoRenew = plan !== 'free';
      const saved = await store.saveUserDashboard(dash);
      broadcastSync('users');
      return res.json({ ok: true, userDashboard: saved });
    }

    if (action === 'accept_rules') {
      dash.rulesAcceptedAt = now;
      const saved = await store.saveUserDashboard(dash);
      return res.json({ ok: true, userDashboard: saved });
    }

    if (action === 'sign_acknowledgment') {
      const signedName =
        typeof req.body?.signedName === 'string' && req.body.signedName.trim()
          ? req.body.signedName.trim().slice(0, 80)
          : user.name;
      dash.acknowledgmentSignedName = signedName;
      dash.acknowledgmentSignedAt = now;
      const saved = await store.saveUserDashboard(dash);
      return res.json({ ok: true, userDashboard: saved });
    }

    return res.status(400).json({ error: 'Unknown dashboard action.' });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update user dashboard' });
  }
});

app.get('/api/choy/programs-config', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const config = await store.getChoyProgramsConfig();
    return res.json({ ok: true, choyProgramsConfig: config });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Choy Programs setup.' });
  }
});

app.put('/api/choy/programs-config', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const saved = await store.saveChoyProgramsConfig(req.body || {});
    broadcastSync('settings');
    return res.json({ ok: true, choyProgramsConfig: saved });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save Choy Programs setup.' });
  }
});

app.post('/api/choy/admin/wallet-topup', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const adminUser = req.choyUser!;
    const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId.trim() : '';
    const walletType: 'wallet' | 'choy_wallet' = req.body?.walletType === 'wallet' ? 'wallet' : 'choy_wallet';
    const mode: 'credit' | 'debit' = req.body?.mode === 'debit' ? 'debit' : 'credit';
    const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 140) : '';

    if (!targetUserId) {
      return res.status(400).json({ error: 'Please select a member.' });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return res.status(400).json({ error: 'Enter a valid amount between 1 and 1,000,000.' });
    }

    const allUsers = await store.listUsers(true);
    const targetUser = allUsers.find((u) => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const targetDash = await store.getUserDashboard(targetUser.id);
    const delta = mode === 'debit' ? -amount : amount;
    if (walletType === 'wallet') {
      if (targetDash.walletBalance + delta < 0) {
        return res.status(400).json({ error: `Cannot debit ₱${amount.toFixed(2)} — member only has ₱${targetDash.walletBalance.toFixed(2)}.` });
      }
      targetDash.walletBalance = Math.round((targetDash.walletBalance + delta) * 100) / 100;
    } else {
      if (targetDash.choyWalletBalance + delta < 0) {
        return res.status(400).json({ error: `Cannot debit ${amount} CHOY — member only has ${targetDash.choyWalletBalance} CHOY.` });
      }
      targetDash.choyWalletBalance = Math.round((targetDash.choyWalletBalance + delta) * 100) / 100;
    }

    const now = new Date().toISOString();
    const tx: WalletTxItem = {
      id: `tx_adm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      walletType,
      kind: mode === 'debit' ? 'withdraw' : 'topup',
      amount: delta,
      note: note || (mode === 'debit' ? `Admin adjustment by ${adminUser.name}` : `Admin verified top-up by ${adminUser.name}`),
      counterparty: adminUser.name,
      createdAt: now,
    };
    targetDash.transactions = [tx, ...targetDash.transactions].slice(0, 60);
    const savedTarget = await store.saveUserDashboard(targetDash);
    broadcastSync('users');

    return res.json({
      ok: true,
      targetUserName: targetUser.name,
      targetDashboard: savedTarget,
      ...(targetUser.id === adminUser.id ? { userDashboard: savedTarget } : {}),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to adjust member wallet.' });
  }
});

app.patch('/api/admin/users/:id/newsfeed', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const rawNf = typeof req.body?.newsfeed === 'string' ? req.body.newsfeed.trim().toLowerCase() : '';
    if (rawNf !== 'feed_a' && rawNf !== 'feed_b' && rawNf !== 'feed_c' && rawNf !== 'feed_bc') {
      return res.status(400).json({ error: 'Newsfeed must be feed_a, feed_b, feed_c, or feed_bc' });
    }
    const updated = await store.updateUserNewsfeed(userId, rawNf);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    broadcastSync('users');
    broadcastSync('posts');
    return res.json({
      ok: true,
      user: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        role: updated.role,
        status: updated.status,
        blockedUsers: updated.blockedUsers,
        avatar: updated.avatar,
        newsfeed: updated.newsfeed,
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update user newsfeed' });
  }
});

app.patch('/api/admin/users/:id/pin', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const userId = String(req.params.id || '').trim();
    const newPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    if (!newPin || newPin.length < 4 || newPin.length > 64) {
      return res.status(400).json({ error: 'PIN must be between 4 and 64 characters' });
    }

    const updated = await store.updateUserPin(userId, newPin);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    broadcastSync('users');
    return res.json({
      ok: true,
      user: {
        id: updated.id,
        name: updated.name,
        role: updated.role,
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update user PIN' });
  }
});

app.put('/api/admin/newsfeed-config', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const feedATitle = typeof req.body?.feedATitle === 'string' ? req.body.feedATitle : '';
    const feedBTitle = typeof req.body?.feedBTitle === 'string' ? req.body.feedBTitle : '';
    const feedCTitle = typeof req.body?.feedCTitle === 'string' ? req.body.feedCTitle : '';
    const saved = await store.saveNewsfeedConfig({ feedATitle, feedBTitle, feedCTitle });
    broadcastSync('settings');
    return res.json({ ok: true, newsfeedConfig: saved });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save newsfeed titles' });
  }
});

app.post('/api/choy/ledger', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) {
      return res.status(400).json({ error: 'Valid ledger row name is required' });
    }
    const row = await store.createLedgerRow(name, {
      fiveH: req.body?.fiveH !== undefined ? clampNum(req.body.fiveH, -1000000, 1000000) : undefined,
      fiveHType: req.body?.fiveHType === 'red' ? 'red' : 'blue',
      bulig: req.body?.bulig !== undefined ? clampNum(req.body.bulig, -1000000, 1000000) : undefined,
      point5: req.body?.point5 !== undefined ? clampNum(req.body.point5, -1000000, 1000000) : undefined,
      halfSack: req.body?.halfSack !== undefined ? clampNum(req.body.halfSack, -1000000, 1000000) : undefined,
      oneSack: req.body?.oneSack !== undefined ? clampNum(req.body.oneSack, -1000000, 1000000) : undefined,
      bal: req.body?.bal !== undefined ? clampNum(req.body.bal, -100000000, 100000000) : undefined,
    });
    broadcastSync('ledger');
    return res.status(201).json(row);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add ledger row' });
  }
});

app.patch('/api/choy/ledger/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const updated = await store.updateLedgerRow(req.params.id, {
      fiveH: req.body?.fiveH !== undefined ? clampNum(req.body.fiveH, -1000000, 1000000) : undefined,
      fiveHType: req.body?.fiveHType === 'red' ? 'red' : req.body?.fiveHType === 'blue' ? 'blue' : undefined,
      bulig: req.body?.bulig !== undefined ? clampNum(req.body.bulig, -1000000, 1000000) : undefined,
      point5: req.body?.point5 !== undefined ? clampNum(req.body.point5, -1000000, 1000000) : undefined,
      halfSack: req.body?.halfSack !== undefined ? clampNum(req.body.halfSack, -1000000, 1000000) : undefined,
      oneSack: req.body?.oneSack !== undefined ? clampNum(req.body.oneSack, -1000000, 1000000) : undefined,
      bal: req.body?.bal !== undefined ? clampNum(req.body.bal, -100000000, 100000000) : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Ledger row not found' });
    broadcastSync('ledger');
    return res.json(updated);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update ledger row' });
  }
});

app.delete('/api/choy/ledger/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await store.deleteLedgerRow(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Ledger row not found' });
    broadcastSync('ledger');
    return res.json({ deleted: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete ledger row' });
  }
});

app.put('/api/choy/settings', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const current = await store.getSettings();
    const saved = await store.saveSettings({
      fiveH: req.body?.fiveH !== undefined ? clampNum(req.body.fiveH, 0, 1000000) : current.fiveH,
      bulig: req.body?.bulig !== undefined ? clampNum(req.body.bulig, 0, 1000000) : current.bulig,
      point5: req.body?.point5 !== undefined ? clampNum(req.body.point5, 0, 1000000) : current.point5,
      halfSack: req.body?.halfSack !== undefined ? clampNum(req.body.halfSack, 0, 1000000) : current.halfSack,
      oneSack: req.body?.oneSack !== undefined ? clampNum(req.body.oneSack, 0, 1000000) : current.oneSack,
      defFiveH: req.body?.defFiveH !== undefined ? clampNum(req.body.defFiveH, 0, 1000000) : current.defFiveH,
      defBulig: req.body?.defBulig !== undefined ? clampNum(req.body.defBulig, 0, 1000000) : current.defBulig,
      defPoint5: req.body?.defPoint5 !== undefined ? clampNum(req.body.defPoint5, 0, 1000000) : current.defPoint5,
      defHalfSack: req.body?.defHalfSack !== undefined ? clampNum(req.body.defHalfSack, 0, 1000000) : current.defHalfSack,
      defOneSack: req.body?.defOneSack !== undefined ? clampNum(req.body.defOneSack, 0, 1000000) : current.defOneSack,
    });
    if (req.body?.applyQuantitiesToAll === true) {
      await store.applyDefaultQuantitiesToAll({
        defFiveH: saved.defFiveH,
        defBulig: saved.defBulig,
        defPoint5: saved.defPoint5,
        defHalfSack: saved.defHalfSack,
        defOneSack: saved.defOneSack,
      });
    }
    broadcastSync('settings');
    return res.json(saved);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save settings' });
  }
});

app.post('/api/choy/knowledge', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }
    const item = await store.createKnowledge(question, answer);
    broadcastSync('knowledge');
    return res.status(201).json(item);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add knowledge' });
  }
});

app.delete('/api/choy/knowledge/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await store.deleteKnowledge(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Knowledge entry not found' });
    broadcastSync('knowledge');
    return res.json({ deleted: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete knowledge' });
  }
});

app.post('/api/choy/users', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const pin =
      typeof req.body?.pin === 'string' && req.body.pin.trim().length >= 4
        ? req.body.pin.trim()
        : crypto.randomBytes(12).toString('hex');
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    const existing = await store.getUserByPhone(phone);
    if (existing) {
      return res.status(409).json({ error: 'Phone number already exists' });
    }
    const user = await store.createUser({
      name,
      phone,
      pin,
      role: 'member',
      status: 'approved',
    });
    broadcastSync('users');
    return res.status(201).json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      loginDate: user.updatedAt.slice(0, 16).replace('T', ' '),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to add user' });
  }
});

const handleUpdateUserStatusRoute = async (req: AuthedRequest, res: Response) => {
  try {
    const rawStatus = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';
    if (rawStatus !== 'approved' && rawStatus !== 'pending') {
      return res.status(400).json({ error: 'Status must be either "approved" or "pending"' });
    }
    const status: 'approved' | 'pending' = rawStatus;
    const ok = await store.updateUserStatus(req.params.id, status);
    if (!ok) {
      return res.status(404).json({ error: 'User not found or admin status cannot be set to pending' });
    }
    broadcastSync('users');
    return res.json({ id: req.params.id, status });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update status' });
  }
};

app.patch('/api/choy/users/:id/status', requireAuth, requireAdmin, handleUpdateUserStatusRoute);
app.post('/api/choy/users/:id/status', requireAuth, requireAdmin, handleUpdateUserStatusRoute);

app.post('/api/choy/users/approve-all', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const approvedCount = await store.approveAllPendingUsers();
    broadcastSync('users');
    return res.json({ approvedCount });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to approve pending users' });
  }
});

app.delete('/api/choy/users/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await store.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: 'User not found or cannot delete admin' });
    broadcastSync('users');
    return res.json({ deleted: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete user' });
  }
});

app.get('/api/admin/cloud-backup', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const snapshot = await store.exportCloudBackup();
    return res.json(snapshot);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export backup' });
  }
});

app.post('/api/admin/cloud-restore', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await store.restoreCloudBackup({
      users: Array.isArray(payload.users) ? payload.users : undefined,
      settings: payload.settings && typeof payload.settings === 'object' ? payload.settings : undefined,
      newsfeedConfig:
        payload.newsfeedConfig && typeof payload.newsfeedConfig === 'object' ? payload.newsfeedConfig : undefined,
      ledger: Array.isArray(payload.ledger) ? payload.ledger : undefined,
      knowledge: Array.isArray(payload.knowledge) ? payload.knowledge : undefined,
      announcements: Array.isArray(payload.announcements) ? payload.announcements : undefined,
    });
    if (
      result.restoredUsersCount > 0 ||
      result.restoredLedgerCount > 0 ||
      result.restoredKnowledgeCount > 0 ||
      result.restoredAnnouncementsCount > 0
    ) {
      broadcastSync('all');
    }
    return res.json(result);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to restore backup' });
  }
});

// ---- ENCRYPTED CLOUDFLARE R2 ACCOUNT VAULT (NO GOOGLE / NO 2FA NEEDED) ----
function isAdminMutationCsrfSafe(req: Request): boolean {
  const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
  if (hasBearer) return true;
  const origin = req.headers.origin;
  const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
  if (hasRequestedWith) return true;
  if (typeof origin === 'string' && expectedHost) {
    try {
      return new URL(origin).host === expectedHost;
    } catch {
      return false;
    }
  }
  return false;
}

app.get('/api/admin/r2-vault/status', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const status = await getR2VaultBackupStatus();
    return res.json({
      ...status,
      lastAutoSavedAt: r2VaultLastAutoSavedAt,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to check R2 Vault status' });
  }
});

app.post('/api/admin/r2-vault/backup', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!isAdminMutationCsrfSafe(req)) {
      return res.status(403).json({ error: 'Cross-origin vault backup blocked' });
    }
    if (!isR2VaultConfigured()) {
      return res.status(400).json({ error: 'Cloudflare R2 is not configured on this server.' });
    }
    const snapshot = await store.exportCloudBackup();
    const saved = await saveEncryptedVaultToR2(snapshot);
    r2VaultLastAutoSavedAt = saved.savedAt;
    return res.json({
      ok: true,
      ...saved,
      accountsSynced: snapshot.users.length,
      announcementsSynced: snapshot.announcements.length,
      ledgerSynced: snapshot.ledger.length,
      knowledgeSynced: snapshot.knowledge.length,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save encrypted R2 Vault backup' });
  }
});

app.post('/api/admin/r2-vault/restore', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!isAdminMutationCsrfSafe(req)) {
      return res.status(403).json({ error: 'Cross-origin vault restore blocked' });
    }
    if (!isR2VaultConfigured()) {
      return res.status(400).json({ error: 'Cloudflare R2 is not configured on this server.' });
    }
    const loaded = await loadEncryptedVaultFromR2<Awaited<ReturnType<typeof store.exportCloudBackup>>>();
    if (!loaded || !loaded.snapshot) {
      return res.status(404).json({ error: 'No encrypted account backup found in Cloudflare R2 yet.' });
    }
    const s = loaded.snapshot;
    const result = await store.restoreCloudBackup({
      users: Array.isArray(s.users) ? s.users : undefined,
      settings: s.settings && typeof s.settings === 'object' ? s.settings : undefined,
      newsfeedConfig: s.newsfeedConfig && typeof s.newsfeedConfig === 'object' ? s.newsfeedConfig : undefined,
      ledger: Array.isArray(s.ledger) ? s.ledger : undefined,
      knowledge: Array.isArray(s.knowledge) ? s.knowledge : undefined,
      announcements: Array.isArray(s.announcements) ? s.announcements : undefined,
    });
    if (
      result.restoredUsersCount > 0 ||
      result.restoredLedgerCount > 0 ||
      result.restoredKnowledgeCount > 0 ||
      result.restoredAnnouncementsCount > 0
    ) {
      broadcastSync('all');
    }
    return res.json({
      ok: true,
      savedAt: loaded.savedAt,
      sizeBytes: loaded.sizeBytes,
      ...result,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to restore from encrypted R2 Vault' });
  }
});

// Initialize GoogleGenAI client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const CHOY_APP_USAGE_GUIDE = `
CHOY CHAT APP FEATURES & HOW TO USE GUIDE:
1. Messages & Chats (Messages tab):
   - Send text messages, photos (tap the Camera/Photo button or attach image), videos, and voice messages in VIP Group or 1-on-1 direct chats with any user.
   - Voice-to-Text Transcription: Record a voice message using the Mic button; spoken words are transcribed automatically below the audio player.
   - Reactions & Forward: Tap emoji reactions (❤️ 👍 🔥 😄) or tap the "Forward" button under any message to open the Forward dialog, search a user or room, and re-send the message content.
   - Photo Editor & Zoom: Tap any sent photo to zoom in/out; draw or crop attached images before sending.
   - Message Notifications & Tune: Incoming messages trigger a popup notification with sender avatar and a notification sound tune.
2. Live Video Calls (Messages tab):
   - Open a chat with a user (or VIP Group) and tap the Video Call button to start a real live WebRTC video call.
   - Controls during a call: Mute/unmute mic, turn camera on/off, flip front/back camera, and Hang Up.
   - Incoming calls ring continuously with an audible ringtone, vibration, and caller profile picture banner until accepted or declined.
3. Home-Screen Push Notifications (Background Alerts):
   - Tap "Enable Alerts" in Messages or inside the 3-dots (⋮) Menu Drawer to allow background push notifications.
   - Once enabled (and installed to Home Screen as a PWA), you receive message popups and incoming video call alerts with caller profile icons even when the app is closed, as long as mobile data/Wi-Fi is on.
4. Profile Picture & Change Name (Account / Profile tab or your own Profile Modal):
   - Open Account (My Account) to tap "Add Profile Pic" / "Change Profile Pic" (or the Camera badge) to upload a photo, or "Reset Photo" to restore the default icon.
   - Tap "Change Name" to update your display name (2–60 characters). Your updated name and photo sync automatically across posts, chats, search, and calls.
5. Newsfeed, Videos & People:
   - Newsfeed tab: Share text, photo, or video posts (Feed, My Day, or Video) and view posts from the community.
   - People tab & top Search bar: Find members, view public profiles, start a message, or Block/Unblock a user.
   - Videos tab: Watch shared chat videos with sound enabled.
6. 3-Dots (⋮) Menu Drawer & Settings:
   - Tap the 3-dots (⋮) button at the top right for Theme (Light / Dark / System), Font Size, Reduce Motion, Push Notification toggle, Account Delete setup, and Logout.
7. Install as App (PWA):
   - Tap the Install App button or browser "Add to Home Screen" for full-screen mobile app experience and reliable background alerts.
`.trim();

app.post('/api/choy/ai/chat', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question || question.length > 1500) {
      return res.status(400).json({ error: 'Please enter a question (max 1500 characters).' });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        error: 'Choy AI requires GEMINI_API_KEY to be configured on the server.',
      });
    }

    const isAdminUser = user.role === 'admin';
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
    const safeHistoryText = rawHistory
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return '';
        const rec = item as { sender?: unknown; text?: unknown };
        const role = rec.sender === 'user' ? 'User' : 'Choy AI';
        const txt = typeof rec.text === 'string' ? rec.text.trim().slice(0, 400) : '';
        return txt ? `${role}: ${txt}` : '';
      })
      .filter(Boolean)
      .join('\n');

    const knowledge = await store.listKnowledge();
    const knowledgeBlock =
      knowledge.length > 0
        ? knowledge
            .slice(0, 40)
            .map((k, idx) => `${idx + 1}. Q: ${k.question}\n   A: ${k.answer}`)
            .join('\n')
        : 'No custom Q&A entries yet.';

    let systemInstruction = '';

    if (isAdminUser) {
      // ADMIN-ONLY SYNCED CONTEXT: Milestone Ledger + All Users' Messages (for moderation/safety checks) + Users + Prices
      const [ledger, settings, allMessages, allUsers] = await Promise.all([
        store.listLedger(),
        store.getSettings(),
        store.listMessages(),
        store.listUsers(false),
      ]);

      const ledgerSummary =
        ledger.length > 0
          ? ledger
              .map((row) => {
                const total =
                  row.fiveH * settings.fiveH +
                  row.bulig * settings.bulig +
                  row.point5 * settings.point5 +
                  row.halfSack * settings.halfSack +
                  row.oneSack * settings.oneSack +
                  row.bal;
                return `- ${row.name}: 5H=${row.fiveH} (${row.fiveHType}), Bulig=${row.bulig}, .5=${row.point5}, 1/2Sack=${row.halfSack}, 1Sack=${row.oneSack}, Bal=₱${row.bal} | Computed Total=₱${total.toLocaleString()} (Updated: ${row.updatedAt.slice(0, 16).replace('T', ' ')})`;
              })
              .join('\n')
          : 'No milestone ledger rows yet.';

      const recentMessages = allMessages
        .slice(-150)
        .map((m) => {
          const ts = m.createdAt.slice(0, 16).replace('T', ' ');
          const mediaTag = m.mediaType !== 'text' ? ` [${m.mediaType.toUpperCase()}]` : '';
          const transcriptTag = m.transcript ? ` (Transcript: "${m.transcript.slice(0, 160)}")` : '';
          const body = m.text ? m.text.slice(0, 260) : '(media only)';
          return `[${ts}] Room="${m.roomId}" | From="${m.senderName}"${mediaTag}: ${body}${transcriptTag}`;
        })
        .join('\n');

      const usersSummary =
        allUsers.length > 0
          ? allUsers
              .map((u) => `- ${u.name} (${u.role}, status: ${u.status}, lastActive: ${u.loginDate})`)
              .join('\n')
          : 'No registered users.';

      systemInstruction = `You are Choy AI (ADMIN MODE) inside the Choy Chat app, speaking to the verified Admin (${user.name}).

LANGUAGE RULE (CRITICAL):
- Detect the user's language (Bisaya/Cebuano, Tagalog/Filipino, English, Hiligaynon, Ilocano, or ANY other language) and ALWAYS reply naturally in that exact same language!

ADMIN CAPABILITIES & LIVE SYNCED DATA:
- You have full Admin-only access to:
  1. App Usage Instructions & Synced AI Brain Q&A.
  2. Live Synced Milestone Ledger & Unit Prices (to calculate totals, balances, Blue/Red 5H, top entries, and answer any Milestone question accurately).
  3. All Users' Messages across VIP Group and Direct Messages ONLY for Admin moderation, safety checks, spotting conflicts/issues ("not going good"), or reviewing specific user messages when Admin asks.
  4. Registered user list (names, roles, last active status).
- Keep answers clear, well-structured, concise, and factual based ONLY on the synced data below (never invent fake messages or ledger numbers).
- When checking messages for things "not going good" (conflicts, rude/harmful language, suspicious behavior, complaints, or urgent issues), clearly list any concerning messages with sender, room, and timestamp, or clearly confirm if everything looks peaceful/normal.

--- UNIT PRICES ---
5H: ₱${settings.fiveH}, Bulig: ₱${settings.bulig}, .5: ₱${settings.point5}, 1/2 Sack: ₱${settings.halfSack}, 1 Sack: ₱${settings.oneSack}

--- SYNCED MILESTONE LEDGER (${ledger.length} rows) ---
${ledgerSummary}

--- REGISTERED USERS (${allUsers.length}) ---
${usersSummary}

--- ALL USERS' RECENT MESSAGES (ADMIN-ONLY MODERATION SYNC, ${Math.min(allMessages.length, 150)} of ${allMessages.length}) ---
${recentMessages || 'No messages yet.'}

--- SYNCED AI BRAIN Q&A ---
${knowledgeBlock}

--- APP USAGE GUIDE ---
${CHOY_APP_USAGE_GUIDE}`;
    } else {
      // REGULAR MEMBER MODE: STRICT PRIVACY — APP INSTRUCTIONS ONLY (ZERO ACCESS TO MESSAGES, USER PROFILES, OR MILESTONE)
      systemInstruction = `You are Choy AI, the friendly App Guide Assistant inside Choy Chat, helping a regular member.

LANGUAGE RULE (CRITICAL):
- Detect the user's language (Bisaya/Cebuano, Tagalog/Filipino, English, Hiligaynon, Ilocano, or ANY other language) and ALWAYS reply naturally in that exact same language!

STRICT ACCESS & PRIVACY RULES (NON-NEGOTIABLE):
1. ALLOWED ONLY:
   - Explaining HOW TO USE the Choy Chat app and what buttons/features to use (messaging, forwarding, voice transcription, video calls, notifications/ringtones, profile picture upload, changing display name, Newsfeed posts, People/blocking, theme/menu settings, PWA install).
   - Answering general public questions from the Synced AI Brain Q&A below.
2. STRICTLY NOT ALLOWED (MUST POLITELY REFUSE IN THE USER'S LANGUAGE):
   - Private Messages / Chats: You do NOT have access to any user's messages or chat history. If asked to read, check, summarize, or search anyone's messages, politely explain that messages are private and only accessible to the Admin.
   - User Profile Information: You do NOT have access to any user's profile information, phone numbers, account list, personal details, or online activity. If asked about any user's profile/info, politely explain that user profile information is restricted and you can only help with how to use the app.
   - Milestone Ledger / Admin Records: You do NOT have access to Milestone ledger records, balances, or Admin-only data. If asked, politely explain that Milestone records are Admin-only.
   - Never guess, fabricate, or pretend to look up private messages, user profiles, or Milestone records.
3. Keep instructions short, clear, friendly, and easy to follow step-by-step.

--- SYNCED AI BRAIN Q&A ---
${knowledgeBlock}

--- APP USAGE GUIDE ---
${CHOY_APP_USAGE_GUIDE}`;
    }

    const promptContents = safeHistoryText
      ? `Recent conversation:\n${safeHistoryText}\n\nLatest question from ${isAdminUser ? 'Admin' : 'Member'}:\n${question}`
      : question;

    let responseText = '';
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: promptContents,
          config: {
            systemInstruction,
          },
        });
        responseText = (response.text || '').trim();
        break;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('400') || msg.includes('403') || msg.includes('404') || msg.includes('429')) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }

    if (!responseText) {
      const errMsg = lastErr instanceof Error ? lastErr.message : 'Choy AI could not generate a response right now.';
      return res.status(502).json({ error: errMsg });
    }

    return res.json({
      answer: responseText,
      scope: isAdminUser ? 'admin_full_sync' : 'member_app_guide',
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Choy AI request failed' });
  }
});

// Helper: Organize & summarise Studio Feature Notes into a clean AI Studio prompt
function buildStructuredFallbackPrompt(
  title: string,
  category: string,
  entries: Array<{ id: string; rawText: string; createdAt: string }>
): string {
  if (entries.length === 0) {
    return `Feature File: ${title} [${category}]\n\n(No notes added yet. Type a feature update below and save to auto-organize.)`;
  }
  const cleanLines = entries
    .map((entry, idx) => {
      const cleaned = entry.rawText
        .replace(/\s+/g, ' ')
        .trim();
      return `${idx + 1}. ${cleaned}`;
    })
    .filter(Boolean);

  return [
    `Feature Update Request: ${title}`,
    `Category: ${category}`,
    ``,
    `Summary:`,
    `Implement and connect the ${entries.length} feature update${entries.length > 1 ? 's' : ''} below cleanly in Choy Chat while maintaining existing design, dark/light mode contrast, and real-time cloud sync.`,
    ``,
    `Organized Requirements:`,
    ...cleanLines,
    ``,
    `Technical & UX Checklist:`,
    `- Integrate smoothly with existing components and database/SSE sync.`,
    `- Ensure responsive layout on both mobile and desktop.`,
    `- Verify TypeScript build and lint checks pass cleanly.`,
  ].join('\n');
}

async function summarizeAndOrganizeStudioNote(
  title: string,
  category: string,
  entries: Array<{ id: string; rawText: string; createdAt: string }>
): Promise<{ organizedPrompt: string; usedAi: boolean }> {
  const fallback = buildStructuredFallbackPrompt(title, category, entries);
  if (!entries.length) {
    return { organizedPrompt: fallback, usedAi: false };
  }
  if (!(process.env.GEMINI_API_KEY || '').trim()) {
    return { organizedPrompt: fallback, usedAi: false };
  }
  try {
    const entriesText = entries
      .map((e, i) => `Note #${i + 1} (${e.createdAt.slice(0, 16).replace('T', ' ')}):\n${e.rawText}`)
      .join('\n\n---\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Feature File Title: ${title}\nCategory: ${category}\n\nAll Connected Notes (chronological order):\n${entriesText}`,
      config: {
        systemInstruction:
          'You are an expert AI Studio prompt organizer. The app owner writes rough feature ideas in English, Bisaya (Cebuano), or Tagalog. Combine and connect ALL chronological notes into ONE clean, polished, ready-to-copy-and-paste specification prompt for Google AI Studio. Preserve every requirement from earlier and new notes, resolve duplicates, organize clearly with: Title, Short Summary, Numbered Feature Requirements, and UI/Sync Notes. Output ONLY the clean formatted prompt in clear English.',
      },
    });
    const text = (response.text || '').trim();
    if (text) {
      return { organizedPrompt: text, usedAi: true };
    }
  } catch (err) {
    console.warn('[Studio Notes Summarize fallback]:', err instanceof Error ? err.message : err);
  }
  return { organizedPrompt: fallback, usedAi: false };
}

// Studio Type Notes Routes (Admin Only, Auto-Synced)
app.get('/api/admin/studio-notes', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const notes = await store.listStudioNotes();
    return res.json({ notes });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load studio notes' });
  }
});

app.post('/api/admin/studio-notes', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 100) : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 50) : 'App Features';
    const initialText = typeof req.body?.initialText === 'string' ? req.body.initialText.trim().slice(0, 6000) : '';
    const autoSummarize = req.body?.autoSummarize !== false;

    if (!title) {
      return res.status(400).json({ error: 'Note file name/title is required' });
    }

    const entries = initialText
      ? [{ id: 'ne_' + crypto.randomUUID().slice(0, 10), rawText: initialText, createdAt: new Date().toISOString() }]
      : [];

    let organizedPrompt = '';
    let usedAi = false;
    if (entries.length > 0 && autoSummarize) {
      const resSum = await summarizeAndOrganizeStudioNote(title, category || 'App Features', entries);
      organizedPrompt = resSum.organizedPrompt;
      usedAi = resSum.usedAi;
    } else if (entries.length > 0) {
      organizedPrompt = buildStructuredFallbackPrompt(title, category || 'App Features', entries);
    }

    const created = await store.createStudioNoteFile({
      title,
      category: category || 'App Features',
      entries,
      organizedPrompt,
    });
    const notes = await store.listStudioNotes();
    broadcastSync('studio-notes');
    return res.status(201).json({ note: created, notes, usedAi });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create note file' });
  }
});

app.post('/api/admin/studio-notes/:id/append', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const existing = await store.getStudioNoteById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Note file not found' });
    }
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText.trim().slice(0, 6000) : '';
    const autoSummarize = req.body?.autoSummarize !== false;

    const nextEntries = rawText
      ? [
          ...existing.entries,
          { id: 'ne_' + crypto.randomUUID().slice(0, 10), rawText, createdAt: new Date().toISOString() },
        ]
      : existing.entries;

    let organizedPrompt = existing.organizedPrompt;
    let usedAi = false;
    if (autoSummarize || !organizedPrompt.trim()) {
      const resSum = await summarizeAndOrganizeStudioNote(existing.title, existing.category, nextEntries);
      organizedPrompt = resSum.organizedPrompt;
      usedAi = resSum.usedAi;
    } else if (rawText) {
      organizedPrompt = `${organizedPrompt.trim()}\n\n${nextEntries.length}. ${rawText}`;
    }

    const updated = await store.updateStudioNoteFile(existing.id, {
      entries: nextEntries,
      organizedPrompt,
    });
    const notes = await store.listStudioNotes();
    broadcastSync('studio-notes');
    return res.json({ note: updated, notes, usedAi });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to connect note entry' });
  }
});

app.patch('/api/admin/studio-notes/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const existing = await store.getStudioNoteById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Note file not found' });
    }
    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim().slice(0, 100) : existing.title;
    const category = typeof req.body?.category === 'string' && req.body.category.trim() ? req.body.category.trim().slice(0, 50) : existing.category;
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : existing.entries;
    let organizedPrompt = typeof req.body?.organizedPrompt === 'string' ? req.body.organizedPrompt : existing.organizedPrompt;
    let usedAi = false;

    if (req.body?.reSummarize === true) {
      const resSum = await summarizeAndOrganizeStudioNote(title, category, entries);
      organizedPrompt = resSum.organizedPrompt;
      usedAi = resSum.usedAi;
    }

    const updated = await store.updateStudioNoteFile(existing.id, {
      title,
      category,
      entries,
      organizedPrompt,
    });
    const notes = await store.listStudioNotes();
    broadcastSync('studio-notes');
    return res.json({ note: updated, notes, usedAi });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save note file' });
  }
});

app.delete('/api/admin/studio-notes/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await store.deleteStudioNoteFile(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Note file not found' });
    const notes = await store.listStudioNotes();
    broadcastSync('studio-notes');
    return res.json({ deleted: true, notes });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete note file' });
  }
});

// Categorized .env & All Code Config Vault Routes (Admin Only, Auto-Synced)
app.get('/api/admin/env-vault', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const entries = await store.listEnvVault();
    return res.json({ entries });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load env vault' });
  }
});

app.post('/api/admin/env-vault', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const category = typeof req.body?.category === 'string' && req.body.category.trim() ? req.body.category.trim().slice(0, 60) : 'Code & Custom';
    const keyName = typeof req.body?.keyName === 'string' ? req.body.keyName.trim().slice(0, 100) : '';
    const value = typeof req.body?.value === 'string' ? req.body.value.slice(0, 12000) : '';
    const secret = Boolean(req.body?.secret);
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 500) : undefined;
    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : undefined;

    if (!keyName) {
      return res.status(400).json({ error: 'Key / Config name is required' });
    }

    const saved = await store.upsertEnvVaultEntry({ id, category, keyName, value, secret, notes });
    const entries = await store.listEnvVault();
    broadcastSync('env-vault');
    return res.status(201).json({ entry: saved, entries });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save env entry' });
  }
});

app.post('/api/admin/env-vault/sync-all', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const rawItems = Array.isArray(req.body?.entries) ? req.body.entries : [];
    for (const item of rawItems.slice(0, 100)) {
      const keyName = typeof item?.keyName === 'string' ? item.keyName.trim().slice(0, 100) : '';
      if (!keyName) continue;
      await store.upsertEnvVaultEntry({
        id: typeof item?.id === 'string' ? item.id : undefined,
        category: typeof item?.category === 'string' && item.category.trim() ? item.category.trim().slice(0, 60) : 'Code & Custom',
        keyName,
        value: typeof item?.value === 'string' ? item.value.slice(0, 12000) : '',
        secret: Boolean(item?.secret),
        notes: typeof item?.notes === 'string' ? item.notes.trim().slice(0, 500) : undefined,
      });
    }
    const entries = await store.listEnvVault();
    broadcastSync('env-vault');
    return res.json({ entries, synced: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to sync env vault' });
  }
});

app.delete('/api/admin/env-vault/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await store.deleteEnvVaultEntry(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Env entry not found' });
    const entries = await store.listEnvVault();
    broadcastSync('env-vault');
    return res.json({ deleted: true, entries });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete env entry' });
  }
});

// Newsfeed Moving Slide Banner Announcements (Admin Setup Routes)
app.get('/api/admin/announcements', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const announcements = await store.listAnnouncements();
    return res.json({ announcements });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load announcements' });
  }
});

app.post('/api/admin/announcements', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!verifyCookieCsrf(req)) {
      return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and announcement message are required' });
    }
    const target = normalizeAnnouncementTarget(req.body?.target);
    const badge = normalizeAnnouncementBadge(req.body?.badge);
    const tone = normalizeAnnouncementTone(req.body?.tone);
    const active = req.body?.active !== false;

    const created = await store.createAnnouncement({
      title,
      message,
      badge,
      tone,
      target,
      active,
      createdBy: req.choyUser?.name || 'Admin',
    });
    const announcements = await store.listAnnouncements();
    broadcastSync('announcements');
    return res.status(201).json({ announcement: created, announcements });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create announcement slide' });
  }
});

app.patch('/api/admin/announcements/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!verifyCookieCsrf(req)) {
      return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'Announcement ID is required' });
    }
    const patch: {
      title?: string;
      message?: string;
      badge?: 'announcement' | 'reminder' | 'urgent';
      tone?: 'emerald' | 'amber' | 'sky' | 'rose';
      target?: 'all' | 'feed_a' | 'feed_b' | 'feed_c' | 'feed_bc';
      active?: boolean;
    } = {};

    if (req.body?.title !== undefined) {
      const t = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
      if (!t) return res.status(400).json({ error: 'Title cannot be empty' });
      patch.title = t;
    }
    if (req.body?.message !== undefined) {
      const m = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
      if (!m) return res.status(400).json({ error: 'Message cannot be empty' });
      patch.message = m;
    }
    if (req.body?.badge !== undefined) {
      patch.badge = normalizeAnnouncementBadge(req.body.badge);
    }
    if (req.body?.tone !== undefined) {
      patch.tone = normalizeAnnouncementTone(req.body.tone);
    }
    if (req.body?.target !== undefined) {
      patch.target = normalizeAnnouncementTarget(req.body.target);
    }
    if (typeof req.body?.active === 'boolean') {
      patch.active = req.body.active;
    }

    const updated = await store.updateAnnouncement(id, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Announcement slide not found' });
    }
    const announcements = await store.listAnnouncements();
    broadcastSync('announcements');
    return res.json({ announcement: updated, announcements });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update announcement slide' });
  }
});

app.delete('/api/admin/announcements/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    if (!verifyCookieCsrf(req)) {
      return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
    const ok = await store.deleteAnnouncement(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Announcement slide not found' });
    }
    const announcements = await store.listAnnouncements();
    broadcastSync('announcements');
    return res.json({ deleted: true, announcements });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete announcement slide' });
  }
});

// Helper for GitHub headers
function getGitHubHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitPulse-AI-App',
  };
}

// 1. Get GitHub OAuth Auth URL
app.get('/api/auth/github/url', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.OAUTH_CLIENT_ID || '';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const redirectUri = `${protocol}://${host}/auth/callback`;

  if (!clientId) {
    return res.status(400).json({ 
      error: 'GitHub Client ID not configured. Please set GITHUB_CLIENT_ID in secrets or use a Personal Access Token.' 
    });
  }

  const scopes = 'repo user read:org';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  
  res.json({ url: authUrl, redirectUri });
});

// 2. OAuth Callback Handler
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || '';

  if (!code) {
    return res.send(`<html><body><h3>Authentication failed: No code provided</h3><script>setTimeout(() => window.close(), 2000);</script></body></html>`);
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error || 'Failed to obtain access token from GitHub');
    }

    const accessToken = tokenData.access_token;

    // Send success message to opener window via postMessage and close popup
    res.send(`
      <html>
        <body style="background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 12px; color: #38bdf8;">Successfully Connected to GitHub!</div>
            <p style="color: #94a3b8;">Closing window and returning to GitPulse AI...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${accessToken}' }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '/?token=${accessToken}';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.send(`<html><body style="background:#0f172a;color:#ef4444;font-family:sans-serif;padding:40px;"><h3>Authentication Error</h3><p>${err.message}</p></body></html>`);
  }
});

// 3. Get GitHub User Profile
app.get('/api/github/user', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated with GitHub' });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: getGitHubHeaders(token),
    });
    if (!userRes.ok) {
      throw new Error(`GitHub API error: ${userRes.statusText}`);
    }
    const userData = await userRes.json();
    res.json(userData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get User Repositories
app.get('/api/github/repos', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
  const search = req.query.search as string;

  try {
    const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: token ? getGitHubHeaders(token) : { 'User-Agent': 'GitPulse-AI' },
    });

    if (!reposRes.ok) {
      const pubRes = await fetch('https://api.github.com/repositories?per_page=50', {
        headers: { 'User-Agent': 'GitPulse-AI' },
      });
      const pubData = await pubRes.json();
      const filtered = search ? pubData.filter((r: any) => r.full_name.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase())) : pubData;
      return res.json(filtered);
    }

    const data = await reposRes.json();
    const repoList = Array.isArray(data) ? data : [];
    if (search) {
      const query = search.toLowerCase();
      const filtered = repoList.filter((r: any) => 
        r.name.toLowerCase().includes(query) || 
        r.full_name.toLowerCase().includes(query) || 
        (r.description && r.description.toLowerCase().includes(query))
      );
      return res.json(filtered);
    }

    res.json(repoList);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get Repo Details, Issues, PRs, Branches
app.get('/api/github/repo/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '') || '';

  try {
    const headers = token ? getGitHubHeaders(token) : { 'User-Agent': 'GitPulse-AI' };

    const [repoRes, issuesRes, prsRes, branchesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=10`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=10`, { headers }),
    ]);

    const repoData = await repoRes.json();
    const issuesData = await issuesRes.ok ? await issuesRes.json() : [];
    const prsData = await prsRes.ok ? await prsRes.json() : [];
    const branchesData = await branchesRes.ok ? await branchesRes.json() : [];

    if (!repoRes.ok) {
      return res.status(repoRes.status).json({ error: repoData.message || 'Failed to fetch repository' });
    }

    res.json({
      repo: repoData,
      issues: issuesData,
      pullRequests: prsData,
      branches: branchesData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5b. GitHub Intelligence — Secure Repo Structure & Latest Commit Activity Proxy
function parseGitHubRepoInput(rawInput: string): { owner: string; repo: string; branchFromUrl?: string } | null {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 300) return null;

  let owner = '';
  let repo = '';
  let branchFromUrl: string | undefined;

  if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(trimmed)) {
    const parts = trimmed.split('/');
    owner = parts[0];
    repo = parts[1].replace(/\.git$/i, '');
  } else {
    let normalized = trimmed;
    if (/^github\.com\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      const host = parsed.hostname.toLowerCase();
      if (host !== 'github.com' && host !== 'www.github.com') return null;
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length < 2) return null;
      owner = segments[0];
      repo = segments[1].replace(/\.git$/i, '');
      if (segments[2] === 'tree' && segments[3]) {
        branchFromUrl = decodeURIComponent(segments.slice(3).join('/'));
      }
    } catch {
      return null;
    }
  }

  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner);
  const validRepo = /^[A-Za-z0-9._-]{1,100}$/.test(repo) && repo !== '.' && repo !== '..';
  if (!validOwner || !validRepo) return null;

  if (branchFromUrl && (!/^[A-Za-z0-9._/-]{1,120}$/.test(branchFromUrl) || branchFromUrl.includes('..'))) {
    branchFromUrl = undefined;
  }

  return { owner, repo, branchFromUrl };
}

function safeGitHubExternalUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && (parsed.hostname === 'github.com' || parsed.hostname === 'avatars.githubusercontent.com')) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

app.post('/api/github/intelligence', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    // CSRF guard when authenticated via session cookie
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const repoUrl = typeof req.body?.repoUrl === 'string' ? req.body.repoUrl : '';
    const userPat = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const requestedBranch = typeof req.body?.branch === 'string' ? req.body.branch.trim() : '';
    const rawCommitLimit = Number(req.body?.commitLimit);
    const commitLimit =
      Number.isInteger(rawCommitLimit) && rawCommitLimit >= 1 && rawCommitLimit <= 50 ? rawCommitLimit : 30;

    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({
        error: 'Please enter a valid GitHub repository URL (for example: https://github.com/owner/repo or owner/repo).',
      });
    }

    if (requestedBranch && (!/^[A-Za-z0-9._/-]{1,120}$/.test(requestedBranch) || requestedBranch.includes('..'))) {
      return res.status(400).json({ error: 'Invalid branch name.' });
    }

    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || '').trim();
    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ChoyChat-GitHub-Intelligence',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (effectiveToken) {
      ghHeaders.Authorization = `Bearer ${effectiveToken}`;
    }

    const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}`;
    const repoRes = await fetch(baseApi, { headers: ghHeaders });
    const repoJson: any = await repoRes.json().catch(() => ({}));

    if (!repoRes.ok) {
      const ghMsg = typeof repoJson?.message === 'string' ? repoJson.message : 'GitHub API error';
      if (repoRes.status === 401) {
        return res.status(401).json({ error: 'GitHub rejected the personal access token. Please verify the token and its scopes.' });
      }
      if (repoRes.status === 404) {
        return res.status(404).json({
          error: 'Repository not found. If it is private, provide a Personal Access Token with repo read access.',
        });
      }
      if (repoRes.status === 403) {
        return res.status(403).json({
          error: ghMsg.toLowerCase().includes('rate limit')
            ? 'GitHub API rate limit reached. Add a Personal Access Token to increase your limit.'
            : `Access denied by GitHub: ${ghMsg}`,
        });
      }
      return res.status(repoRes.status).json({ error: ghMsg });
    }

    const defaultBranch = typeof repoJson.default_branch === 'string' ? repoJson.default_branch : 'main';
    const targetBranch = requestedBranch || parsedRepo.branchFromUrl || defaultBranch;

    const nowUtc = new Date();
    const todayMidnightUtcMs = Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate());
    const current30dStartMs = todayMidnightUtcMs - 29 * 86_400_000;
    const prev30dStartMs = todayMidnightUtcMs - 59 * 86_400_000;
    const prevSinceIso = new Date(prev30dStartMs).toISOString();
    const prevUntilIso = new Date(current30dStartMs - 1).toISOString();

    const commitFetchCount = Math.max(commitLimit, 100);
    const [branchesRes, langsRes, treeRes, commitsRes, commitsPrevRes, readmeRes, repoContributorsRes] = await Promise.all([
      fetch(`${baseApi}/branches?per_page=25`, { headers: ghHeaders }),
      fetch(`${baseApi}/languages`, { headers: ghHeaders }),
      fetch(`${baseApi}/git/trees/${encodeURIComponent(targetBranch)}?recursive=1`, { headers: ghHeaders }),
      fetch(`${baseApi}/commits?sha=${encodeURIComponent(targetBranch)}&per_page=${commitFetchCount}`, { headers: ghHeaders }),
      fetch(
        `${baseApi}/commits?sha=${encodeURIComponent(targetBranch)}&since=${encodeURIComponent(prevSinceIso)}&until=${encodeURIComponent(prevUntilIso)}&per_page=100`,
        { headers: ghHeaders }
      ),
      fetch(`${baseApi}/readme?ref=${encodeURIComponent(targetBranch)}`, { headers: ghHeaders }),
      fetch(`${baseApi}/contributors?per_page=15`, { headers: ghHeaders }),
    ]);

    const branchesRaw: any = branchesRes.ok ? await branchesRes.json().catch(() => []) : [];
    const langsRaw: any = langsRes.ok ? await langsRes.json().catch(() => ({})) : {};
    const treeRaw: any = treeRes.ok ? await treeRes.json().catch(() => ({ tree: [] })) : { tree: [] };
    const commitsRaw: any = commitsRes.ok ? await commitsRes.json().catch(() => []) : [];
    const commitsPrevRaw: any = commitsPrevRes.ok ? await commitsPrevRes.json().catch(() => []) : [];
    const readmeRaw: any = readmeRes.ok ? await readmeRes.json().catch(() => null) : null;
    const repoContributorsRaw: any = repoContributorsRes.ok ? await repoContributorsRes.json().catch(() => []) : [];

    let readme: {
      name: string;
      path: string;
      size: number;
      htmlUrl: string | null;
      content: string;
      truncated: boolean;
    } | null = null;
    if (readmeRaw && typeof readmeRaw.content === 'string') {
      const MAX_README_CHARS = 120_000;
      const decoded =
        readmeRaw.encoding === 'base64'
          ? Buffer.from(readmeRaw.content.replace(/\s+/g, ''), 'base64').toString('utf8')
          : readmeRaw.content;
      const truncated = decoded.length > MAX_README_CHARS;
      readme = {
        name: typeof readmeRaw.name === 'string' && readmeRaw.name ? readmeRaw.name : 'README.md',
        path: typeof readmeRaw.path === 'string' && readmeRaw.path ? readmeRaw.path : 'README.md',
        size: typeof readmeRaw.size === 'number' && readmeRaw.size >= 0 ? readmeRaw.size : Buffer.byteLength(decoded, 'utf8'),
        htmlUrl: safeGitHubExternalUrl(readmeRaw.html_url),
        content: truncated ? decoded.slice(0, MAX_README_CHARS) : decoded,
        truncated,
      };
    }

    const branches: string[] = Array.isArray(branchesRaw)
      ? branchesRaw
          .map((b: any) => (typeof b?.name === 'string' ? b.name : ''))
          .filter(Boolean)
      : [targetBranch];
    if (!branches.includes(targetBranch)) {
      branches.unshift(targetBranch);
    }

    // Language breakdown
    const langEntries =
      langsRaw && typeof langsRaw === 'object'
        ? Object.entries(langsRaw).filter(([, val]) => typeof val === 'number' && val > 0)
        : [];
    const totalLangBytes = langEntries.reduce((sum, [, val]) => sum + Number(val), 0);
    const languages = langEntries
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([name, val]) => ({
        name,
        bytes: Number(val),
        percent: totalLangBytes > 0 ? Number(((Number(val) / totalLangBytes) * 100).toFixed(1)) : 0,
      }));

    // Repository structure summary
    const rawTreeItems: any[] = Array.isArray(treeRaw?.tree) ? treeRaw.tree : [];
    let totalFiles = 0;
    let totalDirectories = 0;
    let totalBytes = 0;
    const folderMap = new Map<string, { fileCount: number; totalBytes: number }>();
    const extMap = new Map<string, { count: number; totalBytes: number }>();
    const keyManifestNames = new Set([
      'package.json',
      'tsconfig.json',
      'dockerfile',
      'render.yaml',
      'docker-compose.yml',
      'docker-compose.yaml',
      'readme.md',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
      'cargo.toml',
      'go.mod',
      'requirements.txt',
      'pyproject.toml',
      'prisma/schema.prisma',
    ]);
    const keyFiles: string[] = [];
    const tree: Array<{ path: string; type: 'blob' | 'tree'; size: number }> = [];

    for (const item of rawTreeItems) {
      const itemPath = typeof item?.path === 'string' ? item.path : '';
      const itemType = item?.type === 'tree' ? 'tree' : item?.type === 'blob' ? 'blob' : null;
      if (!itemPath || !itemType) continue;
      const size = typeof item?.size === 'number' && item.size > 0 ? item.size : 0;

      if (tree.length < 1500) {
        tree.push({ path: itemPath, type: itemType, size });
      }

      if (itemType === 'tree') {
        totalDirectories += 1;
      } else {
        totalFiles += 1;
        totalBytes += size;
        const slashIdx = itemPath.indexOf('/');
        const topFolder = slashIdx === -1 ? '(root)' : itemPath.slice(0, slashIdx);
        const existingFolder = folderMap.get(topFolder) || { fileCount: 0, totalBytes: 0 };
        existingFolder.fileCount += 1;
        existingFolder.totalBytes += size;
        folderMap.set(topFolder, existingFolder);

        const baseName = itemPath.slice(itemPath.lastIndexOf('/') + 1);
        const dotIdx = baseName.lastIndexOf('.');
        const ext = dotIdx > 0 ? baseName.slice(dotIdx).toLowerCase() : '(no ext)';
        const existingExt = extMap.get(ext) || { count: 0, totalBytes: 0 };
        existingExt.count += 1;
        existingExt.totalBytes += size;
        extMap.set(ext, existingExt);

        if (keyManifestNames.has(itemPath.toLowerCase()) || (!itemPath.includes('/') && keyManifestNames.has(baseName.toLowerCase()))) {
          keyFiles.push(itemPath);
        }
      }
    }

    const topLevelFolders = Array.from(folderMap.entries())
      .map(([name, info]) => ({ name, fileCount: info.fileCount, totalBytes: info.totalBytes }))
      .sort((a, b) => b.fileCount - a.fileCount);

    const extensions = Array.from(extMap.entries())
      .map(([ext, info]) => ({ ext, count: info.count, totalBytes: info.totalBytes }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Commits & active contributor summary
    const contributorMap = new Map<
      string,
      { name: string; login: string | null; avatar: string | null; commitCount: number; latestDate: string | null }
    >();

    const commits = (Array.isArray(commitsRaw) ? commitsRaw : []).slice(0, commitLimit).map((c: any) => {
      const fullMessage = typeof c?.commit?.message === 'string' ? c.commit.message : '';
      const [firstLine, ...restLines] = fullMessage.split('\n');
      const authorName =
        (typeof c?.commit?.author?.name === 'string' && c.commit.author.name) ||
        (typeof c?.author?.login === 'string' && c.author.login) ||
        'Unknown Author';
      const authorLogin = typeof c?.author?.login === 'string' ? c.author.login : null;
      const authorAvatar = safeGitHubExternalUrl(c?.author?.avatar_url);
      const date = typeof c?.commit?.author?.date === 'string' ? c.commit.author.date : null;
      const sha = typeof c?.sha === 'string' ? c.sha : '';

      const contribKey = authorLogin || authorName;
      const existingContrib = contributorMap.get(contribKey);
      if (existingContrib) {
        existingContrib.commitCount += 1;
      } else {
        contributorMap.set(contribKey, {
          name: authorName,
          login: authorLogin,
          avatar: authorAvatar,
          commitCount: 1,
          latestDate: date,
        });
      }

      return {
        sha,
        shortSha: sha.slice(0, 7),
        message: fullMessage.trim() || '(no commit message)',
        title: firstLine.trim() || '(no commit message)',
        body: restLines.join('\n').trim(),
        authorName,
        authorLogin,
        authorAvatar,
        date,
        htmlUrl: safeGitHubExternalUrl(c?.html_url),
        verified: Boolean(c?.commit?.verification?.verified),
      };
    });

    const contributors = Array.from(contributorMap.values()).sort((a, b) => b.commitCount - a.commitCount);

    // Group commits chronologically by day for repository commit history charting
    const dailyCommitMap = new Map<string, { date: string; commits: number; authors: Set<string> }>();
    for (const commit of commits) {
      if (!commit.date) continue;
      const parsedDate = new Date(commit.date);
      if (Number.isNaN(parsedDate.getTime())) continue;
      const dayKey = parsedDate.toISOString().slice(0, 10);
      const bucket = dailyCommitMap.get(dayKey) || { date: dayKey, commits: 0, authors: new Set<string>() };
      bucket.commits += 1;
      bucket.authors.add(commit.authorLogin || commit.authorName);
      dailyCommitMap.set(dayKey, bucket);
    }
    const commitHistory = Array.from(dailyCommitMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => {
        const parsed = new Date(`${entry.date}T00:00:00Z`);
        const label = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        return {
          date: entry.date,
          label,
          commits: entry.commits,
          uniqueAuthors: entry.authors.size,
        };
      });

    // Build continuous 30-day daily commit frequency series & compare against previous 30-day window
    const seenShaDates = new Map<string, number>();
    const collectCommitWindow = (list: any[]) => {
      list.forEach((rawCommit, idx) => {
        const rawDate = typeof rawCommit?.commit?.author?.date === 'string' ? rawCommit.commit.author.date : null;
        if (!rawDate) return;
        const ms = Date.parse(rawDate);
        if (Number.isNaN(ms)) return;
        const sha = typeof rawCommit?.sha === 'string' && rawCommit.sha ? rawCommit.sha : `anon_${rawDate}_${idx}`;
        if (!seenShaDates.has(sha)) {
          seenShaDates.set(sha, ms);
        }
      });
    };
    collectCommitWindow(Array.isArray(commitsRaw) ? commitsRaw : []);
    collectCommitWindow(Array.isArray(commitsPrevRaw) ? commitsPrevRaw : []);

    const countsByDay30d = new Map<string, number>();
    let current30dCommits = 0;
    let previous30dCommits = 0;
    for (const ms of seenShaDates.values()) {
      if (ms >= current30dStartMs) {
        current30dCommits += 1;
        const dayKey = new Date(ms).toISOString().slice(0, 10);
        countsByDay30d.set(dayKey, (countsByDay30d.get(dayKey) || 0) + 1);
      } else if (ms >= prev30dStartMs && ms < current30dStartMs) {
        previous30dCommits += 1;
      }
    }

    const commitActivity30d: Array<{ date: string; label: string; commits: number }> = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const dayDate = new Date(todayMidnightUtcMs - offset * 86_400_000);
      const dayKey = dayDate.toISOString().slice(0, 10);
      const label = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      commitActivity30d.push({
        date: dayKey,
        label,
        commits: countsByDay30d.get(dayKey) || 0,
      });
    }

    const deltaCommits = current30dCommits - previous30dCommits;
    const percentChange =
      previous30dCommits > 0
        ? Math.round((deltaCommits / previous30dCommits) * 100)
        : current30dCommits > 0
          ? 100
          : 0;
    const commitTrend30d = {
      currentCommits: current30dCommits,
      previousCommits: previous30dCommits,
      deltaCommits,
      percentChange,
      direction: deltaCommits > 0 ? ('up' as const) : deltaCommits < 0 ? ('down' as const) : ('flat' as const),
    };

    const repoContributors = (Array.isArray(repoContributorsRaw) ? repoContributorsRaw : [])
      .filter((c: any) => c && typeof c?.login === 'string' && typeof c?.contributions === 'number')
      .slice(0, 12)
      .map((c: any) => ({
        login: String(c.login),
        avatar: safeGitHubExternalUrl(c.avatar_url),
        contributions: Number(c.contributions) || 0,
        htmlUrl: safeGitHubExternalUrl(c.html_url),
      }));

    return res.json({
      repo: {
        name: String(repoJson.name || parsedRepo.repo),
        fullName: String(repoJson.full_name || `${parsedRepo.owner}/${parsedRepo.repo}`),
        description: typeof repoJson.description === 'string' ? repoJson.description : '',
        visibility: typeof repoJson.visibility === 'string' ? repoJson.visibility : repoJson.private ? 'private' : 'public',
        isPrivate: Boolean(repoJson.private),
        defaultBranch,
        selectedBranch: targetBranch,
        htmlUrl: safeGitHubExternalUrl(repoJson.html_url) || '',
        stars: Number(repoJson.stargazers_count) || 0,
        forks: Number(repoJson.forks_count) || 0,
        openIssues: Number(repoJson.open_issues_count) || 0,
        watchers: Number(repoJson.subscribers_count ?? repoJson.watchers_count) || 0,
        sizeKb: Number(repoJson.size) || 0,
        license: typeof repoJson?.license?.name === 'string' ? repoJson.license.name : null,
        pushedAt: typeof repoJson.pushed_at === 'string' ? repoJson.pushed_at : null,
        updatedAt: typeof repoJson.updated_at === 'string' ? repoJson.updated_at : null,
        ownerLogin: typeof repoJson?.owner?.login === 'string' ? repoJson.owner.login : parsedRepo.owner,
        ownerAvatar: safeGitHubExternalUrl(repoJson?.owner?.avatar_url),
      },
      branches,
      languages,
      structure: {
        totalFiles,
        totalDirectories,
        totalBytes,
        truncated: Boolean(treeRaw?.truncated),
        topLevelFolders,
        keyFiles,
        extensions,
        tree,
      },
      commits,
      commitHistory,
      commitActivity30d,
      commitTrend30d,
      contributors,
      repoContributors,
      readme,
      authenticatedWithToken: Boolean(effectiveToken),
    });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to inspect GitHub repository',
    });
  }
});

app.post('/api/github/file', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    // CSRF guard when authenticated via session cookie
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const repoUrl = typeof req.body?.repoUrl === 'string' ? req.body.repoUrl : '';
    const userPat = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const requestedBranch = typeof req.body?.branch === 'string' ? req.body.branch.trim() : '';
    const rawFilePath = typeof req.body?.path === 'string' ? req.body.path.trim().replace(/^\/+/, '') : '';

    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL.' });
    }

    if (requestedBranch && (!/^[A-Za-z0-9._/-]{1,120}$/.test(requestedBranch) || requestedBranch.includes('..'))) {
      return res.status(400).json({ error: 'Invalid branch name.' });
    }

    if (
      !rawFilePath ||
      rawFilePath.length > 500 ||
      rawFilePath.includes('\0') ||
      rawFilePath.includes('\\') ||
      rawFilePath.split('/').some((seg: string) => seg === '' || seg === '.' || seg === '..')
    ) {
      return res.status(400).json({ error: 'Invalid repository file path.' });
    }

    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || '').trim();
    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ChoyChat-GitHub-Intelligence',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (effectiveToken) {
      ghHeaders.Authorization = `Bearer ${effectiveToken}`;
    }

    const encodedFilePath = rawFilePath
      .split('/')
      .map((segment: string) => encodeURIComponent(segment))
      .join('/');
    const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}`;
    const queryRef = requestedBranch ? `?ref=${encodeURIComponent(requestedBranch)}` : '';
    const fileRes = await fetch(`${baseApi}/contents/${encodedFilePath}${queryRef}`, { headers: ghHeaders });
    const fileJson: any = await fileRes.json().catch(() => ({}));

    if (!fileRes.ok) {
      const ghMsg = typeof fileJson?.message === 'string' ? fileJson.message : 'GitHub API error';
      if (fileRes.status === 401) {
        return res.status(401).json({ error: 'GitHub rejected the personal access token.' });
      }
      if (fileRes.status === 404) {
        return res.status(404).json({ error: 'File not found on this branch.' });
      }
      if (fileRes.status === 403 && ghMsg.toLowerCase().includes('rate limit')) {
        return res.status(403).json({
          error: 'GitHub API rate limit reached. Add a Personal Access Token to preview more files.',
        });
      }
      return res.status(fileRes.status).json({ error: ghMsg });
    }

    if (Array.isArray(fileJson) || fileJson?.type !== 'file') {
      return res.status(400).json({ error: 'Selected path is not a previewable file.' });
    }

    const fileName = typeof fileJson.name === 'string' ? fileJson.name : rawFilePath.split('/').pop() || rawFilePath;
    const filePath = typeof fileJson.path === 'string' ? fileJson.path : rawFilePath;
    const fileSize = typeof fileJson.size === 'number' && fileJson.size >= 0 ? fileJson.size : 0;
    const htmlUrl = safeGitHubExternalUrl(fileJson.html_url);
    const sha = typeof fileJson.sha === 'string' ? fileJson.sha : '';

    const BINARY_EXTENSIONS = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
      '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
      '.woff', '.woff2', '.ttf', '.otf', '.eot',
      '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg',
      '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.pyc', '.class', '.jar',
    ]);
    const dotIdx = fileName.lastIndexOf('.');
    const ext = dotIdx > 0 ? fileName.slice(dotIdx).toLowerCase() : '';

    if (BINARY_EXTENSIONS.has(ext)) {
      return res.json({
        name: fileName,
        path: filePath,
        size: fileSize,
        sha,
        htmlUrl,
        content: '',
        lineCount: 0,
        truncated: false,
        isBinary: true,
        tooLarge: false,
      });
    }

    const MAX_PREVIEW_BYTES = 512 * 1024;
    if (fileSize > MAX_PREVIEW_BYTES || typeof fileJson.content !== 'string') {
      return res.json({
        name: fileName,
        path: filePath,
        size: fileSize,
        sha,
        htmlUrl,
        content: '',
        lineCount: 0,
        truncated: false,
        isBinary: false,
        tooLarge: true,
      });
    }

    const rawBuffer =
      fileJson.encoding === 'base64'
        ? Buffer.from(fileJson.content.replace(/\s+/g, ''), 'base64')
        : Buffer.from(fileJson.content, 'utf8');

    // Detect binary content via NUL byte check in the first 8KB
    const sampleSlice = rawBuffer.subarray(0, Math.min(rawBuffer.length, 8192));
    if (sampleSlice.includes(0)) {
      return res.json({
        name: fileName,
        path: filePath,
        size: fileSize,
        sha,
        htmlUrl,
        content: '',
        lineCount: 0,
        truncated: false,
        isBinary: true,
        tooLarge: false,
      });
    }

    const MAX_PREVIEW_CHARS = 150_000;
    const decodedText = rawBuffer.toString('utf8');
    const truncated = decodedText.length > MAX_PREVIEW_CHARS;
    const finalContent = truncated ? decodedText.slice(0, MAX_PREVIEW_CHARS) : decodedText;
    const lineCount = finalContent === '' ? 0 : finalContent.split(/\r?\n/).length;

    return res.json({
      name: fileName,
      path: filePath,
      size: fileSize,
      sha,
      htmlUrl,
      content: finalContent,
      lineCount,
      truncated,
      isBinary: false,
      tooLarge: false,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch repository file contents',
    });
  }
});

// 5c. Gemini AI File Performance & Security Review
app.post('/api/github/file-review', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    // CSRF guard when authenticated via session cookie
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!geminiApiKey) {
      return res.status(503).json({
        error: 'Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets to use AI Code Review.',
      });
    }

    const repoUrl = typeof req.body?.repoUrl === 'string' ? req.body.repoUrl : '';
    const userPat = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const requestedBranch = typeof req.body?.branch === 'string' ? req.body.branch.trim() : '';
    const rawFilePath = typeof req.body?.path === 'string' ? req.body.path.trim().replace(/^\/+/, '') : '';
    const reviewType = req.body?.reviewType === 'security' ? 'security' : req.body?.reviewType === 'performance' ? 'performance' : null;
    const providedContent = typeof req.body?.content === 'string' ? req.body.content : null;

    if (!reviewType) {
      return res.status(400).json({ error: 'Review type must be "performance" or "security".' });
    }

    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL.' });
    }

    if (requestedBranch && (!/^[A-Za-z0-9._/-]{1,120}$/.test(requestedBranch) || requestedBranch.includes('..'))) {
      return res.status(400).json({ error: 'Invalid branch name.' });
    }

    if (
      !rawFilePath ||
      rawFilePath.length > 500 ||
      rawFilePath.includes('\0') ||
      rawFilePath.includes('\\') ||
      rawFilePath.split('/').some((seg: string) => seg === '' || seg === '.' || seg === '..')
    ) {
      return res.status(400).json({ error: 'Invalid repository file path.' });
    }

    const fileName = rawFilePath.split('/').pop() || rawFilePath;
    const BINARY_EXTENSIONS = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
      '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
      '.woff', '.woff2', '.ttf', '.otf', '.eot',
      '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg',
      '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.pyc', '.class', '.jar',
    ]);
    const dotIdx = fileName.lastIndexOf('.');
    const ext = dotIdx > 0 ? fileName.slice(dotIdx).toLowerCase() : '';
    if (BINARY_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: 'Binary files cannot be analyzed by AI Code Review.' });
    }

    let sourceCode = '';
    if (providedContent !== null) {
      sourceCode = providedContent;
    } else {
      const effectiveToken = userPat || (process.env.GITHUB_TOKEN || '').trim();
      const ghHeaders: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ChoyChat-GitHub-Intelligence',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (effectiveToken) {
        ghHeaders.Authorization = `Bearer ${effectiveToken}`;
      }

      const encodedFilePath = rawFilePath
        .split('/')
        .map((segment: string) => encodeURIComponent(segment))
        .join('/');
      const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}`;
      const queryRef = requestedBranch ? `?ref=${encodeURIComponent(requestedBranch)}` : '';
      const fileRes = await fetch(`${baseApi}/contents/${encodedFilePath}${queryRef}`, { headers: ghHeaders });
      const fileJson: any = await fileRes.json().catch(() => ({}));

      if (!fileRes.ok) {
        const ghMsg = typeof fileJson?.message === 'string' ? fileJson.message : 'GitHub API error';
        if (fileRes.status === 401) {
          return res.status(401).json({ error: 'GitHub rejected the personal access token.' });
        }
        if (fileRes.status === 404) {
          return res.status(404).json({ error: 'File not found on this branch.' });
        }
        if (fileRes.status === 403 && ghMsg.toLowerCase().includes('rate limit')) {
          return res.status(403).json({
            error: 'GitHub API rate limit reached. Add a Personal Access Token to review files.',
          });
        }
        return res.status(fileRes.status).json({ error: ghMsg });
      }

      if (Array.isArray(fileJson) || fileJson?.type !== 'file') {
        return res.status(400).json({ error: 'Selected path is not a reviewable file.' });
      }
      const fileSize = typeof fileJson.size === 'number' && fileJson.size >= 0 ? fileJson.size : 0;
      if (fileSize > 512 * 1024 || typeof fileJson.content !== 'string') {
        return res.status(400).json({ error: 'File is too large (> 512 KB) for AI Code Review.' });
      }
      const rawBuffer =
        fileJson.encoding === 'base64'
          ? Buffer.from(fileJson.content.replace(/\s+/g, ''), 'base64')
          : Buffer.from(fileJson.content, 'utf8');
      const sampleSlice = rawBuffer.subarray(0, Math.min(rawBuffer.length, 8192));
      if (sampleSlice.includes(0)) {
        return res.status(400).json({ error: 'Binary files cannot be analyzed by AI Code Review.' });
      }
      sourceCode = rawBuffer.toString('utf8');
    }

    if (!sourceCode.trim()) {
      return res.status(400).json({ error: 'The selected file is empty and has no code to review.' });
    }

    const MAX_REVIEW_CHARS = 55_000;
    const codeTruncated = sourceCode.length > MAX_REVIEW_CHARS;
    const codeForModel = codeTruncated ? sourceCode.slice(0, MAX_REVIEW_CHARS) : sourceCode;

    // Add 1-based line numbers so Gemini references accurate line ranges
    const numberedLines = codeForModel
      .split(/\r?\n/)
      .map((line, idx) => `${idx + 1}: ${line}`)
      .join('\n');

    const focusPrompt =
      reviewType === 'security'
        ? 'Focus strictly on APPLICATION SECURITY: injection risks (SQL/NoSQL/command/XSS), authentication/authorization flaws, SSRF, path traversal, hardcoded secrets or credential leaks, unsafe deserialization/HTML rendering, weak cryptography, CSRF, and insecure error handling.'
        : 'Focus strictly on RUNTIME & ARCHITECTURAL PERFORMANCE: algorithmic/Big-O bottlenecks, unnecessary loops or N+1 I/O calls, memory leaks, missing cleanup/memoization, excessive React re-renders, blocking main-thread/event-loop operations, unindexed lookups, and payload/bundle bloat.';

    const systemInstruction = `You are a Principal Software Engineer conducting an accurate, high-signal ${reviewType.toUpperCase()} code review of a single repository file.
${focusPrompt}
Rules:
- Only report real, verifiable issues grounded in the provided numbered source lines. Do not invent non-existent APIs or hallucinate line numbers.
- Cite approximate line numbers (e.g., "Line 42" or "Lines 88-104") when referencing specific code.
- Keep descriptions concise, concrete, and actionable.
- Provide up to 8 prioritized findings ordered from highest severity to lowest. If the file has no significant issues in this category, return an empty findings array and explain why in the summary.`;

    const prompt = `Repository: ${parsedRepo.owner}/${parsedRepo.repo}
Branch: ${requestedBranch || 'default'}
File Path: ${rawFilePath}
Review Focus: ${reviewType.toUpperCase()}
${codeTruncated ? `(Note: File content truncated to first ${MAX_REVIEW_CHARS} characters for analysis.)\n` : ''}
Numbered File Contents:
\`\`\`
${numberedLines}
\`\`\``;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.INTEGER,
              description: 'Overall readiness score from 0 to 100 for the selected review focus.',
            },
            rating: {
              type: Type.STRING,
              description: 'One of: Excellent, Good, Needs Attention, Critical Risk',
            },
            summary: {
              type: Type.STRING,
              description: '2-3 sentence executive summary of findings and overall file quality.',
            },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: {
                    type: Type.STRING,
                    description: 'One of: critical, high, medium, low, info',
                  },
                  title: { type: Type.STRING },
                  lineHint: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                  codeExample: { type: Type.STRING },
                },
                required: ['severity', 'title', 'lineHint', 'impact', 'recommendation'],
              },
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            quickWins: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['score', 'rating', 'summary', 'findings', 'strengths', 'quickWins'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    const scoreNum = Number(parsed?.score);
    const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 75;
    const validRatings = new Set(['Excellent', 'Good', 'Needs Attention', 'Critical Risk']);
    const rating = validRatings.has(parsed?.rating)
      ? parsed.rating
      : score >= 88
      ? 'Excellent'
      : score >= 70
      ? 'Good'
      : score >= 45
      ? 'Needs Attention'
      : 'Critical Risk';
    const validSeverities = new Set(['critical', 'high', 'medium', 'low', 'info']);
    const findings = Array.isArray(parsed?.findings)
      ? parsed.findings.slice(0, 10).map((f: any) => ({
          severity: validSeverities.has(String(f?.severity || '').toLowerCase())
            ? String(f.severity).toLowerCase()
            : 'medium',
          title: String(f?.title || 'Code finding').slice(0, 180),
          lineHint: String(f?.lineHint || 'General').slice(0, 60),
          impact: String(f?.impact || '').slice(0, 600),
          recommendation: String(f?.recommendation || '').slice(0, 800),
          codeExample: typeof f?.codeExample === 'string' && f.codeExample.trim() ? f.codeExample.slice(0, 1200) : undefined,
        }))
      : [];
    const strengths = Array.isArray(parsed?.strengths)
      ? parsed.strengths.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 6)
      : [];
    const quickWins = Array.isArray(parsed?.quickWins)
      ? parsed.quickWins.filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 6)
      : [];

    return res.json({
      reviewType,
      filePath: rawFilePath,
      branch: requestedBranch || 'default',
      repoFullName: `${parsedRepo.owner}/${parsedRepo.repo}`,
      model: 'gemini-4-hydrogen',
      analyzedChars: codeForModel.length,
      truncated: codeTruncated,
      generatedAt: new Date().toISOString(),
      score,
      rating,
      summary: String(parsed?.summary || 'Review completed.').slice(0, 1200),
      findings,
      strengths,
      quickWins,
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : 'Failed to run Gemini code review';
    const lower = rawMsg.toLowerCase();
    if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('api key')) {
      return res.status(403).json({
        error: 'Gemini API authentication failed. Please check GEMINI_API_KEY in Settings > Secrets.',
      });
    }
    if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
      return res.status(429).json({
        error: 'Gemini API quota reached. Please try again shortly or upgrade your API key in Settings > Secrets.',
      });
    }
    return res.status(500).json({ error: rawMsg });
  }
});

// 6. Gemini AI Code Review on PR or Code
app.post('/api/github/ai-review', async (req, res) => {
  const { owner, repo, prNumber, codeSnippet, title } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '') || '';

  try {
    let diffContent = codeSnippet || '';

    // If prNumber is provided, fetch PR diff from GitHub
    if (prNumber && owner && repo) {
      const headers = {
        ...(token ? getGitHubHeaders(token) : { 'User-Agent': 'GitPulse-AI' }),
        'Accept': 'application/vnd.github.v3.diff',
      };
      const diffRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers });
      if (diffRes.ok) {
        diffContent = await diffRes.text();
      }
    }

    const prompt = `You are an expert Principal Software Engineer and Security Auditor performing an AI Code Review for a GitHub ${prNumber ? `Pull Request #${prNumber}` : 'code snippet'}: ${title || ''}

Here is the code diff / content to review:
\`\`\`
${diffContent.slice(0, 15000)}
\`\`\`

Provide a comprehensive, professional code review in JSON format with the following structure:
{
  "summary": "1-2 sentence executive summary of the changes and overall quality.",
  "score": 88, // integer score out of 100
  "strengths": ["strength 1", "strength 2"],
  "issues": [
    {
      "severity": "critical" | "warning" | "suggestion",
      "file": "filename or general",
      "line": "approx line number or range",
      "title": "Short title of issue",
      "description": "Detailed explanation and recommendation.",
      "suggestedFix": "Code snippet or advice for fix"
    }
  ],
  "securityNotes": "Any security vulnerability check summary."
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const resultJson = JSON.parse(response.text || '{}');
    res.json(resultJson);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Gemini AI Repository Chat Assistant
app.post('/api/github/ai-chat', async (req, res) => {
  const { question, repoName, description, language } = req.body;

  try {
    const prompt = `You are GitPulse AI, an expert GitHub repository assistant.
Repository: ${repoName || 'Unknown'}
Description: ${description || 'No description'}
Primary Language: ${language || 'Unknown'}

User Question: ${question}

Provide a clear, concise, and highly accurate technical answer with code examples if helpful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Gemini AI Documentation & Release Notes Generator
app.post('/api/github/generate-docs', async (req, res) => {
  const { repoName, description, type, recentCommits } = req.body; // type: 'readme' | 'changelog'

  try {
    const prompt = type === 'readme' 
      ? `Generate a professional, production-grade GitHub README.md markdown for repository "${repoName}". Description: "${description}". Include badges, installation instructions, quick start, features, and license section.`
      : `Generate professional GitHub release notes / changelog for repository "${repoName}". Recent Context: "${recentCommits || description}". Group into Features, Bug Fixes, and Performance Improvements with clean Markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    res.json({ content: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8b. README AI Setup & Goals Summary Generator
app.post('/api/github/readme-summary', async (req, res) => {
  const { repoFullName, readmeContent } = req.body;
  if (!readmeContent) {
    return res.status(400).json({ error: 'README content is required' });
  }

  try {
    const prompt = `Analyze the following README.md content for GitHub repository "${repoFullName || 'Repository'}". Generate a clear, structured summary covering:
1. Project Goals & Core Purpose
2. Setup & Installation Instructions
3. Quick Start / Usage Guidelines
4. Key Dependencies or Prerequisites

Format using clean Markdown with bullet points.

README Content:
${String(readmeContent).slice(0, 40000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


async function startServer() {
  try {
    await store.ready();
    if (store.storageMode !== 'postgres' && isR2VaultConfigured()) {
      const current = await store.exportCloudBackup();
      if (current.users.length <= 1) {
        const loaded = await loadEncryptedVaultFromR2<Awaited<ReturnType<typeof store.exportCloudBackup>>>();
        if (loaded?.snapshot && Array.isArray(loaded.snapshot.users) && loaded.snapshot.users.length > 0) {
          const restored = await store.restoreCloudBackup({
            users: loaded.snapshot.users,
            settings: loaded.snapshot.settings,
            newsfeedConfig: loaded.snapshot.newsfeedConfig,
            ledger: loaded.snapshot.ledger,
            knowledge: loaded.snapshot.knowledge,
            announcements: loaded.snapshot.announcements,
          });
          console.log(
            `[R2Vault] Auto-restored ${restored.restoredUsersCount} user account(s) from encrypted Cloudflare R2 vault (saved ${loaded.savedAt}).`
          );
        }
      }
    }
  } catch (err: unknown) {
    console.warn('[R2Vault] Startup auto-restore check skipped:', err instanceof Error ? err.message : err);
  }

  const candidateDistPaths = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, 'dist'),
    path.resolve(__dirname, '../dist'),
    path.resolve(__dirname),
  ];
  const distPath = candidateDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || candidateDistPaths[0];
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.setHeader('Cache-Control', 'no-cache');
          } else if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('index.html')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
      plugins: [
        {
          name: 'disable-hmr-websocket-connect',
          transform(code, id) {
            if (id.includes('vite/dist/client/client.mjs')) {
              return code
                .replace(
                  'transport.connect(createHMRHandler(handleMessage));',
                  '/* HMR WebSocket disabled in middleware mode */'
                )
                .replace(
                  'throw new SendBeforeConnectError("send was called before connect");',
                  'return;'
                )
                .replace(
                  'throw new SendBeforeConnectError("invoke was called before connect");',
                  'return;'
                );
            }
          },
        },
      ],
    });

    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT || 3000);
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  // Prevent Cloud Run / reverse-proxy 5s keep-alive race causing ERR_CONNECTION_RESET / Failed to fetch
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

// 5d. Sync all repositories from a GitHub organization or user
app.post('/api/github/org-sync', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const orgInput = typeof req.body?.org === 'string' ? req.body.org.trim() : '';
    const userPat = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    if (!orgInput || orgInput.length > 80 || !/^[a-zA-Z0-9_\-]+$/.test(orgInput)) {
      return res.status(400).json({ error: 'Please provide a valid GitHub organization or username.' });
    }

    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || '').trim();
    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ChoyChat-GitHub-Intelligence',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (effectiveToken) {
      ghHeaders.Authorization = `Bearer ${effectiveToken}`;
    }

    // Try org endpoint first, fallback to user endpoint if 404 or empty
    let reposUrl = `https://api.github.com/orgs/${encodeURIComponent(orgInput)}/repos?per_page=50&sort=updated`;
    let orgRes = await fetch(reposUrl, { headers: ghHeaders });
    
    if (orgRes.status === 404) {
      reposUrl = `https://api.github.com/users/${encodeURIComponent(orgInput)}/repos?per_page=50&sort=updated`;
      orgRes = await fetch(reposUrl, { headers: ghHeaders });
    }

    const orgJson: any = orgRes.ok ? await orgRes.json().catch(() => []) : [];
    if (!orgRes.ok) {
      const ghMsg = typeof orgJson?.message === 'string' ? orgJson.message : 'GitHub API error';
      if (orgRes.status === 401) {
        return res.status(401).json({ error: 'GitHub rejected the personal access token.' });
      }
      if (orgRes.status === 404) {
        return res.status(404).json({ error: `Organization or user "${orgInput}" not found on GitHub.` });
      }
      return res.status(orgRes.status).json({ error: ghMsg });
    }

    if (!Array.isArray(orgJson) || orgJson.length === 0) {
      return res.json({ org: orgInput, repositories: [] });
    }

    const repositories = orgJson.map((r: any) => ({
      name: String(r?.name || ''),
      fullName: String(r?.full_name || ''),
      description: typeof r?.description === 'string' ? r?.description : '',
      visibility: typeof r?.visibility === 'string' ? r?.visibility : r?.private ? 'private' : 'public',
      isPrivate: Boolean(r?.private),
      defaultBranch: typeof r?.default_branch === 'string' ? r?.default_branch : 'main',
      htmlUrl: r?.html_url || '',
      stars: Number(r?.stargazers_count) || 0,
      forks: Number(r?.forks_count) || 0,
      openIssues: Number(r?.open_issues_count) || 0,
      sizeKb: Number(r?.size) || 0,
      language: typeof r?.language === 'string' ? r?.language : null,
      updatedAt: typeof r?.updated_at === 'string' ? r?.updated_at : null,
    }));

    return res.json({
      org: orgInput,
      count: repositories.length,
      repositories,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to sync GitHub organization repositories',
    });
  }
});
// 5e. Export AI Code Review summary as a GitHub Issue
app.post('/api/github/export-issue', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
      const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
      let originMatches = false;
      if (typeof origin === 'string' && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: 'Cross-origin request blocked' });
      }
    }

    const repoUrl = typeof req.body?.repoUrl === 'string' ? req.body.repoUrl : '';
    const userPat = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const issueTitle = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : 'Choy Chat Security Audit';
    const issueBody = typeof req.body?.body === 'string' ? req.body.body : '';

    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL.' });
    }

    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || '').trim();
    if (!effectiveToken) {
      return res.status(401).json({
        error: 'A GitHub Personal Access Token with repo (issues) write access is required to export issues.',
      });
    }

    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${effectiveToken}`,
      'User-Agent': 'ChoyChat-GitHub-Intelligence',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}/issues`;
    const issueRes = await fetch(baseApi, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ['security', 'ai-review', 'choy-chat'],
      }),
    });

    const issueJson: any = await issueRes.json().catch(() => ({}));
    if (!issueRes.ok) {
      const ghMsg = typeof issueJson?.message === 'string' ? issueJson.message : 'GitHub API error';
      if (issueRes.status === 401 || issueRes.status === 403) {
        return res.status(403).json({
          error: 'GitHub denied issue creation. Ensure your Personal Access Token has "repo" (Full control of private repositories) or "public_repo" scope.',
        });
      }
      return res.status(issueRes.status).json({ error: ghMsg });
    }

    return res.json({
      success: true,
      issueUrl: safeGitHubExternalUrl(issueJson?.html_url) || `https://github.com/${parsedRepo.owner}/${parsedRepo.repo}/issues`,
      issueNumber: Number(issueJson?.number) || 0,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to export issue to GitHub',
    });
  }
});

// Marketplace Endpoints (Food, Groceries, Medicines, Appliances)
app.get('/api/marketplace/items', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const items = await store.listMarketplaceItems();
    return res.json({ ok: true, items });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load marketplace items' });
  }
});

function calcMarketplaceDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 2) return 25;
  if (distanceKm <= 5) return 40;
  if (distanceKm <= 8) return 65;
  return 90;
}

app.get('/api/marketplace/orders', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const orders = await store.listMarketplaceOrders();
    const user = req.choyUser!;
    const filtered = user.role === 'admin' ? orders : orders.filter((o) => o.userId === user.id);
    return res.json({ ok: true, orders: filtered });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load orders' });
  }
});

app.post('/api/marketplace/orders/status', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update order status.' });
    }
    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
    const allowedStatuses = ['pending', 'preparing', 'out_for_delivery', 'completed', 'cancelled'] as const;
    if (!orderId || !allowedStatuses.includes(nextStatus as (typeof allowedStatuses)[number])) {
      return res.status(400).json({ error: 'Invalid order ID or status.' });
    }
    const orders = await store.listMarketplaceOrders();
    const existing = orders.find((o) => o.id === orderId);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const updatedOrders = await store.saveMarketplaceOrder({
      ...existing,
      status: nextStatus as (typeof allowedStatuses)[number],
    });
    broadcastSync('marketplace');
    return res.json({ ok: true, orders: updatedOrders });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update order status' });
  }
});

app.post('/api/marketplace/checkout', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const now = new Date().toISOString();
    const dash = await store.getUserDashboard(user.id);
    if (user.role !== 'admin' && dash.kycStatus !== 'approved') {
      return res.status(403).json({
        error:
          dash.kycStatus === 'pending'
            ? 'Your Profile Verification is still pending Admin approval. You can place orders once Admin approves it.'
            : 'Please complete your Profile Verification (Complete Name, Address, Age, Sex & 1 Valid ID) in the Profile tab and wait for Admin approval before placing orders.',
      });
    }
    const paymentMethod = req.body?.paymentMethod === 'choy_wallet' ? 'choy_wallet' : 'wallet';
    const cartItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Shopping cart is empty.' });
    }

    const customerName = typeof req.body?.customerName === 'string' ? req.body.customerName.trim().slice(0, 100) : '';
    const customerPhone = typeof req.body?.customerPhone === 'string' ? req.body.customerPhone.trim().slice(0, 40) : '';
    const deliveryAddress = typeof req.body?.deliveryAddress === 'string' ? req.body.deliveryAddress.trim().slice(0, 250) : '';
    const deliveryNotes = typeof req.body?.deliveryNotes === 'string' ? req.body.deliveryNotes.trim().slice(0, 300) : '';

    if (!customerName || !customerPhone || !deliveryAddress) {
      return res.status(400).json({ error: 'Please fill in Full Name, Contact Number, and Delivery Address.' });
    }

    const marketItems = await store.listMarketplaceItems();
    let subtotalCost = 0;
    const orderItems: Array<{
      itemId: string;
      title: string;
      category: 'food' | 'groceries' | 'medicines' | 'appliances';
      price: number;
      quantity: number;
      imageUrl?: string;
    }> = [];
    const itemsToUpdate: Array<{ item: (typeof marketItems)[number]; qty: number }> = [];

    for (const ci of cartItems) {
      const itemId = String(ci.itemId || ci.id || '');
      const qty = Math.max(1, Math.floor(Number(ci.quantity) || 1));
      const mItem = marketItems.find((i) => i.id === itemId);
      if (!mItem) {
        return res.status(400).json({ error: 'Item not found or unavailable.' });
      }
      if (mItem.stock < qty) {
        return res.status(400).json({ error: `Insufficient stock for ${mItem.title} (Available: ${mItem.stock}).` });
      }
      subtotalCost += Math.round(mItem.price * qty * 100) / 100;
      orderItems.push({
        itemId: mItem.id,
        title: mItem.title,
        category: mItem.category,
        price: mItem.price,
        quantity: qty,
        imageUrl: mItem.imageUrl,
      });
      itemsToUpdate.push({ item: mItem, qty });
    }

    const deliveryDistanceKm = Math.max(1, Number(req.body?.deliveryDistanceKm) || 2);
    const deliveryFee = calcMarketplaceDeliveryFee(deliveryDistanceKm);
    let promoDiscount = 0;
    let appliedPromoCode = '';
    const rawPromo = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : '';
    if (rawPromo) {
      const programsCfg = await store.getChoyProgramsConfig();
      const promo = programsCfg.promos.find((p) => p.code.toUpperCase() === rawPromo && p.active);
      if (!promo) {
        return res.status(400).json({ error: `Promo code "${rawPromo}" is invalid or inactive.` });
      }
      if (promo.appliesTo !== 'all' && promo.appliesTo !== 'marketplace') {
        return res.status(400).json({ error: `Promo code "${rawPromo}" does not apply to Marketplace orders.` });
      }
      if (promo.expiresAt) {
        const expMs = Date.parse(promo.expiresAt);
        if (Number.isFinite(expMs) && expMs < Date.now()) {
          return res.status(400).json({ error: `Promo code "${rawPromo}" has expired.` });
        }
      }
      if (subtotalCost < promo.minSpend) {
        return res.status(400).json({ error: `Promo "${rawPromo}" requires a minimum items subtotal of ₱${promo.minSpend}.` });
      }
      const rawDisc = promo.discountType === 'percent' ? (subtotalCost * promo.discountValue) / 100 : promo.discountValue;
      promoDiscount = Math.min(subtotalCost, Math.max(0, Math.round(rawDisc * 100) / 100));
      appliedPromoCode = promo.code;
    }
    const totalCost = Math.max(0, Math.round((subtotalCost - promoDiscount + deliveryFee) * 100) / 100);

    const makeTxId = () => `tx_order_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const prependTx = (list: WalletTxItem[], item: WalletTxItem): WalletTxItem[] => [item, ...list].slice(0, 60);

    if (paymentMethod === 'wallet') {
      if (dash.walletBalance < totalCost) {
        return res.status(400).json({ error: `Insufficient Cash Wallet balance (Need ₱${totalCost.toFixed(2)} including ₱${deliveryFee} delivery).` });
      }
      dash.walletBalance = Math.round((dash.walletBalance - totalCost) * 100) / 100;
      dash.transactions = prependTx(dash.transactions, {
        id: makeTxId(),
        walletType: 'wallet',
        kind: 'topup',
        amount: -totalCost,
        note: `Checkout ${orderItems.length} item(s) + ₱${deliveryFee} Delivery Fee${appliedPromoCode ? ` · Promo ${appliedPromoCode} (-₱${promoDiscount.toFixed(2)})` : ''}`,
        createdAt: now,
      });
    } else {
      if (dash.choyWalletBalance < totalCost) {
        return res.status(400).json({ error: `Insufficient Choy Wallet balance (Need ${totalCost} CHOY including ₱${deliveryFee} delivery).` });
      }
      dash.choyWalletBalance = Math.round((dash.choyWalletBalance - totalCost) * 100) / 100;
      dash.transactions = prependTx(dash.transactions, {
        id: makeTxId(),
        walletType: 'choy_wallet',
        kind: 'reward',
        amount: -totalCost,
        note: `Checkout ${orderItems.length} item(s) + ₱${deliveryFee} delivery with CHOY Coins${appliedPromoCode ? ` · Promo ${appliedPromoCode} (-${promoDiscount.toFixed(2)})` : ''}`,
        createdAt: now,
      });
    }

    // Deduct stock only after balance check succeeds
    let latestItems = marketItems;
    for (const entry of itemsToUpdate) {
      entry.item.stock = Math.max(0, entry.item.stock - entry.qty);
      latestItems = await store.saveMarketplaceItem(entry.item);
    }

    const savedDash = await store.saveUserDashboard(dash);
    const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const newOrder = {
      id: orderId,
      userId: user.id,
      userName: user.name,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      deliveryDistanceKm,
      deliveryFee,
      items: orderItems,
      totalAmount: totalCost,
      paymentMethod: paymentMethod as 'wallet' | 'choy_wallet',
      status: 'pending' as const,
      createdAt: now,
    };

    const allOrders = await store.saveMarketplaceOrder(newOrder);
    const visibleOrders = user.role === 'admin' ? allOrders : allOrders.filter((o) => o.userId === user.id);
    broadcastSync('marketplace');

    return res.json({ ok: true, order: newOrder, items: latestItems, orders: visibleOrders, userDashboard: savedDash });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed.' });
  }
});

app.post('/api/marketplace/items', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const now = new Date().toISOString();
    const action = typeof req.body?.action === 'string' ? req.body.action.trim() : 'save';

    if (action === 'delete') {
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete marketplace items.' });
      }
      const itemId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
      if (!itemId) {
        return res.status(400).json({ error: 'Invalid item ID.' });
      }
      const items = await store.deleteMarketplaceItem(itemId);
      broadcastSync('marketplace');
      return res.json({ ok: true, items });
    }

    if (action === 'buy') {
      const dash = await store.getUserDashboard(user.id);
      if (user.role !== 'admin' && dash.kycStatus !== 'approved') {
        return res.status(403).json({
          error:
            dash.kycStatus === 'pending'
              ? 'Your Profile Verification is still pending Admin approval. You can place orders once Admin approves it.'
              : 'Please complete your Profile Verification (Complete Name, Address, Age, Sex & 1 Valid ID) in the Profile tab and wait for Admin approval before placing orders.',
        });
      }
      const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId.trim() : '';
      const paymentMethod = req.body?.paymentMethod === 'choy_wallet' ? 'choy_wallet' : 'wallet';
      const quantity = Math.max(1, Math.floor(Number(req.body?.quantity) || 1));
      const customerName = typeof req.body?.customerName === 'string' ? req.body.customerName.trim().slice(0, 100) : '';
      const customerPhone = typeof req.body?.customerPhone === 'string' ? req.body.customerPhone.trim().slice(0, 40) : '';
      const deliveryAddress = typeof req.body?.deliveryAddress === 'string' ? req.body.deliveryAddress.trim().slice(0, 250) : '';
      const deliveryNotes = typeof req.body?.deliveryNotes === 'string' ? req.body.deliveryNotes.trim().slice(0, 300) : '';

      if (!customerName || !customerPhone || !deliveryAddress) {
        return res.status(400).json({ error: 'Please fill in Full Name, Contact Number, and Delivery Address.' });
      }

      const items = await store.listMarketplaceItems();
      const targetItem = items.find((i) => i.id === itemId);
      if (!targetItem) {
        return res.status(404).json({ error: 'Marketplace item not found.' });
      }
      if (targetItem.stock < quantity) {
        return res.status(400).json({ error: `Insufficient stock (Available: ${targetItem.stock}).` });
      }

      const deliveryDistanceKm = Math.max(1, Number(req.body?.deliveryDistanceKm) || 2);
      const deliveryFee = calcMarketplaceDeliveryFee(deliveryDistanceKm);
      const itemSubtotal = Math.round(targetItem.price * quantity * 100) / 100;
      let promoDiscount = 0;
      const rawPromo = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : '';
      if (rawPromo) {
        const programsCfg = await store.getChoyProgramsConfig();
        const promo = programsCfg.promos.find((p) => p.code.toUpperCase() === rawPromo && p.active);
        if (!promo) {
          return res.status(400).json({ error: `Promo code "${rawPromo}" is invalid or inactive.` });
        }
        if (promo.appliesTo !== 'all' && promo.appliesTo !== 'marketplace') {
          return res.status(400).json({ error: `Promo code "${rawPromo}" does not apply to Marketplace orders.` });
        }
        if (promo.expiresAt) {
          const expMs = Date.parse(promo.expiresAt);
          if (Number.isFinite(expMs) && expMs < Date.now()) {
            return res.status(400).json({ error: `Promo code "${rawPromo}" has expired.` });
          }
        }
        if (itemSubtotal < promo.minSpend) {
          return res.status(400).json({ error: `Promo "${rawPromo}" requires a minimum subtotal of ₱${promo.minSpend}.` });
        }
        const rawDisc = promo.discountType === 'percent' ? (itemSubtotal * promo.discountValue) / 100 : promo.discountValue;
        promoDiscount = Math.min(itemSubtotal, Math.max(0, Math.round(rawDisc * 100) / 100));
      }
      const totalCost = Math.max(0, Math.round((itemSubtotal - promoDiscount + deliveryFee) * 100) / 100);

      const makeTxId = () => `tx_buy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const prependTx = (list: WalletTxItem[], item: WalletTxItem): WalletTxItem[] => [item, ...list].slice(0, 60);

      if (paymentMethod === 'wallet') {
        if (dash.walletBalance < totalCost) {
          return res.status(400).json({ error: `Insufficient Cash Wallet balance (Need ₱${totalCost.toFixed(2)} including ₱${deliveryFee} delivery).` });
        }
        dash.walletBalance = Math.round((dash.walletBalance - totalCost) * 100) / 100;
        dash.transactions = prependTx(dash.transactions, {
          id: makeTxId(),
          walletType: 'wallet',
          kind: 'topup',
          amount: -totalCost,
          note: `Purchased ${quantity}x ${targetItem.title} + ₱${deliveryFee} Delivery Fee`,
          createdAt: now,
        });
      } else {
        if (dash.choyWalletBalance < totalCost) {
          return res.status(400).json({ error: `Insufficient Choy Wallet balance (Need ${totalCost} CHOY including ₱${deliveryFee} delivery).` });
        }
        dash.choyWalletBalance = Math.round((dash.choyWalletBalance - totalCost) * 100) / 100;
        dash.transactions = prependTx(dash.transactions, {
          id: makeTxId(),
          walletType: 'choy_wallet',
          kind: 'reward',
          amount: -totalCost,
          note: `Purchased ${quantity}x ${targetItem.title} + ₱${deliveryFee} delivery with CHOY Coins`,
          createdAt: now,
        });
      }

      targetItem.stock = Math.max(0, targetItem.stock - quantity);
      const latestItems = await store.saveMarketplaceItem(targetItem);

      const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const newOrder = {
        id: orderId,
        userId: user.id,
        userName: user.name,
        customerName,
        customerPhone,
        deliveryAddress,
        deliveryNotes,
        deliveryDistanceKm,
        deliveryFee,
        items: [{
          itemId: targetItem.id,
          title: targetItem.title,
          category: targetItem.category,
          price: targetItem.price,
          quantity,
          imageUrl: targetItem.imageUrl,
        }],
        totalAmount: totalCost,
        paymentMethod: paymentMethod as 'wallet' | 'choy_wallet',
        status: 'pending' as const,
        createdAt: now,
      };
      const allOrders = await store.saveMarketplaceOrder(newOrder);
      const visibleOrders = user.role === 'admin' ? allOrders : allOrders.filter((o) => o.userId === user.id);

      const savedDash = await store.saveUserDashboard(dash);
      broadcastSync('marketplace');
      return res.json({ ok: true, order: newOrder, items: latestItems, orders: visibleOrders, userDashboard: savedDash });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add or edit marketplace items (Admin Setup).' });
    }

    const rawId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const category = ['food', 'groceries', 'medicines', 'appliances'].includes(req.body?.category) ? req.body.category : 'food';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 500) : '';
    const price = Math.max(0, Number(req.body?.price) || 0);
    const rawImageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const imageUrl = sanitizeMediaUrl(rawImageUrl) || (rawImageUrl.startsWith('https://') ? rawImageUrl.slice(0, 1000) : undefined);
    const stock = Math.max(0, Math.floor(Number(req.body?.stock) || 0));
    const sellerName = typeof req.body?.sellerName === 'string' ? req.body.sellerName.trim().slice(0, 80) : 'Choy Store';

    if (!title) {
      return res.status(400).json({ error: 'Item title is required.' });
    }

    const itemId = rawId || `item_${category}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const existingItems = await store.listMarketplaceItems();
    const existing = existingItems.find((i) => i.id === itemId);

    const updatedItem = {
      id: itemId,
      category,
      title,
      description,
      price,
      imageUrl: imageUrl || existing?.imageUrl || undefined,
      stock,
      sellerName,
      createdBy: existing?.createdBy || user.name,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = await store.saveMarketplaceItem(updatedItem);
    broadcastSync('marketplace');
    return res.json({ ok: true, items: updatedList });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save marketplace item' });
  }
});

// ============================================================
// ONLINE PAYMENT TERMINAL ROUTES
// ============================================================
const terminalReviewInFlight = new Set<string>();

function sanitizeTerminalReceiptUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/api/media/')) {
    return trimmed.slice(0, 1000);
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= 2_500_000 ? trimmed : undefined;
  }
  return sanitizeMediaUrl(trimmed);
}

// ============================================================
// PROFILE VERIFICATION (KYC) & ADMIN APPROVAL ROUTES
// ============================================================
function normalizeKycNameForMatch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

app.post('/api/choy/profile-kyc', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const completeName = typeof req.body?.completeName === 'string' ? req.body.completeName.trim().slice(0, 120) : '';
    const address = typeof req.body?.address === 'string' ? req.body.address.trim().slice(0, 260) : '';
    const age = Math.floor(Number(req.body?.age));
    const rawSex = req.body?.sex;
    const sex: 'Male' | 'Female' | 'Other' | null =
      rawSex === 'Male' || rawSex === 'Female' || rawSex === 'Other' ? rawSex : null;
    const validIdType = typeof req.body?.validIdType === 'string' ? req.body.validIdType.trim().slice(0, 80) : '';
    const validIdName = typeof req.body?.validIdName === 'string' ? req.body.validIdName.trim().slice(0, 120) : '';
    const privateValidIdAssetId =
      typeof req.body?.privateValidIdAssetId === 'string'
        ? req.body.privateValidIdAssetId.trim().slice(0, 120)
        : '';
    const legacyValidIdImageUrl = sanitizeTerminalReceiptUrl(req.body?.validIdImageUrl);

    if (completeName.length < 2) {
      return res.status(400).json({ error: 'Complete Name is required (at least 2 characters).' });
    }
    if (address.length < 5) {
      return res.status(400).json({ error: 'Complete Address is required.' });
    }
    if (!Number.isInteger(age) || age < 13 || age > 120) {
      return res.status(400).json({ error: 'Age must be a valid number between 13 and 120.' });
    }
    if (!sex) {
      return res.status(400).json({ error: 'Sex must be Male, Female, or Other.' });
    }
    if (!validIdType) {
      return res.status(400).json({ error: 'Please select a Valid ID Type.' });
    }
    if (!validIdName) {
      return res.status(400).json({ error: 'Name printed on Valid ID is required.' });
    }
    if (normalizeKycNameForMatch(completeName) !== normalizeKycNameForMatch(validIdName)) {
      return res.status(400).json({ error: 'Complete Name and Name on Valid ID must be the exact same.' });
    }

    let verifiedPrivateAssetId = user.privateValidIdAssetId || '';
    if (privateValidIdAssetId) {
      const asset = await store.getPrivateKycAssetById(privateValidIdAssetId);
      if (!asset || (asset.ownerUserId && asset.ownerUserId !== user.id)) {
        return res.status(400).json({ error: 'Uploaded private Valid ID reference is invalid. Please re-upload.' });
      }
      await store.bindPrivateKycAssetOwner(asset.id, user.id);
      verifiedPrivateAssetId = asset.id;
    }

    if (!verifiedPrivateAssetId && !legacyValidIdImageUrl) {
      return res.status(400).json({ error: 'A valid photo of your Valid ID is required.' });
    }

    const now = new Date().toISOString();

    // Encrypt the legal real name into the admin-only column and bind the private bucket ID asset
    await store.updateUserPrivateKyc(user.id, {
      realNamePlaintext: completeName,
      privateValidIdAssetId: verifiedPrivateAssetId || undefined,
      privacyConsentAccepted: true,
    });

    const dash = await store.getUserDashboard(user.id);
    dash.kycCompleteName = completeName;
    dash.kycAddress = address;
    dash.kycAge = age;
    dash.kycSex = sex;
    dash.kycValidIdType = validIdType;
    dash.kycValidIdName = validIdName;
    // Never expose raw private IDs in non-admin fields; Admin endpoint resolves via /api/admin/private-kyc/file/:assetId
    dash.kycValidIdImageUrl = verifiedPrivateAssetId ? '' : legacyValidIdImageUrl;
    // Never allow self-approval: every submission goes to Admin review as pending
    dash.kycStatus = 'pending';
    dash.kycSubmittedAt = now;
    dash.kycReviewedBy = undefined;
    dash.kycReviewedAt = undefined;
    dash.kycRejectionReason = undefined;

    const savedDash = await store.saveUserDashboard(dash);

    await store.appendActivityLog({
      category: 'kyc',
      actor: user.name,
      message: `${user.name} submitted encrypted KYC & Private Bucket Valid ID for Admin review`,
    });

    // Notify Choy Admin chat without exposing the raw Valid ID image outside the Admin-only private viewer
    try {
      const summaryLines = [
        'PROFILE VERIFICATION SUBMITTED (PRIVATE VAULT · ADMIN APPROVAL REQUIRED)',
        `Public Display Name: ${user.name} (${user.phone})`,
        `Valid ID Type: ${validIdType} (Exact Name Match Verified)`,
        'Real Name & Valid ID are stored in the Admin-Only Private Bucket.',
        'Open Admin Panel -> Accounts & ID Approvals to decrypt and review.',
      ].join('\n');
      await store.createMessage({
        senderId: user.id,
        senderName: user.name,
        roomId: 'Choy Admin',
        text: summaryLines,
        mediaType: 'text',
      });
      broadcastSync('messages');
    } catch (msgErr) {
      console.error('Failed to mirror KYC submission notice to Choy Admin chat:', msgErr);
    }

    broadcastSync('users');
    return res.json({ ok: true, userDashboard: savedDash, privateBucketStored: Boolean(verifiedPrivateAssetId) });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save profile verification' });
  }
});

app.get('/api/choy/admin/profile-kyc', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const [allUsers, allDashboards] = await Promise.all([
      store.listAllStoredUsersForAdmin(),
      store.listAllUserDashboards(),
    ]);
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const dashMap = new Map(allDashboards.map((d) => [d.userId, d]));

    // Combine dashboard KYC submissions + users who uploaded private IDs during registration
    const candidateUserIds = new Set<string>();
    for (const d of allDashboards) {
      if (d.kycStatus && d.kycStatus !== 'unsubmitted') candidateUserIds.add(d.userId);
    }
    for (const u of allUsers) {
      if (u.privateValidIdAssetId || u.privateRealAvatarAssetId || u.encryptedRealName) {
        candidateUserIds.add(u.id);
      }
    }

    const submissions = Array.from(candidateUserIds)
      .map((userId) => {
        const u = userMap.get(userId);
        const d = dashMap.get(userId);
        const decryptedRealName = u?.encryptedRealName ? decryptSensitiveField(u.encryptedRealName) : '';
        const privateValidIdProxyUrl = u?.privateValidIdAssetId
          ? `/api/admin/private-kyc/file/${encodeURIComponent(u.privateValidIdAssetId)}`
          : undefined;
        const privateRealAvatarProxyUrl = u?.privateRealAvatarAssetId
          ? `/api/admin/private-kyc/file/${encodeURIComponent(u.privateRealAvatarAssetId)}`
          : undefined;

        return {
          userId,
          accountName: u?.name || 'Member',
          decryptedRealName: decryptedRealName || d?.kycCompleteName || '',
          hasEncryptedRealName: Boolean(u?.encryptedRealName),
          privacyConsentAccepted: Boolean(u?.privacyConsentAccepted),
          privacyConsentAt: u?.privacyConsentAt,
          phone: u?.phone || '',
          role: u?.role || 'member',
          kycStatus: d?.kycStatus || 'pending',
          kycCompleteName: decryptedRealName || d?.kycCompleteName || '',
          kycAddress: d?.kycAddress || '',
          kycAge: d?.kycAge,
          kycSex: d?.kycSex,
          kycValidIdType: d?.kycValidIdType || (u?.privateValidIdAssetId ? 'Private Registration Valid ID' : ''),
          kycValidIdName: d?.kycValidIdName || decryptedRealName || '',
          kycValidIdImageUrl: privateValidIdProxyUrl || d?.kycValidIdImageUrl,
          privateRealAvatarUrl: privateRealAvatarProxyUrl,
          isPrivateBucketProtected: Boolean(privateValidIdProxyUrl || privateRealAvatarProxyUrl),
          kycSubmittedAt: d?.kycSubmittedAt || u?.createdAt,
          kycReviewedBy: d?.kycReviewedBy,
          kycReviewedAt: d?.kycReviewedAt,
          kycRejectionReason: d?.kycRejectionReason,
        };
      })
      .sort((a, b) => {
        if (a.kycStatus === 'pending' && b.kycStatus !== 'pending') return -1;
        if (a.kycStatus !== 'pending' && b.kycStatus === 'pending') return 1;
        return String(b.kycSubmittedAt || '').localeCompare(String(a.kycSubmittedAt || ''));
      });
    return res.json({ ok: true, submissions });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load profile verifications' });
  }
});

app.get('/api/admin/export-all-values', async (req: Request, res: Response) => {
  try {
    const rawToken = String(req.query.token || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '').trim();
    const payload = rawToken ? verifySessionToken(rawToken) : null;
    if (!payload || !payload.uid) {
      return res.status(401).json({ error: 'Unauthorized. Admin token required.' });
    }
    const adminUser = await store.getUserById(payload.uid);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }

    const [users, dashboards, ledger, messages, marketplaceItems, marketplaceOrders, investProducts, userInvestments, blogPosts, visitorStats, settings] = await Promise.all([
      store.listAllStoredUsersForAdmin(),
      store.listAllUserDashboards(),
      store.listLedger(),
      store.listMessages(),
      store.listMarketplaceItems(),
      store.listMarketplaceOrders(),
      store.listInvestProducts(),
      store.listUserInvestments(),
      store.listBlogPosts(),
      store.getVisitorStats(),
      store.getSettings(),
    ]);
    const exportBundle = {
      exportedAt: new Date().toISOString(),
      platform: 'Choy Chat',
      summary: {
        totalUsers: users.length,
        totalDashboards: dashboards.length,
        totalLedgerRows: ledger.length,
        totalMessages: messages.length,
        totalMarketplaceItems: marketplaceItems.length,
        totalMarketplaceOrders: marketplaceOrders.length,
        totalInvestProducts: investProducts.length,
        totalUserInvestments: userInvestments.length,
        totalBlogPosts: blogPosts.length,
      },
      users,
      dashboards,
      ledger,
      messages,
      marketplaceItems,
      marketplaceOrders,
      investProducts,
      userInvestments,
      blogPosts,
      visitorStats,
      settings,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=choychat_all_values_export_${new Date().toISOString().slice(0, 10)}.json`);
    return res.send(JSON.stringify(exportBundle, null, 2));
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export all values' });
  }
});

// ============================================================================
// ADMIN COMMAND DASHBOARD ANALYTICS, SYSTEM MONITOR, CLEANER & STRIPE WEBHOOK
// ============================================================================
async function computeDirectoryBytes(dirPath: string): Promise<{ bytes: number; fileCount: number }> {
  let bytes = 0;
  let fileCount = 0;
  const walk = async (curr: string) => {
    const entries = await fs.promises.readdir(curr, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(curr, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const st = await fs.promises.stat(full).catch(() => null);
        if (st) {
          bytes += st.size;
          fileCount += 1;
        }
      }
    }
  };
  await walk(dirPath);
  return { bytes, fileCount };
}

app.get('/api/admin/command-dashboard', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const dbPingStart = Date.now();
    const [
      allUsers,
      allDashboards,
      allOrders,
      allPosts,
      allPaymentTxs,
      allInvestments,
      privateKycAssets,
      activityLogs,
      errorLogs,
      visitorStats,
      blogPosts,
      contactMessages,
    ] = await Promise.all([
      store.listUsers(true),
      store.listAllUserDashboards(),
      store.listMarketplaceOrders(),
      store.listPosts(),
      store.listPaymentTerminalTransactions(),
      store.listUserInvestments(),
      store.listPrivateKycAssets(),
      store.listActivityLogs(),
      store.listErrorLogs(),
      store.getVisitorStats(),
      store.listBlogPosts(),
      store.listContactMessages(),
    ]);
    const dbLatencyMs = Math.max(1, Date.now() - dbPingStart);

    // 1. Lifetime Earnings (Stripe / Payment Terminal + Completed Marketplace Orders + Investments)
    const approvedTerminalPhp = allPaymentTxs
      .filter((t) => t.status === 'approved')
      .reduce((acc, t) => acc + (Number(t.totalPhp) || 0), 0);
    const completedOrders = allOrders.filter(
      (o) => o.status !== 'cancelled'
    );
    const completedOrderRevenuePhp = completedOrders.reduce(
      (acc, o) => acc + (Number(o.totalAmount) || 0),
      0
    );
    const investVolumePhp = allInvestments.reduce(
      (acc, inv) => acc + (Number(inv.principalAmount) || 0),
      0
    );
    const totalEarningsPhp = Math.round((approvedTerminalPhp + completedOrderRevenuePhp + investVolumePhp) * 100) / 100;

    // 2. Successful Buys (completed food delivery / marketplace orders)
    const successfulBuys = completedOrders.length;

    // 3. Visitor Counter (today + total + live SSE connected clients)
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayVisits = Number(visitorStats.dailyCounts?.[todayKey] || 0);
    const liveActiveTraffic = Math.max(1, sseClients.size);

    // 4. Total Likes (customer likes across posts & dish features)
    const totalLikes = allPosts.reduce(
      (acc, p) => acc + (Array.isArray(p.likes) ? p.likes.length : 0),
      0
    );

    // 5. Pending KYC count for direct link to User Verification
    const pendingKycCount = allDashboards.filter((d) => d.kycStatus === 'pending').length;

    // 6. System & Backend Monitor Telemetry
    const memUsage = process.memoryUsage();
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = Math.max(0, totalMemBytes - freeMemBytes);
    const loadAvg = os.loadavg();
    const cpuCount = Math.max(1, os.cpus().length);
    const cpuUsagePct = Math.min(100, Math.round(((loadAvg[0] || 0) / cpuCount) * 100));
    const ramUsagePct = totalMemBytes > 0 ? Math.round((usedMemBytes / totalMemBytes) * 100) : 0;

    // 7. Storage Monitor (Private Bucket KYC + Food Images + Media)
    const privateKycBytesFromRegistry = privateKycAssets.reduce((acc, a) => acc + (Number(a.sizeBytes) || 0), 0);
    const [privateDiskStats, foodDiskStats, allMediaDiskStats] = await Promise.all([
      computeDirectoryBytes(PRIVATE_KYC_VAULT_DIR),
      computeDirectoryBytes(path.resolve(LOCAL_MEDIA_ROOT, 'marketplace')),
      computeDirectoryBytes(LOCAL_MEDIA_ROOT),
    ]);
    const privateBucketBytes = Math.max(privateKycBytesFromRegistry, privateDiskStats.bytes);
    const foodImagesBytes = foodDiskStats.bytes;
    const otherMediaBytes = Math.max(0, allMediaDiskStats.bytes - foodImagesBytes);
    const totalStorageBytes = privateBucketBytes + foodImagesBytes + otherMediaBytes;

    const poolStats = store.getPoolStats();
    const supaStatus = getSupabaseStorageStatus();
    const supaPrivate = getSupabasePrivateKycStatus();
    const stripeConfigured = Boolean((process.env.STRIPE_SECRET_KEY || '').trim());

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      analytics: {
        totalEarningsPhp,
        approvedTerminalPhp: Math.round(approvedTerminalPhp * 100) / 100,
        completedOrderRevenuePhp: Math.round(completedOrderRevenuePhp * 100) / 100,
        stripeConfigured,
        successfulBuys,
        totalOrdersCount: allOrders.length,
        visitorCounter: {
          todayVisits,
          totalVisits: Number(visitorStats.totalVisits || 0),
          liveActiveTraffic,
          lastVisitAt: visitorStats.lastVisitAt,
        },
        totalLikes,
        totalUsersCount: allUsers.length,
        pendingKycCount,
        blogPostsCount: blogPosts.length,
        contactMessagesCount: contactMessages.length,
        activityLogs: activityLogs.slice(0, 40),
        errorLogs: errorLogs.slice(0, 40),
        unresolvedErrorCount: errorLogs.filter((e) => !e.resolved).length,
      },
      system: {
        database: {
          status: store.storageMode === 'postgres' ? 'connected' : 'fallback_local',
          storageMode: store.storageMode,
          storageStatus: store.storageStatus,
          latencyMs: dbLatencyMs,
          pool: poolStats,
          cpuUsagePct,
          ramUsagePct,
          ramUsedMb: Math.round(usedMemBytes / (1024 * 1024)),
          ramTotalMb: Math.round(totalMemBytes / (1024 * 1024)),
        },
        backendServer: {
          status: 'operational',
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
          processRssMb: Math.round(memUsage.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
          heapTotalMb: Math.round(memUsage.heapTotal / (1024 * 1024)),
          platform: os.platform(),
        },
        storageMonitor: {
          privateBucketName: supaPrivate.bucket,
          privateBucketConfigured: supaPrivate.configured,
          publicBucketConfigured: supaStatus.configured,
          privateBucketBytes,
          privateBucketFiles: privateKycAssets.length,
          foodImagesBytes,
          otherMediaBytes,
          totalStorageBytes,
          totalStorageGb: Number((totalStorageBytes / (1024 ** 3)).toFixed(4)),
          quotaGb: 5,
        },
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Admin Dashboard.' });
  }
});

app.post('/api/admin/system/cleaner', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const admin = req.choyUser!;
    cleanupExpiredChunkedUploads();
    const cleaned = await store.runSystemCleaner();

    // Remove stale temporary chunk files older than 30 days (or orphaned .tmp files)
    let purgedTempFiles = 0;
    let reclaimedBytes = 0;
    const tmpDir = path.resolve(LOCAL_MEDIA_ROOT, '_tmp');
    const entries = await fs.promises.readdir(tmpDir, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(tmpDir, entry.name);
      const st = await fs.promises.stat(full).catch(() => null);
      if (st && now - st.mtimeMs > 60 * 60_000) {
        await fs.promises.unlink(full).catch(() => {});
        purgedTempFiles += 1;
        reclaimedBytes += st.size;
      }
    }

    // Clear stale rate-limit cookie/IP buckets
    let purgedExpiredRateEntries = 0;
    for (const [k, v] of privateUploadRateMap.entries()) {
      if (v.resetAt <= now) {
        privateUploadRateMap.delete(k);
        purgedExpiredRateEntries += 1;
      }
    }

    await store.appendActivityLog({
      category: 'system',
      actor: admin.name,
      message: `System Cleaner ran: purged ${cleaned.purgedErrorLogs} old error logs, ${cleaned.purgedActivityLogs} old activity logs, ${cleaned.purgedAbandonedCarts} abandoned carts, ${purgedTempFiles} temp files.`,
    });

    return res.json({
      ok: true,
      ...cleaned,
      purgedTempFiles,
      purgedExpiredCookiesAndSessions: cleaned.purgedExpiredSessions + purgedExpiredRateEntries,
      reclaimedBytes,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'System cleaner failed.' });
  }
});

app.post('/api/admin/error-logs/:id/resolve', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    const logs = await store.resolveErrorLog(id);
    return res.json({ ok: true, errorLogs: logs });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to resolve error log.' });
  }
});

// Stripe Webhook endpoint — strictly verifies HMAC-SHA256 signature & timestamp freshness when STRIPE_WEBHOOK_SECRET is configured,
// logs failures to Admin Error Log, and auto-credits verified Stripe Checkout Terminal transactions.
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '2mb' }), async (req: Request, res: Response) => {
  try {
    const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    const sigHeader = String(req.headers['stripe-signature'] || '');
    const rawBuf = (req as Request & { rawBody?: Buffer }).rawBody || (Buffer.isBuffer(req.body) ? req.body : null);
    const rawBody = rawBuf ? rawBuf.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

    if (!webhookSecret) {
      await store.appendErrorLog({
        source: 'stripe_webhook',
        severity: 'warning',
        message: 'Stripe webhook received while STRIPE_WEBHOOK_SECRET is not configured; ignoring unverified payload.',
      });
      return res.status(503).json({ error: 'Stripe webhook secret is not configured.' });
    }

    const segments = sigHeader.split(',').map((s) => s.trim()).filter(Boolean);
    let timestamp = '';
    const v1Signatures: string[] = [];
    for (const seg of segments) {
      const idx = seg.indexOf('=');
      if (idx <= 0) continue;
      const key = seg.slice(0, idx).trim();
      const val = seg.slice(idx + 1).trim();
      if (key === 't') timestamp = val;
      if (key === 'v1' && val) v1Signatures.push(val);
    }

    const tsNum = Number(timestamp);
    const nowSec = Math.floor(Date.now() / 1000);
    const timestampValid = Number.isFinite(tsNum) && Math.abs(nowSec - tsNum) <= 300;
    const computed = timestamp
      ? crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex')
      : '';
    const sigValid =
      timestampValid &&
      v1Signatures.length > 0 &&
      v1Signatures.some((sig) => timingSafeStringEqual(computed, sig));

    if (!sigValid) {
      await store.appendErrorLog({
        source: 'stripe_webhook',
        severity: 'critical',
        message: 'Stripe webhook signature verification failed (possible spoofing, expired timestamp, or mismatched STRIPE_WEBHOOK_SECRET).',
      });
      return res.status(400).json({ error: 'Invalid Stripe signature.' });
    }

    const evt = JSON.parse(rawBody || '{}') as {
      type?: string;
      id?: string;
      data?: {
        object?: {
          id?: string;
          payment_status?: string;
          amount_total?: number;
          currency?: string;
          metadata?: Record<string, string>;
        };
      };
    };

    if (
      (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') &&
      evt.data?.object?.payment_status === 'paid'
    ) {
      const sessionObj = evt.data.object;
      const metaTxId = String(sessionObj.metadata?.txId || '').trim();
      const metaUserId = String(sessionObj.metadata?.userId || '').trim();
      if (metaTxId) {
        const existing = await store.getPaymentTerminalTransactionById(metaTxId);
        const expectedAmountCentavos = existing ? Math.round(existing.totalPhp * 100) : -1;
        const paidAmount = Number(sessionObj.amount_total ?? -1);
        const currencyOk = String(sessionObj.currency || '').toLowerCase() === 'php';
        if (
          existing &&
          existing.status === 'pending' &&
          !existing.creditedAt &&
          metaUserId === existing.userId &&
          currencyOk &&
          paidAmount === expectedAmountCentavos
        ) {
          await finalizePaymentTerminalTransaction(existing.id, 'approved', 'Stripe Webhook');
        }
      }
    }

    await store.appendActivityLog({
      category: 'payment',
      actor: 'Stripe Webhook',
      message: `Processed verified Stripe event ${evt.type || 'unknown'} (${evt.id || 'no-id'}).`,
    });
    return res.json({ received: true });
  } catch (err: unknown) {
    await store.appendErrorLog({
      source: 'stripe_webhook',
      severity: 'error',
      message: `Stripe webhook processing error: ${err instanceof Error ? err.message : 'Malformed payload'}`,
    });
    return res.status(400).json({ error: 'Invalid Stripe webhook payload.' });
  }
});

// ============================================================================
// PUBLIC SEO LANDING, BLOG, CONTACT & VISITOR APIs (No Login Required)
// ============================================================================
const publicVisitRateMap = new Map<string, number>();

app.post('/api/public/visit', async (req: Request, res: Response) => {
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.ip || 'visitor').split(',')[0].trim();
    const last = publicVisitRateMap.get(ip) || 0;
    const now = Date.now();
    if (now - last > 30_000) {
      publicVisitRateMap.set(ip, now);
      const stats = await store.recordSiteVisit();
      return res.json({ ok: true, totalVisits: stats.totalVisits });
    }
    const stats = await store.getVisitorStats();
    return res.json({ ok: true, totalVisits: stats.totalVisits });
  } catch {
    return res.json({ ok: false });
  }
});

app.get('/api/public/blog', async (_req: Request, res: Response) => {
  try {
    const [posts, marketplaceItems] = await Promise.all([
      store.listBlogPosts(),
      store.listMarketplaceItems(),
    ]);
    const featuredFood = marketplaceItems
      .filter((item) => item.category === 'food' && item.stock > 0)
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl || '/assets/images/hero_local_food_delivery_1795763680017.jpg',
        sellerName: item.sellerName,
        stock: item.stock,
      }));
    return res.json({ ok: true, posts, featuredFood });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load blog posts.' });
  }
});

app.post('/api/admin/blog', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const admin = req.choyUser!;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 140) : '';
    const excerpt = typeof req.body?.excerpt === 'string' ? req.body.excerpt.trim().slice(0, 320) : '';
    const rawBody = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const categoryRaw = typeof req.body?.category === 'string' ? req.body.category.trim() : 'Delivery Tips';
    const allowedCategories: StoredBlogPost['category'][] = [
      'Delivery Tips',
      'Restaurant Spotlight',
      'Rider Stories',
      'Safety & Privacy',
    ];
    const category = allowedCategories.includes(categoryRaw as StoredBlogPost['category'])
      ? (categoryRaw as StoredBlogPost['category'])
      : 'Delivery Tips';
    const rawCover = typeof req.body?.coverImage === 'string' ? req.body.coverImage.trim() : '';
    const coverImage =
      rawCover.startsWith('/assets/images/') || rawCover.startsWith('/src/assets/images/')
        ? rawCover.replace(/^\/src\/assets\/images\//, '/assets/images/')
        : '/assets/images/hero_local_food_delivery_1795763680017.jpg';

    if (title.length < 5 || rawBody.length < 20) {
      return res.status(400).json({ error: 'Article title (min 5 chars) and body content (min 20 chars) are required.' });
    }

    const paragraphs = rawBody
      .split(/\n{2,}/)
      .map((p: string) => p.trim())
      .filter(Boolean)
      .slice(0, 20);
    const wordCount = rawBody.split(/\s+/).filter(Boolean).length;
    const readTimeMin = Math.max(1, Math.min(20, Math.ceil(wordCount / 180)));
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    const now = new Date().toISOString();

    const newPost: StoredBlogPost = {
      id: `blog_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      slug: `${slug || 'article'}-${Date.now().toString(36)}`,
      title,
      excerpt: excerpt || (paragraphs[0] || '').slice(0, 180),
      content: paragraphs,
      category,
      author: admin.name,
      readTimeMin,
      coverImage,
      publishedAt: now,
      updatedAt: now,
    };

    const existing = await store.listBlogPosts();
    const posts = await store.saveBlogPosts([newPost, ...existing]);
    await store.appendActivityLog({
      category: 'blog',
      actor: admin.name,
      message: `Published blog article: "${newPost.title}"`,
    });
    return res.status(201).json({ ok: true, post: newPost, posts });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to publish blog article.' });
  }
});

app.delete('/api/admin/blog/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    const existing = await store.listBlogPosts();
    const next = existing.filter((p) => p.id !== id);
    const posts = await store.saveBlogPosts(next);
    return res.json({ ok: true, posts });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete blog article.' });
  }
});

app.post('/api/public/contact', async (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 140) : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 140) : 'General Inquiry';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1500) : '';

    if (name.length < 2) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'Please enter a message of at least 10 characters.' });
    }

    const saved = await store.saveContactMessage({ name, email, subject, message });
    await store.appendActivityLog({
      category: 'contact',
      actor: name,
      message: `Contact Us inquiry submitted: "${subject}"`,
    });
    return res.status(201).json({ ok: true, inquiry: saved });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to submit contact form.' });
  }
});

app.post(
  '/api/choy/admin/profile-kyc/:userId/status',
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const adminUser = req.choyUser!;
      const targetUserId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
      const nextStatus = req.body?.status === 'approved' ? 'approved' : req.body?.status === 'rejected' ? 'rejected' : null;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 260) : '';

      if (!targetUserId || !nextStatus) {
        return res.status(400).json({ error: 'Valid userId and status (approved or rejected) are required.' });
      }
      const allUsers = await store.listUsers(true);
      const targetUser = allUsers.find((u) => u.id === targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User account not found.' });
      }

      const dash = await store.getUserDashboard(targetUserId);
      if (!dash.kycCompleteName || !dash.kycValidIdImageUrl) {
        return res.status(400).json({ error: 'This user has not submitted a complete Profile Verification yet.' });
      }

      const now = new Date().toISOString();
      dash.kycStatus = nextStatus;
      dash.kycReviewedBy = adminUser.name;
      dash.kycReviewedAt = now;
      dash.kycRejectionReason = nextStatus === 'rejected' ? reason || 'Please re-check your details and Valid ID.' : undefined;

      const savedDash = await store.saveUserDashboard(dash);
      broadcastSync('users');
      return res.json({ ok: true, userDashboard: savedDash });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update profile verification status' });
    }
  }
);

// ============================================================
// MP3 MUSIC LIBRARY & LONG VIDEO LIBRARY ROUTES
// ============================================================
app.get('/api/choy/media-library', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const [tracks, videos] = await Promise.all([store.listMusicTracks(), store.listLongVideos()]);
    return res.json({ ok: true, tracks, videos });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load media library' });
  }
});

app.post('/api/choy/media-library/music', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
    const artist = typeof req.body?.artist === 'string' ? req.body.artist.trim().slice(0, 80) : user.name;
    const audioUrl = sanitizeMediaUrl(req.body?.audioUrl);
    const fileName = sanitizeDownloadFileName(req.body?.fileName, `${title || 'track'}.mp3`);
    const durationSec = Math.max(0, Math.min(7200, Math.floor(Number(req.body?.durationSec) || 0)));
    const sizeBytes = Math.max(0, Math.min(MAX_AUDIO_UPLOAD_BYTES, Math.floor(Number(req.body?.sizeBytes) || 0)));

    if (!title || !audioUrl) {
      return res.status(400).json({ error: 'Song title and valid MP3 audio file are required.' });
    }

    const existing = await store.listMusicTracks();
    const newTrack: StoredMusicTrack = {
      id: `mp3_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      title,
      artist: artist || user.name,
      audioUrl,
      fileName,
      durationSec,
      sizeBytes,
      uploadedById: user.id,
      uploadedByName: user.name,
      createdAt: new Date().toISOString(),
    };

    const tracks = await store.saveMusicTracks([newTrack, ...existing]);
    broadcastSync('media');
    return res.status(201).json({ ok: true, track: newTrack, tracks });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save MP3 track' });
  }
});

app.delete('/api/choy/media-library/music/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const id = String(req.params.id || '').trim();
    const existing = await store.listMusicTracks();
    const target = existing.find((t) => t.id === id);
    if (!target) {
      return res.status(404).json({ error: 'MP3 track not found.' });
    }
    if (user.role !== 'admin' && target.uploadedById !== user.id) {
      return res.status(403).json({ error: 'Only the uploader or Admin can delete this MP3 track.' });
    }

    const next = existing.filter((t) => t.id !== id);
    const tracks = await store.saveMusicTracks(next);

    // Clean up local disk file if hosted locally
    const match = target.audioUrl.match(/^\/api\/media\/local\/([a-z0-9_-]+)\/([a-zA-Z0-9._-]+)$/);
    if (match) {
      const localPath = resolveConfinedLocalMediaPath(match[1], match[2]);
      if (localPath) void fs.promises.unlink(localPath).catch(() => {});
    }

    broadcastSync('media');
    return res.json({ ok: true, tracks });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete MP3 track' });
  }
});

app.post('/api/choy/media-library/videos', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 140) : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 260) : '';
    const videoUrl = sanitizeMediaUrl(req.body?.videoUrl);
    const fileName = sanitizeDownloadFileName(req.body?.fileName, `${title || 'video'}.mp4`);
    const durationSec = Math.max(0, Math.min(18000, Math.floor(Number(req.body?.durationSec) || 0)));
    const sizeBytes = Math.max(0, Math.min(MAX_VIDEO_UPLOAD_BYTES, Math.floor(Number(req.body?.sizeBytes) || 0)));

    if (!title || !videoUrl) {
      return res.status(400).json({ error: 'Video title and valid video file are required.' });
    }

    const existing = await store.listLongVideos();
    const newVideo: StoredLongVideo = {
      id: `vid_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      title,
      description,
      videoUrl,
      fileName,
      durationSec,
      sizeBytes,
      uploadedById: user.id,
      uploadedByName: user.name,
      createdAt: new Date().toISOString(),
    };

    const videos = await store.saveLongVideos([newVideo, ...existing]);
    broadcastSync('media');
    return res.status(201).json({ ok: true, video: newVideo, videos });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save video' });
  }
});

app.delete('/api/choy/media-library/videos/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const id = String(req.params.id || '').trim();
    const existing = await store.listLongVideos();
    const target = existing.find((v) => v.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Video not found.' });
    }
    if (user.role !== 'admin' && target.uploadedById !== user.id) {
      return res.status(403).json({ error: 'Only the uploader or Admin can delete this video.' });
    }

    const next = existing.filter((v) => v.id !== id);
    const videos = await store.saveLongVideos(next);

    const match = target.videoUrl.match(/^\/api\/media\/local\/([a-z0-9_-]+)\/([a-zA-Z0-9._-]+)$/);
    if (match) {
      const localPath = resolveConfinedLocalMediaPath(match[1], match[2]);
      if (localPath) void fs.promises.unlink(localPath).catch(() => {});
    }

    broadcastSync('media');
    return res.json({ ok: true, videos });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete video' });
  }
});

// ============================================================
// INVEST SYSTEM (5% per day x 30 days Simple Interest, live per-minute counting)
// ============================================================
const investBuyInFlight = new Set<string>();
const investClaimInFlight = new Set<string>();

function computeInvestmentLiveMetrics(inv: StoredUserInvestment, nowMs: number) {
  const startedMs = Date.parse(inv.startedAt) || nowMs;
  const durationDays = Math.max(1, Math.min(365, Math.floor(Number(inv.durationDays) || 30)));
  const totalMinutes = durationDays * 1440;
  const elapsedMs = Math.max(0, nowMs - startedMs);
  const completedMinutes = Math.min(totalMinutes, Math.floor(elapsedMs / 60_000));
  const dailyEarning = Math.round(Number(inv.dailyEarning || 0) * 100) / 100;
  const totalTargetEarnings = Math.round(Number(inv.totalTargetEarnings || dailyEarning * durationDays) * 100) / 100;
  const perMinuteEarning = totalMinutes > 0 ? totalTargetEarnings / totalMinutes : 0;
  const earnedSoFar =
    completedMinutes >= totalMinutes
      ? totalTargetEarnings
      : Math.min(totalTargetEarnings, Math.round(((completedMinutes / totalMinutes) * totalTargetEarnings) * 10000) / 10000);
  const claimedEarnings = Math.max(0, Math.round(Number(inv.claimedEarnings || 0) * 100) / 100);
  const unclaimedEarnings = Math.max(0, Math.round((earnedSoFar - claimedEarnings) * 10000) / 10000);
  const claimableNow = Math.max(0, Math.floor((earnedSoFar - claimedEarnings) * 100) / 100);
  const isCompleted = completedMinutes >= totalMinutes;
  const nextTickInSeconds = isCompleted ? 0 : Math.max(1, 60 - Math.floor((elapsedMs % 60_000) / 1000));

  return {
    totalMinutes,
    completedMinutes,
    perMinuteEarning,
    earnedSoFar,
    claimedEarnings,
    unclaimedEarnings,
    claimableNow,
    isCompleted,
    nextTickInSeconds,
  };
}

function serializeUserInvestmentForMember(inv: StoredUserInvestment, nowMs: number) {
  const metrics = computeInvestmentLiveMetrics(inv, nowMs);
  // Deliberately omit principalAmount from member payloads so user dashboard displays All Earnings only
  return {
    id: inv.id,
    userId: inv.userId,
    userName: inv.userName,
    productId: inv.productId,
    productTitle: inv.productTitle,
    dailyRatePercent: inv.dailyRatePercent,
    durationDays: inv.durationDays,
    dailyEarning: inv.dailyEarning,
    totalTargetEarnings: inv.totalTargetEarnings,
    startedAt: inv.startedAt,
    endsAt: inv.endsAt,
    ...metrics,
  };
}

app.get('/api/choy/invest/state', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const programsConfig = await store.getChoyProgramsConfig();
    const investEnabled = programsConfig.featureToggles?.invest !== false;
    const allProducts = await store.listInvestProducts();
    const visibleProducts = user.role === 'admin' ? allProducts : allProducts.filter((p) => p.active);
    const allInvestments = await store.listUserInvestments();
    const nowMs = Date.now();
    const myInvestments = allInvestments
      .filter((inv) => inv.userId === user.id)
      .map((inv) => serializeUserInvestmentForMember(inv, nowMs));

    return res.json({
      ok: true,
      investEnabled,
      serverTime: new Date(nowMs).toISOString(),
      products: visibleProducts,
      investments: myInvestments,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Invest dashboard.' });
  }
});

app.post('/api/choy/invest/buy', requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.choyUser!;
  if (investBuyInFlight.has(user.id)) {
    return res.status(409).json({ error: 'Another investment purchase is already processing. Please wait a moment.' });
  }
  investBuyInFlight.add(user.id);
  try {
    const programsConfig = await store.getChoyProgramsConfig();
    const investEnabled = programsConfig.featureToggles?.invest !== false;
    if (!investEnabled && user.role !== 'admin') {
      return res.status(403).json({ error: 'Invest is currently disabled by Admin (Coming Soon).' });
    }

    const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
    if (!productId) {
      return res.status(400).json({ error: 'Please select an investment product.' });
    }

    const products = await store.listInvestProducts();
    const product = products.find((p) => p.id === productId && p.active);
    if (!product) {
      return res.status(404).json({ error: 'Selected investment product is no longer available.' });
    }

    const price = Math.round(Number(product.price) * 100) / 100;
    const dailyRatePercent = Math.max(0.1, Math.min(50, Number(product.dailyRatePercent) || 5));
    const durationDays = Math.max(1, Math.min(365, Math.floor(Number(product.durationDays) || 30)));
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'Invalid product price configuration.' });
    }

    const dash = await store.getUserDashboard(user.id);
    if (dash.walletBalance < price) {
      return res.status(400).json({
        error: `Insufficient Cash Wallet balance. Need ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}, available ₱${dash.walletBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`,
      });
    }

    const nowMs = Date.now();
    const startedAt = new Date(nowMs).toISOString();
    const endsAt = new Date(nowMs + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const dailyEarning = Math.round(price * (dailyRatePercent / 100) * 100) / 100;
    const totalTargetEarnings = Math.round(dailyEarning * durationDays * 100) / 100;

    dash.walletBalance = Math.round((dash.walletBalance - price) * 100) / 100;
    const tx: WalletTxItem = {
      id: `tx_inv_buy_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      walletType: 'wallet',
      kind: 'withdraw',
      amount: -price,
      note: `Invest plan activated: ${product.title} (${dailyRatePercent}%/day × ${durationDays}d)`,
      counterparty: 'Choy Invest',
      createdAt: startedAt,
    };
    dash.transactions = [tx, ...dash.transactions].slice(0, 60);
    const savedDash = await store.saveUserDashboard(dash);

    const newInvestment: StoredUserInvestment = {
      id: `inv_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      userId: user.id,
      userName: user.name,
      productId: product.id,
      productTitle: product.title,
      principalAmount: price,
      dailyRatePercent,
      durationDays,
      dailyEarning,
      totalTargetEarnings,
      claimedEarnings: 0,
      startedAt,
      endsAt,
    };

    const existing = await store.listUserInvestments();
    const allSaved = await store.saveUserInvestments([newInvestment, ...existing]);
    const myInvestments = allSaved
      .filter((inv) => inv.userId === user.id)
      .map((inv) => serializeUserInvestmentForMember(inv, nowMs));

    broadcastSync('invest');
    broadcastSync('users');

    return res.status(201).json({
      ok: true,
      serverTime: startedAt,
      investment: serializeUserInvestmentForMember(newInvestment, nowMs),
      investments: myInvestments,
      userDashboard: savedDash,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to activate investment plan.' });
  } finally {
    investBuyInFlight.delete(user.id);
  }
});

app.post('/api/choy/invest/claim', requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.choyUser!;
  if (investClaimInFlight.has(user.id)) {
    return res.status(409).json({ error: 'Earnings claim is already in progress. Please wait.' });
  }
  investClaimInFlight.add(user.id);
  try {
    const programsConfig = await store.getChoyProgramsConfig();
    const investEnabled = programsConfig.featureToggles?.invest !== false;
    if (!investEnabled && user.role !== 'admin') {
      return res.status(403).json({ error: 'Invest is currently disabled by Admin (Coming Soon).' });
    }

    const targetInvestmentId = typeof req.body?.investmentId === 'string' ? req.body.investmentId.trim() : '';
    const allInvestments = await store.listUserInvestments();
    const nowMs = Date.now();
    let totalClaimedNow = 0;
    let claimedCount = 0;

    const updatedAll = allInvestments.map((inv) => {
      if (inv.userId !== user.id) return inv;
      if (targetInvestmentId && inv.id !== targetInvestmentId) return inv;
      const metrics = computeInvestmentLiveMetrics(inv, nowMs);
      if (metrics.claimableNow >= 0.01) {
        totalClaimedNow = Math.round((totalClaimedNow + metrics.claimableNow) * 100) / 100;
        claimedCount += 1;
        return {
          ...inv,
          claimedEarnings: Math.min(
            inv.totalTargetEarnings,
            Math.round((inv.claimedEarnings + metrics.claimableNow) * 100) / 100
          ),
        };
      }
      return inv;
    });

    if (totalClaimedNow < 0.01 || claimedCount === 0) {
      return res.status(400).json({
        error: 'Wait for at least ₱0.01 in live per-minute earnings to accumulate before claiming.',
      });
    }

    const dash = await store.getUserDashboard(user.id);
    dash.walletBalance = Math.round((dash.walletBalance + totalClaimedNow) * 100) / 100;
    const nowIso = new Date(nowMs).toISOString();
    const tx: WalletTxItem = {
      id: `tx_inv_clm_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      walletType: 'wallet',
      kind: 'reward',
      amount: totalClaimedNow,
      note:
        claimedCount === 1
          ? `Invest live earnings claimed (+₱${totalClaimedNow.toFixed(2)})`
          : `Invest live earnings claimed across ${claimedCount} plans (+₱${totalClaimedNow.toFixed(2)})`,
      counterparty: 'Choy Invest',
      createdAt: nowIso,
    };
    dash.transactions = [tx, ...dash.transactions].slice(0, 60);

    const savedAll = await store.saveUserInvestments(updatedAll);
    const savedDash = await store.saveUserDashboard(dash);

    const myInvestments = savedAll
      .filter((inv) => inv.userId === user.id)
      .map((inv) => serializeUserInvestmentForMember(inv, nowMs));

    broadcastSync('invest');
    broadcastSync('users');

    return res.json({
      ok: true,
      claimedAmount: totalClaimedNow,
      serverTime: nowIso,
      investments: myInvestments,
      userDashboard: savedDash,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to claim live earnings.' });
  } finally {
    investClaimInFlight.delete(user.id);
  }
});

app.get('/api/choy/admin/invest/overview', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const programsConfig = await store.getChoyProgramsConfig();
    const products = await store.listInvestProducts();
    const allInvestments = await store.listUserInvestments();
    const nowMs = Date.now();
    const investments = allInvestments.map((inv) => ({
      ...inv,
      ...computeInvestmentLiveMetrics(inv, nowMs),
    }));

    return res.json({
      ok: true,
      investEnabled: programsConfig.featureToggles?.invest !== false,
      serverTime: new Date(nowMs).toISOString(),
      products,
      investments,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Admin Invest overview.' });
  }
});

app.post('/api/choy/admin/invest/products', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const idRaw = typeof req.body?.id === 'string' ? req.body.id.trim().slice(0, 80) : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 100) : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 260) : '';
    const badge = typeof req.body?.badge === 'string' ? req.body.badge.trim().slice(0, 40) : '';
    const price = Math.round(Number(req.body?.price) * 100) / 100;
    const dailyRatePercent =
      req.body?.dailyRatePercent === undefined || req.body?.dailyRatePercent === ''
        ? 5
        : Math.round(Number(req.body?.dailyRatePercent) * 100) / 100;
    const durationDays =
      req.body?.durationDays === undefined || req.body?.durationDays === ''
        ? 30
        : Math.floor(Number(req.body?.durationDays));
    const active = req.body?.active !== false;

    if (!title) {
      return res.status(400).json({ error: 'Product title is required.' });
    }
    if (!Number.isFinite(price) || price < 10 || price > 10_000_000) {
      return res.status(400).json({ error: 'Price must be between ₱10 and ₱10,000,000.' });
    }
    if (!Number.isFinite(dailyRatePercent) || dailyRatePercent < 0.1 || dailyRatePercent > 50) {
      return res.status(400).json({ error: 'Daily rate must be between 0.1% and 50%.' });
    }
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
      return res.status(400).json({ error: 'Duration must be between 1 and 365 days.' });
    }

    const now = new Date().toISOString();
    const existing = await store.listInvestProducts();
    const existingIdx = idRaw ? existing.findIndex((p) => p.id === idRaw) : -1;

    let nextProducts: StoredInvestProduct[];
    let savedProduct: StoredInvestProduct;

    if (existingIdx >= 0) {
      savedProduct = {
        ...existing[existingIdx],
        title,
        description: description || `${dailyRatePercent}% daily simple interest for ${durationDays} days.`,
        price,
        dailyRatePercent,
        durationDays,
        badge: badge || undefined,
        active,
        updatedAt: now,
      };
      nextProducts = existing.map((p, idx) => (idx === existingIdx ? savedProduct : p));
    } else {
      savedProduct = {
        id: `inv_prod_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        title,
        description: description || `${dailyRatePercent}% daily simple interest for ${durationDays} days.`,
        price,
        dailyRatePercent,
        durationDays,
        badge: badge || undefined,
        active,
        createdAt: now,
        updatedAt: now,
      };
      nextProducts = [...existing, savedProduct];
    }

    const products = await store.saveInvestProducts(nextProducts);
    broadcastSync('invest');
    return res.status(existingIdx >= 0 ? 200 : 201).json({ ok: true, product: savedProduct, products });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save investment product.' });
  }
});

app.delete('/api/choy/admin/invest/products/:id', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    const existing = await store.listInvestProducts();
    if (!existing.some((p) => p.id === id)) {
      return res.status(404).json({ error: 'Investment product not found.' });
    }
    const products = await store.saveInvestProducts(existing.filter((p) => p.id !== id));
    broadcastSync('invest');
    return res.json({ ok: true, products });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete investment product.' });
  }
});

async function finalizePaymentTerminalTransaction(
  txId: string,
  nextStatus: 'approved' | 'rejected',
  actorName: string,
  rejectionReason?: string,
  requestingUserId?: string
): Promise<{
  ok: true;
  transaction: StoredPaymentTerminalTx;
  ownDashboard?: Awaited<ReturnType<typeof store.getUserDashboard>>;
} | {
  ok: false;
  statusCode: number;
  error: string;
}> {
  if (terminalReviewInFlight.has(txId)) {
    return { ok: false, statusCode: 409, error: 'Transaction is currently being processed. Please wait.' };
  }
  terminalReviewInFlight.add(txId);
  try {
    const existing = await store.getPaymentTerminalTransactionById(txId);
    if (!existing) {
      return { ok: false, statusCode: 404, error: 'Payment transaction not found.' };
    }
    if (existing.status !== 'pending' || existing.creditedAt) {
      return { ok: false, statusCode: 400, error: 'This transaction has already been finalized.' };
    }

    const now = new Date().toISOString();
    const updatedTx: StoredPaymentTerminalTx = {
      ...existing,
      status: nextStatus,
      reviewedBy: actorName,
      reviewedAt: now,
      rejectionReason: nextStatus === 'rejected' ? rejectionReason || 'Rejected by Admin' : undefined,
    };

    let updatedOwnDashboard: Awaited<ReturnType<typeof store.getUserDashboard>> | undefined = undefined;

    if (nextStatus === 'approved' && (existing.purpose === 'wallet_topup' || existing.purpose === 'choy_coins')) {
      const targetDash = await store.getUserDashboard(existing.userId);
      const makeWalletTxId = () => `tx_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      const prependTx = (list: WalletTxItem[], item: WalletTxItem): WalletTxItem[] => [item, ...list].slice(0, 60);

      if (existing.purpose === 'wallet_topup') {
        targetDash.walletBalance = Math.round((targetDash.walletBalance + existing.amountPhp) * 100) / 100;
        targetDash.transactions = prependTx(targetDash.transactions, {
          id: makeWalletTxId(),
          walletType: 'wallet',
          kind: 'topup',
          amount: existing.amountPhp,
          note: `Payment Terminal Top-Up (${existing.referenceCode})`,
          createdAt: now,
        });
      } else if (existing.purpose === 'choy_coins') {
        const programs = await store.getChoyProgramsConfig();
        const coinsToCredit =
          existing.choyCoinsPreview > 0
            ? existing.choyCoinsPreview
            : Math.round(existing.amountPhp * (programs.choyWallet?.conversionRate || 2) * 100) / 100;
        targetDash.choyWalletBalance = Math.round((targetDash.choyWalletBalance + coinsToCredit) * 100) / 100;
        targetDash.transactions = prependTx(targetDash.transactions, {
          id: makeWalletTxId(),
          walletType: 'choy_wallet',
          kind: 'topup',
          amount: coinsToCredit,
          note: `Payment Terminal CHOY Coins (${existing.referenceCode})`,
          createdAt: now,
        });
      }

      const savedDash = await store.saveUserDashboard(targetDash);
      updatedTx.creditedAt = now;
      if (requestingUserId && existing.userId === requestingUserId) {
        updatedOwnDashboard = savedDash;
      }
    }

    await store.savePaymentTerminalTransaction(updatedTx);
    broadcastSync('payment_terminal');
    broadcastSync('users');

    return { ok: true, transaction: updatedTx, ownDashboard: updatedOwnDashboard };
  } finally {
    terminalReviewInFlight.delete(txId);
  }
}

function resolveTrustedAppBaseUrl(req: Request): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (configured.startsWith('https://') || configured.startsWith('http://')) {
    return configured;
  }
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  if (forwardedHost && /^[a-zA-Z0-9.-]+(:\d+)?$/.test(forwardedHost)) {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const proto = forwardedProto === 'http' ? 'http' : 'https';
    return `${proto}://${forwardedHost}`;
  }
  return 'http://localhost:3000';
}

app.get('/api/choy/payment-terminal/config', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    const config = await store.getPaymentTerminalConfig();
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const stripeConfigured = Boolean(stripeKey);
    const stripeConfigIdConfigured = Boolean((process.env.STRIPE_CONFIG_ID || '').trim());
    const stripePublishableKeyConfigured = Boolean(
      (process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '').trim()
    );
    const stripeWebhookConfigured = Boolean((process.env.STRIPE_WEBHOOK_SECRET || '').trim());
    const stripeMode = stripeKey.startsWith('sk_live_')
      ? 'live'
      : stripeKey.startsWith('sk_test_')
      ? 'test'
      : stripeConfigured
      ? 'custom'
      : 'unconfigured';
    const paymongoConfigured = Boolean((process.env.PAYMONGO_SECRET_KEY || '').trim());
    return res.json({
      config,
      stripeConfigured,
      stripeConfigIdConfigured,
      stripePublishableKeyConfigured,
      stripeWebhookConfigured,
      stripeMode,
      paymongoConfigured,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load payment terminal config' });
  }
});

app.put('/api/choy/admin/payment-terminal/config', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const sanitized = sanitizePaymentTerminalConfig(req.body);
    const saved = await store.savePaymentTerminalConfig(sanitized);
    broadcastSync('payment_terminal');
    return res.json({ ok: true, config: saved });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save payment terminal config' });
  }
});

app.get('/api/choy/payment-terminal/transactions', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const all = await store.listPaymentTerminalTransactions();
    const transactions = user.role === 'admin' ? all : all.filter((tx) => tx.userId === user.id);
    return res.json({ transactions });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load payment transactions' });
  }
});

app.post('/api/choy/payment-terminal/charge', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const config = await store.getPaymentTerminalConfig();
    if (!config.enabled && user.role !== 'admin') {
      return res.status(503).json({ error: 'Online Payment Terminal is currently paused by Admin.' });
    }

    const rawPurpose = String(req.body?.purpose || 'wallet_topup').trim();
    const validPurposes: PaymentTerminalPurpose[] = ['wallet_topup', 'choy_coins', 'order_payment', 'pos_payment'];
    if (!validPurposes.includes(rawPurpose as PaymentTerminalPurpose)) {
      return res.status(400).json({ error: 'Invalid payment purpose.' });
    }
    const purpose = rawPurpose as PaymentTerminalPurpose;

    const rawChannel = String(req.body?.channel || 'gcash').trim();
    const validChannels: PaymentTerminalChannelId[] = ['gcash', 'maya', 'qrph', 'bank_transfer', 'online_card'];
    if (!validChannels.includes(rawChannel as PaymentTerminalChannelId)) {
      return res.status(400).json({ error: 'Invalid online payment channel.' });
    }
    const channel = rawChannel as PaymentTerminalChannelId;

    const channelEnabledMap: Record<PaymentTerminalChannelId, boolean> = {
      gcash: config.gcashEnabled,
      maya: config.mayaEnabled,
      qrph: config.qrphEnabled,
      bank_transfer: config.bankEnabled,
      online_card: config.onlineCardEnabled,
    };
    if (!channelEnabledMap[channel]) {
      return res.status(400).json({ error: 'Selected payment channel is currently disabled by Admin.' });
    }

    const amountPhp = Math.round(Number(req.body?.amountPhp) * 100) / 100;
    if (!Number.isFinite(amountPhp) || amountPhp < config.minAmountPhp || amountPhp > config.maxAmountPhp) {
      return res.status(400).json({
        error: `Enter an amount between ₱${config.minAmountPhp.toLocaleString()} and ₱${config.maxAmountPhp.toLocaleString()}.`,
      });
    }

    const feePhp = Math.round(((amountPhp * config.convenienceFeePercent) / 100) * 100) / 100;
    const totalPhp = Math.round((amountPhp + feePhp) * 100) / 100;

    const programs = await store.getChoyProgramsConfig();
    const conversionRate = programs.choyWallet?.conversionRate || 2;
    const choyCoinsPreview = purpose === 'choy_coins' ? Math.round(amountPhp * conversionRate * 100) / 100 : 0;

    let payerReference =
      typeof req.body?.payerReference === 'string' ? req.body.payerReference.trim().slice(0, 80) : '';
    const customerName =
      typeof req.body?.customerName === 'string' && req.body.customerName.trim()
        ? req.body.customerName.trim().slice(0, 80)
        : user.name;
    const customerContact =
      typeof req.body?.customerContact === 'string' && req.body.customerContact.trim()
        ? req.body.customerContact.trim().slice(0, 40)
        : user.phone || '';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 240) : '';
    const receiptImageUrl = sanitizeTerminalReceiptUrl(req.body?.receiptImageUrl);

    if (channel !== 'online_card' && !payerReference && !receiptImageUrl) {
      return res.status(400).json({
        error: 'Please enter your payment Reference Number or upload a payment receipt screenshot.',
      });
    }

    const now = new Date().toISOString();
    const refSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const referenceCode = `CHOY-${Date.now().toString(36).toUpperCase().slice(-6)}-${refSuffix}`;
    const txId = `ptx_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

    let checkoutUrl: string | undefined;
    let gatewayNotice: string | undefined;
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const stripeConfigId = (process.env.STRIPE_CONFIG_ID || '').trim();

    if (channel === 'online_card' && stripeKey) {
      try {
        const purposeLabels: Record<PaymentTerminalPurpose, string> = {
          wallet_topup: 'Choy Cash Wallet Top-Up',
          choy_coins: 'Choy Coins Purchase',
          order_payment: 'Choy Marketplace Order Payment',
          pos_payment: 'Choy POS Direct Payment',
        };
        const appUrl = resolveTrustedAppBaseUrl(req);
        const unitAmountCentavos = Math.round(totalPhp * 100);

        const params = new URLSearchParams();
        params.set('mode', 'payment');
        params.set('client_reference_id', referenceCode);
        params.set(
          'success_url',
          `${appUrl}/?stripe_tx=${encodeURIComponent(txId)}&stripe_session_id={CHECKOUT_SESSION_ID}`
        );
        params.set('cancel_url', `${appUrl}/?stripe_cancelled=1&stripe_tx=${encodeURIComponent(txId)}`);
        params.set('line_items[0][price_data][currency]', 'php');
        params.set('line_items[0][price_data][unit_amount]', String(unitAmountCentavos));
        params.set('line_items[0][price_data][product_data][name]', `${purposeLabels[purpose]} (${referenceCode})`);
        params.set(
          'line_items[0][price_data][product_data][description]',
          note ? `${config.merchantName} • ${note}` : `${config.merchantName} • Terminal ${config.terminalId}`
        );
        params.set('line_items[0][quantity]', '1');
        params.set('metadata[txId]', txId);
        params.set('metadata[referenceCode]', referenceCode);
        params.set('metadata[userId]', user.id);
        params.set('metadata[purpose]', purpose);
        params.set('metadata[customerName]', customerName);

        if (stripeConfigId.startsWith('pmc_')) {
          params.set('payment_method_configuration', stripeConfigId);
        } else {
          params.set('payment_method_types[0]', 'card');
        }

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const stripeData = (await stripeRes.json().catch(() => ({}))) as {
          id?: string;
          url?: string;
          error?: { message?: string };
        };

        if (stripeRes.ok && typeof stripeData.url === 'string' && stripeData.url.startsWith('https://')) {
          checkoutUrl = stripeData.url;
          if (typeof stripeData.id === 'string' && /^cs_(test|live)_[a-zA-Z0-9_]+$/.test(stripeData.id)) {
            payerReference = stripeData.id;
          }
          gatewayNotice = 'Stripe Checkout session ready! Open Stripe Checkout to complete your secure payment.';
        } else {
          const reason = stripeData.error?.message || `HTTP ${stripeRes.status}`;
          await store.appendErrorLog({
            source: 'stripe_webhook',
            severity: 'error',
            message: `Stripe Checkout session creation failed for ${referenceCode}: ${reason}`,
          });
          gatewayNotice = `Stripe Checkout could not be initialized (${reason}); payment logged as pending for verification.`;
        }
      } catch (err: unknown) {
        await store.appendErrorLog({
          source: 'stripe_webhook',
          severity: 'error',
          message: `Stripe API unreachable for ${referenceCode}: ${err instanceof Error ? err.message : 'Network error'}`,
        });
        gatewayNotice = 'Stripe gateway unreachable right now; payment logged as pending for manual verification.';
      }
    }

    const newTx: StoredPaymentTerminalTx = {
      id: txId,
      referenceCode,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      purpose,
      channel,
      amountPhp,
      feePhp,
      totalPhp,
      choyCoinsPreview,
      payerReference,
      customerName,
      customerContact,
      note,
      receiptImageUrl,
      checkoutUrl,
      status: 'pending',
      createdAt: now,
    };

    await store.savePaymentTerminalTransaction(newTx);
    broadcastSync('payment_terminal');

    return res.status(201).json({
      ok: true,
      transaction: newTx,
      gatewayNotice,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create payment transaction' });
  }
});

app.post(
  '/api/choy/payment-terminal/transactions/:id/verify-stripe',
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.choyUser!;
      const txId = String(req.params.id || '').trim();
      if (!txId) {
        return res.status(400).json({ error: 'Transaction ID is required.' });
      }
      const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
      if (!stripeKey) {
        return res.status(503).json({ error: 'Stripe is not configured on the server.' });
      }

      const existing = await store.getPaymentTerminalTransactionById(txId);
      if (!existing) {
        return res.status(404).json({ error: 'Payment transaction not found.' });
      }
      if (existing.userId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to verify this transaction.' });
      }
      if (existing.status === 'approved') {
        const ownDashboard = existing.userId === user.id ? await store.getUserDashboard(user.id) : undefined;
        return res.json({ ok: true, paid: true, transaction: existing, ownDashboard });
      }
      if (existing.status === 'rejected') {
        return res.status(400).json({ error: 'This transaction was already rejected.' });
      }

      const candidateSessionId = String(existing.payerReference || req.body?.sessionId || '').trim();
      if (!/^cs_(test|live)_[a-zA-Z0-9_]+$/.test(candidateSessionId)) {
        return res.status(400).json({ error: 'No valid Stripe Checkout Session is linked to this transaction.' });
      }

      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(candidateSessionId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
          },
        }
      );
      const sessionData = (await stripeRes.json().catch(() => ({}))) as {
        id?: string;
        payment_status?: string;
        status?: string;
        amount_total?: number;
        currency?: string;
        metadata?: Record<string, string>;
        error?: { message?: string };
      };

      if (!stripeRes.ok) {
        return res.status(502).json({
          error: sessionData.error?.message || 'Could not retrieve Stripe Checkout Session status.',
        });
      }

      const metaTxId = String(sessionData.metadata?.txId || '').trim();
      const metaUserId = String(sessionData.metadata?.userId || '').trim();
      const expectedCentavos = Math.round(existing.totalPhp * 100);
      const currencyOk = String(sessionData.currency || '').toLowerCase() === 'php';

      if (metaTxId !== existing.id || metaUserId !== existing.userId || !currencyOk) {
        return res.status(400).json({ error: 'Stripe Checkout Session does not match this payment transaction.' });
      }

      if (sessionData.payment_status === 'paid' && Number(sessionData.amount_total) === expectedCentavos) {
        const result = await finalizePaymentTerminalTransaction(
          existing.id,
          'approved',
          'Stripe Checkout',
          undefined,
          user.id
        );
        if (!result.ok) {
          const refreshed = await store.getPaymentTerminalTransactionById(existing.id);
          if (refreshed?.status === 'approved') {
            const ownDashboard = refreshed.userId === user.id ? await store.getUserDashboard(user.id) : undefined;
            return res.json({ ok: true, paid: true, transaction: refreshed, ownDashboard });
          }
          return res.status(result.statusCode).json({ error: result.error });
        }
        return res.json({
          ok: true,
          paid: true,
          transaction: result.transaction,
          ownDashboard: result.ownDashboard,
        });
      }

      return res.json({
        ok: true,
        paid: false,
        paymentStatus: sessionData.payment_status || sessionData.status || 'unpaid',
        transaction: existing,
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to verify Stripe payment.' });
    }
  }
);

app.post(
  '/api/choy/admin/payment-terminal/transactions/:id/status',
  requireAuth,
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    const txId = String(req.params.id || '').trim();
    if (!txId) {
      return res.status(400).json({ error: 'Transaction ID is required.' });
    }
    try {
      const admin = req.choyUser!;
      const nextStatus = req.body?.status === 'approved' ? 'approved' : req.body?.status === 'rejected' ? 'rejected' : '';
      if (!nextStatus) {
        return res.status(400).json({ error: 'Status must be approved or rejected.' });
      }
      const rejectionReason =
        typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim().slice(0, 200) : '';

      const result = await finalizePaymentTerminalTransaction(
        txId,
        nextStatus,
        admin.name,
        rejectionReason,
        admin.id
      );
      if (!result.ok) {
        return res.status(result.statusCode).json({ error: result.error });
      }

      return res.json({
        ok: true,
        transaction: result.transaction,
        ownDashboard: result.ownDashboard,
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update payment status' });
    }
  }
);

// ============================================================================
// WELCOME GREETING VOICE TTS ("WELCOME TO CHOY CHAT")
// ============================================================================
let cachedWelcomeWav: Buffer | null = null;

app.get('/api/tts/welcome', requireAuth, async (_req: AuthedRequest, res: Response) => {
  try {
    if (cachedWelcomeWav) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.send(cachedWelcomeWav);
    }
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({ error: 'Voice synthesis API key not configured; use browser speech fallback.' });
    }
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Welcome to Choy Chat!',
              speechMetadata: {
                style: 'Warm, cheerful, upbeat, welcoming host greeting',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({ error: 'TTS response returned empty audio.' });
    }
    cachedWelcomeWav = Buffer.from(base64Audio, 'base64');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.send(cachedWelcomeWav);
  } catch (err: unknown) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Could not synthesize welcome voice.',
    });
  }
});

// ============================================================================
// GAMES AUTO-CREDIT WINNER WALLET & SETTLEMENT SYNC
// ============================================================================
app.post('/api/choy/games/credit-win', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const actor = req.choyUser!;
    const requestedTargetId =
      actor.role === 'admin' && typeof req.body?.targetUserId === 'string' && req.body.targetUserId.trim()
        ? req.body.targetUserId.trim()
        : actor.id;
    const amountPhp = Math.round(Number(req.body?.amountPhp) * 100) / 100;
    const gameLabel = String(req.body?.gameLabel || 'Game Win').trim().slice(0, 80);
    const note = String(req.body?.note || '').trim().slice(0, 180);

    if (!Number.isFinite(amountPhp) || amountPhp <= 0 || amountPhp > 500000) {
      return res.status(400).json({ error: 'Invalid payout amount.' });
    }

    const dash = await store.getUserDashboard(requestedTargetId);
    const now = new Date().toISOString();
    dash.walletBalance = Math.round((dash.walletBalance + amountPhp) * 100) / 100;
    dash.transactions = [
      {
        id: `gwin_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
        walletType: 'wallet' as const,
        kind: 'reward' as const,
        amount: amountPhp,
        note: note || `${gameLabel} Auto-Credit Payout`,
        createdAt: now,
      },
      ...dash.transactions,
    ].slice(0, 60);

    const saved = await store.saveUserDashboard(dash);
    broadcastSync('users');
    const { withdrawalPinHash: _hidden, ...safeDash } = saved;
    return res.json({
      ok: true,
      creditedUserId: requestedTargetId,
      ownDashboard: requestedTargetId === actor.id ? safeDash : undefined,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to credit game payout.' });
  }
});

// ============================================================================
// EMPLOYEE DTR SUBSCRIPTION (30-DAY FREE TRIAL + AUTO-DEDUCT) & WORKSPACE APIs
// ============================================================================
const DTR_PLAN_CATALOG = {
  starter: { label: 'Starter Plan', pricePhp: 299, maxEmployees: 20 },
  pro: { label: 'Pro Plan', pricePhp: 799, maxEmployees: 50 },
  enterprise: { label: 'Enterprise Plan', pricePhp: 1299, maxEmployees: Infinity },
} as const;

async function processDueTrialAutoDeduct(userId: string) {
  const dash = await store.getUserDashboard(userId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let changed = false;

  // Check General Choy Subscription trial auto-deduct
  if (
    dash.subscriptionStatus === 'trialing' &&
    dash.subscriptionAutoRenew &&
    dash.subscriptionTrialEndsAt &&
    Date.parse(dash.subscriptionTrialEndsAt) <= nowMs
  ) {
    const programsCfg = await store.getChoyProgramsConfig();
    const pricePhp =
      dash.subscriptionPlan === 'choy_pro_annual'
        ? programsCfg.choyPro.annualPhp
        : dash.subscriptionPlan === 'vip_supporter'
        ? programsCfg.choyPro.vipPhp
        : programsCfg.choyPro.monthlyPhp;
    if (dash.walletBalance >= pricePhp) {
      dash.walletBalance = Math.round((dash.walletBalance - pricePhp) * 100) / 100;
      dash.subscriptionStatus = 'active';
      dash.subscriptionRenewAt = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();
      dash.transactions = [
        {
          id: `sub_auto_${Date.now().toString(36)}`,
          walletType: 'wallet' as const,
          kind: 'subscription' as const,
          amount: -pricePhp,
          note: `Auto-Deduct after Free Trial (${dash.subscriptionPlan})`,
          createdAt: nowIso,
        },
        ...dash.transactions,
      ].slice(0, 60);
      changed = true;
    }
  }

  // Check Employee DTR 30-day free trial auto-deduct
  const dtrSub = dash.dtrSubscription;
  if (
    dtrSub &&
    dtrSub.status === 'trialing' &&
    dtrSub.autoDeduct &&
    dtrSub.trialEndsAt &&
    Date.parse(dtrSub.trialEndsAt) <= nowMs
  ) {
    const meta = DTR_PLAN_CATALOG[dtrSub.plan] || DTR_PLAN_CATALOG.starter;
    if (dash.walletBalance >= meta.pricePhp) {
      dash.walletBalance = Math.round((dash.walletBalance - meta.pricePhp) * 100) / 100;
      dash.dtrSubscription = {
        ...dtrSub,
        status: 'active',
        lastBilledAt: nowIso,
        nextBillingAt: new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      dash.transactions = [
        {
          id: `dtr_auto_${Date.now().toString(36)}`,
          walletType: 'wallet' as const,
          kind: 'subscription' as const,
          amount: -meta.pricePhp,
          note: `Employee DTR Auto-Deduct after 30-Day Free Trial (${meta.label})`,
          createdAt: nowIso,
        },
        ...dash.transactions,
      ].slice(0, 60);
      changed = true;
    }
  }

  if (changed) {
    return store.saveUserDashboard(dash);
  }
  return dash;
}

app.get('/api/choy/dtr/state', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const dash = await processDueTrialAutoDeduct(user.id);
    const { withdrawalPinHash: _hidden, ...safeDash } = dash;
    return res.json({
      ok: true,
      dtrSubscription: dash.dtrSubscription || null,
      dtrEmployees: dash.dtrEmployees || [],
      ownDashboard: safeDash,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Employee DTR state.' });
  }
});

app.post('/api/choy/dtr/subscription', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const rawPlan = String(req.body?.plan || 'starter').trim();
    const plan: 'starter' | 'pro' | 'enterprise' =
      rawPlan === 'pro' || rawPlan === 'enterprise' ? rawPlan : 'starter';
    const paymentMethod: 'stripe_card' | 'gcash' = req.body?.paymentMethod === 'gcash' ? 'gcash' : 'stripe_card';
    const paymentDetails = String(req.body?.paymentDetails || '').trim().slice(0, 100);
    if (!paymentDetails) {
      return res.status(400).json({
        error: 'Please fill up your Card or GCash payment details before starting your 30-day free trial.',
      });
    }

    const dash = await store.getUserDashboard(user.id);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const trialEndsIso = new Date(nowMs + 30 * 24 * 60 * 60 * 1000).toISOString();
    const meta = DTR_PLAN_CATALOG[plan];

    dash.dtrSubscription = {
      plan,
      status: 'trialing',
      paymentMethod,
      paymentDetails,
      trialStartedAt: nowIso,
      trialEndsAt: trialEndsIso,
      nextBillingAt: trialEndsIso,
      autoDeduct: true,
    };
    dash.transactions = [
      {
        id: `dtr_trial_${Date.now().toString(36)}`,
        walletType: 'wallet' as const,
        kind: 'subscription' as const,
        amount: 0,
        note: `Employee DTR ${meta.label} 30-Day Free Trial (Due Today ₱0 • ₱${meta.pricePhp}/mo after trial via ${paymentMethod === 'gcash' ? 'GCash' : 'Stripe Card'})`,
        createdAt: nowIso,
      },
      ...dash.transactions,
    ].slice(0, 60);

    const saved = await store.saveUserDashboard(dash);
    const { withdrawalPinHash: _hidden, ...safeDash } = saved;
    return res.json({
      ok: true,
      dtrSubscription: saved.dtrSubscription,
      ownDashboard: safeDash,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start DTR trial.' });
  }
});

app.post('/api/choy/dtr/cancel', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const dash = await store.getUserDashboard(user.id);
    const nowIso = new Date().toISOString();
    if (dash.dtrSubscription) {
      dash.dtrSubscription = {
        ...dash.dtrSubscription,
        status: 'cancelled',
        autoDeduct: false,
        cancelledAt: nowIso,
      };
    }
    const saved = await store.saveUserDashboard(dash);
    const { withdrawalPinHash: _hidden, ...safeDash } = saved;
    return res.json({
      ok: true,
      dtrSubscription: saved.dtrSubscription || null,
      ownDashboard: safeDash,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to cancel DTR subscription.' });
  }
});

app.post('/api/choy/dtr/save', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.choyUser!;
    const dash = await store.getUserDashboard(user.id);
    const sub = dash.dtrSubscription;
    const isAllowed = user.role === 'admin' || (sub && (sub.status === 'trialing' || sub.status === 'active'));
    if (!isAllowed) {
      return res.status(403).json({ error: 'Start your 30-day Employee DTR free trial first to save records.' });
    }
    const rawEmployees = Array.isArray(req.body?.employees) ? req.body.employees : [];
    const maxAllowed =
      user.role === 'admin'
        ? Infinity
        : DTR_PLAN_CATALOG[sub?.plan || 'starter']?.maxEmployees ?? 20;
    if (rawEmployees.length > maxAllowed) {
      return res.status(400).json({
        error: `Your current plan allows up to ${maxAllowed} employees. Upgrade to Pro (50) or Enterprise (Unlimited).`,
      });
    }

    const nowIso = new Date().toISOString();
    const sanitizedEmployees = rawEmployees.slice(0, 500).map((emp: Record<string, unknown>, idx: number) => {
      const completeName = String(emp?.completeName || '').trim().slice(0, 120);
      const dateHired = String(emp?.dateHired || '').trim().slice(0, 30);
      const position = String(emp?.position || '').trim().slice(0, 80);
      const dailyRateRaw = Number(emp?.dailyRate);
      const dailyRate = Number.isFinite(dailyRateRaw) && dailyRateRaw > 0 && dailyRateRaw <= 50000 ? dailyRateRaw : 435;
      const monthsObj =
        emp?.months && typeof emp.months === 'object' && !Array.isArray(emp.months)
          ? (emp.months as Record<string, Record<string, Record<string, number>>>)
          : {};
      return {
        id: String(emp?.id || `emp_${Date.now()}_${idx}`).slice(0, 64),
        completeName: completeName || `Employee ${idx + 1}`,
        dateHired: dateHired || nowIso.slice(0, 10),
        position: position || undefined,
        dailyRate,
        months: monthsObj,
        updatedAt: nowIso,
      };
    });

    dash.dtrEmployees = sanitizedEmployees;
    const saved = await store.saveUserDashboard(dash);
    return res.json({
      ok: true,
      dtrEmployees: saved.dtrEmployees || [],
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save DTR data.' });
  }
});

// ============================================================================
// ADMIN SECURITY STUDIO: AUTO-SYNCED PROJECT CODE EXPLORER & .ENV KEY GUIDE
// ============================================================================
const PROJECT_ROOT_DIR = path.resolve(process.cwd());
const CODE_EXPLORER_DENY_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.git',
  'node_modules',
]);

function isSafeProjectRelativePath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.includes('..') || norm.includes('\0')) return false;
  const parts = norm.split('/');
  for (const part of parts) {
    if (CODE_EXPLORER_DENY_NAMES.has(part.toLowerCase())) return false;
    if (part.toLowerCase().startsWith('.env') && part.toLowerCase() !== '.env.example') return false;
    if (/\.(pem|key|p12|pfx|crt)$/i.test(part)) return false;
  }
  const resolved = path.resolve(PROJECT_ROOT_DIR, norm);
  return resolved === PROJECT_ROOT_DIR || resolved.startsWith(PROJECT_ROOT_DIR + path.sep);
}

function scanCategoryFiles(dirRel: string, maxFiles = 120): string[] {
  const absDir = path.resolve(PROJECT_ROOT_DIR, dirRel);
  if (!absDir.startsWith(PROJECT_ROOT_DIR + path.sep) && absDir !== PROJECT_ROOT_DIR) return [];
  if (!fs.existsSync(absDir)) return [];
  const results: string[] = [];
  const walk = (currAbs: string, currRel: string, depth: number) => {
    if (depth > 4 || results.length >= maxFiles) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currAbs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const lower = entry.name.toLowerCase();
      if (CODE_EXPLORER_DENY_NAMES.has(lower)) continue;
      if (lower.startsWith('.env') && lower !== '.env.example') continue;
      const nextRel = currRel ? `${currRel}/${entry.name}` : entry.name;
      const nextAbs = path.join(currAbs, entry.name);
      if (entry.isDirectory()) {
        walk(nextAbs, nextRel, depth + 1);
      } else if (entry.isFile()) {
        results.push(nextRel);
      }
    }
  };
  walk(absDir, dirRel, 0);
  return results;
}

app.get('/api/admin/project-code/tree', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const rootKnownFiles = [
      '.env.example',
      '.gitignore',
      '.npmrc',
      'bun.lock',
      'Dockerfile',
      'eslint.config.js',
      'firebase-applet-config.json',
      'firebase-blueprint.json',
      'firestore.rules',
      'index.html',
      'metadata.json',
      'package-lock.json',
      'package.json',
      'render.yaml',
      'security.spec.md',
      'server.ts',
      'server.js',
      'tsconfig.json',
      'vite.config.ts',
    ];
    const existingRootEntries = fs
      .readdirSync(PROJECT_ROOT_DIR, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => isSafeProjectRelativePath(name))
      .sort();

    const srcRootFiles = fs.existsSync(path.join(PROJECT_ROOT_DIR, 'src'))
      ? fs
          .readdirSync(path.join(PROJECT_ROOT_DIR, 'src'), { withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => `src/${e.name}`)
          .sort()
      : [];

    const categories = [
      {
        id: 'aistudio',
        label: '.aistudio / Metadata & Specs',
        folderPath: 'metadata.json',
        purpose:
          'Nagkupot sa AI Studio app identity, permissions, security specs, ug Firebase blueprints (para asa: configuration sa AI Studio workspace ug app metadata).',
        files: existingRootEntries.filter((f) =>
          ['metadata.json', 'firebase-applet-config.json', 'firebase-blueprint.json', 'firestore.rules', 'security.spec.md'].includes(f)
        ),
      },
      {
        id: 'dev_dist',
        label: 'dist / Build Output',
        folderPath: 'dist',
        purpose:
          'Compiled production bundle gikan sa `npm run build` (para asa: diri gikuha sa Express server ang optimized HTML/JS/CSS inig deploy sa Render o live server).',
        files: scanCategoryFiles('dist', 40),
      },
      {
        id: 'public',
        label: 'public / Static & PWA Assets',
        folderPath: 'public',
        purpose:
          'Static files nga direkta ma-access sa browser sama sa PWA icons (`pwa-512x512.png`, `pwa-192x192.png`, `apple-touch-icon.png`, `favicon.ico`) ug static images.',
        files: scanCategoryFiles('public', 60),
      },
      {
        id: 'src_root',
        label: 'src / Core App Entry (App.tsx, firebase.ts, sw.ts)',
        folderPath: 'src',
        purpose:
          'Main frontend source files: `App.tsx` (main layout & navigation), `main.tsx` (React bootstrap & PWA register), `index.css` (Tailwind styles), `firebase.ts` (Firebase SDK), `sw.ts` (Service Worker), ug `themePresets.ts` (dark/light themes).',
        files: srcRootFiles,
      },
      {
        id: 'src_assets',
        label: 'src/assets / Generated Visuals',
        folderPath: 'src/assets',
        purpose:
          'High-resolution generated banners, PWA source graphics, table felt textures, ug cover photos nga gi-bundle ug gi-copy ngadto sa `dist/src/assets`.',
        files: scanCategoryFiles('src/assets', 40),
      },
      {
        id: 'src_components',
        label: 'src/components / UI Feature Modules',
        folderPath: 'src/components',
        purpose:
          'Tanan modular screens sa Choy Chat: Newsfeed, Payment Terminal, Games (Swertres/NBA/Tong-its), Employee DTR, User Dashboard, Admin Setup, ug Security Studio.',
        files: scanCategoryFiles('src/components', 80),
      },
      {
        id: 'src_data',
        label: 'src/data / Static Datasets',
        folderPath: 'src/data',
        purpose:
          'Structured reference data lists (episodes, presets, initial catalogs) nga gigamit sa UI components.',
        files: scanCategoryFiles('src/data', 40),
      },
      {
        id: 'src_hooks',
        label: 'src/hooks / Reusable React Hooks',
        folderPath: 'src/hooks',
        purpose:
          'Custom React hooks sama sa `usePWAInstall.ts` (install prompt & standalone detection) ug online/offline monitors.',
        files: scanCategoryFiles('src/hooks', 40),
      },
      {
        id: 'src_server',
        label: 'src/server / Database & Cloud Storage Drivers',
        folderPath: 'src/server',
        purpose:
          'Server-side database store (`choyStore.ts` para sa PostgreSQL/memory sync), Supabase storage (`supabaseStorage.ts`), ug Cloudflare R2 vault drivers.',
        files: scanCategoryFiles('src/server', 40),
      },
      {
        id: 'src_services_utils',
        label: 'src/services & src/utils / Helpers & Sync',
        folderPath: 'src/utils',
        purpose:
          'Helper utilities sama sa Welcome Voice greeting (`welcomeVoice.ts`), Emoji Link Share, ug Firebase Cloud Sync (`src/services`).',
        files: [...scanCategoryFiles('src/utils', 40), ...scanCategoryFiles('src/services', 40)],
      },
      {
        id: 'supabase_drizzle',
        label: 'Supabase / Database & Migrations',
        folderPath: 'supabase',
        purpose:
          'Database schema definitions, SQL migrations, o Supabase project configurations kung gigamit ang Supabase Postgres & Storage.',
        files: [...scanCategoryFiles('supabase', 40), ...scanCategoryFiles('drizzle', 40)],
      },
      {
        id: 'root_config',
        label: 'Root Config & Deployment (server.ts, Dockerfile, render.yaml, package.json)',
        folderPath: '.',
        purpose:
          'Server entry (`server.ts`), build/runtime config (`package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`), Docker & Render deployment (`Dockerfile`, `render.yaml`), ug `.env.example` template.',
        files: existingRootEntries.filter(
          (f) =>
            rootKnownFiles.includes(f) ||
            /\.(ts|js|json|yaml|yml|md|html)$/i.test(f) ||
            f === '.env.example' ||
            f === '.gitignore' ||
            f === '.npmrc' ||
            f === 'Dockerfile' ||
            f === 'bun.lock'
        ),
      },
    ];

    return res.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      categories,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to scan project code tree.' });
  }
});

app.get('/api/admin/project-code/file', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const relPath = String(req.query.path || '').trim();
    if (!isSafeProjectRelativePath(relPath)) {
      return res.status(403).json({ error: 'Access to this file path is restricted for security.' });
    }
    const absPath = path.resolve(PROJECT_ROOT_DIR, relPath);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return res.status(404).json({ error: 'File not found in workspace.' });
    }
    const stat = fs.statSync(absPath);
    if (/\.(png|jpg|jpeg|webp|gif|ico|woff|woff2|mp3|wav|mp4)$/i.test(absPath)) {
      return res.json({
        ok: true,
        path: relPath,
        isBinary: true,
        sizeBytes: stat.size,
        content: `[Binary asset file: ${relPath} (${(stat.size / 1024).toFixed(1)} KB)]`,
      });
    }
    const raw = fs.readFileSync(absPath, 'utf8');
    const truncated = raw.length > 65000;
    return res.json({
      ok: true,
      path: relPath,
      isBinary: false,
      sizeBytes: stat.size,
      truncated,
      content: truncated ? `${raw.slice(0, 65000)}\n\n... [Truncated at 65 KB for fast preview]` : raw,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to read file.' });
  }
});

app.get('/api/admin/project-code/env-guide', requireAuth, requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const envGuide = [
      {
        key: 'INTERNAL_DATABASE_URL',
        category: 'Database (Render PostgreSQL)',
        sample: 'postgresql://user:pass@dpg-xxxx-a/choychat_db',
        isSet: Boolean((process.env.INTERNAL_DATABASE_URL || '').trim()),
        purpose:
          'Internal PostgreSQL connection string sulod sa Render network — mas paspas ug libre nga internal traffic tali sa Render Web Service ug Render Postgres DB.',
      },
      {
        key: 'DATABASE_URL',
        category: 'Database (PostgreSQL Primary)',
        sample: 'postgresql://user:pass@host:5432/dbname?sslmode=require',
        isSet: Boolean((process.env.DATABASE_URL || '').trim()),
        purpose:
          'Primary cloud database URI diin gi-save tanan users, chats, newsfeed posts, wallets, DTR records, ug payment transactions para real-time cloud sync.',
      },
      {
        key: 'APP_URL',
        category: 'App Domain & Redirects',
        sample: 'https://chat-9-si9x.onrender.com',
        isSet: Boolean((process.env.APP_URL || '').trim()),
        purpose:
          'Official public URL sa imong Choy Chat website. Gigamit kini sa Stripe Checkout return URLs (`success_url`/`cancel_url`), share links, ug PWA metadata.',
      },
      {
        key: 'R2_PUBLIC_URL',
        category: 'Cloudflare R2 Storage',
        sample: 'https://pub-xxxxxxxx.r2.dev',
        isSet: Boolean((process.env.R2_PUBLIC_URL || '').trim()),
        purpose:
          'Public CDN domain sa imong Cloudflare R2 bucket para paspas mo-load ang gi-upload nga photos, videos, ug music nga walay egress fee.',
      },
      {
        key: 'R2_ACCOUNT_ID',
        category: 'Cloudflare R2 Storage',
        sample: 'a1b2c3d4e5f6g7h8i9j0...',
        isSet: Boolean((process.env.R2_ACCOUNT_ID || '').trim()),
        purpose:
          'Account ID gikan sa Cloudflare Dashboard -> R2 Overview. Kinahanglan para makakonek ang server sa saktong Cloudflare R2 endpoint.',
      },
      {
        key: 'R2_ACCESS_KEY_ID',
        category: 'Cloudflare R2 Storage',
        sample: 'r2_access_key_id_here',
        isSet: Boolean((process.env.R2_ACCESS_KEY_ID || '').trim()),
        purpose:
          'S3-compatible Access Key ID gikan sa Cloudflare R2 API Tokens para maka-upload ug maka-backup ang Choy Chat ngadto sa R2.',
      },
      {
        key: 'R2_SECRET_ACCESS_KEY',
        category: 'Cloudflare R2 Storage',
        sample: 'r2_secret_access_key_here (Server Secret)',
        isSet: Boolean((process.env.R2_SECRET_ACCESS_KEY || '').trim()),
        purpose:
          'Private secret token kauban sa R2_ACCESS_KEY_ID para sa secure server-side upload ug encrypted vault backup sa Cloudflare R2.',
      },
      {
        key: 'SUPABASE_URL',
        category: 'Supabase Storage & KYC',
        sample: 'https://xxxxx.supabase.co',
        isSet: Boolean((process.env.SUPABASE_URL || '').trim()),
        purpose:
          'Project URL sa imong Supabase workspace (Project Settings -> API). Gigamit para sa media bucket ug private KYC bucket uploads.',
      },
      {
        key: 'SUPABASE_ANON_KEY',
        category: 'Supabase Storage & KYC',
        sample: 'eyJhbGciOiJIUzI1NiIs...',
        isSet: Boolean((process.env.SUPABASE_ANON_KEY || '').trim()),
        purpose:
          'Public anon API key sa Supabase para sa standard authenticated storage operations ug public bucket access.',
      },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        category: 'Supabase Storage & KYC',
        sample: 'eyJhbGciOiJIUzI1NiIs... (Server Secret)',
        isSet: Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
        purpose:
          'Admin server-only Supabase key para sa secure upload/download sa private KYC ID photos nga admin ra ang makatan-aw.',
      },
      {
        key: 'SUPABASE_PRIVATE_KYC_BUCKET',
        category: 'Supabase Storage & KYC',
        sample: 'choychat-private-kyc',
        isSet: Boolean((process.env.SUPABASE_PRIVATE_KYC_BUCKET || '').trim()),
        purpose:
          'Ngalan sa private Supabase Storage bucket diin gitipigan ang sensitive Valid ID uploads sa customer verification.',
      },
      {
        key: 'ADMIN_MOBILE / ADMIN_PHONE',
        category: 'Admin Access Control',
        sample: '09XXXXXXXXX',
        isSet: Boolean((process.env.ADMIN_MOBILE || process.env.ADMIN_PHONE || '').trim()),
        purpose:
          'Official mobile number sa Admin account. Kung naka-set kini sa server env, awtomatikong gi-protect ang admin login credentials.',
      },
      {
        key: 'ADMIN_PIN',
        category: 'Admin Access Control',
        sample: '6-digit secret PIN (Server Secret)',
        isSet: Boolean((process.env.ADMIN_PIN || '').trim()),
        purpose:
          'Secret PIN sa Admin login. Gi-verify kini sa server-side lamang ug dili gyud ipakita sa browser code.',
      },
      {
        key: 'STRIPE_SECRET_KEY',
        category: 'Stripe Payment Terminal',
        sample: 'sk_live_... or sk_test_... (Server Secret)',
        isSet: Boolean((process.env.STRIPE_SECRET_KEY || '').trim()),
        purpose:
          'Private Stripe API key sa server para maghimo og secure Stripe Checkout sessions ug mo-verify sa bayad sa Online Payment Terminal ug DTR subscriptions.',
      },
      {
        key: 'VITE_STRIPE_PUBLISHABLE_KEY',
        category: 'Stripe Payment Terminal',
        sample: 'pk_live_... or pk_test_...',
        isSet: Boolean((process.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim()),
        purpose:
          'Public browser key sa Stripe nga safe ipakita sa frontend para sa Stripe Checkout ug client payment status.',
      },
      {
        key: 'STRIPE_CONFIG_ID',
        category: 'Stripe Payment Terminal',
        sample: 'pmc_xxxxxxxxxxxx',
        isSet: Boolean((process.env.STRIPE_CONFIG_ID || '').trim()),
        purpose:
          'Optional Stripe Payment Method Configuration ID (`pmc_...`) para i-activate ang imong naka-enable nga payment methods sa Stripe Dashboard.',
      },
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        category: 'Stripe Payment Terminal',
        sample: 'whsec_xxxxxxxxxxxx (Server Secret)',
        isSet: Boolean((process.env.STRIPE_WEBHOOK_SECRET || '').trim()),
        purpose:
          'Signing secret para ma-verify sa `/api/webhooks/stripe` nga tinuod gikan sa Stripe ang payment event una i-auto-credit ang wallet.',
      },
      {
        key: 'GEMINI_API_KEY',
        category: 'Choy AI & Welcome Voice',
        sample: 'AIza... (Server Secret)',
        isSet: Boolean((process.env.GEMINI_API_KEY || '').trim()),
        purpose:
          'Server-side Gemini API key para sa Choy AI Assistant ug Welcome Voice greeting synthesis (`WELCOME TO CHOY CHAT`).',
      },
      {
        key: 'KYC_ENCRYPTION_KEY',
        category: 'Privacy & Encryption',
        sample: '32-char high-entropy secret (Server Secret)',
        isSet: Boolean((process.env.KYC_ENCRYPTION_KEY || '').trim()),
        purpose:
          'AES-256 encryption key para i-encrypt ang tinuod nga pangalan ug sensitive KYC details sa database.',
      },
    ];

    return res.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      envGuide,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load env guide.' });
  }
});

startServer();

