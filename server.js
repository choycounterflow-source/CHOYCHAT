// server.ts
import express from "express";
import crypto3 from "crypto";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

// src/server/choyStore.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
function normalizeUserNewsfeed(raw) {
  const val = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (val === "feed_b") return "feed_b";
  if (val === "feed_c") return "feed_c";
  if (val === "feed_bc") return "feed_bc";
  return "feed_a";
}
function normalizePostNewsfeed(raw) {
  const val = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (val === "feed_a") return "feed_a";
  if (val === "feed_b") return "feed_b";
  if (val === "feed_c") return "feed_c";
  if (val === "feed_bc") return "feed_bc";
  if (val === "both") return "both";
  return "feed_a";
}
function normalizeAnnouncementTarget(raw) {
  const val = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (val === "feed_a" || val === "feed_b" || val === "feed_c" || val === "feed_bc") return val;
  return "all";
}
function normalizeAnnouncementBadge(raw) {
  const val = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (val === "reminder" || val === "urgent") return val;
  return "announcement";
}
function normalizeAnnouncementTone(raw) {
  const val = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (val === "amber" || val === "sky" || val === "rose") return val;
  return "emerald";
}
var DEFAULT_AVATAR = "/assets/aistudio/image_20261121_145253_f477cbfa.webp";
var DEFAULT_NEWSFEED_CONFIG = {
  feedATitle: "Newsfeed A",
  feedBTitle: "Newsfeed B",
  feedCTitle: "Newsfeed C"
};
var DEFAULT_SETTINGS = {
  fiveH: 50,
  bulig: 100,
  point5: 150,
  halfSack: 200,
  oneSack: 400,
  defFiveH: 0,
  defBulig: 0,
  defPoint5: 0,
  defHalfSack: 0,
  defOneSack: 0
};
var ALLOWED_CHAT_ROOMS = ["VIP Group", "Choy Admin"];
var LOCAL_DATA_FILE = path.join(process.cwd(), ".choychat-data.json");
function initSessionSigningKey() {
  const envSecret = (process.env.SESSION_SECRET || "").trim();
  if (envSecret.length >= 16) return envSecret;
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const raw = fs.readFileSync(LOCAL_DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.sessionKey === "string" && parsed.sessionKey.length >= 32) {
        return parsed.sessionKey;
      }
    }
  } catch {
  }
  return crypto.randomBytes(32).toString("hex");
}
var SESSION_SIGNING_KEY = initSessionSigningKey();
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPin(pin, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(pin, salt, 64);
    const storedBuf = Buffer.from(keyHex, "hex");
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}
function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
function normalizePhone(raw) {
  const stripped = raw.trim().replace(/[\s\-().]/g, "");
  if (/^\+639\d{9}$/.test(stripped)) {
    return "0" + stripped.slice(3);
  }
  if (/^639\d{9}$/.test(stripped)) {
    return "0" + stripped.slice(2);
  }
  return stripped;
}
function signSessionToken(uid, role) {
  const payload = {
    uid,
    role,
    exp: Date.now() + 1e3 * 60 * 60 * 24 * 7
    // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SIGNING_KEY).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}
function verifySessionToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", SESSION_SIGNING_KEY).update(payloadB64).digest("base64url");
  if (!timingSafeStringEqual(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!parsed.uid || parsed.role !== "admin" && parsed.role !== "member") return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
function sanitizeMediaUrl(url) {
  if (typeof url !== "string") return void 0;
  const trimmed = url.trim();
  if (!trimmed) return void 0;
  if (trimmed.startsWith("/assets/") && trimmed.length <= 500) return trimmed;
  if (trimmed.length <= 4e6 && /^data:image\/(png|jpeg|jpg|webp|gif|avif|heic);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.length <= 85e5 && /^data:video\/(mp4|webm|quicktime);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.length <= 5e6 && /^data:audio\/(webm|ogg|mp4|mpeg|mp3|wav|aac|x-m4a)(;codecs=[a-zA-Z0-9._-]+)?;base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.length > 1e3) return void 0;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return void 0;
  }
  return void 0;
}
function sanitizeWebsiteUrl(url) {
  if (typeof url !== "string") return void 0;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 1e3) return void 0;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return void 0;
  }
  return void 0;
}
function clampNum(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}
function computeLedgerTotal(row, settings) {
  return row.fiveH * settings.fiveH + row.bulig * settings.bulig + row.point5 * settings.point5 + row.halfSack * settings.halfSack + row.oneSack * settings.oneSack + row.bal;
}
var ChoyStore = class {
  constructor() {
    this.pool = null;
    this.usePostgres = false;
    this._storageStatus = "no_database_url";
    this.poolSource = "none";
    this.poolMax = clampNum(process.env.PG_POOL_MAX || 15, 2, 50);
    // In-memory fallback when DATABASE_URL is not yet configured
    this.memUsers = [];
    this.memPosts = [];
    this.memMessages = [];
    this.memLedger = [];
    this.memKnowledge = [];
    this.memSettings = { ...DEFAULT_SETTINGS };
    this.memNewsfeedConfig = { ...DEFAULT_NEWSFEED_CONFIG };
    this.memPushSubs = [];
    this.memVapidKeys = null;
    this.memLocations = [];
    this.locationTrails = /* @__PURE__ */ new Map();
    this.memEmojiLinks = [
      {
        id: "el_default",
        emojiCode: "\u{1F510}\u{1F7E2}\u{1F4AC}\u2728\u{1F680}",
        targetUrl: "https://chat-9-si9x.onrender.com",
        title: "Choy Chat Live App",
        iconUrl: DEFAULT_AVATAR,
        pinnedToAppIcon: true,
        createdBy: "System",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    this.memStudioNotes = [];
    this.memEnvVault = [];
    this.memAnnouncements = [];
    this.memSeeded = false;
    this.persistInFlight = null;
    this.persistQueued = false;
    this.readyPromise = this.init();
  }
  get storageMode() {
    return this.usePostgres ? "postgres" : "memory";
  }
  get storageStatus() {
    return this._storageStatus;
  }
  getPoolStats() {
    return {
      enabled: this.usePostgres && Boolean(this.pool),
      source: this.poolSource,
      max: this.poolMax,
      totalCount: this.pool?.totalCount ?? 0,
      idleCount: this.pool?.idleCount ?? 0,
      waitingCount: this.pool?.waitingCount ?? 0
    };
  }
  async ready() {
    await this.readyPromise;
  }
  loadMemoryFromDisk() {
    try {
      if (!fs.existsSync(LOCAL_DATA_FILE)) return false;
      const raw = fs.readFileSync(LOCAL_DATA_FILE, "utf8");
      if (!raw.trim()) return false;
      const data = JSON.parse(raw);
      if (Array.isArray(data.users)) this.memUsers = data.users;
      if (Array.isArray(data.posts)) this.memPosts = data.posts;
      if (Array.isArray(data.messages)) this.memMessages = data.messages;
      if (Array.isArray(data.ledger)) this.memLedger = data.ledger;
      if (Array.isArray(data.knowledge)) this.memKnowledge = data.knowledge;
      if (data.settings && typeof data.settings === "object") {
        this.memSettings = { ...DEFAULT_SETTINGS, ...data.settings };
      }
      if (data.newsfeedConfig && typeof data.newsfeedConfig === "object") {
        this.memNewsfeedConfig = {
          ...DEFAULT_NEWSFEED_CONFIG,
          ...data.newsfeedConfig
        };
      }
      if (Array.isArray(data.pushSubs)) this.memPushSubs = data.pushSubs;
      if (data.vapidKeys && typeof data.vapidKeys === "object") {
        this.memVapidKeys = data.vapidKeys;
      }
      if (Array.isArray(data.locations)) {
        this.memLocations = data.locations;
      }
      if (data.locationTrails && typeof data.locationTrails === "object") {
        this.locationTrails = new Map(
          Object.entries(data.locationTrails)
        );
      }
      if (Array.isArray(data.emojiLinks) && data.emojiLinks.length > 0) {
        this.memEmojiLinks = data.emojiLinks;
      }
      if (Array.isArray(data.studioNotes)) this.memStudioNotes = data.studioNotes;
      if (Array.isArray(data.envVault)) this.memEnvVault = data.envVault;
      if (Array.isArray(data.announcements)) this.memAnnouncements = data.announcements;
      this.memSeeded = true;
      console.log(
        `[ChoyStore] Loaded persistent local store (${this.memUsers.length} users, ${this.memPosts.length} posts, ${this.memMessages.length} messages).`
      );
      return true;
    } catch (err) {
      console.error("[ChoyStore] Failed to load local JSON store:", err instanceof Error ? err.message : err);
      return false;
    }
  }
  async persistMemory() {
    if (this.usePostgres) return;
    if (this.persistInFlight) {
      this.persistQueued = true;
      await this.persistInFlight;
      if (this.persistQueued) {
        this.persistQueued = false;
        return this.persistMemory();
      }
      return;
    }
    const run = async () => {
      try {
        const trailsObj = {};
        for (const [uid, pts] of this.locationTrails.entries()) {
          trailsObj[uid] = pts;
        }
        const payload = {
          version: 1,
          sessionKey: SESSION_SIGNING_KEY,
          users: this.memUsers,
          posts: this.memPosts,
          messages: this.memMessages,
          ledger: this.memLedger,
          knowledge: this.memKnowledge,
          settings: this.memSettings,
          newsfeedConfig: this.memNewsfeedConfig,
          pushSubs: this.memPushSubs,
          vapidKeys: this.memVapidKeys,
          locations: this.memLocations,
          locationTrails: trailsObj,
          emojiLinks: this.memEmojiLinks,
          studioNotes: this.memStudioNotes,
          envVault: this.memEnvVault,
          announcements: this.memAnnouncements
        };
        const tmpPath = `${LOCAL_DATA_FILE}.tmp.${process.pid}`;
        await fs.promises.writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");
        await fs.promises.rename(tmpPath, LOCAL_DATA_FILE);
      } catch (err) {
        console.error("[ChoyStore] Failed to persist local JSON store:", err instanceof Error ? err.message : err);
      }
    };
    this.persistInFlight = run().finally(() => {
      this.persistInFlight = null;
    });
    await this.persistInFlight;
    if (this.persistQueued) {
      this.persistQueued = false;
      await this.persistMemory();
    }
  }
  stripEnvQuotes(raw) {
    const trimmed = (raw || "").trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  }
  async init() {
    const poolerUrl = this.stripEnvQuotes(process.env.DATABASE_POOL_URL);
    const directUrl = this.stripEnvQuotes(process.env.DATABASE_URL);
    const isValidDbUrl = (url) => {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        if (!parsed.hostname || parsed.hostname.toLowerCase() === "base" || parsed.hostname.includes("placeholder")) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };
    const candidates = [];
    if (poolerUrl && isValidDbUrl(poolerUrl)) candidates.push({ url: poolerUrl, source: "pooler_url" });
    if (directUrl && directUrl !== poolerUrl && isValidDbUrl(directUrl)) candidates.push({ url: directUrl, source: "database_url" });
    if (candidates.length > 0) {
      for (const candidate of candidates) {
        try {
          const isLocal = candidate.url.includes("localhost") || candidate.url.includes("127.0.0.1");
          const pool = new Pool({
            connectionString: candidate.url,
            ssl: isLocal ? false : { rejectUnauthorized: false },
            max: this.poolMax,
            idleTimeoutMillis: 3e4,
            connectionTimeoutMillis: 1e4,
            keepAlive: true,
            keepAliveInitialDelayMillis: 1e4
          });
          pool.on("error", (err) => {
            console.error(
              "[ChoyStore] Idle PostgreSQL pool client error:",
              err instanceof Error ? err.message : err
            );
          });
          await pool.query("SELECT 1");
          this.pool = pool;
          this.poolSource = candidate.source;
          await this.createTables();
          await this.seedIfEmptyPostgres();
          this.usePostgres = true;
          this._storageStatus = "postgres_connected";
          console.log(
            `[ChoyStore] Connected to PostgreSQL cloud database (pool max=${this.poolMax}, source=${candidate.source}).`
          );
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message.toLowerCase() : "";
          this._storageStatus = msg.includes("password") || msg.includes("authentication") || msg.includes("28p01") ? "auth_failed" : "connection_failed";
          console.error(
            `[ChoyStore] PostgreSQL connection (${candidate.source}) failed:`,
            err instanceof Error ? err.message : err
          );
          this.pool = null;
          this.poolSource = "none";
          this.usePostgres = false;
        }
      }
      console.error("[ChoyStore] All PostgreSQL URLs failed, falling back to local disk store.");
    } else {
      this._storageStatus = "no_database_url";
    }
    const loaded = this.loadMemoryFromDisk();
    if (!loaded) {
      this.seedMemory();
      await this.persistMemory();
    }
    console.log("[ChoyStore] Running with persistent local disk fallback (.choychat-data.json).");
  }
  async createTables() {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'approved',
        blocked_users JSONB NOT NULL DEFAULT '[]'::jsonb,
        avatar_url TEXT,
        newsfeed TEXT NOT NULL DEFAULT 'feed_a',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS newsfeed TEXT NOT NULL DEFAULT 'feed_a';
      CREATE TABLE IF NOT EXISTS app_posts (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_handle TEXT NOT NULL,
        author_avatar TEXT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT NOT NULL DEFAULT 'text',
        category TEXT NOT NULL DEFAULT 'feed',
        newsfeed TEXT NOT NULL DEFAULT 'both',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE app_posts ADD COLUMN IF NOT EXISTS newsfeed TEXT NOT NULL DEFAULT 'both';
      CREATE TABLE IF NOT EXISTS app_messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        room_id TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        media_url TEXT,
        media_type TEXT NOT NULL DEFAULT 'text',
        transcript TEXT,
        reactions JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE app_messages ADD COLUMN IF NOT EXISTS transcript TEXT;
      CREATE TABLE IF NOT EXISTS app_ledger (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        five_h DOUBLE PRECISION NOT NULL DEFAULT 0,
        five_h_type TEXT NOT NULL DEFAULT 'blue',
        bulig DOUBLE PRECISION NOT NULL DEFAULT 0,
        point5 DOUBLE PRECISION NOT NULL DEFAULT 0,
        half_sack DOUBLE PRECISION NOT NULL DEFAULT 0,
        one_sack DOUBLE PRECISION NOT NULL DEFAULT 0,
        bal DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_knowledge (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_push_subs_user_name ON app_push_subscriptions (LOWER(user_name));
      CREATE TABLE IF NOT EXISTS app_user_locations (
        user_id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        accuracy DOUBLE PRECISION,
        speed DOUBLE PRECISION,
        heading DOUBLE PRECISION,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE app_user_locations ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION;
      ALTER TABLE app_user_locations ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION;
      CREATE TABLE IF NOT EXISTS app_emoji_links (
        id TEXT PRIMARY KEY,
        emoji_code TEXT NOT NULL,
        target_url TEXT NOT NULL,
        title TEXT NOT NULL,
        icon_url TEXT NOT NULL,
        pinned_to_app_icon BOOLEAN NOT NULL DEFAULT false,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_studio_notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'App Features',
        entries JSONB NOT NULL DEFAULT '[]'::jsonb,
        organized_prompt TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_env_vault (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL DEFAULT 'Auth & App URL',
        key_name TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        secret BOOLEAN NOT NULL DEFAULT false,
        notes TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        badge TEXT NOT NULL DEFAULT 'announcement',
        tone TEXT NOT NULL DEFAULT 'emerald',
        target TEXT NOT NULL DEFAULT 'all',
        active BOOLEAN NOT NULL DEFAULT true,
        created_by TEXT NOT NULL DEFAULT 'Admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }
  async seedIfEmptyPostgres() {
    if (!this.pool) return;
    const settingsRes = await this.pool.query("SELECT id FROM app_settings WHERE id = $1", ["prices"]);
    if (settingsRes.rowCount && settingsRes.rowCount > 0) return;
    await this.pool.query(
      "INSERT INTO app_settings (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      ["prices", JSON.stringify(DEFAULT_SETTINGS)]
    );
    await this.pool.query(
      `UPDATE app_users SET status = 'approved', updated_at = NOW() WHERE status != 'approved'`
    );
    await this.pool.query(
      `INSERT INTO app_posts (id, author_id, author_name, author_handle, author_avatar, content, media_url, media_type, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [
        "p_welcome",
        "system",
        "Choy Chat Official",
        "@choychat",
        DEFAULT_AVATAR,
        "Welcome to Choy Chat! Live cross-device database sync is active.",
        DEFAULT_AVATAR,
        "image",
        "feed"
      ]
    );
    await this.pool.query(
      `INSERT INTO app_messages (id, sender_id, sender_name, room_id, text, media_url, media_type, reactions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) ON CONFLICT (id) DO NOTHING`,
      [
        "m_welcome",
        "system",
        "Choy Admin",
        "VIP Group",
        "Welcome to VIP Group! Messages sync across all devices in real time.",
        null,
        "text",
        JSON.stringify(["\u2764\uFE0F", "\u{1F44D}"])
      ]
    );
    await this.pool.query(
      `INSERT INTO app_messages (id, sender_id, sender_name, room_id, text, media_url, media_type, reactions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) ON CONFLICT (id) DO NOTHING`,
      [
        "m_welcome_vid",
        "system",
        "Choy Admin",
        "VIP Group",
        "Shared group video clip (tap Play with Sound).",
        "https://www.w3schools.com/html/mov_bbb.mp4",
        "video",
        JSON.stringify(["\u{1F525}"])
      ]
    );
    await this.pool.query(
      `INSERT INTO app_knowledge (id, question, answer)
       VALUES ($1, $2, $3), ($4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [
        "k_1",
        "What is Choy Chat?",
        "Choy Chat is a real-time cloud-synced social media, video gallery, and milestone ledger platform.",
        "k_2",
        "How does the ledger work?",
        "The Milestone Ledger tracks 5H, Bulig, Point 5, Half Sack, and One Sack quantities with live cross-device sync."
      ]
    );
    await this.pool.query(
      `INSERT INTO app_ledger (id, name, five_h, five_h_type, bulig, point5, half_sack, one_sack, bal)
       VALUES ($1, $2, 5, 'blue', 3, 2, 4, 2, 500), ($3, $4, 4, 'red', 5, 3, 2, 3, -200)
       ON CONFLICT (id) DO NOTHING`,
      ["l_1", "Choy Admin", "l_2", "Maria Vibe"]
    );
  }
  seedMemory() {
    if (this.memSeeded) return;
    this.memSeeded = true;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.memPosts = [
      {
        id: "p_welcome",
        authorId: "system",
        authorName: "Choy Chat Official",
        authorHandle: "@choychat",
        authorAvatar: DEFAULT_AVATAR,
        content: "Welcome to Choy Chat! Live cross-device database sync is active.",
        mediaUrl: DEFAULT_AVATAR,
        mediaType: "image",
        category: "feed",
        newsfeed: "both",
        createdAt: now
      }
    ];
    this.memMessages = [
      {
        id: "m_welcome",
        senderId: "system",
        senderName: "Choy Admin",
        roomId: "VIP Group",
        text: "Welcome to VIP Group! Messages sync across all devices in real time.",
        mediaType: "text",
        reactions: ["\u2764\uFE0F", "\u{1F44D}"],
        createdAt: now
      },
      {
        id: "m_welcome_vid",
        senderId: "system",
        senderName: "Choy Admin",
        roomId: "VIP Group",
        text: "Shared group video clip (tap Play with Sound).",
        mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        mediaType: "video",
        reactions: ["\u{1F525}"],
        createdAt: now
      }
    ];
    this.memKnowledge = [
      {
        id: "k_1",
        question: "What is Choy Chat?",
        answer: "Choy Chat is a real-time cloud-synced social media, video gallery, and milestone ledger platform.",
        createdAt: now
      },
      {
        id: "k_2",
        question: "How does the ledger work?",
        answer: "The Milestone Ledger tracks 5H, Bulig, Point 5, Half Sack, and One Sack quantities with live cross-device sync.",
        createdAt: now
      }
    ];
    this.memLedger = [
      { id: "l_1", name: "Choy Admin", fiveH: 5, fiveHType: "blue", bulig: 3, point5: 2, halfSack: 4, oneSack: 2, bal: 500, updatedAt: now },
      { id: "l_2", name: "Maria Vibe", fiveH: 4, fiveHType: "red", bulig: 5, point5: 3, halfSack: 2, oneSack: 3, bal: -200, updatedAt: now }
    ];
  }
  // ---- AUTH & USERS ----
  hasEnvAdminConfigured() {
    return Boolean((process.env.ADMIN_PIN || "").trim());
  }
  async hasAnyAdmin() {
    await this.ready();
    if (this.hasEnvAdminConfigured()) return true;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT id FROM app_users WHERE role = $1 LIMIT 1", ["admin"]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    return this.memUsers.some((u) => u.role === "admin");
  }
  async getUserById(id) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT * FROM app_users WHERE id = $1 LIMIT 1", [id]);
      if (!res.rowCount) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.memUsers.find((u) => u.id === id) || null;
  }
  async getUserByPhone(phone) {
    await this.ready();
    const norm = normalizePhone(phone);
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        "SELECT * FROM app_users WHERE phone = $1 OR phone = $2 LIMIT 1",
        [norm, phone.trim()]
      );
      if (!res.rowCount) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.memUsers.find((u) => normalizePhone(u.phone) === norm || u.phone === phone.trim()) || null;
  }
  async ensureEnvAdminUser(phone) {
    await this.ready();
    const normPhone = normalizePhone(phone);
    const existing = await this.getUserByPhone(normPhone);
    if (existing) {
      if (existing.role !== "admin" || existing.status !== "approved") {
        if (this.usePostgres && this.pool) {
          await this.pool.query(
            "UPDATE app_users SET role = $1, status = $2, updated_at = NOW() WHERE id = $3",
            ["admin", "approved", existing.id]
          );
        } else {
          existing.role = "admin";
          existing.status = "approved";
          existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          await this.persistMemory();
        }
      }
      return await this.getUserById(existing.id);
    }
    const id = "admin_" + crypto.randomUUID().slice(0, 8);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const user = {
      id,
      name: "Choy Admin",
      phone: normPhone,
      pinHash: hashPin(crypto.randomBytes(16).toString("hex")),
      role: "admin",
      status: "approved",
      blockedUsers: [],
      newsfeed: "feed_a",
      createdAt: now,
      updatedAt: now
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_users (id, name, phone, pin_hash, role, status, blocked_users, newsfeed)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [user.id, user.name, user.phone, user.pinHash, user.role, user.status, JSON.stringify(user.blockedUsers), user.newsfeed]
      );
    } else {
      this.memUsers.push(user);
      await this.persistMemory();
    }
    return user;
  }
  async createUser(params) {
    await this.ready();
    const id = (params.role === "admin" ? "admin_" : "u_") + crypto.randomUUID().slice(0, 10);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newsfeed = normalizeUserNewsfeed(params.newsfeed);
    const user = {
      id,
      name: params.name.slice(0, 80),
      phone: normalizePhone(params.phone).slice(0, 40),
      pinHash: hashPin(params.pin),
      role: params.role,
      status: params.status,
      blockedUsers: [],
      newsfeed,
      createdAt: now,
      updatedAt: now
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_users (id, name, phone, pin_hash, role, status, blocked_users, newsfeed)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [user.id, user.name, user.phone, user.pinHash, user.role, user.status, JSON.stringify(user.blockedUsers), user.newsfeed]
      );
    } else {
      this.memUsers.push(user);
      await this.persistMemory();
    }
    return user;
  }
  async updateUserNewsfeed(userId, newsfeed) {
    await this.ready();
    const clean = normalizeUserNewsfeed(newsfeed);
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        "UPDATE app_users SET newsfeed = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [clean, userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return null;
    found.newsfeed = clean;
    found.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.persistMemory();
    return found;
  }
  async updateUserPin(userId, newPin) {
    await this.ready();
    const nextHash = hashPin(newPin);
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        "UPDATE app_users SET pin_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [nextHash, userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return null;
    found.pinHash = nextHash;
    found.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.persistMemory();
    return found;
  }
  async listUsers(includePhone) {
    await this.ready();
    let rows;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT * FROM app_users ORDER BY created_at DESC");
      rows = res.rows.map((r) => this.mapUserRow(r));
    } else {
      rows = [...this.memUsers];
    }
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      phone: includePhone ? u.phone : "Member",
      role: u.role,
      status: u.status,
      avatar: u.avatar,
      newsfeed: normalizeUserNewsfeed(u.newsfeed),
      loginDate: u.updatedAt.slice(0, 16).replace("T", " ")
    }));
  }
  async updateUserAvatar(userId, avatarUrl) {
    await this.ready();
    const cleanAvatar = typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : void 0;
    const postAvatar = cleanAvatar || "/assets/aistudio/image_20261121_145253_f477cbfa.webp";
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        "UPDATE app_users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [cleanAvatar ?? null, userId]
      );
      if (res.rows.length === 0) return null;
      await this.pool.query("UPDATE app_posts SET author_avatar = $1 WHERE author_id = $2", [postAvatar, userId]);
      return this.mapUserRow(res.rows[0]);
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return null;
    found.avatar = cleanAvatar;
    found.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const p of this.memPosts) {
      if (p.authorId === userId) {
        p.authorAvatar = postAvatar;
      }
    }
    await this.persistMemory();
    return found;
  }
  async updateUserName(userId, newName) {
    await this.ready();
    const cleanName = newName.trim().slice(0, 60);
    const cleanLower = cleanName.toLowerCase();
    const nextHandle = `@${cleanLower.replace(/[^a-z0-9]+/g, "").slice(0, 18) || "member"}`;
    if (this.usePostgres && this.pool) {
      const existingRes = await this.pool.query("SELECT * FROM app_users WHERE id = $1 LIMIT 1", [userId]);
      if (existingRes.rows.length === 0) {
        return { ok: false, code: "not_found", error: "Account not found" };
      }
      const current = this.mapUserRow(existingRes.rows[0]);
      const previousName2 = current.name;
      const conflictRes = await this.pool.query(
        "SELECT id FROM app_users WHERE id <> $1 AND LOWER(TRIM(name)) = $2 LIMIT 1",
        [userId, cleanLower]
      );
      if (conflictRes.rows.length > 0) {
        return { ok: false, code: "conflict", error: "That name is already used by another account." };
      }
      const updatedRes = await this.pool.query(
        "UPDATE app_users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [cleanName, userId]
      );
      const updatedUser = this.mapUserRow(updatedRes.rows[0]);
      await this.pool.query(
        "UPDATE app_posts SET author_name = $1, author_handle = $2 WHERE author_id = $3",
        [cleanName, nextHandle, userId]
      );
      await this.pool.query("UPDATE app_messages SET sender_name = $1 WHERE sender_id = $2", [
        cleanName,
        userId
      ]);
      if (previousName2.trim().toLowerCase() !== "vip group") {
        await this.pool.query(
          "UPDATE app_messages SET room_id = $1 WHERE LOWER(TRIM(room_id)) = $2",
          [cleanName, previousName2.trim().toLowerCase()]
        );
      }
      await this.pool.query(
        "UPDATE app_push_subscriptions SET user_name = $1, updated_at = NOW() WHERE user_id = $2",
        [cleanName, userId]
      );
      return { ok: true, user: updatedUser, previousName: previousName2 };
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) {
      return { ok: false, code: "not_found", error: "Account not found" };
    }
    const conflict = this.memUsers.find(
      (u) => u.id !== userId && u.name.trim().toLowerCase() === cleanLower
    );
    if (conflict) {
      return { ok: false, code: "conflict", error: "That name is already used by another account." };
    }
    const previousName = found.name;
    const prevLower = previousName.trim().toLowerCase();
    found.name = cleanName;
    found.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const p of this.memPosts) {
      if (p.authorId === userId) {
        p.authorName = cleanName;
        p.authorHandle = nextHandle;
      }
    }
    for (const m of this.memMessages) {
      if (m.senderId === userId) {
        m.senderName = cleanName;
      }
      if (prevLower !== "vip group" && m.roomId.trim().toLowerCase() === prevLower) {
        m.roomId = cleanName;
      }
    }
    for (const s of this.memPushSubs) {
      if (s.userId === userId) {
        s.userName = cleanName;
        s.updatedAt = found.updatedAt;
      }
    }
    await this.persistMemory();
    return { ok: true, user: found, previousName };
  }
  async updateUserStatus(userId, status) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      if (status === "pending") {
        const res2 = await this.pool.query(
          `UPDATE app_users SET status = $1, updated_at = NOW() WHERE id = $2 AND role != 'admin'`,
          [status, userId]
        );
        return Boolean(res2.rowCount && res2.rowCount > 0);
      }
      const res = await this.pool.query(
        "UPDATE app_users SET status = $1, updated_at = NOW() WHERE id = $2",
        [status, userId]
      );
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return false;
    if (status === "pending" && found.role === "admin") return false;
    found.status = status;
    found.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.persistMemory();
    return true;
  }
  async approveAllPendingUsers() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `UPDATE app_users SET status = 'approved', updated_at = NOW() WHERE status != 'approved'`
      );
      return res.rowCount || 0;
    }
    let count = 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const u of this.memUsers) {
      if (u.status !== "approved") {
        u.status = "approved";
        u.updatedAt = now;
        count += 1;
      }
    }
    if (count > 0) await this.persistMemory();
    return count;
  }
  async deleteUser(userId) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("DELETE FROM app_users WHERE id = $1 AND role != $2", [userId, "admin"]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memUsers.length;
    this.memUsers = this.memUsers.filter((u) => !(u.id === userId && u.role !== "admin"));
    const deleted = this.memUsers.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }
  async updateBlockedUsers(userId, blockedUsers) {
    await this.ready();
    const clean = blockedUsers.filter((v) => typeof v === "string" && v.trim().length > 0).map((v) => v.trim().slice(0, 80)).slice(0, 100);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        "UPDATE app_users SET blocked_users = $1::jsonb, updated_at = NOW() WHERE id = $2",
        [JSON.stringify(clean), userId]
      );
    } else {
      const found = this.memUsers.find((u) => u.id === userId);
      if (found) {
        found.blockedUsers = clean;
        found.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        await this.persistMemory();
      }
    }
    return clean;
  }
  // ---- POSTS ----
  async listPosts() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT * FROM app_posts ORDER BY created_at DESC LIMIT 200");
      return res.rows.map((r) => ({
        id: r.id,
        authorId: r.author_id,
        authorName: r.author_name,
        authorHandle: r.author_handle,
        authorAvatar: r.author_avatar,
        content: r.content,
        mediaUrl: r.media_url || void 0,
        mediaType: r.media_type,
        category: r.category,
        newsfeed: normalizePostNewsfeed(r.newsfeed),
        createdAt: new Date(r.created_at).toISOString()
      }));
    }
    return [...this.memPosts].map((p) => ({
      ...p,
      newsfeed: normalizePostNewsfeed(p.newsfeed)
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async createPost(post) {
    await this.ready();
    const nf = normalizePostNewsfeed(post.newsfeed);
    const item = {
      ...post,
      newsfeed: nf,
      id: "p_" + crypto.randomUUID().slice(0, 12),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_posts (id, author_id, author_name, author_handle, author_avatar, content, media_url, media_type, category, newsfeed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.id,
          item.authorId,
          item.authorName,
          item.authorHandle,
          item.authorAvatar,
          item.content,
          item.mediaUrl || null,
          item.mediaType,
          item.category,
          item.newsfeed
        ]
      );
    } else {
      this.memPosts.unshift(item);
      await this.persistMemory();
    }
    return item;
  }
  async deletePost(postId, requesterId, isAdmin) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = isAdmin ? await this.pool.query("DELETE FROM app_posts WHERE id = $1", [postId]) : await this.pool.query("DELETE FROM app_posts WHERE id = $1 AND author_id = $2", [postId, requesterId]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const idx = this.memPosts.findIndex((p) => p.id === postId && (isAdmin || p.authorId === requesterId));
    if (idx === -1) return false;
    this.memPosts.splice(idx, 1);
    await this.persistMemory();
    return true;
  }
  // ---- MESSAGES ----
  async listMessages() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT * FROM app_messages ORDER BY created_at ASC LIMIT 500");
      return res.rows.map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        roomId: r.room_id,
        text: r.text || "",
        mediaUrl: r.media_url || void 0,
        mediaType: r.media_type,
        transcript: r.transcript || void 0,
        reactions: Array.isArray(r.reactions) ? r.reactions : [],
        createdAt: new Date(r.created_at).toISOString()
      }));
    }
    return [...this.memMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async createMessage(msg) {
    await this.ready();
    const item = {
      ...msg,
      id: "m_" + crypto.randomUUID().slice(0, 12),
      reactions: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_messages (id, sender_id, sender_name, room_id, text, media_url, media_type, transcript, reactions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          item.id,
          item.senderId,
          item.senderName,
          item.roomId,
          item.text,
          item.mediaUrl || null,
          item.mediaType,
          item.transcript || null,
          JSON.stringify(item.reactions)
        ]
      );
    } else {
      this.memMessages.push(item);
      await this.persistMemory();
    }
    return item;
  }
  async deleteMessage(messageId, userId, isAdminUser) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const existing = await this.pool.query("SELECT * FROM app_messages WHERE id = $1 LIMIT 1", [messageId]);
      if (!existing.rowCount) return false;
      const row = existing.rows[0];
      if (!isAdminUser && row.sender_id !== userId) {
        return false;
      }
      await this.pool.query("DELETE FROM app_messages WHERE id = $1", [messageId]);
      return true;
    }
    const idx = this.memMessages.findIndex((m) => m.id === messageId);
    if (idx === -1) return false;
    const item = this.memMessages[idx];
    if (!isAdminUser && item.senderId !== userId) {
      return false;
    }
    this.memMessages.splice(idx, 1);
    await this.persistMemory();
    return true;
  }
  // ---- LEDGER & LEADERBOARD ----
  async listLedger() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT * FROM app_ledger ORDER BY name ASC");
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        fiveH: Number(r.five_h) || 0,
        fiveHType: r.five_h_type === "red" ? "red" : "blue",
        bulig: Number(r.bulig) || 0,
        point5: Number(r.point5) || 0,
        halfSack: Number(r.half_sack) || 0,
        oneSack: Number(r.one_sack) || 0,
        bal: Number(r.bal) || 0,
        updatedAt: new Date(r.updated_at).toISOString()
      }));
    }
    return [...this.memLedger].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getPublicLeaderboard() {
    const [rows, settings] = await Promise.all([this.listLedger(), this.getSettings()]);
    return rows.map((r) => ({ id: r.id, name: r.name, total: computeLedgerTotal(r, settings) })).sort((a, b) => b.total - a.total);
  }
  async createLedgerRow(name) {
    await this.ready();
    const settings = await this.getSettings();
    const row = {
      id: "l_" + crypto.randomUUID().slice(0, 12),
      name: name.slice(0, 100),
      fiveH: settings.defFiveH,
      fiveHType: "blue",
      bulig: settings.defBulig,
      point5: settings.defPoint5,
      halfSack: settings.defHalfSack,
      oneSack: settings.defOneSack,
      bal: 0,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_ledger (id, name, five_h, five_h_type, bulig, point5, half_sack, one_sack, bal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.id, row.name, row.fiveH, row.fiveHType, row.bulig, row.point5, row.halfSack, row.oneSack, row.bal]
      );
    } else {
      this.memLedger.push(row);
      await this.persistMemory();
    }
    return row;
  }
  async updateLedgerRow(id, patch) {
    await this.ready();
    const rows = await this.listLedger();
    const current = rows.find((r) => r.id === id);
    if (!current) return null;
    const updated = {
      ...current,
      fiveH: clampNum(patch.fiveH ?? current.fiveH, -1e6, 1e6),
      fiveHType: patch.fiveHType === "red" ? "red" : patch.fiveHType === "blue" ? "blue" : current.fiveHType,
      bulig: clampNum(patch.bulig ?? current.bulig, -1e6, 1e6),
      point5: clampNum(patch.point5 ?? current.point5, -1e6, 1e6),
      halfSack: clampNum(patch.halfSack ?? current.halfSack, -1e6, 1e6),
      oneSack: clampNum(patch.oneSack ?? current.oneSack, -1e6, 1e6),
      bal: clampNum(patch.bal ?? current.bal, -1e8, 1e8),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `UPDATE app_ledger
         SET five_h = $1, five_h_type = $2, bulig = $3, point5 = $4, half_sack = $5, one_sack = $6, bal = $7, updated_at = NOW()
         WHERE id = $8`,
        [
          updated.fiveH,
          updated.fiveHType,
          updated.bulig,
          updated.point5,
          updated.halfSack,
          updated.oneSack,
          updated.bal,
          updated.id
        ]
      );
    } else {
      this.memLedger = this.memLedger.map((r) => r.id === id ? updated : r);
      await this.persistMemory();
    }
    return updated;
  }
  async applyDefaultQuantitiesToAll(defs) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `UPDATE app_ledger
         SET five_h = $1, bulig = $2, point5 = $3, half_sack = $4, one_sack = $5, updated_at = NOW()`,
        [defs.defFiveH, defs.defBulig, defs.defPoint5, defs.defHalfSack, defs.defOneSack]
      );
    } else {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      this.memLedger = this.memLedger.map((r) => ({
        ...r,
        fiveH: defs.defFiveH,
        bulig: defs.defBulig,
        point5: defs.defPoint5,
        halfSack: defs.defHalfSack,
        oneSack: defs.defOneSack,
        updatedAt: now
      }));
      await this.persistMemory();
    }
  }
  async deleteLedgerRow(id) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("DELETE FROM app_ledger WHERE id = $1", [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memLedger.length;
    this.memLedger = this.memLedger.filter((r) => r.id !== id);
    const deleted = this.memLedger.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }
  // ---- KNOWLEDGE ----
  async listKnowledge() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT * FROM app_knowledge ORDER BY created_at DESC");
      return res.rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        createdAt: new Date(r.created_at).toISOString()
      }));
    }
    return [...this.memKnowledge];
  }
  async createKnowledge(question, answer) {
    await this.ready();
    const item = {
      id: "k_" + crypto.randomUUID().slice(0, 12),
      question: question.slice(0, 300),
      answer: answer.slice(0, 2e3),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query("INSERT INTO app_knowledge (id, question, answer) VALUES ($1, $2, $3)", [
        item.id,
        item.question,
        item.answer
      ]);
    } else {
      this.memKnowledge.unshift(item);
      await this.persistMemory();
    }
    return item;
  }
  async deleteKnowledge(id) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("DELETE FROM app_knowledge WHERE id = $1", [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memKnowledge.length;
    this.memKnowledge = this.memKnowledge.filter((k) => k.id !== id);
    const deleted = this.memKnowledge.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }
  // ---- SETTINGS ----
  async getSettings() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT data FROM app_settings WHERE id = $1 LIMIT 1", ["prices"]);
      if (res.rowCount && res.rows[0]?.data) {
        return { ...DEFAULT_SETTINGS, ...res.rows[0].data };
      }
      return { ...DEFAULT_SETTINGS };
    }
    return { ...this.memSettings };
  }
  async saveSettings(next) {
    await this.ready();
    const clean = {
      fiveH: clampNum(next.fiveH, 0, 1e6),
      bulig: clampNum(next.bulig, 0, 1e6),
      point5: clampNum(next.point5, 0, 1e6),
      halfSack: clampNum(next.halfSack, 0, 1e6),
      oneSack: clampNum(next.oneSack, 0, 1e6),
      defFiveH: clampNum(next.defFiveH, 0, 1e6),
      defBulig: clampNum(next.defBulig, 0, 1e6),
      defPoint5: clampNum(next.defPoint5, 0, 1e6),
      defHalfSack: clampNum(next.defHalfSack, 0, 1e6),
      defOneSack: clampNum(next.defOneSack, 0, 1e6)
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["prices", JSON.stringify(clean)]
      );
    } else {
      this.memSettings = clean;
      await this.persistMemory();
    }
    return clean;
  }
  async getNewsfeedConfig() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT data FROM app_settings WHERE id = $1 LIMIT 1", ["newsfeed_config"]);
      if (res.rowCount && res.rows[0]?.data) {
        const d = res.rows[0].data;
        return {
          feedATitle: typeof d.feedATitle === "string" && d.feedATitle.trim() ? d.feedATitle.trim().slice(0, 60) : DEFAULT_NEWSFEED_CONFIG.feedATitle,
          feedBTitle: typeof d.feedBTitle === "string" && d.feedBTitle.trim() ? d.feedBTitle.trim().slice(0, 60) : DEFAULT_NEWSFEED_CONFIG.feedBTitle,
          feedCTitle: typeof d.feedCTitle === "string" && d.feedCTitle.trim() ? d.feedCTitle.trim().slice(0, 60) : DEFAULT_NEWSFEED_CONFIG.feedCTitle
        };
      }
      return { ...DEFAULT_NEWSFEED_CONFIG };
    }
    return { ...this.memNewsfeedConfig };
  }
  async saveNewsfeedConfig(next) {
    await this.ready();
    const feedATitle = typeof next.feedATitle === "string" && next.feedATitle.trim() ? next.feedATitle.trim().slice(0, 60) : DEFAULT_NEWSFEED_CONFIG.feedATitle;
    const feedBTitle = typeof next.feedBTitle === "string" && next.feedBTitle.trim() ? next.feedBTitle.trim().slice(0, 60) : DEFAULT_NEWSFEED_CONFIG.feedBTitle;
    const feedCTitle = typeof next.feedCTitle === "string" && next.feedCTitle.trim() ? next.feedCTitle.trim().slice(0, 60) : DEFAULT_NEWSFEED_CONFIG.feedCTitle;
    const clean = { feedATitle, feedBTitle, feedCTitle };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ["newsfeed_config", JSON.stringify(clean)]
      );
    } else {
      this.memNewsfeedConfig = clean;
      await this.persistMemory();
    }
    return clean;
  }
  // ---- WEB PUSH VAPID KEYS & SUBSCRIPTIONS ----
  async getOrCreateVapidKeys(generator) {
    await this.ready();
    const envPub = (process.env.VAPID_PUBLIC_KEY || "").trim();
    const envPriv = (process.env.VAPID_PRIVATE_KEY || "").trim();
    if (envPub && envPriv) {
      return { publicKey: envPub, privateKey: envPriv };
    }
    if (this.usePostgres && this.pool) {
      const existing = await this.pool.query("SELECT data FROM app_settings WHERE id = $1 LIMIT 1", ["vapid_keys"]);
      if (existing.rowCount && existing.rows[0]?.data?.publicKey && existing.rows[0]?.data?.privateKey) {
        return {
          publicKey: String(existing.rows[0].data.publicKey),
          privateKey: String(existing.rows[0].data.privateKey)
        };
      }
      const generated = generator();
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        ["vapid_keys", JSON.stringify(generated)]
      );
      const reread = await this.pool.query("SELECT data FROM app_settings WHERE id = $1 LIMIT 1", ["vapid_keys"]);
      if (reread.rowCount && reread.rows[0]?.data?.publicKey && reread.rows[0]?.data?.privateKey) {
        return {
          publicKey: String(reread.rows[0].data.publicKey),
          privateKey: String(reread.rows[0].data.privateKey)
        };
      }
      return generated;
    }
    if (!this.memVapidKeys) {
      this.memVapidKeys = generator();
      await this.persistMemory();
    }
    return this.memVapidKeys;
  }
  async savePushSubscription(sub) {
    await this.ready();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const clean = {
      endpoint: sub.endpoint.trim(),
      userId: sub.userId,
      userName: sub.userName.trim(),
      keys: {
        p256dh: sub.keys.p256dh.trim(),
        auth: sub.keys.auth.trim()
      },
      updatedAt: now
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_push_subscriptions (endpoint, user_id, user_name, p256dh, auth, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (endpoint) DO UPDATE
           SET user_id = EXCLUDED.user_id,
               user_name = EXCLUDED.user_name,
               p256dh = EXCLUDED.p256dh,
               auth = EXCLUDED.auth,
               updated_at = NOW()`,
        [clean.endpoint, clean.userId, clean.userName, clean.keys.p256dh, clean.keys.auth]
      );
      return clean;
    }
    this.memPushSubs = this.memPushSubs.filter((s) => s.endpoint !== clean.endpoint);
    this.memPushSubs.push(clean);
    await this.persistMemory();
    return clean;
  }
  async removePushSubscription(endpoint) {
    await this.ready();
    const cleanEndpoint = endpoint.trim();
    if (!cleanEndpoint) return;
    if (this.usePostgres && this.pool) {
      await this.pool.query("DELETE FROM app_push_subscriptions WHERE endpoint = $1", [cleanEndpoint]);
      return;
    }
    this.memPushSubs = this.memPushSubs.filter((s) => s.endpoint !== cleanEndpoint);
    await this.persistMemory();
  }
  async listPushSubscriptionsForTarget(targetName, excludeUserId) {
    await this.ready();
    const normalized = targetName.trim().toLowerCase();
    const isGroup = normalized === "vip group" || normalized === "";
    if (this.usePostgres && this.pool) {
      const res = isGroup ? await this.pool.query(
        `SELECT endpoint, user_id, user_name, p256dh, auth, updated_at
             FROM app_push_subscriptions
             WHERE user_id <> $1`,
        [excludeUserId]
      ) : await this.pool.query(
        `SELECT endpoint, user_id, user_name, p256dh, auth, updated_at
             FROM app_push_subscriptions
             WHERE user_id <> $1 AND LOWER(TRIM(user_name)) = $2`,
        [excludeUserId, normalized]
      );
      return res.rows.map((r) => ({
        endpoint: String(r.endpoint),
        userId: String(r.user_id),
        userName: String(r.user_name),
        keys: { p256dh: String(r.p256dh), auth: String(r.auth) },
        updatedAt: new Date(String(r.updated_at)).toISOString()
      }));
    }
    return this.memPushSubs.filter((s) => {
      if (s.userId === excludeUserId) return false;
      if (isGroup) return true;
      return s.userName.trim().toLowerCase() === normalized;
    });
  }
  appendLocationTrail(userId, lat, lng, ts) {
    const existing = this.locationTrails.get(userId) || [];
    const last = existing[existing.length - 1];
    if (last) {
      const toRad = (deg) => deg * Math.PI / 180;
      const dLat = toRad(lat - last.lat);
      const dLng = toRad(lng - last.lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(last.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
      const distMeters = 2 * 6371e3 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (distMeters < 4) return;
    }
    const next = [...existing, { lat, lng, ts }].slice(-30);
    this.locationTrails.set(userId, next);
  }
  async upsertLocation(userId, userName, lat, lng, accuracy, speed, heading) {
    await this.ready();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.appendLocationTrail(userId, lat, lng, now);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_user_locations (user_id, user_name, lat, lng, accuracy, speed, heading, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET user_name = EXCLUDED.user_name,
               lat = EXCLUDED.lat,
               lng = EXCLUDED.lng,
               accuracy = EXCLUDED.accuracy,
               speed = EXCLUDED.speed,
               heading = EXCLUDED.heading,
               updated_at = NOW()`,
        [userId, userName, lat, lng, accuracy ?? null, speed ?? null, heading ?? null]
      );
      return;
    }
    this.memLocations = this.memLocations.filter((l) => l.userId !== userId);
    this.memLocations.push({ userId, userName, lat, lng, accuracy, speed, heading, updatedAt: now });
    await this.persistMemory();
  }
  async getAllLocations() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT user_id, user_name, lat, lng, accuracy, speed, heading, updated_at FROM app_user_locations ORDER BY updated_at DESC`
      );
      return res.rows.map((r) => {
        const userId = String(r.user_id);
        const lat = Number(r.lat);
        const lng = Number(r.lng);
        const updatedAt = new Date(String(r.updated_at)).toISOString();
        const trail = this.locationTrails.get(userId);
        return {
          userId,
          userName: String(r.user_name),
          lat,
          lng,
          accuracy: r.accuracy != null ? Number(r.accuracy) : void 0,
          speed: r.speed != null ? Number(r.speed) : void 0,
          heading: r.heading != null ? Number(r.heading) : void 0,
          trail: trail && trail.length > 0 ? trail : [{ lat, lng, ts: updatedAt }],
          updatedAt
        };
      });
    }
    return this.memLocations.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((l) => ({
      ...l,
      trail: this.locationTrails.get(l.userId) || [{ lat: l.lat, lng: l.lng, ts: l.updatedAt }]
    }));
  }
  async listEmojiLinks() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, emoji_code, target_url, title, icon_url, pinned_to_app_icon, created_by, created_at
         FROM app_emoji_links
         ORDER BY pinned_to_app_icon DESC, created_at DESC`
      );
      return res.rows.map((r) => ({
        id: String(r.id),
        emojiCode: String(r.emoji_code),
        targetUrl: String(r.target_url),
        title: String(r.title),
        iconUrl: String(r.icon_url || DEFAULT_AVATAR),
        pinnedToAppIcon: Boolean(r.pinned_to_app_icon),
        createdBy: String(r.created_by || "Admin"),
        createdAt: new Date(String(r.created_at)).toISOString()
      }));
    }
    return [...this.memEmojiLinks].sort((a, b) => {
      if (a.pinnedToAppIcon !== b.pinnedToAppIcon) return a.pinnedToAppIcon ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }
  async createEmojiLink(input) {
    await this.ready();
    const id = "el_" + crypto.randomUUID().slice(0, 12);
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    if (this.usePostgres && this.pool) {
      if (input.pinnedToAppIcon) {
        await this.pool.query("UPDATE app_emoji_links SET pinned_to_app_icon = false");
      }
      await this.pool.query(
        `INSERT INTO app_emoji_links (id, emoji_code, target_url, title, icon_url, pinned_to_app_icon, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          id,
          input.emojiCode,
          input.targetUrl,
          input.title,
          input.iconUrl,
          input.pinnedToAppIcon,
          input.createdBy
        ]
      );
      return {
        id,
        emojiCode: input.emojiCode,
        targetUrl: input.targetUrl,
        title: input.title,
        iconUrl: input.iconUrl,
        pinnedToAppIcon: input.pinnedToAppIcon,
        createdBy: input.createdBy,
        createdAt
      };
    }
    if (input.pinnedToAppIcon) {
      this.memEmojiLinks = this.memEmojiLinks.map((item) => ({ ...item, pinnedToAppIcon: false }));
    }
    const record = {
      id,
      emojiCode: input.emojiCode,
      targetUrl: input.targetUrl,
      title: input.title,
      iconUrl: input.iconUrl,
      pinnedToAppIcon: input.pinnedToAppIcon,
      createdBy: input.createdBy,
      createdAt
    };
    this.memEmojiLinks.unshift(record);
    await this.persistMemory();
    return record;
  }
  async pinEmojiLink(id) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const check = await this.pool.query("SELECT id FROM app_emoji_links WHERE id = $1 LIMIT 1", [id]);
      if (!check.rowCount) return null;
      await this.pool.query("UPDATE app_emoji_links SET pinned_to_app_icon = false");
      const res = await this.pool.query(
        `UPDATE app_emoji_links SET pinned_to_app_icon = true WHERE id = $1
         RETURNING id, emoji_code, target_url, title, icon_url, pinned_to_app_icon, created_by, created_at`,
        [id]
      );
      const r = res.rows[0];
      if (!r) return null;
      return {
        id: String(r.id),
        emojiCode: String(r.emoji_code),
        targetUrl: String(r.target_url),
        title: String(r.title),
        iconUrl: String(r.icon_url || DEFAULT_AVATAR),
        pinnedToAppIcon: Boolean(r.pinned_to_app_icon),
        createdBy: String(r.created_by || "Admin"),
        createdAt: new Date(String(r.created_at)).toISOString()
      };
    }
    const found = this.memEmojiLinks.find((item) => item.id === id);
    if (!found) return null;
    this.memEmojiLinks = this.memEmojiLinks.map((item) => ({
      ...item,
      pinnedToAppIcon: item.id === id
    }));
    await this.persistMemory();
    return this.memEmojiLinks.find((item) => item.id === id) || null;
  }
  async deleteEmojiLink(id) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("DELETE FROM app_emoji_links WHERE id = $1", [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memEmojiLinks.length;
    this.memEmojiLinks = this.memEmojiLinks.filter((item) => item.id !== id);
    const deleted = this.memEmojiLinks.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }
  async resolveEmojiLink(emojiCode) {
    const links = await this.listEmojiLinks();
    const clean = (emojiCode || "").trim();
    if (clean) {
      const matched = links.find((l) => l.emojiCode.trim() === clean || l.id === clean);
      if (matched) return matched;
    }
    return links.find((l) => l.pinnedToAppIcon) || links[0] || null;
  }
  async listStudioNotes() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, title, category, entries, organized_prompt, created_at, updated_at
         FROM app_studio_notes
         ORDER BY updated_at DESC`
      );
      return res.rows.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        category: String(r.category || "App Features"),
        entries: Array.isArray(r.entries) ? r.entries : [],
        organizedPrompt: String(r.organized_prompt || ""),
        createdAt: new Date(String(r.created_at)).toISOString(),
        updatedAt: new Date(String(r.updated_at)).toISOString()
      }));
    }
    return [...this.memStudioNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getStudioNoteById(id) {
    const notes = await this.listStudioNotes();
    return notes.find((n) => n.id === id) || null;
  }
  async createStudioNoteFile(input) {
    await this.ready();
    const id = "sn_" + crypto.randomUUID().slice(0, 12);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_studio_notes (id, title, category, entries, organized_prompt, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, NOW(), NOW())`,
        [id, input.title, input.category, JSON.stringify(input.entries), input.organizedPrompt]
      );
      return {
        id,
        title: input.title,
        category: input.category,
        entries: input.entries,
        organizedPrompt: input.organizedPrompt,
        createdAt: now,
        updatedAt: now
      };
    }
    const created = {
      id,
      title: input.title,
      category: input.category,
      entries: input.entries,
      organizedPrompt: input.organizedPrompt,
      createdAt: now,
      updatedAt: now
    };
    this.memStudioNotes.unshift(created);
    await this.persistMemory();
    return created;
  }
  async updateStudioNoteFile(id, patch) {
    await this.ready();
    const existing = await this.getStudioNoteById(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      title: patch.title !== void 0 ? patch.title : existing.title,
      category: patch.category !== void 0 ? patch.category : existing.category,
      entries: patch.entries !== void 0 ? patch.entries : existing.entries,
      organizedPrompt: patch.organizedPrompt !== void 0 ? patch.organizedPrompt : existing.organizedPrompt,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `UPDATE app_studio_notes
         SET title = $2, category = $3, entries = $4::jsonb, organized_prompt = $5, updated_at = NOW()
         WHERE id = $1`,
        [id, updated.title, updated.category, JSON.stringify(updated.entries), updated.organizedPrompt]
      );
      return updated;
    }
    this.memStudioNotes = this.memStudioNotes.map((n) => n.id === id ? updated : n);
    await this.persistMemory();
    return updated;
  }
  async deleteStudioNoteFile(id) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("DELETE FROM app_studio_notes WHERE id = $1", [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memStudioNotes.length;
    this.memStudioNotes = this.memStudioNotes.filter((n) => n.id !== id);
    const deleted = this.memStudioNotes.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }
  async listEnvVault() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, category, key_name, value, secret, notes, updated_at
         FROM app_env_vault
         ORDER BY category ASC, key_name ASC`
      );
      return res.rows.map((r) => ({
        id: String(r.id),
        category: String(r.category || "Code & Custom"),
        keyName: String(r.key_name),
        value: String(r.value || ""),
        secret: Boolean(r.secret),
        notes: typeof r.notes === "string" && r.notes ? r.notes : void 0,
        updatedAt: new Date(String(r.updated_at)).toISOString()
      }));
    }
    return [...this.memEnvVault].sort(
      (a, b) => a.category === b.category ? a.keyName.localeCompare(b.keyName) : a.category.localeCompare(b.category)
    );
  }
  async upsertEnvVaultEntry(input) {
    await this.ready();
    const id = input.id && input.id.trim() ? input.id.trim() : "ev_" + crypto.randomUUID().slice(0, 12);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      category: input.category,
      keyName: input.keyName,
      value: input.value,
      secret: input.secret,
      notes: input.notes,
      updatedAt: now
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_env_vault (id, category, key_name, value, secret, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE
           SET category = EXCLUDED.category,
               key_name = EXCLUDED.key_name,
               value = EXCLUDED.value,
               secret = EXCLUDED.secret,
               notes = EXCLUDED.notes,
               updated_at = NOW()`,
        [id, record.category, record.keyName, record.value, record.secret, record.notes || ""]
      );
      return record;
    }
    const idx = this.memEnvVault.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.memEnvVault[idx] = record;
    } else {
      this.memEnvVault.push(record);
    }
    await this.persistMemory();
    return record;
  }
  async deleteEnvVaultEntry(id) {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("DELETE FROM app_env_vault WHERE id = $1", [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memEnvVault.length;
    this.memEnvVault = this.memEnvVault.filter((e) => e.id !== id);
    const deleted = this.memEnvVault.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }
  // ---- NEWSFEED ANNOUNCEMENT SLIDE BANNERS ----
  async listAnnouncements() {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, title, message, badge, tone, target, active, created_by, created_at, updated_at
         FROM app_announcements
         ORDER BY updated_at DESC, created_at DESC`
      );
      return res.rows.map((r) => ({
        id: String(r.id),
        title: String(r.title || ""),
        message: String(r.message || ""),
        badge: normalizeAnnouncementBadge(r.badge),
        tone: normalizeAnnouncementTone(r.tone),
        target: normalizeAnnouncementTarget(r.target),
        active: Boolean(r.active),
        createdBy: String(r.created_by || "Admin"),
        createdAt: new Date(String(r.created_at)).toISOString(),
        updatedAt: new Date(String(r.updated_at)).toISOString()
      }));
    }
    return [...this.memAnnouncements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async createAnnouncement(input) {
    await this.ready();
    const id = "ann_" + crypto.randomUUID().slice(0, 12);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id,
      title: input.title.trim().slice(0, 120),
      message: input.message.trim().slice(0, 500),
      badge: normalizeAnnouncementBadge(input.badge),
      tone: normalizeAnnouncementTone(input.tone),
      target: normalizeAnnouncementTarget(input.target),
      active: input.active !== false,
      createdBy: (input.createdBy || "Admin").trim().slice(0, 80) || "Admin",
      createdAt: now,
      updatedAt: now
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_announcements (id, title, message, badge, tone, target, active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [record.id, record.title, record.message, record.badge, record.tone, record.target, record.active, record.createdBy]
      );
      return record;
    }
    this.memAnnouncements.unshift(record);
    await this.persistMemory();
    return record;
  }
  async updateAnnouncement(id, patch) {
    await this.ready();
    const cleanId = id.trim();
    if (!cleanId) return null;
    if (this.usePostgres && this.pool) {
      const existingRes = await this.pool.query(
        `SELECT id, title, message, badge, tone, target, active, created_by, created_at, updated_at
         FROM app_announcements WHERE id = $1 LIMIT 1`,
        [cleanId]
      );
      if (!existingRes.rowCount || !existingRes.rows[0]) return null;
      const cur2 = existingRes.rows[0];
      const next2 = {
        id: String(cur2.id),
        title: typeof patch.title === "string" && patch.title.trim() ? patch.title.trim().slice(0, 120) : String(cur2.title),
        message: typeof patch.message === "string" && patch.message.trim() ? patch.message.trim().slice(0, 500) : String(cur2.message),
        badge: patch.badge !== void 0 ? normalizeAnnouncementBadge(patch.badge) : normalizeAnnouncementBadge(cur2.badge),
        tone: patch.tone !== void 0 ? normalizeAnnouncementTone(patch.tone) : normalizeAnnouncementTone(cur2.tone),
        target: patch.target !== void 0 ? normalizeAnnouncementTarget(patch.target) : normalizeAnnouncementTarget(cur2.target),
        active: typeof patch.active === "boolean" ? patch.active : Boolean(cur2.active),
        createdBy: String(cur2.created_by || "Admin"),
        createdAt: new Date(String(cur2.created_at)).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await this.pool.query(
        `UPDATE app_announcements
         SET title = $1, message = $2, badge = $3, tone = $4, target = $5, active = $6, updated_at = NOW()
         WHERE id = $7`,
        [next2.title, next2.message, next2.badge, next2.tone, next2.target, next2.active, cleanId]
      );
      return next2;
    }
    const idx = this.memAnnouncements.findIndex((a) => a.id === cleanId);
    if (idx < 0) return null;
    const cur = this.memAnnouncements[idx];
    const next = {
      ...cur,
      title: typeof patch.title === "string" && patch.title.trim() ? patch.title.trim().slice(0, 120) : cur.title,
      message: typeof patch.message === "string" && patch.message.trim() ? patch.message.trim().slice(0, 500) : cur.message,
      badge: patch.badge !== void 0 ? normalizeAnnouncementBadge(patch.badge) : cur.badge,
      tone: patch.tone !== void 0 ? normalizeAnnouncementTone(patch.tone) : cur.tone,
      target: patch.target !== void 0 ? normalizeAnnouncementTarget(patch.target) : cur.target,
      active: typeof patch.active === "boolean" ? patch.active : cur.active,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.memAnnouncements[idx] = next;
    await this.persistMemory();
    return next;
  }
  async deleteAnnouncement(id) {
    await this.ready();
    const cleanId = id.trim();
    if (!cleanId) return false;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("DELETE FROM app_announcements WHERE id = $1", [cleanId]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memAnnouncements.length;
    this.memAnnouncements = this.memAnnouncements.filter((a) => a.id !== cleanId);
    const deleted = this.memAnnouncements.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }
  async exportCloudBackup() {
    await this.ready();
    let users;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query("SELECT * FROM app_users ORDER BY created_at ASC");
      users = res.rows.map((r) => this.mapUserRow(r));
    } else {
      users = this.memUsers.map((u) => ({
        ...u,
        blockedUsers: [...u.blockedUsers || []],
        newsfeed: normalizeUserNewsfeed(u.newsfeed)
      }));
    }
    const [settings, newsfeedConfig, ledger, knowledge, announcements] = await Promise.all([
      this.getSettings(),
      this.getNewsfeedConfig(),
      this.listLedger(),
      this.listKnowledge(),
      this.listAnnouncements()
    ]);
    return {
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      users,
      settings,
      newsfeedConfig,
      ledger,
      knowledge,
      announcements
    };
  }
  async restoreCloudBackup(input) {
    await this.ready();
    let restoredUsersCount = 0;
    let restoredLedgerCount = 0;
    let restoredKnowledgeCount = 0;
    let restoredAnnouncementsCount = 0;
    const incomingUsers = Array.isArray(input.users) ? input.users : [];
    for (const raw of incomingUsers) {
      if (!raw || typeof raw !== "object") continue;
      const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 128) : "";
      const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 100) : "";
      const phone = typeof raw.phone === "string" ? normalizePhone(raw.phone).slice(0, 64) : "";
      const pinHash = typeof raw.pinHash === "string" ? raw.pinHash.trim().slice(0, 256) : "";
      if (!id || !name || !phone || pinHash.length < 10 || !pinHash.includes(":")) continue;
      const role = raw.role === "admin" ? "admin" : "member";
      const status = raw.status === "pending" ? "pending" : "approved";
      const blockedUsers = Array.isArray(raw.blockedUsers) ? raw.blockedUsers.filter((b) => typeof b === "string" && b.trim().length > 0).slice(0, 100).map((b) => b.trim().slice(0, 80)) : [];
      const avatar = sanitizeMediaUrl(raw.avatar);
      const newsfeed = normalizeUserNewsfeed(raw.newsfeed);
      const createdAt = typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt)) ? new Date(raw.createdAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
      const updatedAt = typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt)) ? new Date(raw.updatedAt).toISOString() : createdAt;
      if (this.usePostgres && this.pool) {
        const existingRes = await this.pool.query(
          "SELECT id FROM app_users WHERE id = $1 OR phone = $2 LIMIT 1",
          [id, phone]
        );
        if (!existingRes.rowCount) {
          await this.pool.query(
            `INSERT INTO app_users (id, name, phone, pin_hash, role, status, blocked_users, avatar_url, newsfeed, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::timestamptz, $11::timestamptz)`,
            [
              id,
              name,
              phone,
              pinHash,
              role,
              status,
              JSON.stringify(blockedUsers),
              avatar ?? null,
              newsfeed,
              createdAt,
              updatedAt
            ]
          );
          restoredUsersCount += 1;
        }
      } else {
        const exists = this.memUsers.some(
          (u) => u.id === id || normalizePhone(u.phone) === phone
        );
        if (!exists) {
          this.memUsers.push({
            id,
            name,
            phone,
            pinHash,
            role,
            status,
            blockedUsers,
            avatar,
            newsfeed,
            createdAt,
            updatedAt
          });
          restoredUsersCount += 1;
        }
      }
    }
    if (input.newsfeedConfig && typeof input.newsfeedConfig === "object") {
      const currentNf = await this.getNewsfeedConfig();
      const isDefaultNf = currentNf.feedATitle === DEFAULT_NEWSFEED_CONFIG.feedATitle && currentNf.feedBTitle === DEFAULT_NEWSFEED_CONFIG.feedBTitle && currentNf.feedCTitle === DEFAULT_NEWSFEED_CONFIG.feedCTitle;
      if (isDefaultNf) {
        await this.saveNewsfeedConfig(input.newsfeedConfig);
      }
    }
    if (input.settings && typeof input.settings === "object") {
      const currentSettings = await this.getSettings();
      const isDefaultSettings = currentSettings.fiveH === DEFAULT_SETTINGS.fiveH && currentSettings.bulig === DEFAULT_SETTINGS.bulig && currentSettings.point5 === DEFAULT_SETTINGS.point5 && currentSettings.halfSack === DEFAULT_SETTINGS.halfSack && currentSettings.oneSack === DEFAULT_SETTINGS.oneSack;
      if (isDefaultSettings) {
        await this.saveSettings({
          fiveH: clampNum(input.settings.fiveH ?? currentSettings.fiveH, 0, 1e6),
          bulig: clampNum(input.settings.bulig ?? currentSettings.bulig, 0, 1e6),
          point5: clampNum(input.settings.point5 ?? currentSettings.point5, 0, 1e6),
          halfSack: clampNum(input.settings.halfSack ?? currentSettings.halfSack, 0, 1e6),
          oneSack: clampNum(input.settings.oneSack ?? currentSettings.oneSack, 0, 1e6),
          defFiveH: clampNum(input.settings.defFiveH ?? currentSettings.defFiveH, 0, 1e6),
          defBulig: clampNum(input.settings.defBulig ?? currentSettings.defBulig, 0, 1e6),
          defPoint5: clampNum(input.settings.defPoint5 ?? currentSettings.defPoint5, 0, 1e6),
          defHalfSack: clampNum(input.settings.defHalfSack ?? currentSettings.defHalfSack, 0, 1e6),
          defOneSack: clampNum(input.settings.defOneSack ?? currentSettings.defOneSack, 0, 1e6)
        });
      }
    }
    const incomingLedger = Array.isArray(input.ledger) ? input.ledger : [];
    for (const rawRow of incomingLedger) {
      if (!rawRow || typeof rawRow !== "object") continue;
      const id = typeof rawRow.id === "string" ? rawRow.id.trim().slice(0, 128) : "";
      const name = typeof rawRow.name === "string" ? rawRow.name.trim().slice(0, 100) : "";
      if (!id || !name) continue;
      if (this.usePostgres && this.pool) {
        const existsRes = await this.pool.query("SELECT id FROM app_ledger WHERE id = $1 LIMIT 1", [id]);
        if (!existsRes.rowCount) {
          await this.pool.query(
            `INSERT INTO app_ledger (id, name, five_h, five_h_type, bulig, point5, half_sack, one_sack, bal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              id,
              name,
              clampNum(rawRow.fiveH, -1e6, 1e6),
              rawRow.fiveHType === "red" ? "red" : "blue",
              clampNum(rawRow.bulig, -1e6, 1e6),
              clampNum(rawRow.point5, -1e6, 1e6),
              clampNum(rawRow.halfSack, -1e6, 1e6),
              clampNum(rawRow.oneSack, -1e6, 1e6),
              clampNum(rawRow.bal, -1e8, 1e8)
            ]
          );
          restoredLedgerCount += 1;
        }
      } else if (!this.memLedger.some((r) => r.id === id)) {
        this.memLedger.push({
          id,
          name,
          fiveH: clampNum(rawRow.fiveH, -1e6, 1e6),
          fiveHType: rawRow.fiveHType === "red" ? "red" : "blue",
          bulig: clampNum(rawRow.bulig, -1e6, 1e6),
          point5: clampNum(rawRow.point5, -1e6, 1e6),
          halfSack: clampNum(rawRow.halfSack, -1e6, 1e6),
          oneSack: clampNum(rawRow.oneSack, -1e6, 1e6),
          bal: clampNum(rawRow.bal, -1e8, 1e8),
          updatedAt: typeof rawRow.updatedAt === "string" ? rawRow.updatedAt : (/* @__PURE__ */ new Date()).toISOString()
        });
        restoredLedgerCount += 1;
      }
    }
    const incomingKnowledge = Array.isArray(input.knowledge) ? input.knowledge : [];
    for (const rawQa of incomingKnowledge) {
      if (!rawQa || typeof rawQa !== "object") continue;
      const id = typeof rawQa.id === "string" ? rawQa.id.trim().slice(0, 128) : "";
      const question = typeof rawQa.question === "string" ? rawQa.question.trim().slice(0, 300) : "";
      const answer = typeof rawQa.answer === "string" ? rawQa.answer.trim().slice(0, 2e3) : "";
      if (!id || !question || !answer) continue;
      if (this.usePostgres && this.pool) {
        const existsRes = await this.pool.query("SELECT id FROM app_knowledge WHERE id = $1 LIMIT 1", [id]);
        if (!existsRes.rowCount) {
          await this.pool.query("INSERT INTO app_knowledge (id, question, answer) VALUES ($1, $2, $3)", [
            id,
            question,
            answer
          ]);
          restoredKnowledgeCount += 1;
        }
      } else if (!this.memKnowledge.some((k) => k.id === id)) {
        this.memKnowledge.push({
          id,
          question,
          answer,
          createdAt: typeof rawQa.createdAt === "string" ? rawQa.createdAt : (/* @__PURE__ */ new Date()).toISOString()
        });
        restoredKnowledgeCount += 1;
      }
    }
    const incomingAnnouncements = Array.isArray(input.announcements) ? input.announcements : [];
    for (const rawAnn of incomingAnnouncements) {
      if (!rawAnn || typeof rawAnn !== "object") continue;
      const id = typeof rawAnn.id === "string" ? rawAnn.id.trim().slice(0, 128) : "";
      const title = typeof rawAnn.title === "string" ? rawAnn.title.trim().slice(0, 120) : "";
      const message = typeof rawAnn.message === "string" ? rawAnn.message.trim().slice(0, 1e3) : "";
      if (!id || !title || !message) continue;
      const badge = normalizeAnnouncementBadge(rawAnn.badge);
      const tone = normalizeAnnouncementTone(rawAnn.tone);
      const target = normalizeAnnouncementTarget(rawAnn.target);
      const active = rawAnn.active !== false;
      const createdBy = typeof rawAnn.createdBy === "string" && rawAnn.createdBy.trim() ? rawAnn.createdBy.trim().slice(0, 80) : "Admin";
      const createdAt = typeof rawAnn.createdAt === "string" ? rawAnn.createdAt : (/* @__PURE__ */ new Date()).toISOString();
      const updatedAt = typeof rawAnn.updatedAt === "string" ? rawAnn.updatedAt : createdAt;
      if (this.usePostgres && this.pool) {
        const existsRes = await this.pool.query("SELECT id FROM app_announcements WHERE id = $1 LIMIT 1", [id]);
        if (!existsRes.rowCount) {
          await this.pool.query(
            `INSERT INTO app_announcements (id, title, message, badge, tone, target, active, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz)`,
            [id, title, message, badge, tone, target, active, createdBy, createdAt, updatedAt]
          );
          restoredAnnouncementsCount += 1;
        }
      } else if (!this.memAnnouncements.some((a) => a.id === id)) {
        this.memAnnouncements.push({
          id,
          title,
          message,
          badge,
          tone,
          target,
          active,
          createdBy,
          createdAt,
          updatedAt
        });
        restoredAnnouncementsCount += 1;
      }
    }
    if (!this.usePostgres && (restoredUsersCount > 0 || restoredLedgerCount > 0 || restoredKnowledgeCount > 0 || restoredAnnouncementsCount > 0)) {
      await this.persistMemory();
    }
    let totalUsersCount = this.memUsers.length;
    if (this.usePostgres && this.pool) {
      const countRes = await this.pool.query("SELECT COUNT(*)::int AS cnt FROM app_users");
      totalUsersCount = Number(countRes.rows[0]?.cnt || 0);
    }
    return {
      restoredUsersCount,
      totalUsersCount,
      restoredLedgerCount,
      restoredKnowledgeCount,
      restoredAnnouncementsCount
    };
  }
  mapUserRow(r) {
    const rawAvatar = typeof r.avatar_url === "string" ? r.avatar_url.trim() : "";
    const newsfeed = normalizeUserNewsfeed(r.newsfeed);
    return {
      id: String(r.id),
      name: String(r.name),
      phone: String(r.phone),
      pinHash: String(r.pin_hash),
      role: r.role === "admin" ? "admin" : "member",
      status: String(r.status || "").trim().toLowerCase() === "approved" ? "approved" : "pending",
      blockedUsers: Array.isArray(r.blocked_users) ? r.blocked_users : [],
      avatar: rawAvatar || void 0,
      newsfeed,
      createdAt: new Date(String(r.created_at)).toISOString(),
      updatedAt: new Date(String(r.updated_at)).toISOString()
    };
  }
};

// src/server/supabaseStorage.ts
import crypto2 from "crypto";
var ALLOWED_MIME_MAP = {
  "image/jpeg": { ext: ".jpg", category: "image", maxBytes: 10 * 1024 * 1024 },
  "image/jpg": { ext: ".jpg", category: "image", maxBytes: 10 * 1024 * 1024 },
  "image/png": { ext: ".png", category: "image", maxBytes: 10 * 1024 * 1024 },
  "image/webp": { ext: ".webp", category: "image", maxBytes: 10 * 1024 * 1024 },
  "image/gif": { ext: ".gif", category: "image", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { ext: ".mp4", category: "video", maxBytes: 25 * 1024 * 1024 },
  "video/webm": { ext: ".webm", category: "video", maxBytes: 25 * 1024 * 1024 },
  "video/quicktime": { ext: ".mov", category: "video", maxBytes: 25 * 1024 * 1024 },
  "audio/webm": { ext: ".webm", category: "audio", maxBytes: 15 * 1024 * 1024 },
  "audio/ogg": { ext: ".ogg", category: "audio", maxBytes: 15 * 1024 * 1024 },
  "audio/mp4": { ext: ".m4a", category: "audio", maxBytes: 15 * 1024 * 1024 },
  "audio/mpeg": { ext: ".mp3", category: "audio", maxBytes: 15 * 1024 * 1024 },
  "audio/mp3": { ext: ".mp3", category: "audio", maxBytes: 15 * 1024 * 1024 },
  "audio/wav": { ext: ".wav", category: "audio", maxBytes: 15 * 1024 * 1024 },
  "audio/aac": { ext: ".aac", category: "audio", maxBytes: 15 * 1024 * 1024 },
  "audio/x-m4a": { ext: ".m4a", category: "audio", maxBytes: 15 * 1024 * 1024 }
};
var ALLOWED_FOLDERS = /* @__PURE__ */ new Set(["posts", "messages", "voice", "avatars"]);
var ensuredBucketKey = "";
function stripOuterQuotes(val) {
  const t = val.trim();
  if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).trim();
  }
  return t;
}
function getValidatedSupabaseOrigin() {
  const raw = stripOuterQuotes(process.env.SUPABASE_URL || "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return "";
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".supabase.co") && !host.endsWith(".supabase.in")) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}
function getSupabaseServiceKey() {
  return stripOuterQuotes(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
  );
}
function getSanitizedBucket() {
  const raw = stripOuterQuotes(process.env.SUPABASE_BUCKET || "choychat-media").toLowerCase();
  if (/^[a-z0-9][a-z0-9._-]{1,62}$/.test(raw)) {
    return raw;
  }
  return "choychat-media";
}
function normalizeMediaMime(rawContentType) {
  if (!rawContentType) return "";
  return rawContentType.split(";")[0].trim().toLowerCase();
}
function sanitizeUploadFolder(rawFolder) {
  const normalized = (rawFolder || "").trim().toLowerCase();
  return ALLOWED_FOLDERS.has(normalized) ? normalized : "posts";
}
function getSupabaseStorageStatus() {
  const origin = getValidatedSupabaseOrigin();
  const serviceKey = getSupabaseServiceKey();
  const bucket = getSanitizedBucket();
  return {
    configured: Boolean(origin && serviceKey),
    bucket,
    hasUrl: Boolean(origin),
    hasServiceKey: Boolean(serviceKey)
  };
}
function buildSupabaseHeaders(serviceKey, extra) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra || {}
  };
}
async function ensurePublicBucket(origin, serviceKey, bucket) {
  const cacheKey = `${origin}|${bucket}`;
  if (ensuredBucketKey === cacheKey) return;
  const checkRes = await fetch(`${origin}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    method: "GET",
    headers: buildSupabaseHeaders(serviceKey)
  });
  if (checkRes.ok) {
    ensuredBucketKey = cacheKey;
    return;
  }
  const createRes = await fetch(`${origin}/storage/v1/bucket`, {
    method: "POST",
    headers: buildSupabaseHeaders(serviceKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: true,
      file_size_limit: 26214400
    })
  });
  if (createRes.ok || createRes.status === 409) {
    ensuredBucketKey = cacheKey;
    return;
  }
  const errText = await createRes.text().catch(() => "");
  if (errText.toLowerCase().includes("already exists") || errText.toLowerCase().includes("duplicate")) {
    ensuredBucketKey = cacheKey;
    return;
  }
  throw new Error(`Supabase bucket setup failed (HTTP ${createRes.status})`);
}
async function uploadToSupabaseStorage(buffer, rawMimeType, rawFolder) {
  const origin = getValidatedSupabaseOrigin();
  const serviceKey = getSupabaseServiceKey();
  const bucket = getSanitizedBucket();
  if (!origin || !serviceKey) {
    throw new Error("Supabase Storage is not configured");
  }
  const mimeType = normalizeMediaMime(rawMimeType);
  const spec = ALLOWED_MIME_MAP[mimeType];
  if (!spec) {
    throw new Error("Unsupported media format. Allowed: JPG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, OGG, M4A, WAV.");
  }
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty file upload");
  }
  if (buffer.length > spec.maxBytes) {
    const maxMb = Math.round(spec.maxBytes / (1024 * 1024));
    throw new Error(`File exceeds maximum allowed size (${maxMb} MB for ${spec.category}).`);
  }
  await ensurePublicBucket(origin, serviceKey, bucket);
  const folder = sanitizeUploadFolder(rawFolder);
  const now = /* @__PURE__ */ new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const objectPath = `${folder}/${ym}/${crypto2.randomUUID()}${spec.ext}`;
  const uploadUrl = `${origin}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: buildSupabaseHeaders(serviceKey, {
      "Content-Type": mimeType === "image/jpg" ? "image/jpeg" : mimeType,
      "x-upsert": "false",
      "cache-control": "31536000"
    }),
    body: new Uint8Array(buffer)
  });
  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    throw new Error(`Supabase upload failed (HTTP ${uploadRes.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  const publicUrl = `${origin}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`;
  return {
    url: publicUrl,
    path: objectPath,
    bucket,
    mediaType: spec.category,
    mimeType,
    sizeBytes: buffer.length
  };
}

// server.ts
var require2 = createRequire(import.meta.url);
var webpush = require2("web-push");
dotenv.config();
if (fs2.existsSync("/etc/secrets/.env")) {
  dotenv.config({ path: "/etc/secrets/.env", override: false });
}
var __dirname = path2.dirname(fileURLToPath(import.meta.url));
var store = new ChoyStore();
var DEFAULT_PROFILE_ICON = "/assets/aistudio/image_20261121_145253_f477cbfa.webp";
function getSafePushIcon(avatar) {
  const clean = typeof avatar === "string" ? avatar.trim() : "";
  if (clean && (clean.startsWith("https://") || clean.startsWith("/assets/"))) {
    return clean;
  }
  return DEFAULT_PROFILE_ICON;
}
function escapeHtml(raw) {
  return String(raw || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var sseClients = /* @__PURE__ */ new Set();
var userLastSeenMap = /* @__PURE__ */ new Map();
function getChannelsForNewsfeed(nf) {
  const v = (nf || "").trim().toLowerCase();
  if (v === "feed_b") return /* @__PURE__ */ new Set(["b"]);
  if (v === "feed_c") return /* @__PURE__ */ new Set(["c"]);
  if (v === "feed_bc") return /* @__PURE__ */ new Set(["b", "c"]);
  if (v === "both") return /* @__PURE__ */ new Set(["a", "b", "c"]);
  return /* @__PURE__ */ new Set(["a"]);
}
function hasNewsfeedOverlap(nfA, nfB) {
  const setA = getChannelsForNewsfeed(nfA);
  const setB = getChannelsForNewsfeed(nfB);
  for (const ch of setA) {
    if (setB.has(ch)) return true;
  }
  return false;
}
function canViewerSeeUser(viewer, candidate) {
  if (viewer.role === "admin") return true;
  if (candidate.id === viewer.id) return true;
  if (candidate.role === "admin") return true;
  return hasNewsfeedOverlap(normalizeUserNewsfeed(viewer.newsfeed), normalizeUserNewsfeed(candidate.newsfeed));
}
function canViewerSeePost(viewer, post) {
  if (viewer.role === "admin") return true;
  if (post.authorId === viewer.id) return true;
  if ((post.newsfeed || "").trim().toLowerCase() === "both") return true;
  return hasNewsfeedOverlap(normalizeUserNewsfeed(viewer.newsfeed), normalizePostNewsfeed(post.newsfeed));
}
function canViewerSeeAnnouncement(viewer, ann) {
  if (viewer.role === "admin") return true;
  if (!ann.active) return false;
  if (ann.target === "all") return true;
  return hasNewsfeedOverlap(normalizeUserNewsfeed(viewer.newsfeed), normalizeAnnouncementTarget(ann.target));
}
function verifyCookieCsrf(req) {
  const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
  if (hasBearer) return true;
  const origin = req.headers.origin;
  const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
  const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
  let originMatches = false;
  if (typeof origin === "string" && expectedHost) {
    try {
      originMatches = new URL(origin).host === expectedHost;
    } catch {
      originMatches = false;
    }
  }
  return originMatches || hasRequestedWith;
}
var vapidReadyPromise = null;
async function ensureWebPushConfigured() {
  if (!vapidReadyPromise) {
    vapidReadyPromise = (async () => {
      const keys = await store.getOrCreateVapidKeys(() => webpush.generateVAPIDKeys());
      const subject = (process.env.VAPID_SUBJECT || "mailto:choyjiez07@gmail.com").trim();
      webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
      return keys.publicKey;
    })().catch((err) => {
      vapidReadyPromise = null;
      throw err;
    });
  }
  return vapidReadyPromise;
}
async function sendWebPushToTarget(targetName, excludeUserId, payload, urgency = "normal") {
  try {
    await ensureWebPushConfigured();
    const subs = await store.listPushSubscriptionsForTarget(targetName, excludeUserId);
    if (subs.length === 0) return 0;
    const body = JSON.stringify(payload);
    const ttl = urgency === "high" ? 90 : 86400;
    let sent = 0;
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
            },
            body,
            { TTL: ttl, urgency }
          );
          sent += 1;
        } catch (err) {
          const statusCode = typeof err === "object" && err !== null && "statusCode" in err ? Number(err.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) {
            await store.removePushSubscription(sub.endpoint).catch(() => {
            });
          }
        }
      })
    );
    return sent;
  } catch (err) {
    console.warn("[WebPush] Dispatch skipped:", err instanceof Error ? err.message : err);
    return 0;
  }
}
var rtcSignalQueue = [];
var rtcSignalSeq = 0;
function pruneRtcQueue(now = Date.now()) {
  const cutoff = now - 9e4;
  while (rtcSignalQueue.length > 0 && rtcSignalQueue[0].createdAtMs < cutoff) {
    rtcSignalQueue.shift();
  }
  if (rtcSignalQueue.length > 500) {
    rtcSignalQueue.splice(0, rtcSignalQueue.length - 500);
  }
}
function touchUserPresence(userName) {
  const key = userName.trim().toLowerCase();
  if (key) {
    userLastSeenMap.set(key, Date.now());
  }
}
function getOnlineUserNames(now = Date.now()) {
  const online = /* @__PURE__ */ new Set();
  for (const client of sseClients) {
    const key = client.userName.trim().toLowerCase();
    if (key) online.add(key);
  }
  for (const [key, lastSeen] of userLastSeenMap.entries()) {
    if (now - lastSeen <= 2e4) {
      online.add(key);
    }
  }
  return Array.from(online);
}
function broadcastSync(topic) {
  const payload = `event: sync
data: ${JSON.stringify({ topic, ts: Date.now() })}

`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}
function broadcastGpsToAdmins(userId) {
  const payload = `event: gps
data: ${JSON.stringify({ userId, ts: Date.now() })}

`;
  for (const client of sseClients) {
    if (client.role !== "admin") continue;
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}
function sendRtcSignal(targetName, senderUserId, eventPayload) {
  const now = Date.now();
  pruneRtcQueue(now);
  rtcSignalSeq += 1;
  const seq = rtcSignalSeq;
  const signalId = `sig_${seq}_${now}`;
  const enrichedPayload = {
    ...eventPayload,
    signalId,
    seq
  };
  const normalizedTarget = targetName.trim().toLowerCase();
  const isGroup = normalizedTarget === "vip group" || normalizedTarget === "";
  rtcSignalQueue.push({
    seq,
    signalId,
    targetNameLower: isGroup ? "vip group" : normalizedTarget,
    senderUserId,
    createdAtMs: now,
    payload: enrichedPayload
  });
  const payload = `event: rtc
data: ${JSON.stringify(enrichedPayload)}

`;
  let delivered = 0;
  for (const client of sseClients) {
    if (client.userId === senderUserId) continue;
    const isMatch = isGroup || client.userName.trim().toLowerCase() === normalizedTarget;
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
    if (isGroup) {
      for (const [, lastSeen] of userLastSeenMap.entries()) {
        if (now - lastSeen <= 15e3) {
          targetOnline = true;
          break;
        }
      }
    } else {
      const lastSeen = userLastSeenMap.get(normalizedTarget) || 0;
      targetOnline = now - lastSeen <= 15e3;
    }
  }
  return { delivered, targetOnline, signalId, seq };
}
var SESSION_COOKIE_NAME = "choy_session";
function readSessionCookie(req) {
  const raw = req.headers.cookie || "";
  if (!raw) return "";
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return "";
}
function setSessionCookie(req, res, token) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 7}`
  ];
  if (isHttps) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}
function clearSessionCookie(req, res) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  const attrs = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}
function stripOuterQuotes2(val) {
  const t = val.trim();
  if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).trim();
  }
  return t;
}
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = bearerToken || readSessionCookie(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  try {
    const user = await store.getUserById(session.uid);
    if (!user) {
      return res.status(401).json({ error: "Account not found" });
    }
    req.choyUser = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Session lookup failed" });
  }
}
function requireAdmin(req, res, next) {
  if (!req.choyUser || req.choyUser.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
var app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "15mb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    host: "render",
    storageMode: store.storageMode,
    storageStatus: store.storageStatus,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/auth/status", async (_req, res) => {
  await store.ready();
  const hasAdmin = await store.hasAnyAdmin();
  res.json({
    needsAdminSetup: !hasAdmin,
    storageMode: store.storageMode
  });
});
app.get("/api/admin/env-status", requireAuth, requireAdmin, async (_req, res) => {
  await store.ready();
  const mediaStorage = getSupabaseStorageStatus();
  res.json({
    storageMode: store.storageMode,
    connectionPool: store.getPoolStats(),
    mediaStorageMode: mediaStorage.configured ? "supabase" : "inline",
    defaults: {
      APP_URL: (process.env.APP_URL || "https://chat-9-si9x.onrender.com").trim(),
      ADMIN_PHONE: (process.env.ADMIN_PHONE || "09361223978").trim(),
      SUPABASE_URL: (process.env.SUPABASE_URL || "").trim(),
      SUPABASE_BUCKET: mediaStorage.bucket
    },
    configured: {
      DATABASE_URL: Boolean((process.env.DATABASE_URL || "").trim()),
      DATABASE_POOL_URL: Boolean((process.env.DATABASE_POOL_URL || "").trim()),
      ADMIN_PHONE: Boolean((process.env.ADMIN_PHONE || "").trim()),
      ADMIN_PIN: Boolean((process.env.ADMIN_PIN || "").trim()),
      APP_URL: Boolean((process.env.APP_URL || "https://chat-9-si9x.onrender.com").trim()),
      GEMINI_API_KEY: Boolean((process.env.GEMINI_API_KEY || "").trim()),
      SUPABASE_URL: mediaStorage.hasUrl,
      SUPABASE_ANON_KEY: Boolean((process.env.SUPABASE_ANON_KEY || "").trim()),
      SUPABASE_SERVICE_ROLE_KEY: mediaStorage.hasServiceKey,
      SUPABASE_BUCKET: Boolean(mediaStorage.bucket)
    }
  });
});
app.post(
  "/api/media/upload",
  requireAuth,
  express.raw({ type: () => true, limit: "26mb" }),
  async (req, res) => {
    try {
      const user = req.choyUser;
      if (!user) {
        return res.status(401).json({ error: "Authentication required to upload media" });
      }
      const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
      if (!hasBearer) {
        const origin = req.headers.origin;
        const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
        const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
        let originMatches = false;
        if (typeof origin === "string" && expectedHost) {
          try {
            originMatches = new URL(origin).host === expectedHost;
          } catch {
            originMatches = false;
          }
        }
        if (!originMatches && !hasRequestedWith) {
          return res.status(403).json({ error: "Cross-origin upload blocked" });
        }
      }
      const status = getSupabaseStorageStatus();
      if (!status.configured) {
        return res.json({
          uploaded: false,
          configured: false,
          fallback: true,
          bucket: status.bucket
        });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "No media data received" });
      }
      const contentType = String(req.headers["content-type"] || "");
      const folder = String(req.headers["x-media-folder"] || "posts");
      const result = await uploadToSupabaseStorage(req.body, contentType, folder);
      return res.status(201).json({
        uploaded: true,
        configured: true,
        ...result
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Media upload failed";
      const isClientErr = message.includes("Unsupported media") || message.includes("Empty file") || message.includes("exceeds maximum");
      return res.status(isClientErr ? 400 : 502).json({ error: message });
    }
  }
);
app.get("/api/auth/session", async (req, res) => {
  await store.ready();
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
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
        newsfeed: user.newsfeed
      }
    });
  } catch {
    return res.json({ authenticated: false });
  }
});
app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(req, res);
  return res.json({ ok: true });
});
var adminSetupLock = false;
app.post("/api/auth/setup-admin", async (req, res) => {
  if (adminSetupLock) {
    return res.status(409).json({ error: "Admin setup already in progress" });
  }
  adminSetupLock = true;
  try {
    await store.ready();
    if (await store.hasAnyAdmin()) {
      return res.status(409).json({ error: "Admin account is already configured. Please log in." });
    }
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const phone = typeof req.body?.phone === "string" ? normalizePhone(req.body.phone) : "";
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    if (!name || name.length > 80) {
      return res.status(400).json({ error: "Valid admin name is required" });
    }
    if (!phone || phone.length < 4 || phone.length > 40) {
      return res.status(400).json({ error: "Valid phone or username is required" });
    }
    if (!pin || pin.length < 4 || pin.length > 64) {
      return res.status(400).json({ error: "PIN must be between 4 and 64 characters" });
    }
    const user = await store.createUser({
      name,
      phone,
      pin,
      role: "admin",
      status: "approved"
    });
    const token = signSessionToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastSync("users");
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
        newsfeed: user.newsfeed
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Admin setup failed" });
  } finally {
    adminSetupLock = false;
  }
});
app.post("/api/auth/register", async (req, res) => {
  try {
    await store.ready();
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const phone = typeof req.body?.phone === "string" ? normalizePhone(req.body.phone) : "";
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    if (!name || name.length > 80) {
      return res.status(400).json({ error: "Name is required (max 80 chars)" });
    }
    if (!phone || phone.length < 4 || phone.length > 40) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    if (!pin || pin.length < 4 || pin.length > 64) {
      return res.status(400).json({ error: "PIN must be at least 4 characters" });
    }
    const existing = await store.getUserByPhone(phone);
    if (existing) {
      return res.status(409).json({ error: "Phone number is already registered. Please log in." });
    }
    const user = await store.createUser({
      name,
      phone,
      pin,
      role: "member",
      status: "approved"
    });
    const token = signSessionToken(user.id, user.role);
    setSessionCookie(req, res, token);
    broadcastSync("users");
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
        newsfeed: user.newsfeed
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Registration failed" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    await store.ready();
    const phone = typeof req.body?.phone === "string" ? normalizePhone(req.body.phone) : "";
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    if (!phone || !pin) {
      return res.status(400).json({ error: "Phone and PIN are required" });
    }
    const envAdminPin = stripOuterQuotes2(process.env.ADMIN_PIN || "");
    const envAdminPhone = normalizePhone(stripOuterQuotes2(process.env.ADMIN_PHONE || "09361223978"));
    if (envAdminPin && timingSafeStringEqual(phone, envAdminPhone) && timingSafeStringEqual(pin, envAdminPin)) {
      const adminUser = await store.ensureEnvAdminUser(envAdminPhone);
      const token2 = signSessionToken(adminUser.id, "admin");
      setSessionCookie(req, res, token2);
      return res.json({
        token: token2,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          phone: adminUser.phone,
          role: adminUser.role,
          status: adminUser.status,
          blockedUsers: adminUser.blockedUsers,
          avatar: adminUser.avatar,
          newsfeed: adminUser.newsfeed
        }
      });
    }
    const user = await store.getUserByPhone(phone);
    if (!user || !verifyPin(pin, user.pinHash)) {
      return res.status(401).json({ error: "Invalid phone or PIN" });
    }
    if (user.status !== "approved") {
      await store.updateUserStatus(user.id, "approved");
      user.status = "approved";
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
        newsfeed: user.newsfeed
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Login failed" });
  }
});
app.post("/api/auth/avatar", requireAuth, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const user = req.choyUser;
    const rawAvatar = req.body?.avatarUrl;
    let nextAvatar;
    if (rawAvatar === null || rawAvatar === void 0 || typeof rawAvatar === "string" && !rawAvatar.trim()) {
      nextAvatar = void 0;
    } else if (typeof rawAvatar === "string") {
      const trimmed = rawAvatar.trim();
      const safe = sanitizeMediaUrl(trimmed);
      const isAllowedImage = Boolean(safe) && (safe.startsWith("https://") || safe.startsWith("/assets/") || safe.startsWith("data:image/"));
      if (!isAllowedImage) {
        return res.status(400).json({ error: "Please upload a valid image (JPG, PNG, WebP, or GIF)." });
      }
      nextAvatar = safe;
    } else {
      return res.status(400).json({ error: "Invalid profile picture format." });
    }
    const updated = await store.updateUserAvatar(user.id, nextAvatar);
    if (!updated) {
      return res.status(404).json({ error: "Account not found" });
    }
    broadcastSync("users");
    broadcastSync("posts");
    return res.json({
      ok: true,
      avatar: updated.avatar || null
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update profile picture" });
  }
});
app.post("/api/auth/name", requireAuth, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const user = req.choyUser;
    const rawName = typeof req.body?.name === "string" ? req.body.name.replace(/\s+/g, " ").trim() : "";
    if (!rawName || rawName.length < 2 || rawName.length > 60 || /[\x00-\x1f\x7f]/.test(rawName)) {
      return res.status(400).json({ error: "Name must be between 2 and 60 characters." });
    }
    const reserved = /* @__PURE__ */ new Set(["vip group", "all", "everyone", "system", "member"]);
    if (reserved.has(rawName.toLowerCase())) {
      return res.status(400).json({ error: "That name is reserved. Please choose another display name." });
    }
    const result = await store.updateUserName(user.id, rawName);
    if (!result.ok) {
      return res.status(result.code === "conflict" ? 409 : 404).json({ error: result.error });
    }
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
    broadcastSync("users");
    broadcastSync("posts");
    broadcastSync("messages");
    return res.json({
      ok: true,
      name: result.user.name,
      previousName: result.previousName
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update name" });
  }
});
var handleSelfDeleteAccount = async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const user = req.choyUser;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (user.role === "admin") {
      return res.status(403).json({ error: "Admin account cannot be self-deleted." });
    }
    const pin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    if (!pin || !verifyPin(pin, user.pinHash)) {
      return res.status(401).json({ error: "Incorrect PIN. Enter your current PIN to confirm account deletion." });
    }
    const deleted = await store.deleteUser(user.id);
    if (!deleted) {
      return res.status(404).json({ error: "Account could not be deleted." });
    }
    clearSessionCookie(req, res);
    broadcastSync("users");
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete account" });
  }
};
app.post("/api/auth/delete-account", requireAuth, handleSelfDeleteAccount);
app.delete("/api/auth/account", requireAuth, handleSelfDeleteAccount);
app.get("/api/choy/stream", requireAuth, (req, res) => {
  const user = req.choyUser;
  touchUserPresence(user.name);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Content-Encoding", "identity");
  res.flushHeaders?.();
  res.write(`:${" ".repeat(2048)}

