import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  Delete,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Upload,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import type { ChoyProgramsConfig } from './AdminChoySetupPanel';
import type { UserDashboardData } from './UserDashboardPanels';

export type PaymentTerminalChannelId = 'gcash' | 'maya' | 'qrph' | 'bank_transfer' | 'online_card';
export type PaymentTerminalPurpose = 'wallet_topup' | 'choy_coins' | 'order_payment' | 'pos_payment';
export type PaymentTerminalStatus = 'pending' | 'approved' | 'rejected';
export type PaymentTerminalView = 'terminal' | 'history' | 'admin';

export interface PaymentTerminalConfig {
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

export interface PaymentTerminalTx {
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

const DEFAULT_TERMINAL_CONFIG: PaymentTerminalConfig = {
  enabled: true,
  merchantName: 'Choy Chat Merchant POS',
  terminalId: 'CHOY-POS-01',
  gcashEnabled: true,
  gcashName: 'Choy Chat Official',
  gcashNumber: '09361223978',
  mayaEnabled: true,
  mayaName: 'Choy Chat Official',
  mayaNumber: '0918 000 0000',
  qrphEnabled: true,
  qrphLabel: 'Choy Chat QRPh Unified',
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
  updatedAt: '',
};

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const PURPOSE_META: Record<
  PaymentTerminalPurpose,
  { label: string; short: string; desc: string; icon: React.ComponentType<{ className?: string }> }
> = {
  wallet_topup: {
    label: 'Cash Wallet Top-Up',
    short: 'Wallet Top-Up',
    desc: 'Credits your ₱ Cash Wallet once verified',
    icon: Wallet,
  },
  choy_coins: {
    label: 'Buy CHOY Coins',
    short: 'CHOY Coins',
    desc: 'Purchase CHOY Coins for marketplace & perks',
    icon: Coins,
  },
  order_payment: {
    label: 'Marketplace Order',
    short: 'Order Pay',
    desc: 'Pay Food Store & Marketplace orders online',
    icon: ShoppingBag,
  },
  pos_payment: {
    label: 'Direct POS Charge',
    short: 'Direct POS',
    desc: 'General merchant counter & service payment',
    icon: CreditCard,
  },
};

const CHANNEL_META: Record<
  PaymentTerminalChannelId,
  { label: string; badge: string; accent: string; icon: React.ComponentType<{ className?: string }> }
> = {
  gcash: {
    label: 'GCash',
    badge: 'E-Wallet',
    accent: 'text-sky-600 dark:text-sky-400',
    icon: Smartphone,
  },
  maya: {
    label: 'Maya',
    badge: 'E-Wallet',
    accent: 'text-emerald-600 dark:text-emerald-400',
    icon: Smartphone,
  },
  qrph: {
    label: 'QRPh',
    badge: 'InstaPay QR',
    accent: 'text-amber-600 dark:text-amber-400',
    icon: QrCode,
  },
  bank_transfer: {
    label: 'Bank Transfer',
    badge: 'InstaPay / PESONet',
    accent: 'text-indigo-600 dark:text-indigo-400',
    icon: Building2,
  },
  online_card: {
    label: 'Stripe Checkout',
    badge: 'Visa • MC • Stripe',
    accent: 'text-[#FF5A1F]',
    icon: CreditCard,
  },
};

function isSafeHttpsUrl(url?: string): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface PaymentTerminalPanelProps {
  currentUser: {
    id: string;
    name: string;
    phone?: string;
    role: 'admin' | 'member';
  };
  authToken?: string | null;
  dashboard: UserDashboardData;
  choyProgramsConfig: ChoyProgramsConfig;
  initialView?: PaymentTerminalView;
  onOwnDashboardUpdated?: (next: UserDashboardData) => void;
}

function formatPhp(n: number): string {
  return `₱${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function compressImageToDataUrl(file: File, maxDim = 960): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

async function uploadTerminalImage(file: File, authToken?: string | null): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WEBP).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image must be 15 MB or smaller.');
  }
  try {
    const headers: Record<string, string> = {
      'Content-Type': file.type || 'image/jpeg',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Media-Folder': 'payments',
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: file,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.uploaded && typeof data.url === 'string' && data.url) {
        return data.url;
      }
    }
  } catch {
    // Fall back to compressed local data URL when cloud media storage is not configured
  }
  return compressImageToDataUrl(file);
}

export const PaymentTerminalPanel: React.FC<PaymentTerminalPanelProps> = ({
  currentUser,
  authToken,
  dashboard,
  choyProgramsConfig,
  initialView = 'terminal',
  onOwnDashboardUpdated,
}) => {
  const getAuthHeaders = useCallback(
    (includeJson = false): Record<string, string> => {
      const h: Record<string, string> = {};
      if (includeJson) h['Content-Type'] = 'application/json';
      if (authToken) h.Authorization = `Bearer ${authToken}`;
      return h;
    },
    [authToken]
  );
  const isAdmin = currentUser.role === 'admin';
  const [view, setView] = useState<PaymentTerminalView>(
    initialView === 'admin' && !isAdmin ? 'terminal' : initialView
  );
  const [config, setConfig] = useState<PaymentTerminalConfig>(DEFAULT_TERMINAL_CONFIG);
  const [configDraft, setConfigDraft] = useState<PaymentTerminalConfig>(DEFAULT_TERMINAL_CONFIG);
  const clientStripePublishableConfigured = Boolean(
    String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim()
  );
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [stripeConfigIdConfigured, setStripeConfigIdConfigured] = useState(false);
  const [stripePublishableKeyConfigured, setStripePublishableKeyConfigured] = useState(
    clientStripePublishableConfigured
  );
  const [stripeWebhookConfigured, setStripeWebhookConfigured] = useState(false);
  const [stripeMode, setStripeMode] = useState<'live' | 'test' | 'unconfigured'>('unconfigured');
  const [verifyingTxId, setVerifyingTxId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentTerminalTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Terminal POS State
  const [amountInput, setAmountInput] = useState('0');
  const [purpose, setPurpose] = useState<PaymentTerminalPurpose>('wallet_topup');
  const [channel, setChannel] = useState<PaymentTerminalChannelId>('gcash');
  const [payerReference, setPayerReference] = useState('');
  const [customerName, setCustomerName] = useState(currentUser.name || '');
  const [customerContact, setCustomerContact] = useState(currentUser.phone || '');
  const [note, setNote] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingCharge, setSubmittingCharge] = useState(false);
  const [lastCreatedTx, setLastCreatedTx] = useState<PaymentTerminalTx | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // History & Receipt Modal State
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentTerminalStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<PaymentTerminalTx | null>(null);

  // Admin Review & Setup State
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadingQrChannel, setUploadingQrChannel] = useState<'gcash' | 'maya' | 'qrph' | null>(null);
  const [reviewingTxId, setReviewingTxId] = useState<string | null>(null);
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});

  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialView === 'admin' && !isAdmin) {
      setView('terminal');
    } else {
      setView(initialView);
    }
  }, [initialView, isAdmin]);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [cfgRes, txRes] = await Promise.all([
        fetch('/api/choy/payment-terminal/config', { credentials: 'include', headers: getAuthHeaders() }),
        fetch('/api/choy/payment-terminal/transactions', { credentials: 'include', headers: getAuthHeaders() }),
      ]);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData.config) {
          setConfig(cfgData.config);
          setConfigDraft(cfgData.config);
        }
        setStripeConfigured(Boolean(cfgData.stripeConfigured));
        setStripeConfigIdConfigured(Boolean(cfgData.stripeConfigIdConfigured));
        setStripePublishableKeyConfigured(
          Boolean(cfgData.stripePublishableKeyConfigured) || clientStripePublishableConfigured
        );
        setStripeWebhookConfigured(Boolean(cfgData.stripeWebhookConfigured));
        if (
          cfgData.stripeMode === 'live' ||
          cfgData.stripeMode === 'test' ||
          cfgData.stripeMode === 'unconfigured'
        ) {
          setStripeMode(cfgData.stripeMode);
        }
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        if (Array.isArray(txData.transactions)) {
          setTransactions(txData.transactions);
        }
      }
    } catch {
      setErrorMsg('Could not load Online Payment Terminal data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders, clientStripePublishableConfigured]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleVerifyStripePayment = useCallback(
    async (txId: string, sessionId?: string) => {
      setVerifyingTxId(txId);
      setErrorMsg(null);
      setNotice(null);
      try {
        const res = await fetch(
          `/api/choy/payment-terminal/transactions/${encodeURIComponent(txId)}/verify-stripe`,
          {
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders(true),
            body: JSON.stringify(sessionId ? { sessionId } : {}),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not verify Stripe payment.');
        }
        if (data.transaction) {
          const updated: PaymentTerminalTx = data.transaction;
          setTransactions((prev) => {
            const exists = prev.some((item) => item.id === updated.id);
            return exists
              ? prev.map((item) => (item.id === updated.id ? updated : item))
              : [updated, ...prev];
          });
          setLastCreatedTx((prev) => (prev?.id === updated.id ? updated : prev));
          setSelectedReceiptTx((prev) => (prev?.id === updated.id ? updated : prev));
        }
        if (data.ownDashboard && onOwnDashboardUpdated) {
          onOwnDashboardUpdated(data.ownDashboard);
        }
        if (data.paid) {
          setNotice(data.message || 'Stripe payment verified and credited.');
        } else {
          setNotice(
            data.message ||
              'Stripe checkout is not marked paid yet. Complete checkout on Stripe, then click Verify Stripe Payment.'
          );
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to verify Stripe payment.');
      } finally {
        setVerifyingTxId(null);
      }
    },
    [getAuthHeaders, onOwnDashboardUpdated]
  );

  const handledStripeReturnRef = useRef(false);
  useEffect(() => {
    if (handledStripeReturnRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const stripeTx = params.get('stripe_tx');
    const stripeSessionId = params.get('stripe_session_id');
    const stripeCancelled = params.get('stripe_cancelled');
    if (!stripeTx) return;
    handledStripeReturnRef.current = true;

    params.delete('stripe_tx');
    params.delete('stripe_session_id');
    params.delete('stripe_cancelled');
    const nextQuery = params.toString();
    const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl);

    if (stripeCancelled === '1') {
      setNotice('Stripe checkout was cancelled. You can resume or verify it anytime in Transaction History.');
      setView('history');
      return;
    }

    setView('history');
    void handleVerifyStripePayment(stripeTx, stripeSessionId || undefined);
  }, [handleVerifyStripePayment]);

  // Ensure active channel stays enabled when config loads
  const enabledChannels = useMemo(() => {
    const list: PaymentTerminalChannelId[] = [];
    if (config.gcashEnabled) list.push('gcash');
    if (config.mayaEnabled) list.push('maya');
    if (config.qrphEnabled) list.push('qrph');
    if (config.bankEnabled) list.push('bank_transfer');
    if (config.onlineCardEnabled) list.push('online_card');
    return list;
  }, [config]);

  useEffect(() => {
    if (enabledChannels.length > 0 && !enabledChannels.includes(channel)) {
      setChannel(enabledChannels[0]);
    }
  }, [enabledChannels, channel]);

  const parsedAmount = useMemo(() => {
    const n = Number(amountInput);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }, [amountInput]);

  const feePhp = useMemo(
    () => Math.round(((parsedAmount * config.convenienceFeePercent) / 100) * 100) / 100,
    [parsedAmount, config.convenienceFeePercent]
  );

  const totalPhp = useMemo(
    () => Math.round((parsedAmount + feePhp) * 100) / 100,
    [parsedAmount, feePhp]
  );

  const conversionRate = choyProgramsConfig.choyWallet?.conversionRate || 2;
  const choyCoinsPreview = useMemo(
    () => (purpose === 'choy_coins' ? Math.round(parsedAmount * conversionRate * 100) / 100 : 0),
    [purpose, parsedAmount, conversionRate]
  );

  const pendingCount = useMemo(
    () => transactions.filter((t) => t.status === 'pending').length,
    [transactions]
  );

  const handleKeypadPress = (key: string) => {
    setErrorMsg(null);
    setAmountInput((prev) => {
      if (key === 'CLR') return '0';
      if (key === 'BACK') {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      }
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return `${prev}.`;
      }
      const next = prev === '0' ? (key === '00' ? '0' : key) : `${prev}${key}`;
      const dotIdx = next.indexOf('.');
      if (dotIdx !== -1 && next.length - dotIdx - 1 > 2) return prev;
      if (Number(next) > config.maxAmountPhp) return prev;
      return next;
    });
  };

  const handleDirectAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    if (!cleaned) {
      setAmountInput('0');
      return;
    }
    if (Number(cleaned) > config.maxAmountPhp) return;
    setAmountInput(cleaned.replace(/^0+(?=\d)/, ''));
  };

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1800);
    } catch {
      setNotice(`Copied value: ${text}`);
    }
  };

  const handleProofUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingProof(true);
    setErrorMsg(null);
    try {
      const url = await uploadTerminalImage(file, authToken);
      setReceiptImageUrl(url);
      setNotice('Payment receipt image attached.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload receipt image.');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleQrUpload = async (target: 'gcash' | 'maya' | 'qrph', file: File | undefined) => {
    if (!file) return;
    setUploadingQrChannel(target);
    setErrorMsg(null);
    try {
      const url = await uploadTerminalImage(file, authToken);
      setConfigDraft((prev) => ({
        ...prev,
        ...(target === 'gcash' ? { gcashQrUrl: url } : {}),
        ...(target === 'maya' ? { mayaQrUrl: url } : {}),
        ...(target === 'qrph' ? { qrphQrUrl: url } : {}),
      }));
      setNotice(`${target.toUpperCase()} QR image uploaded. Click Save Terminal Setup to publish.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload QR code image.');
    } finally {
      setUploadingQrChannel(null);
    }
  };

