import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export type NewsfeedChannel = 'feed_a' | 'feed_b' | 'feed_c' | 'feed_bc' | 'both';
export type SelectableNewsfeedChannel = 'feed_a' | 'feed_b' | 'feed_c' | 'feed_bc';

export function normalizeUserNewsfeed(raw: unknown): SelectableNewsfeedChannel {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (val === 'feed_b') return 'feed_b';
  if (val === 'feed_c') return 'feed_c';
  if (val === 'feed_bc') return 'feed_bc';
  return 'feed_a';
}

export function normalizePostNewsfeed(raw: unknown): NewsfeedChannel {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (val === 'feed_a') return 'feed_a';
  if (val === 'feed_b') return 'feed_b';
  if (val === 'feed_c') return 'feed_c';
  if (val === 'feed_bc') return 'feed_bc';
  if (val === 'both') return 'both';
  return 'feed_a';
}

export type AnnouncementTarget = 'all' | 'feed_a' | 'feed_b' | 'feed_c' | 'feed_bc';
export type AnnouncementBadge = 'announcement' | 'reminder' | 'urgent';
export type AnnouncementTone = 'emerald' | 'amber' | 'sky' | 'rose';

export interface StoredAnnouncement {
  id: string;
  title: string;
  message: string;
  badge: AnnouncementBadge;
  tone: AnnouncementTone;
  target: AnnouncementTarget;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeAnnouncementTarget(raw: unknown): AnnouncementTarget {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (val === 'feed_a' || val === 'feed_b' || val === 'feed_c' || val === 'feed_bc') return val;
  return 'all';
}

export function normalizeAnnouncementBadge(raw: unknown): AnnouncementBadge {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (val === 'reminder' || val === 'urgent') return val;
  return 'announcement';
}

export function normalizeAnnouncementTone(raw: unknown): AnnouncementTone {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (val === 'amber' || val === 'sky' || val === 'rose') return val;
  return 'emerald';
}

export interface StoredUser {
  id: string;
  name: string;
  phone: string;
  pinHash: string;
  role: 'admin' | 'member';
  status: 'pending' | 'approved';
  blockedUsers: string[];
  avatar?: string;
  newsfeed: SelectableNewsfeedChannel;
  encryptedRealName?: string;
  privateValidIdAssetId?: string;
  privateRealAvatarAssetId?: string;
  privacyConsentAccepted?: boolean;
  privacyConsentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserDTO {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'member';
  status: 'pending' | 'approved';
  avatar?: string;
  newsfeed: SelectableNewsfeedChannel;
  loginDate: string;
}

export interface StoredPostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

export interface StoredPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  content: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'video';
  category: 'feed' | 'myday' | 'video';
  newsfeed: NewsfeedChannel;
  likes: string[];
  comments: StoredPostComment[];
  shares: number;
  views: number;
  viewedBy: string[];
  createdAt: string;
}

export interface StoredMessage {
  id: string;
  senderId: string;
  senderName: string;
  roomId: string;
  text: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'video' | 'audio' | 'file';
  transcript?: string;
  reactions: string[];
  createdAt: string;
}

export interface StoredChatGroup {
  id: string;
  name: string;
  memberIds: string[];
  createdById: string;
  createdByName: string;
  adminId?: string;
  adminName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredLedgerRow {
  id: string;
  name: string;
  fiveH: number;
  fiveHType: 'blue' | 'red';
  bulig: number;
  point5: number;
  halfSack: number;
  oneSack: number;
  bal: number;
  updatedAt: string;
}

export interface StoredKnowledgeQA {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface StoredPricesSettings {
  fiveH: number;
  bulig: number;
  point5: number;
  halfSack: number;
  oneSack: number;
  defFiveH: number;
  defBulig: number;
  defPoint5: number;
  defHalfSack: number;
  defOneSack: number;
}

export interface StoredPushSubscription {
  endpoint: string;
  userId: string;
  userName: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  updatedAt: string;
}

export interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface StoredEmojiLink {
  id: string;
  emojiCode: string;
  targetUrl: string;
  title: string;
  iconUrl: string;
  pinnedToAppIcon: boolean;
  createdBy: string;
  createdAt: string;
}

export interface StudioNoteEntry {
  id: string;
  rawText: string;
  createdAt: string;
}

export interface StoredStudioNoteFile {
  id: string;
  title: string;
  category: string;
  entries: StudioNoteEntry[];
  organizedPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredEnvVaultEntry {
  id: string;
  category: string;
  keyName: string;
  value: string;
  secret: boolean;
  notes?: string;
  updatedAt: string;
}

export interface StoredNewsfeedConfig {
  feedATitle: string;
  feedBTitle: string;
  feedCTitle: string;
}

export interface ChoyPromoItem {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  appliesTo: 'all' | 'marketplace' | 'subscription';
  minSpend: number;
  active: boolean;
  expiresAt?: string;
}

export interface ChoyFeatureToggles {
  marketplace: boolean;
  wallet: boolean;
  choyWallet: boolean;
  choyPro: boolean;
  subscription: boolean;
  paymentTerminal: boolean;
  groupchat: boolean;
  messages: boolean;
  choyAi: boolean;
  acknowledgment: boolean;
  rules: boolean;
  invest: boolean;
}

export interface StoredChoyProgramsConfig {
  choyPro: {
    enabled: boolean;
    monthlyPhp: number;
    monthlyChoy: number;
    annualPhp: number;
    annualChoy: number;
    vipPhp: number;
    vipChoy: number;
    tagline: string;
    perks: string[];
  };
  choyWallet: {
    conversionRate: number;
    minConvertPhp: number;
    maxConvertPhp: number;
    allowConvert: boolean;
    allowTransfers: boolean;
    topUpInstructions: string;
  };
  promos: ChoyPromoItem[];
  featureToggles: ChoyFeatureToggles;
  updatedAt: string;
}

export interface WalletTxItem {
  id: string;
  walletType: 'wallet' | 'choy_wallet';
  kind: 'topup' | 'withdraw' | 'transfer_out' | 'transfer_in' | 'reward' | 'convert' | 'subscription' | 'choy_pro';
  amount: number;
  note: string;
  counterparty?: string;
  createdAt: string;
}

export type KycVerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';

export interface StoredUserDashboard {
  userId: string;
  publicShowName: boolean;
  walletBalance: number;
  choyWalletBalance: number;
  choyProActive: boolean;
  choyProActivatedAt?: string;
  subscriptionPlan: 'free' | 'choy_pro_monthly' | 'choy_pro_annual' | 'vip_supporter';
  subscriptionStatus: 'active' | 'inactive' | 'cancelled';
  subscriptionAutoRenew: boolean;
  subscriptionRenewAt?: string;
  lastDailyClaimAt?: string;
  rulesAcceptedAt?: string;
  acknowledgmentSignedName?: string;
  acknowledgmentSignedAt?: string;
  kycCompleteName?: string;
  kycAddress?: string;
  kycAge?: number;
  kycSex?: 'Male' | 'Female' | 'Other';
  kycValidIdType?: string;
  kycValidIdName?: string;
  kycValidIdImageUrl?: string;
  kycStatus?: KycVerificationStatus;
  kycSubmittedAt?: string;
  kycReviewedBy?: string;
  kycReviewedAt?: string;
  kycRejectionReason?: string;
  transactions: WalletTxItem[];
  updatedAt: string;
}

export interface StoredMusicTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  fileName: string;
  durationSec: number;
  sizeBytes: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface StoredLongVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  fileName: string;
  durationSec: number;
  sizeBytes: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface StoredInvestProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  dailyRatePercent: number;
  durationDays: number;
  badge?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredUserInvestment {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  productTitle: string;
  principalAmount: number;
  dailyRatePercent: number;
  durationDays: number;
  dailyEarning: number;
  totalTargetEarnings: number;
  claimedEarnings: number;
  startedAt: string;
  endsAt: string;
}

export interface StoredPrivateKycAsset {
  id: string;
  ownerUserId?: string;
  kind: 'valid_id' | 'real_avatar';
  storage: 'supabase_private' | 'local_private';
  bucket: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface StoredSystemActivityLog {
  id: string;
  category: 'auth' | 'order' | 'kyc' | 'payment' | 'system' | 'blog' | 'contact';
  actor: string;
  message: string;
  createdAt: string;
}

export interface StoredSystemErrorLog {
  id: string;
  source: 'backend' | 'stripe_webhook' | 'database' | 'storage' | 'auth';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  resolved: boolean;
  createdAt: string;
}

export interface StoredBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string[];
  category: 'Delivery Tips' | 'Restaurant Spotlight' | 'Rider Stories' | 'Safety & Privacy';
  author: string;
  readTimeMin: number;
  coverImage: string;
  publishedAt: string;
  updatedAt: string;
}

export interface StoredVisitorStats {
  totalVisits: number;
  dailyCounts: Record<string, number>;
  lastVisitAt: string;
}

export interface StoredContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface StoredAbandonedCart {
  id: string;
  sessionKey: string;
  itemCount: number;
  createdAt: string;
}

const EPHEMERAL_KYC_FALLBACK = crypto.randomBytes(32).toString('hex');

function getKycAesKey(): Buffer {
  const secret = (process.env.KYC_ENCRYPTION_KEY || process.env.SESSION_SECRET || EPHEMERAL_KYC_FALLBACK).trim();
  return crypto.scryptSync(secret, 'choychat_admin_kyc_salt_v1', 32);
}

export function encryptSensitiveField(plaintext: string): string {
  const clean = plaintext.trim();
  if (!clean) return '';
  const key = getKycAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc_v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSensitiveField(ciphertext: string | undefined | null): string {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  if (!ciphertext.startsWith('enc_v1:')) return ciphertext;
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return '';
    const key = getKycAesKey();
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const encrypted = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '[Encrypted — Key Rotated]';
  }
}

export const DEFAULT_BLOG_POSTS: StoredBlogPost[] = [
  {
    id: 'blog_1',
    slug: 'choy-chat-message-loved-ones-and-order-food-directly',
    title: 'Welcome to Choy Chat: Message Your Loved Ones, Video Call, and Order Food When You Are Hungry',
    excerpt: 'Stay close to family and friends with instant messaging and video calls, then order fresh local comfort food directly from the Food Store whenever hunger strikes.',
    content: [
      'Choy Chat was created to bring everything you love together in one seamless experience. Whether you want to send a quick message to your loved ones, catch up face-to-face with an HD video call, or share daily photos and moments on the community newsfeed, Choy Chat keeps you connected 24/7.',
      'And whenever hunger kicks in while you are chatting or browsing, you do not need to switch apps. You can open the Choy Chat Food Store directly and order freshly prepared meals—from charcoal-grilled chicken inasal to steaming noodle bowls—delivered straight to your door.',
      'Chat, video call, share stories, and order delicious food all in one place with Choy Chat!'
    ],
    category: 'Restaurant Spotlight',
    author: 'Choy Chat Editorial Team',
    readTimeMin: 4,
    coverImage: '/assets/images/hero_local_food_delivery_1795763680017.jpg',
    publishedAt: '2026-11-26T08:00:00.000Z',
    updatedAt: '2026-11-26T08:00:00.000Z',
  },
  {
    id: 'blog_2',
    slug: 'top-comfort-food-dishes-to-order-when-hungry-on-choy-chat',
    title: 'Feeling Hungry? Order Local Comfort Food Directly Inside Choy Chat',
    excerpt: 'Explore must-try neighborhood dishes—from sizzling pork sisig to rich beef batchoy—ready to order instantly while chatting with friends.',
    content: [
      'There is nothing quite like craving a hot, satisfying meal right in the middle of an afternoon chat with family or coworkers. Instead of leaving your conversation to search for food elsewhere, the Choy Chat Food Store lets you order directly.',
      'Choose from local partner kitchens serving crispy lechon kawali, savory pancit bihon platters, and refreshing halo-halo. Every order features transparent delivery fees and live status updates from kitchen prep to doorstep arrival.',
      'Stay connected with the people you care about and satisfy your hunger without missing a beat.'
    ],
    category: 'Restaurant Spotlight',
    author: 'Choy Chat Food Desk',
    readTimeMin: 4,
    coverImage: '/assets/images/blog_restaurant_kitchen_1795763680437.jpg',
    publishedAt: '2026-11-25T09:30:00.000Z',
    updatedAt: '2026-11-25T09:30:00.000Z',
  },
  {
    id: 'blog_3',
    slug: 'staying-connected-video-calls-and-group-chats-on-choy-chat',
    title: 'Catch Up Anytime: HD Video Calls & Neighborhood Group Chats on Choy Chat',
    excerpt: 'Connect instantly with family across town through crystal-clear video calls and coordinate weekend get-togethers in group chats.',
    content: [
      'Distance is never a barrier when you have instant messaging and crystal-clear video calls right at your fingertips. Share laughs, celebrate milestones, and check in on family members instantly.',
      'Organizing weekend gatherings or office lunches is just as easy using Choy Chat group chats. Discuss what food everyone is craving, pick your favorite dishes from the Food Store, and place your order together smoothly.'
    ],
    category: 'Delivery Tips',
    author: 'Choy Chat Editorial Team',
    readTimeMin: 3,
    coverImage: '/assets/images/blog_packaging_tips_1795763682155.jpg',
    publishedAt: '2026-11-24T11:00:00.000Z',
    updatedAt: '2026-11-24T11:00:00.000Z',
  },
  {
    id: 'blog_4',
    slug: 'meet-the-choy-chat-riders-delivering-hot-meals',
    title: 'Meet Our Trusted Riders Delivering Hot Meals Straight to Your Door',
    excerpt: 'How community riders ensure your favorite meals arrive hot, secure, and right on time.',
    content: [
      'When you order food directly on Choy Chat, our dedicated local riders make sure your meals travel safely in insulated thermal bags. From narrow neighborhood streets to apartment gates, riders navigate local routes efficiently so your food arrives fresh and piping hot.'
    ],
    category: 'Rider Stories',
    author: 'Choy Chat Rider Community',
    readTimeMin: 3,
    coverImage: '/assets/images/blog_delivery_rider_1795763682277.jpg',
    publishedAt: '2026-11-22T10:15:00.000Z',
    updatedAt: '2026-11-22T10:15:00.000Z',
  },
  {
    id: 'blog_5',
    slug: 'keep-your-food-deliveries-hot-and-crispy',
    title: 'Tips for Hotter, Crispier Food Deliveries on Choy Chat',
    excerpt: 'Simple ordering notes and landmark tips that guarantee restaurant-quality meals at your dining table.',
    content: [
      'Maximize your food delivery experience by adding helpful gate notes and requesting vented packaging for crispy fried items. Choy Chat makes local food ordering simple, transparent, and delicious.'
    ],
    category: 'Delivery Tips',
    author: 'Choy Chat Food Desk',
    readTimeMin: 3,
    coverImage: '/assets/images/blog_packaging_tips_1795763682155.jpg',
    publishedAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:00:00.000Z',
  },
  {
    id: 'blog_6',
    slug: 'privacy-first-messaging-and-ordering-on-choy-chat',
    title: 'Chat & Order Safely: How Choy Chat Protects Your Privacy',
    excerpt: 'Enjoy secure messaging and private KYC verification that keeps your identity safe while you chat and order food.',
    content: [
      'Choy Chat values your privacy. Chat with peace of mind using your public Display Name while your verification documents remain securely encrypted in our Admin-only private vault.'
    ],
    category: 'Safety & Privacy',
    author: 'Choy Chat Trust & Safety',
    readTimeMin: 3,
    coverImage: '/assets/images/hero_local_food_delivery_1795763680017.jpg',
    publishedAt: '2026-11-18T14:00:00.000Z',
    updatedAt: '2026-11-18T14:00:00.000Z',
  },
];

export interface StoredMarketplaceItem {
  id: string;
  category: 'food' | 'groceries' | 'medicines' | 'appliances';
  title: string;
  description: string;
  price: number;
  imageUrl?: string;
  stock: number;
  sellerName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMarketplaceOrderItem {
  itemId: string;
  title: string;
  category: 'food' | 'groceries' | 'medicines' | 'appliances';
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface StoredMarketplaceOrder {
  id: string;
  userId: string;
  userName: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  deliveryDistanceKm?: number;
  deliveryFee?: number;
  items: StoredMarketplaceOrderItem[];
  totalAmount: number;
  paymentMethod: 'wallet' | 'choy_wallet';
  status: 'pending' | 'preparing' | 'out_for_delivery' | 'completed' | 'cancelled';
  createdAt: string;
}

export const DEFAULT_MARKETPLACE_ITEMS: StoredMarketplaceItem[] = [
  {
    id: 'item_food_1',
    category: 'food',
    title: 'Choy Special Grilled Chicken',
    description: 'Juicy charcoal-grilled chicken with special Java rice & vinegar dip.',
    price: 250,
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
    stock: 50,
    sellerName: 'Choy Kitchen',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_food_2',
    category: 'food',
    title: 'Crispy Pata Delight',
    description: 'Deep-fried pork trotters served with soy-vinegar chili sauce.',
    price: 480,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
    stock: 30,
    sellerName: 'Choy Kitchen',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_groc_1',
    category: 'groceries',
    title: 'Jasmine Premium Rice 5kg',
    description: 'Aromatic, soft-textured premium white rice for daily family meals.',
    price: 295,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    stock: 120,
    sellerName: 'Choy Grocer',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_groc_2',
    category: 'groceries',
    title: 'Fresh Farm Eggs 12pcs',
    description: 'Grade-A fresh chicken eggs sourced directly from local organic farms.',
    price: 130,
    imageUrl: 'https://images.unsplash.com/photo-1516448699432-843c0800d17d?w=600&auto=format&fit=crop&q=80',
    stock: 80,
    sellerName: 'Choy Grocer',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_med_1',
    category: 'medicines',
    title: 'Paracetamol 500mg (10 Tablets)',
    description: 'Fast relief for fever, headaches, body aches, and flu symptoms.',
    price: 45,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    stock: 200,
    sellerName: 'Choy Pharmacy',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_med_2',
    category: 'medicines',
    title: 'Vitamin C with Rosehips 500mg',
    description: 'Immune system booster and antioxidant daily supplement.',
    price: 220,
    imageUrl: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80',
    stock: 150,
    sellerName: 'Choy Pharmacy',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_app_1',
    category: 'appliances',
    title: 'Smart 16-inch Electric Fan',
    description: 'Energy-saving 3-speed oscillating stand fan with silent copper motor.',
    price: 1299,
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80',
    stock: 25,
    sellerName: 'Choy Appliances',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item_app_2',
    category: 'appliances',
    title: 'Mini Automatic Rice Cooker 1.2L',
    description: 'Compact non-stick rice cooker with keep-warm mode, ideal for small households.',
    price: 899,
    imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
    stock: 40,
    sellerName: 'Choy Appliances',
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];


export interface SessionPayload {
  uid: string;
  role: 'admin' | 'member';
  exp: number;
}

const DEFAULT_AVATAR = '/assets/aistudio/image_20261121_145253_f477cbfa.webp';
const DEFAULT_NEWSFEED_CONFIG: StoredNewsfeedConfig = {
  feedATitle: 'Newsfeed A',
  feedBTitle: 'Newsfeed B',
  feedCTitle: 'Newsfeed C',
};
export const DEFAULT_CHOY_PROGRAMS_CONFIG: StoredChoyProgramsConfig = {
  choyPro: {
    enabled: true,
    monthlyPhp: 199,
    monthlyChoy: 250,
    annualPhp: 1499,
    annualChoy: 1800,
    vipPhp: 499,
    vipChoy: 600,
    tagline: 'Unlock Pro member badge, priority features & exclusive Choy perks',
    perks: [
      'Verified Choy Pro Crown Badge beside your Created Name (Public Show)',
      'Priority Choy AI Assistant & GitHub Intelligence access',
      'HD Video Calls with Custom Video Backgrounds & Screen Share',
      'Priority Groupchat & Newsfeed Spotlight highlights',
      'Exclusive Choy Promo discounts in Food Store & Marketplace',
    ],
  },
  choyWallet: {
    conversionRate: 2,
    minConvertPhp: 10,
    maxConvertPhp: 50000,
    allowConvert: true,
    allowTransfers: true,
    topUpInstructions: 'Top up your Cash Wallet or message Admin for verified CHOY Coin top-ups.',
  },
  promos: [],
  featureToggles: {
    marketplace: true,
    wallet: true,
    choyWallet: true,
    choyPro: true,
    subscription: true,
    paymentTerminal: true,
    groupchat: true,
    messages: true,
    choyAi: true,
    acknowledgment: true,
    rules: true,
    invest: true,
  },
  updatedAt: new Date(0).toISOString(),
};

export const DEFAULT_INVEST_PRODUCTS: StoredInvestProduct[] = [
  {
    id: 'inv_starter_500',
    title: 'Starter Yield Plan',
    description: '5% daily simple interest for 30 days. Live per-minute earning counter.',
    price: 500,
    dailyRatePercent: 5,
    durationDays: 30,
    badge: 'STARTER',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'inv_standard_1000',
    title: 'Silver Yield Plan',
    description: 'Popular 30-day plan — earns ₱50/day for 30 days (₱1,500 total earnings).',
    price: 1000,
    dailyRatePercent: 5,
    durationDays: 30,
    badge: 'POPULAR',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'inv_growth_2500',
    title: 'Gold Yield Plan',
    description: 'Higher daily yield — earns ₱125/day for 30 days (₱3,750 total earnings).',
    price: 2500,
    dailyRatePercent: 5,
    durationDays: 30,
    badge: 'GROWTH',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'inv_pro_5000',
    title: 'Diamond Yield Plan',
    description: 'Premium 30-day yield — earns ₱250/day for 30 days (₱7,500 total earnings).',
    price: 5000,
    dailyRatePercent: 5,
    durationDays: 30,
    badge: 'VIP',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function sanitizeChoyProgramsConfig(raw: unknown): StoredChoyProgramsConfig {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<StoredChoyProgramsConfig>;
  const rawPro = (input.choyPro && typeof input.choyPro === 'object' ? input.choyPro : {}) as Partial<StoredChoyProgramsConfig['choyPro']>;
  const rawWallet = (input.choyWallet && typeof input.choyWallet === 'object' ? input.choyWallet : {}) as Partial<StoredChoyProgramsConfig['choyWallet']>;
  const rawToggles = (input.featureToggles && typeof input.featureToggles === 'object' ? input.featureToggles : {}) as Partial<ChoyFeatureToggles>;

  const perksList = Array.isArray(rawPro.perks)
    ? rawPro.perks
        .map((p) => (typeof p === 'string' ? p.trim().slice(0, 160) : ''))
        .filter(Boolean)
        .slice(0, 12)
    : DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.perks;

  const rawPromos = Array.isArray(input.promos) ? input.promos : [];
  const promos: ChoyPromoItem[] = [];
  const seenCodes = new Set<string>();
  for (const item of rawPromos.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Partial<ChoyPromoItem>;
    const code = typeof p.code === 'string' ? p.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24) : '';
    if (!code || seenCodes.has(code)) continue;
    seenCodes.add(code);
    const discountType = p.discountType === 'fixed' ? 'fixed' : 'percent';
    const maxVal = discountType === 'percent' ? 95 : 100000;
    const discountValue = clampNum(p.discountValue, 1, maxVal);
    const appliesTo =
      p.appliesTo === 'marketplace' || p.appliesTo === 'subscription' ? p.appliesTo : 'all';
    const expiresAt =
      typeof p.expiresAt === 'string' && p.expiresAt.trim()
        ? p.expiresAt.trim().slice(0, 32)
        : undefined;
    promos.push({
      id: typeof p.id === 'string' && p.id.trim() ? p.id.trim().slice(0, 48) : `promo_${code.toLowerCase()}`,
      code,
      title: typeof p.title === 'string' && p.title.trim() ? p.title.trim().slice(0, 80) : code,
      description: typeof p.description === 'string' ? p.description.trim().slice(0, 200) : '',
      discountType,
      discountValue,
      appliesTo,
      minSpend: clampNum(p.minSpend, 0, 1000000),
      active: p.active !== false,
      expiresAt,
    });
  }

  const minConvertPhp = clampNum(rawWallet.minConvertPhp ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyWallet.minConvertPhp, 1, 100000);
  const maxConvertPhp = Math.max(
    minConvertPhp,
    clampNum(rawWallet.maxConvertPhp ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyWallet.maxConvertPhp, 1, 1000000)
  );

  return {
    choyPro: {
      enabled: rawPro.enabled !== false,
      monthlyPhp: clampNum(rawPro.monthlyPhp ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.monthlyPhp, 1, 100000),
      monthlyChoy: clampNum(rawPro.monthlyChoy ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.monthlyChoy, 1, 1000000),
      annualPhp: clampNum(rawPro.annualPhp ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.annualPhp, 1, 500000),
      annualChoy: clampNum(rawPro.annualChoy ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.annualChoy, 1, 5000000),
      vipPhp: clampNum(rawPro.vipPhp ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.vipPhp, 1, 500000),
      vipChoy: clampNum(rawPro.vipChoy ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.vipChoy, 1, 5000000),
      tagline:
        typeof rawPro.tagline === 'string' && rawPro.tagline.trim()
          ? rawPro.tagline.trim().slice(0, 160)
          : DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.tagline,
      perks: perksList.length > 0 ? perksList : DEFAULT_CHOY_PROGRAMS_CONFIG.choyPro.perks,
    },
    choyWallet: {
      conversionRate: clampNum(rawWallet.conversionRate ?? DEFAULT_CHOY_PROGRAMS_CONFIG.choyWallet.conversionRate, 0.1, 1000),
      minConvertPhp,
      maxConvertPhp,
      allowConvert: rawWallet.allowConvert !== false,
      allowTransfers: rawWallet.allowTransfers !== false,
      topUpInstructions:
        typeof rawWallet.topUpInstructions === 'string' && rawWallet.topUpInstructions.trim()
          ? rawWallet.topUpInstructions.trim().slice(0, 300)
          : DEFAULT_CHOY_PROGRAMS_CONFIG.choyWallet.topUpInstructions,
    },
    promos,
    featureToggles: {
      marketplace: rawToggles.marketplace !== false,
      wallet: rawToggles.wallet !== false,
      choyWallet: rawToggles.choyWallet !== false,
      choyPro: rawToggles.choyPro !== false,
      subscription: rawToggles.subscription !== false,
      paymentTerminal: rawToggles.paymentTerminal !== false,
      groupchat: rawToggles.groupchat !== false,
      messages: rawToggles.messages !== false,
      choyAi: rawToggles.choyAi !== false,
      acknowledgment: rawToggles.acknowledgment !== false,
      rules: rawToggles.rules !== false,
      invest: rawToggles.invest !== false,
    },
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
  };
}

export type PaymentTerminalChannelId = 'gcash' | 'maya' | 'qrph' | 'bank_transfer' | 'online_card';
export type PaymentTerminalPurpose = 'wallet_topup' | 'choy_coins' | 'order_payment' | 'pos_payment';
export type PaymentTerminalStatus = 'pending' | 'approved' | 'rejected';

export interface StoredPaymentTerminalConfig {
  enabled: boolean;
  merchantName: string;
  terminalId: string;
  gcashEnabled: boolean;
  gcashName: string;
  gcashNumber: string;
  gcashQrUrl?: string;
  mayaEnabled: boolean;
  mayaName: string;
  mayaNumber: string;
  mayaQrUrl?: string;
  qrphEnabled: boolean;
  qrphLabel: string;
  qrphQrUrl?: string;
  bankEnabled: boolean;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  onlineCardEnabled: boolean;
  convenienceFeePercent: number;
  minAmountPhp: number;
  maxAmountPhp: number;
  instructions: string;
  updatedAt: string;
}

export interface StoredPaymentTerminalTx {
  id: string;
  referenceCode: string;
  userId: string;
  userName: string;
  userPhone?: string;
  purpose: PaymentTerminalPurpose;
  channel: PaymentTerminalChannelId;
  amountPhp: number;
  feePhp: number;
  totalPhp: number;
  choyCoinsPreview: number;
  payerReference: string;
  customerName: string;
  customerContact: string;
  note: string;
  receiptImageUrl?: string;
  checkoutUrl?: string;
  status: PaymentTerminalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  creditedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export const DEFAULT_PAYMENT_TERMINAL_CONFIG: StoredPaymentTerminalConfig = {
  enabled: true,
  merchantName: 'Choy Chat Merchant POS',
  terminalId: 'CHOY-POS-01',
  gcashEnabled: true,
  gcashName: 'Choy Chat Official',
  gcashNumber: '09361223978',
  gcashQrUrl: undefined,
  mayaEnabled: true,
  mayaName: 'Choy Chat Official',
  mayaNumber: '0918 000 0000',
  mayaQrUrl: undefined,
  qrphEnabled: true,
  qrphLabel: 'Choy Chat QRPh Unified',
  qrphQrUrl: undefined,
  bankEnabled: true,
  bankName: 'BDO / BPI / UnionBank',
  bankAccountName: 'Choy Chat Merchant',
  bankAccountNumber: '0000-0000-0000',
  onlineCardEnabled: true,
  convenienceFeePercent: 0,
  minAmountPhp: 10,
  maxAmountPhp: 100000,
  instructions:
    'Send the exact Total Amount using your chosen online channel, enter your reference number or upload your screenshot, then submit for fast verification.',
  updatedAt: new Date(0).toISOString(),
};

function sanitizeTerminalImageUrl(raw: unknown): string | undefined {
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

export function sanitizePaymentTerminalConfig(raw: unknown): StoredPaymentTerminalConfig {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const str = (val: unknown, fallback: string, maxLen: number): string => {
    if (typeof val !== 'string') return fallback;
    const t = val.trim();
    return t ? t.slice(0, maxLen) : fallback;
  };
  const minAmountPhp = clampNum(input.minAmountPhp ?? DEFAULT_PAYMENT_TERMINAL_CONFIG.minAmountPhp, 1, 100000);
  const maxAmountPhp = Math.max(
    minAmountPhp,
    clampNum(input.maxAmountPhp ?? DEFAULT_PAYMENT_TERMINAL_CONFIG.maxAmountPhp, 1, 500000)
  );
  const rawGcashNumber = str(input.gcashNumber, DEFAULT_PAYMENT_TERMINAL_CONFIG.gcashNumber, 40);
  const normalizedGcashNumber =
    rawGcashNumber.replace(/\s+/g, '') === '09170000000'
      ? DEFAULT_PAYMENT_TERMINAL_CONFIG.gcashNumber
      : rawGcashNumber;
  return {
    enabled: input.enabled !== false,
    merchantName: str(input.merchantName, DEFAULT_PAYMENT_TERMINAL_CONFIG.merchantName, 80),
    terminalId: str(input.terminalId, DEFAULT_PAYMENT_TERMINAL_CONFIG.terminalId, 32).toUpperCase(),
    gcashEnabled: input.gcashEnabled !== false,
    gcashName: str(input.gcashName, DEFAULT_PAYMENT_TERMINAL_CONFIG.gcashName, 80),
    gcashNumber: normalizedGcashNumber,
    gcashQrUrl: sanitizeTerminalImageUrl(input.gcashQrUrl),
    mayaEnabled: input.mayaEnabled !== false,
    mayaName: str(input.mayaName, DEFAULT_PAYMENT_TERMINAL_CONFIG.mayaName, 80),
    mayaNumber: str(input.mayaNumber, DEFAULT_PAYMENT_TERMINAL_CONFIG.mayaNumber, 40),
    mayaQrUrl: sanitizeTerminalImageUrl(input.mayaQrUrl),
    qrphEnabled: input.qrphEnabled !== false,
    qrphLabel: str(input.qrphLabel, DEFAULT_PAYMENT_TERMINAL_CONFIG.qrphLabel, 80),
    qrphQrUrl: sanitizeTerminalImageUrl(input.qrphQrUrl),
    bankEnabled: input.bankEnabled !== false,
    bankName: str(input.bankName, DEFAULT_PAYMENT_TERMINAL_CONFIG.bankName, 80),
    bankAccountName: str(input.bankAccountName, DEFAULT_PAYMENT_TERMINAL_CONFIG.bankAccountName, 80),
    bankAccountNumber: str(input.bankAccountNumber, DEFAULT_PAYMENT_TERMINAL_CONFIG.bankAccountNumber, 60),
    onlineCardEnabled: input.onlineCardEnabled !== false,
    convenienceFeePercent: Math.round(clampNum(input.convenienceFeePercent ?? 0, 0, 25) * 100) / 100,
    minAmountPhp,
    maxAmountPhp,
    instructions: str(input.instructions, DEFAULT_PAYMENT_TERMINAL_CONFIG.instructions, 400),
    updatedAt: typeof input.updatedAt === 'string' && input.updatedAt.trim() ? input.updatedAt : new Date().toISOString(),
  };
}

const DEFAULT_SETTINGS: StoredPricesSettings = {
  fiveH: 50,
  bulig: 100,
  point5: 150,
  halfSack: 200,
  oneSack: 400,
  defFiveH: 0,
  defBulig: 0,
  defPoint5: 0,
  defHalfSack: 0,
  defOneSack: 0,
};

export const ALLOWED_CHAT_ROOMS = ['VIP Group', 'Choy Admin'] as const;

const LOCAL_DATA_FILE = path.join(process.cwd(), '.choychat-data.json');

function initSessionSigningKey(): string {
  const envSecret = (process.env.SESSION_SECRET || '').trim();
  if (envSecret.length >= 16) return envSecret;
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as { sessionKey?: unknown };
      if (typeof parsed.sessionKey === 'string' && parsed.sessionKey.length >= 32) {
        return parsed.sessionKey;
      }
    }
  } catch {
    // ignore read error on initial startup
  }
  return crypto.randomBytes(32).toString('hex');
}

let SESSION_SIGNING_KEY = initSessionSigningKey();

function setSessionSigningKey(nextKey: string): void {
  if (typeof nextKey === 'string' && nextKey.length >= 32) {
    SESSION_SIGNING_KEY = nextKey;
  }
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPin(pin: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(pin, salt, 64);
    const storedBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function normalizePhone(raw: string): string {
  const stripped = raw.trim().replace(/[\s\-().]/g, '');
  if (/^\+639\d{9}$/.test(stripped)) {
    return '0' + stripped.slice(3);
  }
  if (/^639\d{9}$/.test(stripped)) {
    return '0' + stripped.slice(2);
  }
  return stripped;
}

export function signSessionToken(uid: string, role: 'admin' | 'member'): string {
  const payload: SessionPayload = {
    uid,
    role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadB64)
    .digest('base64url');
  if (!timingSafeStringEqual(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || (parsed.role !== 'admin' && parsed.role !== 'member')) return null;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sanitizeMediaUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/assets/') && trimmed.length <= 500) return trimmed;
  if (
    trimmed.length <= 500 &&
    /^\/api\/media\/r2\/(posts|messages|voice|avatars|marketplace|music|videos|kyc|receipts)\/\d{4}-\d{2}\/[a-zA-Z0-9_-]+\.(mp4|webm|mov|m4v|3gp|mkv|ogv|jpg|jpeg|png|webp|gif|mp3|ogg|m4a|wav|aac|flac)$/i.test(
      trimmed
    )
  ) {
    return trimmed;
  }
  if (
    trimmed.length <= 500 &&
    /^\/api\/media\/local\/(posts|messages|voice|avatars|marketplace|music|videos|kyc|receipts)\/[a-zA-Z0-9_-]+\.(mp4|webm|mov|m4v|3gp|mkv|ogv|jpg|jpeg|png|webp|gif|mp3|ogg|m4a|wav|aac|flac)$/i.test(
      trimmed
    )
  ) {
    return trimmed;
  }
  if (
    trimmed.length <= 4000000 &&
    /^data:image\/(png|jpeg|jpg|webp|gif|avif|heic);base64,[A-Za-z0-9+/=]+$/.test(trimmed)
  ) {
    return trimmed;
  }
  if (
    trimmed.length <= 8500000 &&
    /^data:video\/(mp4|webm|quicktime|3gpp|x-m4v|ogg|x-matroska)(;codecs=[a-zA-Z0-9.,_-]+)?;base64,[A-Za-z0-9+/=]+$/.test(trimmed)
  ) {
    return trimmed;
  }
  if (
    trimmed.length <= 5000000 &&
    /^data:audio\/(webm|ogg|mp4|mpeg|mp3|wav|aac|x-m4a)(;codecs=[a-zA-Z0-9._-]+)?;base64,[A-Za-z0-9+/=]+$/.test(trimmed)
  ) {
    return trimmed;
  }
  if (trimmed.length > 1000) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function sanitizeWebsiteUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 1000) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function clampNum(val: unknown, min: number, max: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

export function computeLedgerTotal(row: StoredLedgerRow, settings: StoredPricesSettings): number {
  return (
    row.fiveH * settings.fiveH +
    row.bulig * settings.bulig +
    row.point5 * settings.point5 +
    row.halfSack * settings.halfSack +
    row.oneSack * settings.oneSack +
    row.bal
  );
}

export class ChoyStore {
  private pool: Pool | null = null;
  private usePostgres = false;
  private _storageStatus: 'postgres_connected' | 'no_database_url' | 'auth_failed' | 'connection_failed' = 'no_database_url';
  private readyPromise: Promise<void>;
  private poolSource: 'pooler_url' | 'database_url' | 'none' = 'none';
  private poolMax = clampNum(process.env.PG_POOL_MAX || 15, 2, 50);

  // In-memory fallback when DATABASE_URL is not yet configured
  private memUsers: StoredUser[] = [];
  private memPosts: StoredPost[] = [];
  private memMessages: StoredMessage[] = [];
  private memLedger: StoredLedgerRow[] = [];
  private memKnowledge: StoredKnowledgeQA[] = [];
  private memSettings: StoredPricesSettings = { ...DEFAULT_SETTINGS };
  private memNewsfeedConfig: StoredNewsfeedConfig = { ...DEFAULT_NEWSFEED_CONFIG };
  private memChoyProgramsConfig: StoredChoyProgramsConfig = sanitizeChoyProgramsConfig(DEFAULT_CHOY_PROGRAMS_CONFIG);
  private memPaymentTerminalConfig: StoredPaymentTerminalConfig = sanitizePaymentTerminalConfig(DEFAULT_PAYMENT_TERMINAL_CONFIG);
  private memPaymentTerminalTxs: StoredPaymentTerminalTx[] = [];
  private memMusicLibrary: StoredMusicTrack[] = [];
  private memVideoLibrary: StoredLongVideo[] = [];
  private memInvestProducts: StoredInvestProduct[] = [...DEFAULT_INVEST_PRODUCTS];
  private memUserInvestments: StoredUserInvestment[] = [];
  private memPrivateKycAssets: StoredPrivateKycAsset[] = [];
  private memActivityLogs: StoredSystemActivityLog[] = [
    {
      id: 'act_boot_1',
      category: 'system',
      actor: 'System',
      message: 'Private KYC storage rules and encrypted real-name vault initialized.',
      createdAt: new Date().toISOString(),
    },
  ];
  private memErrorLogs: StoredSystemErrorLog[] = [];
  private memBlogPosts: StoredBlogPost[] = [...DEFAULT_BLOG_POSTS];
  private memVisitorStats: StoredVisitorStats = {
    totalVisits: 1,
    dailyCounts: { [new Date().toISOString().slice(0, 10)]: 1 },
    lastVisitAt: new Date().toISOString(),
  };
  private memContactMessages: StoredContactMessage[] = [];
  private memAbandonedCarts: StoredAbandonedCart[] = [];
  private memPushSubs: StoredPushSubscription[] = [];
  private memVapidKeys: VapidKeyPair | null = null;
  private memLocations: Array<{
    userId: string;
    userName: string;
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    source?: 'gps' | 'ip';
    ipLocationLabel?: string;
    updatedAt: string;
  }> = [];
  private locationTrails = new Map<string, Array<{ lat: number; lng: number; ts: string }>>();
  private memEmojiLinks: StoredEmojiLink[] = [
    {
      id: 'el_default',
      emojiCode: '🔐🟢💬✨🚀',
      targetUrl: 'https://chat-9-si9x.onrender.com',
      title: 'Choy Chat Live App',
      iconUrl: DEFAULT_AVATAR,
      pinnedToAppIcon: true,
      createdBy: 'System',
      createdAt: new Date().toISOString(),
    },
  ];
  private memStudioNotes: StoredStudioNoteFile[] = [];
  private memEnvVault: StoredEnvVaultEntry[] = [];
  private memAnnouncements: StoredAnnouncement[] = [];
  private memChatGroups: StoredChatGroup[] = [];
  private memUserDashboards: StoredUserDashboard[] = [];
  private memMarketplaceItems: StoredMarketplaceItem[] = [
    {
      id: 'item_food_1',
      category: 'food',
      title: 'Choy Special Grilled Chicken',
      description: 'Juicy charcoal-grilled chicken with special Java rice & vinegar dip.',
      price: 250,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
      stock: 50,
      sellerName: 'Choy Kitchen',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_food_2',
      category: 'food',
      title: 'Crispy Pata Delight',
      description: 'Deep-fried pork trotters served with soy-vinegar chili sauce.',
      price: 480,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
      stock: 30,
      sellerName: 'Choy Kitchen',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_groc_1',
      category: 'groceries',
      title: 'Jasmine Premium Rice 5kg',
      description: 'Aromatic, soft-textured premium white rice for daily family meals.',
      price: 295,
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
      stock: 120,
      sellerName: 'Choy Grocer',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_groc_2',
      category: 'groceries',
      title: 'Fresh Farm Eggs 12pcs',
      description: 'Grade-A fresh chicken eggs sourced directly from local organic farms.',
      price: 130,
      imageUrl: 'https://images.unsplash.com/photo-1516448699432-843c0800d17d?w=600&auto=format&fit=crop&q=80',
      stock: 80,
      sellerName: 'Choy Grocer',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_med_1',
      category: 'medicines',
      title: 'Paracetamol 500mg (10 Tablets)',
      description: 'Fast relief for fever, headaches, body aches, and flu symptoms.',
      price: 45,
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
      stock: 200,
      sellerName: 'Choy Pharmacy',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_med_2',
      category: 'medicines',
      title: 'Vitamin C with Rosehips 500mg',
      description: 'Immune system booster and antioxidant daily supplement.',
      price: 220,
      imageUrl: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80',
      stock: 150,
      sellerName: 'Choy Pharmacy',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_app_1',
      category: 'appliances',
      title: 'Smart 16-inch Electric Fan',
      description: 'Energy-saving 3-speed oscillating stand fan with silent copper motor.',
      price: 1299,
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80',
      stock: 25,
      sellerName: 'Choy Appliances',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'item_app_2',
      category: 'appliances',
      title: 'Mini Automatic Rice Cooker 1.2L',
      description: 'Compact non-stick rice cooker with keep-warm mode, ideal for small households.',
      price: 899,
      imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
      stock: 40,
      sellerName: 'Choy Appliances',
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  private memMarketplaceOrders: StoredMarketplaceOrder[] = [];
  private zeroStarterBalancesV1 = false;
  private memSeeded = false;
  private persistInFlight: Promise<void> | null = null;
  private persistQueued = false;

  constructor() {
    this.readyPromise = this.init();
  }

  public get storageMode(): 'postgres' | 'memory' {
    return this.usePostgres ? 'postgres' : 'memory';
  }

  public get storageStatus(): 'postgres_connected' | 'no_database_url' | 'auth_failed' | 'connection_failed' {
    return this._storageStatus;
  }

  public getPoolStats(): {
    enabled: boolean;
    source: 'pooler_url' | 'database_url' | 'none';
    max: number;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      enabled: this.usePostgres && Boolean(this.pool),
      source: this.poolSource,
      max: this.poolMax,
      totalCount: this.pool?.totalCount ?? 0,
      idleCount: this.pool?.idleCount ?? 0,
      waitingCount: this.pool?.waitingCount ?? 0,
    };
  }

  public async ready(): Promise<void> {
    await this.readyPromise;
  }

  private loadMemoryFromDisk(): boolean {
    try {
      if (!fs.existsSync(LOCAL_DATA_FILE)) return false;
      const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
      if (!raw.trim()) return false;
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(data.users)) this.memUsers = data.users as StoredUser[];
      if (Array.isArray(data.posts)) this.memPosts = data.posts as StoredPost[];
      if (Array.isArray(data.messages)) this.memMessages = data.messages as StoredMessage[];
      if (Array.isArray(data.ledger)) this.memLedger = data.ledger as StoredLedgerRow[];
      if (Array.isArray(data.knowledge)) this.memKnowledge = data.knowledge as StoredKnowledgeQA[];
      if (data.settings && typeof data.settings === 'object') {
        this.memSettings = { ...DEFAULT_SETTINGS, ...(data.settings as Partial<StoredPricesSettings>) };
      }
      if (data.newsfeedConfig && typeof data.newsfeedConfig === 'object') {
        this.memNewsfeedConfig = {
          ...DEFAULT_NEWSFEED_CONFIG,
          ...(data.newsfeedConfig as Partial<StoredNewsfeedConfig>),
        };
      }
      if (data.choyProgramsConfig && typeof data.choyProgramsConfig === 'object') {
        this.memChoyProgramsConfig = sanitizeChoyProgramsConfig(data.choyProgramsConfig);
      }
      if (data.paymentTerminalConfig && typeof data.paymentTerminalConfig === 'object') {
        this.memPaymentTerminalConfig = sanitizePaymentTerminalConfig(data.paymentTerminalConfig);
      }
      if (Array.isArray(data.paymentTerminalTxs)) {
        this.memPaymentTerminalTxs = data.paymentTerminalTxs as StoredPaymentTerminalTx[];
      }
      if (Array.isArray(data.pushSubs)) this.memPushSubs = data.pushSubs as StoredPushSubscription[];
      if (data.vapidKeys && typeof data.vapidKeys === 'object') {
        this.memVapidKeys = data.vapidKeys as VapidKeyPair;
      }
      if (Array.isArray(data.locations)) {
        this.memLocations = data.locations as typeof this.memLocations;
      }
      if (data.locationTrails && typeof data.locationTrails === 'object') {
        this.locationTrails = new Map(
          Object.entries(data.locationTrails as Record<string, Array<{ lat: number; lng: number; ts: string }>>)
        );
      }
      if (Array.isArray(data.emojiLinks) && data.emojiLinks.length > 0) {
        this.memEmojiLinks = data.emojiLinks as StoredEmojiLink[];
      }
      if (Array.isArray(data.studioNotes)) this.memStudioNotes = data.studioNotes as StoredStudioNoteFile[];
      if (Array.isArray(data.envVault)) this.memEnvVault = data.envVault as StoredEnvVaultEntry[];
      if (Array.isArray(data.announcements)) this.memAnnouncements = data.announcements as StoredAnnouncement[];
      if (Array.isArray(data.chatGroups)) this.memChatGroups = data.chatGroups as StoredChatGroup[];
      if (Array.isArray(data.userDashboards)) this.memUserDashboards = data.userDashboards as StoredUserDashboard[];
      if (Array.isArray(data.marketplaceItems)) this.memMarketplaceItems = data.marketplaceItems as StoredMarketplaceItem[];
      if (Array.isArray(data.marketplaceOrders)) this.memMarketplaceOrders = data.marketplaceOrders as StoredMarketplaceOrder[];
      if (Array.isArray(data.musicLibrary)) this.memMusicLibrary = data.musicLibrary as StoredMusicTrack[];
      if (Array.isArray(data.videoLibrary)) this.memVideoLibrary = data.videoLibrary as StoredLongVideo[];
      if (Array.isArray(data.investProducts) && data.investProducts.length > 0) {
        this.memInvestProducts = data.investProducts as StoredInvestProduct[];
      }
      if (Array.isArray(data.userInvestments)) {
        this.memUserInvestments = data.userInvestments as StoredUserInvestment[];
      }
      if (Array.isArray(data.privateKycAssets)) {
        this.memPrivateKycAssets = data.privateKycAssets as StoredPrivateKycAsset[];
      }
      if (Array.isArray(data.activityLogs) && data.activityLogs.length > 0) {
        this.memActivityLogs = data.activityLogs as StoredSystemActivityLog[];
      }
      if (Array.isArray(data.errorLogs)) {
        this.memErrorLogs = data.errorLogs as StoredSystemErrorLog[];
      }
      if (Array.isArray(data.blogPosts) && data.blogPosts.length > 0) {
        this.memBlogPosts = data.blogPosts as StoredBlogPost[];
      }
      if (data.visitorStats && typeof data.visitorStats === 'object') {
        this.memVisitorStats = data.visitorStats as StoredVisitorStats;
      }
      if (Array.isArray(data.contactMessages)) {
        this.memContactMessages = data.contactMessages as StoredContactMessage[];
      }
      if (Array.isArray(data.abandonedCarts)) {
        this.memAbandonedCarts = data.abandonedCarts as StoredAbandonedCart[];
      }
      if (data.zeroStarterBalancesV1 === true) this.zeroStarterBalancesV1 = true;
      this.memSeeded = true;
      console.log(
        `[ChoyStore] Loaded persistent local store (${this.memUsers.length} users, ${this.memPosts.length} posts, ${this.memMessages.length} messages).`
      );
      return true;
    } catch (err) {
      console.error('[ChoyStore] Failed to load local JSON store:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  private async persistMemory(): Promise<void> {
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
        const trailsObj: Record<string, Array<{ lat: number; lng: number; ts: string }>> = {};
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
          choyProgramsConfig: this.memChoyProgramsConfig,
          paymentTerminalConfig: this.memPaymentTerminalConfig,
          paymentTerminalTxs: this.memPaymentTerminalTxs,
          pushSubs: this.memPushSubs,
          vapidKeys: this.memVapidKeys,
          locations: this.memLocations,
          locationTrails: trailsObj,
          emojiLinks: this.memEmojiLinks,
          studioNotes: this.memStudioNotes,
          envVault: this.memEnvVault,
          announcements: this.memAnnouncements,
          chatGroups: this.memChatGroups,
          userDashboards: this.memUserDashboards,
          marketplaceItems: this.memMarketplaceItems,
          marketplaceOrders: this.memMarketplaceOrders,
          musicLibrary: this.memMusicLibrary,
          videoLibrary: this.memVideoLibrary,
          investProducts: this.memInvestProducts,
          userInvestments: this.memUserInvestments,
          privateKycAssets: this.memPrivateKycAssets,
          activityLogs: this.memActivityLogs,
          errorLogs: this.memErrorLogs,
          blogPosts: this.memBlogPosts,
          visitorStats: this.memVisitorStats,
          contactMessages: this.memContactMessages,
          abandonedCarts: this.memAbandonedCarts,
          zeroStarterBalancesV1: this.zeroStarterBalancesV1,
        };
        const tmpPath = `${LOCAL_DATA_FILE}.tmp.${process.pid}`;
        await fs.promises.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
        await fs.promises.rename(tmpPath, LOCAL_DATA_FILE);
      } catch (err) {
        console.error('[ChoyStore] Failed to persist local JSON store:', err instanceof Error ? err.message : err);
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

  private stripEnvQuotes(raw: string | undefined): string {
    const cleaned = (raw || '')
      .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
      .trim();
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      return cleaned.slice(1, -1).trim();
    }
    return cleaned;
  }

  private async ensurePostgresSessionKey(pool: Pool): Promise<void> {
    if ((process.env.SESSION_SECRET || '').trim().length >= 16) return;
    try {
      const existing = await pool.query('SELECT data FROM app_settings WHERE id = $1 LIMIT 1', ['session_secret']);
      const storedKey = existing.rows?.[0]?.data?.key;
      if (typeof storedKey === 'string' && storedKey.length >= 32) {
        setSessionSigningKey(storedKey);
        return;
      }
      await pool.query(
        'INSERT INTO app_settings (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
        ['session_secret', JSON.stringify({ key: SESSION_SIGNING_KEY })]
      );
      const reread = await pool.query('SELECT data FROM app_settings WHERE id = $1 LIMIT 1', ['session_secret']);
      const finalKey = reread.rows?.[0]?.data?.key;
      if (typeof finalKey === 'string' && finalKey.length >= 32) {
        setSessionSigningKey(finalKey);
      }
    } catch (err) {
      console.error(
        '[ChoyStore] Failed to sync persistent session key with PostgreSQL:',
        err instanceof Error ? err.message : err
      );
    }
  }

  private async tryConnectPool(url: string, ssl: false | { rejectUnauthorized: false }): Promise<Pool> {
    const pool = new Pool({
      connectionString: url,
      ssl,
      max: this.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 12000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error(
        '[ChoyStore] Idle PostgreSQL pool client error:',
        err instanceof Error ? err.message : err
      );
    });
    try {
      await pool.query('SELECT 1');
      return pool;
    } catch (err) {
      await pool.end().catch(() => {});
      throw err;
    }
  }

  private async init(): Promise<void> {
    const poolerUrl = this.stripEnvQuotes(process.env.DATABASE_POOL_URL);
    const directUrl = this.stripEnvQuotes(process.env.DATABASE_URL);
    const isValidDbUrl = (url: string): boolean => {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        if (!parsed.hostname || parsed.hostname.toLowerCase() === 'base' || parsed.hostname.includes('placeholder')) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };
    const candidates: Array<{ url: string; source: 'pooler_url' | 'database_url' }> = [];
    if (poolerUrl && isValidDbUrl(poolerUrl)) candidates.push({ url: poolerUrl, source: 'pooler_url' });
    if (directUrl && directUrl !== poolerUrl && isValidDbUrl(directUrl)) candidates.push({ url: directUrl, source: 'database_url' });

    if (candidates.length > 0) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        for (const candidate of candidates) {
          let hostname = '';
          let sslModeParam = '';
          try {
            const parsed = new URL(candidate.url);
            hostname = parsed.hostname.toLowerCase();
            sslModeParam = (parsed.searchParams.get('sslmode') || '').toLowerCase();
          } catch {
            // already validated
          }
          // Render Internal Postgres hostnames (e.g. dpg-xxxx-a) have no dot and default to non-SSL;
          // External Postgres / Supabase hostnames contain dots and require SSL.
          const isLocalOrInternal =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            !hostname.includes('.') ||
            sslModeParam === 'disable';

          const sslModes: Array<false | { rejectUnauthorized: false }> = isLocalOrInternal
            ? [false, { rejectUnauthorized: false }]
            : [{ rejectUnauthorized: false }, false];

          for (const sslOpt of sslModes) {
            try {
              const pool = await this.tryConnectPool(candidate.url, sslOpt);
              this.pool = pool;
              this.poolSource = candidate.source;
              await this.createTables();
              await this.ensurePostgresSessionKey(pool);
              await this.seedIfEmptyPostgres();
              await this.ensureZeroStarterBalancesPostgres(pool);
              this.usePostgres = true;
              this._storageStatus = 'postgres_connected';
              console.log(
                `[ChoyStore] Connected to PostgreSQL cloud database (pool max=${this.poolMax}, source=${candidate.source}, ssl=${sslOpt ? 'on' : 'off'}).`
              );
              return;
            } catch (err) {
              const msg = err instanceof Error ? err.message.toLowerCase() : '';
              const isAuthErr =
                msg.includes('password') || msg.includes('authentication') || msg.includes('28p01');
              this._storageStatus = isAuthErr ? 'auth_failed' : 'connection_failed';
              console.error(
                `[ChoyStore] PostgreSQL connection (${candidate.source}, ssl=${sslOpt ? 'on' : 'off'}, attempt=${attempt}) failed:`,
                err instanceof Error ? err.message : err
              );
              this.pool = null;
              this.poolSource = 'none';
              this.usePostgres = false;
              // Don't retry opposite SSL mode on password/auth error
              if (isAuthErr) break;
            }
          }
        }
        if (attempt === 1 && this._storageStatus === 'connection_failed') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          break;
        }
      }
      console.error('[ChoyStore] All PostgreSQL URLs failed, falling back to local disk store.');
    } else {
      this._storageStatus = 'no_database_url';
    }
    const loaded = this.loadMemoryFromDisk();
    if (!loaded) {
      this.seedMemory();
      this.zeroStarterBalancesV1 = true;
      await this.persistMemory();
    } else if (!this.zeroStarterBalancesV1) {
      this.memUserDashboards = this.memUserDashboards.map((dash) => this.stripPreseededBalances(dash));
      this.zeroStarterBalancesV1 = true;
      await this.persistMemory();
      console.log('[ChoyStore] Reset pre-seeded user wallet & coin balances to 0 in local store.');
    }
    console.log('[ChoyStore] Running with persistent local disk fallback (.choychat-data.json).');
  }

  private stripPreseededBalances(dash: StoredUserDashboard): StoredUserDashboard {
    const cleanedTxs = Array.isArray(dash.transactions)
      ? dash.transactions.filter((tx) => {
          const id = String(tx?.id || '').toLowerCase();
          const note = String(tx?.note || '').toLowerCase();
          return (
            !id.startsWith('tx_wallet_init_') &&
            !id.startsWith('tx_choy_init_') &&
            !note.includes('starter cash wallet') &&
            !note.includes('free choy') &&
            !note.includes('daily reward')
          );
        })
      : [];
    return {
      ...dash,
      walletBalance: 0,
      choyWalletBalance: 0,
      transactions: cleanedTxs,
      updatedAt: new Date().toISOString(),
    };
  }

  private async ensureZeroStarterBalancesPostgres(pool: Pool): Promise<void> {
    try {
      const check = await pool.query('SELECT id FROM app_settings WHERE id = $1 LIMIT 1', [
        'migration_zero_starter_balances_v1',
      ]);
      if (check.rowCount && check.rowCount > 0) return;

      const rows = await pool.query('SELECT user_id, data FROM app_user_dashboards');
      for (const row of rows.rows) {
        const userId = String(row.user_id);
        const normalized = this.normalizeUserDashboard(userId, row.data as Partial<StoredUserDashboard>);
        const zeroed = this.stripPreseededBalances(normalized);
        await pool.query(
          'UPDATE app_user_dashboards SET data = $2::jsonb, updated_at = NOW() WHERE user_id = $1',
          [userId, JSON.stringify(zeroed)]
        );
      }

      await pool.query(
        'INSERT INTO app_settings (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
        ['migration_zero_starter_balances_v1', JSON.stringify({ done: true, appliedAt: new Date().toISOString() })]
      );
      console.log(`[ChoyStore] Reset pre-seeded balances to 0 for ${rows.rows.length} PostgreSQL user dashboard(s).`);
    } catch (err) {
      console.error(
        '[ChoyStore] Zero starter balances migration warning:',
        err instanceof Error ? err.message : err
      );
    }
  }

  private async createTables(): Promise<void> {
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
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS encrypted_real_name TEXT;
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS private_kyc_meta JSONB NOT NULL DEFAULT '{}'::jsonb;
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
      ALTER TABLE app_posts ADD COLUMN IF NOT EXISTS likes JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE app_posts ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE app_posts ADD COLUMN IF NOT EXISTS shares INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE app_posts ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE app_posts ADD COLUMN IF NOT EXISTS viewed_by JSONB NOT NULL DEFAULT '[]'::jsonb;
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
      CREATE TABLE IF NOT EXISTS app_marketplace_items (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        price NUMERIC(12,2) NOT NULL DEFAULT 0,
        image_url TEXT,
        stock INT NOT NULL DEFAULT 100,
        seller_name TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_marketplace_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        delivery_address TEXT,
        delivery_notes TEXT,
        delivery_distance_km INT NOT NULL DEFAULT 2,
        delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 25,
        items JSONB NOT NULL,
        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE app_marketplace_orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
      ALTER TABLE app_marketplace_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
      ALTER TABLE app_marketplace_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
      ALTER TABLE app_marketplace_orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
      ALTER TABLE app_marketplace_orders ADD COLUMN IF NOT EXISTS delivery_distance_km INT NOT NULL DEFAULT 2;
      ALTER TABLE app_marketplace_orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 25;

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
      ALTER TABLE app_user_locations ADD COLUMN IF NOT EXISTS source TEXT;
      ALTER TABLE app_user_locations ADD COLUMN IF NOT EXISTS ip_location_label TEXT;
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
      CREATE TABLE IF NOT EXISTS app_chat_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by_id TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        admin_id TEXT,
        admin_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE app_chat_groups ADD COLUMN IF NOT EXISTS admin_id TEXT;
      ALTER TABLE app_chat_groups ADD COLUMN IF NOT EXISTS admin_name TEXT;
      CREATE TABLE IF NOT EXISTS app_user_dashboards (
        user_id TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_payment_terminal_transactions (
        id TEXT PRIMARY KEY,
        reference_code TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_phone TEXT,
        purpose TEXT NOT NULL DEFAULT 'wallet_topup',
        channel TEXT NOT NULL DEFAULT 'gcash',
        amount_php NUMERIC NOT NULL DEFAULT 0,
        fee_php NUMERIC NOT NULL DEFAULT 0,
        total_php NUMERIC NOT NULL DEFAULT 0,
        choy_coins_preview NUMERIC NOT NULL DEFAULT 0,
        payer_reference TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        customer_contact TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        receipt_image_url TEXT,
        checkout_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        credited_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  private async seedIfEmptyPostgres(): Promise<void> {
    if (!this.pool) return;
    const settingsRes = await this.pool.query('SELECT id FROM app_settings WHERE id = $1', ['prices']);
    if (settingsRes.rowCount && settingsRes.rowCount > 0) return;

    await this.pool.query(
      'INSERT INTO app_settings (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
      ['prices', JSON.stringify(DEFAULT_SETTINGS)]
    );

    // Ensure all existing member accounts are active (no admin approval gate required)
    await this.pool.query(
      `UPDATE app_users SET status = 'approved', updated_at = NOW() WHERE status != 'approved'`
    );

    await this.pool.query(
      `INSERT INTO app_posts (id, author_id, author_name, author_handle, author_avatar, content, media_url, media_type, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [
        'p_welcome',
        'system',
        'Choy Chat Official',
        '@choychat',
        DEFAULT_AVATAR,
        'Welcome to Choy Chat! Live cross-device database sync is active.',
        DEFAULT_AVATAR,
        'image',
        'feed',
      ]
    );

    await this.pool.query(
      `INSERT INTO app_messages (id, sender_id, sender_name, room_id, text, media_url, media_type, reactions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) ON CONFLICT (id) DO NOTHING`,
      [
        'm_welcome',
        'system',
        'Choy Admin',
        'VIP Group',
        'Welcome to VIP Group! Messages sync across all devices in real time.',
        null,
        'text',
        JSON.stringify(['❤️', '👍']),
      ]
    );

    await this.pool.query(
      `INSERT INTO app_messages (id, sender_id, sender_name, room_id, text, media_url, media_type, reactions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) ON CONFLICT (id) DO NOTHING`,
      [
        'm_welcome_vid',
        'system',
        'Choy Admin',
        'VIP Group',
        'Shared group video clip (tap Play with Sound).',
        'https://www.w3schools.com/html/mov_bbb.mp4',
        'video',
        JSON.stringify(['🔥']),
      ]
    );

    await this.pool.query(
      `INSERT INTO app_knowledge (id, question, answer)
       VALUES ($1, $2, $3), ($4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [
        'k_1',
        'What is Choy Chat?',
        'Choy Chat is a real-time cloud-synced social media, video gallery, and milestone ledger platform.',
        'k_2',
        'How does the ledger work?',
        'The Milestone Ledger tracks 5H, Bulig, Point 5, Half Sack, and One Sack quantities with live cross-device sync.',
      ]
    );

    await this.pool.query(
      `INSERT INTO app_ledger (id, name, five_h, five_h_type, bulig, point5, half_sack, one_sack, bal)
       VALUES ($1, $2, 5, 'blue', 3, 2, 4, 2, 500), ($3, $4, 4, 'red', 5, 3, 2, 3, -200)
       ON CONFLICT (id) DO NOTHING`,
      ['l_1', 'Choy Admin', 'l_2', 'Maria Vibe']
    );
  }

  private seedMemory(): void {
    if (this.memSeeded) return;
    this.memSeeded = true;
    const now = new Date().toISOString();
    this.memPosts = [
      {
        id: 'p_welcome',
        authorId: 'system',
        authorName: 'Choy Chat Official',
        authorHandle: '@choychat',
        authorAvatar: DEFAULT_AVATAR,
        content: 'Welcome to Choy Chat! Live cross-device database sync is active.',
        mediaUrl: DEFAULT_AVATAR,
        mediaType: 'image',
        category: 'feed',
        newsfeed: 'both',
        likes: [],
        comments: [],
        shares: 0,
        views: 0,
        viewedBy: [],
        createdAt: now,
      },
    ];
    this.memMessages = [
      {
        id: 'm_welcome',
        senderId: 'system',
        senderName: 'Choy Admin',
        roomId: 'VIP Group',
        text: 'Welcome to VIP Group! Messages sync across all devices in real time.',
        mediaType: 'text',
        reactions: ['❤️', '👍'],
        createdAt: now,
      },
      {
        id: 'm_welcome_vid',
        senderId: 'system',
        senderName: 'Choy Admin',
        roomId: 'VIP Group',
        text: 'Shared group video clip (tap Play with Sound).',
        mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        mediaType: 'video',
        reactions: ['🔥'],
        createdAt: now,
      },
    ];
    this.memKnowledge = [
      {
        id: 'k_1',
        question: 'What is Choy Chat?',
        answer: 'Choy Chat is a real-time cloud-synced social media, video gallery, and milestone ledger platform.',
        createdAt: now,
      },
      {
        id: 'k_2',
        question: 'How does the ledger work?',
        answer: 'The Milestone Ledger tracks 5H, Bulig, Point 5, Half Sack, and One Sack quantities with live cross-device sync.',
        createdAt: now,
      },
    ];
    this.memLedger = [
      { id: 'l_1', name: 'Choy Admin', fiveH: 5, fiveHType: 'blue', bulig: 3, point5: 2, halfSack: 4, oneSack: 2, bal: 500, updatedAt: now },
      { id: 'l_2', name: 'Maria Vibe', fiveH: 4, fiveHType: 'red', bulig: 5, point5: 3, halfSack: 2, oneSack: 3, bal: -200, updatedAt: now },
    ];
  }

  // ---- AUTH & USERS ----
  public hasEnvAdminConfigured(): boolean {
    return Boolean((process.env.ADMIN_PIN || '').trim());
  }

  public async hasAnyAdmin(): Promise<boolean> {
    await this.ready();
    if (this.hasEnvAdminConfigured()) return true;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT id FROM app_users WHERE role = $1 LIMIT 1', ['admin']);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    return this.memUsers.some((u) => u.role === 'admin');
  }

  public async getUserById(id: string): Promise<StoredUser | null> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_users WHERE id = $1 LIMIT 1', [id]);
      if (!res.rowCount) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return this.memUsers.find((u) => u.id === id) || null;
  }

  public async getUserByPhone(phone: string): Promise<StoredUser | null> {
    await this.ready();
    const norm = normalizePhone(phone);
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        'SELECT * FROM app_users WHERE phone = $1 OR phone = $2 LIMIT 1',
        [norm, phone.trim()]
      );
      if (!res.rowCount) return null;
      return this.mapUserRow(res.rows[0]);
    }
    return (
      this.memUsers.find((u) => normalizePhone(u.phone) === norm || u.phone === phone.trim()) || null
    );
  }

  public async ensureEnvAdminUser(phone: string): Promise<StoredUser> {
    await this.ready();
    const normPhone = normalizePhone(phone);
    const existing = await this.getUserByPhone(normPhone);
    if (existing) {
      if (existing.role !== 'admin' || existing.status !== 'approved') {
        if (this.usePostgres && this.pool) {
          await this.pool.query(
            'UPDATE app_users SET role = $1, status = $2, updated_at = NOW() WHERE id = $3',
            ['admin', 'approved', existing.id]
          );
        } else {
          existing.role = 'admin';
          existing.status = 'approved';
          existing.updatedAt = new Date().toISOString();
          await this.persistMemory();
        }
      }
      return (await this.getUserById(existing.id))!;
    }
    const id = 'admin_' + crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const user: StoredUser = {
      id,
      name: 'Choy Admin',
      phone: normPhone,
      pinHash: hashPin(crypto.randomBytes(16).toString('hex')),
      role: 'admin',
      status: 'approved',
      blockedUsers: [],
      newsfeed: 'feed_a',
      createdAt: now,
      updatedAt: now,
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

  public async createUser(params: {
    name: string;
    phone: string;
    pin: string;
    role: 'admin' | 'member';
    status: 'pending' | 'approved';
    newsfeed?: SelectableNewsfeedChannel;
    realNamePlaintext?: string;
    privateValidIdAssetId?: string;
    privateRealAvatarAssetId?: string;
    privacyConsentAccepted?: boolean;
  }): Promise<StoredUser> {
    await this.ready();
    const id = (params.role === 'admin' ? 'admin_' : 'u_') + crypto.randomUUID().slice(0, 10);
    const now = new Date().toISOString();
    const newsfeed = normalizeUserNewsfeed(params.newsfeed);
    const encryptedRealName = params.realNamePlaintext ? encryptSensitiveField(params.realNamePlaintext) : undefined;
    const privateKycMeta = {
      privateValidIdAssetId: params.privateValidIdAssetId || undefined,
      privateRealAvatarAssetId: params.privateRealAvatarAssetId || undefined,
      privacyConsentAccepted: Boolean(params.privacyConsentAccepted),
      privacyConsentAt: params.privacyConsentAccepted ? now : undefined,
    };
    const user: StoredUser = {
      id,
      name: params.name.slice(0, 80),
      phone: normalizePhone(params.phone).slice(0, 40),
      pinHash: hashPin(params.pin),
      role: params.role,
      status: params.status,
      blockedUsers: [],
      newsfeed,
      encryptedRealName,
      privateValidIdAssetId: privateKycMeta.privateValidIdAssetId,
      privateRealAvatarAssetId: privateKycMeta.privateRealAvatarAssetId,
      privacyConsentAccepted: privateKycMeta.privacyConsentAccepted,
      privacyConsentAt: privateKycMeta.privacyConsentAt,
      createdAt: now,
      updatedAt: now,
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_users (id, name, phone, pin_hash, role, status, blocked_users, newsfeed, encrypted_real_name, private_kyc_meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb)`,
        [
          user.id,
          user.name,
          user.phone,
          user.pinHash,
          user.role,
          user.status,
          JSON.stringify(user.blockedUsers),
          user.newsfeed,
          user.encryptedRealName || null,
          JSON.stringify(privateKycMeta),
        ]
      );
    } else {
      this.memUsers.push(user);
      await this.persistMemory();
    }
    return user;
  }

  public async updateUserNewsfeed(userId: string, newsfeed: unknown): Promise<StoredUser | null> {
    await this.ready();
    const clean = normalizeUserNewsfeed(newsfeed);
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        'UPDATE app_users SET newsfeed = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [clean, userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return null;
    found.newsfeed = clean;
    found.updatedAt = new Date().toISOString();
    await this.persistMemory();
    return found;
  }

  public async updateUserPin(userId: string, newPin: string): Promise<StoredUser | null> {
    await this.ready();
    const nextHash = hashPin(newPin);
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        'UPDATE app_users SET pin_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [nextHash, userId]
      );
      if (res.rows.length === 0) return null;
      return this.mapUserRow(res.rows[0]);
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return null;
    found.pinHash = nextHash;
    found.updatedAt = new Date().toISOString();
    await this.persistMemory();
    return found;
  }

  public async listUsers(includePhone: boolean): Promise<PublicUserDTO[]> {
    await this.ready();
    let rows: StoredUser[];
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_users ORDER BY created_at DESC');
      rows = res.rows.map((r) => this.mapUserRow(r));
    } else {
      rows = [...this.memUsers];
    }
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      phone: includePhone ? u.phone : 'Member',
      role: u.role,
      status: u.status,
      avatar: u.avatar,
      newsfeed: normalizeUserNewsfeed(u.newsfeed),
      loginDate: u.updatedAt.slice(0, 16).replace('T', ' '),
    }));
  }

  public async listAllStoredUsersForAdmin(): Promise<StoredUser[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_users ORDER BY created_at DESC');
      return res.rows.map((r) => this.mapUserRow(r));
    }
    return [...this.memUsers];
  }

  public async updateUserAvatar(userId: string, avatarUrl?: string): Promise<StoredUser | null> {
    await this.ready();
    const cleanAvatar = typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : undefined;
    const postAvatar = cleanAvatar || '/assets/aistudio/image_20261121_145253_f477cbfa.webp';

    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        'UPDATE app_users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [cleanAvatar ?? null, userId]
      );
      if (res.rows.length === 0) return null;
      await this.pool.query('UPDATE app_posts SET author_avatar = $1 WHERE author_id = $2', [postAvatar, userId]);
      return this.mapUserRow(res.rows[0]);
    }

    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return null;
    found.avatar = cleanAvatar;
    found.updatedAt = new Date().toISOString();
    for (const p of this.memPosts) {
      if (p.authorId === userId) {
        p.authorAvatar = postAvatar;
      }
    }
    await this.persistMemory();
    return found;
  }

  public async updateUserName(
    userId: string,
    newName: string
  ): Promise<
    | { ok: true; user: StoredUser; previousName: string }
    | { ok: false; code: 'not_found' | 'conflict'; error: string }
  > {
    await this.ready();
    const cleanName = newName.trim().slice(0, 60);
    const cleanLower = cleanName.toLowerCase();
    const nextHandle = `@${cleanLower.replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'member'}`;

    if (this.usePostgres && this.pool) {
      const existingRes = await this.pool.query('SELECT * FROM app_users WHERE id = $1 LIMIT 1', [userId]);
      if (existingRes.rows.length === 0) {
        return { ok: false, code: 'not_found', error: 'Account not found' };
      }
      const current = this.mapUserRow(existingRes.rows[0]);
      const previousName = current.name;

      const conflictRes = await this.pool.query(
        'SELECT id FROM app_users WHERE id <> $1 AND LOWER(TRIM(name)) = $2 LIMIT 1',
        [userId, cleanLower]
      );
      if (conflictRes.rows.length > 0) {
        return { ok: false, code: 'conflict', error: 'That name is already used by another account.' };
      }

      const updatedRes = await this.pool.query(
        'UPDATE app_users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [cleanName, userId]
      );
      const updatedUser = this.mapUserRow(updatedRes.rows[0]);

      await this.pool.query(
        'UPDATE app_posts SET author_name = $1, author_handle = $2 WHERE author_id = $3',
        [cleanName, nextHandle, userId]
      );
      await this.pool.query('UPDATE app_messages SET sender_name = $1 WHERE sender_id = $2', [
        cleanName,
        userId,
      ]);
      if (previousName.trim().toLowerCase() !== 'vip group') {
        await this.pool.query(
          'UPDATE app_messages SET room_id = $1 WHERE LOWER(TRIM(room_id)) = $2',
          [cleanName, previousName.trim().toLowerCase()]
        );
      }
      await this.pool.query(
        'UPDATE app_push_subscriptions SET user_name = $1, updated_at = NOW() WHERE user_id = $2',
        [cleanName, userId]
      );
      return { ok: true, user: updatedUser, previousName };
    }

    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) {
      return { ok: false, code: 'not_found', error: 'Account not found' };
    }
    const conflict = this.memUsers.find(
      (u) => u.id !== userId && u.name.trim().toLowerCase() === cleanLower
    );
    if (conflict) {
      return { ok: false, code: 'conflict', error: 'That name is already used by another account.' };
    }
    const previousName = found.name;
    const prevLower = previousName.trim().toLowerCase();
    found.name = cleanName;
    found.updatedAt = new Date().toISOString();

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
      if (prevLower !== 'vip group' && m.roomId.trim().toLowerCase() === prevLower) {
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

  public async updateUserStatus(userId: string, status: 'pending' | 'approved'): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      if (status === 'pending') {
        const res = await this.pool.query(
          `UPDATE app_users SET status = $1, updated_at = NOW() WHERE id = $2 AND role != 'admin'`,
          [status, userId]
        );
        return Boolean(res.rowCount && res.rowCount > 0);
      }
      const res = await this.pool.query(
        'UPDATE app_users SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, userId]
      );
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return false;
    if (status === 'pending' && found.role === 'admin') return false;
    found.status = status;
    found.updatedAt = new Date().toISOString();
    await this.persistMemory();
    return true;
  }

  public async approveAllPendingUsers(): Promise<number> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `UPDATE app_users SET status = 'approved', updated_at = NOW() WHERE status != 'approved'`
      );
      return res.rowCount || 0;
    }
    let count = 0;
    const now = new Date().toISOString();
    for (const u of this.memUsers) {
      if (u.status !== 'approved') {
        u.status = 'approved';
        u.updatedAt = now;
        count += 1;
      }
    }
    if (count > 0) await this.persistMemory();
    return count;
  }

  public async deleteUser(userId: string): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_users WHERE id = $1 AND role != $2', [userId, 'admin']);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memUsers.length;
    this.memUsers = this.memUsers.filter((u) => !(u.id === userId && u.role !== 'admin'));
    const deleted = this.memUsers.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }

  public async updateBlockedUsers(userId: string, blockedUsers: string[]): Promise<string[]> {
    await this.ready();
    const clean = blockedUsers
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim().slice(0, 80))
      .slice(0, 100);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        'UPDATE app_users SET blocked_users = $1::jsonb, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(clean), userId]
      );
    } else {
      const found = this.memUsers.find((u) => u.id === userId);
      if (found) {
        found.blockedUsers = clean;
        found.updatedAt = new Date().toISOString();
        await this.persistMemory();
      }
    }
    return clean;
  }

  // ---- POSTS ----
  private normalizePostRow(r: Record<string, unknown>): StoredPost {
    const rawLikes = Array.isArray(r.likes) ? r.likes : [];
    const rawComments = Array.isArray(r.comments) ? r.comments : [];
    const rawViewedBy = Array.isArray(r.viewed_by)
      ? r.viewed_by
      : Array.isArray(r.viewedBy)
      ? r.viewedBy
      : [];
    return {
      id: String(r.id),
      authorId: String(r.author_id ?? r.authorId ?? ''),
      authorName: String(r.author_name ?? r.authorName ?? 'Choy User'),
      authorHandle: String(r.author_handle ?? r.authorHandle ?? '@choychat'),
      authorAvatar: String(r.author_avatar ?? r.authorAvatar ?? ''),
      content: String(r.content ?? ''),
      mediaUrl: typeof (r.media_url ?? r.mediaUrl) === 'string' && String(r.media_url ?? r.mediaUrl) ? String(r.media_url ?? r.mediaUrl) : undefined,
      mediaType: ((r.media_type ?? r.mediaType) === 'image' || (r.media_type ?? r.mediaType) === 'video'
        ? (r.media_type ?? r.mediaType)
        : 'text') as 'text' | 'image' | 'video',
      category: ((r.category === 'myday' || r.category === 'video') ? r.category : 'feed') as 'feed' | 'myday' | 'video',
      newsfeed: normalizePostNewsfeed(r.newsfeed),
      likes: rawLikes.map((x) => String(x)).filter(Boolean),
      comments: rawComments
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
        .map((c) => ({
          id: String(c.id || ''),
          authorId: String(c.authorId || ''),
          authorName: String(c.authorName || 'Member'),
          authorAvatar: typeof c.authorAvatar === 'string' ? c.authorAvatar : undefined,
          text: String(c.text || ''),
          createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
        }))
        .filter((c) => c.id && c.text),
      shares: Math.max(0, Number(r.shares) || 0),
      views: Math.max(0, Number(r.views) || 0),
      viewedBy: rawViewedBy.map((x) => String(x)).filter(Boolean),
      createdAt: new Date(String(r.created_at ?? r.createdAt ?? new Date().toISOString())).toISOString(),
    };
  }

  public async listPosts(): Promise<StoredPost[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_posts ORDER BY created_at DESC LIMIT 200');
      return res.rows.map((r) => this.normalizePostRow(r as Record<string, unknown>));
    }
    return [...this.memPosts]
      .map((p) => this.normalizePostRow(p as unknown as Record<string, unknown>))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async createPost(
    post: Omit<StoredPost, 'id' | 'createdAt' | 'likes' | 'comments' | 'shares' | 'views' | 'viewedBy'>
  ): Promise<StoredPost> {
    await this.ready();
    const nf = normalizePostNewsfeed(post.newsfeed);
    const item: StoredPost = {
      ...post,
      newsfeed: nf,
      likes: [],
      comments: [],
      shares: 0,
      views: 0,
      viewedBy: [],
      id: 'p_' + crypto.randomUUID().slice(0, 12),
      createdAt: new Date().toISOString(),
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_posts (id, author_id, author_name, author_handle, author_avatar, content, media_url, media_type, category, newsfeed, likes, comments, shares, views, viewed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '[]'::jsonb, '[]'::jsonb, 0, 0, '[]'::jsonb)`,
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
          item.newsfeed,
        ]
      );
    } else {
      this.memPosts.unshift(item);
      await this.persistMemory();
    }
    return item;
  }

  public async togglePostLike(postId: string, userId: string): Promise<StoredPost | null> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_posts WHERE id = $1 LIMIT 1', [postId]);
      if (res.rows.length === 0) return null;
      const post = this.normalizePostRow(res.rows[0] as Record<string, unknown>);
      const exists = post.likes.includes(userId);
      const nextLikes = exists ? post.likes.filter((id) => id !== userId) : [...post.likes, userId];
      await this.pool.query('UPDATE app_posts SET likes = $1::jsonb WHERE id = $2', [
        JSON.stringify(nextLikes),
        postId,
      ]);
      return { ...post, likes: nextLikes };
    }
    const idx = this.memPosts.findIndex((p) => p.id === postId);
    if (idx === -1) return null;
    const post = this.normalizePostRow(this.memPosts[idx] as unknown as Record<string, unknown>);
    const exists = post.likes.includes(userId);
    const nextLikes = exists ? post.likes.filter((id) => id !== userId) : [...post.likes, userId];
    const updated: StoredPost = { ...post, likes: nextLikes };
    this.memPosts[idx] = updated;
    await this.persistMemory();
    return updated;
  }

  public async addPostComment(
    postId: string,
    author: { id: string; name: string; avatar?: string },
    text: string
  ): Promise<StoredPost | null> {
    await this.ready();
    const comment: StoredPostComment = {
      id: 'c_' + crypto.randomUUID().slice(0, 12),
      authorId: author.id,
      authorName: author.name,
      authorAvatar: author.avatar,
      text: text.trim().slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_posts WHERE id = $1 LIMIT 1', [postId]);
      if (res.rows.length === 0) return null;
      const post = this.normalizePostRow(res.rows[0] as Record<string, unknown>);
      const nextComments = [...post.comments, comment].slice(-200);
      await this.pool.query('UPDATE app_posts SET comments = $1::jsonb WHERE id = $2', [
        JSON.stringify(nextComments),
        postId,
      ]);
      return { ...post, comments: nextComments };
    }
    const idx = this.memPosts.findIndex((p) => p.id === postId);
    if (idx === -1) return null;
    const post = this.normalizePostRow(this.memPosts[idx] as unknown as Record<string, unknown>);
    const nextComments = [...post.comments, comment].slice(-200);
    const updated: StoredPost = { ...post, comments: nextComments };
    this.memPosts[idx] = updated;
    await this.persistMemory();
    return updated;
  }

  public async deletePostComment(
    postId: string,
    commentId: string,
    requesterId: string,
    isAdmin: boolean
  ): Promise<StoredPost | null> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_posts WHERE id = $1 LIMIT 1', [postId]);
      if (res.rows.length === 0) return null;
      const post = this.normalizePostRow(res.rows[0] as Record<string, unknown>);
      const target = post.comments.find((c) => c.id === commentId);
      if (!target) return null;
      if (!isAdmin && target.authorId !== requesterId && post.authorId !== requesterId) {
        return null;
      }
      const nextComments = post.comments.filter((c) => c.id !== commentId);
      await this.pool.query('UPDATE app_posts SET comments = $1::jsonb WHERE id = $2', [
        JSON.stringify(nextComments),
        postId,
      ]);
      return { ...post, comments: nextComments };
    }
    const idx = this.memPosts.findIndex((p) => p.id === postId);
    if (idx === -1) return null;
    const post = this.normalizePostRow(this.memPosts[idx] as unknown as Record<string, unknown>);
    const target = post.comments.find((c) => c.id === commentId);
    if (!target) return null;
    if (!isAdmin && target.authorId !== requesterId && post.authorId !== requesterId) {
      return null;
    }
    const nextComments = post.comments.filter((c) => c.id !== commentId);
    const updated: StoredPost = { ...post, comments: nextComments };
    this.memPosts[idx] = updated;
    await this.persistMemory();
    return updated;
  }

  public async incrementPostShare(postId: string): Promise<StoredPost | null> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        'UPDATE app_posts SET shares = COALESCE(shares, 0) + 1 WHERE id = $1 RETURNING *',
        [postId]
      );
      if (res.rows.length === 0) return null;
      return this.normalizePostRow(res.rows[0] as Record<string, unknown>);
    }
    const idx = this.memPosts.findIndex((p) => p.id === postId);
    if (idx === -1) return null;
    const post = this.normalizePostRow(this.memPosts[idx] as unknown as Record<string, unknown>);
    const updated: StoredPost = { ...post, shares: post.shares + 1 };
    this.memPosts[idx] = updated;
    await this.persistMemory();
    return updated;
  }

  public async recordPostViews(postIds: string[], viewerId: string): Promise<number> {
    await this.ready();
    const cleanIds = Array.from(new Set(postIds.map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 40);
    if (cleanIds.length === 0 || !viewerId) return 0;

    let updatedCount = 0;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT id, views, viewed_by FROM app_posts WHERE id = ANY($1::text[])', [
        cleanIds,
      ]);
      for (const r of res.rows) {
        const currentViewedBy = Array.isArray(r.viewed_by) ? (r.viewed_by as unknown[]).map(String) : [];
        const isNewViewer = !currentViewedBy.includes(viewerId);
        const nextViewedBy = isNewViewer ? [...currentViewedBy, viewerId].slice(-500) : currentViewedBy;
        const nextViews = Math.max(0, Number(r.views) || 0) + 1;
        await this.pool.query('UPDATE app_posts SET views = $1, viewed_by = $2::jsonb WHERE id = $3', [
          nextViews,
          JSON.stringify(nextViewedBy),
          String(r.id),
        ]);
        updatedCount += 1;
      }
      return updatedCount;
    }