`);
  res.write(`event: connected
data: ${JSON.stringify({ ok: true, uid: user.id, latestRtcSeq: rtcSignalSeq })}

`);
  const client = { res, userId: user.id, userName: user.name, role: user.role };
  sseClients.add(client);
  const keepAlive = setInterval(() => {
    try {
      touchUserPresence(user.name);
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(client);
    }
  }, 15e3);
  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(client);
  });
});
app.get("/api/choy/push/vapid-public-key", requireAuth, async (_req, res) => {
  try {
    const publicKey = await ensureWebPushConfigured();
    return res.json({ publicKey });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Push service unavailable" });
  }
});
app.post("/api/choy/push/subscribe", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    touchUserPresence(user.name);
    const sub = req.body?.subscription || req.body;
    const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint.trim() : "";
    const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh.trim() : "";
    const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth.trim() : "";
    if (!endpoint || !endpoint.startsWith("https://") || !p256dh || !auth) {
      return res.status(400).json({ error: "Valid push subscription with HTTPS endpoint and keys is required" });
    }
    await store.savePushSubscription({
      endpoint,
      userId: user.id,
      userName: user.name,
      keys: { p256dh, auth }
    });
    return res.json({ ok: true, subscribed: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save push subscription" });
  }
});
app.post("/api/choy/push/unsubscribe", requireAuth, async (req, res) => {
  try {
    const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";
    if (endpoint) {
      await store.removePushSubscription(endpoint);
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to unsubscribe" });
  }
});
app.post("/api/choy/presence", requireAuth, (req, res) => {
  const user = req.choyUser;
  touchUserPresence(user.name);
  broadcastSync("presence");
  return res.json({ ok: true, onlineUsers: getOnlineUserNames() });
});
app.get("/api/choy/rtc/poll", requireAuth, (req, res) => {
  const user = req.choyUser;
  const now = Date.now();
  touchUserPresence(user.name);
  pruneRtcQueue(now);
  const rawSince = Number(req.query.since);
  const since = Number.isFinite(rawSince) && rawSince > 0 ? rawSince : 0;
  const myNameLower = user.name.trim().toLowerCase();
  const minFreshTs = since === 0 ? now - 75e3 : 0;
  const matched = rtcSignalQueue.filter((item) => {
    if (item.seq <= since) return false;
    if (since === 0 && item.createdAtMs < minFreshTs) return false;
    if (item.senderUserId === user.id) return false;
    return item.targetNameLower === "vip group" || item.targetNameLower === "" || item.targetNameLower === myNameLower;
  });
  return res.json({
    signals: matched.map((m) => m.payload),
    latestSeq: rtcSignalSeq
  });
});
app.post("/api/choy/gps/ping", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    const { lat, lng, accuracy, speed, heading } = req.body || {};
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: "Valid lat and lng required" });
    }
    const safeAcc = typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : void 0;
    const safeSpeed = typeof speed === "number" && Number.isFinite(speed) && speed >= 0 ? speed : void 0;
    const safeHeading = typeof heading === "number" && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : void 0;
    await store.upsertLocation(user.id, user.name, lat, lng, safeAcc, safeSpeed, safeHeading);
    broadcastGpsToAdmins(user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[GPS Ping Error]:", err);
    res.status(500).json({ error: "Failed to record location" });
  }
});
app.get("/api/admin/gps/locations", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const [locations, users] = await Promise.all([store.getAllLocations(), store.listUsers(true)]);
    const avatarById = /* @__PURE__ */ new Map();
    for (const u of users) {
      avatarById.set(u.id, u.avatar);
    }
    res.json({
      locations: locations.map((l) => ({
        ...l,
        avatar: avatarById.get(l.userId)
      }))
    });
  } catch (err) {
    console.error("[Get GPS Locations Error]:", err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});
app.get("/api/choy/emoji-links", requireAuth, async (_req, res) => {
  try {
    const emojiLinks = await store.listEmojiLinks();
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;
    return res.json({ emojiLinks, activeEmojiLink });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load emoji links" });
  }
});
app.post("/api/choy/emoji-links", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.choyUser;
    const rawEmoji = typeof req.body?.emojiCode === "string" ? req.body.emojiCode.trim() : "";
    const safeUrl = sanitizeWebsiteUrl(req.body?.targetUrl);
    if (!rawEmoji || rawEmoji.length > 64) {
      return res.status(400).json({ error: "Valid emoji code (1\u201364 chars) is required" });
    }
    if (!safeUrl) {
      return res.status(400).json({ error: "Valid http:// or https:// live website URL is required" });
    }
    const rawTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const title = (rawTitle || "Choy Chat Live").slice(0, 80);
    const iconUrl = sanitizeMediaUrl(req.body?.iconUrl) || DEFAULT_PROFILE_ICON;
    const pinnedToAppIcon = req.body?.pinnedToAppIcon !== false;
    const autoPush = req.body?.autoPush !== false;
    const saved = await store.createEmojiLink({
      emojiCode: rawEmoji,
      targetUrl: safeUrl,
      title,
      iconUrl,
      pinnedToAppIcon,
      createdBy: user.name
    });
    const emojiLinks = await store.listEmojiLinks();
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;
    broadcastSync("emoji-links");
    if (autoPush) {
      sendWebPushToTarget("VIP Group", user.id, {
        title: `${saved.emojiCode} ${saved.title}`,
        body: "Live app emoji link updated & synced to App Icon!",
        url: `/go?e=${encodeURIComponent(saved.emojiCode)}`,
        icon: getSafePushIcon(saved.iconUrl),
        tag: "choy-emoji-link"
      }).catch(() => {
      });
    }
    return res.status(201).json({ link: saved, emojiLinks, activeEmojiLink });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save emoji link" });
  }
});
app.post("/api/choy/emoji-links/:id/pin", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = req.choyUser;
    const pinned = await store.pinEmojiLink(req.params.id);
    if (!pinned) {
      return res.status(404).json({ error: "Emoji link not found" });
    }
    const emojiLinks = await store.listEmojiLinks();
    broadcastSync("emoji-links");
    if (req.body?.autoPush !== false) {
      sendWebPushToTarget("VIP Group", user.id, {
        title: `${pinned.emojiCode} ${pinned.title}`,
        body: "App Icon Emoji Link pinned & synced across devices!",
        url: `/go?e=${encodeURIComponent(pinned.emojiCode)}`,
        icon: getSafePushIcon(pinned.iconUrl),
        tag: "choy-emoji-link"
      }).catch(() => {
      });
    }
    return res.json({ link: pinned, emojiLinks, activeEmojiLink: pinned });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to pin emoji link" });
  }
});
app.delete("/api/choy/emoji-links/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteEmojiLink(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Emoji link not found" });
    }
    const emojiLinks = await store.listEmojiLinks();
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;
    broadcastSync("emoji-links");
    return res.json({ deleted: true, emojiLinks, activeEmojiLink });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete emoji link" });
  }
});
app.get("/go", async (req, res) => {
  try {
    const codeParam = typeof req.query?.e === "string" ? req.query.e.trim() : "";
    const resolved = await store.resolveEmojiLink(codeParam);
    const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
    const host = String(req.headers["x-forwarded-host"] || req.get("host") || "chat-9-si9x.onrender.com").split(",")[0].trim();
    const baseOrigin = `${proto}://${host}`;
    const safeTargetUrl = sanitizeWebsiteUrl(resolved?.targetUrl) || baseOrigin;
    const emojiCode = resolved?.emojiCode || codeParam || "\u{1F510}\u{1F7E2}\u{1F4AC}\u2728\u{1F680}";
    const title = resolved?.title || "Choy Chat Live App";
    const rawIcon = resolved?.iconUrl || DEFAULT_PROFILE_ICON;
    const absoluteIconUrl = rawIcon.startsWith("http://") || rawIcon.startsWith("https://") ? rawIcon : `${baseOrigin}${rawIcon.startsWith("/") ? rawIcon : "/" + rawIcon}`;
    const escapedTitle = escapeHtml(`${emojiCode} ${title}`);
    const escapedDesc = escapeHtml(`Tap to open ${title} (${emojiCode}) \u2022 Live App Link`);
    const escapedIcon = escapeHtml(absoluteIconUrl);
    const escapedTarget = escapeHtml(safeTargetUrl);
    const escapedEmoji = escapeHtml(emojiCode);
    return res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(`<!doctype html>
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
        Open Live Website \u2192
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
    return res.redirect("/");
  }
});
app.post("/api/choy/rtc/signal", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    touchUserPresence(user.name);
    const type = typeof req.body?.type === "string" ? req.body.type.trim() : "";
    if (!["offer", "answer", "ice", "hangup", "decline"].includes(type)) {
      return res.status(400).json({ error: "Invalid signaling event type" });
    }
    const callId = typeof req.body?.callId === "string" ? req.body.callId.trim().slice(0, 80) : "";
    const roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim().slice(0, 80) : "VIP Group";
    const targetName = typeof req.body?.targetName === "string" && req.body.targetName.trim() ? req.body.targetName.trim().slice(0, 80) : roomId;
    if (!callId) {
      return res.status(400).json({ error: "callId is required" });
    }
    if (type === "offer" && user.role !== "admin") {
      const targetLower = targetName.toLowerCase();
      if (targetLower !== "vip group" && targetLower !== "choy admin") {
        const allUsers = await store.listUsers(false);
        const targetUser = allUsers.find((u) => u.name.trim().toLowerCase() === targetLower);
        if (targetUser && !canViewerSeeUser(user, targetUser)) {
          return res.status(403).json({ error: "User is outside your assigned newsfeed channel." });
        }
      }
    }
    const result = sendRtcSignal(targetName, user.id, {
      type,
      callId,
      roomId,
      targetName,
      fromUserId: user.id,
      fromUserName: user.name,
      sdp: req.body?.sdp ?? void 0,
      candidate: req.body?.candidate ?? void 0,
      ts: Date.now()
    });
    if (type === "offer") {
      void sendWebPushToTarget(
        targetName,
        user.id,
        {
          kind: "call",
          title: `Incoming Video Call \xB7 ${user.name}`,
          body: `${user.name} is calling you on Choy Chat. Tap Answer to join live video.`,
          icon: getSafePushIcon(user.avatar),
          badge: "/pwa-192x192.png",
          tag: `choy-call-${callId}`,
          callId,
          roomId,
          callerName: user.name,
          url: `/?incomingCall=${encodeURIComponent(callId)}&caller=${encodeURIComponent(
            user.name
          )}&room=${encodeURIComponent(roomId)}`
        },
        "high"
      );
    } else if (type === "hangup" || type === "decline") {
      void sendWebPushToTarget(
        targetName,
        user.id,
        {
          kind: "call_ended",
          callId,
          callerName: user.name
        },
        "high"
      );
    }
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Signaling failed" });
  }
});
app.get("/api/choy/state", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    touchUserPresence(user.name);
    const isAdmin = user.role === "admin";
    const [posts, allMessages, allUsers, knowledge, leaderboard, emojiLinks, newsfeedConfig, allAnnouncements] = await Promise.all([
      store.listPosts(),
      store.listMessages(),
      store.listUsers(isAdmin),
      store.listKnowledge(),
      store.getPublicLeaderboard(),
      store.listEmojiLinks(),
      store.getNewsfeedConfig(),
      store.listAnnouncements()
    ]);
    const activeEmojiLink = emojiLinks.find((l) => l.pinnedToAppIcon) || emojiLinks[0] || null;
    const visibleUsers = isAdmin ? allUsers : allUsers.filter((candidate) => canViewerSeeUser(user, candidate));
    const visibleUserIds = new Set(visibleUsers.map((u) => u.id));
    const visibleUserNamesLower = new Set(visibleUsers.map((u) => u.name.trim().toLowerCase()));
    const myNameLower = user.name.trim().toLowerCase();
    const messages = isAdmin ? allMessages : allMessages.filter((m) => {
      const roomLower = m.roomId.trim().toLowerCase();
      const senderLower = m.senderName.trim().toLowerCase();
      const isSenderVisible = m.senderId === "system" || m.senderId === user.id || visibleUserIds.has(m.senderId) || visibleUserNamesLower.has(senderLower);
      if (roomLower === "vip group") {
        return isSenderVisible;
      }
      if (m.senderId === user.id || senderLower === myNameLower) {
        return roomLower === "choy admin" || visibleUserNamesLower.has(roomLower);
      }
      if (roomLower === myNameLower) {
        return isSenderVisible;
      }
      return false;
    });
    const filteredPosts = isAdmin ? posts : posts.filter((p) => canViewerSeePost(user, p));
    const visibleAnnouncements = isAdmin ? allAnnouncements : allAnnouncements.filter((a) => canViewerSeeAnnouncement(user, a));
    let ledger = void 0;
    let settings = void 0;
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
        newsfeed: normalizeUserNewsfeed(user.newsfeed)
      },
      posts: filteredPosts,
      messages,
      users: visibleUsers,
      knowledge,
      leaderboard,
      emojiLinks,
      activeEmojiLink,
      newsfeedConfig,
      announcements: visibleAnnouncements,
      onlineUsers: getOnlineUserNames(),
      ...isAdmin ? { ledger, settings } : {}
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load synced state" });
  }
});
app.post("/api/choy/posts", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const safeUrl = sanitizeMediaUrl(req.body?.mediaUrl);
    if (!content && !safeUrl || content.length > 2e3) {
      return res.status(400).json({ error: "Post text or an image/video is required (max 2000 chars)" });
    }
    const rawType = req.body?.mediaType;
    const mediaType = rawType === "image" || rawType === "video" ? rawType : "text";
    const rawCat = req.body?.category;
    const category = rawCat === "myday" || rawCat === "video" ? rawCat : "feed";
    const userNf = normalizeUserNewsfeed(user.newsfeed);
    let postNewsfeed = userNf;
    if (user.role === "admin") {
      const rawNf = typeof req.body?.newsfeed === "string" ? req.body.newsfeed.trim().toLowerCase() : "";
      if (rawNf === "feed_a" || rawNf === "feed_b" || rawNf === "feed_c" || rawNf === "feed_bc" || rawNf === "both") {
        postNewsfeed = rawNf;
      }
    } else {
      postNewsfeed = userNf;
    }
    const safeHandle = user.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || "member";
    const post = await store.createPost({
      authorId: user.id,
      authorName: user.name,
      authorHandle: `@${safeHandle}`,
      authorAvatar: user.avatar || DEFAULT_PROFILE_ICON,
      content,
      mediaUrl: safeUrl,
      mediaType: safeUrl ? mediaType : "text",
      category,
      newsfeed: postNewsfeed
    });
    broadcastSync("posts");
    return res.status(201).json(post);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create post" });
  }
});
app.delete("/api/choy/posts/:id", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    const ok = await store.deletePost(req.params.id, user.id, user.role === "admin");
    if (!ok) return res.status(404).json({ error: "Post not found or not authorized" });
    broadcastSync("posts");
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete post" });
  }
});
app.post("/api/choy/messages", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    const rawRoomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : "";
    if (!rawRoomId || rawRoomId.length > 80 || /[\x00-\x1f\x7f]/.test(rawRoomId)) {
      return res.status(400).json({ error: "Invalid chat room" });
    }
    let resolvedRoomId = ALLOWED_CHAT_ROOMS.find(
      (r) => r.toLowerCase() === rawRoomId.toLowerCase()
    );
    if (!resolvedRoomId) {
      const allUsers = await store.listUsers(true);
      const matchedUser = allUsers.find((u) => u.name.trim().toLowerCase() === rawRoomId.toLowerCase());
      if (matchedUser) {
        if (!canViewerSeeUser(user, matchedUser)) {
          return res.status(403).json({ error: "You can only message users in your assigned newsfeed channel." });
        }
        resolvedRoomId = matchedUser.name.trim();
      }
    }
    if (!resolvedRoomId) {
      return res.status(400).json({ error: "Chat recipient not found" });
    }
    const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 2e3) : "";
    const safeUrl = sanitizeMediaUrl(req.body?.mediaUrl);
    if (!text && !safeUrl) {
      return res.status(400).json({ error: "Message text or valid media is required" });
    }
    const rawType = req.body?.mediaType;
    const mediaType = rawType === "image" || rawType === "video" || rawType === "audio" || rawType === "file" ? rawType : "text";
    const transcript = typeof req.body?.transcript === "string" ? req.body.transcript.trim().slice(0, 2e3) : void 0;
    const msg = await store.createMessage({
      senderId: user.id,
      senderName: user.name,
      roomId: resolvedRoomId,
      text,
      mediaUrl: safeUrl,
      mediaType: safeUrl ? mediaType : "text",
      transcript
    });
    broadcastSync("messages");
    const isGroupRoom = resolvedRoomId.trim().toLowerCase() === "vip group";
    const openRoom = isGroupRoom ? "VIP Group" : user.name;
    const previewBody = text || (mediaType === "image" ? "Sent you a photo" : mediaType === "video" ? "Sent you a video" : mediaType === "audio" ? transcript || "Sent you a voice message" : "Sent you a file");
    void sendWebPushToTarget(
      resolvedRoomId,
      user.id,
      {
        kind: "message",
        title: isGroupRoom ? `${user.name} \xB7 VIP Group` : user.name,
        body: previewBody.slice(0, 180),
        icon: getSafePushIcon(user.avatar),
        badge: "/pwa-192x192.png",
        tag: `choy-msg-${openRoom.toLowerCase()}`,
        roomId: openRoom,
        url: `/?openChat=${encodeURIComponent(openRoom)}`
      },
      "normal"
    );
    return res.status(201).json(msg);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send message" });
  }
});
app.delete("/api/choy/messages/:id", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    const messageId = String(req.params.id || "").trim();
    if (!messageId) {
      return res.status(400).json({ error: "Message ID required" });
    }
    const isAdminUser = user.role === "admin" || user.phone === "09361223978" || user.phone === "choycounterflow@gmail.com";
    const success = await store.deleteMessage(messageId, user.id, isAdminUser);
    if (!success) {
      return res.status(403).json({ error: "Message not found or unauthorized to delete" });
    }
    broadcastSync("messages");
    return res.json({ success: true, deletedId: messageId });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete message" });
  }
});
app.put("/api/choy/blocked-users", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    const list = Array.isArray(req.body?.blockedUsers) ? req.body.blockedUsers : [];
    const updated = await store.updateBlockedUsers(user.id, list);
    broadcastSync("users");
    return res.json({ blockedUsers: updated });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update blocked users" });
  }
});
app.patch("/api/admin/users/:id/newsfeed", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const rawNf = typeof req.body?.newsfeed === "string" ? req.body.newsfeed.trim().toLowerCase() : "";
    if (rawNf !== "feed_a" && rawNf !== "feed_b" && rawNf !== "feed_c" && rawNf !== "feed_bc") {
      return res.status(400).json({ error: "Newsfeed must be feed_a, feed_b, feed_c, or feed_bc" });
    }
    const updated = await store.updateUserNewsfeed(userId, rawNf);
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }
    broadcastSync("users");
    broadcastSync("posts");
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
        newsfeed: updated.newsfeed
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update user newsfeed" });
  }
});
app.patch("/api/admin/users/:id/pin", requireAuth, requireAdmin, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const userId = String(req.params.id || "").trim();
    const newPin = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    if (!newPin || newPin.length < 4 || newPin.length > 64) {
      return res.status(400).json({ error: "PIN must be between 4 and 64 characters" });
    }
    const updated = await store.updateUserPin(userId, newPin);
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }
    broadcastSync("users");
    return res.json({
      ok: true,
      user: {
        id: updated.id,
        name: updated.name,
        role: updated.role
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update user PIN" });
  }
});
app.put("/api/admin/newsfeed-config", requireAuth, requireAdmin, async (req, res) => {
  try {
    const feedATitle = typeof req.body?.feedATitle === "string" ? req.body.feedATitle : "";
    const feedBTitle = typeof req.body?.feedBTitle === "string" ? req.body.feedBTitle : "";
    const feedCTitle = typeof req.body?.feedCTitle === "string" ? req.body.feedCTitle : "";
    const saved = await store.saveNewsfeedConfig({ feedATitle, feedBTitle, feedCTitle });
    broadcastSync("settings");
    return res.json({ ok: true, newsfeedConfig: saved });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save newsfeed titles" });
  }
});
app.post("/api/choy/ledger", requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 100) {
      return res.status(400).json({ error: "Valid ledger row name is required" });
    }
    const row = await store.createLedgerRow(name);
    broadcastSync("ledger");
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to add ledger row" });
  }
});
app.patch("/api/choy/ledger/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await store.updateLedgerRow(req.params.id, {
      fiveH: req.body?.fiveH !== void 0 ? clampNum(req.body.fiveH, -1e6, 1e6) : void 0,
      fiveHType: req.body?.fiveHType === "red" ? "red" : req.body?.fiveHType === "blue" ? "blue" : void 0,
      bulig: req.body?.bulig !== void 0 ? clampNum(req.body.bulig, -1e6, 1e6) : void 0,
      point5: req.body?.point5 !== void 0 ? clampNum(req.body.point5, -1e6, 1e6) : void 0,
      halfSack: req.body?.halfSack !== void 0 ? clampNum(req.body.halfSack, -1e6, 1e6) : void 0,
      oneSack: req.body?.oneSack !== void 0 ? clampNum(req.body.oneSack, -1e6, 1e6) : void 0,
      bal: req.body?.bal !== void 0 ? clampNum(req.body.bal, -1e8, 1e8) : void 0
    });
    if (!updated) return res.status(404).json({ error: "Ledger row not found" });
    broadcastSync("ledger");
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update ledger row" });
  }
});
app.delete("/api/choy/ledger/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteLedgerRow(req.params.id);
    if (!ok) return res.status(404).json({ error: "Ledger row not found" });
    broadcastSync("ledger");
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete ledger row" });
  }
});
app.put("/api/choy/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const current = await store.getSettings();
    const saved = await store.saveSettings({
      fiveH: req.body?.fiveH !== void 0 ? clampNum(req.body.fiveH, 0, 1e6) : current.fiveH,
      bulig: req.body?.bulig !== void 0 ? clampNum(req.body.bulig, 0, 1e6) : current.bulig,
      point5: req.body?.point5 !== void 0 ? clampNum(req.body.point5, 0, 1e6) : current.point5,
      halfSack: req.body?.halfSack !== void 0 ? clampNum(req.body.halfSack, 0, 1e6) : current.halfSack,
      oneSack: req.body?.oneSack !== void 0 ? clampNum(req.body.oneSack, 0, 1e6) : current.oneSack,
      defFiveH: req.body?.defFiveH !== void 0 ? clampNum(req.body.defFiveH, 0, 1e6) : current.defFiveH,
      defBulig: req.body?.defBulig !== void 0 ? clampNum(req.body.defBulig, 0, 1e6) : current.defBulig,
      defPoint5: req.body?.defPoint5 !== void 0 ? clampNum(req.body.defPoint5, 0, 1e6) : current.defPoint5,
      defHalfSack: req.body?.defHalfSack !== void 0 ? clampNum(req.body.defHalfSack, 0, 1e6) : current.defHalfSack,
      defOneSack: req.body?.defOneSack !== void 0 ? clampNum(req.body.defOneSack, 0, 1e6) : current.defOneSack
    });
    if (req.body?.applyQuantitiesToAll === true) {
      await store.applyDefaultQuantitiesToAll({
        defFiveH: saved.defFiveH,
        defBulig: saved.defBulig,
        defPoint5: saved.defPoint5,
        defHalfSack: saved.defHalfSack,
        defOneSack: saved.defOneSack
      });
    }
    broadcastSync("settings");
    return res.json(saved);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save settings" });
  }
});
app.post("/api/choy/knowledge", requireAuth, requireAdmin, async (req, res) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
    if (!question || !answer) {
      return res.status(400).json({ error: "Question and answer are required" });
    }
    const item = await store.createKnowledge(question, answer);
    broadcastSync("knowledge");
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to add knowledge" });
  }
});
app.delete("/api/choy/knowledge/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteKnowledge(req.params.id);
    if (!ok) return res.status(404).json({ error: "Knowledge entry not found" });
    broadcastSync("knowledge");
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete knowledge" });
  }
});
app.post("/api/choy/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const pin = typeof req.body?.pin === "string" && req.body.pin.trim().length >= 4 ? req.body.pin.trim() : crypto3.randomBytes(12).toString("hex");
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }
    const existing = await store.getUserByPhone(phone);
    if (existing) {
      return res.status(409).json({ error: "Phone number already exists" });
    }
    const user = await store.createUser({
      name,
      phone,
      pin,
      role: "member",
      status: "approved"
    });
    broadcastSync("users");
    return res.status(201).json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      loginDate: user.updatedAt.slice(0, 16).replace("T", " ")
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to add user" });
  }
});
var handleUpdateUserStatusRoute = async (req, res) => {
  try {
    const rawStatus = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";
    if (rawStatus !== "approved" && rawStatus !== "pending") {
      return res.status(400).json({ error: 'Status must be either "approved" or "pending"' });
    }
    const status = rawStatus;
    const ok = await store.updateUserStatus(req.params.id, status);
    if (!ok) {
      return res.status(404).json({ error: "User not found or admin status cannot be set to pending" });
    }
    broadcastSync("users");
    return res.json({ id: req.params.id, status });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update status" });
  }
};
app.patch("/api/choy/users/:id/status", requireAuth, requireAdmin, handleUpdateUserStatusRoute);
app.post("/api/choy/users/:id/status", requireAuth, requireAdmin, handleUpdateUserStatusRoute);
app.post("/api/choy/users/approve-all", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const approvedCount = await store.approveAllPendingUsers();
    broadcastSync("users");
    return res.json({ approvedCount });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to approve pending users" });
  }
});
app.delete("/api/choy/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "User not found or cannot delete admin" });
    broadcastSync("users");
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete user" });
  }
});
app.get("/api/admin/cloud-backup", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const snapshot = await store.exportCloudBackup();
    return res.json(snapshot);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to export backup" });
  }
});
app.post("/api/admin/cloud-restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const result = await store.restoreCloudBackup({
      users: Array.isArray(payload.users) ? payload.users : void 0,
      settings: payload.settings && typeof payload.settings === "object" ? payload.settings : void 0,
      newsfeedConfig: payload.newsfeedConfig && typeof payload.newsfeedConfig === "object" ? payload.newsfeedConfig : void 0,
      ledger: Array.isArray(payload.ledger) ? payload.ledger : void 0,
      knowledge: Array.isArray(payload.knowledge) ? payload.knowledge : void 0,
      announcements: Array.isArray(payload.announcements) ? payload.announcements : void 0
    });
    if (result.restoredUsersCount > 0 || result.restoredLedgerCount > 0 || result.restoredKnowledgeCount > 0 || result.restoredAnnouncementsCount > 0) {
      broadcastSync("all");
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to restore backup" });
  }
});
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var CHOY_APP_USAGE_GUIDE = `
CHOY CHAT APP FEATURES & HOW TO USE GUIDE:
1. Messages & Chats (Messages tab):
   - Send text messages, photos (tap the Camera/Photo button or attach image), videos, and voice messages in VIP Group or 1-on-1 direct chats with any user.
   - Voice-to-Text Transcription: Record a voice message using the Mic button; spoken words are transcribed automatically below the audio player.
   - Reactions & Forward: Tap emoji reactions (\u2764\uFE0F \u{1F44D} \u{1F525} \u{1F604}) or tap the "Forward" button under any message to open the Forward dialog, search a user or room, and re-send the message content.
   - Photo Editor & Zoom: Tap any sent photo to zoom in/out; draw or crop attached images before sending.
   - Message Notifications & Tune: Incoming messages trigger a popup notification with sender avatar and a notification sound tune.
2. Live Video Calls (Messages tab):
   - Open a chat with a user (or VIP Group) and tap the Video Call button to start a real live WebRTC video call.
   - Controls during a call: Mute/unmute mic, turn camera on/off, flip front/back camera, and Hang Up.
   - Incoming calls ring continuously with an audible ringtone, vibration, and caller profile picture banner until accepted or declined.
3. Home-Screen Push Notifications (Background Alerts):
   - Tap "Enable Alerts" in Messages or inside the 3-dots (\u22EE) Menu Drawer to allow background push notifications.
   - Once enabled (and installed to Home Screen as a PWA), you receive message popups and incoming video call alerts with caller profile icons even when the app is closed, as long as mobile data/Wi-Fi is on.
4. Profile Picture & Change Name (Account / Profile tab or your own Profile Modal):
   - Open Account (My Account) to tap "Add Profile Pic" / "Change Profile Pic" (or the Camera badge) to upload a photo, or "Reset Photo" to restore the default icon.
   - Tap "Change Name" to update your display name (2\u201360 characters). Your updated name and photo sync automatically across posts, chats, search, and calls.
5. Newsfeed, Videos & People:
   - Newsfeed tab: Share text, photo, or video posts (Feed, My Day, or Video) and view posts from the community.
   - People tab & top Search bar: Find members, view public profiles, start a message, or Block/Unblock a user.
   - Videos tab: Watch shared chat videos with sound enabled.
6. 3-Dots (\u22EE) Menu Drawer & Settings:
   - Tap the 3-dots (\u22EE) button at the top right for Theme (Light / Dark / System), Font Size, Reduce Motion, Push Notification toggle, Account Delete setup, and Logout.
7. Install as App (PWA):
   - Tap the Install App button or browser "Add to Home Screen" for full-screen mobile app experience and reliable background alerts.
`.trim();
app.post("/api/choy/ai/chat", requireAuth, async (req, res) => {
  try {
    const user = req.choyUser;
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    if (!question || question.length > 1500) {
      return res.status(400).json({ error: "Please enter a question (max 1500 characters)." });
    }
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(503).json({
        error: "Choy AI requires GEMINI_API_KEY to be configured on the server."
      });
    }
    const isAdminUser = user.role === "admin";
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
    const safeHistoryText = rawHistory.map((item) => {
      if (!item || typeof item !== "object") return "";
      const rec = item;
      const role = rec.sender === "user" ? "User" : "Choy AI";
      const txt = typeof rec.text === "string" ? rec.text.trim().slice(0, 400) : "";
      return txt ? `${role}: ${txt}` : "";
    }).filter(Boolean).join("\n");
    const knowledge = await store.listKnowledge();
    const knowledgeBlock = knowledge.length > 0 ? knowledge.slice(0, 40).map((k, idx) => `${idx + 1}. Q: ${k.question}
   A: ${k.answer}`).join("\n") : "No custom Q&A entries yet.";
    let systemInstruction = "";
    if (isAdminUser) {
      const [ledger, settings, allMessages, allUsers] = await Promise.all([
        store.listLedger(),
        store.getSettings(),
        store.listMessages(),
        store.listUsers(false)
      ]);
      const ledgerSummary = ledger.length > 0 ? ledger.map((row) => {
        const total = row.fiveH * settings.fiveH + row.bulig * settings.bulig + row.point5 * settings.point5 + row.halfSack * settings.halfSack + row.oneSack * settings.oneSack + row.bal;
        return `- ${row.name}: 5H=${row.fiveH} (${row.fiveHType}), Bulig=${row.bulig}, .5=${row.point5}, 1/2Sack=${row.halfSack}, 1Sack=${row.oneSack}, Bal=\u20B1${row.bal} | Computed Total=\u20B1${total.toLocaleString()} (Updated: ${row.updatedAt.slice(0, 16).replace("T", " ")})`;
      }).join("\n") : "No milestone ledger rows yet.";
      const recentMessages = allMessages.slice(-150).map((m) => {
        const ts = m.createdAt.slice(0, 16).replace("T", " ");
        const mediaTag = m.mediaType !== "text" ? ` [${m.mediaType.toUpperCase()}]` : "";
        const transcriptTag = m.transcript ? ` (Transcript: "${m.transcript.slice(0, 160)}")` : "";
        const body = m.text ? m.text.slice(0, 260) : "(media only)";
        return `[${ts}] Room="${m.roomId}" | From="${m.senderName}"${mediaTag}: ${body}${transcriptTag}`;
      }).join("\n");
      const usersSummary = allUsers.length > 0 ? allUsers.map((u) => `- ${u.name} (${u.role}, status: ${u.status}, lastActive: ${u.loginDate})`).join("\n") : "No registered users.";
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
5H: \u20B1${settings.fiveH}, Bulig: \u20B1${settings.bulig}, .5: \u20B1${settings.point5}, 1/2 Sack: \u20B1${settings.halfSack}, 1 Sack: \u20B1${settings.oneSack}

--- SYNCED MILESTONE LEDGER (${ledger.length} rows) ---
${ledgerSummary}

--- REGISTERED USERS (${allUsers.length}) ---
${usersSummary}

--- ALL USERS' RECENT MESSAGES (ADMIN-ONLY MODERATION SYNC, ${Math.min(allMessages.length, 150)} of ${allMessages.length}) ---
${recentMessages || "No messages yet."}

--- SYNCED AI BRAIN Q&A ---
${knowledgeBlock}

--- APP USAGE GUIDE ---
${CHOY_APP_USAGE_GUIDE}`;
    } else {
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
    const promptContents = safeHistoryText ? `Recent conversation:
${safeHistoryText}

Latest question from ${isAdminUser ? "Admin" : "Member"}:
${question}` : question;
    let responseText = "";
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: promptContents,
          config: {
            systemInstruction
          }
        });
        responseText = (response.text || "").trim();
        break;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("400") || msg.includes("403") || msg.includes("404") || msg.includes("429")) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (!responseText) {
      const errMsg = lastErr instanceof Error ? lastErr.message : "Choy AI could not generate a response right now.";
      return res.status(502).json({ error: errMsg });
    }
    return res.json({
      answer: responseText,
      scope: isAdminUser ? "admin_full_sync" : "member_app_guide"
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Choy AI request failed" });
  }
});
function buildStructuredFallbackPrompt(title, category, entries) {
  if (entries.length === 0) {
    return `Feature File: ${title} [${category}]

(No notes added yet. Type a feature update below and save to auto-organize.)`;
  }
  const cleanLines = entries.map((entry, idx) => {
    const cleaned = entry.rawText.replace(/\s+/g, " ").trim();
    return `${idx + 1}. ${cleaned}`;
  }).filter(Boolean);
  return [
    `Feature Update Request: ${title}`,
    `Category: ${category}`,
    ``,
    `Summary:`,
    `Implement and connect the ${entries.length} feature update${entries.length > 1 ? "s" : ""} below cleanly in Choy Chat while maintaining existing design, dark/light mode contrast, and real-time cloud sync.`,
    ``,
    `Organized Requirements:`,
    ...cleanLines,
    ``,
    `Technical & UX Checklist:`,
    `- Integrate smoothly with existing components and database/SSE sync.`,
    `- Ensure responsive layout on both mobile and desktop.`,
    `- Verify TypeScript build and lint checks pass cleanly.`
  ].join("\n");
}
async function summarizeAndOrganizeStudioNote(title, category, entries) {
  const fallback = buildStructuredFallbackPrompt(title, category, entries);
  if (!entries.length) {
    return { organizedPrompt: fallback, usedAi: false };
  }
  if (!(process.env.GEMINI_API_KEY || "").trim()) {
    return { organizedPrompt: fallback, usedAi: false };
  }
  try {
    const entriesText = entries.map((e, i) => `Note #${i + 1} (${e.createdAt.slice(0, 16).replace("T", " ")}):
${e.rawText}`).join("\n\n---\n\n");
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `Feature File Title: ${title}
Category: ${category}

All Connected Notes (chronological order):
${entriesText}`,
      config: {
        systemInstruction: "You are an expert AI Studio prompt organizer. The app owner writes rough feature ideas in English, Bisaya (Cebuano), or Tagalog. Combine and connect ALL chronological notes into ONE clean, polished, ready-to-copy-and-paste specification prompt for Google AI Studio. Preserve every requirement from earlier and new notes, resolve duplicates, organize clearly with: Title, Short Summary, Numbered Feature Requirements, and UI/Sync Notes. Output ONLY the clean formatted prompt in clear English."
      }
    });
    const text = (response.text || "").trim();
    if (text) {
      return { organizedPrompt: text, usedAi: true };
    }
  } catch (err) {
    console.warn("[Studio Notes Summarize fallback]:", err instanceof Error ? err.message : err);
  }
  return { organizedPrompt: fallback, usedAi: false };
}
app.get("/api/admin/studio-notes", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const notes = await store.listStudioNotes();
    return res.json({ notes });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load studio notes" });
  }
});
app.post("/api/admin/studio-notes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 100) : "";
    const category = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 50) : "App Features";
    const initialText = typeof req.body?.initialText === "string" ? req.body.initialText.trim().slice(0, 6e3) : "";
    const autoSummarize = req.body?.autoSummarize !== false;
    if (!title) {
      return res.status(400).json({ error: "Note file name/title is required" });
    }
    const entries = initialText ? [{ id: "ne_" + crypto3.randomUUID().slice(0, 10), rawText: initialText, createdAt: (/* @__PURE__ */ new Date()).toISOString() }] : [];
    let organizedPrompt = "";
    let usedAi = false;
    if (entries.length > 0 && autoSummarize) {
      const resSum = await summarizeAndOrganizeStudioNote(title, category || "App Features", entries);
      organizedPrompt = resSum.organizedPrompt;
      usedAi = resSum.usedAi;
    } else if (entries.length > 0) {
      organizedPrompt = buildStructuredFallbackPrompt(title, category || "App Features", entries);
    }
    const created = await store.createStudioNoteFile({
      title,
      category: category || "App Features",
      entries,
      organizedPrompt
    });
    const notes = await store.listStudioNotes();
    broadcastSync("studio-notes");
    return res.status(201).json({ note: created, notes, usedAi });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create note file" });
  }
});
app.post("/api/admin/studio-notes/:id/append", requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await store.getStudioNoteById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Note file not found" });
    }
    const rawText = typeof req.body?.rawText === "string" ? req.body.rawText.trim().slice(0, 6e3) : "";
    const autoSummarize = req.body?.autoSummarize !== false;
    const nextEntries = rawText ? [
      ...existing.entries,
      { id: "ne_" + crypto3.randomUUID().slice(0, 10), rawText, createdAt: (/* @__PURE__ */ new Date()).toISOString() }
    ] : existing.entries;
    let organizedPrompt = existing.organizedPrompt;
    let usedAi = false;
    if (autoSummarize || !organizedPrompt.trim()) {
      const resSum = await summarizeAndOrganizeStudioNote(existing.title, existing.category, nextEntries);
      organizedPrompt = resSum.organizedPrompt;
      usedAi = resSum.usedAi;
    } else if (rawText) {
      organizedPrompt = `${organizedPrompt.trim()}

${nextEntries.length}. ${rawText}`;
    }
    const updated = await store.updateStudioNoteFile(existing.id, {
      entries: nextEntries,
      organizedPrompt
    });
    const notes = await store.listStudioNotes();
    broadcastSync("studio-notes");
    return res.json({ note: updated, notes, usedAi });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to connect note entry" });
  }
});
app.patch("/api/admin/studio-notes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await store.getStudioNoteById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Note file not found" });
    }
    const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim().slice(0, 100) : existing.title;
    const category = typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim().slice(0, 50) : existing.category;
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : existing.entries;
    let organizedPrompt = typeof req.body?.organizedPrompt === "string" ? req.body.organizedPrompt : existing.organizedPrompt;
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
      organizedPrompt
    });
    const notes = await store.listStudioNotes();
    broadcastSync("studio-notes");
    return res.json({ note: updated, notes, usedAi });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save note file" });
  }
});
app.delete("/api/admin/studio-notes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteStudioNoteFile(req.params.id);
    if (!ok) return res.status(404).json({ error: "Note file not found" });
    const notes = await store.listStudioNotes();
    broadcastSync("studio-notes");
    return res.json({ deleted: true, notes });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete note file" });
  }
});
app.get("/api/admin/env-vault", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const entries = await store.listEnvVault();
    return res.json({ entries });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load env vault" });
  }
});
app.post("/api/admin/env-vault", requireAuth, requireAdmin, async (req, res) => {
  try {
    const category = typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim().slice(0, 60) : "Code & Custom";
    const keyName = typeof req.body?.keyName === "string" ? req.body.keyName.trim().slice(0, 100) : "";
    const value = typeof req.body?.value === "string" ? req.body.value.slice(0, 12e3) : "";
    const secret = Boolean(req.body?.secret);
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 500) : void 0;
    const id = typeof req.body?.id === "string" ? req.body.id.trim() : void 0;
    if (!keyName) {
      return res.status(400).json({ error: "Key / Config name is required" });
    }
    const saved = await store.upsertEnvVaultEntry({ id, category, keyName, value, secret, notes });
    const entries = await store.listEnvVault();
    broadcastSync("env-vault");
    return res.status(201).json({ entry: saved, entries });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save env entry" });
  }
});
app.post("/api/admin/env-vault/sync-all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body?.entries) ? req.body.entries : [];
    for (const item of rawItems.slice(0, 100)) {
      const keyName = typeof item?.keyName === "string" ? item.keyName.trim().slice(0, 100) : "";
      if (!keyName) continue;
      await store.upsertEnvVaultEntry({
        id: typeof item?.id === "string" ? item.id : void 0,
        category: typeof item?.category === "string" && item.category.trim() ? item.category.trim().slice(0, 60) : "Code & Custom",
        keyName,
        value: typeof item?.value === "string" ? item.value.slice(0, 12e3) : "",
        secret: Boolean(item?.secret),
        notes: typeof item?.notes === "string" ? item.notes.trim().slice(0, 500) : void 0
      });
    }
    const entries = await store.listEnvVault();
    broadcastSync("env-vault");
    return res.json({ entries, synced: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to sync env vault" });
  }
});
app.delete("/api/admin/env-vault/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await store.deleteEnvVaultEntry(req.params.id);
    if (!ok) return res.status(404).json({ error: "Env entry not found" });
    const entries = await store.listEnvVault();
    broadcastSync("env-vault");
    return res.json({ deleted: true, entries });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete env entry" });
  }
});
app.get("/api/admin/announcements", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const announcements = await store.listAnnouncements();
    return res.json({ announcements });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load announcements" });
  }
});
app.post("/api/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!verifyCookieCsrf(req)) {
      return res.status(403).json({ error: "Cross-origin request blocked" });
    }
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 500) : "";
    if (!title || !message) {
      return res.status(400).json({ error: "Title and announcement message are required" });
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
      createdBy: req.choyUser?.name || "Admin"
    });
    const announcements = await store.listAnnouncements();
    broadcastSync("announcements");
    return res.status(201).json({ announcement: created, announcements });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create announcement slide" });
  }
});
app.patch("/api/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!verifyCookieCsrf(req)) {
      return res.status(403).json({ error: "Cross-origin request blocked" });
    }
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Announcement ID is required" });
    }
    const patch = {};
    if (req.body?.title !== void 0) {
      const t = typeof req.body.title === "string" ? req.body.title.trim().slice(0, 120) : "";
      if (!t) return res.status(400).json({ error: "Title cannot be empty" });
      patch.title = t;
    }
    if (req.body?.message !== void 0) {
      const m = typeof req.body.message === "string" ? req.body.message.trim().slice(0, 500) : "";
      if (!m) return res.status(400).json({ error: "Message cannot be empty" });
      patch.message = m;
    }
    if (req.body?.badge !== void 0) {
      patch.badge = normalizeAnnouncementBadge(req.body.badge);
    }
    if (req.body?.tone !== void 0) {
      patch.tone = normalizeAnnouncementTone(req.body.tone);
    }
    if (req.body?.target !== void 0) {
      patch.target = normalizeAnnouncementTarget(req.body.target);
    }
    if (typeof req.body?.active === "boolean") {
      patch.active = req.body.active;
    }
    const updated = await store.updateAnnouncement(id, patch);
    if (!updated) {
      return res.status(404).json({ error: "Announcement slide not found" });
    }
    const announcements = await store.listAnnouncements();
    broadcastSync("announcements");
    return res.json({ announcement: updated, announcements });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update announcement slide" });
  }
});
app.delete("/api/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!verifyCookieCsrf(req)) {
      return res.status(403).json({ error: "Cross-origin request blocked" });
    }
    const ok = await store.deleteAnnouncement(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Announcement slide not found" });
    }
    const announcements = await store.listAnnouncements();
    broadcastSync("announcements");
    return res.json({ deleted: true, announcements });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to delete announcement slide" });
  }
});
function getGitHubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "GitPulse-AI-App"
  };
}
app.get("/api/auth/github/url", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.OAUTH_CLIENT_ID || "";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const redirectUri = `${protocol}://${host}/auth/callback`;
  if (!clientId) {
    return res.status(400).json({
      error: "GitHub Client ID not configured. Please set GITHUB_CLIENT_ID in secrets or use a Personal Access Token."
    });
  }
  const scopes = "repo user read:org";
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  res.json({ url: authUrl, redirectUri });
});
app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID || process.env.OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET || "";
  if (!code) {
    return res.send(`<html><body><h3>Authentication failed: No code provided</h3><script>setTimeout(() => window.close(), 2000);</script></body></html>`);
  }
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error || "Failed to obtain access token from GitHub");
    }
    const accessToken = tokenData.access_token;
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
  } catch (err) {
    res.send(`<html><body style="background:#0f172a;color:#ef4444;font-family:sans-serif;padding:40px;"><h3>Authentication Error</h3><p>${err.message}</p></body></html>`);
  }
});
app.get("/api/github/user", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated with GitHub" });
  }
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: getGitHubHeaders(token)
    });
    if (!userRes.ok) {
      throw new Error(`GitHub API error: ${userRes.statusText}`);
    }
    const userData = await userRes.json();
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/github/repos", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  const search = req.query.search;
  try {
    const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: token ? getGitHubHeaders(token) : { "User-Agent": "GitPulse-AI" }
    });
    if (!reposRes.ok) {
      const pubRes = await fetch("https://api.github.com/repositories?per_page=50", {
        headers: { "User-Agent": "GitPulse-AI" }
      });
      const pubData = await pubRes.json();
      const filtered = search ? pubData.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase())) : pubData;
      return res.json(filtered);
    }
    const data = await reposRes.json();
    const repoList = Array.isArray(data) ? data : [];
    if (search) {
      const query = search.toLowerCase();
      const filtered = repoList.filter(
        (r) => r.name.toLowerCase().includes(query) || r.full_name.toLowerCase().includes(query) || r.description && r.description.toLowerCase().includes(query)
      );
      return res.json(filtered);
    }
    res.json(repoList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/github/repo/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;
  const token = req.headers.authorization?.replace("Bearer ", "") || "";
  try {
    const headers = token ? getGitHubHeaders(token) : { "User-Agent": "GitPulse-AI" };
    const [repoRes, issuesRes, prsRes, branchesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=10`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=10`, { headers })
    ]);
    const repoData = await repoRes.json();
    const issuesData = await issuesRes.ok ? await issuesRes.json() : [];
    const prsData = await prsRes.ok ? await prsRes.json() : [];
    const branchesData = await branchesRes.ok ? await branchesRes.json() : [];
    if (!repoRes.ok) {
      return res.status(repoRes.status).json({ error: repoData.message || "Failed to fetch repository" });
    }
    res.json({
      repo: repoData,
      issues: issuesData,
      pullRequests: prsData,
      branches: branchesData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
function parseGitHubRepoInput(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 300) return null;
  let owner = "";
  let repo = "";
  let branchFromUrl;
  if (/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(trimmed)) {
    const parts = trimmed.split("/");
    owner = parts[0];
    repo = parts[1].replace(/\.git$/i, "");
  } else {
    let normalized = trimmed;
    if (/^github\.com\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      const host = parsed.hostname.toLowerCase();
      if (host !== "github.com" && host !== "www.github.com") return null;
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return null;
      owner = segments[0];
      repo = segments[1].replace(/\.git$/i, "");
      if (segments[2] === "tree" && segments[3]) {
        branchFromUrl = decodeURIComponent(segments.slice(3).join("/"));
      }
    } catch {
      return null;
    }
  }
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner);
  const validRepo = /^[A-Za-z0-9._-]{1,100}$/.test(repo) && repo !== "." && repo !== "..";
  if (!validOwner || !validRepo) return null;
  if (branchFromUrl && (!/^[A-Za-z0-9._/-]{1,120}$/.test(branchFromUrl) || branchFromUrl.includes(".."))) {
    branchFromUrl = void 0;
  }
  return { owner, repo, branchFromUrl };
}
function safeGitHubExternalUrl(url) {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && (parsed.hostname === "github.com" || parsed.hostname === "avatars.githubusercontent.com")) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}
app.post("/api/github/intelligence", requireAuth, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const repoUrl = typeof req.body?.repoUrl === "string" ? req.body.repoUrl : "";
    const userPat = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const requestedBranch = typeof req.body?.branch === "string" ? req.body.branch.trim() : "";
    const rawCommitLimit = Number(req.body?.commitLimit);
    const commitLimit = Number.isInteger(rawCommitLimit) && rawCommitLimit >= 1 && rawCommitLimit <= 20 ? rawCommitLimit : 5;
    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({
        error: "Please enter a valid GitHub repository URL (for example: https://github.com/owner/repo or owner/repo)."
      });
    }
    if (requestedBranch && (!/^[A-Za-z0-9._/-]{1,120}$/.test(requestedBranch) || requestedBranch.includes(".."))) {
      return res.status(400).json({ error: "Invalid branch name." });
    }
    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || "").trim();
    const ghHeaders = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ChoyChat-GitHub-Intelligence",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (effectiveToken) {
      ghHeaders.Authorization = `Bearer ${effectiveToken}`;
    }
    const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}`;
    const repoRes = await fetch(baseApi, { headers: ghHeaders });
    const repoJson = await repoRes.json().catch(() => ({}));
    if (!repoRes.ok) {
      const ghMsg = typeof repoJson?.message === "string" ? repoJson.message : "GitHub API error";
      if (repoRes.status === 401) {
        return res.status(401).json({ error: "GitHub rejected the personal access token. Please verify the token and its scopes." });
      }
      if (repoRes.status === 404) {
        return res.status(404).json({
          error: "Repository not found. If it is private, provide a Personal Access Token with repo read access."
        });
      }
      if (repoRes.status === 403) {
        return res.status(403).json({
          error: ghMsg.toLowerCase().includes("rate limit") ? "GitHub API rate limit reached. Add a Personal Access Token to increase your limit." : `Access denied by GitHub: ${ghMsg}`
        });
      }
      return res.status(repoRes.status).json({ error: ghMsg });
    }
    const defaultBranch = typeof repoJson.default_branch === "string" ? repoJson.default_branch : "main";
    const targetBranch = requestedBranch || parsedRepo.branchFromUrl || defaultBranch;
    const [branchesRes, langsRes, treeRes, commitsRes, readmeRes] = await Promise.all([
      fetch(`${baseApi}/branches?per_page=25`, { headers: ghHeaders }),
      fetch(`${baseApi}/languages`, { headers: ghHeaders }),
      fetch(`${baseApi}/git/trees/${encodeURIComponent(targetBranch)}?recursive=1`, { headers: ghHeaders }),
      fetch(`${baseApi}/commits?sha=${encodeURIComponent(targetBranch)}&per_page=${commitLimit}`, { headers: ghHeaders }),
      fetch(`${baseApi}/readme?ref=${encodeURIComponent(targetBranch)}`, { headers: ghHeaders })
    ]);
    const branchesRaw = branchesRes.ok ? await branchesRes.json().catch(() => []) : [];
    const langsRaw = langsRes.ok ? await langsRes.json().catch(() => ({})) : {};
    const treeRaw = treeRes.ok ? await treeRes.json().catch(() => ({ tree: [] })) : { tree: [] };
    const commitsRaw = commitsRes.ok ? await commitsRes.json().catch(() => []) : [];
    const readmeRaw = readmeRes.ok ? await readmeRes.json().catch(() => null) : null;
    let readme = null;
    if (readmeRaw && typeof readmeRaw.content === "string") {
      const MAX_README_CHARS = 12e4;
      const decoded = readmeRaw.encoding === "base64" ? Buffer.from(readmeRaw.content.replace(/\s+/g, ""), "base64").toString("utf8") : readmeRaw.content;
      const truncated = decoded.length > MAX_README_CHARS;
      readme = {
        name: typeof readmeRaw.name === "string" && readmeRaw.name ? readmeRaw.name : "README.md",
        path: typeof readmeRaw.path === "string" && readmeRaw.path ? readmeRaw.path : "README.md",
        size: typeof readmeRaw.size === "number" && readmeRaw.size >= 0 ? readmeRaw.size : Buffer.byteLength(decoded, "utf8"),
        htmlUrl: safeGitHubExternalUrl(readmeRaw.html_url),
        content: truncated ? decoded.slice(0, MAX_README_CHARS) : decoded,
        truncated
      };
    }
    const branches = Array.isArray(branchesRaw) ? branchesRaw.map((b) => typeof b?.name === "string" ? b.name : "").filter(Boolean) : [targetBranch];
    if (!branches.includes(targetBranch)) {
      branches.unshift(targetBranch);
    }
    const langEntries = langsRaw && typeof langsRaw === "object" ? Object.entries(langsRaw).filter(([, val]) => typeof val === "number" && val > 0) : [];
    const totalLangBytes = langEntries.reduce((sum, [, val]) => sum + Number(val), 0);
    const languages = langEntries.sort((a, b) => Number(b[1]) - Number(a[1])).map(([name, val]) => ({
      name,
      bytes: Number(val),
      percent: totalLangBytes > 0 ? Number((Number(val) / totalLangBytes * 100).toFixed(1)) : 0
    }));
    const rawTreeItems = Array.isArray(treeRaw?.tree) ? treeRaw.tree : [];
    let totalFiles = 0;
    let totalDirectories = 0;
    let totalBytes = 0;
    const folderMap = /* @__PURE__ */ new Map();
    const extMap = /* @__PURE__ */ new Map();
    const keyManifestNames = /* @__PURE__ */ new Set([
      "package.json",
      "tsconfig.json",
      "dockerfile",
      "render.yaml",
      "docker-compose.yml",
      "docker-compose.yaml",
      "readme.md",
      "vite.config.ts",
      "vite.config.js",
      "next.config.js",
      "next.config.mjs",
      "next.config.ts",
      "cargo.toml",
      "go.mod",
      "requirements.txt",
      "pyproject.toml",
      "prisma/schema.prisma"
    ]);
    const keyFiles = [];
    const tree = [];
    for (const item of rawTreeItems) {
      const itemPath = typeof item?.path === "string" ? item.path : "";
      const itemType = item?.type === "tree" ? "tree" : item?.type === "blob" ? "blob" : null;
      if (!itemPath || !itemType) continue;
      const size = typeof item?.size === "number" && item.size > 0 ? item.size : 0;
      if (tree.length < 1500) {
        tree.push({ path: itemPath, type: itemType, size });
      }
      if (itemType === "tree") {
        totalDirectories += 1;
      } else {
        totalFiles += 1;
        totalBytes += size;
        const slashIdx = itemPath.indexOf("/");
        const topFolder = slashIdx === -1 ? "(root)" : itemPath.slice(0, slashIdx);
        const existingFolder = folderMap.get(topFolder) || { fileCount: 0, totalBytes: 0 };
        existingFolder.fileCount += 1;
        existingFolder.totalBytes += size;
        folderMap.set(topFolder, existingFolder);
        const baseName = itemPath.slice(itemPath.lastIndexOf("/") + 1);
        const dotIdx = baseName.lastIndexOf(".");
        const ext = dotIdx > 0 ? baseName.slice(dotIdx).toLowerCase() : "(no ext)";
        extMap.set(ext, (extMap.get(ext) || 0) + 1);
        if (keyManifestNames.has(itemPath.toLowerCase()) || !itemPath.includes("/") && keyManifestNames.has(baseName.toLowerCase())) {
          keyFiles.push(itemPath);
        }
      }
    }
    const topLevelFolders = Array.from(folderMap.entries()).map(([name, info]) => ({ name, fileCount: info.fileCount, totalBytes: info.totalBytes })).sort((a, b) => b.fileCount - a.fileCount);
    const extensions = Array.from(extMap.entries()).map(([ext, count]) => ({ ext, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const contributorMap = /* @__PURE__ */ new Map();
    const commits = (Array.isArray(commitsRaw) ? commitsRaw : []).slice(0, commitLimit).map((c) => {
      const fullMessage = typeof c?.commit?.message === "string" ? c.commit.message : "";
      const [firstLine, ...restLines] = fullMessage.split("\n");
      const authorName = typeof c?.commit?.author?.name === "string" && c.commit.author.name || typeof c?.author?.login === "string" && c.author.login || "Unknown Author";
      const authorLogin = typeof c?.author?.login === "string" ? c.author.login : null;
      const authorAvatar = safeGitHubExternalUrl(c?.author?.avatar_url);
      const date = typeof c?.commit?.author?.date === "string" ? c.commit.author.date : null;
      const sha = typeof c?.sha === "string" ? c.sha : "";
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
          latestDate: date
        });
      }
      return {
        sha,
        shortSha: sha.slice(0, 7),
        message: fullMessage.trim() || "(no commit message)",
        title: firstLine.trim() || "(no commit message)",
        body: restLines.join("\n").trim(),
        authorName,
        authorLogin,
        authorAvatar,
        date,
        htmlUrl: safeGitHubExternalUrl(c?.html_url),
        verified: Boolean(c?.commit?.verification?.verified)
      };
    });
    const contributors = Array.from(contributorMap.values()).sort((a, b) => b.commitCount - a.commitCount);
    return res.json({
      repo: {
        name: String(repoJson.name || parsedRepo.repo),
        fullName: String(repoJson.full_name || `${parsedRepo.owner}/${parsedRepo.repo}`),
        description: typeof repoJson.description === "string" ? repoJson.description : "",
        visibility: typeof repoJson.visibility === "string" ? repoJson.visibility : repoJson.private ? "private" : "public",
        isPrivate: Boolean(repoJson.private),
        defaultBranch,
        selectedBranch: targetBranch,
        htmlUrl: safeGitHubExternalUrl(repoJson.html_url) || "",
        stars: Number(repoJson.stargazers_count) || 0,
        forks: Number(repoJson.forks_count) || 0,
        openIssues: Number(repoJson.open_issues_count) || 0,
        watchers: Number(repoJson.subscribers_count ?? repoJson.watchers_count) || 0,
        sizeKb: Number(repoJson.size) || 0,
        license: typeof repoJson?.license?.name === "string" ? repoJson.license.name : null,
        pushedAt: typeof repoJson.pushed_at === "string" ? repoJson.pushed_at : null,
        updatedAt: typeof repoJson.updated_at === "string" ? repoJson.updated_at : null,
        ownerLogin: typeof repoJson?.owner?.login === "string" ? repoJson.owner.login : parsedRepo.owner,
        ownerAvatar: safeGitHubExternalUrl(repoJson?.owner?.avatar_url)
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
        tree
      },
      commits,
      contributors,
      readme,
      authenticatedWithToken: Boolean(effectiveToken)
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to inspect GitHub repository"
    });
  }
});
app.post("/api/github/file", requireAuth, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const repoUrl = typeof req.body?.repoUrl === "string" ? req.body.repoUrl : "";
    const userPat = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const requestedBranch = typeof req.body?.branch === "string" ? req.body.branch.trim() : "";
    const rawFilePath = typeof req.body?.path === "string" ? req.body.path.trim().replace(/^\/+/, "") : "";
    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({ error: "Invalid GitHub repository URL." });
    }
    if (requestedBranch && (!/^[A-Za-z0-9._/-]{1,120}$/.test(requestedBranch) || requestedBranch.includes(".."))) {
      return res.status(400).json({ error: "Invalid branch name." });
    }
    if (!rawFilePath || rawFilePath.length > 500 || rawFilePath.includes("\0") || rawFilePath.includes("\\") || rawFilePath.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) {
      return res.status(400).json({ error: "Invalid repository file path." });
    }
    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || "").trim();
    const ghHeaders = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ChoyChat-GitHub-Intelligence",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (effectiveToken) {
      ghHeaders.Authorization = `Bearer ${effectiveToken}`;
    }
    const encodedFilePath = rawFilePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}`;
    const queryRef = requestedBranch ? `?ref=${encodeURIComponent(requestedBranch)}` : "";
    const fileRes = await fetch(`${baseApi}/contents/${encodedFilePath}${queryRef}`, { headers: ghHeaders });
    const fileJson = await fileRes.json().catch(() => ({}));
    if (!fileRes.ok) {
      const ghMsg = typeof fileJson?.message === "string" ? fileJson.message : "GitHub API error";
      if (fileRes.status === 401) {
        return res.status(401).json({ error: "GitHub rejected the personal access token." });
      }
      if (fileRes.status === 404) {
        return res.status(404).json({ error: "File not found on this branch." });
      }
      if (fileRes.status === 403 && ghMsg.toLowerCase().includes("rate limit")) {
        return res.status(403).json({
          error: "GitHub API rate limit reached. Add a Personal Access Token to preview more files."
        });
      }
      return res.status(fileRes.status).json({ error: ghMsg });
    }
    if (Array.isArray(fileJson) || fileJson?.type !== "file") {
      return res.status(400).json({ error: "Selected path is not a previewable file." });
    }
    const fileName = typeof fileJson.name === "string" ? fileJson.name : rawFilePath.split("/").pop() || rawFilePath;
    const filePath = typeof fileJson.path === "string" ? fileJson.path : rawFilePath;
    const fileSize = typeof fileJson.size === "number" && fileJson.size >= 0 ? fileJson.size : 0;
    const htmlUrl = safeGitHubExternalUrl(fileJson.html_url);
    const sha = typeof fileJson.sha === "string" ? fileJson.sha : "";
    const BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".ico",
      ".bmp",
      ".tiff",
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".7z",
      ".rar",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
      ".mp4",
      ".webm",
      ".mov",
      ".mp3",
      ".wav",
      ".ogg",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".wasm",
      ".pyc",
      ".class",
      ".jar"
    ]);
    const dotIdx = fileName.lastIndexOf(".");
    const ext = dotIdx > 0 ? fileName.slice(dotIdx).toLowerCase() : "";
    if (BINARY_EXTENSIONS.has(ext)) {
      return res.json({
        name: fileName,
        path: filePath,
        size: fileSize,
        sha,
        htmlUrl,
        content: "",
        lineCount: 0,
        truncated: false,
        isBinary: true,
        tooLarge: false
      });
    }
    const MAX_PREVIEW_BYTES = 512 * 1024;
    if (fileSize > MAX_PREVIEW_BYTES || typeof fileJson.content !== "string") {
      return res.json({
        name: fileName,
        path: filePath,
        size: fileSize,
        sha,
        htmlUrl,
        content: "",
        lineCount: 0,
        truncated: false,
        isBinary: false,
        tooLarge: true
      });
    }
    const rawBuffer = fileJson.encoding === "base64" ? Buffer.from(fileJson.content.replace(/\s+/g, ""), "base64") : Buffer.from(fileJson.content, "utf8");
    const sampleSlice = rawBuffer.subarray(0, Math.min(rawBuffer.length, 8192));
    if (sampleSlice.includes(0)) {
      return res.json({
        name: fileName,
        path: filePath,
        size: fileSize,
        sha,
        htmlUrl,
        content: "",
        lineCount: 0,
        truncated: false,
        isBinary: true,
        tooLarge: false
      });
    }
    const MAX_PREVIEW_CHARS = 15e4;
    const decodedText = rawBuffer.toString("utf8");
    const truncated = decodedText.length > MAX_PREVIEW_CHARS;
    const finalContent = truncated ? decodedText.slice(0, MAX_PREVIEW_CHARS) : decodedText;
    const lineCount = finalContent === "" ? 0 : finalContent.split(/\r?\n/).length;
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
      tooLarge: false
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch repository file contents"
    });
  }
});
app.post("/api/github/file-review", requireAuth, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const geminiApiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!geminiApiKey) {
      return res.status(503).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets to use AI Code Review."
      });
    }
    const repoUrl = typeof req.body?.repoUrl === "string" ? req.body.repoUrl : "";
    const userPat = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const requestedBranch = typeof req.body?.branch === "string" ? req.body.branch.trim() : "";
    const rawFilePath = typeof req.body?.path === "string" ? req.body.path.trim().replace(/^\/+/, "") : "";
    const reviewType = req.body?.reviewType === "security" ? "security" : req.body?.reviewType === "performance" ? "performance" : null;
    const providedContent = typeof req.body?.content === "string" ? req.body.content : null;
    if (!reviewType) {
      return res.status(400).json({ error: 'Review type must be "performance" or "security".' });
    }
    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({ error: "Invalid GitHub repository URL." });
    }
    if (requestedBranch && (!/^[A-Za-z0-9._/-]{1,120}$/.test(requestedBranch) || requestedBranch.includes(".."))) {
      return res.status(400).json({ error: "Invalid branch name." });
    }
    if (!rawFilePath || rawFilePath.length > 500 || rawFilePath.includes("\0") || rawFilePath.includes("\\") || rawFilePath.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) {
      return res.status(400).json({ error: "Invalid repository file path." });
    }
    const fileName = rawFilePath.split("/").pop() || rawFilePath;
    const BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".ico",
      ".bmp",
      ".tiff",
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".7z",
      ".rar",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
      ".mp4",
      ".webm",
      ".mov",
      ".mp3",
      ".wav",
      ".ogg",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".bin",
      ".wasm",
      ".pyc",
      ".class",
      ".jar"
    ]);
    const dotIdx = fileName.lastIndexOf(".");
    const ext = dotIdx > 0 ? fileName.slice(dotIdx).toLowerCase() : "";
    if (BINARY_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: "Binary files cannot be analyzed by AI Code Review." });
    }
    let sourceCode = "";
    if (providedContent !== null) {
      sourceCode = providedContent;
    } else {
      const effectiveToken = userPat || (process.env.GITHUB_TOKEN || "").trim();
      const ghHeaders = {
        Accept: "application/vnd.github+json",
        "User-Agent": "ChoyChat-GitHub-Intelligence",
        "X-GitHub-Api-Version": "2022-11-28"
      };
      if (effectiveToken) {
        ghHeaders.Authorization = `Bearer ${effectiveToken}`;
      }
      const encodedFilePath = rawFilePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
      const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}`;
      const queryRef = requestedBranch ? `?ref=${encodeURIComponent(requestedBranch)}` : "";
      const fileRes = await fetch(`${baseApi}/contents/${encodedFilePath}${queryRef}`, { headers: ghHeaders });
      const fileJson = await fileRes.json().catch(() => ({}));
      if (!fileRes.ok) {
        const ghMsg = typeof fileJson?.message === "string" ? fileJson.message : "GitHub API error";
        if (fileRes.status === 401) {
          return res.status(401).json({ error: "GitHub rejected the personal access token." });
        }
        if (fileRes.status === 404) {
          return res.status(404).json({ error: "File not found on this branch." });
        }
        if (fileRes.status === 403 && ghMsg.toLowerCase().includes("rate limit")) {
          return res.status(403).json({
            error: "GitHub API rate limit reached. Add a Personal Access Token to review files."
          });
        }
        return res.status(fileRes.status).json({ error: ghMsg });
      }
      if (Array.isArray(fileJson) || fileJson?.type !== "file") {
        return res.status(400).json({ error: "Selected path is not a reviewable file." });
      }
      const fileSize = typeof fileJson.size === "number" && fileJson.size >= 0 ? fileJson.size : 0;
      if (fileSize > 512 * 1024 || typeof fileJson.content !== "string") {
        return res.status(400).json({ error: "File is too large (> 512 KB) for AI Code Review." });
      }
      const rawBuffer = fileJson.encoding === "base64" ? Buffer.from(fileJson.content.replace(/\s+/g, ""), "base64") : Buffer.from(fileJson.content, "utf8");
      const sampleSlice = rawBuffer.subarray(0, Math.min(rawBuffer.length, 8192));
      if (sampleSlice.includes(0)) {
        return res.status(400).json({ error: "Binary files cannot be analyzed by AI Code Review." });
      }
      sourceCode = rawBuffer.toString("utf8");
    }
    if (!sourceCode.trim()) {
      return res.status(400).json({ error: "The selected file is empty and has no code to review." });
    }
    const MAX_REVIEW_CHARS = 55e3;
    const codeTruncated = sourceCode.length > MAX_REVIEW_CHARS;
    const codeForModel = codeTruncated ? sourceCode.slice(0, MAX_REVIEW_CHARS) : sourceCode;
    const numberedLines = codeForModel.split(/\r?\n/).map((line, idx) => `${idx + 1}: ${line}`).join("\n");
    const focusPrompt = reviewType === "security" ? "Focus strictly on APPLICATION SECURITY: injection risks (SQL/NoSQL/command/XSS), authentication/authorization flaws, SSRF, path traversal, hardcoded secrets or credential leaks, unsafe deserialization/HTML rendering, weak cryptography, CSRF, and insecure error handling." : "Focus strictly on RUNTIME & ARCHITECTURAL PERFORMANCE: algorithmic/Big-O bottlenecks, unnecessary loops or N+1 I/O calls, memory leaks, missing cleanup/memoization, excessive React re-renders, blocking main-thread/event-loop operations, unindexed lookups, and payload/bundle bloat.";
    const systemInstruction = `You are a Principal Software Engineer conducting an accurate, high-signal ${reviewType.toUpperCase()} code review of a single repository file.
