import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Coins,
  Edit3,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  DEFAULT_FEATURE_TOGGLES,
  type ChoyProgramsConfig,
} from './AdminChoySetupPanel';
import type { UserDashboardData } from './UserDashboardPanels';

export type InvestPanelView = 'dashboard' | 'admin';

export interface InvestProductItem {
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

export interface UserInvestmentLiveItem {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  productTitle: string;
  dailyRatePercent: number;
  durationDays: number;
  dailyEarning: number;
  totalTargetEarnings: number;
  claimedEarnings: number;
  startedAt: string;
  endsAt: string;
  totalMinutes?: number;
  completedMinutes?: number;
  perMinuteEarning?: number;
  earnedSoFar?: number;
  unclaimedEarnings?: number;
  claimableNow?: number;
  isCompleted?: boolean;
  nextTickInSeconds?: number;
}

export interface AdminInvestmentOverviewItem extends UserInvestmentLiveItem {
  principalAmount: number;
}

interface InvestPanelProps {
  currentUser: {
    id: string;
    name: string;
    phone: string;
    role: 'admin' | 'member';
  };
  authToken?: string;
  dashboard: UserDashboardData;
  choyProgramsConfig: ChoyProgramsConfig;
  initialView?: InvestPanelView;
  onOwnDashboardUpdated: (next: UserDashboardData) => void;
  onConfigSaved: (next: ChoyProgramsConfig) => void;
}

function formatPhp(amount: number, decimals = 2): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function computeClientLiveMetrics(inv: UserInvestmentLiveItem, nowMs: number) {
  const startedMs = Date.parse(inv.startedAt) || nowMs;
  const durationDays = Math.max(1, Math.floor(Number(inv.durationDays) || 30));
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
  const progressPct = totalMinutes > 0 ? Math.min(100, (completedMinutes / totalMinutes) * 100) : 0;
  const completedDays = Math.floor(completedMinutes / 1440);

  return {
    totalMinutes,
    completedMinutes,
    completedDays,
    perMinuteEarning,
    earnedSoFar,
    claimedEarnings,
    unclaimedEarnings,
    claimableNow,
    isCompleted,
    nextTickInSeconds,
    progressPct,
  };
}

export const InvestPanel: React.FC<InvestPanelProps> = ({
  currentUser,
  authToken,
  dashboard,
  choyProgramsConfig,
  initialView = 'dashboard',
  onOwnDashboardUpdated,
  onConfigSaved,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [view, setView] = useState<InvestPanelView>(isAdmin && initialView === 'admin' ? 'admin' : 'dashboard');

  useEffect(() => {
    if (isAdmin && initialView === 'admin') {
      setView('admin');
    } else if (initialView === 'dashboard') {
      setView('dashboard');
    }
  }, [initialView, isAdmin]);

  const [products, setProducts] = useState<InvestProductItem[]>([]);
  const [myInvestments, setMyInvestments] = useState<UserInvestmentLiveItem[]>([]);
  const [adminInvestments, setAdminInvestments] = useState<AdminInvestmentOverviewItem[]>([]);
  const [investEnabled, setInvestEnabled] = useState<boolean>(
    choyProgramsConfig.featureToggles?.invest !== false
  );
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [loading, setLoading] = useState(true);
  const [busyBuyId, setBusyBuyId] = useState<string | null>(null);
  const [busyClaimId, setBusyClaimId] = useState<string | null>(null);
  const [busyToggle, setBusyToggle] = useState(false);
  const [busyProductSave, setBusyProductSave] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<InvestProductItem | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');

  // Admin product form state
  const [editingProductId, setEditingProductId] = useState<string>('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('1000');
  const [formRate, setFormRate] = useState('5');
  const [formDays, setFormDays] = useState('30');
  const [formBadge, setFormBadge] = useState('');
  const [formActive, setFormActive] = useState(true);

  useEffect(() => {
    setInvestEnabled(choyProgramsConfig.featureToggles?.invest !== false);
  }, [choyProgramsConfig.featureToggles?.invest]);

  // 1-second live clock so every minute tick updates live earnings & next-minute countdown smoothly
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now() + serverOffsetMs);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [serverOffsetMs]);

  const authHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    return headers;
  }, [authToken]);

  const loadInvestData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/choy/invest/state', {
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load Invest dashboard.');
      }
      setProducts(Array.isArray(data.products) ? data.products : []);
      setMyInvestments(Array.isArray(data.investments) ? data.investments : []);
      if (typeof data.investEnabled === 'boolean') {
        setInvestEnabled(data.investEnabled);
      }
      if (typeof data.serverTime === 'string') {
        const parsed = Date.parse(data.serverTime);
        if (Number.isFinite(parsed)) {
          const offset = parsed - Date.now();
          setServerOffsetMs(offset);
          setNowMs(Date.now() + offset);
        }
      }

      if (isAdmin) {
        const adminRes = await fetch('/api/choy/admin/invest/overview', {
          headers: authHeaders(),
          credentials: 'include',
        });
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          if (Array.isArray(adminData.products)) setProducts(adminData.products);
          if (Array.isArray(adminData.investments)) setAdminInvestments(adminData.investments);
          if (typeof adminData.investEnabled === 'boolean') setInvestEnabled(adminData.investEnabled);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load Invest dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authHeaders, isAdmin]);

  useEffect(() => {
    void loadInvestData(false);
  }, [loadInvestData]);

  // Live metrics across all of the current user's investments — ALL EARNINGS ONLY (never principal/bought amount)
  const liveInvestments = useMemo(() => {
    return myInvestments.map((inv) => ({
      inv,
      metrics: computeClientLiveMetrics(inv, nowMs),
    }));
  }, [myInvestments, nowMs]);

  const summary = useMemo(() => {
    let allLiveEarnings = 0;
    let totalDailyEarnings = 0;
    let totalPerMinuteGrowth = 0;
    let total30DayTargetEarnings = 0;
    let totalClaimedEarnings = 0;
    let totalUnclaimedEarnings = 0;
    let totalClaimableNow = 0;
    let activeCount = 0;
    let nextTickSec: number | null = null;

    for (const { inv, metrics } of liveInvestments) {
      allLiveEarnings += metrics.earnedSoFar;
      total30DayTargetEarnings += inv.totalTargetEarnings;
      totalClaimedEarnings += metrics.claimedEarnings;
      totalUnclaimedEarnings += metrics.unclaimedEarnings;
      totalClaimableNow += metrics.claimableNow;
      if (!metrics.isCompleted) {
        activeCount += 1;
        totalDailyEarnings += inv.dailyEarning;
        totalPerMinuteGrowth += metrics.perMinuteEarning;
        if (nextTickSec === null || metrics.nextTickInSeconds < nextTickSec) {
          nextTickSec = metrics.nextTickInSeconds;
        }
      }
    }

    return {
      allLiveEarnings: Math.round(allLiveEarnings * 10000) / 10000,
      totalDailyEarnings: Math.round(totalDailyEarnings * 100) / 100,
      totalPerMinuteGrowth,
      total30DayTargetEarnings: Math.round(total30DayTargetEarnings * 100) / 100,
      totalClaimedEarnings: Math.round(totalClaimedEarnings * 100) / 100,
      totalUnclaimedEarnings: Math.round(totalUnclaimedEarnings * 10000) / 10000,
      totalClaimableNow: Math.floor(totalClaimableNow * 100) / 100,
      activeCount,
      nextTickSec,
    };
  }, [liveInvestments]);

  const handleConfirmBuy = async () => {
    if (!confirmProduct) return;
    setErrorMsg('');
    setNoticeMsg('');
    setBusyBuyId(confirmProduct.id);
    try {
      const res = await fetch('/api/choy/invest/buy', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ productId: confirmProduct.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to buy investment plan.');
      }
      if (Array.isArray(data.investments)) {
        setMyInvestments(data.investments);
      }
      if (data.userDashboard) {
        onOwnDashboardUpdated(data.userDashboard);
      }
      const daily = Math.round(confirmProduct.price * (confirmProduct.dailyRatePercent / 100) * 100) / 100;
      const total = Math.round(daily * confirmProduct.durationDays * 100) / 100;
      setNoticeMsg(
        `${confirmProduct.title} is now LIVE! Earning ${formatPhp(daily)}/day (${formatPhp(total)} in ${confirmProduct.durationDays} days) — live counting every minute.`
      );
      setConfirmProduct(null);
      if (isAdmin) void loadInvestData(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to buy investment plan.');
    } finally {
      setBusyBuyId(null);
    }
  };

  const handleClaimEarnings = async (investmentId?: string) => {
    setErrorMsg('');
    setNoticeMsg('');
    setBusyClaimId(investmentId || 'all');
    try {
      const res = await fetch('/api/choy/invest/claim', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify(investmentId ? { investmentId } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to claim live earnings.');
      }
      if (Array.isArray(data.investments)) {
        setMyInvestments(data.investments);
      }
      if (data.userDashboard) {
        onOwnDashboardUpdated(data.userDashboard);
      }
      setNoticeMsg(
        `Claimed ${formatPhp(Number(data.claimedAmount || 0))} live earnings into your Cash Wallet!`
      );
      if (isAdmin) void loadInvestData(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to claim live earnings.');
    } finally {
      setBusyClaimId(null);
    }
  };

  const handleToggleInvestFeature = async (nextEnabled: boolean) => {
    if (!isAdmin) return;
    setErrorMsg('');
    setNoticeMsg('');
    setBusyToggle(true);
    try {
      const nextPayload: ChoyProgramsConfig = {
        ...choyProgramsConfig,
        featureToggles: {
          ...DEFAULT_FEATURE_TOGGLES,
          ...(choyProgramsConfig.featureToggles || {}),
          invest: nextEnabled,
        },
      };
      const res = await fetch('/api/choy/programs-config', {
        method: 'PUT',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify(nextPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update Invest feature toggle.');
      }
      const savedConfig: ChoyProgramsConfig = data.choyProgramsConfig || nextPayload;
      onConfigSaved(savedConfig);
      setInvestEnabled(savedConfig.featureToggles?.invest !== false);
      setNoticeMsg(
        nextEnabled
          ? 'Invest is now ENABLED for all users.'
          : 'Invest is now DISABLED — users will see Coming Soon on their dashboard.'
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to toggle Invest feature.');
    } finally {
      setBusyToggle(false);
    }
  };

  const resetProductForm = () => {
    setEditingProductId('');
    setFormTitle('');
    setFormDescription('');
    setFormPrice('1000');
    setFormRate('5');
    setFormDays('30');
    setFormBadge('');
    setFormActive(true);
  };

  const startEditProduct = (prod: InvestProductItem) => {
    setEditingProductId(prod.id);
    setFormTitle(prod.title);
    setFormDescription(prod.description);
    setFormPrice(String(prod.price));
    setFormRate(String(prod.dailyRatePercent));
    setFormDays(String(prod.durationDays));
    setFormBadge(prod.badge || '');
    setFormActive(prod.active);
    setErrorMsg('');
    setNoticeMsg('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setErrorMsg('');
    setNoticeMsg('');
    setBusyProductSave(true);
    try {
      const res = await fetch('/api/choy/admin/invest/products', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          id: editingProductId || undefined,
          title: formTitle.trim(),
          description: formDescription.trim(),
          price: Number(formPrice),
          dailyRatePercent: Number(formRate) || 5,
          durationDays: Number(formDays) || 30,
          badge: formBadge.trim(),
          active: formActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save investment product.');
      }
      if (Array.isArray(data.products)) {
        setProducts(data.products);
      }
      setNoticeMsg(editingProductId ? 'Investment product updated!' : 'New investment product added!');
      resetProductForm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save investment product.');
    } finally {
      setBusyProductSave(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!isAdmin) return;
    setErrorMsg('');
    setNoticeMsg('');
    setBusyDeleteId(productId);
    try {
      const res = await fetch(`/api/choy/admin/invest/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete investment product.');
      }
      if (Array.isArray(data.products)) {
        setProducts(data.products);
      }
      if (editingProductId === productId) resetProductForm();
      setNoticeMsg('Investment product removed.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete investment product.');
    } finally {
      setBusyDeleteId(null);
    }
  };

  const previewPrice = Math.max(0, Number(formPrice) || 0);
  const previewRate = Math.max(0, Number(formRate) || 5);
  const previewDays = Math.max(1, Math.floor(Number(formDays) || 30));
  const previewDaily = Math.round(previewPrice * (previewRate / 100) * 100) / 100;
  const previewTotal = Math.round(previewDaily * previewDays * 100) / 100;
  const previewPerMin = previewDays > 0 ? previewTotal / (previewDays * 1440) : 0;

  const visibleProductsForUsers = useMemo(
    () => products.filter((p) => p.active),
    [products]
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      {/* Header Bar */}
      <div className="rounded-3xl bg-gradient-to-br from-[#062C1E] via-[#0B3E2B] to-[#07261B] border border-emerald-400/25 p-5 sm:p-6 shadow-xl text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-300 text-slate-950 flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {view === 'admin' && isAdmin ? 'Admin Set Up: Invest' : 'Choy Invest Dashboard'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  5% / Day · 30 Days
                </span>
                {!investEnabled && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/80 text-white">
                    Disabled (Coming Soon)
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-0.5">
                {view === 'admin' && isAdmin
                  ? 'Enable/Disable Invest for members, manage Invest products, and monitor live member earnings.'
                  : 'Simple Interest 5% per day for 30 days with live per-minute earnings growth.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <div className="inline-flex rounded-xl bg-black/30 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setView('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    view === 'dashboard'
                      ? 'bg-emerald-400 text-slate-950 shadow'
                      : 'text-emerald-100/80 hover:text-white'
                  }`}
                >
                  Invest Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setView('admin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    view === 'admin'
                      ? 'bg-[#FF5A1F] text-white shadow'
                      : 'text-emerald-100/80 hover:text-white'
                  }`}
                >
                  Admin Set Up
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => void loadInvestData(false)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Feedback banners */}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-500/15 border border-rose-400/40 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-200 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {noticeMsg && (
        <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/40 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{noticeMsg}</span>
          </div>
          <button type="button" onClick={() => setNoticeMsg('')} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl bg-white dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 p-10 flex flex-col items-center justify-center gap-3 text-emerald-800 dark:text-emerald-200">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
          <p className="text-sm font-bold">Loading live Invest dashboard...</p>
        </div>
      ) : view === 'admin' && isAdmin ? (
        /* ======================== ADMIN SET UP VIEW ======================== */
        <div className="space-y-5">
          {/* Enable / Disable Toggle Card */}
          <div className="rounded-3xl bg-white dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    investEnabled
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                  }`}
                >
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-950 dark:text-white">
                    Invest Feature Status (User Dashboard)
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 max-w-xl">
                    {investEnabled
                      ? 'ENABLED: Members can open Invest, buy investment products, and watch live per-minute earnings.'
                      : 'DISABLED: Members see "Soon" on the Invest sidebar button and a "Coming Soon" screen.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={busyToggle}
                onClick={() => void handleToggleInvestFeature(!investEnabled)}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow ${
                  investEnabled
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-rose-500 hover:bg-rose-400 text-white'
                } disabled:opacity-50`}
              >
                {busyToggle ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Power className="w-4 h-4" />
                )}
                {investEnabled ? 'Enabled (Tap to Disable)' : 'Disabled (Tap to Enable)'}
              </button>
            </div>
          </div>

          {/* Add / Edit Invest Product Form */}
          <div className="rounded-3xl bg-white dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-black text-emerald-950 dark:text-white">
                  {editingProductId ? 'Edit Invest Product' : 'Add New Invest Product'}
                </h3>
              </div>
              {editingProductId && (
                <button
                  type="button"
                  onClick={resetProductForm}
                  className="text-xs font-bold text-rose-500 hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Growth Pack 1000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-sm text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  Badge (Optional)
                </label>
                <input
                  type="text"
                  value={formBadge}
                  onChange={(e) => setFormBadge(e.target.value)}
                  placeholder="e.g. Popular, Best Value"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-sm text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="5% daily simple interest for 30 days with live per-minute growth"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-sm text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  Product Price (₱)
                </label>
                <input
                  type="number"
                  required
                  min={10}
                  max={10000000}
                  step="any"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-sm font-bold text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                    Daily Rate (%)
                  </label>
                  <input
                    type="number"
                    required
                    min={0.1}
                    max={50}
                    step="0.1"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-sm font-bold text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={365}
                    value={formDays}
                    onChange={(e) => setFormDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-sm font-bold text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              {/* Simple Interest Calculation Preview */}
              <div className="md:col-span-2 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                    Simple Interest Preview:
                  </span>{' '}
                  <span className="text-emerald-900 dark:text-emerald-100">
                    {previewRate}% of {formatPhp(previewPrice)} ={' '}
                    <strong>{formatPhp(previewDaily)}/day</strong> × {previewDays} days ={' '}
                    <strong className="text-emerald-600 dark:text-emerald-300">
                      {formatPhp(previewTotal)} Total Earnings
                    </strong>{' '}
                    (+{formatPhp(previewPerMin, 4)}/min)
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded accent-emerald-500 w-4 h-4"
                  />
                  Active for Users
                </label>
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={busyProductSave}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition shadow disabled:opacity-50"
                >
                  {busyProductSave ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editingProductId ? 'Update Product' : 'Save Invest Product'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing Products List (Admin) */}
          <div className="rounded-3xl bg-white dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 p-5 shadow-sm space-y-3">
            <h3 className="text-base font-black text-emerald-950 dark:text-white">
              Manage Invest Products ({products.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map((prod) => {
                const daily = Math.round(prod.price * (prod.dailyRatePercent / 100) * 100) / 100;
                const total = Math.round(daily * prod.durationDays * 100) / 100;
                return (
                  <div
                    key={prod.id}
                    className="rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-900/30 p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-sm text-emerald-950 dark:text-white">
                          {prod.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            prod.active
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-400/20 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {prod.active ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                        {prod.description}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] font-bold">
                        <span className="px-2 py-1 rounded-lg bg-white dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800">
                          Price: {formatPhp(prod.price)}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
                          {prod.dailyRatePercent}%/day ({formatPhp(daily)}/day)
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200">
                          {prod.durationDays}d Total: {formatPhp(total)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50">
                      <button
                        type="button"
                        onClick={() => startEditProduct(prod)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyDeleteId === prod.id}
                        onClick={() => void handleDeleteProduct(prod.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                      >
                        {busyDeleteId === prod.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Member Active Investments Overview (Admin Only) */}
          <div className="rounded-3xl bg-white dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-black text-emerald-950 dark:text-white">
                Member Investments &amp; Live Earnings ({adminInvestments.length})
              </h3>
            </div>
            {adminInvestments.length === 0 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                No members have activated an Invest product yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                      <th className="py-2 pr-3 font-bold">Member</th>
                      <th className="py-2 pr-3 font-bold">Plan</th>
                      <th className="py-2 pr-3 font-bold">Daily</th>
                      <th className="py-2 pr-3 font-bold">Live Earned</th>
                      <th className="py-2 pr-3 font-bold">Claimed</th>
                      <th className="py-2 font-bold">30d Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/60">
                    {adminInvestments.map((item) => {
                      const m = computeClientLiveMetrics(item, nowMs);
                      return (
                        <tr key={item.id} className="text-emerald-950 dark:text-emerald-100">
                          <td className="py-2.5 pr-3 font-bold">{item.userName}</td>
                          <td className="py-2.5 pr-3">{item.productTitle}</td>
                          <td className="py-2.5 pr-3 font-semibold">{formatPhp(item.dailyEarning)}/d</td>
                          <td className="py-2.5 pr-3 font-black text-emerald-600 dark:text-emerald-300">
                            {formatPhp(m.earnedSoFar, 4)}
                          </td>
                          <td className="py-2.5 pr-3">{formatPhp(m.claimedEarnings)}</td>
                          <td className="py-2.5 font-bold">{formatPhp(item.totalTargetEarnings)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ======================== USER INVEST DASHBOARD ======================== */
        <div className="space-y-6">
          {/* ALL EARNINGS HERO (Strictly shows ALL EARNINGS ONLY — NEVER shows bought/principal amount) */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-[#083B28] to-slate-950 border border-emerald-400/30 p-5 sm:p-6 text-white shadow-xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase tracking-widest">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                  All Earnings (Live Counting Every Minute)
                </div>
                <div className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-emerald-300 tabular-nums">
                  {formatPhp(summary.allLiveEarnings, 4)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-emerald-100/85">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/25 font-bold text-emerald-200">
                    <Activity className="w-3.5 h-3.5 text-emerald-300" />
                    +{formatPhp(summary.totalPerMinuteGrowth, 4)} / min
                  </span>
                  {summary.nextTickSec !== null && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 font-bold text-amber-200 tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      Next live increase in {summary.nextTickSec}s
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2">
                <button
                  type="button"
                  disabled={busyClaimId !== null || summary.totalClaimableNow < 0.01}
                  onClick={() => void handleClaimEarnings()}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-slate-950 font-black text-sm shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {busyClaimId === 'all' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Coins className="w-4 h-4" />
                  )}
                  Claim Earnings ({formatPhp(summary.totalClaimableNow)})
                </button>
                <div className="text-[11px] text-emerald-200/80 flex items-center gap-1.5 justify-end">
                  <Wallet className="w-3.5 h-3.5" />
                  Cash Wallet Balance: <strong className="text-white">{formatPhp(dashboard.walletBalance)}</strong>
                </div>
              </div>
            </div>

            {/* Earnings-Only KPI Strip — Zero Principal/Bought Amount Displayed */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/10">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
                <div className="text-[11px] font-bold text-emerald-200/75 uppercase tracking-wider">
                  Daily Earnings (5%/day)
                </div>
                <div className="mt-1 text-lg sm:text-xl font-black text-white tabular-nums">
                  {formatPhp(summary.totalDailyEarnings)}
                </div>
                <div className="text-[10px] text-emerald-300/80 mt-0.5">Active simple interest / day</div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
                <div className="text-[11px] font-bold text-emerald-200/75 uppercase tracking-wider">
                  30-Day Target Earnings
                </div>
                <div className="mt-1 text-lg sm:text-xl font-black text-amber-300 tabular-nums">
                  {formatPhp(summary.total30DayTargetEarnings)}
                </div>
                <div className="text-[10px] text-emerald-300/80 mt-0.5">Total earnings after 30 days</div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
                <div className="text-[11px] font-bold text-emerald-200/75 uppercase tracking-wider">
                  Unclaimed Live Earnings
                </div>
                <div className="mt-1 text-lg sm:text-xl font-black text-emerald-300 tabular-nums">
                  {formatPhp(summary.totalUnclaimedEarnings, 4)}
                </div>
                <div className="text-[10px] text-emerald-300/80 mt-0.5">Ready to withdraw to Wallet</div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
                <div className="text-[11px] font-bold text-emerald-200/75 uppercase tracking-wider">
                  Already Claimed
                </div>
                <div className="mt-1 text-lg sm:text-xl font-black text-teal-200 tabular-nums">
                  {formatPhp(summary.totalClaimedEarnings)}
                </div>
                <div className="text-[10px] text-emerald-300/80 mt-0.5">Credited to Cash Wallet</div>
              </div>
            </div>
          </div>

          {/* MY ACTIVE LIVE EARNINGS (Strictly shows earnings only — NEVER bought amount) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base sm:text-lg font-black text-emerald-950 dark:text-white">
                  Live Earnings Tracker ({liveInvestments.length})
                </h3>
              </div>
              {summary.activeCount > 0 && (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {summary.activeCount} live counting now
                </span>
              )}
            </div>

            {liveInvestments.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-emerald-950/50 border border-dashed border-emerald-300 dark:border-emerald-700/70 p-6 text-center space-y-2">
                <Sparkles className="w-7 h-7 text-emerald-500 mx-auto" />
                <p className="text-sm font-black text-emerald-950 dark:text-white">
                  No active live earnings yet
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
                  Tap <strong>Buy Me</strong> on any Invest product below to start earning 5% per day for 30 days with live per-minute counting.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveInvestments.map(({ inv, metrics }) => (
                  <div
                    key={inv.id}
                    className="rounded-3xl bg-white dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 p-5 shadow-sm space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-black text-emerald-950 dark:text-white">
                          {inv.productTitle}
                        </h4>
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          {inv.dailyRatePercent}%/day · {inv.durationDays} Days Simple Interest
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                          metrics.isCompleted
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {metrics.isCompleted ? 'Completed' : 'Live Counting'}
                      </span>
                    </div>

                    {/* Live Earnings Figure (NO principal/bought amount) */}
                    <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/40 border border-emerald-200/70 dark:border-emerald-800/60 p-3.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <span>Live Earnings So Far</span>
                        <span className="tabular-nums text-emerald-600 dark:text-emerald-300">
                          +{formatPhp(metrics.perMinuteEarning, 4)} / min
                        </span>
                      </div>
                      <div className="mt-1 text-2xl font-black text-emerald-950 dark:text-emerald-300 tabular-nums">
                        {formatPhp(metrics.earnedSoFar, 4)}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="text-emerald-800 dark:text-emerald-200">
                          Daily: <strong>{formatPhp(inv.dailyEarning)}/day</strong>
                        </div>
                        <div className="text-emerald-800 dark:text-emerald-200 text-right">
                          30-Day Total: <strong>{formatPhp(inv.totalTargetEarnings)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Minute-by-minute progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        <span>
                          Minute {metrics.completedMinutes.toLocaleString()} /{' '}
                          {metrics.totalMinutes.toLocaleString()} (Day {metrics.completedDays}/{inv.durationDays})
                        </span>
                        <span>
                          {metrics.isCompleted
                            ? '100%'
                            : `Next +${formatPhp(metrics.perMinuteEarning, 4)} in ${metrics.nextTickInSeconds}s`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                          style={{ width: `${Math.max(metrics.progressPct, metrics.isCompleted ? 100 : 1.5)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <div className="text-emerald-700 dark:text-emerald-300">
                        Unclaimed:{' '}
                        <strong className="text-emerald-950 dark:text-white tabular-nums">
                          {formatPhp(metrics.unclaimedEarnings, 4)}
                        </strong>
                      </div>
                      <button
                        type="button"
                        disabled={busyClaimId !== null || metrics.claimableNow < 0.01}
                        onClick={() => void handleClaimEarnings(inv.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {busyClaimId === inv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Coins className="w-3.5 h-3.5" />
                        )}
                        Claim {formatPhp(metrics.claimableNow)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* INVEST PRODUCTS CATALOG WITH "BUY ME" */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#FF5A1F]" />
                <h3 className="text-base sm:text-lg font-black text-emerald-950 dark:text-white">
                  Invest Products
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Simple Interest: 5% per day × 30 days
              </span>
            </div>

            {visibleProductsForUsers.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 p-8 text-center text-sm text-emerald-700 dark:text-emerald-300">
                No active Invest products right now. Please check back soon.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {visibleProductsForUsers.map((prod) => {
                  const daily = Math.round(prod.price * (prod.dailyRatePercent / 100) * 100) / 100;
                  const total = Math.round(daily * prod.durationDays * 100) / 100;
                  const perMin = prod.durationDays > 0 ? total / (prod.durationDays * 1440) : 0;

                  return (
                    <div
                      key={prod.id}
                      className="rounded-3xl bg-white dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 p-5 shadow-sm hover:border-emerald-400/70 transition flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-base font-black text-emerald-950 dark:text-white">
                              {prod.title}
                            </h4>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                              {prod.description}
                            </p>
                          </div>
                          {prod.badge && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30 shrink-0">
                              {prod.badge}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 p-2.5 border border-emerald-200/70 dark:border-emerald-800/60">
                            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                              Daily ({prod.dailyRatePercent}%)
                            </div>
                            <div className="text-sm font-black text-emerald-950 dark:text-white mt-0.5">
                              {formatPhp(daily)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 p-2.5 border border-emerald-200/70 dark:border-emerald-800/60">
                            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                              Duration
                            </div>
                            <div className="text-sm font-black text-emerald-950 dark:text-white mt-0.5">
                              {prod.durationDays} Days
                            </div>
                          </div>
                          <div className="rounded-2xl bg-amber-500/15 p-2.5 border border-amber-400/30">
                            <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                              Total Earnings
                            </div>
                            <div className="text-sm font-black text-amber-700 dark:text-amber-300 mt-0.5">
                              {formatPhp(total)}
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                          <span>Live per-minute growth:</span>
                          <span className="font-black text-emerald-600 dark:text-emerald-300 tabular-nums">
                            +{formatPhp(perMin, 4)} / min
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={busyBuyId !== null}
                        onClick={() => {
                          setErrorMsg('');
                          setConfirmProduct(prod);
                        }}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF5A1F] to-amber-500 hover:from-[#FF6B35] hover:to-amber-400 text-white font-black text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Buy Me · {formatPhp(prod.price)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* IN-APP BUY CONFIRMATION MODAL */}
      {confirmProduct && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#07261B] border border-emerald-300 dark:border-emerald-700/70 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-950 dark:text-white">
                    Confirm Invest Purchase
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {confirmProduct.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmProduct(null)}
                className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const daily =
                Math.round(confirmProduct.price * (confirmProduct.dailyRatePercent / 100) * 100) / 100;
              const total = Math.round(daily * confirmProduct.durationDays * 100) / 100;
              const perMin = confirmProduct.durationDays > 0 ? total / (confirmProduct.durationDays * 1440) : 0;
              const insufficient = dashboard.walletBalance < confirmProduct.price;
              return (
                <>
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/70 p-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-emerald-300">Plan Price (from Cash Wallet)</span>
                      <strong className="text-emerald-950 dark:text-white">{formatPhp(confirmProduct.price)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-emerald-300">Rate &amp; Duration</span>
                      <strong className="text-emerald-950 dark:text-white">
                        {confirmProduct.dailyRatePercent}% / day × {confirmProduct.durationDays} days
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-emerald-300">Daily Earning</span>
                      <strong className="text-emerald-600 dark:text-emerald-300">{formatPhp(daily)} / day</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-emerald-300">Live Growth Per Minute</span>
                      <strong className="text-emerald-600 dark:text-emerald-300">+{formatPhp(perMin, 4)} / min</strong>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-emerald-200 dark:border-emerald-800">
                      <span className="font-bold text-emerald-900 dark:text-emerald-100">
                        Total {confirmProduct.durationDays}-Day Earnings
                      </span>
                      <strong className="text-base font-black text-amber-600 dark:text-amber-300">
                        {formatPhp(total)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-emerald-700 dark:text-emerald-300">Your Cash Wallet Balance:</span>
                    <strong className={insufficient ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}>
                      {formatPhp(dashboard.walletBalance)}
                    </strong>
                  </div>

                  {insufficient && (
                    <div className="rounded-xl bg-rose-500/15 border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-200">
                      Insufficient Cash Wallet balance. Please top up your Cash Wallet first via Wallet or Payment Terminal.
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setConfirmProduct(null)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={insufficient || busyBuyId !== null}
                      onClick={() => void handleConfirmBuy()}
                      className="px-5 py-2.5 rounded-xl bg-[#FF5A1F] hover:bg-[#FF6B35] text-white text-xs font-black flex items-center gap-2 transition disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {busyBuyId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Confirm Buy Me
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