  const handleSubmitCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotice(null);

    if (parsedAmount < config.minAmountPhp || parsedAmount > config.maxAmountPhp) {
      setErrorMsg(
        `Enter an amount between ${formatPhp(config.minAmountPhp)} and ${formatPhp(config.maxAmountPhp)}.`
      );
      return;
    }
    if (channel !== 'online_card' && !payerReference.trim() && !receiptImageUrl) {
      setErrorMsg('Enter your payment Reference Number or upload your payment screenshot before submitting.');
      return;
    }

    setSubmittingCharge(true);
    try {
      const res = await fetch('/api/choy/payment-terminal/charge', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          amountPhp: parsedAmount,
          purpose,
          channel,
          payerReference: payerReference.trim(),
          customerName: customerName.trim() || currentUser.name,
          customerContact: customerContact.trim() || currentUser.phone || '',
          note: note.trim(),
          receiptImageUrl: receiptImageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payment.');
      }
      const created: PaymentTerminalTx = data.transaction;
      setLastCreatedTx(created);
      setTransactions((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setAmountInput('0');
      setPayerReference('');
      setNote('');
      setReceiptImageUrl('');
      if (created.channel === 'gcash') {
        handleCopyText('gcash_direct', cleanGcashDigits);
        setNotice(
          `Payment ${created.referenceCode} submitted! Opening GCash app automatically — recipient ${cleanGcashDigits} copied.`
        );
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            if (isDesktopBrowser) {
              const link = document.createElement('a');
              link.href = directGcashHref;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else {
              window.location.href = directGcashHref;
            }
          }, 350);
        }
      } else {
        setNotice(
          data.gatewayNotice ||
            `Payment ${created.referenceCode} submitted! Status: Pending verification.`
        );
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process payment.');
    } finally {
      setSubmittingCharge(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await fetch('/api/choy/admin/payment-terminal/config', {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(true),
        body: JSON.stringify(configDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save payment terminal settings.');
      }
      if (data.config) {
        setConfig(data.config);
        setConfigDraft(data.config);
      }
      setNotice('Online Payment Terminal settings saved and live for all users.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAdminDecision = async (tx: PaymentTerminalTx, nextStatus: 'approved' | 'rejected') => {
    setReviewingTxId(tx.id);
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/choy/admin/payment-terminal/transactions/${encodeURIComponent(tx.id)}/status`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          status: nextStatus,
          rejectionReason: nextStatus === 'rejected' ? rejectReasonMap[tx.id] || '' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update transaction.');
      }
      const updated: PaymentTerminalTx = data.transaction;
      setTransactions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (data.ownDashboard && onOwnDashboardUpdated) {
        onOwnDashboardUpdated(data.ownDashboard);
      }
      if (selectedReceiptTx?.id === updated.id) {
        setSelectedReceiptTx(updated);
      }
      setNotice(
        nextStatus === 'approved'
          ? `Approved ${updated.referenceCode}${
              updated.purpose === 'wallet_topup'
                ? ` — credited ${formatPhp(updated.amountPhp)} to ${updated.userName}'s Cash Wallet.`
                : updated.purpose === 'choy_coins'
                ? ` — credited ${updated.choyCoinsPreview.toLocaleString()} CHOY Coins to ${updated.userName}.`
                : '.'
            }`
          : `Rejected ${updated.referenceCode}.`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update payment status.');
    } finally {
      setReviewingTxId(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (!q) return true;
      return (
        tx.referenceCode.toLowerCase().includes(q) ||
        tx.userName.toLowerCase().includes(q) ||
        tx.payerReference.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.note.toLowerCase().includes(q)
      );
    });
  }, [transactions, statusFilter, searchTerm]);

  const approvedTotalPhp = useMemo(
    () => transactions.filter((t) => t.status === 'approved').reduce((sum, t) => sum + t.totalPhp, 0),
    [transactions]
  );

  const pendingTransactions = useMemo(
    () => transactions.filter((t) => t.status === 'pending'),
    [transactions]
  );

  const activeQrUrl =
    channel === 'gcash'
      ? config.gcashQrUrl
      : channel === 'maya'
      ? config.mayaQrUrl
      : channel === 'qrph'
      ? config.qrphQrUrl
      : undefined;

  const cleanGcashDigits = useMemo(
    () => (config.gcashNumber || '09361223978').replace(/[^0-9+]/g, '') || '09361223978',
    [config.gcashNumber]
  );

  const directGcashHref = useMemo(() => {
    if (typeof navigator === 'undefined') return 'https://www.gcash.com/';
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) {
      return 'intent://#Intent;scheme=gcash;package=com.globe.gcash.android;S.browser_fallback_url=https%3A%2F%2Fm.gcash.com%2Fgcash-login-web%2Findex.html;end';
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'gcash://';
    }
    return 'https://www.gcash.com/';
  }, []);

  const isDesktopBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return true;
    return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }, []);

  const handleDirectGcashClick = () => {
    handleCopyText('gcash_direct', cleanGcashDigits);
    setNotice(
      totalPhp > 0
        ? `GCash number ${cleanGcashDigits} copied! Opening GCash — paste in Express Send and send ${formatPhp(totalPhp)}.`
        : `GCash number ${cleanGcashDigits} copied! Opening GCash — paste in Express Send.`
    );
  };

  const formatReceiptText = (tx: PaymentTerminalTx) =>
    [
      `=== ${config.merchantName} ===`,
      `Terminal ID: ${config.terminalId}`,
      `Receipt Ref: ${tx.referenceCode}`,
      `Date: ${new Date(tx.createdAt).toLocaleString()}`,
      `Status: ${tx.status.toUpperCase()}`,
      `Customer: ${tx.customerName}${tx.customerContact ? ` (${tx.customerContact})` : ''}`,
      `Purpose: ${PURPOSE_META[tx.purpose].label}`,
      `Channel: ${CHANNEL_META[tx.channel].label}`,
      `Amount: ${formatPhp(tx.amountPhp)}`,
      `Fee: ${formatPhp(tx.feePhp)}`,
      `TOTAL PAID: ${formatPhp(tx.totalPhp)}`,
      tx.choyCoinsPreview > 0 ? `CHOY Coins: ${tx.choyCoinsPreview.toLocaleString()} CHOY` : '',
      tx.payerReference ? `Payer Ref #: ${tx.payerReference}` : '',
      tx.note ? `Note: ${tx.note}` : '',
      tx.reviewedBy ? `Verified By: ${tx.reviewedBy}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 flex flex-col items-center justify-center gap-3 text-emerald-700 dark:text-emerald-300">
        <Loader2 className="w-7 h-7 animate-spin" />
        <p className="text-sm font-medium">Connecting Online Payment Terminal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Top Terminal Header & Mode Switcher */}
      <div className="rounded-2xl bg-[#0E4B1D] text-white p-5 shadow-lg border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#FF5A1F] flex items-center justify-center shrink-0 shadow">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight">{config.merchantName}</h2>
                <span className="px-2 py-0.5 rounded-md bg-white/15 font-mono text-[11px] font-semibold tracking-wider text-emerald-100">
                  {config.terminalId}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Online Payment Terminal • Cash Wallet: <strong className="font-mono">{formatPhp(dashboard.walletBalance)}</strong> • CHOY Wallet:{' '}
                <strong className="font-mono">{Number(dashboard.choyWalletBalance || 0).toLocaleString()} CHOY</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setView('terminal')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                view === 'terminal'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : 'bg-white/10 text-white/90 hover:bg-white/15'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              POS Terminal
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                view === 'history'
                  ? 'bg-[#FF5A1F] text-white shadow-sm'
                  : 'bg-white/10 text-white/90 hover:bg-white/15'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Receipts ({transactions.length})
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  view === 'admin'
                    ? 'bg-[#FF5A1F] text-white shadow-sm'
                    : 'bg-white/10 text-white/90 hover:bg-white/15'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Admin Setup
                {pendingCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-md font-mono text-[10px] font-black">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh terminal data"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-4 py-3 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================
          VIEW 1: INTERACTIVE POS ONLINE PAYMENT TERMINAL
         ======================================================== */}
      {view === 'terminal' && (
        <div className="space-y-5">
          {!config.enabled && !isAdmin ? (
            <div className="rounded-2xl bg-white dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 p-8 text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-emerald-950 dark:text-white">
                Online Payment Terminal Temporarily Paused
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Please check back shortly or message Choy Admin for payment assistance.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitCharge} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: Hardware-Inspired POS Display & Numeric Keypad */}
              <div className="lg:col-span-5 rounded-2xl bg-[#092E14] text-white p-5 shadow-xl border border-emerald-800/70 space-y-4">
                <div className="flex items-center justify-between text-[11px] text-emerald-200/80 font-mono">
                  <span>TERMINAL READY</span>
                  <span>PHP • {config.terminalId}</span>
                </div>

                {/* Digital LCD Screen */}
                <div className="rounded-xl bg-[#04180A] border border-emerald-700/60 p-4 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">
                    <span>{PURPOSE_META[purpose].short}</span>
                    <span>{CHANNEL_META[channel].label}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold text-emerald-400">₱</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="Payment amount in PHP"
                      value={amountInput}
                      onChange={(e) => handleDirectAmountChange(e.target.value)}
                      className="w-full bg-transparent text-right font-mono tabular-nums text-4xl font-black tracking-tight text-white focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 border-t border-emerald-900/80 space-y-1 text-xs font-mono tabular-nums">
                    <div className="flex justify-between text-emerald-200/80">
                      <span>Convenience Fee ({config.convenienceFeePercent}%)</span>
                      <span>{formatPhp(feePhp)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-sm">
                      <span>TOTAL DUE</span>
                      <span className="text-[#FF7A45]">{formatPhp(totalPhp)}</span>
                    </div>
                    {purpose === 'choy_coins' && (
                      <div className="flex justify-between text-amber-300 font-bold pt-1">
                        <span>CHOY Coins Credit (1₱ = {conversionRate} CHOY)</span>
                        <span>+{choyCoinsPreview.toLocaleString()} CHOY</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Amount Presets */}
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountInput(String(amt))}
                      className={`py-2 rounded-lg text-xs font-mono font-bold tabular-nums border transition ${
                        parsedAmount === amt
                          ? 'bg-[#FF5A1F] border-[#FF5A1F] text-white'
                          : 'bg-white/10 border-white/10 text-emerald-50 hover:bg-white/15'
                      }`}
                    >
                      ₱{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Tactile POS Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className="h-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] text-lg font-mono font-bold text-white border border-white/10 transition"
                    >
                      {k}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('CLR')}
                    className="h-12 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-xs font-extrabold tracking-wider text-rose-200 transition"
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('BACK')}
                    className="col-span-2 h-12 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition"
                  >
                    <Delete className="w-4 h-4" />
                    Backspace
                  </button>
                </div>

                <p className="text-[11px] text-emerald-200/75 leading-relaxed">
                  Min {formatPhp(config.minAmountPhp)} • Max {formatPhp(config.maxAmountPhp)}. You can tap keypad buttons or type directly into the screen.
                </p>
              </div>

              {/* RIGHT COLUMN: Purpose, Channel, Merchant Details & Payment Submission */}
              <div className="lg:col-span-7 space-y-4">
                {/* Step 1: Payment Purpose */}
                <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-5 shadow-sm space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    1. Select Payment Purpose
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(Object.keys(PURPOSE_META) as PaymentTerminalPurpose[]).map((pKey) => {
                      const meta = PURPOSE_META[pKey];
                      const Icon = meta.icon;
                      const active = purpose === pKey;
                      return (
                        <button
                          key={pKey}
                          type="button"
                          onClick={() => setPurpose(pKey)}
                          className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                            active
                              ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 dark:bg-[#FF5A1F]/20'
                              : 'border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/40'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              active
                                ? 'bg-[#FF5A1F] text-white'
                                : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-emerald-950 dark:text-white">{meta.label}</div>
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-300/80 leading-snug mt-0.5">
                              {meta.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Online Payment Channel & Merchant Receiving Info */}
                <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-5 shadow-sm space-y-4">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    2. Choose Online Payment Channel
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {enabledChannels.map((cKey) => {
                      const meta = CHANNEL_META[cKey];
                      const Icon = meta.icon;
                      const active = channel === cKey;
                      return (
                        <button
                          key={cKey}
                          type="button"
                          onClick={() => setChannel(cKey)}
                          className={`px-3 py-2.5 rounded-xl border text-left transition ${
                            active
                              ? 'border-[#0E4B1D] dark:border-[#FF5A1F] bg-[#0E4B1D] dark:bg-[#FF5A1F] text-white shadow-sm'
                              : 'border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-50 dark:hover:bg-emerald-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : meta.accent}`} />
                            <span className="text-xs font-bold truncate">{meta.label}</span>
                          </div>
                          <div className={`text-[10px] mt-0.5 truncate ${active ? 'text-white/80' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {meta.badge}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Merchant Receiving Details Box */}
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
                    {channel === 'gcash' && (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold uppercase text-sky-700 dark:text-sky-300">
                              Direct GCash Express Send
                            </div>
                            <div className="text-sm font-extrabold text-emerald-950 dark:text-white">
                              {config.gcashName}
                            </div>
                            <div className="font-mono text-lg font-black tracking-wide text-emerald-900 dark:text-emerald-100">
                              {config.gcashNumber}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyText('gcash', cleanGcashDigits)}
                              className="px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-100 inline-flex items-center gap-1.5"
                            >
                              {copiedKey === 'gcash' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              {copiedKey === 'gcash' ? 'Copied' : 'Copy Number'}
                            </button>
                            <a
                              href={directGcashHref}
                              target={isDesktopBrowser ? '_blank' : undefined}
                              rel={isDesktopBrowser ? 'noopener noreferrer' : undefined}
                              onClick={handleDirectGcashClick}
                              className="px-4 py-2 rounded-xl bg-[#007DFE] hover:bg-[#0068d6] text-white text-xs font-extrabold shadow-sm inline-flex items-center gap-1.5 transition"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              Open GCash Direct
                              <ExternalLink className="w-3 h-3 opacity-90" />
                            </a>
                          </div>
                        </div>
                        <div className="rounded-lg bg-sky-500/10 dark:bg-sky-500/15 border border-sky-400/30 px-3 py-2 text-[11px] text-sky-900 dark:text-sky-200 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Tap <strong>Open GCash Direct</strong> to auto-copy{' '}
                            <strong className="font-mono">{cleanGcashDigits}</strong> and launch GCash immediately.
                          </span>
                          <a
                            href="https://m.gcash.com/gcash-login-web/index.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleCopyText('gcash_web', cleanGcashDigits)}
                            className="font-bold underline hover:opacity-80 whitespace-nowrap"
                          >
                            GCash Web
                          </a>
                        </div>
                      </div>
                    )}

                    {channel === 'maya' && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                            Send Maya Payment To
                          </div>
                          <div className="text-sm font-extrabold text-emerald-950 dark:text-white">
                            {config.mayaName}
                          </div>
                          <div className="font-mono text-base font-black text-emerald-900 dark:text-emerald-100">
                            {config.mayaNumber}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText('maya', config.mayaNumber)}
                          className="px-3 py-2 rounded-lg bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5 self-start sm:self-center"
                        >
                          {copiedKey === 'maya' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === 'maya' ? 'Copied' : 'Copy Number'}
                        </button>
                      </div>
                    )}

                    {channel === 'qrph' && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                          Scan QRPh (Works with GCash, Maya, BDO, BPI, UnionBank & InstaPay)
                        </div>
                        <div className="text-sm font-extrabold text-emerald-950 dark:text-white">
                          {config.qrphLabel}
                        </div>
                        {!config.qrphQrUrl && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-300">
                            Admin can upload a QRPh image in Admin Setup.
                          </p>
                        )}
                      </div>
                    )}

                    {channel === 'bank_transfer' && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                            {config.bankName}
                          </div>
                          <div className="text-sm font-extrabold text-emerald-950 dark:text-white">
                            {config.bankAccountName}
                          </div>
                          <div className="font-mono text-base font-black text-emerald-900 dark:text-emerald-100">
                            {config.bankAccountNumber}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText('bank', config.bankAccountNumber)}
                          className="px-3 py-2 rounded-lg bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5 self-start sm:self-center"
                        >
                          {copiedKey === 'bank' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === 'bank' ? 'Copied' : 'Copy Account #'}
                        </button>
                      </div>
                    )}

                    {channel === 'online_card' && (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] font-bold uppercase text-[#FF5A1F]">
                            Stripe Checkout Terminal (Cards &amp; Configured Methods)
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              stripeConfigured
                                ? stripeMode === 'live'
                                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                                : 'bg-slate-200 dark:bg-emerald-900/70 text-slate-700 dark:text-emerald-300'
                            }`}
                          >
                            {stripeConfigured
                              ? stripeMode === 'live'
                                ? 'Stripe Live'
                                : 'Stripe Test Mode'
                              : 'Stripe Not Connected'}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                          {stripeConfigured
                            ? `Stripe Checkout is connected${stripeConfigIdConfigured ? ' with your Stripe Payment Method Configuration ID' : ''}. Submit this terminal charge to open a secure Stripe payment page—balances auto-credit once Stripe confirms payment.`
                            : 'Submit this terminal charge to log your online payment request. Add STRIPE_SECRET_KEY (and optional STRIPE_CONFIG_ID, VITE_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET) in environment variables to generate instant Stripe Checkout links.'}
                        </p>
                      </div>
                    )}

                    {activeQrUrl && (
                      <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-800 flex flex-col sm:flex-row items-center gap-4">
                        <img
                          src={activeQrUrl}
                          alt={`${CHANNEL_META[channel].label} Merchant QR Code`}
                          className="w-36 h-36 object-contain rounded-xl bg-white p-2 border border-emerald-200 shadow-sm"
                        />
                        <div className="text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                          <div className="font-bold">Scan Official Merchant QR</div>
                          <p>
                            Scan with your e-wallet or banking app, send{' '}
                            <strong className="font-mono">{formatPhp(totalPhp)}</strong>, then enter your Reference Number below.
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                      {config.instructions}
                    </p>
                  </div>
                </div>

                {/* Step 3: Payer Details, Reference & Proof Screenshot */}
                <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-5 shadow-sm space-y-4">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    3. Payment Reference & Verification Proof
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Full name"
                        maxLength={80}
                        className="w-full px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5A1F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                        Contact / Mobile Number
                      </label>
                      <input
                        type="text"
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        placeholder="09XX XXX XXXX"
                        maxLength={40}
                        className="w-full px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5A1F]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                        Payment Reference Number {channel === 'online_card' ? '(Optional)' : '(Required if no screenshot)'}
                      </label>
                      <input
                        type="text"
                        value={payerReference}
                        onChange={(e) => setPayerReference(e.target.value)}
                        placeholder="e.g., GCash Ref # 8029173920"
                        maxLength={80}
                        className="w-full px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5A1F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                        Order # or Payment Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g., Order #1042 or Top-Up"
                        maxLength={240}
                        className="w-full px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5A1F]"
                      />
                    </div>
                  </div>

                  {/* Screenshot Upload */}
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={receiptFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        handleProofUpload(f);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingProof}
                      onClick={() => receiptFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-950 dark:text-emerald-100 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
                    >
                      {uploadingProof ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {receiptImageUrl ? 'Replace Receipt Screenshot' : 'Upload Payment Screenshot'}
                    </button>
                    {receiptImageUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={receiptImageUrl}
                          alt="Uploaded payment proof preview"
                          className="w-10 h-10 rounded-lg object-cover border border-emerald-300 dark:border-emerald-700"
                        />
                        <button
                          type="button"
                          onClick={() => setReceiptImageUrl('')}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submittingCharge || parsedAmount <= 0}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {submittingCharge ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing Terminal Payment...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {channel === 'online_card' && stripeConfigured
                          ? `Generate Stripe Checkout • ${formatPhp(totalPhp)}`
                          : `Submit Payment • ${formatPhp(totalPhp)}`}
                      </>
                    )}
                  </button>
                </div>

                {/* Instant Confirmation Card */}
                {lastCreatedTx && (
                  <div className="rounded-2xl bg-emerald-900 text-white p-5 shadow-md border border-emerald-700 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                        <span className="text-sm font-extrabold">Terminal Payment Logged</span>
                      </div>
                      <span className="font-mono text-xs font-bold bg-white/15 px-2.5 py-1 rounded-lg">
                        {lastCreatedTx.referenceCode}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white/10 rounded-xl p-2.5">
                        <div className="text-emerald-200/80 text-[10px]">Total Due</div>
                        <div className="font-mono font-bold">{formatPhp(lastCreatedTx.totalPhp)}</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2.5">
                        <div className="text-emerald-200/80 text-[10px]">Purpose</div>
                        <div className="font-bold truncate">{PURPOSE_META[lastCreatedTx.purpose].short}</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2.5">
                        <div className="text-emerald-200/80 text-[10px]">Channel</div>
                        <div className="font-bold truncate">{CHANNEL_META[lastCreatedTx.channel].label}</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-2.5">
                        <div className="text-emerald-200/80 text-[10px]">Status</div>
                        <div className="font-bold uppercase text-amber-300">{lastCreatedTx.status}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {lastCreatedTx.channel === 'gcash' && (
                        <a
                          href={directGcashHref}
                          target={isDesktopBrowser ? '_blank' : undefined}
                          rel={isDesktopBrowser ? 'noopener noreferrer' : undefined}
                          onClick={handleDirectGcashClick}
                          className="px-4 py-2 rounded-xl bg-[#007DFE] hover:bg-[#0068d6] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          Open GCash ({cleanGcashDigits})
                        </a>
                      )}
                      {isSafeHttpsUrl(lastCreatedTx.checkoutUrl) && lastCreatedTx.status === 'pending' && (
                        <a
                          href={lastCreatedTx.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open Secure Stripe Checkout
                        </a>
                      )}
                      {lastCreatedTx.channel === 'online_card' &&
                        lastCreatedTx.status === 'pending' &&
                        lastCreatedTx.payerReference?.startsWith('cs_') && (
                          <button
                            type="button"
                            disabled={verifyingTxId === lastCreatedTx.id}
                            onClick={() =>
                              handleVerifyStripePayment(lastCreatedTx.id, lastCreatedTx.payerReference)
                            }
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {verifyingTxId === lastCreatedTx.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            Verify Stripe Payment
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptTx(lastCreatedTx)}
                        className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        View Digital Receipt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================
          VIEW 2: TRANSACTIONS & DIGITAL RECEIPTS LEDGER
         ======================================================== */}
      {view === 'history' && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-4">
              <div className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                Total Transactions
              </div>
              <div className="text-2xl font-mono font-black text-emerald-950 dark:text-white mt-1 tabular-nums">
                {transactions.length}
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-4">
              <div className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">
                Pending Verification
              </div>
              <div className="text-2xl font-mono font-black text-amber-600 dark:text-amber-300 mt-1 tabular-nums">
                {pendingCount}
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-4">
              <div className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                Approved Volume
              </div>
              <div className="text-2xl font-mono font-black text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                {formatPhp(approvedTotalPhp)}
              </div>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by reference code, payer ref #, customer name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5A1F]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                    statusFilter === st
                      ? 'bg-[#0E4B1D] dark:bg-[#FF5A1F] text-white'
                      : 'bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200/70'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-10 text-center space-y-2">
              <Receipt className="w-9 h-9 text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-emerald-950 dark:text-white">No payment records found</div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Submit an online payment from the POS Terminal to generate a digital receipt.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-emerald-950 dark:text-white">
                        {tx.referenceCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          tx.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                            : tx.status === 'rejected'
                            ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {CHANNEL_META[tx.channel].label} • {PURPOSE_META[tx.purpose].short}
                      </span>
                    </div>
                    <div className="text-xs text-emerald-800 dark:text-emerald-200 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>{tx.customerName}</span>
                      {tx.payerReference && (
                        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                          Ref: {tx.payerReference}
                        </span>
                      )}
                      <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {tx.rejectionReason && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        Reason: {tx.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-mono tabular-nums text-base font-black text-emerald-950 dark:text-white">
                        {formatPhp(tx.totalPhp)}
                      </div>
                      {tx.choyCoinsPreview > 0 && (
                        <div className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          +{tx.choyCoinsPreview.toLocaleString()} CHOY
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {tx.channel === 'online_card' &&
                        tx.status === 'pending' &&
                        tx.payerReference?.startsWith('cs_') && (
                          <button
                            type="button"
                            disabled={verifyingTxId === tx.id}
                            onClick={() => handleVerifyStripePayment(tx.id, tx.payerReference)}
                            className="px-3 py-2 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {verifyingTxId === tx.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            Verify Stripe
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptTx(tx)}
                        className="px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-950 dark:text-emerald-100 text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Receipt
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          VIEW 3: ADMIN VERIFICATION QUEUE & MERCHANT SETUP
         ======================================================== */}
      {view === 'admin' && isAdmin && (
        <div className="space-y-6">
          {/* Pending Payment Approvals Queue */}
          <div className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FF5A1F]" />
                <div>
                  <h3 className="text-sm font-extrabold text-emerald-950 dark:text-white">
                    Pending Online Payments Queue ({pendingTransactions.length})
                  </h3>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Approving a Cash Wallet Top-Up or CHOY Coins payment automatically credits the member&apos;s balance once.
                  </p>
                </div>
              </div>
            </div>

            {pendingTransactions.length === 0 ? (
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-6 text-center text-xs text-emerald-700 dark:text-emerald-300">
                No pending online payments waiting for verification.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTransactions.map((tx) => {
                  const busy = reviewingTxId === tx.id;
                  return (
                    <div
                      key={tx.id}
                      className="rounded-xl bg-emerald-50/70 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 p-4 space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-black text-emerald-950 dark:text-white">
                              {tx.referenceCode}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
                              {CHANNEL_META[tx.channel].label}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                              {PURPOSE_META[tx.purpose].label}
                            </span>
                          </div>
                          <div className="text-xs text-emerald-900 dark:text-emerald-100 font-semibold">
                            {tx.userName} {tx.customerContact ? `• ${tx.customerContact}` : ''}
                          </div>
                          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-mono">
                            Payer Ref: <strong>{tx.payerReference || 'Not entered'}</strong>
                          </div>
                          {tx.note && (
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">Note: {tx.note}</div>
                          )}
                          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                            Submitted {new Date(tx.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          {tx.receiptImageUrl && (
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptTx(tx)}
                              className="shrink-0 group relative"
                              title="Click to inspect receipt proof"
                            >
                              <img
                                src={tx.receiptImageUrl}
                                alt="Payment proof"
                                className="w-16 h-16 rounded-xl object-cover border border-emerald-300 dark:border-emerald-700"
                              />
                              <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center text-[10px] font-bold text-white">
                                Zoom
                              </span>
                            </button>
                          )}
                          <div className="text-right">
                            <div className="font-mono tabular-nums text-lg font-black text-emerald-950 dark:text-white">
                              {formatPhp(tx.totalPhp)}
                            </div>
                            <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                              Base: {formatPhp(tx.amountPhp)}
                            </div>
                            {tx.choyCoinsPreview > 0 && (
                              <div className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-300">
                                Credits {tx.choyCoinsPreview.toLocaleString()} CHOY
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-emerald-200/80 dark:border-emerald-800">
                        <input
                          type="text"
                          value={rejectReasonMap[tx.id] || ''}
                          onChange={(e) =>
                            setRejectReasonMap((prev) => ({ ...prev, [tx.id]: e.target.value }))
                          }
                          placeholder="Optional rejection reason (e.g., reference not found)"
                          maxLength={200}
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          {tx.channel === 'online_card' && tx.payerReference?.startsWith('cs_') && (
                            <button
                              type="button"
                              disabled={busy || verifyingTxId === tx.id}
                              onClick={() => handleVerifyStripePayment(tx.id, tx.payerReference)}
                              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {verifyingTxId === tx.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              )}
                              Verify Stripe
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleAdminDecision(tx, 'approved')}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Approve {tx.purpose === 'wallet_topup' || tx.purpose === 'choy_coins' ? '& Credit' : ''}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleAdminDecision(tx, 'rejected')}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Merchant Receiving Accounts & POS Settings Form */}
          <form
            onSubmit={handleSaveConfig}
            className="rounded-2xl bg-white dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 p-5 shadow-sm space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[#0E4B1D] dark:text-emerald-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-emerald-950 dark:text-white">
                    Merchant Payment Terminal Setup (Admin Only)
                  </h3>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Configure receiving GCash, Maya, QRPh, Bank details, QR images, and convenience fees.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={configDraft.enabled}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, enabled: e.target.checked }))}
                  className="w-4 h-4 accent-[#FF5A1F]"
                />
                Terminal Active
              </label>
            </div>

            {/* Identity & Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  Merchant Display Name
                </label>
                <input
                  type="text"
                  value={configDraft.merchantName}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, merchantName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  Terminal ID
                </label>
                <input
                  type="text"
                  value={configDraft.terminalId}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, terminalId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  Convenience Fee (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="25"
                  value={configDraft.convenienceFeePercent}
                  onChange={(e) =>
                    setConfigDraft((p) => ({ ...p, convenienceFeePercent: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                    Min (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={configDraft.minAmountPhp}
                    onChange={(e) =>
                      setConfigDraft((p) => ({ ...p, minAmountPhp: Number(e.target.value) || 1 }))
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                    Max (₱)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={configDraft.maxAmountPhp}
                    onChange={(e) =>
                      setConfigDraft((p) => ({ ...p, maxAmountPhp: Number(e.target.value) || 1000 }))
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Channel Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* GCash */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-2.5">
                <label className="flex items-center justify-between text-xs font-extrabold text-emerald-950 dark:text-white cursor-pointer">
                  <span>GCash Receiving Account</span>
                  <input
                    type="checkbox"
                    checked={configDraft.gcashEnabled}
                    onChange={(e) => setConfigDraft((p) => ({ ...p, gcashEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#FF5A1F]"
                  />
                </label>
                <input
                  type="text"
                  value={configDraft.gcashName}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, gcashName: e.target.value }))}
                  placeholder="GCash Account Name"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
                <input
                  type="text"
                  value={configDraft.gcashNumber}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, gcashNumber: e.target.value }))}
                  placeholder="09XX XXX XXXX"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
                <div className="flex items-center gap-2 pt-1">
                  <label className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5">
                    {uploadingQrChannel === 'gcash' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    Upload GCash QR
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        handleQrUpload('gcash', f);
                      }}
                    />
                  </label>
                  {configDraft.gcashQrUrl && (
                    <button
                      type="button"
                      onClick={() => setConfigDraft((p) => ({ ...p, gcashQrUrl: undefined }))}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                    >
                      Clear QR
                    </button>
                  )}
                </div>
              </div>

              {/* Maya */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-2.5">
                <label className="flex items-center justify-between text-xs font-extrabold text-emerald-950 dark:text-white cursor-pointer">
                  <span>Maya Receiving Account</span>
                  <input
                    type="checkbox"
                    checked={configDraft.mayaEnabled}
                    onChange={(e) => setConfigDraft((p) => ({ ...p, mayaEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#FF5A1F]"
                  />
                </label>
                <input
                  type="text"
                  value={configDraft.mayaName}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, mayaName: e.target.value }))}
                  placeholder="Maya Account Name"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
                <input
                  type="text"
                  value={configDraft.mayaNumber}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, mayaNumber: e.target.value }))}
                  placeholder="09XX XXX XXXX"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
                <div className="flex items-center gap-2 pt-1">
                  <label className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5">
                    {uploadingQrChannel === 'maya' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    Upload Maya QR
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        handleQrUpload('maya', f);
                      }}
                    />
                  </label>
                  {configDraft.mayaQrUrl && (
                    <button
                      type="button"
                      onClick={() => setConfigDraft((p) => ({ ...p, mayaQrUrl: undefined }))}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                    >
                      Clear QR
                    </button>
                  )}
                </div>
              </div>

              {/* QRPh */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-2.5">
                <label className="flex items-center justify-between text-xs font-extrabold text-emerald-950 dark:text-white cursor-pointer">
                  <span>QRPh Unified Code</span>
                  <input
                    type="checkbox"
                    checked={configDraft.qrphEnabled}
                    onChange={(e) => setConfigDraft((p) => ({ ...p, qrphEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#FF5A1F]"
                  />
                </label>
                <input
                  type="text"
                  value={configDraft.qrphLabel}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, qrphLabel: e.target.value }))}
                  placeholder="Merchant QRPh Label"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
                <div className="flex items-center gap-2 pt-1">
                  <label className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5">
                    {uploadingQrChannel === 'qrph' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5" />
                    )}
                    Upload QRPh Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        handleQrUpload('qrph', f);
                      }}
                    />
                  </label>
                  {configDraft.qrphQrUrl && (
                    <button
                      type="button"
                      onClick={() => setConfigDraft((p) => ({ ...p, qrphQrUrl: undefined }))}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                    >
                      Clear QR
                    </button>
                  )}
                </div>
              </div>

              {/* Bank Transfer & Online Card */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-2.5">
                <label className="flex items-center justify-between text-xs font-extrabold text-emerald-950 dark:text-white cursor-pointer">
                  <span>Bank Transfer (InstaPay / PESONet)</span>
                  <input
                    type="checkbox"
                    checked={configDraft.bankEnabled}
                    onChange={(e) => setConfigDraft((p) => ({ ...p, bankEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#FF5A1F]"
                  />
                </label>
                <input
                  type="text"
                  value={configDraft.bankName}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="Bank Name (e.g., BDO, BPI, UnionBank)"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
                <input
                  type="text"
                  value={configDraft.bankAccountName}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, bankAccountName: e.target.value }))}
                  placeholder="Account Holder Name"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
                <input
                  type="text"
                  value={configDraft.bankAccountNumber}
                  onChange={(e) => setConfigDraft((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                  placeholder="Account Number"
                  className="w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                />
                <label className="flex items-center justify-between pt-1.5 border-t border-emerald-200/70 dark:border-emerald-800 text-xs font-bold text-emerald-950 dark:text-white cursor-pointer">
                  <span>Online Card / Stripe Checkout</span>
                  <input
                    type="checkbox"
                    checked={configDraft.onlineCardEnabled}
                    onChange={(e) => setConfigDraft((p) => ({ ...p, onlineCardEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#FF5A1F]"
                  />
                </label>
                <div className="rounded-lg bg-emerald-50/80 dark:bg-emerald-900/40 border border-emerald-200/80 dark:border-emerald-800 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-200 space-y-1">
                  <div className="font-bold">
                    Stripe Terminal Status:{' '}
                    <span className={stripeConfigured ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}>
                      {stripeConfigured
                        ? stripeMode === 'live'
                          ? 'Connected (Live)'
                          : 'Connected (Test Mode)'
                        : 'Needs STRIPE_SECRET_KEY in env'}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300/90 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Config ID: {stripeConfigIdConfigured ? 'Active' : 'Default Card'}</span>
                    <span>Publishable Key: {stripePublishableKeyConfigured ? 'Set' : 'Optional'}</span>
                    <span>Webhook Secret: {stripeWebhookConfigured ? 'Active' : 'Manual Verify Only'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                Customer Payment Instructions
              </label>
              <textarea
                rows={2}
                value={configDraft.instructions}
                onChange={(e) => setConfigDraft((p) => ({ ...p, instructions: e.target.value }))}
                maxLength={400}
                className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0E4B1D] hover:bg-[#145e27] text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow transition disabled:opacity-50"
            >
              {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Terminal Setup
            </button>
          </form>
        </div>
      )}

      {/* ========================================================
          DIGITAL TERMINAL RECEIPT MODAL
         ======================================================== */}
      {selectedReceiptTx && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedReceiptTx(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0E4B1D] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#FF5A1F]" />
                <div>
                  <div className="text-sm font-extrabold">Digital Terminal Receipt</div>
                  <div className="font-mono text-[11px] text-emerald-200">{selectedReceiptTx.referenceCode}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptTx(null)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="text-center pb-3 border-b border-dashed border-emerald-300 dark:border-emerald-800">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {config.merchantName}
                </div>
                <div className="font-mono tabular-nums text-3xl font-black text-emerald-950 dark:text-white mt-1">
                  {formatPhp(selectedReceiptTx.totalPhp)}
                </div>
                <div className="mt-1.5 inline-block px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  {selectedReceiptTx.status}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400">Terminal ID</span>
                  <span className="font-mono font-bold text-emerald-950 dark:text-white">{config.terminalId}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400">Date & Time</span>
                  <span className="font-medium text-emerald-950 dark:text-white">
                    {new Date(selectedReceiptTx.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400">Customer</span>
                  <span className="font-bold text-emerald-950 dark:text-white">{selectedReceiptTx.customerName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400">Purpose</span>
                  <span className="font-bold text-emerald-950 dark:text-white">
                    {PURPOSE_META[selectedReceiptTx.purpose].label}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400">Channel</span>
                  <span className="font-bold text-emerald-950 dark:text-white">
                    {CHANNEL_META[selectedReceiptTx.channel].label}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400">Base Amount</span>
                  <span className="font-mono font-bold text-emerald-950 dark:text-white">
                    {formatPhp(selectedReceiptTx.amountPhp)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400">Convenience Fee</span>
                  <span className="font-mono font-bold text-emerald-950 dark:text-white">
                    {formatPhp(selectedReceiptTx.feePhp)}
                  </span>
                </div>
                {selectedReceiptTx.choyCoinsPreview > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-emerald-700 dark:text-emerald-400">CHOY Coins</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-300">
                      +{selectedReceiptTx.choyCoinsPreview.toLocaleString()} CHOY
                    </span>
                  </div>
                )}
                {selectedReceiptTx.payerReference && (
                  <div className="flex justify-between gap-2">
                    <span className="text-emerald-700 dark:text-emerald-400">Payer Reference #</span>
                    <span className="font-mono font-bold text-emerald-950 dark:text-white">
                      {selectedReceiptTx.payerReference}
                    </span>
                  </div>
                )}
                {selectedReceiptTx.reviewedBy && (
                  <div className="flex justify-between gap-2">
                    <span className="text-emerald-700 dark:text-emerald-400">Verified By</span>
                    <span className="font-bold text-emerald-950 dark:text-white">{selectedReceiptTx.reviewedBy}</span>
                  </div>
                )}
              </div>

              {selectedReceiptTx.receiptImageUrl && (
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 space-y-1.5">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Attached Proof Screenshot
                  </div>
                  <img
                    src={selectedReceiptTx.receiptImageUrl}
                    alt="Attached receipt screenshot"
                    className="w-full max-h-60 object-contain rounded-xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800"
                  />
                </div>
              )}

              {isSafeHttpsUrl(selectedReceiptTx.checkoutUrl) && selectedReceiptTx.status === 'pending' && (
                <a
                  href={selectedReceiptTx.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Continue to Stripe Checkout
                </a>
              )}
              {selectedReceiptTx.channel === 'online_card' &&
                selectedReceiptTx.status === 'pending' &&
                selectedReceiptTx.payerReference?.startsWith('cs_') && (
                  <button
                    type="button"
                    disabled={verifyingTxId === selectedReceiptTx.id}
                    onClick={() =>
                      handleVerifyStripePayment(selectedReceiptTx.id, selectedReceiptTx.payerReference)
                    }
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {verifyingTxId === selectedReceiptTx.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Verify Stripe Payment Now
                  </button>
                )}
            </div>

            <div className="px-5 py-3.5 bg-emerald-50 dark:bg-emerald-900/40 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleCopyText('receipt', formatReceiptText(selectedReceiptTx))}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-100 inline-flex items-center gap-1.5"
              >
                {copiedKey === 'receipt' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'receipt' ? 'Copied' : 'Copy Receipt'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-[#0E4B1D] hover:bg-[#145e27] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