${focusPrompt}
Rules:
- Only report real, verifiable issues grounded in the provided numbered source lines. Do not invent non-existent APIs or hallucinate line numbers.
- Cite approximate line numbers (e.g., "Line 42" or "Lines 88-104") when referencing specific code.
- Keep descriptions concise, concrete, and actionable.
- Provide up to 8 prioritized findings ordered from highest severity to lowest. If the file has no significant issues in this category, return an empty findings array and explain why in the summary.`;
    const prompt = `Repository: ${parsedRepo.owner}/${parsedRepo.repo}
Branch: ${requestedBranch || "default"}
File Path: ${rawFilePath}
Review Focus: ${reviewType.toUpperCase()}
${codeTruncated ? `(Note: File content truncated to first ${MAX_REVIEW_CHARS} characters for analysis.)
` : ""}
Numbered File Contents:
\`\`\`
${numberedLines}
\`\`\``;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.INTEGER,
              description: "Overall readiness score from 0 to 100 for the selected review focus."
            },
            rating: {
              type: Type.STRING,
              description: "One of: Excellent, Good, Needs Attention, Critical Risk"
            },
            summary: {
              type: Type.STRING,
              description: "2-3 sentence executive summary of findings and overall file quality."
            },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: {
                    type: Type.STRING,
                    description: "One of: critical, high, medium, low, info"
                  },
                  title: { type: Type.STRING },
                  lineHint: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                  codeExample: { type: Type.STRING }
                },
                required: ["severity", "title", "lineHint", "impact", "recommendation"]
              }
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            quickWins: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["score", "rating", "summary", "findings", "strengths", "quickWins"]
        }
      }
    });
    const rawText = (response.text ?? "{}").trim();
    const parsed = JSON.parse(rawText);
    const scoreNum = Number(parsed?.score);
    const score = Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 75;
    const validRatings = /* @__PURE__ */ new Set(["Excellent", "Good", "Needs Attention", "Critical Risk"]);
    const rating = validRatings.has(parsed?.rating) ? parsed.rating : score >= 88 ? "Excellent" : score >= 70 ? "Good" : score >= 45 ? "Needs Attention" : "Critical Risk";
    const validSeverities = /* @__PURE__ */ new Set(["critical", "high", "medium", "low", "info"]);
    const findings = Array.isArray(parsed?.findings) ? parsed.findings.slice(0, 10).map((f) => ({
      severity: validSeverities.has(String(f?.severity || "").toLowerCase()) ? String(f.severity).toLowerCase() : "medium",
      title: String(f?.title || "Code finding").slice(0, 180),
      lineHint: String(f?.lineHint || "General").slice(0, 60),
      impact: String(f?.impact || "").slice(0, 600),
      recommendation: String(f?.recommendation || "").slice(0, 800),
      codeExample: typeof f?.codeExample === "string" && f.codeExample.trim() ? f.codeExample.slice(0, 1200) : void 0
    })) : [];
    const strengths = Array.isArray(parsed?.strengths) ? parsed.strengths.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 6) : [];
    const quickWins = Array.isArray(parsed?.quickWins) ? parsed.quickWins.filter((q) => typeof q === "string" && q.trim().length > 0).slice(0, 6) : [];
    return res.json({
      reviewType,
      filePath: rawFilePath,
      branch: requestedBranch || "default",
      repoFullName: `${parsedRepo.owner}/${parsedRepo.repo}`,
      model: "gemini-4-hydrogen",
      analyzedChars: codeForModel.length,
      truncated: codeTruncated,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      score,
      rating,
      summary: String(parsed?.summary || "Review completed.").slice(0, 1200),
      findings,
      strengths,
      quickWins
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : "Failed to run Gemini code review";
    const lower = rawMsg.toLowerCase();
    if (lower.includes("api_key_invalid") || lower.includes("permission_denied") || lower.includes("api key")) {
      return res.status(403).json({
        error: "Gemini API authentication failed. Please check GEMINI_API_KEY in Settings > Secrets."
      });
    }
    if (lower.includes("resource_exhausted") || lower.includes("429") || lower.includes("quota")) {
      return res.status(429).json({
        error: "Gemini API quota reached. Please try again shortly or upgrade your API key in Settings > Secrets."
      });
    }
    return res.status(500).json({ error: rawMsg });
  }
});
app.post("/api/github/ai-review", async (req, res) => {
  const { owner, repo, prNumber, codeSnippet, title } = req.body;
  const token = req.headers.authorization?.replace("Bearer ", "") || "";
  try {
    let diffContent = codeSnippet || "";
    if (prNumber && owner && repo) {
      const headers = {
        ...token ? getGitHubHeaders(token) : { "User-Agent": "GitPulse-AI" },
        "Accept": "application/vnd.github.v3.diff"
      };
      const diffRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers });
      if (diffRes.ok) {
        diffContent = await diffRes.text();
      }
    }
    const prompt = `You are an expert Principal Software Engineer and Security Auditor performing an AI Code Review for a GitHub ${prNumber ? `Pull Request #${prNumber}` : "code snippet"}: ${title || ""}

Here is the code diff / content to review:
\`\`\`
${diffContent.slice(0, 15e3)}
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
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const resultJson = JSON.parse(response.text || "{}");
    res.json(resultJson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/github/ai-chat", async (req, res) => {
  const { question, repoName, description, language } = req.body;
  try {
    const prompt = `You are GitPulse AI, an expert GitHub repository assistant.
Repository: ${repoName || "Unknown"}
Description: ${description || "No description"}
Primary Language: ${language || "Unknown"}

User Question: ${question}

Provide a clear, concise, and highly accurate technical answer with code examples if helpful.`;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt
    });
    res.json({ answer: response.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/github/generate-docs", async (req, res) => {
  const { repoName, description, type, recentCommits } = req.body;
  try {
    const prompt = type === "readme" ? `Generate a professional, production-grade GitHub README.md markdown for repository "${repoName}". Description: "${description}". Include badges, installation instructions, quick start, features, and license section.` : `Generate professional GitHub release notes / changelog for repository "${repoName}". Recent Context: "${recentCommits || description}". Group into Features, Bug Fixes, and Performance Improvements with clean Markdown.`;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt
    });
    res.json({ content: response.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/github/readme-summary", async (req, res) => {
  const { repoFullName, readmeContent } = req.body;
  if (!readmeContent) {
    return res.status(400).json({ error: "README content is required" });
  }
  try {
    const prompt = `Analyze the following README.md content for GitHub repository "${repoFullName || "Repository"}". Generate a clear, structured summary covering:
1. Project Goals & Core Purpose
2. Setup & Installation Instructions
3. Quick Start / Usage Guidelines
4. Key Dependencies or Prerequisites

Format using clean Markdown with bullet points.

README Content:
${String(readmeContent).slice(0, 4e4)}`;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt
    });
    res.json({ summary: response.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function startServer() {
  const candidateDistPaths = [
    path2.resolve(process.cwd(), "dist"),
    path2.resolve(__dirname, "dist"),
    path2.resolve(__dirname, "../dist"),
    path2.resolve(__dirname)
  ];
  const distPath = candidateDistPaths.find((p) => fs2.existsSync(path2.join(p, "index.html"))) || candidateDistPaths[0];
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".webmanifest")) {
            res.setHeader("Content-Type", "application/manifest+json");
            res.setHeader("Cache-Control", "no-cache");
          } else if (filePath.endsWith("sw.js") || filePath.endsWith("registerSW.js") || filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          }
        }
      })
    );
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path2.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa",
      plugins: [
        {
          name: "disable-hmr-websocket-connect",
          transform(code, id) {
            if (id.includes("vite/dist/client/client.mjs")) {
              return code.replace(
                "transport.connect(createHMRHandler(handleMessage));",
                "/* HMR WebSocket disabled in middleware mode */"
              ).replace(
                'throw new SendBeforeConnectError("send was called before connect");',
                "return;"
              ).replace(
                'throw new SendBeforeConnectError("invoke was called before connect");',
                "return;"
              );
            }
          }
        }
      ]
    });
    app.use(vite.middlewares);
  }
  const PORT = Number(process.env.PORT || 3e3);
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.keepAliveTimeout = 65e3;
  server.headersTimeout = 66e3;
}
app.post("/api/github/org-sync", requireAuth, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const orgInput = typeof req.body?.org === "string" ? req.body.org.trim() : "";
    const userPat = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!orgInput || orgInput.length > 80 || !/^[a-zA-Z0-9_\-]+$/.test(orgInput)) {
      return res.status(400).json({ error: "Please provide a valid GitHub organization or username." });
    }
    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || "").trim();
    const ghHeaders = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ChoyChat-GitHub-Intelligence",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (effectiveToken) {
      ghHeaders.Authorization = `Bearer ${effectiveToken}`;
    }
    let reposUrl = `https://api.github.com/orgs/${encodeURIComponent(orgInput)}/repos?per_page=50&sort=updated`;
    let orgRes = await fetch(reposUrl, { headers: ghHeaders });
    if (orgRes.status === 404) {
      reposUrl = `https://api.github.com/users/${encodeURIComponent(orgInput)}/repos?per_page=50&sort=updated`;
      orgRes = await fetch(reposUrl, { headers: ghHeaders });
    }
    const orgJson = orgRes.ok ? await orgRes.json().catch(() => []) : [];
    if (!orgRes.ok) {
      const ghMsg = typeof orgJson?.message === "string" ? orgJson.message : "GitHub API error";
      if (orgRes.status === 401) {
        return res.status(401).json({ error: "GitHub rejected the personal access token." });
      }
      if (orgRes.status === 404) {
        return res.status(404).json({ error: `Organization or user "${orgInput}" not found on GitHub.` });
      }
      return res.status(orgRes.status).json({ error: ghMsg });
    }
    if (!Array.isArray(orgJson) || orgJson.length === 0) {
      return res.json({ org: orgInput, repositories: [] });
    }
    const repositories = orgJson.map((r) => ({
      name: String(r?.name || ""),
      fullName: String(r?.full_name || ""),
      description: typeof r?.description === "string" ? r?.description : "",
      visibility: typeof r?.visibility === "string" ? r?.visibility : r?.private ? "private" : "public",
      isPrivate: Boolean(r?.private),
      defaultBranch: typeof r?.default_branch === "string" ? r?.default_branch : "main",
      htmlUrl: r?.html_url || "",
      stars: Number(r?.stargazers_count) || 0,
      forks: Number(r?.forks_count) || 0,
      openIssues: Number(r?.open_issues_count) || 0,
      sizeKb: Number(r?.size) || 0,
      language: typeof r?.language === "string" ? r?.language : null,
      updatedAt: typeof r?.updated_at === "string" ? r?.updated_at : null
    }));
    return res.json({
      org: orgInput,
      count: repositories.length,
      repositories
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to sync GitHub organization repositories"
    });
  }
});
app.post("/api/github/export-issue", requireAuth, async (req, res) => {
  try {
    const hasBearer = Boolean(req.headers.authorization?.startsWith("Bearer "));
    if (!hasBearer) {
      const origin = req.headers.origin;
      const expectedHost = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();
      const hasRequestedWith = req.headers["x-requested-with"] === "XMLHttpRequest";
      let originMatches = false;
      if (typeof origin === "string" && expectedHost) {
        try {
          originMatches = new URL(origin).host === expectedHost;
        } catch {
          originMatches = false;
        }
      }
      if (!originMatches && !hasRequestedWith) {
        return res.status(403).json({ error: "Cross-origin request blocked" });
      }
    }
    const repoUrl = typeof req.body?.repoUrl === "string" ? req.body.repoUrl : "";
    const userPat = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const issueTitle = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : "Choy Chat Security Audit";
    const issueBody = typeof req.body?.body === "string" ? req.body.body : "";
    const parsedRepo = parseGitHubRepoInput(repoUrl);
    if (!parsedRepo) {
      return res.status(400).json({ error: "Invalid GitHub repository URL." });
    }
    const effectiveToken = userPat || (process.env.GITHUB_TOKEN || "").trim();
    if (!effectiveToken) {
      return res.status(401).json({
        error: "A GitHub Personal Access Token with repo (issues) write access is required to export issues."
      });
    }
    const ghHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${effectiveToken}`,
      "User-Agent": "ChoyChat-GitHub-Intelligence",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };
    const baseApi = `https://api.github.com/repos/${encodeURIComponent(parsedRepo.owner)}/${encodeURIComponent(parsedRepo.repo)}/issues`;
    const issueRes = await fetch(baseApi, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["security", "ai-review", "choy-chat"]
      })
    });
    const issueJson = await issueRes.json().catch(() => ({}));
    if (!issueRes.ok) {
      const ghMsg = typeof issueJson?.message === "string" ? issueJson.message : "GitHub API error";
      if (issueRes.status === 401 || issueRes.status === 403) {
        return res.status(403).json({
          error: 'GitHub denied issue creation. Ensure your Personal Access Token has "repo" (Full control of private repositories) or "public_repo" scope.'
        });
      }
      return res.status(issueRes.status).json({ error: ghMsg });
    }
    return res.json({
      success: true,
      issueUrl: safeGitHubExternalUrl(issueJson?.html_url) || `https://github.com/${parsedRepo.owner}/${parsedRepo.repo}/issues`,
      issueNumber: Number(issueJson?.number) || 0
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to export issue to GitHub"
    });
  }
});
startServer();
