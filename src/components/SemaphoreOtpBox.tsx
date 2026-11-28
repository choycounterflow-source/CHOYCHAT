import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Lock, MessageSquareMore, RefreshCw, ShieldCheck } from 'lucide-react';

export type PaymentOtpPurpose = 'subscription' | 'dtr_subscription' | 'payment' | 'withdrawal';

interface SemaphoreOtpBoxProps {
  purpose: PaymentOtpPurpose;
  authToken?: string | null;
  defaultPhone?: string;
  label?: string;
  resetTrigger?: number;
  onStatusChange?: (status: { configured: boolean; verifiedToken: string | null; phone: string }) => void;
}

const extractValidMobileDefault = (raw?: string): string => {
  const s = String(raw || '').trim();
  if (!s || s.includes('@')) return '';
  const digits = s.replace(/[^0-9]/g, '');
  return digits.length >= 10 && digits.length <= 15 ? s : '';
};

export const SemaphoreOtpBox: React.FC<SemaphoreOtpBoxProps> = ({
  purpose,
  authToken,
  defaultPhone = '',
  label = 'Semaphore SMS OTP Verification',
  resetTrigger = 0,
  onStatusChange,
}) => {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [phone, setPhone] = useState(() => extractValidMobileDefault(defaultPhone));
  const [otpCode, setOtpCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [expectedCodeLen, setExpectedCodeLen] = useState(6);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const buildHeaders = useCallback(
    (json = false): Record<string, string> => {
      const h: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (json) h['Content-Type'] = 'application/json';
      if (authToken) h.Authorization = `Bearer ${authToken}`;
      return h;
    },
    [authToken]
  );

  // Sync valid mobile defaultPhone if parent updates it and user hasn't typed yet
  useEffect(() => {
    const validDefault = extractValidMobileDefault(defaultPhone);
    if (validDefault && !phone) {
      setPhone(validDefault);
    }
  }, [defaultPhone, phone]);

  const fetchOtpStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/otp/status', {
        credentials: 'include',
        headers: buildHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      const isCfg = Boolean(data?.configured);
      setConfigured(isCfg);
      const validServerPhone = extractValidMobileDefault(data?.defaultPhone);
      if (validServerPhone) {
        setPhone((prev) => prev || validServerPhone);
      }
    } catch {
      setConfigured(false);
    } finally {
      setLoadingStatus(false);
    }
  }, [buildHeaders]);

  // Load Semaphore OTP configuration status
  useEffect(() => {
    void fetchOtpStatus();
  }, [fetchOtpStatus]);

  // Reset verified state whenever parent completes a transaction
  useEffect(() => {
    if (resetTrigger > 0) {
      setVerifiedToken(null);
      setOtpCode('');
      setCodeSent(false);
      setNotice(null);
      setErrorMsg(null);
    }
  }, [resetTrigger]);

  // Notify parent of current OTP state
  useEffect(() => {
    onStatusChangeRef.current?.({ configured, verifiedToken, phone });
  }, [configured, verifiedToken, phone]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSec((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldownSec]);

  const handleSendOtp = async () => {
    setErrorMsg(null);
    setNotice(null);
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.includes('@')) {
      setErrorMsg('Enter your PH mobile number (e.g., 09171234567) to receive the Semaphore SMS OTP.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(true),
        body: JSON.stringify({ phone: cleanPhone, purpose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof data?.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
          setCooldownSec(data.retryAfterSeconds);
        }
        throw new Error(data.error || 'Could not send SMS OTP.');
      }
      const nextLen =
        typeof data.codeLength === 'number' && data.codeLength >= 4 && data.codeLength <= 8
          ? data.codeLength
          : 6;
      setExpectedCodeLen(nextLen);
      setCodeSent(true);
      setVerifiedToken(null);
      setOtpCode('');
      setCooldownSec(typeof data.cooldownSeconds === 'number' ? data.cooldownSeconds : 45);
      setMaskedPhone(data.maskedPhone || cleanPhone);
      setNotice(`${nextLen}-digit OTP sent via Semaphore SMS to ${data.maskedPhone || cleanPhone}. Valid for 5 minutes.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send SMS OTP.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg(null);
    setNotice(null);
    const cleanCode = otpCode.replace(/[^0-9]/g, '').trim();
    if (cleanCode.length < 4 || cleanCode.length > 8) {
      setErrorMsg(`Enter the exact ${expectedCodeLen}-digit SMS OTP code sent to your mobile number.`);
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(true),
        body: JSON.stringify({
          phone: phone.trim(),
          purpose,
          code: cleanCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired OTP code.');
      }
      setVerifiedToken(String(data.otpToken || ''));
      setMaskedPhone(data.maskedPhone || phone.trim());
      setNotice(`OTP verified for ${data.maskedPhone || phone.trim()}. You can now complete this action.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking Semaphore SMS OTP status...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-300/80 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/60 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-950 dark:text-white">
          <MessageSquareMore className="w-4 h-4 text-[#FF5A1F]" />
          <span>{label}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
            verifiedToken
              ? 'bg-emerald-600 text-white'
              : configured
              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
              : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
          }`}
        >
          {verifiedToken
            ? 'SMS OTP Verified'
            : configured
            ? 'Semaphore SMS Active'
            : 'SEMAPHORE_API_KEY Not Set'}
        </span>
      </div>

      {!configured ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed flex-1">
            Add <code className="font-mono font-bold">SEMAPHORE_API_KEY</code> in your server Environment Variables / Secrets (then redeploy/restart) to send live SMS OTP codes via Semaphore before subscriptions, payments, and withdrawals.
          </p>
          <button
            type="button"
            onClick={() => void fetchOtpStatus()}
            className="px-2.5 py-1.5 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300/80 text-amber-950 dark:text-amber-100 text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Recheck
          </button>
        </div>
      ) : verifiedToken ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-100/90 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Verified via Semaphore SMS ({maskedPhone || phone})</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setVerifiedToken(null);
              setCodeSent(false);
              setOtpCode('');
              setNotice(null);
            }}
            className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Change
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (verifiedToken) setVerifiedToken(null);
              }}
              placeholder="Mobile # (e.g. 09171234567)"
              className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
            />
            <button
              type="button"
              disabled={sending || cooldownSec > 0 || !phone.trim()}
              onClick={handleSendOtp}
              className="px-3.5 py-2 rounded-xl bg-[#0E4B1D] hover:bg-[#145e27] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              {cooldownSec > 0 ? `Resend in ${cooldownSec}s` : codeSent ? 'Resend OTP' : 'Send SMS OTP'}
            </button>
          </div>

          {codeSent && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder={`Enter ${expectedCodeLen}-digit SMS OTP`}
                className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-mono tracking-widest text-emerald-950 dark:text-white"
              />
              <button
                type="button"
                disabled={verifying || otpCode.replace(/[^0-9]/g, '').length < 4}
                onClick={handleVerifyOtp}
                className="px-4 py-2 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Verify OTP
              </button>
            </div>
          )}
        </div>
      )}

      {notice && !errorMsg && (
        <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{notice}</div>
      )}
      {errorMsg && (
        <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{errorMsg}</div>
      )}
    </div>
  );
};
