import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  ImagePlus,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';

export interface CustomerRegistrationPayload {
  name: string;
  realName: string;
  phone: string;
  pin: string;
  otpCode: string;
  privateValidIdAssetId?: string;
  privateRealAvatarAssetId?: string;
  privacyConsentAccepted: boolean;
}

interface CustomerRegistrationFormProps {
  appName?: string;
  submitting: boolean;
  errorMsg?: string;
  onSubmit: (payload: CustomerRegistrationPayload) => Promise<void>;
  onOpenPrivacyPolicy?: () => void;
}

export const CustomerRegistrationForm: React.FC<CustomerRegistrationFormProps> = ({
  appName = 'Choy Chat',
  submitting,
  errorMsg,
  onSubmit,
  onOpenPrivacyPolicy,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [realName, setRealName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [avatarAssetId, setAvatarAssetId] = useState<string>('');
  const [avatarFileName, setAvatarFileName] = useState<string>('');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [validIdAssetId, setValidIdAssetId] = useState<string>('');
  const [validIdFileName, setValidIdFileName] = useState<string>('');
  const [validIdPreviewUrl, setValidIdPreviewUrl] = useState<string>('');
  const [uploadingValidId, setUploadingValidId] = useState(false);

  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [localError, setLocalError] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const validIdInputRef = useRef<HTMLInputElement>(null);

  const handlePrivateUpload = async (file: File | null, kind: 'real_avatar' | 'valid_id') => {
    if (!file) return;
    setLocalError('');
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
      setLocalError('Please select a JPG, PNG, or WebP image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setLocalError('File exceeds maximum allowed size (8 MB).');
      return;
    }

    const previewObjectUrl = URL.createObjectURL(file);
    if (kind === 'real_avatar') {
      setUploadingAvatar(true);
      setAvatarPreviewUrl(previewObjectUrl);
      setAvatarFileName(file.name);
    } else {
      setUploadingValidId(true);
      setValidIdPreviewUrl(previewObjectUrl);
      setValidIdFileName(file.name);
    }

    try {
      const res = await fetch('/api/auth/register/private-upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-KYC-Kind': kind,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.assetId) {
        throw new Error(data.error || 'Private upload failed. Please try again.');
      }
      if (kind === 'real_avatar') {
        setAvatarAssetId(String(data.assetId));
      } else {
        setValidIdAssetId(String(data.assetId));
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Private upload failed.');
      if (kind === 'real_avatar') {
        setAvatarAssetId('');
        setAvatarPreviewUrl('');
        setAvatarFileName('');
      } else {
        setValidIdAssetId('');
        setValidIdPreviewUrl('');
        setValidIdFileName('');
      }
    } finally {
      if (kind === 'real_avatar') setUploadingAvatar(false);
      else setUploadingValidId(false);
    }
  };

  const handleRequestOtpPlaceholder = () => {
    setLocalError('');
    if (phone.trim().length < 7) {
      setLocalError('Enter your cellphone number first before requesting an OTP.');
      return;
    }
    setOtpRequested(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!privacyConsent) {
      setLocalError('Please check the Privacy Policy consent box to enable registration.');
      return;
    }
    if (displayName.trim().length < 2) {
      setLocalError('Please enter a Display Name / Username (at least 2 characters).');
      return;
    }
    if (phone.trim().length < 7) {
      setLocalError('Please enter a valid Cellphone Number.');
      return;
    }
    if (pin.trim().length < 4) {
      setLocalError('Please create a PIN of at least 4 characters.');
      return;
    }
    await onSubmit({
      name: displayName.trim(),
      realName: realName.trim(),
      phone: phone.trim(),
      pin: pin.trim(),
      otpCode: otpCode.trim(),
      privateValidIdAssetId: validIdAssetId || undefined,
      privateRealAvatarAssetId: avatarAssetId || undefined,
      privacyConsentAccepted: privacyConsent,
    });
  };

  const isUploading = uploadingAvatar || uploadingValidId;
  const registerDisabled = !privacyConsent || submitting || isUploading;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
      {(localError || errorMsg) && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700/70 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:text-rose-200"
        >
          {localError || errorMsg}
        </div>
      )}

      {/* Display Name / Username (Public) */}
      <div>
        <label
          htmlFor="reg-display-name"
          className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
        >
          Display Name / Username <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="reg-display-name"
            type="text"
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What you want to be called in the app (e.g. ChoyFoodie)"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Only this Display Name is shown publicly to restaurants and delivery riders.
        </p>
      </div>

      {/* Real Full Name (Encrypted Admin-Only) */}
      <div>
        <label
          htmlFor="reg-real-name"
          className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
        >
          Real Full Name <span className="text-slate-400 font-normal">(Encrypted · Admin-Only)</span>
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="reg-real-name"
            type="text"
            maxLength={120}
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="Legal name matching your Valid ID (encrypted at rest)"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Cellphone Number + OTP Verification Placeholder */}
      <div className="space-y-2">
        <label
          htmlFor="reg-phone"
          className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
        >
          Cellphone Number <span className="text-rose-500">*</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={handleRequestOtpPlaceholder}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition"
          >
            {otpRequested ? 'OTP Ready' : 'Send OTP'}
          </button>
        </div>

        {/* OTP Verification Input Placeholder */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="Enter 6-digit SMS OTP code (OTP verification placeholder)"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {otpRequested && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
            OTP verification slot active for {phone}. Connect an SMS gateway in production to require live codes.
          </p>
        )}
      </div>

      {/* Security PIN */}
      <div>
        <label
          htmlFor="reg-pin"
          className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
        >
          Account PIN <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            id="reg-pin"
            type={showPin ? 'text' : 'password'}
            required
            minLength={4}
            maxLength={64}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Create a secure PIN (minimum 4 characters)"
            className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Private Storage Uploads: Profile Picture & Valid ID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Profile Picture Upload */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Profile Picture Upload
            </span>
            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              Private Bucket
            </span>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handlePrivateUpload(e.target.files?.[0] || null, 'real_avatar')}
          />
          {avatarPreviewUrl ? (
            <div className="flex items-center gap-2.5">
              <img
                src={avatarPreviewUrl}
                alt="Selected profile preview"
                className="w-12 h-12 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {avatarFileName}
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading privately...
                    </>
                  ) : avatarAssetId ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Secured in private vault
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition"
            >
              <ImagePlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Upload Photo</span>
            </button>
          )}
        </div>

        {/* Valid ID Upload */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Valid ID Upload
            </span>
            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              Admin Only
            </span>
          </div>
          <input
            ref={validIdInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handlePrivateUpload(e.target.files?.[0] || null, 'valid_id')}
          />
          {validIdPreviewUrl ? (
            <div className="flex items-center gap-2.5">
              <img
                src={validIdPreviewUrl}
                alt="Selected Valid ID preview"
                className="w-12 h-12 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {validIdFileName}
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  {uploadingValidId ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Encrypting upload...
                    </>
                  ) : validIdAssetId ? (
                    <>
                      <FileCheck2 className="w-3 h-3" /> Private ID stored
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => validIdInputRef.current?.click()}
                className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploadingValidId}
              onClick={() => validIdInputRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition"
            >
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Upload Valid ID</span>
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Privacy Policy Consent Checkbox */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/70 p-3.5">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => setPrivacyConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 accent-emerald-600 shrink-0"
          />
          <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            By uploading your valid ID and profile picture, you consent to{' '}
            <strong className="text-slate-900 dark:text-white">{appName}</strong> storing this data
            securely for fraud-prevention purposes only. This information will never be shared
            publicly or shown to restaurants and riders.
            {onOpenPrivacyPolicy && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={onOpenPrivacyPolicy}
                  className="underline font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600"
                >
                  Read Privacy Policy
                </button>
              </>
            )}
          </span>
        </label>
      </div>

      {/* Register Button — Strictly Disabled Until Privacy Policy Checkbox is Ticked */}
      <button
        type="submit"
        disabled={registerDisabled}
        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating Customer Account...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            <span>Register</span>
          </>
        )}
      </button>
    </form>
  );
};
