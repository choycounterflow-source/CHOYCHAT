import React, { useState } from 'react';
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

export interface UserWalletTx {
  id: string;
  walletType: 'wallet' | 'choy_wallet';
  kind: 'topup' | 'withdraw' | 'transfer_out' | 'transfer_in' | 'reward' | 'convert' | 'subscription' | 'choy_pro';
  amount: number;
  note: string;
  counterparty?: string;
  createdAt: string;
}

export interface UserDashboardData {
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
}

export function buildAdminProfileCopyText(
  user: DashboardUserInfo,
  dashboard: UserDashboardData,
  newsfeedLabel: string
): string {
  const handle = `@${user.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'member'}`;
  return [
    '=== CHOY CHAT PROFILE (ADMIN COPY) ===',
    `User ID: ${user.id}`,
    `Created Name (Public Show): ${user.name} (${handle})`,
    `Public Visibility: ${dashboard.publicShowName ? 'PUBLIC SHOW ON' : 'HIDDEN'}`,
    `Phone: ${user.phone}`,
    `Role: ${user.role.toUpperCase()}`,
    `Status: ${user.status.toUpperCase()}`,
    `Newsfeed Channel: ${newsfeedLabel}`,
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
    `Copied At: ${new Date().toLocaleString()}`,
  ].join('\n');
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
}) => {
  const [nameInput, setNameInput] = useState(currentUser.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [walletAmount, setWalletAmount] = useState('100');
  const [walletNote, setWalletNote] = useState('');
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
  const [marketplaceOrders, setMarketplaceOrders] = React.useState<any[]>([]);

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

  const handleCartCheckout = async () => {
    if (cartItems.length === 0) return;
    try {
      setMarketLoading(true);
      const payloadItems = cartItems.map(ci => ({ itemId: ci.item.id, quantity: ci.quantity }));
      const res = await fetch('/api/marketplace/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: payloadItems, paymentMethod: cartPaymentMethod }),
      });
      const data = await res.json();
      if (res.ok) {
        setCartItems([]);
        setIsCartOpen(false);
        setMarketNotice('Cart checkout completed successfully!');
        window.location.reload();
      } else {
        setMarketNotice(data.error || 'Checkout failed.');
      }
    } catch (err: unknown) {
      setMarketNotice(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setMarketLoading(false);
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
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBuyingItem(null);
        setBuyQuantity(1);
        setMarketNotice(`Successfully purchased ${buyQuantity}x ${buyingItem.title}!`);
        window.location.reload();
      } else {
        setMarketNotice(data.error || 'Failed to complete purchase.');
      }
    } catch (err: unknown) {
      setMarketNotice(err instanceof Error ? err.message : 'Purchase failed.');
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
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition"
      >
        <LayoutDashboard className="w-3.5 h-3.5" />
        <span>User Dashboard</span>
      </button>
    </div>
  );

  // 1. MAIN USER DASHBOARD OVERVIEW (EVERY USER HAS THIS DASHBOARD)
  if (section === 'dashboard') {
    const quickTiles: Array<{
      id: UserDashboardTabId;
      label: string;
      sub: string;
      badge?: string;
      icon: React.ReactNode;
      tone: string;
    }> = [
      {
        id: 'profile',
        label: 'Profile (Admin Copy)',
        sub: 'Account details & Admin copy card',
        badge: currentUser.role === 'admin' ? 'Admin' : 'Verified',
        icon: <User className="w-4 h-4" />,
        tone: 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80',
      },
      {
        id: 'user_created_name',
        label: 'Created Name (Public Show)',
        sub: dashboard.publicShowName ? `${currentUser.name} · Visible` : `${currentUser.name} · Hidden`,
        badge: dashboard.publicShowName ? 'Public' : 'Private',
        icon: <BadgeCheck className="w-4 h-4" />,
        tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80',
      },
      {
        id: 'messages',
        label: 'Message',
        sub: unreadMessagesCount > 0 ? `${unreadMessagesCount} unread chats` : 'Direct messages & calls',
        badge: unreadMessagesCount > 0 ? `${unreadMessagesCount}` : undefined,
        icon: <MessageSquare className="w-4 h-4" />,
        tone: 'text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/80',
      },
      {
        id: 'feed',
        label: 'Newsfeed',
        sub: `${postsCount} posts · ${newsfeedLabel}`,
        icon: <Home className="w-4 h-4" />,
        tone: 'text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/80',
      },
      {
        id: 'groupchat',
        label: 'Groupchat',
        sub: `${1 + chatGroups.length} group rooms`,
        badge: activeGroupCalls.length > 0 ? `${activeGroupCalls.length} Live` : undefined,
        icon: <Users className="w-4 h-4" />,
        tone: 'text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-950/80',
      },
      {
        id: 'wallet',
        label: 'Wallet',
        sub: `₱${dashboard.walletBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        icon: <Wallet className="w-4 h-4" />,
        tone: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80',
      },
      {
        id: 'choy_pro',
        label: 'Choy Pro',
        sub: dashboard.choyProActive ? 'Active VIP Member' : 'Upgrade to Pro perks',
        badge: dashboard.choyProActive ? 'PRO' : 'Upgrade',
        icon: <Crown className="w-4 h-4" />,
        tone: 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80',
      },
      {
        id: 'choy_wallet',
        label: 'Choy Wallet',
        sub: `${dashboard.choyWalletBalance.toLocaleString()} CHOY Coins`,
        icon: <Coins className="w-4 h-4" />,
        tone: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80',
      },
      {
        id: 'subscription',
        label: 'Subscription',
        sub: formatPlanLabel(dashboard.subscriptionPlan),
        badge: dashboard.subscriptionStatus === 'active' ? 'Active' : 'Paused',
        icon: <CreditCard className="w-4 h-4" />,
        tone: 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/80',
      },
      {
        id: 'rules',
        label: 'Rules',
        sub: dashboard.rulesAcceptedAt ? 'Accepted' : 'Review & accept rules',
        badge: dashboard.rulesAcceptedAt ? '✓' : 'Pending',
        icon: <BookOpen className="w-4 h-4" />,
        tone: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80',
      },
      {
        id: 'acknowledgment',
        label: 'Acknowledgment',
        sub: dashboard.acknowledgmentSignedAt ? `Signed by ${dashboard.acknowledgmentSignedName}` : 'Pending signature',
        badge: dashboard.acknowledgmentSignedAt ? 'Signed' : 'Action',
        icon: <FileCheck2 className="w-4 h-4" />,
        tone: 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80',
      },
      {
        id: 'marketplace',
        label: 'Food Store & Marketplace',
        sub: 'Food with images, groceries, medicines & appliances',
        badge: 'Store',
        icon: <ShoppingBag className="w-4 h-4" />,
        tone: 'text-orange-600 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/80',
      },
    ];

    return (
      <div className="max-w-6xl mx-auto space-y-5">
        {renderFeedbackBanner()}

        {/* Hero User Identity + Admin Copy + Balances */}
        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={avatarUrl}
                  alt={currentUser.name}
                  className={`w-14 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border-2 ${
                    dashboard.choyProActive ? 'border-amber-400' : 'border-emerald-400'
                  } ${isCustomAvatar ? 'object-cover' : 'object-contain'}`}
                />
                {dashboard.choyProActive && (
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                    <Crown className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    User Dashboard
                  </span>
                  {dashboard.choyProActive && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black">
                      CHOY PRO
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                    {dashboard.publicShowName ? 'Public Show: ON' : 'Public Show: OFF'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-emerald-950 dark:text-white truncate">
                  {currentUser.name}
                </h2>
                <div className="text-xs text-emerald-700 dark:text-emerald-300 flex flex-wrap items-center gap-2 font-mono">
                  <span>{myHandle}</span>
                  <span>·</span>
                  <span>{currentUser.phone}</span>
                  <span>·</span>
                  <span className="font-sans font-semibold">{newsfeedLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const txt = buildAdminProfileCopyText(currentUser, dashboard, newsfeedLabel);
                  navigator.clipboard?.writeText(txt).catch(() => {});
                  setCopiedSummary(true);
                  setTimeout(() => setCopiedSummary(false), 2500);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSummary ? 'Admin Copy Copied!' : 'Profile (Admin Copy)'}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('feed')}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Open Newsfeed</span>
              </button>
            </div>
          </div>

          {/* Financial & Plan Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 text-left transition"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <span>Wallet Balance</span>
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-black font-mono tabular-nums text-emerald-950 dark:text-white mt-1">
                ₱{dashboard.walletBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('choy_wallet')}
              className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/60 hover:border-amber-400 text-left transition"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span>Choy Wallet</span>
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg font-black font-mono tabular-nums text-amber-950 dark:text-amber-200 mt-1">
                {dashboard.choyWalletBalance.toLocaleString()} <span className="text-xs">CHOY</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('subscription')}
              className="p-3.5 rounded-xl bg-violet-50/80 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-700/60 hover:border-violet-400 text-left transition"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-300 flex items-center justify-between">
                <span>Subscription</span>
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm font-black text-violet-950 dark:text-white truncate mt-1.5">
                {formatPlanLabel(dashboard.subscriptionPlan)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('acknowledgment')}
              className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700/60 hover:border-indigo-400 text-left transition"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 flex items-center justify-between">
                <span>Rules &amp; Ack</span>
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm font-black text-indigo-950 dark:text-white truncate mt-1.5">
                {dashboard.rulesAcceptedAt && dashboard.acknowledgmentSignedAt
                  ? 'Verified ✓'
                  : 'Action Needed'}
              </div>
            </button>
          </div>
        </div>

        {/* All 11 User Dashboard Modules Grid */}
        <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
              All User Dashboard Tools
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
              Tap any tool to open
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {quickTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => onNavigate(tile.id)}
                className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-amber-400 flex items-center gap-3 text-left transition group"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tile.tone}`}>
                  {tile.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-extrabold text-emerald-950 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-amber-300">
                      {tile.label}
                    </span>
                    {tile.badge && (
                      <span className="px-1.5 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 text-[9px] font-black text-emerald-800 dark:text-emerald-200 shrink-0">
                        {tile.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300/85 truncate mt-0.5">
                    {tile.sub}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
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
                  {myHandle} · {newsfeedLabel}
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
          {/* Cash In / Cash Out */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-white">
              Cash In &amp; Cash Out
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
            <div className="grid grid-cols-2 gap-2">
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
                className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Cash In</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  void onDashboardAction({
                    action: 'wallet_withdraw',
                    amount: Number(walletAmount),
                    note: walletNote,
                  })
                }
                className="py-2.5 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Cash Out</span>
              </button>
            </div>
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

  // 5. CHOY WALLET (CHOY COINS & REWARDS)
  if (section === 'choy_wallet') {
    const choyTxs = dashboard.transactions.filter((t) => t.walletType === 'choy_wallet');
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Choy Wallet',
          'Earn daily CHOY Coins, convert Wallet funds, and tip or send CHOY to friends',
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
            <div className="text-xs font-bold opacity-85 mt-1">
              {dashboard.choyProActive ? 'Choy Pro 2× Daily Reward Active (+50 CHOY/day)' : 'Daily Check-In Reward: +25 CHOY/day'}
            </div>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void onDashboardAction({ action: 'choy_wallet_claim_daily' })}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 text-xs font-black inline-flex items-center gap-1.5 shrink-0 shadow transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Claim Daily +{dashboard.choyProActive ? '50' : '25'} CHOY</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Convert Cash Wallet -> CHOY */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-white">
              Convert Wallet → CHOY (₱1 = 2 CHOY)
            </h3>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Available Wallet: ₱{dashboard.walletBalance.toFixed(2)}
            </p>
            <input
              type="number"
              min="1"
              step="1"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              placeholder="PHP amount to convert"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
              You receive: {Math.max(0, Number(convertAmount) || 0) * 2} CHOY
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void onDashboardAction({
                  action: 'choy_wallet_convert',
                  amount: Number(convertAmount),
                })
              }
              className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Convert to CHOY Coins</span>
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
              disabled={isBusy || !choyTransferRecipientId}
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
              <span>Send CHOY Coins</span>
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
    const perks = [
      'Verified Choy Pro Crown Badge beside your Created Name (Public Show)',
      '2× Daily Choy Wallet Rewards (+50 CHOY every day)',
      'Priority Choy AI Assistant & GitHub Intelligence access',
      'HD Video Calls with Custom Video Backgrounds & Screen Share',
      'Priority Groupchat & Newsfeed Spotlight highlights',
    ];
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {renderSectionBackBar(
          'Choy Pro',
          'Unlock Pro member badge, double Choy Coins rewards & priority features',
          <Crown className="w-5 h-5" />
        )}
        {renderFeedbackBanner()}

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
              {dashboard.choyProActive ? 'ACTIVE ✓' : '₱199 or 250 CHOY'}
            </span>
          </div>

          <ul className="space-y-2">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-xs text-emerald-950 dark:text-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          {!dashboard.choyProActive ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void onDashboardAction({ action: 'activate_choy_pro', paymentMethod: 'wallet' })}
                className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                <span>Activate via Wallet (₱199)</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void onDashboardAction({ action: 'activate_choy_pro', paymentMethod: 'choy_wallet' })}
                className="py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <Coins className="w-4 h-4" />
                <span>Activate via Choy Wallet (250 CHOY)</span>
              </button>
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
        desc: 'Standard Newsfeed, Direct Messages, Groupchat & Daily +25 CHOY.',
      },
      {
        id: 'choy_pro_monthly',
        title: 'Choy Pro Monthly',
        priceLabel: '₱199 / mo',
        choyLabel: '250 CHOY',
        desc: 'Pro Crown badge, +50 Daily CHOY, Priority AI & HD Video Calls.',
      },
      {
        id: 'choy_pro_annual',
        title: 'Choy Pro Annual',
        priceLabel: '₱1,499 / yr',
        choyLabel: '1,800 CHOY',
        desc: 'Best value 12-month Choy Pro pass with 37% savings.',
      },
      {
        id: 'vip_supporter',
        title: 'VIP Supporter',
        priceLabel: '₱499 / mo',
        choyLabel: '600 CHOY',
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
                Next renewal: {new Date(dashboard.subscriptionRenewAt).toLocaleDateString()}
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
              Auto-Renew: {dashboard.subscriptionAutoRenew ? 'ON' : 'OFF'}
            </button>
            {dashboard.subscriptionPlan !== 'free' && dashboard.subscriptionStatus === 'active' && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void onDashboardAction({ action: 'update_subscription', subAction: 'cancel' })}
                className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-700 dark:text-rose-200"
              >
                Cancel Renewal
              </button>
            )}
          </div>
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
                      disabled={isBusy}
                      onClick={() =>
                        void onDashboardAction({
                          action: 'update_subscription',
                          plan: p.id,
                          paymentMethod: 'wallet',
                          subAction: 'subscribe',
                        })
                      }
                      className="py-2 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black transition disabled:opacity-50"
                    >
                      Pay Wallet ({p.priceLabel.split(' ')[0]})
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void onDashboardAction({
                          action: 'update_subscription',
                          plan: p.id,
                          paymentMethod: 'choy_wallet',
                          subAction: 'subscribe',
                        })
                      }
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
              <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800">
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
                        onClick={() => setBuyingItem(item)}
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
            <div className="bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-emerald-950 dark:text-white">
                  {editingItem.id ? 'Admin Set Up: Edit Item' : 'Admin Set Up: Add New Item'}
                </h3>
                <button
                  onClick={() => setIsEditItemModalOpen(false)}
                  className="p-1 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMarketplaceItem} className="space-y-3">
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

                <div className="space-y-1">
                  <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Image URL (Cloudinary / Unsplash / Web)</label>
                  <input
                    type="url"
                    value={editingItem.imageUrl || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                  />
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
                    disabled={marketLoading}
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
            <div className="bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-emerald-950 dark:text-white">Checkout: {buyingItem.title}</h3>
                <button
                  onClick={() => setBuyingItem(null)}
                  className="p-1 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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

                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-xs font-black text-orange-950 dark:text-orange-200 flex items-center justify-between">
                  <span>Total Amount Due:</span>
                  <span className="text-sm">₱{(buyingItem.price * buyQuantity).toFixed(2)}</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBuyingItem(null)}
                    className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={marketLoading}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Confirm Purchase</span>
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
              {marketplaceOrders.map((ord: any) => (
                <div key={ord.id} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-emerald-950 dark:text-white">Order #{ord.id.slice(-6)}</span>
                    <span className="text-emerald-700 dark:text-emerald-300 ml-2">by {ord.userName}</span>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {ord.items.map((it: any) => `${it.quantity}x ${it.title}`).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-orange-600 dark:text-orange-400">₱{Number(ord.totalAmount).toFixed(2)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold uppercase text-[10px]">
                      {ord.paymentMethod}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isCartOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-emerald-950 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-500" />
                  <span>Shopping Cart ({cartItems.reduce((acc, ci) => acc + ci.quantity, 0)})</span>
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cartItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-emerald-700 dark:text-emerald-300">
                  Your shopping cart is empty. Add items from the store!
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
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
                <div className="space-y-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
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

                  <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-xs font-black text-orange-950 dark:text-orange-200 flex items-center justify-between">
                    <span>Total Cart Amount:</span>
                    <span className="text-sm">₱{cartItems.reduce((acc, ci) => acc + (ci.item.price * ci.quantity), 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
                      className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-xs font-bold"
                    >
                      Continue Shopping
                    </button>
                    <button
                      type="button"
                      disabled={marketLoading}
                      onClick={() => void handleCartCheckout()}
                      className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Complete Checkout</span>
                    </button>
                  </div>
                </div>
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
