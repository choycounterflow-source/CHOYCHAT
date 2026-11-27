import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react';
import type { UserDashboardData } from './UserDashboardPanels';

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

export interface ChoyProgramsConfig {
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
  updatedAt: string;
}

export const DEFAULT_CLIENT_CHOY_PROGRAMS_CONFIG: ChoyProgramsConfig = {
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
  updatedAt: '',
};

export type AdminChoySetupTab = 'choy_pro' | 'choy_promo' | 'choy_wallet';

interface AdminChoySetupPanelProps {
  config: ChoyProgramsConfig;
  initialTab?: AdminChoySetupTab;
  members: Array<{ id: string; name: string; phone?: string; role?: 'admin' | 'member' }>;
  onConfigSaved: (next: ChoyProgramsConfig) => void;
  onOwnDashboardUpdated?: (next: UserDashboardData) => void;
  onNavigateTab?: (tab: 'choy_pro' | 'subscription' | 'choy_wallet' | 'marketplace') => void;
}

export const AdminChoySetupPanel: React.FC<AdminChoySetupPanelProps> = ({
  config,
  initialTab = 'choy_pro',
  members,
  onConfigSaved,
  onOwnDashboardUpdated,
  onNavigateTab,
}) => {
  const [subTab, setSubTab] = useState<AdminChoySetupTab>(initialTab);
  const [draft, setDraft] = useState<ChoyProgramsConfig>(config);
  const [perksText, setPerksText] = useState<string>(config.choyPro.perks.join('\n'));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New / Edit Promo Draft
  const [promoCode, setPromoCode] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoDiscountType, setPromoDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [promoDiscountValue, setPromoDiscountValue] = useState('10');
  const [promoAppliesTo, setPromoAppliesTo] = useState<'all' | 'marketplace' | 'subscription'>('all');
  const [promoMinSpend, setPromoMinSpend] = useState('0');
  const [promoExpiresAt, setPromoExpiresAt] = useState('');

  // Admin Member Top-Up / Adjust State
  const [topupMemberId, setTopupMemberId] = useState('');
  const [topupWalletType, setTopupWalletType] = useState<'choy_wallet' | 'wallet'>('choy_wallet');
  const [topupMode, setTopupMode] = useState<'credit' | 'debit'>('credit');
  const [topupAmount, setTopupAmount] = useState('100');
  const [topupNote, setTopupNote] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);

  useEffect(() => {
    setSubTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setDraft(config);
    setPerksText(config.choyPro.perks.join('\n'));
  }, [config]);

  const persistConfig = async (nextConfig: ChoyProgramsConfig, successLabel: string) => {
    setSaving(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await fetch('/api/choy/programs-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(nextConfig),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Admin setup.');
      }
      if (data.choyProgramsConfig) {
        setDraft(data.choyProgramsConfig);
        setPerksText(data.choyProgramsConfig.choyPro.perks.join('\n'));
        onConfigSaved(data.choyProgramsConfig);
      }
      setNotice(successLabel);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save setup.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPerks = perksText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const nextConfig: ChoyProgramsConfig = {
      ...draft,
      choyPro: {
        ...draft.choyPro,
        perks: cleanedPerks.length > 0 ? cleanedPerks : draft.choyPro.perks,
      },
    };
    await persistConfig(nextConfig, 'Choy Pro Subscription setup saved & synced live!');
  };

  const handleSaveWalletSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistConfig(draft, 'Choy Wallet setup saved & synced live!');
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setErrorMsg('Enter a promo code using letters or numbers (e.g. CHOY20).');
      return;
    }
    if (draft.promos.some((p) => p.code.toUpperCase() === cleanCode)) {
      setErrorMsg(`Promo code "${cleanCode}" already exists.`);
      return;
    }
    const newPromo: ChoyPromoItem = {
      id: `promo_${Date.now().toString(36)}`,
      code: cleanCode,
      title: promoTitle.trim() || `${cleanCode} Special Promo`,
      description: promoDesc.trim(),
      discountType: promoDiscountType,
      discountValue: Math.max(1, Number(promoDiscountValue) || 10),
      appliesTo: promoAppliesTo,
      minSpend: Math.max(0, Number(promoMinSpend) || 0),
      active: true,
      expiresAt: promoExpiresAt.trim() || undefined,
    };
    const nextConfig: ChoyProgramsConfig = {
      ...draft,
      promos: [newPromo, ...draft.promos],
    };
    await persistConfig(nextConfig, `Choy Promo "${cleanCode}" added & activated!`);
    setPromoCode('');
    setPromoTitle('');
    setPromoDesc('');
    setPromoDiscountValue('10');
    setPromoMinSpend('0');
    setPromoExpiresAt('');
  };

  const handleTogglePromo = async (promoId: string) => {
    const nextPromos = draft.promos.map((p) => (p.id === promoId ? { ...p, active: !p.active } : p));
    await persistConfig({ ...draft, promos: nextPromos }, 'Promo status updated.');
  };

  const handleDeletePromo = async (promoId: string) => {
    const nextPromos = draft.promos.filter((p) => p.id !== promoId);
    await persistConfig({ ...draft, promos: nextPromos }, 'Promo removed.');
  };

  const handleAdminMemberTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotice(null);
    if (!topupMemberId) {
      setErrorMsg('Select a member to credit or adjust.');
      return;
    }
    const amt = Number(topupAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg('Enter a valid amount greater than 0.');
      return;
    }
    try {
      setTopupBusy(true);
      const res = await fetch('/api/choy/admin/wallet-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: topupMemberId,
          walletType: topupWalletType,
          mode: topupMode,
          amount: amt,
          note: topupNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update member wallet.');
      }
      if (data.userDashboard) {
        onOwnDashboardUpdated?.(data.userDashboard);
      }
      const unitLabel = topupWalletType === 'choy_wallet' ? `${amt} CHOY` : `₱${amt.toFixed(2)}`;
      setNotice(
        `${topupMode === 'credit' ? 'Credited' : 'Deducted'} ${unitLabel} ${
          topupMode === 'credit' ? 'to' : 'from'
        } ${data.targetUserName || 'member'}'s ${topupWalletType === 'choy_wallet' ? 'Choy Wallet' : 'Cash Wallet'}.`
      );
      setTopupNote('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Wallet update failed.');
    } finally {
      setTopupBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="bg-white dark:bg-emerald-900/60 border border-indigo-200 dark:border-indigo-700/60 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              Admin Set Up Console
            </div>
            <h2 className="text-lg font-black text-emerald-950 dark:text-white">
              Choy Pro Subscription · Choy Promo · Choy Wallet
            </h2>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Configure live subscription pricing, promo codes, wallet conversion rates, and member CHOY top-ups.
            </p>
          </div>
        </div>
        {onNavigateTab && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('choy_pro')}
              className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-bold"
            >
              View Choy Pro
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('choy_wallet')}
              className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-bold"
            >
              View Choy Wallet
            </button>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setSubTab('choy_pro');
            setErrorMsg(null);
            setNotice(null);
          }}
          className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition ${
            subTab === 'choy_pro'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
              : 'bg-white dark:bg-emerald-900/60 border-emerald-200 dark:border-emerald-700/60 text-emerald-950 dark:text-white hover:border-indigo-400'
          }`}
        >
          <Crown className={`w-5 h-5 shrink-0 ${subTab === 'choy_pro' ? 'text-amber-300' : 'text-amber-500'}`} />
          <div className="min-w-0">
            <div className="text-xs font-black">Choy Pro Subscription</div>
            <div className={`text-[11px] truncate ${subTab === 'choy_pro' ? 'text-indigo-100' : 'text-emerald-700 dark:text-emerald-300'}`}>
              ₱{draft.choyPro.monthlyPhp}/mo · {draft.choyPro.monthlyChoy} CHOY
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('choy_promo');
            setErrorMsg(null);
            setNotice(null);
          }}
          className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition ${
            subTab === 'choy_promo'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
              : 'bg-white dark:bg-emerald-900/60 border-emerald-200 dark:border-emerald-700/60 text-emerald-950 dark:text-white hover:border-indigo-400'
          }`}
        >
          <Tag className={`w-5 h-5 shrink-0 ${subTab === 'choy_promo' ? 'text-orange-300' : 'text-orange-500'}`} />
          <div className="min-w-0">
            <div className="text-xs font-black">Choy Promo</div>
            <div className={`text-[11px] truncate ${subTab === 'choy_promo' ? 'text-indigo-100' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {draft.promos.filter((p) => p.active).length} active · {draft.promos.length} total
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('choy_wallet');
            setErrorMsg(null);
            setNotice(null);
          }}
          className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition ${
            subTab === 'choy_wallet'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
              : 'bg-white dark:bg-emerald-900/60 border-emerald-200 dark:border-emerald-700/60 text-emerald-950 dark:text-white hover:border-indigo-400'
          }`}
        >
          <Coins className={`w-5 h-5 shrink-0 ${subTab === 'choy_wallet' ? 'text-amber-300' : 'text-amber-500'}`} />
          <div className="min-w-0">
            <div className="text-xs font-black">Choy Wallet</div>
            <div className={`text-[11px] truncate ${subTab === 'choy_wallet' ? 'text-indigo-100' : 'text-emerald-700 dark:text-emerald-300'}`}>
              ₱1 = {draft.choyWallet.conversionRate} CHOY · Top-Up Tool
            </div>
          </div>
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-800 dark:text-rose-200"
        >
          {errorMsg}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/70 border border-emerald-400/70 text-xs font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <span>{notice}</span>
        </div>
      )}

      {/* TAB 1: CHOY PRO SUBSCRIPTION SETUP */}
      {subTab === 'choy_pro' && (
        <form
          onSubmit={handleSaveProSetup}
          className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 dark:border-emerald-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Choy Pro Subscription Pricing &amp; Perks Setup</span>
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Changes apply immediately to Choy Pro and Subscription checkout screens.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.choyPro.enabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    choyPro: { ...prev.choyPro, enabled: e.target.checked },
                  }))
                }
                className="accent-indigo-600 w-4 h-4"
              />
              <span className="text-xs font-black text-emerald-950 dark:text-white">
                {draft.choyPro.enabled ? 'Subscriptions Open' : 'Subscriptions Paused'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Monthly Plan */}
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5">
              <div className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase">Choy Pro Monthly</div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Cash Wallet Price (₱)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft.choyPro.monthlyPhp}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyPro: { ...prev.choyPro, monthlyPhp: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full p-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Choy Wallet Price (CHOY)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft.choyPro.monthlyChoy}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyPro: { ...prev.choyPro, monthlyChoy: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full p-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
                />
              </div>
            </div>

            {/* Annual Plan */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
              <div className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase">Choy Pro Annual</div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Cash Wallet Price (₱)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft.choyPro.annualPhp}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyPro: { ...prev.choyPro, annualPhp: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full p-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Choy Wallet Price (CHOY)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft.choyPro.annualChoy}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyPro: { ...prev.choyPro, annualChoy: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full p-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
                />
              </div>
            </div>

            {/* VIP Supporter Plan */}
            <div className="p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 space-y-2.5">
              <div className="text-xs font-black text-violet-900 dark:text-violet-200 uppercase">VIP Supporter</div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Cash Wallet Price (₱)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft.choyPro.vipPhp}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyPro: { ...prev.choyPro, vipPhp: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full p-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Choy Wallet Price (CHOY)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft.choyPro.vipChoy}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyPro: { ...prev.choyPro, vipChoy: Number(e.target.value) || 0 },
                    }))
                  }
                  className="w-full p-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Choy Pro Tagline</label>
            <input
              type="text"
              value={draft.choyPro.tagline}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  choyPro: { ...prev.choyPro, tagline: e.target.value },
                }))
              }
              className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              Choy Pro Benefits (one perk per line)
            </label>
            <textarea
              rows={5}
              value={perksText}
              onChange={(e) => setPerksText(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-2 shadow transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Choy Pro Setup</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CHOY PROMO SETUP */}
      {subTab === 'choy_promo' && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddPromo}
            className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span>Create New Choy Promo</span>
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Promos automatically appear for members and can be redeemed in Marketplace checkout, Choy Pro, or Subscriptions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Promo Code</label>
                <input
                  type="text"
                  required
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CHOY20"
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold uppercase text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Promo Title</label>
                <input
                  type="text"
                  required
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  placeholder="e.g. Weekend 20% Off Food"
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Applies To</label>
                <select
                  value={promoAppliesTo}
                  onChange={(e) => setPromoAppliesTo(e.target.value as 'all' | 'marketplace' | 'subscription')}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                >
                  <option value="all">All (Store + Subscriptions)</option>
                  <option value="marketplace">Food Store &amp; Marketplace Only</option>
                  <option value="subscription">Choy Pro &amp; Subscriptions Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Discount Type</label>
                <select
                  value={promoDiscountType}
                  onChange={(e) => setPromoDiscountType(e.target.value as 'percent' | 'fixed')}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                >
                  <option value="percent">Percentage (% Off)</option>
                  <option value="fixed">Fixed Amount (₱ / CHOY Off)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                  Discount Value ({promoDiscountType === 'percent' ? '%' : '₱ / CHOY'})
                </label>
                <input
                  type="number"
                  min="1"
                  max={promoDiscountType === 'percent' ? '95' : '100000'}
                  required
                  value={promoDiscountValue}
                  onChange={(e) => setPromoDiscountValue(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Minimum Spend (0 = None)</label>
                <input
                  type="number"
                  min="0"
                  value={promoMinSpend}
                  onChange={(e) => setPromoMinSpend(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Description / Mechanics</label>
                <input
                  type="text"
                  value={promoDesc}
                  onChange={(e) => setPromoDesc(e.target.value)}
                  placeholder="e.g. Valid for all orders above ₱200"
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={promoExpiresAt}
                  onChange={(e) => setPromoExpiresAt(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Add Choy Promo</span>
              </button>
            </div>
          </form>

          {/* Active & Saved Promos List */}
          <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-500" />
              <span>Configured Choy Promos ({draft.promos.length})</span>
            </h3>
            {draft.promos.length === 0 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                No Choy Promos created yet. Add one above to launch discounts!
              </p>
            ) : (
              <div className="space-y-2">
                {draft.promos.map((promo) => (
                  <div
                    key={promo.id}
                    className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-orange-500 text-slate-950 font-mono font-black text-xs">
                          {promo.code}
                        </span>
                        <span className="text-xs font-black text-emerald-950 dark:text-white">{promo.title}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-[10px] font-bold uppercase">
                          {promo.discountType === 'percent' ? `${promo.discountValue}% OFF` : `₱${promo.discountValue} OFF`}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-[10px] font-bold uppercase">
                          {promo.appliesTo}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        {promo.description || 'Active Choy discount promo'}
                        {promo.minSpend > 0 ? ` · Min spend: ₱${promo.minSpend}` : ''}
                        {promo.expiresAt ? ` · Expires: ${promo.expiresAt}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleTogglePromo(promo.id)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition ${
                          promo.active
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {promo.active ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDeletePromo(promo.id)}
                        className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-200 hover:bg-rose-200 transition"
                        title="Delete Promo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CHOY WALLET SETUP + ADMIN MEMBER TOP-UP */}
      {subTab === 'choy_wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form
            onSubmit={handleSaveWalletSetup}
            className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 shadow-xs space-y-4"
          >
            <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-500" />
              <span>Choy Wallet Rules &amp; Conversion Setup</span>
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Conversion Rate (CHOY Coins per ₱1.00)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                required
                value={draft.choyWallet.conversionRate}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    choyWallet: { ...prev.choyWallet, conversionRate: Number(e.target.value) || 1 },
                  }))
                }
                className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
              />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Preview: ₱100 = {Math.round(100 * draft.choyWallet.conversionRate * 100) / 100} CHOY Coins
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Min Convert (₱)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={draft.choyWallet.minConvertPhp}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyWallet: { ...prev.choyWallet, minConvertPhp: Number(e.target.value) || 1 },
                    }))
                  }
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Max Convert (₱)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={draft.choyWallet.maxConvertPhp}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyWallet: { ...prev.choyWallet, maxConvertPhp: Number(e.target.value) || 1000 },
                    }))
                  }
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.choyWallet.allowConvert}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyWallet: { ...prev.choyWallet, allowConvert: e.target.checked },
                    }))
                  }
                  className="accent-indigo-600 w-4 h-4"
                />
                <span>Allow Cash Wallet → CHOY Coin Conversion</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.choyWallet.allowTransfers}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      choyWallet: { ...prev.choyWallet, allowTransfers: e.target.checked },
                    }))
                  }
                  className="accent-indigo-600 w-4 h-4"
                />
                <span>Allow Member-to-Member CHOY Transfers</span>
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Top-Up Instructions (shown to members in Choy Wallet)
              </label>
              <textarea
                rows={3}
                value={draft.choyWallet.topUpInstructions}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    choyWallet: { ...prev.choyWallet, topUpInstructions: e.target.value },
                  }))
                }
                placeholder="e.g. Send GCash to 09XX-XXX-XXXX and message Admin with receipt..."
                className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center justify-center gap-2 shadow transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Choy Wallet Setup</span>
            </button>
          </form>

          {/* Admin Verified Member Top-Up / Adjustment */}
          <form
            onSubmit={handleAdminMemberTopup}
            className="bg-white dark:bg-emerald-900/60 border border-amber-300 dark:border-amber-700/70 rounded-2xl p-5 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-500" />
                <span>Admin Member Top-Up / Adjust Balance</span>
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Credit verified CHOY Coin top-ups or Cash Wallet loads directly into any member&apos;s account.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Select Member</label>
              <select
                required
                value={topupMemberId}
                onChange={(e) => setTopupMemberId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
              >
                <option value="">Choose member...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.role === 'admin' ? '(Admin)' : ''} {m.phone ? `· ${m.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Target Wallet</label>
                <select
                  value={topupWalletType}
                  onChange={(e) => setTopupWalletType(e.target.value as 'choy_wallet' | 'wallet')}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                >
                  <option value="choy_wallet">Choy Wallet (CHOY)</option>
                  <option value="wallet">Cash Wallet (PHP ₱)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Action</label>
                <select
                  value={topupMode}
                  onChange={(e) => setTopupMode(e.target.value as 'credit' | 'debit')}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                >
                  <option value="credit">Credit (+ Top Up)</option>
                  <option value="debit">Debit (- Deduct)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Amount ({topupWalletType === 'choy_wallet' ? 'CHOY Coins' : 'PHP ₱'})
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono font-bold text-emerald-950 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Reference / Audit Note</label>
              <input
                type="text"
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                placeholder="e.g. GCash Ref #849201 Verified Top-Up"
                className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={topupBusy || !topupMemberId}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-black inline-flex items-center justify-center gap-2 shadow transition disabled:opacity-50 ${
                topupMode === 'credit'
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {topupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              <span>
                {topupMode === 'credit' ? 'Credit Member Wallet' : 'Deduct from Member Wallet'}
              </span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