    for (let i = 0; i < this.memPosts.length; i++) {
      if (!cleanIds.includes(this.memPosts[i].id)) continue;
      const post = this.normalizePostRow(this.memPosts[i] as unknown as Record<string, unknown>);
      const isNewViewer = !post.viewedBy.includes(viewerId);
      const nextViewedBy = isNewViewer ? [...post.viewedBy, viewerId].slice(-500) : post.viewedBy;
      this.memPosts[i] = {
        ...post,
        views: post.views + 1,
        viewedBy: nextViewedBy,
      };
      updatedCount += 1;
    }
    if (updatedCount > 0) {
      await this.persistMemory();
    }
    return updatedCount;
  }

  public async deletePost(postId: string, requesterId: string, isAdmin: boolean): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = isAdmin
        ? await this.pool.query('DELETE FROM app_posts WHERE id = $1', [postId])
        : await this.pool.query('DELETE FROM app_posts WHERE id = $1 AND author_id = $2', [postId, requesterId]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const idx = this.memPosts.findIndex((p) => p.id === postId && (isAdmin || p.authorId === requesterId));
    if (idx === -1) return false;
    this.memPosts.splice(idx, 1);
    await this.persistMemory();
    return true;
  }

  // ---- MESSAGES ----
  public async listMessages(): Promise<StoredMessage[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_messages ORDER BY created_at ASC LIMIT 500');
      return res.rows.map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        roomId: r.room_id,
        text: r.text || '',
        mediaUrl: r.media_url || undefined,
        mediaType: r.media_type,
        transcript: r.transcript || undefined,
        reactions: Array.isArray(r.reactions) ? r.reactions : [],
        createdAt: new Date(r.created_at).toISOString(),
      }));
    }
    return [...this.memMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async createMessage(msg: Omit<StoredMessage, 'id' | 'createdAt' | 'reactions'>): Promise<StoredMessage> {
    await this.ready();
    const item: StoredMessage = {
      ...msg,
      id: 'm_' + crypto.randomUUID().slice(0, 12),
      reactions: [],
      createdAt: new Date().toISOString(),
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
          JSON.stringify(item.reactions),
        ]
      );
    } else {
      this.memMessages.push(item);
      await this.persistMemory();
    }
    return item;
  }

  public async deleteMessage(messageId: string, userId: string, isAdminUser: boolean): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const existing = await this.pool.query('SELECT * FROM app_messages WHERE id = $1 LIMIT 1', [messageId]);
      if (!existing.rowCount) return false;
      const row = existing.rows[0];
      if (!isAdminUser && row.sender_id !== userId) {
        return false;
      }
      await this.pool.query('DELETE FROM app_messages WHERE id = $1', [messageId]);
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

  // ---- CHAT GROUPS ----
  private mapChatGroupRow(r: Record<string, unknown>): StoredChatGroup {
    const createdById = String(r.created_by_id || '');
    const createdByName = String(r.created_by_name || 'Member');
    const adminId = r.admin_id ? String(r.admin_id) : createdById;
    const adminName = r.admin_name ? String(r.admin_name) : createdByName;
    return {
      id: String(r.id),
      name: String(r.name),
      memberIds: Array.isArray(r.member_ids) ? r.member_ids.map(String) : [],
      createdById,
      createdByName,
      adminId,
      adminName,
      createdAt: new Date(String(r.created_at)).toISOString(),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    };
  }

  public async listChatGroups(): Promise<StoredChatGroup[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_chat_groups ORDER BY updated_at DESC, created_at DESC');
      return res.rows.map((r) => this.mapChatGroupRow(r));
    }
    return [...this.memChatGroups]
      .map((g) => ({
        ...g,
        adminId: g.adminId || g.createdById,
        adminName: g.adminName || g.createdByName,
        memberIds: [...(g.memberIds || [])],
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async listChatGroupsForUser(userId: string, isAdminUser: boolean): Promise<StoredChatGroup[]> {
    const groups = await this.listChatGroups();
    if (isAdminUser) return groups;
    return groups.filter(
      (g) => g.createdById === userId || (g.adminId || g.createdById) === userId || g.memberIds.includes(userId)
    );
  }

  public async getChatGroupById(groupId: string): Promise<StoredChatGroup | null> {
    await this.ready();
    const cleanId = groupId.trim();
    if (!cleanId) return null;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_chat_groups WHERE id = $1 LIMIT 1', [cleanId]);
      if (!res.rowCount) return null;
      return this.mapChatGroupRow(res.rows[0]);
    }
    const found = this.memChatGroups.find((g) => g.id === cleanId);
    return found
      ? {
          ...found,
          adminId: found.adminId || found.createdById,
          adminName: found.adminName || found.createdByName,
          memberIds: [...(found.memberIds || [])],
        }
      : null;
  }

  public async createChatGroup(input: {
    name: string;
    memberIds: string[];
    createdById: string;
    createdByName: string;
  }): Promise<StoredChatGroup> {
    await this.ready();
    const cleanName = input.name.trim().slice(0, 60);
    const cleanCreatorName = input.createdByName.trim().slice(0, 80) || 'Member';
    const uniqueMembers = Array.from(
      new Set([input.createdById, ...input.memberIds.map((id) => id.trim()).filter(Boolean)])
    );
    const now = new Date().toISOString();
    const group: StoredChatGroup = {
      id: 'grp_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      name: cleanName,
      memberIds: uniqueMembers,
      createdById: input.createdById,
      createdByName: cleanCreatorName,
      adminId: input.createdById,
      adminName: cleanCreatorName,
      createdAt: now,
      updatedAt: now,
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_chat_groups (id, name, member_ids, created_by_id, created_by_name, admin_id, admin_name, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)`,
        [
          group.id,
          group.name,
          JSON.stringify(group.memberIds),
          group.createdById,
          group.createdByName,
          group.adminId,
          group.adminName,
          group.createdAt,
          group.updatedAt,
        ]
      );
    } else {
      this.memChatGroups.unshift(group);
      await this.persistMemory();
    }
    return group;
  }

  public async updateChatGroupMembers(groupId: string, memberIds: string[]): Promise<StoredChatGroup | null> {
    await this.ready();
    const cleanId = groupId.trim();
    const uniqueMembers = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
    const now = new Date().toISOString();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `UPDATE app_chat_groups
         SET member_ids = $2::jsonb, updated_at = $3::timestamptz
         WHERE id = $1
         RETURNING *`,
        [cleanId, JSON.stringify(uniqueMembers), now]
      );
      if (!res.rowCount) return null;
      return this.mapChatGroupRow(res.rows[0]);
    }
    const idx = this.memChatGroups.findIndex((g) => g.id === cleanId);
    if (idx < 0) return null;
    this.memChatGroups[idx] = {
      ...this.memChatGroups[idx],
      memberIds: uniqueMembers,
      updatedAt: now,
    };
    await this.persistMemory();
    return {
      ...this.memChatGroups[idx],
      adminId: this.memChatGroups[idx].adminId || this.memChatGroups[idx].createdById,
      adminName: this.memChatGroups[idx].adminName || this.memChatGroups[idx].createdByName,
      memberIds: [...uniqueMembers],
    };
  }

  public async updateChatGroupDetails(
    groupId: string,
    patch: { name?: string; adminId?: string; adminName?: string }
  ): Promise<StoredChatGroup | null> {
    await this.ready();
    const cleanId = groupId.trim();
    if (!cleanId) return null;
    const cleanName = typeof patch.name === 'string' ? patch.name.trim().slice(0, 60) : undefined;
    const cleanAdminId = typeof patch.adminId === 'string' ? patch.adminId.trim().slice(0, 128) : undefined;
    const cleanAdminName = typeof patch.adminName === 'string' ? patch.adminName.trim().slice(0, 80) : undefined;
    const now = new Date().toISOString();

    if (this.usePostgres && this.pool) {
      const sets: string[] = [];
      const values: unknown[] = [cleanId];
      if (cleanName) {
        values.push(cleanName);
        sets.push(`name = $${values.length}`);
      }
      if (cleanAdminId) {
        values.push(cleanAdminId);
        sets.push(`admin_id = $${values.length}`);
      }
      if (cleanAdminName) {
        values.push(cleanAdminName);
        sets.push(`admin_name = $${values.length}`);
      }
      if (sets.length === 0) {
        return this.getChatGroupById(cleanId);
      }
      values.push(now);
      sets.push(`updated_at = $${values.length}::timestamptz`);
      const res = await this.pool.query(
        `UPDATE app_chat_groups SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
        values
      );
      if (!res.rowCount) return null;
      return this.mapChatGroupRow(res.rows[0]);
    }

    const idx = this.memChatGroups.findIndex((g) => g.id === cleanId);
    if (idx < 0) return null;
    const prev = this.memChatGroups[idx];
    const next: StoredChatGroup = {
      ...prev,
      name: cleanName || prev.name,
      adminId: cleanAdminId || prev.adminId || prev.createdById,
      adminName: cleanAdminName || prev.adminName || prev.createdByName,
      updatedAt: now,
    };
    this.memChatGroups[idx] = next;
    await this.persistMemory();
    return { ...next, memberIds: [...(next.memberIds || [])] };
  }

  public async deleteChatGroup(groupId: string): Promise<boolean> {
    await this.ready();
    const cleanId = groupId.trim();
    if (!cleanId) return false;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_chat_groups WHERE id = $1', [cleanId]);
      await this.pool.query('DELETE FROM app_messages WHERE room_id = $1', [cleanId]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memChatGroups.length;
    this.memChatGroups = this.memChatGroups.filter((g) => g.id !== cleanId);
    if (this.memChatGroups.length < before) {
      this.memMessages = this.memMessages.filter((m) => m.roomId !== cleanId);
      await this.persistMemory();
      return true;
    }
    return false;
  }

  // ---- LEDGER & LEADERBOARD ----
  public async listLedger(): Promise<StoredLedgerRow[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_ledger ORDER BY name ASC');
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        fiveH: Number(r.five_h) || 0,
        fiveHType: r.five_h_type === 'red' ? 'red' : 'blue',
        bulig: Number(r.bulig) || 0,
        point5: Number(r.point5) || 0,
        halfSack: Number(r.half_sack) || 0,
        oneSack: Number(r.one_sack) || 0,
        bal: Number(r.bal) || 0,
        updatedAt: new Date(r.updated_at).toISOString(),
      }));
    }
    return [...this.memLedger].sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getPublicLeaderboard(): Promise<{ id: string; name: string; total: number }[]> {
    const [rows, settings] = await Promise.all([this.listLedger(), this.getSettings()]);
    return rows
      .map((r) => ({ id: r.id, name: r.name, total: computeLedgerTotal(r, settings) }))
      .sort((a, b) => b.total - a.total);
  }

  public async createLedgerRow(
    name: string,
    initial?: Partial<Pick<StoredLedgerRow, 'fiveH' | 'fiveHType' | 'bulig' | 'point5' | 'halfSack' | 'oneSack' | 'bal'>>
  ): Promise<StoredLedgerRow> {
    await this.ready();
    const settings = await this.getSettings();
    const row: StoredLedgerRow = {
      id: 'l_' + crypto.randomUUID().slice(0, 12),
      name: name.slice(0, 100),
      fiveH: initial?.fiveH !== undefined ? clampNum(initial.fiveH, -1000000, 1000000) : settings.defFiveH,
      fiveHType: initial?.fiveHType === 'red' ? 'red' : 'blue',
      bulig: initial?.bulig !== undefined ? clampNum(initial.bulig, -1000000, 1000000) : settings.defBulig,
      point5: initial?.point5 !== undefined ? clampNum(initial.point5, -1000000, 1000000) : settings.defPoint5,
      halfSack: initial?.halfSack !== undefined ? clampNum(initial.halfSack, -1000000, 1000000) : settings.defHalfSack,
      oneSack: initial?.oneSack !== undefined ? clampNum(initial.oneSack, -1000000, 1000000) : settings.defOneSack,
      bal: initial?.bal !== undefined ? clampNum(initial.bal, -100000000, 100000000) : 0,
      updatedAt: new Date().toISOString(),
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

  public async updateLedgerRow(
    id: string,
    patch: Partial<Omit<StoredLedgerRow, 'id' | 'name' | 'updatedAt'>>
  ): Promise<StoredLedgerRow | null> {
    await this.ready();
    const rows = await this.listLedger();
    const current = rows.find((r) => r.id === id);
    if (!current) return null;
    const updated: StoredLedgerRow = {
      ...current,
      fiveH: clampNum(patch.fiveH ?? current.fiveH, -1000000, 1000000),
      fiveHType: patch.fiveHType === 'red' ? 'red' : patch.fiveHType === 'blue' ? 'blue' : current.fiveHType,
      bulig: clampNum(patch.bulig ?? current.bulig, -1000000, 1000000),
      point5: clampNum(patch.point5 ?? current.point5, -1000000, 1000000),
      halfSack: clampNum(patch.halfSack ?? current.halfSack, -1000000, 1000000),
      oneSack: clampNum(patch.oneSack ?? current.oneSack, -1000000, 1000000),
      bal: clampNum(patch.bal ?? current.bal, -100000000, 100000000),
      updatedAt: new Date().toISOString(),
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
          updated.id,
        ]
      );
    } else {
      this.memLedger = this.memLedger.map((r) => (r.id === id ? updated : r));
      await this.persistMemory();
    }
    return updated;
  }

  public async applyDefaultQuantitiesToAll(defs: {
    defFiveH: number;
    defBulig: number;
    defPoint5: number;
    defHalfSack: number;
    defOneSack: number;
  }): Promise<void> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `UPDATE app_ledger
         SET five_h = $1, bulig = $2, point5 = $3, half_sack = $4, one_sack = $5, updated_at = NOW()`,
        [defs.defFiveH, defs.defBulig, defs.defPoint5, defs.defHalfSack, defs.defOneSack]
      );
    } else {
      const now = new Date().toISOString();
      this.memLedger = this.memLedger.map((r) => ({
        ...r,
        fiveH: defs.defFiveH,
        bulig: defs.defBulig,
        point5: defs.defPoint5,
        halfSack: defs.defHalfSack,
        oneSack: defs.defOneSack,
        updatedAt: now,
      }));
      await this.persistMemory();
    }
  }

  public async deleteLedgerRow(id: string): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_ledger WHERE id = $1', [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memLedger.length;
    this.memLedger = this.memLedger.filter((r) => r.id !== id);
    const deleted = this.memLedger.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }

  // ---- KNOWLEDGE ----
  public async listKnowledge(): Promise<StoredKnowledgeQA[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_knowledge ORDER BY created_at DESC');
      return res.rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    }
    return [...this.memKnowledge];
  }

  public async createKnowledge(question: string, answer: string): Promise<StoredKnowledgeQA> {
    await this.ready();
    const item: StoredKnowledgeQA = {
      id: 'k_' + crypto.randomUUID().slice(0, 12),
      question: question.slice(0, 300),
      answer: answer.slice(0, 2000),
      createdAt: new Date().toISOString(),
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query('INSERT INTO app_knowledge (id, question, answer) VALUES ($1, $2, $3)', [
        item.id,
        item.question,
        item.answer,
      ]);
    } else {
      this.memKnowledge.unshift(item);
      await this.persistMemory();
    }
    return item;
  }

  public async deleteKnowledge(id: string): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_knowledge WHERE id = $1', [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memKnowledge.length;
    this.memKnowledge = this.memKnowledge.filter((k) => k.id !== id);
    const deleted = this.memKnowledge.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }

  // ---- SETTINGS ----
  public async getSettings(): Promise<StoredPricesSettings> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1 LIMIT 1', ['prices']);
      if (res.rowCount && res.rows[0]?.data) {
        return { ...DEFAULT_SETTINGS, ...res.rows[0].data };
      }
      return { ...DEFAULT_SETTINGS };
    }
    return { ...this.memSettings };
  }

  public async saveSettings(next: StoredPricesSettings): Promise<StoredPricesSettings> {
    await this.ready();
    const clean: StoredPricesSettings = {
      fiveH: clampNum(next.fiveH, 0, 1000000),
      bulig: clampNum(next.bulig, 0, 1000000),
      point5: clampNum(next.point5, 0, 1000000),
      halfSack: clampNum(next.halfSack, 0, 1000000),
      oneSack: clampNum(next.oneSack, 0, 1000000),
      defFiveH: clampNum(next.defFiveH, 0, 1000000),
      defBulig: clampNum(next.defBulig, 0, 1000000),
      defPoint5: clampNum(next.defPoint5, 0, 1000000),
      defHalfSack: clampNum(next.defHalfSack, 0, 1000000),
      defOneSack: clampNum(next.defOneSack, 0, 1000000),
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['prices', JSON.stringify(clean)]
      );
    } else {
      this.memSettings = clean;
      await this.persistMemory();
    }
    return clean;
  }

  public async getNewsfeedConfig(): Promise<StoredNewsfeedConfig> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1 LIMIT 1', ['newsfeed_config']);
      if (res.rowCount && res.rows[0]?.data) {
        const d = res.rows[0].data as Partial<StoredNewsfeedConfig>;
        return {
          feedATitle:
            typeof d.feedATitle === 'string' && d.feedATitle.trim()
              ? d.feedATitle.trim().slice(0, 60)
              : DEFAULT_NEWSFEED_CONFIG.feedATitle,
          feedBTitle:
            typeof d.feedBTitle === 'string' && d.feedBTitle.trim()
              ? d.feedBTitle.trim().slice(0, 60)
              : DEFAULT_NEWSFEED_CONFIG.feedBTitle,
          feedCTitle:
            typeof d.feedCTitle === 'string' && d.feedCTitle.trim()
              ? d.feedCTitle.trim().slice(0, 60)
              : DEFAULT_NEWSFEED_CONFIG.feedCTitle,
        };
      }
      return { ...DEFAULT_NEWSFEED_CONFIG };
    }
    return { ...this.memNewsfeedConfig };
  }

  public async saveNewsfeedConfig(next: Partial<StoredNewsfeedConfig>): Promise<StoredNewsfeedConfig> {
    await this.ready();
    const feedATitle =
      typeof next.feedATitle === 'string' && next.feedATitle.trim()
        ? next.feedATitle.trim().slice(0, 60)
        : DEFAULT_NEWSFEED_CONFIG.feedATitle;
    const feedBTitle =
      typeof next.feedBTitle === 'string' && next.feedBTitle.trim()
        ? next.feedBTitle.trim().slice(0, 60)
        : DEFAULT_NEWSFEED_CONFIG.feedBTitle;
    const feedCTitle =
      typeof next.feedCTitle === 'string' && next.feedCTitle.trim()
        ? next.feedCTitle.trim().slice(0, 60)
        : DEFAULT_NEWSFEED_CONFIG.feedCTitle;
    const clean: StoredNewsfeedConfig = { feedATitle, feedBTitle, feedCTitle };

    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['newsfeed_config', JSON.stringify(clean)]
      );
    } else {
      this.memNewsfeedConfig = clean;
      await this.persistMemory();
    }
    return clean;
  }

  public async getChoyProgramsConfig(): Promise<StoredChoyProgramsConfig> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1 LIMIT 1', ['choy_programs_config']);
      if (res.rowCount && res.rows[0]?.data) {
        return sanitizeChoyProgramsConfig(res.rows[0].data);
      }
      return sanitizeChoyProgramsConfig(DEFAULT_CHOY_PROGRAMS_CONFIG);
    }
    return sanitizeChoyProgramsConfig(this.memChoyProgramsConfig);
  }

  public async saveChoyProgramsConfig(next: Partial<StoredChoyProgramsConfig>): Promise<StoredChoyProgramsConfig> {
    await this.ready();
    const current = await this.getChoyProgramsConfig();
    const merged: StoredChoyProgramsConfig = sanitizeChoyProgramsConfig({
      ...current,
      ...next,
      choyPro: { ...current.choyPro, ...(next.choyPro || {}) },
      choyWallet: { ...current.choyWallet, ...(next.choyWallet || {}) },
      promos: Array.isArray(next.promos) ? next.promos : current.promos,
      updatedAt: new Date().toISOString(),
    });
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['choy_programs_config', JSON.stringify(merged)]
      );
    } else {
      this.memChoyProgramsConfig = merged;
      await this.persistMemory();
    }
    return merged;
  }

  // ---- WEB PUSH VAPID KEYS & SUBSCRIPTIONS ----
  public async getOrCreateVapidKeys(generator: () => VapidKeyPair): Promise<VapidKeyPair> {
    await this.ready();
    const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
    const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
    if (envPub && envPriv) {
      return { publicKey: envPub, privateKey: envPriv };
    }

    if (this.usePostgres && this.pool) {
      const existing = await this.pool.query('SELECT data FROM app_settings WHERE id = $1 LIMIT 1', ['vapid_keys']);
      if (existing.rowCount && existing.rows[0]?.data?.publicKey && existing.rows[0]?.data?.privateKey) {
        return {
          publicKey: String(existing.rows[0].data.publicKey),
          privateKey: String(existing.rows[0].data.privateKey),
        };
      }
      const generated = generator();
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        ['vapid_keys', JSON.stringify(generated)]
      );
      const reread = await this.pool.query('SELECT data FROM app_settings WHERE id = $1 LIMIT 1', ['vapid_keys']);
      if (reread.rowCount && reread.rows[0]?.data?.publicKey && reread.rows[0]?.data?.privateKey) {
        return {
          publicKey: String(reread.rows[0].data.publicKey),
          privateKey: String(reread.rows[0].data.privateKey),
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

  public async savePushSubscription(sub: {
    endpoint: string;
    userId: string;
    userName: string;
    keys: { p256dh: string; auth: string };
  }): Promise<StoredPushSubscription> {
    await this.ready();
    const now = new Date().toISOString();
    const clean: StoredPushSubscription = {
      endpoint: sub.endpoint.trim(),
      userId: sub.userId,
      userName: sub.userName.trim(),
      keys: {
        p256dh: sub.keys.p256dh.trim(),
        auth: sub.keys.auth.trim(),
      },
      updatedAt: now,
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

  public async removePushSubscription(endpoint: string): Promise<void> {
    await this.ready();
    const cleanEndpoint = endpoint.trim();
    if (!cleanEndpoint) return;
    if (this.usePostgres && this.pool) {
      await this.pool.query('DELETE FROM app_push_subscriptions WHERE endpoint = $1', [cleanEndpoint]);
      return;
    }
    this.memPushSubs = this.memPushSubs.filter((s) => s.endpoint !== cleanEndpoint);
    await this.persistMemory();
  }

  public async listPushSubscriptionsForTarget(
    targetName: string,
    excludeUserId: string
  ): Promise<StoredPushSubscription[]> {
    await this.ready();
    const normalized = targetName.trim().toLowerCase();
    const isGroup = normalized === 'vip group' || normalized === '';

    if (this.usePostgres && this.pool) {
      const res = isGroup
        ? await this.pool.query(
            `SELECT endpoint, user_id, user_name, p256dh, auth, updated_at
             FROM app_push_subscriptions
             WHERE user_id <> $1`,
            [excludeUserId]
          )
        : await this.pool.query(
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
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
    }

    return this.memPushSubs.filter((s) => {
      if (s.userId === excludeUserId) return false;
      if (isGroup) return true;
      return s.userName.trim().toLowerCase() === normalized;
    });
  }

  public async listPushSubscriptionsForUserIds(
    userIds: string[],
    excludeUserId: string
  ): Promise<StoredPushSubscription[]> {
    await this.ready();
    const cleanIds = Array.from(new Set(userIds.map((id) => id.trim()).filter((id) => id && id !== excludeUserId)));
    if (cleanIds.length === 0) return [];

    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT endpoint, user_id, user_name, p256dh, auth, updated_at
         FROM app_push_subscriptions
         WHERE user_id <> $1 AND user_id = ANY($2::text[])`,
        [excludeUserId, cleanIds]
      );
      return res.rows.map((r) => ({
        endpoint: String(r.endpoint),
        userId: String(r.user_id),
        userName: String(r.user_name),
        keys: { p256dh: String(r.p256dh), auth: String(r.auth) },
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
    }

    const idSet = new Set(cleanIds);
    return this.memPushSubs.filter((s) => s.userId !== excludeUserId && idSet.has(s.userId));
  }

  private appendLocationTrail(userId: string, lat: number, lng: number, ts: string): void {
    const existing = this.locationTrails.get(userId) || [];
    const last = existing[existing.length - 1];
    if (last) {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const dLat = toRad(lat - last.lat);
      const dLng = toRad(lng - last.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(last.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
      const distMeters = 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (distMeters < 4) return;
    }
    const next = [...existing, { lat, lng, ts }].slice(-30);
    this.locationTrails.set(userId, next);
  }

  public async upsertLocation(
    userId: string,
    userName: string,
    lat: number,
    lng: number,
    accuracy?: number,
    speed?: number,
    heading?: number,
    source: 'gps' | 'ip' = 'gps',
    ipLocationLabel?: string
  ): Promise<boolean> {
    await this.ready();
    const now = new Date().toISOString();
    const cleanLabel = ipLocationLabel ? String(ipLocationLabel).trim().slice(0, 120) : undefined;

    if (this.usePostgres && this.pool) {
      if (source === 'ip') {
        const existingRes = await this.pool.query(
          `SELECT source, updated_at FROM app_user_locations WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        if (existingRes.rows.length > 0) {
          const prevSource = existingRes.rows[0].source === 'ip' ? 'ip' : 'gps';
          const prevUpdatedMs = new Date(String(existingRes.rows[0].updated_at)).getTime();
          // Never overwrite a fresh real GPS reading (within 10 mins) with rough IP coordinates
          if (prevSource === 'gps' && Number.isFinite(prevUpdatedMs) && Date.now() - prevUpdatedMs < 600_000) {
            return false;
          }
        }
      }

      if (source === 'gps' || !this.locationTrails.has(userId)) {
        this.appendLocationTrail(userId, lat, lng, now);
      }

      await this.pool.query(
        `INSERT INTO app_user_locations (user_id, user_name, lat, lng, accuracy, speed, heading, source, ip_location_label, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET user_name = EXCLUDED.user_name,
               lat = EXCLUDED.lat,
               lng = EXCLUDED.lng,
               accuracy = EXCLUDED.accuracy,
               speed = EXCLUDED.speed,
               heading = EXCLUDED.heading,
               source = EXCLUDED.source,
               ip_location_label = EXCLUDED.ip_location_label,
               updated_at = NOW()`,
        [userId, userName, lat, lng, accuracy ?? null, speed ?? null, heading ?? null, source, cleanLabel ?? null]
      );
      return true;
    }

    if (source === 'ip') {
      const existing = this.memLocations.find((l) => l.userId === userId);
      if (existing && (existing.source ?? 'gps') === 'gps') {
        const prevUpdatedMs = new Date(existing.updatedAt).getTime();
        if (Number.isFinite(prevUpdatedMs) && Date.now() - prevUpdatedMs < 600_000) {
          return false;
        }
      }
    }

    if (source === 'gps' || !this.locationTrails.has(userId)) {
      this.appendLocationTrail(userId, lat, lng, now);
    }

    this.memLocations = this.memLocations.filter((l) => l.userId !== userId);
    this.memLocations.push({
      userId,
      userName,
      lat,
      lng,
      accuracy,
      speed,
      heading,
      source,
      ipLocationLabel: cleanLabel,
      updatedAt: now,
    });
    await this.persistMemory();
    return true;
  }

  public async getAllLocations(): Promise<
    Array<{
      userId: string;
      userName: string;
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number;
      heading?: number;
      source: 'gps' | 'ip';
      ipLocationLabel?: string;
      trail: Array<{ lat: number; lng: number; ts: string }>;
      updatedAt: string;
    }>
  > {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT user_id, user_name, lat, lng, accuracy, speed, heading, source, ip_location_label, updated_at FROM app_user_locations ORDER BY updated_at DESC`
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
          accuracy: r.accuracy != null ? Number(r.accuracy) : undefined,
          speed: r.speed != null ? Number(r.speed) : undefined,
          heading: r.heading != null ? Number(r.heading) : undefined,
          source: r.source === 'ip' ? 'ip' : 'gps',
          ipLocationLabel: r.ip_location_label ? String(r.ip_location_label) : undefined,
          trail: trail && trail.length > 0 ? trail : [{ lat, lng, ts: updatedAt }],
          updatedAt,
        };
      });
    }
    return this.memLocations
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((l) => ({
        ...l,
        source: l.source === 'ip' ? 'ip' : 'gps',
        trail: this.locationTrails.get(l.userId) || [{ lat: l.lat, lng: l.lng, ts: l.updatedAt }],
      }));
  }

  public async listEmojiLinks(): Promise<StoredEmojiLink[]> {
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
        createdBy: String(r.created_by || 'Admin'),
        createdAt: new Date(String(r.created_at)).toISOString(),
      }));
    }
    return [...this.memEmojiLinks].sort((a, b) => {
      if (a.pinnedToAppIcon !== b.pinnedToAppIcon) return a.pinnedToAppIcon ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  public async createEmojiLink(input: {
    emojiCode: string;
    targetUrl: string;
    title: string;
    iconUrl: string;
    pinnedToAppIcon: boolean;
    createdBy: string;
  }): Promise<StoredEmojiLink> {
    await this.ready();
    const id = 'el_' + crypto.randomUUID().slice(0, 12);
    const createdAt = new Date().toISOString();
    if (this.usePostgres && this.pool) {
      if (input.pinnedToAppIcon) {
        await this.pool.query('UPDATE app_emoji_links SET pinned_to_app_icon = false');
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
          input.createdBy,
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
        createdAt,
      };
    }

    if (input.pinnedToAppIcon) {
      this.memEmojiLinks = this.memEmojiLinks.map((item) => ({ ...item, pinnedToAppIcon: false }));
    }
    const record: StoredEmojiLink = {
      id,
      emojiCode: input.emojiCode,
      targetUrl: input.targetUrl,
      title: input.title,
      iconUrl: input.iconUrl,
      pinnedToAppIcon: input.pinnedToAppIcon,
      createdBy: input.createdBy,
      createdAt,
    };
    this.memEmojiLinks.unshift(record);
    await this.persistMemory();
    return record;
  }

  public async pinEmojiLink(id: string): Promise<StoredEmojiLink | null> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const check = await this.pool.query('SELECT id FROM app_emoji_links WHERE id = $1 LIMIT 1', [id]);
      if (!check.rowCount) return null;
      await this.pool.query('UPDATE app_emoji_links SET pinned_to_app_icon = false');
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
        createdBy: String(r.created_by || 'Admin'),
        createdAt: new Date(String(r.created_at)).toISOString(),
      };
    }

    const found = this.memEmojiLinks.find((item) => item.id === id);
    if (!found) return null;
    this.memEmojiLinks = this.memEmojiLinks.map((item) => ({
      ...item,
      pinnedToAppIcon: item.id === id,
    }));
    await this.persistMemory();
    return this.memEmojiLinks.find((item) => item.id === id) || null;
  }

  public async deleteEmojiLink(id: string): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_emoji_links WHERE id = $1', [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memEmojiLinks.length;
    this.memEmojiLinks = this.memEmojiLinks.filter((item) => item.id !== id);
    const deleted = this.memEmojiLinks.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }

  public async resolveEmojiLink(emojiCode?: string): Promise<StoredEmojiLink | null> {
    const links = await this.listEmojiLinks();
    const clean = (emojiCode || '').trim();
    if (clean) {
      const matched = links.find((l) => l.emojiCode.trim() === clean || l.id === clean);
      if (matched) return matched;
    }
    return links.find((l) => l.pinnedToAppIcon) || links[0] || null;
  }

  public async listStudioNotes(): Promise<StoredStudioNoteFile[]> {
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
        category: String(r.category || 'App Features'),
        entries: Array.isArray(r.entries) ? (r.entries as StudioNoteEntry[]) : [],
        organizedPrompt: String(r.organized_prompt || ''),
        createdAt: new Date(String(r.created_at)).toISOString(),
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
    }
    return [...this.memStudioNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async getStudioNoteById(id: string): Promise<StoredStudioNoteFile | null> {
    const notes = await this.listStudioNotes();
    return notes.find((n) => n.id === id) || null;
  }

  public async createStudioNoteFile(input: {
    title: string;
    category: string;
    entries: StudioNoteEntry[];
    organizedPrompt: string;
  }): Promise<StoredStudioNoteFile> {
    await this.ready();
    const id = 'sn_' + crypto.randomUUID().slice(0, 12);
    const now = new Date().toISOString();
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
        updatedAt: now,
      };
    }
    const created: StoredStudioNoteFile = {
      id,
      title: input.title,
      category: input.category,
      entries: input.entries,
      organizedPrompt: input.organizedPrompt,
      createdAt: now,
      updatedAt: now,
    };
    this.memStudioNotes.unshift(created);
    await this.persistMemory();
    return created;
  }

  public async updateStudioNoteFile(
    id: string,
    patch: {
      title?: string;
      category?: string;
      entries?: StudioNoteEntry[];
      organizedPrompt?: string;
    }
  ): Promise<StoredStudioNoteFile | null> {
    await this.ready();
    const existing = await this.getStudioNoteById(id);
    if (!existing) return null;
    const updated: StoredStudioNoteFile = {
      ...existing,
      title: patch.title !== undefined ? patch.title : existing.title,
      category: patch.category !== undefined ? patch.category : existing.category,
      entries: patch.entries !== undefined ? patch.entries : existing.entries,
      organizedPrompt: patch.organizedPrompt !== undefined ? patch.organizedPrompt : existing.organizedPrompt,
      updatedAt: new Date().toISOString(),
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
    this.memStudioNotes = this.memStudioNotes.map((n) => (n.id === id ? updated : n));
    await this.persistMemory();
    return updated;
  }

  public async deleteStudioNoteFile(id: string): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_studio_notes WHERE id = $1', [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memStudioNotes.length;
    this.memStudioNotes = this.memStudioNotes.filter((n) => n.id !== id);
    const deleted = this.memStudioNotes.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }

  public async listEnvVault(): Promise<StoredEnvVaultEntry[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, category, key_name, value, secret, notes, updated_at
         FROM app_env_vault
         ORDER BY category ASC, key_name ASC`
      );
      return res.rows.map((r) => ({
        id: String(r.id),
        category: String(r.category || 'Code & Custom'),
        keyName: String(r.key_name),
        value: String(r.value || ''),
        secret: Boolean(r.secret),
        notes: typeof r.notes === 'string' && r.notes ? r.notes : undefined,
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
    }
    return [...this.memEnvVault].sort((a, b) =>
      a.category === b.category ? a.keyName.localeCompare(b.keyName) : a.category.localeCompare(b.category)
    );
  }

  public async upsertEnvVaultEntry(input: {
    id?: string;
    category: string;
    keyName: string;
    value: string;
    secret: boolean;
    notes?: string;
  }): Promise<StoredEnvVaultEntry> {
    await this.ready();
    const id = input.id && input.id.trim() ? input.id.trim() : 'ev_' + crypto.randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    const record: StoredEnvVaultEntry = {
      id,
      category: input.category,
      keyName: input.keyName,
      value: input.value,
      secret: input.secret,
      notes: input.notes,
      updatedAt: now,
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
        [id, record.category, record.keyName, record.value, record.secret, record.notes || '']
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

  public async deleteEnvVaultEntry(id: string): Promise<boolean> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_env_vault WHERE id = $1', [id]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memEnvVault.length;
    this.memEnvVault = this.memEnvVault.filter((e) => e.id !== id);
    const deleted = this.memEnvVault.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }

  // ---- NEWSFEED ANNOUNCEMENT SLIDE BANNERS ----
  public async listAnnouncements(): Promise<StoredAnnouncement[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        `SELECT id, title, message, badge, tone, target, active, created_by, created_at, updated_at
         FROM app_announcements
         ORDER BY updated_at DESC, created_at DESC`
      );
      return res.rows.map((r) => ({
        id: String(r.id),
        title: String(r.title || ''),
        message: String(r.message || ''),
        badge: normalizeAnnouncementBadge(r.badge),
        tone: normalizeAnnouncementTone(r.tone),
        target: normalizeAnnouncementTarget(r.target),
        active: Boolean(r.active),
        createdBy: String(r.created_by || 'Admin'),
        createdAt: new Date(String(r.created_at)).toISOString(),
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
    }
    return [...this.memAnnouncements].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async createAnnouncement(input: {
    title: string;
    message: string;
    badge?: AnnouncementBadge;
    tone?: AnnouncementTone;
    target?: AnnouncementTarget;
    active?: boolean;
    createdBy?: string;
  }): Promise<StoredAnnouncement> {
    await this.ready();
    const id = 'ann_' + crypto.randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    const record: StoredAnnouncement = {
      id,
      title: input.title.trim().slice(0, 120),
      message: input.message.trim().slice(0, 500),
      badge: normalizeAnnouncementBadge(input.badge),
      tone: normalizeAnnouncementTone(input.tone),
      target: normalizeAnnouncementTarget(input.target),
      active: input.active !== false,
      createdBy: (input.createdBy || 'Admin').trim().slice(0, 80) || 'Admin',
      createdAt: now,
      updatedAt: now,
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

  public async updateAnnouncement(
    id: string,
    patch: Partial<{
      title: string;
      message: string;
      badge: AnnouncementBadge;
      tone: AnnouncementTone;
      target: AnnouncementTarget;
      active: boolean;
    }>
  ): Promise<StoredAnnouncement | null> {
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
      const cur = existingRes.rows[0];
      const next: StoredAnnouncement = {
        id: String(cur.id),
        title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim().slice(0, 120) : String(cur.title),
        message:
          typeof patch.message === 'string' && patch.message.trim()
            ? patch.message.trim().slice(0, 500)
            : String(cur.message),
        badge: patch.badge !== undefined ? normalizeAnnouncementBadge(patch.badge) : normalizeAnnouncementBadge(cur.badge),
        tone: patch.tone !== undefined ? normalizeAnnouncementTone(patch.tone) : normalizeAnnouncementTone(cur.tone),
        target:
          patch.target !== undefined ? normalizeAnnouncementTarget(patch.target) : normalizeAnnouncementTarget(cur.target),
        active: typeof patch.active === 'boolean' ? patch.active : Boolean(cur.active),
        createdBy: String(cur.created_by || 'Admin'),
        createdAt: new Date(String(cur.created_at)).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.pool.query(
        `UPDATE app_announcements
         SET title = $1, message = $2, badge = $3, tone = $4, target = $5, active = $6, updated_at = NOW()
         WHERE id = $7`,
        [next.title, next.message, next.badge, next.tone, next.target, next.active, cleanId]
      );
      return next;
    }

    const idx = this.memAnnouncements.findIndex((a) => a.id === cleanId);
    if (idx < 0) return null;
    const cur = this.memAnnouncements[idx];
    const next: StoredAnnouncement = {
      ...cur,
      title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim().slice(0, 120) : cur.title,
      message: typeof patch.message === 'string' && patch.message.trim() ? patch.message.trim().slice(0, 500) : cur.message,
      badge: patch.badge !== undefined ? normalizeAnnouncementBadge(patch.badge) : cur.badge,
      tone: patch.tone !== undefined ? normalizeAnnouncementTone(patch.tone) : cur.tone,
      target: patch.target !== undefined ? normalizeAnnouncementTarget(patch.target) : cur.target,
      active: typeof patch.active === 'boolean' ? patch.active : cur.active,
      updatedAt: new Date().toISOString(),
    };
    this.memAnnouncements[idx] = next;
    await this.persistMemory();
    return next;
  }

  public async deleteAnnouncement(id: string): Promise<boolean> {
    await this.ready();
    const cleanId = id.trim();
    if (!cleanId) return false;
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('DELETE FROM app_announcements WHERE id = $1', [cleanId]);
      return Boolean(res.rowCount && res.rowCount > 0);
    }
    const before = this.memAnnouncements.length;
    this.memAnnouncements = this.memAnnouncements.filter((a) => a.id !== cleanId);
    const deleted = this.memAnnouncements.length < before;
    if (deleted) await this.persistMemory();
    return deleted;
  }

  public async exportCloudBackup(): Promise<{
    exportedAt: string;
    users: StoredUser[];
    settings: StoredPricesSettings;
    newsfeedConfig: StoredNewsfeedConfig;
    ledger: StoredLedgerRow[];
    knowledge: StoredKnowledgeQA[];
    announcements: StoredAnnouncement[];
    chatGroups: StoredChatGroup[];
  }> {
    await this.ready();
    let users: StoredUser[];
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_users ORDER BY created_at ASC');
      users = res.rows.map((r) => this.mapUserRow(r));
    } else {
      users = this.memUsers.map((u) => ({
        ...u,
        blockedUsers: [...(u.blockedUsers || [])],
        newsfeed: normalizeUserNewsfeed(u.newsfeed),
      }));
    }

    const [settings, newsfeedConfig, ledger, knowledge, announcements, chatGroups] = await Promise.all([
      this.getSettings(),
      this.getNewsfeedConfig(),
      this.listLedger(),
      this.listKnowledge(),
      this.listAnnouncements(),
      this.listChatGroups(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      users,
      settings,
      newsfeedConfig,
      ledger,
      knowledge,
      announcements,
      chatGroups,
    };
  }

  public async restoreCloudBackup(input: {
    users?: Array<Partial<StoredUser>>;
    settings?: Partial<StoredPricesSettings>;
    newsfeedConfig?: Partial<StoredNewsfeedConfig>;
    ledger?: Array<Partial<StoredLedgerRow>>;
    knowledge?: Array<Partial<StoredKnowledgeQA>>;
    announcements?: Array<Partial<StoredAnnouncement>>;
    chatGroups?: Array<Partial<StoredChatGroup>>;
  }): Promise<{
    restoredUsersCount: number;
    totalUsersCount: number;
    restoredLedgerCount: number;
    restoredKnowledgeCount: number;
    restoredAnnouncementsCount: number;
  }> {
    await this.ready();
    let restoredUsersCount = 0;
    let restoredLedgerCount = 0;
    let restoredKnowledgeCount = 0;
    let restoredAnnouncementsCount = 0;

    const incomingUsers = Array.isArray(input.users) ? input.users : [];
    for (const raw of incomingUsers) {
      if (!raw || typeof raw !== 'object') continue;
      const id = typeof raw.id === 'string' ? raw.id.trim().slice(0, 128) : '';
      const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : '';
      const phone = typeof raw.phone === 'string' ? normalizePhone(raw.phone).slice(0, 64) : '';
      const pinHash = typeof raw.pinHash === 'string' ? raw.pinHash.trim().slice(0, 256) : '';
      if (!id || !name || !phone || pinHash.length < 10 || !pinHash.includes(':')) continue;

      const role: 'admin' | 'member' = raw.role === 'admin' ? 'admin' : 'member';
      const status: 'pending' | 'approved' = raw.status === 'pending' ? 'pending' : 'approved';
      const blockedUsers = Array.isArray(raw.blockedUsers)
        ? raw.blockedUsers
            .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
            .slice(0, 100)
            .map((b) => b.trim().slice(0, 80))
        : [];
      const avatar = sanitizeMediaUrl(raw.avatar);
      const newsfeed = normalizeUserNewsfeed(raw.newsfeed);
      const createdAt =
        typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt))
          ? new Date(raw.createdAt).toISOString()
          : new Date().toISOString();
      const updatedAt =
        typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt))
          ? new Date(raw.updatedAt).toISOString()
          : createdAt;

      if (this.usePostgres && this.pool) {
        const existingRes = await this.pool.query(
          'SELECT id FROM app_users WHERE id = $1 OR phone = $2 LIMIT 1',
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
              updatedAt,
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
            updatedAt,
          });
          restoredUsersCount += 1;
        }
      }
    }

    if (input.newsfeedConfig && typeof input.newsfeedConfig === 'object') {
      const currentNf = await this.getNewsfeedConfig();
      const isDefaultNf =
        currentNf.feedATitle === DEFAULT_NEWSFEED_CONFIG.feedATitle &&
        currentNf.feedBTitle === DEFAULT_NEWSFEED_CONFIG.feedBTitle &&
        currentNf.feedCTitle === DEFAULT_NEWSFEED_CONFIG.feedCTitle;
      if (isDefaultNf) {
        await this.saveNewsfeedConfig(input.newsfeedConfig);
      }
    }

    if (input.settings && typeof input.settings === 'object') {
      const currentSettings = await this.getSettings();
      const isDefaultSettings =
        currentSettings.fiveH === DEFAULT_SETTINGS.fiveH &&
        currentSettings.bulig === DEFAULT_SETTINGS.bulig &&
        currentSettings.point5 === DEFAULT_SETTINGS.point5 &&
        currentSettings.halfSack === DEFAULT_SETTINGS.halfSack &&
        currentSettings.oneSack === DEFAULT_SETTINGS.oneSack;
      if (isDefaultSettings) {
        await this.saveSettings({
          fiveH: clampNum(input.settings.fiveH ?? currentSettings.fiveH, 0, 1000000),
          bulig: clampNum(input.settings.bulig ?? currentSettings.bulig, 0, 1000000),
          point5: clampNum(input.settings.point5 ?? currentSettings.point5, 0, 1000000),
          halfSack: clampNum(input.settings.halfSack ?? currentSettings.halfSack, 0, 1000000),
          oneSack: clampNum(input.settings.oneSack ?? currentSettings.oneSack, 0, 1000000),
          defFiveH: clampNum(input.settings.defFiveH ?? currentSettings.defFiveH, 0, 1000000),
          defBulig: clampNum(input.settings.defBulig ?? currentSettings.defBulig, 0, 1000000),
          defPoint5: clampNum(input.settings.defPoint5 ?? currentSettings.defPoint5, 0, 1000000),
          defHalfSack: clampNum(input.settings.defHalfSack ?? currentSettings.defHalfSack, 0, 1000000),
          defOneSack: clampNum(input.settings.defOneSack ?? currentSettings.defOneSack, 0, 1000000),
        });
      }
    }

    const incomingLedger = Array.isArray(input.ledger) ? input.ledger : [];
    for (const rawRow of incomingLedger) {
      if (!rawRow || typeof rawRow !== 'object') continue;
      const id = typeof rawRow.id === 'string' ? rawRow.id.trim().slice(0, 128) : '';
      const name = typeof rawRow.name === 'string' ? rawRow.name.trim().slice(0, 100) : '';
      if (!id || !name) continue;
      if (this.usePostgres && this.pool) {
        const existsRes = await this.pool.query('SELECT id FROM app_ledger WHERE id = $1 LIMIT 1', [id]);
        if (!existsRes.rowCount) {
          await this.pool.query(
            `INSERT INTO app_ledger (id, name, five_h, five_h_type, bulig, point5, half_sack, one_sack, bal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              id,
              name,
              clampNum(rawRow.fiveH, -1000000, 1000000),
              rawRow.fiveHType === 'red' ? 'red' : 'blue',
              clampNum(rawRow.bulig, -1000000, 1000000),
              clampNum(rawRow.point5, -1000000, 1000000),
              clampNum(rawRow.halfSack, -1000000, 1000000),
              clampNum(rawRow.oneSack, -1000000, 1000000),
              clampNum(rawRow.bal, -100000000, 100000000),
            ]
          );
          restoredLedgerCount += 1;
        }
      } else if (!this.memLedger.some((r) => r.id === id)) {
        this.memLedger.push({
          id,
          name,
          fiveH: clampNum(rawRow.fiveH, -1000000, 1000000),
          fiveHType: rawRow.fiveHType === 'red' ? 'red' : 'blue',
          bulig: clampNum(rawRow.bulig, -1000000, 1000000),
          point5: clampNum(rawRow.point5, -1000000, 1000000),
          halfSack: clampNum(rawRow.halfSack, -1000000, 1000000),
          oneSack: clampNum(rawRow.oneSack, -1000000, 1000000),
          bal: clampNum(rawRow.bal, -100000000, 100000000),
          updatedAt:
            typeof rawRow.updatedAt === 'string' ? rawRow.updatedAt : new Date().toISOString(),
        });
        restoredLedgerCount += 1;
      }
    }

    const incomingKnowledge = Array.isArray(input.knowledge) ? input.knowledge : [];
    for (const rawQa of incomingKnowledge) {
      if (!rawQa || typeof rawQa !== 'object') continue;
      const id = typeof rawQa.id === 'string' ? rawQa.id.trim().slice(0, 128) : '';
      const question = typeof rawQa.question === 'string' ? rawQa.question.trim().slice(0, 300) : '';
      const answer = typeof rawQa.answer === 'string' ? rawQa.answer.trim().slice(0, 2000) : '';
      if (!id || !question || !answer) continue;
      if (this.usePostgres && this.pool) {
        const existsRes = await this.pool.query('SELECT id FROM app_knowledge WHERE id = $1 LIMIT 1', [id]);
        if (!existsRes.rowCount) {
          await this.pool.query('INSERT INTO app_knowledge (id, question, answer) VALUES ($1, $2, $3)', [
            id,
            question,
            answer,
          ]);
          restoredKnowledgeCount += 1;
        }
      } else if (!this.memKnowledge.some((k) => k.id === id)) {
        this.memKnowledge.push({
          id,
          question,
          answer,
          createdAt: typeof rawQa.createdAt === 'string' ? rawQa.createdAt : new Date().toISOString(),
        });
        restoredKnowledgeCount += 1;
      }
    }

    const incomingAnnouncements = Array.isArray(input.announcements) ? input.announcements : [];
    for (const rawAnn of incomingAnnouncements) {
      if (!rawAnn || typeof rawAnn !== 'object') continue;
      const id = typeof rawAnn.id === 'string' ? rawAnn.id.trim().slice(0, 128) : '';
      const title = typeof rawAnn.title === 'string' ? rawAnn.title.trim().slice(0, 120) : '';
      const message = typeof rawAnn.message === 'string' ? rawAnn.message.trim().slice(0, 1000) : '';
      if (!id || !title || !message) continue;
      const badge = normalizeAnnouncementBadge(rawAnn.badge);
      const tone = normalizeAnnouncementTone(rawAnn.tone);
      const target = normalizeAnnouncementTarget(rawAnn.target);
      const active = rawAnn.active !== false;
      const createdBy =
        typeof rawAnn.createdBy === 'string' && rawAnn.createdBy.trim()
          ? rawAnn.createdBy.trim().slice(0, 80)
          : 'Admin';
      const createdAt = typeof rawAnn.createdAt === 'string' ? rawAnn.createdAt : new Date().toISOString();
      const updatedAt = typeof rawAnn.updatedAt === 'string' ? rawAnn.updatedAt : createdAt;

      if (this.usePostgres && this.pool) {
        const existsRes = await this.pool.query('SELECT id FROM app_announcements WHERE id = $1 LIMIT 1', [id]);
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
          updatedAt,
        });
        restoredAnnouncementsCount += 1;
      }
    }

    const incomingGroups = Array.isArray(input.chatGroups) ? input.chatGroups : [];
    let restoredGroupsCount = 0;
    for (const rawGrp of incomingGroups) {
      if (!rawGrp || typeof rawGrp !== 'object') continue;
      const id = typeof rawGrp.id === 'string' ? rawGrp.id.trim().slice(0, 128) : '';
      const name = typeof rawGrp.name === 'string' ? rawGrp.name.trim().slice(0, 60) : '';
      if (!id || !name) continue;
      const memberIds = Array.isArray(rawGrp.memberIds)
        ? Array.from(new Set(rawGrp.memberIds.map(String).map((s) => s.trim()).filter(Boolean)))
        : [];
      const createdById = typeof rawGrp.createdById === 'string' ? rawGrp.createdById.trim().slice(0, 128) : 'system';
      const createdByName = typeof rawGrp.createdByName === 'string' ? rawGrp.createdByName.trim().slice(0, 80) : 'Member';
      const adminId =
        typeof rawGrp.adminId === 'string' && rawGrp.adminId.trim()
          ? rawGrp.adminId.trim().slice(0, 128)
          : createdById;
      const adminName =
        typeof rawGrp.adminName === 'string' && rawGrp.adminName.trim()
          ? rawGrp.adminName.trim().slice(0, 80)
          : createdByName;
      const createdAt = typeof rawGrp.createdAt === 'string' ? rawGrp.createdAt : new Date().toISOString();
      const updatedAt = typeof rawGrp.updatedAt === 'string' ? rawGrp.updatedAt : createdAt;

      if (this.usePostgres && this.pool) {
        const existsRes = await this.pool.query('SELECT id FROM app_chat_groups WHERE id = $1 LIMIT 1', [id]);
        if (!existsRes.rowCount) {
          await this.pool.query(
            `INSERT INTO app_chat_groups (id, name, member_ids, created_by_id, created_by_name, admin_id, admin_name, created_at, updated_at)
             VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)`,
            [id, name, JSON.stringify(memberIds), createdById, createdByName, adminId, adminName, createdAt, updatedAt]
          );
          restoredGroupsCount += 1;
        }
      } else if (!this.memChatGroups.some((g) => g.id === id)) {
        this.memChatGroups.push({
          id,
          name,
          memberIds,
          createdById,
          createdByName,
          adminId,
          adminName,
          createdAt,
          updatedAt,
        });
        restoredGroupsCount += 1;
      }
    }

    if (
      !this.usePostgres &&
      (restoredUsersCount > 0 ||
        restoredLedgerCount > 0 ||
        restoredKnowledgeCount > 0 ||
        restoredAnnouncementsCount > 0 ||
        restoredGroupsCount > 0)
    ) {
      await this.persistMemory();
    }

    let totalUsersCount = this.memUsers.length;
    if (this.usePostgres && this.pool) {
      const countRes = await this.pool.query('SELECT COUNT(*)::int AS cnt FROM app_users');
      totalUsersCount = Number(countRes.rows[0]?.cnt || 0);
    }

    return {
      restoredUsersCount,
      totalUsersCount,
      restoredLedgerCount,
      restoredKnowledgeCount,
      restoredAnnouncementsCount,
    };
  }

  private mapUserRow(r: Record<string, unknown>): StoredUser {
    const rawAvatar = typeof r.avatar_url === 'string' ? r.avatar_url.trim() : '';
    const newsfeed = normalizeUserNewsfeed(r.newsfeed);
    const encReal = typeof r.encrypted_real_name === 'string' && r.encrypted_real_name.trim() ? r.encrypted_real_name.trim() : undefined;
    const meta = (r.private_kyc_meta && typeof r.private_kyc_meta === 'object' ? r.private_kyc_meta : {}) as Record<string, unknown>;
    return {
      id: String(r.id),
      name: String(r.name),
      phone: String(r.phone),
      pinHash: String(r.pin_hash),
      role: r.role === 'admin' ? 'admin' : 'member',
      status: String(r.status || '').trim().toLowerCase() === 'approved' ? 'approved' : 'pending',
      blockedUsers: Array.isArray(r.blocked_users) ? (r.blocked_users as string[]) : [],
      avatar: rawAvatar || undefined,
      newsfeed,
      encryptedRealName: encReal,
      privateValidIdAssetId: typeof meta.privateValidIdAssetId === 'string' ? meta.privateValidIdAssetId : undefined,
      privateRealAvatarAssetId: typeof meta.privateRealAvatarAssetId === 'string' ? meta.privateRealAvatarAssetId : undefined,
      privacyConsentAccepted: Boolean(meta.privacyConsentAccepted),
      privacyConsentAt: typeof meta.privacyConsentAt === 'string' ? meta.privacyConsentAt : undefined,
      createdAt: new Date(String(r.created_at)).toISOString(),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    };
  }

  private normalizeUserDashboard(userId: string, raw?: Partial<StoredUserDashboard> | null): StoredUserDashboard {
    const now = new Date().toISOString();
    const walletBalance = Number.isFinite(Number(raw?.walletBalance)) ? Math.max(0, Number(raw?.walletBalance)) : 0;
    const choyWalletBalance = Number.isFinite(Number(raw?.choyWalletBalance))
      ? Math.max(0, Number(raw?.choyWalletBalance))
      : 0;
    const plan =
      raw?.subscriptionPlan === 'choy_pro_monthly' ||
      raw?.subscriptionPlan === 'choy_pro_annual' ||
      raw?.subscriptionPlan === 'vip_supporter'
        ? raw.subscriptionPlan
        : 'free';
    const subStatus =
      raw?.subscriptionStatus === 'active' || raw?.subscriptionStatus === 'cancelled'
        ? raw.subscriptionStatus
        : plan === 'free'
        ? 'active'
        : 'inactive';
    const transactions = Array.isArray(raw?.transactions) ? raw.transactions.slice(0, 60) : [];

    const rawKycStatus = raw?.kycStatus;
    const kycStatus: KycVerificationStatus =
      rawKycStatus === 'pending' || rawKycStatus === 'approved' || rawKycStatus === 'rejected'
        ? rawKycStatus
        : 'unsubmitted';
    const rawKycSex = raw?.kycSex;
    const kycSex: 'Male' | 'Female' | 'Other' | undefined =
      rawKycSex === 'Male' || rawKycSex === 'Female' || rawKycSex === 'Other' ? rawKycSex : undefined;
    const rawKycAge = Number(raw?.kycAge);
    const kycAge = Number.isInteger(rawKycAge) && rawKycAge >= 13 && rawKycAge <= 120 ? rawKycAge : undefined;

    return {
      userId,
      publicShowName: raw?.publicShowName !== false,
      walletBalance,
      choyWalletBalance,
      choyProActive: Boolean(raw?.choyProActive),
      choyProActivatedAt: typeof raw?.choyProActivatedAt === 'string' ? raw.choyProActivatedAt : undefined,
      subscriptionPlan: plan,
      subscriptionStatus: subStatus,
      subscriptionAutoRenew: raw?.subscriptionAutoRenew !== false,
      subscriptionRenewAt: typeof raw?.subscriptionRenewAt === 'string' ? raw.subscriptionRenewAt : undefined,
      lastDailyClaimAt: typeof raw?.lastDailyClaimAt === 'string' ? raw.lastDailyClaimAt : undefined,
      rulesAcceptedAt: typeof raw?.rulesAcceptedAt === 'string' ? raw.rulesAcceptedAt : undefined,
      acknowledgmentSignedName:
        typeof raw?.acknowledgmentSignedName === 'string' ? raw.acknowledgmentSignedName : undefined,
      acknowledgmentSignedAt:
        typeof raw?.acknowledgmentSignedAt === 'string' ? raw.acknowledgmentSignedAt : undefined,
      kycCompleteName:
        typeof raw?.kycCompleteName === 'string' && raw.kycCompleteName.trim()
          ? raw.kycCompleteName.trim().slice(0, 120)
          : undefined,
      kycAddress:
        typeof raw?.kycAddress === 'string' && raw.kycAddress.trim()
          ? raw.kycAddress.trim().slice(0, 260)
          : undefined,
      kycAge,
      kycSex,
      kycValidIdType:
        typeof raw?.kycValidIdType === 'string' && raw.kycValidIdType.trim()
          ? raw.kycValidIdType.trim().slice(0, 80)
          : undefined,
      kycValidIdName:
        typeof raw?.kycValidIdName === 'string' && raw.kycValidIdName.trim()
          ? raw.kycValidIdName.trim().slice(0, 120)
          : undefined,
      kycValidIdImageUrl:
        typeof raw?.kycValidIdImageUrl === 'string' && raw.kycValidIdImageUrl.trim()
          ? raw.kycValidIdImageUrl.trim()
          : undefined,
      kycStatus,
      kycSubmittedAt: typeof raw?.kycSubmittedAt === 'string' ? raw.kycSubmittedAt : undefined,
      kycReviewedBy: typeof raw?.kycReviewedBy === 'string' ? raw.kycReviewedBy : undefined,
      kycReviewedAt: typeof raw?.kycReviewedAt === 'string' ? raw.kycReviewedAt : undefined,
      kycRejectionReason:
        typeof raw?.kycRejectionReason === 'string' && raw.kycRejectionReason.trim()
          ? raw.kycRejectionReason.trim().slice(0, 260)
          : undefined,
      transactions,
      updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : now,
    };
  }

  public async getUserDashboard(userId: string): Promise<StoredUserDashboard> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_user_dashboards WHERE user_id = $1 LIMIT 1', [userId]);
      if (res.rows.length > 0 && res.rows[0].data && typeof res.rows[0].data === 'object') {
        return this.normalizeUserDashboard(userId, res.rows[0].data as Partial<StoredUserDashboard>);
      }
      const created = this.normalizeUserDashboard(userId, null);
      await this.pool.query(
        'INSERT INTO app_user_dashboards (user_id, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (user_id) DO NOTHING',
        [userId, JSON.stringify(created)]
      );
      return created;
    }

    const existing = this.memUserDashboards.find((d) => d.userId === userId);
    if (existing) {
      return this.normalizeUserDashboard(userId, existing);
    }
    const created = this.normalizeUserDashboard(userId, null);
    this.memUserDashboards.push(created);
    await this.persistMemory();
    return created;
  }

  public async saveUserDashboard(nextDashboard: StoredUserDashboard): Promise<StoredUserDashboard> {
    await this.ready();
    const normalized = this.normalizeUserDashboard(nextDashboard.userId, {
      ...nextDashboard,
      updatedAt: new Date().toISOString(),
    });
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_user_dashboards (user_id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [normalized.userId, JSON.stringify(normalized)]
      );
      return normalized;
    }
    const idx = this.memUserDashboards.findIndex((d) => d.userId === normalized.userId);
    if (idx >= 0) {
      this.memUserDashboards[idx] = normalized;
    } else {
      this.memUserDashboards.push(normalized);
    }
    await this.persistMemory();
    return normalized;
  }

  public async listUserDashboardMeta(): Promise<
    Record<string, { publicShowName: boolean; choyProActive: boolean; subscriptionPlan: string }>
  > {
    await this.ready();
    const map: Record<string, { publicShowName: boolean; choyProActive: boolean; subscriptionPlan: string }> = {};
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT user_id, data FROM app_user_dashboards');
      for (const row of res.rows) {
        const uid = String(row.user_id || '').trim();
        if (!uid) continue;
        const d = (row.data || {}) as Partial<StoredUserDashboard>;
        map[uid] = {
          publicShowName: d.publicShowName !== false,
          choyProActive: Boolean(d.choyProActive),
          subscriptionPlan: typeof d.subscriptionPlan === 'string' ? d.subscriptionPlan : 'free',
        };
      }
      return map;
    }
    for (const d of this.memUserDashboards) {
      map[d.userId] = {
        publicShowName: d.publicShowName !== false,
        choyProActive: Boolean(d.choyProActive),
        subscriptionPlan: d.subscriptionPlan || 'free',
      };
    }
    return map;
  }

  public async listAllUserDashboards(): Promise<StoredUserDashboard[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT user_id, data FROM app_user_dashboards ORDER BY updated_at DESC');
      return res.rows
        .map((row) => {
          const uid = String(row.user_id || '').trim();
          if (!uid) return null;
          return this.normalizeUserDashboard(uid, (row.data || {}) as Partial<StoredUserDashboard>);
        })
        .filter((d): d is StoredUserDashboard => Boolean(d));
    }
    return this.memUserDashboards.map((d) => this.normalizeUserDashboard(d.userId, d));
  }

  public async listMarketplaceItems(): Promise<StoredMarketplaceItem[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_marketplace_items ORDER BY created_at DESC');
      if (res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: String(r.id),
          category: (['food', 'groceries', 'medicines', 'appliances'].includes(String(r.category)) ? r.category : 'food') as any,
          title: String(r.title),
          description: String(r.description || ''),
          price: Number(r.price || 0),
          imageUrl: typeof r.image_url === 'string' && r.image_url ? r.image_url : undefined,
          stock: Number(r.stock ?? 100),
          sellerName: String(r.seller_name || 'Choy Store'),
          createdBy: String(r.created_by || 'Admin'),
          createdAt: new Date(String(r.created_at)).toISOString(),
          updatedAt: new Date(String(r.updated_at)).toISOString(),
        }));
      }
      for (const item of DEFAULT_MARKETPLACE_ITEMS) {
        await this.pool.query(
          `INSERT INTO app_marketplace_items (id, category, title, description, price, image_url, stock, seller_name, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz)
           ON CONFLICT (id) DO NOTHING`,
          [item.id, item.category, item.title, item.description, item.price, item.imageUrl || null, item.stock, item.sellerName, item.createdBy, item.createdAt, item.updatedAt]
        );
      }
      const reread = await this.pool.query('SELECT * FROM app_marketplace_items ORDER BY created_at DESC');
      return reread.rows.map((r) => ({
        id: String(r.id),
        category: (['food', 'groceries', 'medicines', 'appliances'].includes(String(r.category)) ? r.category : 'food') as any,
        title: String(r.title),
        description: String(r.description || ''),
        price: Number(r.price || 0),
        imageUrl: typeof r.image_url === 'string' && r.image_url ? r.image_url : undefined,
        stock: Number(r.stock ?? 100),
        sellerName: String(r.seller_name || 'Choy Store'),
        createdBy: String(r.created_by || 'Admin'),
        createdAt: new Date(String(r.created_at)).toISOString(),
        updatedAt: new Date(String(r.updated_at)).toISOString(),
      }));
    }
    if (this.memMarketplaceItems.length === 0) {
      this.memMarketplaceItems = [...DEFAULT_MARKETPLACE_ITEMS];
    }
    return this.memMarketplaceItems;
  }

  public async saveMarketplaceItem(item: StoredMarketplaceItem): Promise<StoredMarketplaceItem[]> {
    await this.ready();
    const now = new Date().toISOString();
    const normalized: StoredMarketplaceItem = {
      ...item,
      updatedAt: now,
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_marketplace_items (id, category, title, description, price, image_url, stock, seller_name, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz)
         ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, title = EXCLUDED.title, description = EXCLUDED.description, price = EXCLUDED.price, image_url = EXCLUDED.image_url, stock = EXCLUDED.stock, seller_name = EXCLUDED.seller_name, updated_at = NOW()`,
        [normalized.id, normalized.category, normalized.title, normalized.description, normalized.price, normalized.imageUrl || null, normalized.stock, normalized.sellerName, normalized.createdBy, normalized.createdAt, normalized.updatedAt]
      );
      return this.listMarketplaceItems();
    }
    const idx = this.memMarketplaceItems.findIndex((i) => i.id === normalized.id);
    if (idx >= 0) {
      this.memMarketplaceItems[idx] = normalized;
    } else {
      this.memMarketplaceItems.unshift(normalized);
    }
    await this.persistMemory();
    return this.memMarketplaceItems;
  }

  public async deleteMarketplaceItem(id: string): Promise<StoredMarketplaceItem[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      await this.pool.query('DELETE FROM app_marketplace_items WHERE id = $1', [id]);
      return this.listMarketplaceItems();
    }
    this.memMarketplaceItems = this.memMarketplaceItems.filter((i) => i.id !== id);
    await this.persistMemory();
    return this.memMarketplaceItems;
  }

  public async listMarketplaceOrders(): Promise<StoredMarketplaceOrder[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT * FROM app_marketplace_orders ORDER BY created_at DESC');
      return res.rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        userName: String(r.user_name),
        customerName: typeof r.customer_name === 'string' ? r.customer_name : undefined,
        customerPhone: typeof r.customer_phone === 'string' ? r.customer_phone : undefined,
        deliveryAddress: typeof r.delivery_address === 'string' ? r.delivery_address : undefined,
        deliveryNotes: typeof r.delivery_notes === 'string' ? r.delivery_notes : undefined,
        deliveryDistanceKm: Number(r.delivery_distance_km ?? 2),
        deliveryFee: Number(r.delivery_fee ?? 25),
        items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
        totalAmount: Number(r.total_amount || 0),
        paymentMethod: (['wallet', 'choy_wallet'].includes(String(r.payment_method)) ? r.payment_method : 'wallet') as any,
        status: (['pending', 'preparing', 'out_for_delivery', 'completed', 'cancelled'].includes(String(r.status)) ? r.status : 'pending') as any,
        createdAt: new Date(String(r.created_at)).toISOString(),
      }));
    }
    return this.memMarketplaceOrders;
  }

  public async saveMarketplaceOrder(order: StoredMarketplaceOrder): Promise<StoredMarketplaceOrder[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_marketplace_orders (id, user_id, user_name, customer_name, customer_phone, delivery_address, delivery_notes, delivery_distance_km, delivery_fee, items, total_amount, payment_method, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14::timestamptz)
         ON CONFLICT (id) DO UPDATE SET items = EXCLUDED.items, total_amount = EXCLUDED.total_amount, status = EXCLUDED.status, customer_name = EXCLUDED.customer_name, customer_phone = EXCLUDED.customer_phone, delivery_address = EXCLUDED.delivery_address, delivery_notes = EXCLUDED.delivery_notes`,
        [order.id, order.userId, order.userName, order.customerName || null, order.customerPhone || null, order.deliveryAddress || null, order.deliveryNotes || null, order.deliveryDistanceKm || 2, order.deliveryFee || 25, JSON.stringify(order.items), order.totalAmount, order.paymentMethod, order.status, order.createdAt]
      );
      return this.listMarketplaceOrders();
    }
    const idx = this.memMarketplaceOrders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      this.memMarketplaceOrders[idx] = order;
    } else {
      this.memMarketplaceOrders.unshift(order);
    }
    await this.persistMemory();
    return this.memMarketplaceOrders;
  }

  public async deleteMarketplaceOrder(id: string): Promise<StoredMarketplaceOrder[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      await this.pool.query('DELETE FROM app_marketplace_orders WHERE id = $1', [id]);
      return this.listMarketplaceOrders();
    }
    this.memMarketplaceOrders = this.memMarketplaceOrders.filter((o) => o.id !== id);
    await this.persistMemory();
    return this.memMarketplaceOrders;
  }

  public async getPaymentTerminalConfig(): Promise<StoredPaymentTerminalConfig> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['payment_terminal_config']);
      if (res.rows[0]?.data) {
        return sanitizePaymentTerminalConfig(res.rows[0].data);
      }
      return sanitizePaymentTerminalConfig(DEFAULT_PAYMENT_TERMINAL_CONFIG);
    }
    return sanitizePaymentTerminalConfig(this.memPaymentTerminalConfig);
  }

  public async savePaymentTerminalConfig(config: StoredPaymentTerminalConfig): Promise<StoredPaymentTerminalConfig> {
    await this.ready();
    const sanitized = sanitizePaymentTerminalConfig({
      ...config,
      updatedAt: new Date().toISOString(),
    });
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['payment_terminal_config', JSON.stringify(sanitized)]
      );
      return sanitized;
    }
    this.memPaymentTerminalConfig = sanitized;
    await this.persistMemory();
    return sanitized;
  }

  public async listMusicTracks(): Promise<StoredMusicTrack[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['media_music_library']);
      const list = Array.isArray(res.rows[0]?.data) ? (res.rows[0].data as StoredMusicTrack[]) : [];
      return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }
    return [...this.memMusicLibrary].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  public async saveMusicTracks(tracks: StoredMusicTrack[]): Promise<StoredMusicTrack[]> {
    await this.ready();
    const cleaned = tracks.slice(0, 300);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['media_music_library', JSON.stringify(cleaned)]
      );
      return cleaned;
    }
    this.memMusicLibrary = cleaned;
    await this.persistMemory();
    return cleaned;
  }

  public async listLongVideos(): Promise<StoredLongVideo[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['media_video_library']);
      const list = Array.isArray(res.rows[0]?.data) ? (res.rows[0].data as StoredLongVideo[]) : [];
      return list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }
    return [...this.memVideoLibrary].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  public async saveLongVideos(videos: StoredLongVideo[]): Promise<StoredLongVideo[]> {
    await this.ready();
    const cleaned = videos.slice(0, 200);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['media_video_library', JSON.stringify(cleaned)]
      );
      return cleaned;
    }
    this.memVideoLibrary = cleaned;
    await this.persistMemory();
    return cleaned;
  }

  public async listInvestProducts(): Promise<StoredInvestProduct[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['invest_products']);
      if (Array.isArray(res.rows[0]?.data)) {
        return res.rows[0].data as StoredInvestProduct[];
      }
      await this.saveInvestProducts(DEFAULT_INVEST_PRODUCTS);
      return [...DEFAULT_INVEST_PRODUCTS];
    }
    return [...this.memInvestProducts];
  }

  public async saveInvestProducts(products: StoredInvestProduct[]): Promise<StoredInvestProduct[]> {
    await this.ready();
    const cleaned = products.slice(0, 100);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['invest_products', JSON.stringify(cleaned)]
      );
      return cleaned;
    }
    this.memInvestProducts = cleaned;
    await this.persistMemory();
    return cleaned;
  }

  public async listUserInvestments(): Promise<StoredUserInvestment[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['user_investments']);
      const list = Array.isArray(res.rows[0]?.data) ? (res.rows[0].data as StoredUserInvestment[]) : [];
      return list.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
    }
    return [...this.memUserInvestments].sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
  }

  public async saveUserInvestments(investments: StoredUserInvestment[]): Promise<StoredUserInvestment[]> {
    await this.ready();
    const cleaned = investments.slice(0, 2000);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['user_investments', JSON.stringify(cleaned)]
      );
      return cleaned;
    }
    this.memUserInvestments = cleaned;
    await this.persistMemory();
    return cleaned;
  }

  private mapPaymentTerminalTxRow(r: Record<string, unknown>): StoredPaymentTerminalTx {
    const rawPurpose = String(r.purpose || 'wallet_topup');
    const purpose: PaymentTerminalPurpose =
      rawPurpose === 'choy_coins' || rawPurpose === 'order_payment' || rawPurpose === 'pos_payment'
        ? rawPurpose
        : 'wallet_topup';
    const rawChannel = String(r.channel || 'gcash');
    const channel: PaymentTerminalChannelId =
      rawChannel === 'maya' || rawChannel === 'qrph' || rawChannel === 'bank_transfer' || rawChannel === 'online_card'
        ? rawChannel
        : 'gcash';
    const rawStatus = String(r.status || 'pending');
    const status: PaymentTerminalStatus =
      rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';
    return {
      id: String(r.id),
      referenceCode: String(r.reference_code || ''),
      userId: String(r.user_id || ''),
      userName: String(r.user_name || 'Member'),
      userPhone: typeof r.user_phone === 'string' && r.user_phone ? r.user_phone : undefined,
      purpose,
      channel,
      amountPhp: Number(r.amount_php || 0),
      feePhp: Number(r.fee_php || 0),
      totalPhp: Number(r.total_php || 0),
      choyCoinsPreview: Number(r.choy_coins_preview || 0),
      payerReference: String(r.payer_reference || ''),
      customerName: String(r.customer_name || ''),
      customerContact: String(r.customer_contact || ''),
      note: String(r.note || ''),
      receiptImageUrl: typeof r.receipt_image_url === 'string' && r.receipt_image_url ? r.receipt_image_url : undefined,
      checkoutUrl: typeof r.checkout_url === 'string' && r.checkout_url ? r.checkout_url : undefined,
      status,
      reviewedBy: typeof r.reviewed_by === 'string' && r.reviewed_by ? r.reviewed_by : undefined,
      reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)).toISOString() : undefined,
      creditedAt: r.credited_at ? new Date(String(r.credited_at)).toISOString() : undefined,
      rejectionReason: typeof r.rejection_reason === 'string' && r.rejection_reason ? r.rejection_reason : undefined,
      createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString(),
    };
  }

  public async listPaymentTerminalTransactions(): Promise<StoredPaymentTerminalTx[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        'SELECT * FROM app_payment_terminal_transactions ORDER BY created_at DESC LIMIT 300'
      );
      return res.rows.map((r) => this.mapPaymentTerminalTxRow(r as Record<string, unknown>));
    }
    return [...this.memPaymentTerminalTxs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async getPaymentTerminalTransactionById(id: string): Promise<StoredPaymentTerminalTx | null> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query(
        'SELECT * FROM app_payment_terminal_transactions WHERE id = $1 LIMIT 1',
        [id]
      );
      if (!res.rows[0]) return null;
      return this.mapPaymentTerminalTxRow(res.rows[0] as Record<string, unknown>);
    }
    return this.memPaymentTerminalTxs.find((t) => t.id === id) || null;
  }

  public async savePaymentTerminalTransaction(tx: StoredPaymentTerminalTx): Promise<StoredPaymentTerminalTx> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_payment_terminal_transactions (
           id, reference_code, user_id, user_name, user_phone, purpose, channel,
           amount_php, fee_php, total_php, choy_coins_preview, payer_reference,
           customer_name, customer_contact, note, receipt_image_url, checkout_url,
           status, reviewed_by, reviewed_at, credited_at, rejection_reason, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, $15, $16, $17,
           $18, $19, $20::timestamptz, $21::timestamptz, $22, $23::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           payer_reference = EXCLUDED.payer_reference,
           receipt_image_url = EXCLUDED.receipt_image_url,
           checkout_url = EXCLUDED.checkout_url,
           status = EXCLUDED.status,
           reviewed_by = EXCLUDED.reviewed_by,
           reviewed_at = EXCLUDED.reviewed_at,
           credited_at = EXCLUDED.credited_at,
           rejection_reason = EXCLUDED.rejection_reason`,
        [
          tx.id,
          tx.referenceCode,
          tx.userId,
          tx.userName,
          tx.userPhone || null,
          tx.purpose,
          tx.channel,
          tx.amountPhp,
          tx.feePhp,
          tx.totalPhp,
          tx.choyCoinsPreview,
          tx.payerReference,
          tx.customerName,
          tx.customerContact,
          tx.note,
          tx.receiptImageUrl || null,
          tx.checkoutUrl || null,
          tx.status,
          tx.reviewedBy || null,
          tx.reviewedAt || null,
          tx.creditedAt || null,
          tx.rejectionReason || null,
          tx.createdAt,
        ]
      );
      return tx;
    }
    const idx = this.memPaymentTerminalTxs.findIndex((item) => item.id === tx.id);
    if (idx >= 0) {
      this.memPaymentTerminalTxs[idx] = tx;
    } else {
      this.memPaymentTerminalTxs.unshift(tx);
      if (this.memPaymentTerminalTxs.length > 300) {
        this.memPaymentTerminalTxs = this.memPaymentTerminalTxs.slice(0, 300);
      }
    }
    await this.persistMemory();
    return tx;
  }

  // ==========================================================================
  // PRIVATE KYC ASSETS, ADMIN ANALYTICS LOGS, BLOG, VISITORS & SYSTEM CLEANER
  // ==========================================================================
  public async updateUserPrivateKyc(
    userId: string,
    patch: {
      realNamePlaintext?: string;
      privateValidIdAssetId?: string;
      privateRealAvatarAssetId?: string;
      privacyConsentAccepted?: boolean;
    }
  ): Promise<StoredUser | null> {
    await this.ready();
    const encryptedRealName = patch.realNamePlaintext ? encryptSensitiveField(patch.realNamePlaintext) : undefined;
    const now = new Date().toISOString();
    if (this.usePostgres && this.pool) {
      const existingRes = await this.pool.query('SELECT * FROM app_users WHERE id = $1 LIMIT 1', [userId]);
      if (!existingRes.rows[0]) return null;
      const current = this.mapUserRow(existingRes.rows[0] as Record<string, unknown>);
      const nextEnc = encryptedRealName || current.encryptedRealName || null;
      const nextMeta = {
        privateValidIdAssetId: patch.privateValidIdAssetId || current.privateValidIdAssetId,
        privateRealAvatarAssetId: patch.privateRealAvatarAssetId || current.privateRealAvatarAssetId,
        privacyConsentAccepted: patch.privacyConsentAccepted ?? current.privacyConsentAccepted ?? false,
        privacyConsentAt: patch.privacyConsentAccepted ? now : current.privacyConsentAt,
      };
      const updated = await this.pool.query(
        'UPDATE app_users SET encrypted_real_name = $1, private_kyc_meta = $2::jsonb, updated_at = NOW() WHERE id = $3 RETURNING *',
        [nextEnc, JSON.stringify(nextMeta), userId]
      );
      return updated.rows[0] ? this.mapUserRow(updated.rows[0] as Record<string, unknown>) : null;
    }
    const found = this.memUsers.find((u) => u.id === userId);
    if (!found) return null;
    if (encryptedRealName) found.encryptedRealName = encryptedRealName;
    if (patch.privateValidIdAssetId) found.privateValidIdAssetId = patch.privateValidIdAssetId;
    if (patch.privateRealAvatarAssetId) found.privateRealAvatarAssetId = patch.privateRealAvatarAssetId;
    if (patch.privacyConsentAccepted !== undefined) {
      found.privacyConsentAccepted = patch.privacyConsentAccepted;
      if (patch.privacyConsentAccepted) found.privacyConsentAt = now;
    }
    found.updatedAt = now;
    await this.persistMemory();
    return found;
  }

  public async listPrivateKycAssets(): Promise<StoredPrivateKycAsset[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['private_kyc_assets']);
      return Array.isArray(res.rows[0]?.data) ? (res.rows[0].data as StoredPrivateKycAsset[]) : [];
    }
    return [...this.memPrivateKycAssets];
  }

  public async savePrivateKycAsset(asset: StoredPrivateKycAsset): Promise<StoredPrivateKycAsset> {
    await this.ready();
    const existing = await this.listPrivateKycAssets();
    const next = [asset, ...existing.filter((a) => a.id !== asset.id)].slice(0, 5000);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['private_kyc_assets', JSON.stringify(next)]
      );
      return asset;
    }
    this.memPrivateKycAssets = next;
    await this.persistMemory();
    return asset;
  }

  public async getPrivateKycAssetById(assetId: string): Promise<StoredPrivateKycAsset | null> {
    const assets = await this.listPrivateKycAssets();
    return assets.find((a) => a.id === assetId) || null;
  }

  public async bindPrivateKycAssetOwner(assetId: string, ownerUserId: string): Promise<void> {
    await this.ready();
    const existing = await this.listPrivateKycAssets();
    let changed = false;
    const next = existing.map((a) => {
      if (a.id === assetId && !a.ownerUserId) {
        changed = true;
        return { ...a, ownerUserId };
      }
      return a;
    });
    if (!changed) return;
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['private_kyc_assets', JSON.stringify(next)]
      );
      return;
    }
    this.memPrivateKycAssets = next;
    await this.persistMemory();
  }

  public async listActivityLogs(): Promise<StoredSystemActivityLog[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['system_activity_logs']);
      return Array.isArray(res.rows[0]?.data) ? (res.rows[0].data as StoredSystemActivityLog[]) : [];
    }
    return [...this.memActivityLogs];
  }

  public async appendActivityLog(entry: Omit<StoredSystemActivityLog, 'id' | 'createdAt'>): Promise<StoredSystemActivityLog> {
    await this.ready();
    const item: StoredSystemActivityLog = {
      id: `act_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      category: entry.category,
      actor: entry.actor.slice(0, 80),
      message: entry.message.slice(0, 240),
      createdAt: new Date().toISOString(),
    };
    const existing = await this.listActivityLogs();
    const next = [item, ...existing].slice(0, 200);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['system_activity_logs', JSON.stringify(next)]
      );
      return item;
    }
    this.memActivityLogs = next;
    await this.persistMemory();
    return item;
  }

  public async listErrorLogs(): Promise<StoredSystemErrorLog[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['system_error_logs']);
      return Array.isArray(res.rows[0]?.data) ? (res.rows[0].data as StoredSystemErrorLog[]) : [];
    }
    return [...this.memErrorLogs];
  }

  public async appendErrorLog(entry: Omit<StoredSystemErrorLog, 'id' | 'createdAt' | 'resolved'>): Promise<StoredSystemErrorLog> {
    await this.ready();
    const item: StoredSystemErrorLog = {
      id: `err_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      source: entry.source,
      severity: entry.severity,
      message: entry.message.slice(0, 300),
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    const existing = await this.listErrorLogs();
    const next = [item, ...existing].slice(0, 150);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['system_error_logs', JSON.stringify(next)]
      );
      return item;
    }
    this.memErrorLogs = next;
    await this.persistMemory();
    return item;
  }

  public async resolveErrorLog(id: string): Promise<StoredSystemErrorLog[]> {
    await this.ready();
    const existing = await this.listErrorLogs();
    const next = existing.map((e) => (e.id === id ? { ...e, resolved: true } : e));
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['system_error_logs', JSON.stringify(next)]
      );
      return next;
    }
    this.memErrorLogs = next;
    await this.persistMemory();
    return next;
  }

  public async getVisitorStats(): Promise<StoredVisitorStats> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['visitor_stats']);
      if (res.rows[0]?.data && typeof res.rows[0].data === 'object') {
        return res.rows[0].data as StoredVisitorStats;
      }
    }
    return { ...this.memVisitorStats, dailyCounts: { ...this.memVisitorStats.dailyCounts } };
  }

  public async recordSiteVisit(): Promise<StoredVisitorStats> {
    await this.ready();
    const current = await this.getVisitorStats();
    const today = new Date().toISOString().slice(0, 10);
    const nextDaily: Record<string, number> = { ...(current.dailyCounts || {}) };
    nextDaily[today] = (Number(nextDaily[today]) || 0) + 1;
    // Keep last 45 days of daily keys
    const keys = Object.keys(nextDaily).sort();
    while (keys.length > 45) {
      const oldest = keys.shift();
      if (oldest) delete nextDaily[oldest];
    }
    const updated: StoredVisitorStats = {
      totalVisits: (Number(current.totalVisits) || 0) + 1,
      dailyCounts: nextDaily,
      lastVisitAt: new Date().toISOString(),
    };
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['visitor_stats', JSON.stringify(updated)]
      );
      return updated;
    }
    this.memVisitorStats = updated;
    await this.persistMemory();
    return updated;
  }

  public async listBlogPosts(): Promise<StoredBlogPost[]> {
    await this.ready();
    const legacyDefaultSlugs = new Set([
      'five-ways-to-keep-local-food-deliveries-piping-hot',
      'inside-family-owned-neighborhood-kitchens',
      'a-day-with-verified-community-delivery-riders',
      'why-private-id-verification-protects-customers-and-riders',
      'smart-group-ordering-tips-for-office-lunches',
      'sustainable-packaging-choices-for-daily-takeout',
    ]);
    const upgradeLegacyDefaults = (posts: StoredBlogPost[]): { changed: boolean; next: StoredBlogPost[] } => {
      const hasLegacy = posts.some((p) => legacyDefaultSlugs.has(p.slug));
      if (!hasLegacy) return { changed: false, next: posts };
      const customPosts = posts.filter((p) => !legacyDefaultSlugs.has(p.slug));
      return { changed: true, next: [...customPosts, ...DEFAULT_BLOG_POSTS] };
    };

    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['public_blog_posts']);
      if (Array.isArray(res.rows[0]?.data) && res.rows[0].data.length > 0) {
        const existing = res.rows[0].data as StoredBlogPost[];
        const upgraded = upgradeLegacyDefaults(existing);
        if (upgraded.changed) {
          await this.saveBlogPosts(upgraded.next);
        }
        return upgraded.next;
      }
      await this.saveBlogPosts(DEFAULT_BLOG_POSTS);
      return [...DEFAULT_BLOG_POSTS];
    }
    if (this.memBlogPosts.length === 0) {
      this.memBlogPosts = [...DEFAULT_BLOG_POSTS];
      return [...this.memBlogPosts];
    }
    const upgradedMem = upgradeLegacyDefaults(this.memBlogPosts);
    if (upgradedMem.changed) {
      this.memBlogPosts = upgradedMem.next;
      await this.persistMemory();
    }
    return [...this.memBlogPosts];
  }

  public async saveBlogPosts(posts: StoredBlogPost[]): Promise<StoredBlogPost[]> {
    await this.ready();
    const cleaned = posts.slice(0, 100);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['public_blog_posts', JSON.stringify(cleaned)]
      );
      return cleaned;
    }
    this.memBlogPosts = cleaned;
    await this.persistMemory();
    return cleaned;
  }

  public async saveContactMessage(msg: Omit<StoredContactMessage, 'id' | 'createdAt'>): Promise<StoredContactMessage> {
    await this.ready();
    const saved: StoredContactMessage = {
      id: `ct_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      name: msg.name.slice(0, 100),
      email: msg.email.slice(0, 140),
      subject: msg.subject.slice(0, 140),
      message: msg.message.slice(0, 1500),
      createdAt: new Date().toISOString(),
    };
    const existing = await this.listContactMessages();
    const next = [saved, ...existing].slice(0, 200);
    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['public_contact_messages', JSON.stringify(next)]
      );
      return saved;
    }
    this.memContactMessages = next;
    await this.persistMemory();
    return saved;
  }

  public async listContactMessages(): Promise<StoredContactMessage[]> {
    await this.ready();
    if (this.usePostgres && this.pool) {
      const res = await this.pool.query('SELECT data FROM app_settings WHERE id = $1', ['public_contact_messages']);
      return Array.isArray(res.rows[0]?.data) ? (res.rows[0].data as StoredContactMessage[]) : [];
    }
    return [...this.memContactMessages];
  }

  public async runSystemCleaner(): Promise<{
    purgedErrorLogs: number;
    purgedActivityLogs: number;
    purgedAbandonedCarts: number;
    purgedExpiredSessions: number;
    cleanedAt: string;
  }> {
    await this.ready();
    const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const allErrors = await this.listErrorLogs();
    const keptErrors = allErrors.filter((e) => {
      const ts = Date.parse(e.createdAt) || Date.now();
      return !e.resolved && ts >= cutoffMs;
    });
    const purgedErrorLogs = allErrors.length - keptErrors.length;

    const allActivities = await this.listActivityLogs();
    const keptActivities = allActivities.filter((a) => (Date.parse(a.createdAt) || Date.now()) >= cutoffMs);
    const purgedActivityLogs = allActivities.length - keptActivities.length;

    const purgedAbandonedCarts = this.memAbandonedCarts.length;
    this.memAbandonedCarts = [];

    if (this.usePostgres && this.pool) {
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['system_error_logs', JSON.stringify(keptErrors)]
      );
      await this.pool.query(
        `INSERT INTO app_settings (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['system_activity_logs', JSON.stringify(keptActivities)]
      );
    } else {
      this.memErrorLogs = keptErrors;
      this.memActivityLogs = keptActivities;
      await this.persistMemory();
    }

    const cleanedAt = new Date().toISOString();
    return {
      purgedErrorLogs,
      purgedActivityLogs,
      purgedAbandonedCarts,
      purgedExpiredSessions: 0,
      cleanedAt,
    };
  }
}


