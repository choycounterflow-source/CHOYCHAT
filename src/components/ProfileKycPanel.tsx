import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileBadge2,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  UserCheck,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import type { UserDashboardData } from './UserDashboardPanels';

export const VALID_ID_TYPES = [
  'PhilSys National ID',
  "Driver's License",
  'UMID / SSS ID',
  'Philippine Passport',
  'Postal ID',
  "Voter's ID",
  'PRC ID',
  'PhilHealth ID',
  'TIN ID',
  'Student / Company ID',
] as const;

function normalizeKycName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function compressImageToDataUrl(file: File, maxDimension = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export interface ProfileKycVerificationCardProps {
  currentUser: {
    id: string;
    name: string;
    phone: string;
    role: 'user' | 'member' | 'admin';
  };
  authToken?: string;
  dashboard: UserDashboardData;
  onDashboardUpdated: (next: UserDashboardData) => void;
  onZoomImage?: (img: { src: string; caption?: string }) => void;
}

export const ProfileKycVerificationCard: React.FC<ProfileKycVerificationCardProps> = ({
  currentUser,
  authToken,
  dashboard,
  onDashboardUpdated,
  onZoomImage,
}) => {
  const [completeName, setCompleteName] = useState(dashboard.kycCompleteName || '');
  const [address, setAddress] = useState(dashboard.kycAddress || '');
  const [age, setAge] = useState(dashboard.kycAge ? String(dashboard.kycAge) : '');
  const [sex, setSex] = useState<'Male' | 'Female' | 'Other'>(dashboard.kycSex || 'Male');
  const [validIdType, setValidIdType] = useState(dashboard.kycValidIdType || VALID_ID_TYPES[0]);
  const [validIdName, setValidIdName] = useState(dashboard.kycValidIdName || '');
  const [validIdImageUrl, setValidIdImageUrl] = useState(dashboard.kycValidIdImageUrl || '');
  const [privateValidIdAssetId, setPrivateValidIdAssetId] = useState('');
  const [localValidIdPreviewUrl, setLocalValidIdPreviewUrl] = useState('');
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dashboard.kycCompleteName && !completeName) setCompleteName(dashboard.kycCompleteName);
    if (dashboard.kycAddress && !address) setAddress(dashboard.kycAddress);
    if (dashboard.kycAge && !age) setAge(String(dashboard.kycAge));
    if (dashboard.kycSex) setSex(dashboard.kycSex);
    if (dashboard.kycValidIdType) setValidIdType(dashboard.kycValidIdType);
    if (dashboard.kycValidIdName && !validIdName) setValidIdName(dashboard.kycValidIdName);
    if (dashboard.kycValidIdImageUrl && !validIdImageUrl) setValidIdImageUrl(dashboard.kycValidIdImageUrl);
    // Sync when dashboard changes for the user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dashboard.userId,
    dashboard.kycCompleteName,
    dashboard.kycAddress,
    dashboard.kycAge,
    dashboard.kycSex,
    dashboard.kycValidIdType,
    dashboard.kycValidIdName,
    dashboard.kycValidIdImageUrl,
  ]);

  const kycStatus = dashboard.kycStatus || 'unsubmitted';
  const isApproved = kycStatus === 'approved' || currentUser.role === 'admin';
  const namesEntered = completeName.trim().length >= 2 && validIdName.trim().length >= 2;
  const namesMatch = namesEntered && normalizeKycName(completeName) === normalizeKycName(validIdName);
  const hasUploadedValidId = Boolean(privateValidIdAssetId || validIdImageUrl);

  const buildHeaders = (extra?: Record<string, string>) => {
    const h: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      ...(extra || {}),
    };
    if (authToken) h.Authorization = `Bearer ${authToken}`;
    return h;
  };

  const handleUploadValidId = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a clear photo (JPG, PNG, or WebP) of your Valid ID.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploadingId(true);
    try {
      // Upload directly into the PRIVATE KYC bucket (never public media)
      const res = await fetch('/api/choy/profile-kyc/private-upload', {
        method: 'POST',
        headers: buildHeaders({
          'Content-Type': file.type || 'image/jpeg',
          'X-KYC-Kind': 'valid_id',
        }),
        credentials: 'include',
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.assetId) {
        throw new Error(data.error || 'Private Valid ID upload failed. Please try again.');
      }
      setPrivateValidIdAssetId(String(data.assetId));
      const preview = await compressImageToDataUrl(file, 900, 0.78).catch(() => URL.createObjectURL(file));
      setLocalValidIdPreviewUrl(preview);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload Valid ID securely.');
    } finally {
      setIsUploadingId(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = completeName.trim();
    const trimmedAddress = address.trim();
    const parsedAge = Math.floor(Number(age));
    const trimmedIdName = validIdName.trim();

    if (trimmedName.length < 2) {
      setErrorMsg('Please enter your Complete Name.');
      return;
    }
    if (trimmedAddress.length < 5) {
      setErrorMsg('Please enter your Complete Address.');
      return;
    }
    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setErrorMsg('Please enter a valid Age (13 to 120).');
      return;
    }
    if (!trimmedIdName) {
      setErrorMsg('Please enter the exact Full Name printed on your Valid ID.');
      return;
    }
    if (normalizeKycName(trimmedName) !== normalizeKycName(trimmedIdName)) {
      setErrorMsg('Complete Name and Name on Valid ID must be the exact same.');
      return;
    }
    if (!hasUploadedValidId) {
      setErrorMsg('Please upload 1 clear photo of your Valid ID before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/choy/profile-kyc', {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          completeName: trimmedName,
          address: trimmedAddress,
          age: parsedAge,
          sex,
          validIdType,
          validIdName: trimmedIdName,
          privateValidIdAssetId: privateValidIdAssetId || undefined,
          validIdImageUrl: privateValidIdAssetId ? undefined : validIdImageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to save Profile Verification.');
        return;
      }
      if (data.userDashboard) {
        onDashboardUpdated(data.userDashboard as UserDashboardData);
      }
      setSuccessMsg(
        'Saved and sent directly to Choy Admin! Once Admin approves your profile, you can start placing orders.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error while submitting profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <FileBadge2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-emerald-950 dark:text-white">
              Profile Verification (Required for Orders)
            </h3>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
              Fill up your Complete Name, Address, Age, Sex, and upload 1 Valid ID matching your Complete Name. Saving sends directly to Admin for approval.
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        {kycStatus === 'approved' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>APPROVED FOR ORDERS</span>
          </span>
        ) : kycStatus === 'pending' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black shadow-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>PENDING ADMIN APPROVAL</span>
          </span>
        ) : kycStatus === 'rejected' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 text-white text-[11px] font-black shadow-xs">
            <XCircle className="w-3.5 h-3.5" />
            <span>REJECTED · PLEASE RESUBMIT</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-[11px] font-black">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>NOT VERIFIED YET</span>
          </span>
        )}
      </div>

      {/* Status info callout */}
      {kycStatus === 'approved' && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            Your profile is verified and approved{dashboard.kycReviewedBy ? ` by ${dashboard.kycReviewedBy}` : ''}. You can now place orders in Food Store &amp; Marketplace!
          </span>
        </div>
      )}

      {kycStatus === 'pending' && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2">
          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Sent to Choy Admin · Waiting for Approval</div>
            <p className="text-[11px] opacity-90 mt-0.5">
              Orders are locked until Admin reviews and approves your Complete Name and Valid ID.
              {dashboard.kycSubmittedAt ? ` Submitted on ${new Date(dashboard.kycSubmittedAt).toLocaleString()}.` : ''}
            </p>
          </div>
        </div>
      )}

      {kycStatus === 'rejected' && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 text-xs text-rose-900 dark:text-rose-100 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Verification Rejected by Admin</div>
            <p className="text-[11px] mt-0.5">
              {dashboard.kycRejectionReason || 'Your details or Valid ID did not match. Please double-check and re-submit.'}
            </p>
          </div>
        </div>
      )}

      {!isApproved && kycStatus === 'unsubmitted' && (
        <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-700/70 text-xs text-orange-950 dark:text-orange-100 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <span>
            Complete this form and wait for Admin approval before you can place any orders in Food Store &amp; Marketplace.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-600 text-xs font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmitKyc} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
              Complete Name *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={completeName}
              onChange={(e) => setCompleteName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Complete Address *</span>
            </label>
            <input
              type="text"
              required
              maxLength={260}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House/Lot No., Street, Purok, Barangay, City/Municipality, Province"
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
              Age *
            </label>
            <input
              type="number"
              required
              min={13}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 25"
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
              Sex *
            </label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as 'Male' | 'Female' | 'Other')}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-3">
          <div className="text-xs font-black text-emerald-950 dark:text-white flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>One (1) Valid ID — Must Match Complete Name</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                Valid ID Type *
              </label>
              <select
                value={validIdType}
                onChange={(e) => setValidIdType(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                {VALID_ID_TYPES.map((idType) => (
                  <option key={idType} value={idType}>
                    {idType}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                Full Name Printed on Valid ID *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={validIdName}
                onChange={(e) => setValidIdName(e.target.value)}
                placeholder="Must match Complete Name exactly"
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {namesEntered && (
            <div
              className={`px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                namesMatch
                  ? 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
              }`}
            >
              {namesMatch ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Valid ID name matches your Complete Name.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Name on Valid ID does not match your Complete Name. They must be the exact same.</span>
                </>
              )}
            </div>
          )}

          {/* Upload 1 Valid ID Photo */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 block">
              Upload 1 Valid ID Photo *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUploadValidId(e.target.files?.[0] || null)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isUploadingId}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition disabled:opacity-60"
              >
                {isUploadingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{hasUploadedValidId ? 'Change Valid ID Photo' : 'Upload Valid ID Photo (Private Bucket)'}</span>
              </button>
              {hasUploadedValidId && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>{privateValidIdAssetId ? 'Secured in Private Admin-Only Vault ✓' : 'ID photo attached ✓'}</span>
                </span>
              )}
            </div>

            {(localValidIdPreviewUrl || validIdImageUrl) && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950 max-w-sm">
                <img
                  src={localValidIdPreviewUrl || validIdImageUrl}
                  alt="Uploaded Valid ID preview"
                  onClick={() =>
                    onZoomImage?.({
                      src: localValidIdPreviewUrl || validIdImageUrl,
                      caption: `${validIdType} • ${completeName || currentUser.name}`,
                    })
                  }
                  className="max-h-48 w-full object-contain cursor-zoom-in"
                />
                {onZoomImage && (
                  <button
                    type="button"
                    onClick={() =>
                      onZoomImage({
                        src: localValidIdPreviewUrl || validIdImageUrl,
                        caption: `${validIdType} • ${completeName || currentUser.name}`,
                      })
                    }
                    className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-slate-950/75 text-white text-[10px] font-bold inline-flex items-center gap-1"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span>Zoom</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
            Your Real Name is AES-256 encrypted and your Valid ID is stored in a PRIVATE bucket accessible only by Admin.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || isUploadingId || !hasUploadedValidId || !namesMatch}
            className="px-5 py-2.5 rounded-xl bg-[#FF5A1F] hover:bg-orange-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow transition disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>
              {isSubmitting
                ? 'Sending to Admin...'
                : kycStatus === 'pending'
                ? 'Update & Resend to Admin'
                : kycStatus === 'approved'
                ? 'Save & Resend to Admin'
                : 'Save & Send to Admin'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

export interface AdminKycSubmissionItem {
  userId: string;
  accountName: string;
  decryptedRealName?: string;
  hasEncryptedRealName?: boolean;
  privacyConsentAccepted?: boolean;
  privacyConsentAt?: string;
  phone: string;
  role: 'user' | 'member' | 'admin';
  kycStatus: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  kycCompleteName: string;
  kycAddress: string;
  kycAge?: number;
  kycSex?: 'Male' | 'Female' | 'Other';
  kycValidIdType: string;
  kycValidIdName: string;
  kycValidIdImageUrl?: string;
  privateRealAvatarUrl?: string;
  isPrivateBucketProtected?: boolean;
  kycSubmittedAt?: string;
  kycReviewedBy?: string;
  kycReviewedAt?: string;
  kycRejectionReason?: string;
}

const AdminProtectedImage: React.FC<{
  src: string;
  alt: string;
  authToken?: string;
  className?: string;
  caption?: string;
  onZoomImage?: (img: { src: string; caption?: string }) => void;
}> = ({ src, alt, authToken, className, caption, onZoomImage }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(
    src.startsWith('/api/admin/private-kyc/file/') ? '' : src
  );
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    if (!src.startsWith('/api/admin/private-kyc/file/')) {
      setResolvedUrl(src);
      setLoadErr(false);
      return;
    }
    let active = true;
    let objectUrl = '';
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    fetch(src, { headers, credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized private image');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedUrl(objectUrl);
        setLoadErr(false);
      })
      .catch(() => {
        if (active) setLoadErr(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, authToken]);

  if (loadErr) {
    return (
      <div className="p-4 text-center text-[11px] text-rose-600 dark:text-rose-300 border border-rose-300/60 rounded-lg">
        Admin-only private asset could not be decrypted or loaded.
      </div>
    );
  }
  if (!resolvedUrl) {
    return (
      <div className="p-5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Decrypting Private Bucket file...</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      onClick={() => onZoomImage?.({ src: resolvedUrl, caption: caption || alt })}
      className={className}
    />
  );
};

export interface AdminKycApprovalsPanelProps {
  authToken?: string;
  onZoomImage?: (img: { src: string; caption?: string }) => void;
  onStatusChanged?: () => void;
}

export const AdminKycApprovalsPanel: React.FC<AdminKycApprovalsPanelProps> = ({
  authToken,
  onZoomImage,
  onStatusChanged,
}) => {
  const [items, setItems] = useState<AdminKycSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [rejectReasonByUser, setRejectReasonByUser] = useState<Record<string, string>>({});

  const buildHeaders = (extra?: Record<string, string>) => {
    const h: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      ...(extra || {}),
    };
    if (authToken) h.Authorization = `Bearer ${authToken}`;
    return h;
  };

  const loadSubmissions = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/choy/admin/profile-kyc', {
        headers: buildHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load Profile Verifications.');
        return;
      }
      setItems(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error loading Profile Verifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const handleReview = async (userId: string, status: 'approved' | 'rejected') => {
    setBusyUserId(userId);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const reason = (rejectReasonByUser[userId] || '').trim();
      const res = await fetch(`/api/choy/admin/profile-kyc/${encodeURIComponent(userId)}/status`, {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update profile verification status.');
        return;
      }
      setNoticeMsg(
        status === 'approved'
          ? 'Profile approved! The member can now place orders in Food Store & Marketplace.'
          : 'Profile rejected. The member will be notified to resubmit.'
      );
      await loadSubmissions();
      onStatusChanged?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error updating status.');
    } finally {
      setBusyUserId(null);
    }
  };

  const pendingCount = useMemo(() => items.filter((i) => i.kycStatus === 'pending').length, [items]);
  const approvedCount = useMemo(() => items.filter((i) => i.kycStatus === 'approved').length, [items]);
  const rejectedCount = useMemo(() => items.filter((i) => i.kycStatus === 'rejected').length, [items]);

  const filteredItems = useMemo(() => {
    if (filterStatus === 'all') return items;
    return items.filter((i) => i.kycStatus === filterStatus);
  }, [items, filterStatus]);

  return (
    <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/70 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0">
            <FileBadge2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-emerald-950 dark:text-white flex items-center gap-2">
              <span>Profile Verifications &amp; Order Approvals</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FF5A1F] text-white text-[10px] font-black">
                  {pendingCount} Pending
                </span>
              )}
            </h3>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
              Review Complete Name, Address, Age, Sex &amp; Valid ID before approving members to place orders.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSubmissions()}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: 'pending' as const, label: `Pending (${pendingCount})` },
          { id: 'approved' as const, label: `Approved (${approvedCount})` },
          { id: 'rejected' as const, label: `Rejected (${rejectedCount})` },
          { id: 'all' as const, label: `All (${items.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filterStatus === tab.id
                ? 'bg-[#FF5A1F] text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {noticeMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-600 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
          {noticeMsg}
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading profile verifications...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center text-xs text-emerald-700 dark:text-emerald-300">
          No {filterStatus === 'all' ? '' : `${filterStatus} `}profile verification submissions yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((sub) => {
            const nameMatched =
              sub.kycCompleteName &&
              sub.kycValidIdName &&
              normalizeKycName(sub.kycCompleteName) === normalizeKycName(sub.kycValidIdName);
            const isBusy = busyUserId === sub.userId;

            return (
              <div
                key={sub.userId}
                className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/75 border border-emerald-200 dark:border-emerald-800 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-emerald-950 dark:text-white">
                      {sub.kycCompleteName || sub.accountName}
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Account: {sub.accountName} · Phone: {sub.phone}
                      {sub.kycSubmittedAt ? ` · Sent ${new Date(sub.kycSubmittedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      sub.kycStatus === 'approved'
                        ? 'bg-emerald-500 text-slate-950'
                        : sub.kycStatus === 'pending'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {sub.kycStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5 bg-white dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                    <div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">Public Display Name: </span>
                      <span className="font-bold text-emerald-950 dark:text-white">{sub.accountName}</span>
                    </div>
                    <div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">
                        Real Name {sub.hasEncryptedRealName ? '(AES-256 Admin-Only)' : ''}:{' '}
                      </span>
                      <span className="font-black text-emerald-950 dark:text-white">
                        {sub.decryptedRealName || sub.kycCompleteName || '—'}
                      </span>
                    </div>
                    {sub.kycAddress && (
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">Address: </span>
                        <span className="text-emerald-950 dark:text-emerald-100">{sub.kycAddress}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">Age: </span>
                        <span className="font-bold text-emerald-950 dark:text-white">{sub.kycAge ?? '—'}</span>
                      </div>
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">Sex: </span>
                        <span className="font-bold text-emerald-950 dark:text-white">{sub.kycSex || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">Valid ID Type: </span>
                      <span className="font-bold text-emerald-950 dark:text-white">{sub.kycValidIdType || 'Private ID'}</span>
                    </div>
                    {sub.kycValidIdName && (
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">Name on ID: </span>
                        <span className="font-bold text-emerald-950 dark:text-white">{sub.kycValidIdName}</span>{' '}
                        <span
                          className={`inline-block ml-1 px-1.5 py-0.5 rounded text-[10px] font-black ${
                            nameMatched ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {nameMatched ? 'EXACT MATCH ✓' : 'CHECK MATCH'}
                        </span>
                      </div>
                    )}
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1 flex flex-wrap items-center gap-2">
                      {sub.isPrivateBucketProtected && (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Lock className="w-3 h-3" /> Private Bucket Protected
                        </span>
                      )}
                      {sub.privacyConsentAccepted && (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <ShieldCheck className="w-3 h-3" /> Privacy Consent Signed
                        </span>
                      )}
                    </div>
                    {sub.kycRejectionReason && sub.kycStatus === 'rejected' && (
                      <div className="text-[11px] text-rose-700 dark:text-rose-300 pt-1">
                        <span className="font-bold">Rejection Reason: </span>
                        {sub.kycRejectionReason}
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex flex-col justify-between gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        Admin-Only Private Bucket Files (Tap to Zoom)
                      </span>
                      <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Valid ID</div>
                        {sub.kycValidIdImageUrl ? (
                          <AdminProtectedImage
                            src={sub.kycValidIdImageUrl}
                            alt={`${sub.decryptedRealName || sub.kycCompleteName} Valid ID`}
                            authToken={authToken}
                            caption={`${sub.decryptedRealName || sub.kycCompleteName} • ${sub.kycValidIdType || 'Valid ID'}`}
                            onZoomImage={onZoomImage}
                            className="max-h-40 w-full object-contain rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 cursor-zoom-in"
                          />
                        ) : (
                          <div className="p-4 text-center text-[11px] text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-300 dark:border-emerald-800 rounded-lg">
                            No Valid ID uploaded
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Real Profile Picture
                        </div>
                        {sub.privateRealAvatarUrl ? (
                          <AdminProtectedImage
                            src={sub.privateRealAvatarUrl}
                            alt={`${sub.decryptedRealName || sub.accountName} Real Profile Picture`}
                            authToken={authToken}
                            caption={`${sub.decryptedRealName || sub.accountName} • Private Profile Photo`}
                            onZoomImage={onZoomImage}
                            className="max-h-40 w-full object-contain rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 cursor-zoom-in"
                          />
                        ) : (
                          <div className="p-4 text-center text-[11px] text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-300 dark:border-emerald-800 rounded-lg">
                            No private photo uploaded
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={rejectReasonByUser[sub.userId] || ''}
                    onChange={(e) =>
                      setRejectReasonByUser((prev) => ({ ...prev, [sub.userId]: e.target.value }))
                    }
                    placeholder="Optional rejection reason (e.g. Blurry ID or name mismatch)"
                    className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleReview(sub.userId, 'approved')}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Approve for Orders</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleReview(sub.userId, 'rejected')}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
