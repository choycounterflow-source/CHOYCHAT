import React, { useCallback, useState } from 'react';
import { SemaphoreOtpBox } from './SemaphoreOtpBox';
import {
  Award,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Copy,
  CreditCard,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  FileCheck2,
  Globe,
  Home,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Video,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  Utensils,
  ShoppingBasket,
  Pill,
  Tv,
  Search,
  Trash2,
  Edit2,
  Store,
  Tag,
  Package,
  X,
  TrendingUp,
  Upload,
  Truck,
  MapPin,
  Phone,
  Settings2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { ChatGroupItem, ActiveGroupCallItem } from './GroupChatModals';
import {
  DEFAULT_CLIENT_CHOY_PROGRAMS_CONFIG,
  type AdminChoySetupTab,
  type ChoyProgramsConfig,
} from './AdminChoySetupPanel';

export interface UserWalletTx {
  id: string;
  walletType: 'wallet' | 'choy_wallet';
  kind: 'topup' | 'withdraw' | 'transfer_out' | 'transfer_in' | 'reward' | 'convert' | 'subscription' | 'choy_pro';
  amount: number;
  note: string;
  counterparty?: string;
  createdAt: string;
}

export interface UserMediaFolderItem {
  id: string;
  name: string;
  kind: 'photo' | 'video' | 'music' | 'file';
  url: string;
  createdAt: string;
}

export interface UserMediaFolder {
  id: string;
  name: string;
  items: UserMediaFolderItem[];
  createdAt: string;
}

export interface UserWithdrawalRequest {
  id: string;
  receiverName: string;
  walletType: string;
  accountNumber?: string;
  withdrawalNumber?: string;
  walletBalanceBefore: number;
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: string;
}

export interface UserDashboardData {
  userId: string;
  publicShowName: boolean;
  coverPhotoUrl?: string;
  mediaFolders?: UserMediaFolder[];
  hasWithdrawalPin?: boolean;
  withdrawalRequests?: UserWithdrawalRequest[];
  walletBalance: number;
  choyWalletBalance: number;
  choyProActive: boolean;
  choyProActivatedAt?: string;
  subscriptionPlan: 'free' | 'choy_pro_monthly' | 'choy_pro_annual' | 'vip_supporter';
  subscriptionStatus: 'active' | 'trialing' | 'inactive' | 'cancelled';
  subscriptionAutoRenew: boolean;
  subscriptionRenewAt?: string;
  subscriptionTrialEndsAt?: string;
  subscriptionPaymentMethod?: 'wallet' | 'choy_wallet' | 'stripe_card' | 'gcash';
  subscriptionPaymentLabel?: string;
  dtrSubscription?: Record<string, unknown>;
  dtrEmployees?: Array<Record<string, unknown>>;
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
  kycStatus?: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  kycSubmittedAt?: string;
  kycReviewedBy?: string;
  kycReviewedAt?: string;
  kycRejectionReason?: string;
  transactions: UserWalletTx[];
  updatedAt: string;
}

export interface MarketplaceItem {
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

export type UserDashboardTabId =
  | 'dashboard'
  | 'profile'
  | 'user_created_name'
  | 'messages'
  | 'feed'
  | 'groupchat'
  | 'wallet'
  | 'choy_pro'
  | 'choy_wallet'
  | 'subscription'
  | 'rules'
  | 'acknowledgment'
  | 'marketplace';

export interface DashboardUserInfo {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'member';
  status: 'pending' | 'approved';
  avatar?: string;
  newsfeed?: string;
}

export interface DashboardMemberCandidate {
  id: string;
  name: string;
  role?: 'admin' | 'member';
  avatar?: string;
}

export interface DashboardMessagePreview {
  id: string;
  sender: string;
  receiver: string;
  text?: string;
  time: string;
  mediaType?: string;
}

interface UserDashboardSectionProps {
  section: UserDashboardTabId;
  currentUser: DashboardUserInfo;
  avatarUrl: string;
  isCustomAvatar: boolean;
  dashboard: UserDashboardData;
  isBusy: boolean;
  actionError: string;
  actionNotice: string;
  newsfeedLabel: string;
  membersList: DashboardMemberCandidate[];
  onlineUsers: string[];
  chatGroups: ChatGroupItem[];
  activeGroupCalls: ActiveGroupCallItem[];
  messages: DashboardMessagePreview[];
  postsCount: number;
  unreadMessagesCount: number;
  onNavigate: (tab: UserDashboardTabId) => void;
  onDashboardAction: (payload: Record<string, unknown>) => Promise<boolean>;
  onUpdateCreatedName: (newName: string) => Promise<{ ok: boolean; error?: string }>;
  onSendAdminCopyToAdminChat: (copyText: string) => void;
  onOpenChatRoom: (roomId: string) => void;
  onOpenCreateGroup: () => void;
  onOpenGroupMembers: (groupId: string) => void;
  onJoinOrStartGroupCall: (groupId: string) => void;
  onOpenPrivacyModal?: () => void;
  onDashboardUpdated?: (next: UserDashboardData) => void;
  choyProgramsConfig?: ChoyProgramsConfig;
  onOpenAdminChoySetup?: (tab: AdminChoySetupTab) => void;
  authToken?: string | null;
}

export function buildAdminProfileCopyText(
  user: DashboardUserInfo,
  dashboard: UserDashboardData,
  newsfeedLabel: string
): string {
  const handle = `@${user.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'member'}`;
  const lines = [
    '=== CHOY CHAT PROFILE (ADMIN COPY) ===',
    `User ID: ${user.id}`,
    `Created Name (Public Show): ${user.name} (${handle})`,
    `Public Visibility: ${dashboard.publicShowName ? 'PUBLIC SHOW ON' : 'HIDDEN'}`,
    `Phone: ${user.phone}`,
    `Role: ${user.role.toUpperCase()}`,
    `Status: ${user.status.toUpperCase()}`,
  ];
  if (user.role === 'admin') {
    lines.push(`Newsfeed Channel: ${newsfeedLabel}`);
  }
  lines.push(
    `Choy Pro: ${dashboard.choyProActive ? 'ACTIVE' : 'STANDARD'}`,
    `Subscription: ${formatPlanLabel(dashboard.subscriptionPlan)} (${dashboard.subscriptionStatus.toUpperCase()})`,
    `Wallet Balance: PHP ${dashboard.walletBalance.toFixed(2)}`,
    `Choy Wallet: ${dashboard.choyWalletBalance.toFixed(2)} CHOY`,
    `Rules Accepted: ${dashboard.rulesAcceptedAt ? new Date(dashboard.rulesAcceptedAt).toLocaleString() : 'Pending'}`,
    `Acknowledgment: ${
      dashboard.acknowledgmentSignedAt
        ? `${dashboard.acknowledgmentSignedName || user.name} (${new Date(dashboard.acknowledgmentSignedAt).toLocaleString()})`
        : 'Pending'
    }`,
    `Copied At: ${new Date().toLocaleString()}`
  );
  return lines.join('\n');
}

export function formatPlanLabel(plan: UserDashboardData['subscriptionPlan']): string {
  if (plan === 'choy_pro_monthly') return 'Choy Pro Monthly';
  if (plan === 'choy_pro_annual') return 'Choy Pro Annual';
  if (plan === 'vip_supporter') return 'VIP Supporter';
  return 'Free Starter';
}

export const ProfileAdminCopyCard: React.FC<{
  currentUser: DashboardUserInfo;
  dashboard: UserDashboardData;
  newsfeedLabel: string;
  onSendToAdminChat: (text: string) => void;
}> = ({ currentUser, dashboard, newsfeedLabel, onSendToAdminChat }) => {
  const [copied, setCopied] = useState(false);
  const copyText = buildAdminProfileCopyText(currentUser, dashboard, newsfeedLabel);

  const handleCopy = () => {
    navigator.clipboard?.writeText(copyText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white dark:bg-emerald-900/60 border border-indigo-200 dark:border-indigo-700/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-200 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-white">
              Profile (Admin Copy)
            </h3>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Verified account summary for Admin verification or quick record copy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Admin Copy'}</span>
          </button>
          <button
            type="button"
            onClick={() => onSendToAdminChat(copyText)}
            className="px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to Choy Admin</span>
          </button>
        </div>
      </div>

      <pre className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/90 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono text-emerald-950 dark:text-emerald-100 whitespace-pre-wrap break-words leading-relaxed">
        {copyText}
      </pre>
    </div>
  );
};

export const UserDashboardPanels: React.FC<UserDashboardSectionProps> = ({
  section,
  currentUser,
  avatarUrl,
  isCustomAvatar,
  dashboard,
  isBusy,
  actionError,
  actionNotice,
  newsfeedLabel,
  membersList,
  onlineUsers,
  chatGroups,
  activeGroupCalls,
  messages,
  postsCount,
  unreadMessagesCount,
  onNavigate,
  onDashboardAction,
  onUpdateCreatedName,
  onSendAdminCopyToAdminChat,
  onOpenChatRoom,
  onOpenCreateGroup,
  onOpenGroupMembers,
  onJoinOrStartGroupCall,
  onDashboardUpdated,
  choyProgramsConfig,
  onOpenAdminChoySetup,
  authToken,
}) => {
  const [nameInput, setNameInput] = useState(currentUser.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [walletAmount, setWalletAmount] = useState('100');
  const [walletNote, setWalletNote] = useState('');
  const [withdrawReceiverName, setWithdrawReceiverName] = useState(currentUser.name);
  const [withdrawWalletType, setWithdrawWalletType] = useState('GCash');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState(currentUser.phone || '');
  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [newWithdrawalPin, setNewWithdrawalPin] = useState('');
  const [confirmWithdrawalPin, setConfirmWithdrawalPin] = useState('');
  const [showChangeWithdrawPin, setShowChangeWithdrawPin] = useState(false);

  const [withdrawOtpToken, setWithdrawOtpToken] = useState<string | null>(null);
  const [withdrawOtpRequired, setWithdrawOtpRequired] = useState(false);
  const [withdrawOtpReset, setWithdrawOtpReset] = useState(0);

  const [subOtpToken, setSubOtpToken] = useState<string | null>(null);
  const [subOtpRequired, setSubOtpRequired] = useState(false);
  const [subOtpReset, setSubOtpReset] = useState(0);

  const handleWithdrawOtpStatus = useCallback(
    ({ configured, verifiedToken }: { configured: boolean; verifiedToken: string | null }) => {
      setWithdrawOtpRequired(configured);
      setWithdrawOtpToken(verifiedToken);
    },
    []
  );

  const handleSubOtpStatus = useCallback(
    ({ configured, verifiedToken }: { configured: boolean; verifiedToken: string | null }) => {
      setSubOtpRequired(configured);
      setSubOtpToken(verifiedToken);
    },
    []
  );

  const [trialPlan, setTrialPlan] = useState<'choy_pro_monthly' | 'choy_pro_annual' | 'vip_supporter'>('choy_pro_monthly');
  const [trialPayMethod, setTrialPayMethod] = useState<'stripe_card' | 'gcash'>('stripe_card');
  const [trialCardHolder, setTrialCardHolder] = useState(currentUser.name);
  const [trialCardLast4, setTrialCardLast4] = useState('');
  const [trialGcashNum, setTrialGcashNum] = useState(currentUser.phone || '');

  const [transferRecipientId, setTransferRecipientId] = useState('');
  const [transferAmount, setTransferAmount] = useState('50');
  const [transferNote, setTransferNote] = useState('');

  const [convertAmount, setConvertAmount] = useState('50');
  const [choyTransferRecipientId, setChoyTransferRecipientId] = useState('');
  const [choyTransferAmount, setChoyTransferAmount] = useState('25');

  const [signNameDraft, setSignNameDraft] = useState(dashboard.acknowledgmentSignedName || currentUser.name);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const [marketItems, setMarketItems] = React.useState<MarketplaceItem[]>([]);
  const [marketLoading, setMarketLoading] = React.useState(false);
  const [marketCategoryFilter, setMarketCategoryFilter] = React.useState<'all' | 'food' | 'groceries' | 'medicines' | 'appliances'>('all');
  const [marketSearchQuery, setMarketSearchQuery] = React.useState('');
  const [isEditItemModalOpen, setIsEditItemModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<Partial<MarketplaceItem> | null>(null);
  const [buyingItem, setBuyingItem] = React.useState<MarketplaceItem | null>(null);
  const [buyPaymentMethod, setBuyPaymentMethod] = React.useState<'wallet' | 'choy_wallet'>('wallet');
  const [buyQuantity, setBuyQuantity] = React.useState(1);
  const [marketNotice, setMarketNotice] = React.useState<string | null>(null);

  const [cartItems, setCartItems] = React.useState<Array<{ item: MarketplaceItem; quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const [cartPaymentMethod, setCartPaymentMethod] = React.useState<'wallet' | 'choy_wallet'>('wallet');
  const [deliveryDistanceKm, setDeliveryDistanceKm] = React.useState<number>(2);
  const [customerName, setCustomerName] = React.useState(currentUser.name);
  const [customerPhone, setCustomerPhone] = React.useState(currentUser.phone || '');
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [deliveryNotes, setDeliveryNotes] = React.useState('');
  const [marketplaceOrders, setMarketplaceOrders] = React.useState<any[]>([]);
  const [uploadingItemImage, setUploadingItemImage] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);
  const [promoCodeInput, setPromoCodeInput] = React.useState('');

  const programsCfg = choyProgramsConfig || DEFAULT_CLIENT_CHOY_PROGRAMS_CONFIG;
  const activePromos = programsCfg.promos.filter((p) => p.active);
  const subscriptionPromos = activePromos.filter((p) => p.appliesTo === 'all' || p.appliesTo === 'subscription');
  const marketplacePromos = activePromos.filter((p) => p.appliesTo === 'all' || p.appliesTo === 'marketplace');

  const deliveryFee = deliveryDistanceKm <= 2 ? 25 : deliveryDistanceKm <= 5 ? 40 : deliveryDistanceKm <= 8 ? 65 : 90;
  const itemsSubtotal = cartItems.reduce((acc, ci) => acc + (ci.item.price * ci.quantity), 0);
  const totalCartAmount = Math.round((itemsSubtotal + deliveryFee) * 100) / 100;

  React.useEffect(() => {
    if (section === 'marketplace') {
      void fetchMarketplaceItems();
      void fetchMarketplaceOrders();
    }
  }, [section]);

  const fetchMarketplaceOrders = async () => {
    try {
      const res = await fetch('/api/marketplace/orders', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.orders)) {
        setMarketplaceOrders(data.orders);
      }
    } catch {
      // ignore
    }
  };

  const handleAddToCart = (item: MarketplaceItem) => {
    setCartItems(prev => {
      const existing = prev.find(ci => ci.item.id === item.id);
      if (existing) {
        return prev.map(ci => ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      return [...prev, { item, quantity: 1 }];
    });
    setMarketNotice(`Added ${item.title} to shopping cart.`);
  };

  const handleUpdateCartQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems(prev => prev.filter(ci => ci.item.id !== itemId));
    } else {
      setCartItems(prev => prev.map(ci => ci.item.id === itemId ? { ...ci, quantity: qty } : ci));
    }
  };

  const canPlaceOrders = currentUser.role === 'admin' || dashboard.kycStatus === 'approved';

  const handleCartCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cartItems.length === 0) return;
    setCheckoutError(null);
    if (!canPlaceOrders) {
      setCheckoutError(
        dashboard.kycStatus === 'pending'
          ? 'Your Profile Verification is waiting for Admin approval. You can place orders once approved.'
          : 'Please complete your Profile Verification (Complete Name, Address, Age, Sex & 1 Valid ID) in Profile and wait for Admin approval before ordering.'
      );
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      setCheckoutError('Please fill in Full Name, Contact Number, and Delivery Address.');
      return;
    }
    try {
      setMarketLoading(true);
      const payloadItems = cartItems.map(ci => ({ itemId: ci.item.id, quantity: ci.quantity }));
      const res = await fetch('/api/marketplace/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: payloadItems,
          paymentMethod: cartPaymentMethod,
          deliveryDistanceKm,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryNotes: deliveryNotes.trim(),
          promoCode: promoCodeInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.items)) setMarketItems(data.items);
        if (Array.isArray(data.orders)) setMarketplaceOrders(data.orders);
        if (data.userDashboard) onDashboardUpdated?.(data.userDashboard);
        setCartItems([]);
        setIsCartOpen(false);
        setCheckoutError(null);
        setMarketNotice('Cart checkout completed successfully!');
      } else {
        setCheckoutError(data.error || 'Checkout failed.');
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setMarketLoading(false);
    }
  };

  const handleUploadMarketplaceImage = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      setMarketNotice('Please select a valid image file.');
      return;
    }
    try {
      setUploadingItemImage(true);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-Media-Folder': 'marketplace',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.uploaded && typeof data?.url === 'string') {
        setEditingItem((prev) => (prev ? { ...prev, imageUrl: data.url } : prev));
        setMarketNotice('Photo uploaded to Cloudflare R2.');
        return;
      }
      // Fallback to local Data URL when cloud storage is not configured locally
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });
      setEditingItem((prev) => (prev ? { ...prev, imageUrl: dataUrl } : prev));
      setMarketNotice('Photo attached from device.');
    } catch (err: unknown) {
      setMarketNotice(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingItemImage(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch('/api/marketplace/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, status }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.orders)) {
        setMarketplaceOrders(data.orders);
        setMarketNotice(`Order #${orderId.slice(-6)} status updated to ${status.replace(/_/g, ' ')}.`);
      } else {
        setMarketNotice(data.error || 'Failed to update order status.');
      }
    } catch (err: unknown) {
      setMarketNotice(err instanceof Error ? err.message : 'Failed to update order status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const orderChartData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const spending: Record<string, number> = {};
    for (const ord of marketplaceOrders) {
      const dateStr = ord.createdAt ? ord.createdAt.slice(0, 10) : 'Recent';
      counts[dateStr] = (counts[dateStr] || 0) + 1;
      spending[dateStr] = (spending[dateStr] || 0) + Number(ord.totalAmount || 0);
    }
    const keys = Object.keys(counts).sort();
    if (keys.length === 0) {
      return [{ date: 'Today', orders: 0, spending: 0 }];
    }
    return keys.map(k => ({
      date: k,
      orders: counts[k],
      spending: Math.round(spending[k] * 100) / 100,
    }));
  }, [marketplaceOrders]);

  const fetchMarketplaceItems = async () => {
    try {
      setMarketLoading(true);
      const res = await fetch('/api/marketplace/items', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setMarketItems(data.items);
      }
    } catch {
      // ignore
    } finally {
      setMarketLoading(false);
    }
  };

  const handleSaveMarketplaceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.title) return;
    try {
      setMarketLoading(true);
      const res = await fetch('/api/marketplace/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'save',
          id: editingItem.id,
          category: editingItem.category || 'food',
          title: editingItem.title,
          description: editingItem.description || '',
          price: Number(editingItem.price) || 0,
          imageUrl: editingItem.imageUrl || '',
          stock: Number(editingItem.stock) || 100,
          sellerName: editingItem.sellerName || 'Choy Store',
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setMarketItems(data.items);
        setIsEditItemModalOpen(false);
        setEditingItem(null);
        setMarketNotice('Marketplace item saved successfully!');
      } else {
        setMarketNotice(data.error || 'Failed to save item');
      }
    } catch (err: unknown) {
      setMarketNotice(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setMarketLoading(false);
    }
  };

  const handleDeleteMarketplaceItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      setMarketLoading(true);
      const res = await fetch('/api/marketplace/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete', id: itemId }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setMarketItems(data.items);
        setMarketNotice('Item deleted successfully.');
      }
    } catch {
      // ignore
    } finally {
      setMarketLoading(false);
    }
  };

  const handleBuyMarketplaceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyingItem) return;
    setCheckoutError(null);
    if (!canPlaceOrders) {
      setCheckoutError(
        dashboard.kycStatus === 'pending'
          ? 'Your Profile Verification is waiting for Admin approval. You can place orders once approved.'
          : 'Please complete your Profile Verification (Complete Name, Address, Age, Sex & 1 Valid ID) in Profile and wait for Admin approval before ordering.'
      );
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      setCheckoutError('Please fill in Full Name, Contact Number, and Delivery Address.');
      return;
    }
    try {
      setMarketLoading(true);
      const res = await fetch('/api/marketplace/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'buy',
          itemId: buyingItem.id,
          paymentMethod: buyPaymentMethod,
          quantity: buyQuantity,
          deliveryDistanceKm,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryNotes: deliveryNotes.trim(),
          promoCode: promoCodeInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.items)) setMarketItems(data.items);
        if (Array.isArray(data.orders)) setMarketplaceOrders(data.orders);
        if (data.userDashboard) onDashboardUpdated?.(data.userDashboard);
        setBuyingItem(null);
        setBuyQuantity(1);
        setCheckoutError(null);
        setMarketNotice(`Successfully purchased ${buyQuantity}x ${buyingItem.title}!`);
      } else {
        setCheckoutError(data.error || 'Failed to complete purchase.');
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setMarketLoading(false);
    }
  };

  const filteredMarketItems = marketItems.filter((i) => {
    const matchCat = marketCategoryFilter === 'all' || i.category === marketCategoryFilter;
    const matchSearch =
      !marketSearchQuery.trim() ||
      i.title.toLowerCase().includes(marketSearchQuery.toLowerCase()) ||
      i.description.toLowerCase().includes(marketSearchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const otherMembers = membersList.filter((m) => m.id !== currentUser.id);
  const myHandle = `@${currentUser.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'member'}`;

  const renderFeedbackBanner = () => (
    <>
      {actionError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200"
        >
          {actionError}
        </div>
      )}
      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/70 border border-emerald-400/70 text-xs font-bold text-emerald-950 dark:text-emerald-100">
          {actionNotice}
        </div>
      )}
    </>
  );

  const renderSectionBackBar = (title: string, subtitle: string, icon: React.ReactNode) => (
    <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-emerald-950 dark:text-white truncate">{title}</h2>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 truncate">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  // Dashboard hub removed — all tools live directly in the sidebar
  if (section === 'dashboard') {
    return null;
  }

  // 2. CREATED NAME (PUBLIC SHOW)
  if (section === 'user_created_name') {
    const handleSaveName = async (e: React.FormEvent) => {
      e.preventDefault();
      if (nameInput.trim().length < 2) {
        setNameFeedback({ type: 'err', text: 'Created Name must be at least 2 characters.' });
        return;
      }
      setNameSaving(true);
      setNameFeedback(null);
      const res = await onUpdateCreatedName(nameInput.trim());
      setNameSaving(false);
      if (res.ok) {
        setNameFeedback({ type: 'ok', text: 'Created Name updated and synced publicly!' });
      } else {
        setNameFeedback({ type: 'err', text: res.error || 'Could not update Created Name.' });
      }
    };

    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Created Name (Public Show)',
          'Control your public display name shown across Newsfeed, People & Groupchat',
          <BadgeCheck className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}

        {/* Live Public Preview */}
        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Public Directory Visibility
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-0.5">
                {dashboard.publicShowName
                  ? 'Your Created Name is publicly visible to members in your Newsfeed and People directory.'
                  : 'Your Created Name badge is currently set to Private / Minimal Show.'}
              </p>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void onDashboardAction({
                  action: 'toggle_public_name',
                  publicShowName: !dashboard.publicShowName,
                })
              }
              className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 transition shadow-xs disabled:opacity-60 ${
                dashboard.publicShowName
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  : 'bg-slate-200 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
              }`}
            >
              {dashboard.publicShowName ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span>{dashboard.publicShowName ? 'Public Show: ON' : 'Public Show: OFF'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Live Public Card Preview
            </div>
            <div className="flex items-center gap-3">
              <img
                src={avatarUrl}
                alt={currentUser.name}
                className={`w-11 h-12 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-400 ${
                  isCustomAvatar ? 'object-cover' : 'object-contain'
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-black text-emerald-950 dark:text-white">
                    {dashboard.publicShowName ? currentUser.name : 'Choy Member'}
                  </span>
                  {dashboard.choyProActive && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black inline-flex items-center gap-0.5">
                      <Crown className="w-2.5 h-2.5" /> PRO
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 text-[9px] font-bold">
                    {dashboard.publicShowName ? 'Public Show' : 'Private'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                  {myHandle}{currentUser.role === 'admin' ? ` · ${newsfeedLabel}` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Edit Created Name Form */}
          <form onSubmit={handleSaveName} className="space-y-2.5 pt-1">
            <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200">
              Update Created Name (Public Show)
            </label>
            {nameFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs font-semibold border ${
                  nameFeedback.type === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-400 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950 border-rose-400 text-rose-700 dark:text-rose-200'
                }`}
              >
                {nameFeedback.text}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your public Created Name..."
                className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={nameSaving || nameInput.trim().length < 2}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {nameSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{nameSaving ? 'Saving...' : 'Save Public Name'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3. GROUPCHAT HUB
  if (section === 'groupchat') {
    const vipMessages = messages.filter((m) => m.receiver.trim().toLowerCase() === 'vip group');
    const lastVipMsg = vipMessages[vipMessages.length - 1];
    const vipLiveCall = activeGroupCalls.find((c) => c.roomId.trim().toLowerCase() === 'vip group');

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Groupchat Dashboard',
          'Open VIP Group, manage your custom group chats, or start a Group Video Call',
          <Users className="w-5 h-5" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
            {1 + chatGroups.length} Active Groupchat Room{chatGroups.length === 0 ? '' : 's'}
          </div>
          <button
            type="button"
            onClick={onOpenCreateGroup}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Groupchat</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* VIP Group Default Room */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-emerald-950 dark:text-white truncate">VIP Group</h3>
                    {vipLiveCall && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-black animate-pulse">
                        LIVE CALL
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    All community members · {vipMessages.length} messages
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-emerald-900 dark:text-emerald-100 bg-emerald-50/70 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800 truncate">
              {lastVipMsg
                ? `${lastVipMsg.sender}: ${lastVipMsg.text || `[${lastVipMsg.mediaType || 'media'}]`}`
                : 'No messages yet in VIP Group'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChatRoom('VIP Group')}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Groupchat</span>
              </button>
              <button
                type="button"
                onClick={() => onJoinOrStartGroupCall('VIP Group')}
                className="py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 transition"
              >
                <Video className="w-3.5 h-3.5" />
                <span>{vipLiveCall ? 'Join Call' : 'Call'}</span>
              </button>
            </div>
          </div>

          {/* Custom User Groupchats */}
          {chatGroups.map((grp) => {
            const grpMsgs = messages.filter((m) => m.receiver.trim() === grp.id);
            const lastMsg = grpMsgs[grpMsgs.length - 1];
            const liveCall = activeGroupCalls.find((c) => c.roomId === grp.id);
            return (
              <div
                key={grp.id}
                className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-black text-emerald-950 dark:text-white truncate">{grp.name}</h3>
                        {liveCall && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-black animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        {grp.memberIds.length} members · {grpMsgs.length} messages
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenGroupMembers(grp.id)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800 shrink-0"
                  >
                    Members
                  </button>
                </div>
                <p className="text-xs text-emerald-900 dark:text-emerald-100 bg-emerald-50/70 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800 truncate">
                  {lastMsg
                    ? `${lastMsg.sender}: ${lastMsg.text || `[${lastMsg.mediaType || 'media'}]`}`
                    : 'Start chatting with your group'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenChatRoom(grp.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onJoinOrStartGroupCall(grp.id)}
                    className="py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 transition"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>{liveCall ? 'Join' : 'Call'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. WALLET (CASH / PHP WALLET)
  if (section === 'wallet') {
    const walletTxs = dashboard.transactions.filter((t) => t.walletType === 'wallet');
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Wallet',
          'Manage your Cash Wallet balance, cash-in/cash-out, and send money to members',
          <Wallet className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
              Available Wallet Balance
            </div>
            <div className="text-3xl font-black font-mono tabular-nums mt-1">
              ₱{dashboard.walletBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-100/90 mt-1">
              Account: {currentUser.name} · {currentUser.phone}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('choy_wallet')}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shrink-0 shadow transition"
          >
            <Coins className="w-4 h-4" />
            <span>Open Choy Wallet ({dashboard.choyWalletBalance} CHOY)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cash In */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-white">
              Quick Cash In
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {['100', '250', '500', '1000'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setWalletAmount(amt)}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                    walletAmount === amt
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  ₱{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              value={walletAmount}
              onChange={(e) => setWalletAmount(e.target.value)}
              placeholder="Amount (PHP)"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={walletNote}
              onChange={(e) => setWalletNote(e.target.value)}
              placeholder="Optional note (e.g., GCash / Maya ref)"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void onDashboardAction({
                  action: 'wallet_topup',
                  amount: Number(walletAmount),
                  note: walletNote,
                })
              }
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Cash In ₱{walletAmount || '0'}</span>
            </button>
          </div>

          {/* Send Money to Member */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-white">
              Send Wallet to Member
            </h3>
            <select
              value={transferRecipientId}
              onChange={(e) => setTransferRecipientId(e.target.value)}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select recipient member...</option>
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === 'admin' ? 'Admin' : 'Member'})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="1"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Amount to send (PHP)"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Message or purpose..."
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={isBusy || !transferRecipientId}
              onClick={() =>
                void onDashboardAction({
                  action: 'wallet_transfer',
                  walletType: 'wallet',
                  recipientId: transferRecipientId,
                  amount: Number(transferAmount),
                  note: transferNote,
                })
              }
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Money</span>
            </button>
          </div>
        </div>

        {/* Cash Out / Withdrawal Details Form with Withdrawal PIN */}
        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 dark:border-emerald-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                <span>Cash Out / Withdrawal Request Form</span>
              </h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                Protected by your personal Withdrawal PIN. Fill out receiver &amp; wallet details accurately.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowChangeWithdrawPin((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-[11px] font-bold text-emerald-900 dark:text-emerald-100"
            >
              {dashboard.hasWithdrawalPin
                ? showChangeWithdrawPin
                  ? 'Hide PIN Setup'
                  : 'Change Withdrawal PIN'
                : 'Set Withdrawal PIN'}
            </button>
          </div>

          {(!dashboard.hasWithdrawalPin || showChangeWithdrawPin) && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2.5">
              <div className="text-xs font-black text-amber-900 dark:text-amber-200">
                {dashboard.hasWithdrawalPin ? 'Update Your Withdrawal PIN' : 'Step 1: Add Withdrawal PIN (Required before Cash Out)'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newWithdrawalPin}
                  onChange={(e) => setNewWithdrawalPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="New 4-6 digit PIN"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-amber-300 dark:border-amber-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmWithdrawalPin}
                  onChange={(e) => setConfirmWithdrawalPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Confirm PIN"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-amber-300 dark:border-amber-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
                <button
                  type="button"
                  disabled={isBusy || newWithdrawalPin.length < 4 || newWithdrawalPin !== confirmWithdrawalPin}
                  onClick={async () => {
                    const ok = await onDashboardAction({
                      action: 'set_withdrawal_pin',
                      withdrawalPin: newWithdrawalPin,
                    });
                    if (ok) {
                      setNewWithdrawalPin('');
                      setConfirmWithdrawalPin('');
                      setShowChangeWithdrawPin(false);
                    }
                  }}
                  className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition disabled:opacity-50"
                >
                  Save Withdrawal PIN
                </button>
              </div>
              {newWithdrawalPin && confirmWithdrawalPin && newWithdrawalPin !== confirmWithdrawalPin && (
                <div className="text-[11px] font-bold text-rose-600 dark:text-rose-300">PINs do not match.</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                Name / Receiver
              </label>
              <input
                type="text"
                value={withdrawReceiverName}
                onChange={(e) => setWithdrawReceiverName(e.target.value)}
                placeholder="Full name of receiver"
                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                Type of Wallet
              </label>
              <select
                value={withdrawWalletType}
                onChange={(e) => setWithdrawWalletType(e.target.value)}
                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
              >
                <option value="GCash">GCash</option>
                <option value="Maya">Maya</option>
                <option value="BDO">BDO Bank Transfer</option>
                <option value="BPI">BPI Bank Transfer</option>
                <option value="UnionBank">UnionBank</option>
                <option value="GoTyme">GoTyme Bank</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                Withdrawal Number / Account Number
              </label>
              <input
                type="text"
                inputMode="tel"
                value={withdrawAccountNumber}
                onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                placeholder="e.g. 09XX-XXX-XXXX"
                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                Total Amount of Wallet (Available)
              </label>
              <input
                type="text"
                readOnly
                value={`₱${dashboard.walletBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-black text-emerald-700 dark:text-emerald-300"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                Total Amount of Withdrawal (PHP)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount to withdraw"
                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                Withdrawal PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={withdrawPin}
                onChange={(e) => setWithdrawPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Enter your 4-6 digit Withdrawal PIN"
                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
              />
            </div>
          </div>

          <SemaphoreOtpBox
            purpose="withdrawal"
            authToken={authToken}
            defaultPhone={withdrawAccountNumber || currentUser.phone || ''}
            label="Semaphore SMS OTP (Required for Cash-Out Withdrawal)"
            resetTrigger={withdrawOtpReset}
            onStatusChange={handleWithdrawOtpStatus}
          />

          <button
            type="button"
            disabled={
              isBusy ||
              !dashboard.hasWithdrawalPin ||
              !withdrawReceiverName.trim() ||
              !withdrawAccountNumber.trim() ||
              !withdrawPin ||
              Number(withdrawAmount) <= 0 ||
              (withdrawOtpRequired && !withdrawOtpToken)
            }
            onClick={async () => {
              const ok = await onDashboardAction({
                action: 'wallet_withdraw',
                amount: Number(withdrawAmount),
                receiverName: withdrawReceiverName.trim(),
                walletType: withdrawWalletType,
                withdrawalNumber: withdrawAccountNumber.trim(),
                withdrawalPin: withdrawPin,
                note: walletNote.trim(),
                otpToken: withdrawOtpToken || undefined,
              });
              if (ok) {
                setWithdrawPin('');
                setWithdrawOtpToken(null);
                setWithdrawOtpReset((n) => n + 1);
              }
            }}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center justify-center gap-2 shadow transition disabled:opacity-50"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Submit Withdrawal Request (₱{Number(withdrawAmount || 0).toLocaleString()})</span>
          </button>

          {/* Required Note Below Withdrawal Form */}
          <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-sky-900 dark:text-sky-200 font-semibold">
              Note: You can receive this withdrawal in <strong>10 minutes to 1 hour</strong>. If you do not receive your withdrawal, you can contact Admin directly.
            </p>
            <button
              type="button"
              onClick={() => onOpenChatRoom('Choy Admin')}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 shrink-0 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Contact Admin</span>
            </button>
          </div>

          {Array.isArray(dashboard.withdrawalRequests) && dashboard.withdrawalRequests.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-emerald-200 dark:border-emerald-800">
              <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                Recent Withdrawal Requests ({dashboard.withdrawalRequests.length})
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {dashboard.withdrawalRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-950 dark:text-white truncate">
                        {req.receiverName} · {req.walletType} ({req.accountNumber || req.withdrawalNumber})
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                        {new Date(req.createdAt).toLocaleString()} · Status: {req.status.toUpperCase()}
                      </div>
                    </div>
                    <div className="font-mono font-black text-rose-600 dark:text-rose-300 shrink-0">
                      ₱{req.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
            Wallet History ({walletTxs.length})
          </div>
          {walletTxs.length === 0 ? (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 py-4 text-center">
              No Wallet transactions yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {walletTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-emerald-950 dark:text-white truncate">{tx.note}</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`font-mono font-black shrink-0 ${
                      tx.amount >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
                    }`}
                  >
                    {tx.amount >= 0 ? `+₱${tx.amount.toFixed(2)}` : `-₱${Math.abs(tx.amount).toFixed(2)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. CHOY WALLET (CHOY COINS & TOP-UP)
  if (section === 'choy_wallet') {
    const choyTxs = dashboard.transactions.filter((t) => t.walletType === 'choy_wallet');
    const walletCfg = programsCfg.choyWallet;
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Choy Wallet',
          'Top up or convert Wallet funds to CHOY Coins for store purchases and tipping',
          <Coins className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}

        <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-slate-950 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider opacity-80">
              Choy Wallet Balance
            </div>
            <div className="text-3xl font-black font-mono tabular-nums mt-1">
              {dashboard.choyWalletBalance.toLocaleString()} <span className="text-base">CHOY</span>
            </div>
            <div className="text-xs font-bold opacity-90 mt-1">
              {walletCfg.topUpInstructions}
            </div>
          </div>
          {currentUser.role === 'admin' && onOpenAdminChoySetup && (
            <button
              type="button"
              onClick={() => onOpenAdminChoySetup('choy_wallet')}
              className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 text-xs font-black inline-flex items-center gap-1.5 shadow shrink-0 transition"
            >
              <Settings2 className="w-4 h-4" />
              <span>Admin Set Up Choy Wallet</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Convert Cash Wallet -> CHOY */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-white">
              Convert Wallet → CHOY (₱1 = {walletCfg.conversionRate} CHOY)
            </h3>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Available Wallet: ₱{dashboard.walletBalance.toFixed(2)} · Limits: ₱{walletCfg.minConvertPhp}–₱{walletCfg.maxConvertPhp.toLocaleString()}
            </p>
            <input
              type="number"
              min={walletCfg.minConvertPhp}
              max={walletCfg.maxConvertPhp}
              step="1"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              placeholder="PHP amount to convert"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
              You receive: {Math.round(Math.max(0, Number(convertAmount) || 0) * walletCfg.conversionRate * 100) / 100} CHOY
            </div>
            <button
              type="button"
              disabled={isBusy || (!walletCfg.allowConvert && currentUser.role !== 'admin')}
              onClick={() =>
                void onDashboardAction({
                  action: 'choy_wallet_convert',
                  amount: Number(convertAmount),
                })
              }
              className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{walletCfg.allowConvert ? 'Convert to CHOY Coins' : 'Conversion Paused by Admin'}</span>
            </button>
          </div>

          {/* Send CHOY Coins */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-white">
              Send CHOY Coins to Member
            </h3>
            <select
              value={choyTransferRecipientId}
              onChange={(e) => setChoyTransferRecipientId(e.target.value)}
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select member...</option>
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {onlineUsers.includes(m.name.toLowerCase()) ? '(Online)' : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="1"
              value={choyTransferAmount}
              onChange={(e) => setChoyTransferAmount(e.target.value)}
              placeholder="CHOY amount"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={isBusy || !choyTransferRecipientId || (!walletCfg.allowTransfers && currentUser.role !== 'admin')}
              onClick={() =>
                void onDashboardAction({
                  action: 'wallet_transfer',
                  walletType: 'choy_wallet',
                  recipientId: choyTransferRecipientId,
                  amount: Number(choyTransferAmount),
                  note: 'Choy Coins Gift',
                })
              }
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{walletCfg.allowTransfers ? 'Send CHOY Coins' : 'Transfers Paused by Admin'}</span>
            </button>
          </div>
        </div>

        {/* Choy Wallet Ledger */}
        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
            Choy Wallet History ({choyTxs.length})
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {choyTxs.map((tx) => (
              <div
                key={tx.id}
                className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-emerald-950 dark:text-white truncate">{tx.note}</div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`font-mono font-black shrink-0 ${
                    tx.amount >= 0 ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'
                  }`}
                >
                  {tx.amount >= 0 ? `+${tx.amount} CHOY` : `${tx.amount} CHOY`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 6. CHOY PRO
  if (section === 'choy_pro') {
    const proCfg = programsCfg.choyPro;
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Choy Pro',
          proCfg.tagline,
          <Crown className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}

        {currentUser.role === 'admin' && onOpenAdminChoySetup && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenAdminChoySetup('choy_pro')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Admin Set Up Choy Pro</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAdminChoySetup('choy_promo')}
              className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Admin Set Up Choy Promo</span>
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-emerald-900/60 border-2 border-amber-400/70 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-emerald-950 dark:text-white">
                  {dashboard.choyProActive ? 'Choy Pro Active' : 'Upgrade to Choy Pro'}
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  {dashboard.choyProActive && dashboard.choyProActivatedAt
                    ? `Activated on ${new Date(dashboard.choyProActivatedAt).toLocaleDateString()}`
                    : 'One-tap upgrade using your Wallet or Choy Wallet'}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black ${
                dashboard.choyProActive
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-400'
              }`}
            >
              {dashboard.choyProActive ? 'ACTIVE ✓' : `₱${proCfg.monthlyPhp} or ${proCfg.monthlyChoy} CHOY`}
            </span>
          </div>

          <ul className="space-y-2">
            {proCfg.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-xs text-emerald-950 dark:text-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          {subscriptionPromos.length > 0 && !dashboard.choyProActive && (
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-orange-800 dark:text-orange-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Active Choy Promos</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subscriptionPromos.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => setPromoCodeInput(pr.code)}
                    className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-[11px] font-black transition"
                  >
                    {pr.code} ({pr.discountType === 'percent' ? `${pr.discountValue}% OFF` : `₱${pr.discountValue} OFF`})
                  </button>
                ))}
              </div>
            </div>
          )}

          {!dashboard.choyProActive ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                  Choy Promo Code (Optional)
                </label>
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter promo code if available"
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono uppercase text-emerald-950 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isBusy || (!proCfg.enabled && currentUser.role !== 'admin')}
                  onClick={() =>
                    void onDashboardAction({
                      action: 'activate_choy_pro',
                      paymentMethod: 'wallet',
                      promoCode: promoCodeInput.trim() || undefined,
                    })
                  }
                  className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Activate via Wallet (₱{proCfg.monthlyPhp})</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy || (!proCfg.enabled && currentUser.role !== 'admin')}
                  onClick={() =>
                    void onDashboardAction({
                      action: 'activate_choy_pro',
                      paymentMethod: 'choy_wallet',
                      promoCode: promoCodeInput.trim() || undefined,
                    })
                  }
                  className="py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <Coins className="w-4 h-4" />
                  <span>Activate via Choy Wallet ({proCfg.monthlyChoy} CHOY)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
              <span>Enjoying Choy Pro benefits on {currentUser.name}</span>
              <button
                type="button"
                onClick={() => onNavigate('subscription')}
                className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black"
              >
                Manage Plan
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 7. SUBSCRIPTION
  if (section === 'subscription') {
    const proCfg = programsCfg.choyPro;
    const plans: Array<{
      id: UserDashboardData['subscriptionPlan'];
      title: string;
      priceLabel: string;
      choyLabel: string;
      desc: string;
    }> = [
      {
        id: 'free',
        title: 'Free Starter',
        priceLabel: '₱0',
        choyLabel: '0 CHOY',
        desc: 'Standard Newsfeed, Direct Messages, Groupchat & Marketplace access.',
      },
      {
        id: 'choy_pro_monthly',
        title: 'Choy Pro Monthly',
        priceLabel: `₱${proCfg.monthlyPhp.toLocaleString()} / mo`,
        choyLabel: `${proCfg.monthlyChoy.toLocaleString()} CHOY`,
        desc: 'Pro Crown badge, Priority AI, HD Video Calls & Choy Promo eligibility.',
      },
      {
        id: 'choy_pro_annual',
        title: 'Choy Pro Annual',
        priceLabel: `₱${proCfg.annualPhp.toLocaleString()} / yr`,
        choyLabel: `${proCfg.annualChoy.toLocaleString()} CHOY`,
        desc: 'Best value 12-month Choy Pro pass with annual member perks.',
      },
      {
        id: 'vip_supporter',
        title: 'VIP Supporter',
        priceLabel: `₱${proCfg.vipPhp.toLocaleString()} / mo`,
        choyLabel: `${proCfg.vipChoy.toLocaleString()} CHOY`,
        desc: 'VIP priority support, all Pro perks & featured community badge.',
      },
    ];

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Subscription',
          'Manage your active Choy Chat plan, auto-renewal, and payment method',
          <CreditCard className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}

        {currentUser.role === 'admin' && onOpenAdminChoySetup && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenAdminChoySetup('choy_pro')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Admin Set Up Subscription</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAdminChoySetup('choy_promo')}
              className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Admin Set Up Choy Promo</span>
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Current Subscription
            </div>
            <div className="text-lg font-black text-emerald-950 dark:text-white flex items-center gap-2 mt-0.5">
              <span>{formatPlanLabel(dashboard.subscriptionPlan)}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  dashboard.subscriptionStatus === 'active'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                {dashboard.subscriptionStatus}
              </span>
            </div>
            {dashboard.subscriptionRenewAt && (
              <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                {dashboard.subscriptionStatus === 'trialing'
                  ? `Free Trial ends (Auto-Deduct starts): ${new Date(dashboard.subscriptionTrialEndsAt || dashboard.subscriptionRenewAt).toLocaleDateString()}`
                  : `Next renewal: ${new Date(dashboard.subscriptionRenewAt).toLocaleDateString()}`}
                {dashboard.subscriptionPaymentLabel ? ` · ${dashboard.subscriptionPaymentLabel}` : ''}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onDashboardAction({ action: 'update_subscription', subAction: 'toggle_renew' })}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-xs font-bold text-emerald-900 dark:text-emerald-100"
            >
              Auto-Deduct: {dashboard.subscriptionAutoRenew ? 'ON' : 'OFF'}
            </button>
            {dashboard.subscriptionPlan !== 'free' &&
              (dashboard.subscriptionStatus === 'active' || dashboard.subscriptionStatus === 'trialing') && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void onDashboardAction({ action: 'update_subscription', subAction: 'cancel' })}
                  className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-700 dark:text-rose-200"
                >
                  Cancel Anytime (₱0)
                </button>
              )}
          </div>
        </div>

        {/* 30-Day Free Trial with Stripe Card or GCash Auto-Deduct */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/80 dark:to-emerald-900/50 border-2 border-emerald-400/70 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                30-Day Free Trial · Auto-Deduct After Trial
              </div>
              <h4 className="text-sm font-black text-emerald-950 dark:text-white">
                Due Today: ₱0.00 — Fill Stripe Card or GCash to Activate Free Tier
              </h4>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-black">
              DUE TODAY ₱0
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">Select Plan</label>
              <select
                value={trialPlan}
                onChange={(e) => setTrialPlan(e.target.value as 'choy_pro_monthly' | 'choy_pro_annual' | 'vip_supporter')}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
              >
                <option value="choy_pro_monthly">Choy Pro Monthly (₱{proCfg.monthlyPhp}/mo)</option>
                <option value="choy_pro_annual">Choy Pro Annual (₱{proCfg.annualPhp}/yr)</option>
                <option value="vip_supporter">VIP Supporter (₱{proCfg.vipPhp}/mo)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">Payment Method</label>
              <select
                value={trialPayMethod}
                onChange={(e) => setTrialPayMethod(e.target.value as 'stripe_card' | 'gcash')}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
              >
                <option value="stripe_card">Stripe Card (Visa / Mastercard)</option>
                <option value="gcash">GCash (Auto-Open GCash App)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                {trialPayMethod === 'stripe_card' ? 'Cardholder & Last 4 Digits' : 'GCash Mobile Number'}
              </label>
              {trialPayMethod === 'stripe_card' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={trialCardHolder}
                    onChange={(e) => setTrialCardHolder(e.target.value)}
                    placeholder="Name"
                    className="p-2.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={trialCardLast4}
                    onChange={(e) => setTrialCardLast4(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Last 4"
                    className="p-2.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="tel"
                  value={trialGcashNum}
                  onChange={(e) => setTrialGcashNum(e.target.value)}
                  placeholder="09XX-XXX-XXXX"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
              )}
            </div>
          </div>

          <SemaphoreOtpBox
            purpose="subscription"
            authToken={authToken}
            defaultPhone={trialGcashNum || currentUser.phone || ''}
            label="Semaphore SMS OTP (Required for Subscriptions & Paid Plans)"
            resetTrigger={subOtpReset}
            onStatusChange={handleSubOtpStatus}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
              Due today is <strong>₱0.00</strong>. After 30 days, your chosen plan auto-deducts unless you cancel before trial ends.
            </p>
            <button
              type="button"
              disabled={isBusy || (subOtpRequired && !subOtpToken)}
              onClick={async () => {
                const paymentLabel =
                  trialPayMethod === 'stripe_card'
                    ? `Stripe Card (${trialCardHolder.trim() || currentUser.name} •••• ${trialCardLast4 || '4242'})`
                    : `GCash (${trialGcashNum.trim() || currentUser.phone || 'Verified'})`;
                const ok = await onDashboardAction({
                  action: 'update_subscription',
                  subAction: 'start_trial',
                  plan: trialPlan,
                  paymentMethod: trialPayMethod,
                  paymentLabel,
                  otpToken: subOtpToken || undefined,
                });
                if (ok) {
                  setSubOtpToken(null);
                  setSubOtpReset((n) => n + 1);
                }
                if (ok && trialPayMethod === 'gcash' && typeof window !== 'undefined') {
                  const ua = navigator.userAgent || '';
                  if (/Android/i.test(ua)) {
                    window.location.href =
                      'intent://#Intent;scheme=gcash;package=com.globe.gcash.android;S.browser_fallback_url=https%3A%2F%2Fm.gcash.com%2Fgcash-login-web%2Findex.html;end';
                  } else if (/iPhone|iPad|iPod/i.test(ua)) {
                    window.location.href = 'gcash://';
                  }
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shrink-0 shadow transition disabled:opacity-50"
            >
              Start 30-Day Free Trial (₱0 Today)
            </button>
          </div>
        </div>

        {/* Choy Promo Code Bar for Subscriptions */}
        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 shadow-xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-black text-emerald-950 dark:text-white flex items-center gap-1.5 shrink-0">
              <Tag className="w-4 h-4 text-orange-500" />
              <span>Choy Promo Code:</span>
            </label>
            <input
              type="text"
              value={promoCodeInput}
              onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
              placeholder="Optional promo code (applied when you click Pay)"
              className="flex-1 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono uppercase text-emerald-950 dark:text-white"
            />
          </div>
          {subscriptionPromos.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Tap to apply:</span>
              {subscriptionPromos.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => setPromoCodeInput(pr.code)}
                  className="px-2.5 py-1 rounded-lg bg-orange-100 dark:bg-orange-950 border border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-200 text-[11px] font-black hover:bg-orange-200 transition"
                >
                  {pr.code} · {pr.discountType === 'percent' ? `${pr.discountValue}% OFF` : `₱${pr.discountValue} OFF`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((p) => {
            const isCurrent = dashboard.subscriptionPlan === p.id && dashboard.subscriptionStatus === 'active';
            return (
              <div
                key={p.id}
                className={`bg-white dark:bg-emerald-900/60 border rounded-2xl p-4 space-y-3 shadow-xs ${
                  isCurrent ? 'border-emerald-500 ring-2 ring-emerald-400/30' : 'border-emerald-200 dark:border-emerald-700/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-emerald-950 dark:text-white">{p.title}</h4>
                    <div className="text-xs font-mono font-bold text-emerald-700 dark:text-amber-300 mt-0.5">
                      {p.priceLabel} {p.id !== 'free' ? `· ${p.choyLabel}` : ''}
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                      CURRENT
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">{p.desc}</p>
                {p.id === 'free' ? (
                  <button
                    type="button"
                    disabled={isBusy || isCurrent}
                    onClick={() =>
                      void onDashboardAction({
                        action: 'update_subscription',
                        plan: 'free',
                        subAction: 'subscribe',
                      })
                    }
                    className="w-full py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-xs font-bold text-emerald-900 dark:text-emerald-100 disabled:opacity-50"
                  >
                    {isCurrent ? 'Active Free Plan' : 'Switch to Free'}
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isBusy || (!proCfg.enabled && currentUser.role !== 'admin') || (subOtpRequired && !subOtpToken)}
                      onClick={async () => {
                        const ok = await onDashboardAction({
                          action: 'update_subscription',
                          plan: p.id,
                          paymentMethod: 'wallet',
                          subAction: 'subscribe',
                          promoCode: promoCodeInput.trim() || undefined,
                          otpToken: subOtpToken || undefined,
                        });
                        if (ok) {
                          setSubOtpToken(null);
                          setSubOtpReset((n) => n + 1);
                        }
                      }}
                      className="py-2 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black transition disabled:opacity-50"
                    >
                      Pay Wallet ({p.priceLabel.split(' ')[0]})
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || (!proCfg.enabled && currentUser.role !== 'admin') || (subOtpRequired && !subOtpToken)}
                      onClick={async () => {
                        const ok = await onDashboardAction({
                          action: 'update_subscription',
                          plan: p.id,
                          paymentMethod: 'choy_wallet',
                          subAction: 'subscribe',
                          promoCode: promoCodeInput.trim() || undefined,
                          otpToken: subOtpToken || undefined,
                        });
                        if (ok) {
                          setSubOtpToken(null);
                          setSubOtpReset((n) => n + 1);
                        }
                      }}
                      className="py-2 px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black transition disabled:opacity-50"
                    >
                      Pay {p.choyLabel}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }



  if (section === 'marketplace') {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Food Store & Marketplace Dashboard',
          'Explore Food (with images), Groceries, Medicines & Appliances with Admin Setup',
          <ShoppingBag className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}
        {marketNotice && (
          <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-950 border border-orange-300 dark:border-orange-700 text-xs font-bold text-orange-950 dark:text-orange-100 flex items-center justify-between">
            <span>{marketNotice}</span>
            <button onClick={() => setMarketNotice(null)} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}

        {!canPlaceOrders && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 dark:text-amber-100">
                <div className="font-black">
                  {dashboard.kycStatus === 'pending'
                    ? 'Profile Verification Pending Admin Approval'
                    : dashboard.kycStatus === 'rejected'
                    ? 'Profile Verification Rejected — Please Resubmit to Order'
                    : 'Profile Verification Required Before Placing Orders'}
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {dashboard.kycStatus === 'pending'
                    ? 'Your details and Valid ID were sent to Choy Admin. Once Admin approves your profile, ordering will unlock automatically.'
                    : 'Fill up your Complete Name, Address, Age, Sex, and upload 1 Valid ID (matching your Complete Name) inside Profile, then wait for Admin approval.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="px-4 py-2 rounded-xl bg-[#FF5A1F] hover:bg-orange-500 text-white text-xs font-black shrink-0 shadow transition"
            >
              {dashboard.kycStatus === 'pending' ? 'View Profile Status' : 'Verify Profile Now'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Category Filter Sidebar */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 shadow-xs space-y-2 lg:sticky lg:top-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200 px-3 py-1 flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-500" />
              <span>Store Categories</span>
            </h3>
            <div className="space-y-1">
              {[
                { id: 'all', label: 'All Items', icon: <Store className="w-4 h-4" />, count: marketItems.length },
                { id: 'food', label: 'Food & Meals', icon: <Utensils className="w-4 h-4" />, count: marketItems.filter(i => i.category === 'food').length },
                { id: 'groceries', label: 'Groceries', icon: <ShoppingBasket className="w-4 h-4" />, count: marketItems.filter(i => i.category === 'groceries').length },
                { id: 'medicines', label: 'Medicines', icon: <Pill className="w-4 h-4" />, count: marketItems.filter(i => i.category === 'medicines').length },
                { id: 'appliances', label: 'Appliances', icon: <Tv className="w-4 h-4" />, count: marketItems.filter(i => i.category === 'appliances').length },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setMarketCategoryFilter(cat.id as any)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center justify-between transition ${
                    marketCategoryFilter === cat.id
                      ? 'bg-orange-500 text-slate-950 shadow'
                      : 'bg-emerald-50/70 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    marketCategoryFilter === cat.id ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-200/50 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-200'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {currentUser.role === 'admin' && (
              <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem({ category: 'food', stock: 100, price: 100, sellerName: 'Choy Store' });
                    setIsEditItemModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Admin Set Up Item</span>
                </button>
                {onOpenAdminChoySetup && (
                  <button
                    type="button"
                    onClick={() => onOpenAdminChoySetup('choy_promo')}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-xs transition"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Admin Set Up Choy Promo</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Main Marketplace Area */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-emerald-600 dark:text-emerald-400" />
                <input
                  type="text"
                  value={marketSearchQuery}
                  onChange={(e) => setMarketSearchQuery(e.target.value)}
                  placeholder="Search store items, food, groceries, medicines..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-200 text-xs font-black inline-flex items-center gap-1.5 shadow transition relative shrink-0 w-full md:w-auto justify-center"
              >
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                <span>Cart ({cartItems.reduce((acc, ci) => acc + ci.quantity, 0)})</span>
              </button>
            </div>

            {marketLoading && marketItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading marketplace items...</span>
              </div>
            ) : filteredMarketItems.length === 0 ? (
              <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-12 text-center text-xs text-emerald-700 dark:text-emerald-300">
                No items found in this category.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMarketItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between transition hover:shadow-md"
                  >
                    <div>
                      <div className="relative h-44 bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
                        <img
                          src={item.imageUrl || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80'}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-slate-950/80 text-white text-[10px] font-black uppercase tracking-wider">
                          {item.category}
                        </div>
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                          Stock: {item.stock}
                        </div>
                      </div>

                      <div className="p-4 space-y-2">
                        <h3 className="text-sm font-black text-emerald-950 dark:text-white line-clamp-1">{item.title}</h3>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 line-clamp-2 leading-relaxed">{item.description}</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-sm font-black text-orange-600 dark:text-orange-400">₱{item.price.toFixed(2)}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{item.sellerName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0 flex items-center gap-2 border-t border-emerald-100 dark:border-emerald-800/60 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutError(null);
                          setBuyQuantity(1);
                          setBuyingItem(item);
                        }}
                        className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 shadow transition"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Buy Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        className="px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-1 transition"
                        title="Add to Cart"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Cart</span>
                      </button>

                      {currentUser.role === 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsEditItemModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 transition"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteMarketplaceItem(item.id)}
                            className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 hover:bg-rose-200 transition"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isEditItemModalOpen && editingItem && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-emerald-950 dark:text-white">
                  {editingItem.id ? 'Admin Set Up: Edit Item' : 'Admin Set Up: Add New Item'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditItemModalOpen(false)}
                  className="p-1 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMarketplaceItem} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Category</label>
                    <select
                      value={editingItem.category || 'food'}
                      onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                    >
                      <option value="food">Food (with images)</option>
                      <option value="groceries">Groceries</option>
                      <option value="medicines">Medicines</option>
                      <option value="appliances">Appliances</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Seller / Store Name</label>
                    <input
                      type="text"
                      value={editingItem.sellerName || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, sellerName: e.target.value })}
                      placeholder="e.g. Choy Kitchen"
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Item Title</label>
                  <input
                    type="text"
                    required
                    value={editingItem.title || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                    placeholder="e.g. Choy Special Grilled Chicken"
                    className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Price (PHP ₱)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={editingItem.price ?? 100}
                      onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingItem.stock ?? 100}
                      onChange={(e) => setEditingItem({ ...editingItem, stock: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Item Photo (Cloudflare R2 Upload or Image URL)
                    </label>
                    <label className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
                      {uploadingItemImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{uploadingItemImage ? 'Uploading...' : 'Upload Photo (R2)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingItemImage}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUploadMarketplaceImage(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={editingItem.imageUrl || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                    placeholder="https://... or upload via Cloudflare R2"
                    className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                  />
                  {editingItem.imageUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800 h-32 bg-emerald-100 dark:bg-emerald-900/50">
                      <img
                        src={editingItem.imageUrl}
                        alt={editingItem.title || 'Preview'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Description</label>
                  <textarea
                    rows={3}
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    placeholder="Item details..."
                    className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditItemModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={marketLoading || uploadingItemImage}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5"
                  >
                    <span>Save Item</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {buyingItem && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-emerald-950 dark:text-white">Checkout: {buyingItem.title}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setBuyingItem(null);
                    setCheckoutError(null);
                  }}
                  className="p-1 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {checkoutError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200"
                >
                  {checkoutError}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex justify-between text-xs font-bold text-emerald-950 dark:text-white">
                  <span>Price per unit:</span>
                  <span className="text-orange-600 dark:text-orange-400">₱{buyingItem.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-950 dark:text-white">
                  <span>Available stock:</span>
                  <span>{buyingItem.stock} units</span>
                </div>
              </div>

              <form onSubmit={handleBuyMarketplaceItem} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, buyingItem.stock)}
                      value={buyQuantity}
                      onChange={(e) => setBuyQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Delivery Fee</label>
                    <select
                      value={deliveryDistanceKm}
                      onChange={(e) => setDeliveryDistanceKm(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                    >
                      <option value="2">Delivery Fee: ₱25.00</option>
                      <option value="5">Delivery Fee: ₱40.00</option>
                      <option value="8">Delivery Fee: ₱65.00</option>
                      <option value="10">Delivery Fee: ₱90.00</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                    Customer & Delivery Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Full Name</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Juan dela Cruz"
                        className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Contact Number</label>
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="e.g. 09123456789"
                        className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Delivery Address / Landmark</label>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="e.g. Purok 3, Brgy. Central, Near Chapel"
                      className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Delivery Notes (Optional)</label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Please call upon arrival"
                      className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Payment Source</label>
                  <select
                    value={buyPaymentMethod}
                    onChange={(e) => setBuyPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                  >
                    <option value="wallet">Cash Wallet (Balance: ₱{dashboard.walletBalance.toFixed(2)})</option>
                    <option value="choy_wallet">Choy Wallet (Balance: {dashboard.choyWalletBalance} CHOY)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Choy Promo Code (Optional)</label>
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. CHOY20"
                    className="w-full p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-mono uppercase text-emerald-950 dark:text-white"
                  />
                  {marketplacePromos.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {marketplacePromos.map((pr) => (
                        <button
                          key={pr.id}
                          type="button"
                          onClick={() => setPromoCodeInput(pr.code)}
                          className="px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-200 text-[10px] font-black"
                        >
                          {pr.code} ({pr.discountType === 'percent' ? `${pr.discountValue}%` : `₱${pr.discountValue}`} off)
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 space-y-1.5 text-xs">
                  <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-200">
                    <span>Item Subtotal ({buyQuantity}x):</span>
                    <span>₱{(buyingItem.price * buyQuantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-200">
                    <span>Delivery Fee:</span>
                    <span>₱{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-orange-200 dark:border-orange-800 flex items-center justify-between font-black text-orange-950 dark:text-orange-200">
                    <span>Total Amount Due:</span>
                    <span className="text-sm">₱{(buyingItem.price * buyQuantity + deliveryFee).toFixed(2)}</span>
                  </div>
                </div>

                {!canPlaceOrders && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">
                      {dashboard.kycStatus === 'pending'
                        ? 'Orders are locked until Admin approves your Profile Verification.'
                        : 'Complete your Profile Verification & Valid ID first before ordering.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBuyingItem(null);
                        onNavigate('profile');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FF5A1F] text-white text-[11px] font-black"
                    >
                      Go to Profile
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBuyingItem(null);
                      setCheckoutError(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={marketLoading || !canPlaceOrders}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow disabled:opacity-50"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{canPlaceOrders ? 'Confirm Purchase' : 'Approval Required'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 shadow-xs space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <span>Orders & Spending Analytics</span>
            </h3>
            <span className="text-xs text-emerald-700 dark:text-emerald-300">Last 30 Days Activity</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Total Orders</p>
              <p className="text-lg font-black text-emerald-950 dark:text-white">{marketplaceOrders.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800">
              <p className="text-[11px] font-bold text-orange-700 dark:text-orange-300">Order Volume</p>
              <p className="text-lg font-black text-orange-600 dark:text-orange-400">
                ₱{marketplaceOrders.reduce((acc, o: any) => acc + Number(o.totalAmount || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Delivery Fees</p>
              <p className="text-lg font-black text-emerald-950 dark:text-white">
                ₱{marketplaceOrders.reduce((acc, o: any) => acc + Number(o.deliveryFee || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800">
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Active / Pending</p>
              <p className="text-lg font-black text-emerald-950 dark:text-white">
                {marketplaceOrders.filter((o: any) => ['pending', 'preparing', 'out_for_delivery'].includes(String(o.status || 'pending'))).length}
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#10b98133" />
                <XAxis dataKey="date" stroke="#059669" fontSize={11} />
                <YAxis stroke="#059669" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#064e3b',
                    borderColor: '#059669',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="spending" fill="#f97316" name="Spending (₱)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="orders" fill="#10b981" name="Orders Count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 shadow-xs space-y-3 mt-4">
          <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" />
            <span>Recent Marketplace Orders</span>
          </h3>
          {marketplaceOrders.length === 0 ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">No orders placed yet.</p>
          ) : (
            <div className="space-y-2">
              {marketplaceOrders.map((ord: any) => {
                const distKm = Number(ord.deliveryDistanceKm || 2);
                const feeVal = Number(ord.deliveryFee ?? (distKm <= 2 ? 25 : distKm <= 5 ? 40 : distKm <= 8 ? 65 : 90));
                const statusVal = String(ord.status || 'pending');
                const statusStyle =
                  statusVal === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : statusVal === 'cancelled'
                    ? 'bg-rose-600 text-white'
                    : statusVal === 'out_for_delivery'
                    ? 'bg-sky-600 text-white'
                    : statusVal === 'preparing'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-orange-500 text-slate-950';

                return (
                  <div key={ord.id} className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-emerald-950 dark:text-white">Order #{ord.id.slice(-6)}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 font-bold text-[10px]">
                          <Phone className="w-3 h-3" />
                          <span>{ord.customerName || ord.userName} ({ord.customerPhone || 'No contact'})</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold text-[10px]">
                          <Truck className="w-3 h-3" />
                          <span>Delivery Fee: ₱{feeVal.toFixed(2)}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg font-black uppercase text-[10px] ${statusStyle}`}>
                          {statusVal.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-500" />
                        <span>
                          {ord.deliveryAddress || 'No delivery address provided'}
                          {ord.deliveryNotes ? ` (Note: ${ord.deliveryNotes})` : ''}
                        </span>
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Items: {ord.items.map((it: any) => `${it.quantity}x ${it.title}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <span className="font-black text-sm text-orange-600 dark:text-orange-400">₱{Number(ord.totalAmount).toFixed(2)}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-bold uppercase text-[10px]">
                        {ord.paymentMethod}
                      </span>
                      {currentUser.role === 'admin' && (
                        <select
                          aria-label={`Update status for order ${ord.id.slice(-6)}`}
                          value={statusVal}
                          disabled={updatingOrderId === ord.id}
                          onChange={(e) => void handleUpdateOrderStatus(ord.id, e.target.value)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-950 dark:text-white"
                        >
                          <option value="pending">Pending</option>
                          <option value="preparing">Preparing</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      )}
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isCartOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-emerald-950 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-500" />
                  <span>Shopping Cart ({cartItems.reduce((acc, ci) => acc + ci.quantity, 0)})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    setCheckoutError(null);
                  }}
                  className="p-1 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {checkoutError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200"
                >
                  {checkoutError}
                </div>
              )}

              {cartItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-emerald-700 dark:text-emerald-300">
                  Your shopping cart is empty. Add items from the store!
                </div>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {cartItems.map((ci) => (
                    <div key={ci.item.id} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={ci.item.imageUrl || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80'}
                          alt={ci.item.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <h4 className="text-xs font-black text-emerald-950 dark:text-white line-clamp-1">{ci.item.title}</h4>
                          <span className="text-xs text-orange-600 dark:text-orange-400 font-bold">₱{ci.item.price.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={ci.item.stock}
                          value={ci.quantity}
                          onChange={(e) => handleUpdateCartQty(ci.item.id, Number(e.target.value))}
                          className="w-14 p-1.5 rounded-lg bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-center font-bold text-emerald-950 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQty(ci.item.id, 0)}
                          className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 hover:bg-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cartItems.length > 0 && (
                <form onSubmit={handleCartCheckout} className="space-y-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                  <div className="space-y-3 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">Customer & Delivery Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Full Name</label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Juan dela Cruz"
                          className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Contact Number</label>
                        <input
                          type="text"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="e.g. 09123456789"
                          className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Delivery Address / Landmark</label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="e.g. Purok 3, Brgy. Central, Near Chapel"
                        className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100">Delivery Notes (Optional)</label>
                      <input
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="e.g. Please leave at front door, ring doorbell"
                        className="w-full p-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Checkout Payment Source</label>
                    <select
                      value={cartPaymentMethod}
                      onChange={(e) => setCartPaymentMethod(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                    >
                      <option value="wallet">Cash Wallet (Balance: ₱{dashboard.walletBalance.toFixed(2)})</option>
                      <option value="choy_wallet">Choy Wallet (Balance: {dashboard.choyWalletBalance} CHOY)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Delivery Fee</label>
                    <select
                      value={deliveryDistanceKm}
                      onChange={(e) => setDeliveryDistanceKm(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                    >
                      <option value="2">Delivery Fee: ₱25.00</option>
                      <option value="5">Delivery Fee: ₱40.00</option>
                      <option value="8">Delivery Fee: ₱65.00</option>
                      <option value="10">Delivery Fee: ₱90.00</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Choy Promo Code (Optional)</label>
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. CHOY20"
                      className="w-full p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-mono uppercase text-emerald-950 dark:text-white"
                    />
                    {marketplacePromos.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {marketplacePromos.map((pr) => (
                          <button
                            key={pr.id}
                            type="button"
                            onClick={() => setPromoCodeInput(pr.code)}
                            className="px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-200 text-[10px] font-black"
                          >
                            {pr.code} ({pr.discountType === 'percent' ? `${pr.discountValue}%` : `₱${pr.discountValue}`} off)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-200">
                      <span>Items Subtotal:</span>
                      <span>₱{itemsSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-200">
                      <span>Delivery Fee:</span>
                      <span>₱{deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-emerald-200 dark:border-emerald-800 flex justify-between font-black text-emerald-950 dark:text-white text-sm">
                      <span>Total Amount Due:</span>
                      <span className="text-orange-600 dark:text-orange-400">₱{totalCartAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {!canPlaceOrders && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">
                        {dashboard.kycStatus === 'pending'
                          ? 'Orders are locked until Admin approves your Profile Verification.'
                          : 'Complete your Profile Verification & Valid ID first before checkout.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCartOpen(false);
                          onNavigate('profile');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FF5A1F] text-white text-[11px] font-black"
                      >
                        Go to Profile
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartOpen(false);
                        setCheckoutError(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-xs font-bold"
                    >
                      Continue Shopping
                    </button>
                    <button
                      type="submit"
                      disabled={marketLoading || !canPlaceOrders}
                      className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow disabled:opacity-50"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{canPlaceOrders ? 'Complete Checkout' : 'Approval Required'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 8. RULES
  if (section === 'rules') {
    const communityRules = [
      {
        title: '1. Authentic Created Name (Public Show)',
        body: 'Use an honest Created Name so members and Admins can recognize you safely in Newsfeed, People, and Groupchat.',
      },
      {
        title: '2. Respectful Messages & Groupchat',
        body: 'Keep direct messages, VIP Group, and custom group chats respectful. Harassment, hate speech, or spam is strictly prohibited.',
      },
      {
        title: '3. Safe Wallet & Choy Wallet Transfers',
        body: 'Double-check recipient names before sending Wallet funds or CHOY Coins. All completed transfers are logged for safety.',
      },
      {
        title: '4. Clean Media & Newsfeed Posts',
        body: 'Only share photos, videos, and music appropriate for your assigned Newsfeed channel without infringing private content.',
      },
      {
        title: '5. Account & Security Protection',
        body: 'Never share your PIN or session credentials. Report suspicious activity or blocked users directly to Choy Admin.',
      },
    ];

    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Community Rules',
          'Choy Chat safety guidelines for every member and group chat room',
          <BookOpen className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}

        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="space-y-3">
            {communityRules.map((rule) => (
              <div
                key={rule.title}
                className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-1"
              >
                <div className="text-xs font-black text-emerald-950 dark:text-white">{rule.title}</div>
                <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">{rule.body}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
              {dashboard.rulesAcceptedAt
                ? `Accepted on ${new Date(dashboard.rulesAcceptedAt).toLocaleString()}`
                : 'Tap confirm once you have reviewed all rules.'}
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onDashboardAction({ action: 'accept_rules' })}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{dashboard.rulesAcceptedAt ? 'Rules Accepted ✓' : 'I Accept These Rules'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 9. ACKNOWLEDGMENT
  if (section === 'acknowledgment') {
    return (
    <div className="max-w-3xl mx-auto space-y-4">
      {renderSectionBackBar(
        'Acknowledgment',
        'Privacy agreement, platform credits & verified member acknowledgment',
        <FileCheck2 className="w-5 h-5" />
      )}
      {renderFeedbackBanner()}

      <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="space-y-3 text-xs text-emerald-900 dark:text-emerald-100 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-1">
            <div className="font-black text-emerald-950 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>1. Data, Profile &amp; Admin Copy Privacy</span>
            </div>
            <p className="text-emerald-800 dark:text-emerald-200">
              Your Created Name, phone contact, Newsfeed posts, messages, Wallet &amp; Choy Wallet ledgers are synced securely for account continuity and community verification.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-1">
            <div className="font-black text-emerald-950 dark:text-white flex items-center gap-1.5">
              <ScrollText className="w-4 h-4 text-amber-500" />
              <span>2. AI, Media &amp; Real-Time Communication</span>
            </div>
            <p className="text-emerald-800 dark:text-emerald-200">
              Choy Chat integrates live WebRTC audio/video calls, OPM Audio, Recharts analytics, and Google Gemini AI features for community members and admins.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onDashboardAction({
              action: 'sign_acknowledgment',
              signedName: signNameDraft.trim() || currentUser.name,
            });
          }}
          className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700/70 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black text-indigo-950 dark:text-white">
              Member Acknowledgment Signature
            </div>
            {dashboard.acknowledgmentSignedAt && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                SIGNED ✓
              </span>
            )}
          </div>
          <input
            type="text"
            required
            value={signNameDraft}
            onChange={(e) => setSignNameDraft(e.target.value)}
            placeholder="Type your Created Name to acknowledge..."
            className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-indigo-300 dark:border-indigo-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-indigo-500"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-indigo-800 dark:text-indigo-200">
              {dashboard.acknowledgmentSignedAt
                ? `Signed by ${dashboard.acknowledgmentSignedName || currentUser.name} on ${new Date(
                    dashboard.acknowledgmentSignedAt
                  ).toLocaleString()}`
                : 'Not signed yet'}
            </div>
            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black inline-flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{dashboard.acknowledgmentSignedAt ? 'Update Acknowledgment' : 'Confirm & Sign Acknowledgment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  }
};
