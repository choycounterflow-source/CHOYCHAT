import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  HardDrive,
  Loader2,
  LogOut,
  RefreshCw,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  formatStorageBytes,
  getGoogleDriveState,
  GOOGLE_DRIVE_DEFAULT_EMAIL,
  refreshGoogleDriveQuota,
  setUseGoogleDriveForVideos,
  subscribeGoogleDriveState,
  type GoogleDriveConnectionState,
  CHOY_DRIVE_FOLDER_NAME,
} from '../services/googleDriveVideoService';

interface GoogleDriveVideoBarProps {
  compact?: boolean;
  onStatusMessage?: (msg: string) => void;
}

/**
 * Official Google "G" emblem SVG used inside the GSI-styled "Sign in with Google" button.
 */
const GoogleGLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export const GoogleDriveVideoBar: React.FC<GoogleDriveVideoBarProps> = ({
  compact = false,
  onStatusMessage,
}) => {
  const [driveState, setDriveState] = useState<GoogleDriveConnectionState>(() =>
    getGoogleDriveState()
  );
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeGoogleDriveState(setDriveState);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setLocalError(null);
    try {
      const next = await connectGoogleDrive();
      const quotaNote =
        next.quota && next.quota.limitBytes > 0
          ? ` (${formatStorageBytes(next.quota.limitBytes)} total storage)`
          : '';
      onStatusMessage?.(
        `Google Drive connected (${next.email || GOOGLE_DRIVE_DEFAULT_EMAIL})${quotaNote}! Video uploads now stream straight to your Drive.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect Google Drive.';
      setLocalError(msg);
      onStatusMessage?.(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleRefreshQuota = async () => {
    setRefreshing(true);
    setLocalError(null);
    try {
      await refreshGoogleDriveQuota();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not refresh Drive storage.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setLocalError(null);
    onStatusMessage?.('Google Drive disconnected. Video uploads will use standard server storage.');
  };

  const quota = driveState.quota;
  const usedPct =
    quota && quota.limitBytes > 0
      ? Math.min(100, Math.max(0.5, (quota.usageBytes / quota.limitBytes) * 100))
      : 0;
  const freeBytes =
    quota && quota.limitBytes > 0 ? Math.max(0, quota.limitBytes - quota.usageBytes) : 0;

  if (compact) {
    return (
      <div className="px-2.5 py-2 rounded-xl bg-blue-50/90 dark:bg-slate-900/80 border border-blue-200 dark:border-blue-800/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          {driveState.connected ? (
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Drive Video Backend: {driveState.email}</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-blue-200/80 truncate">
                {quota && quota.limitBytes > 0
                  ? `${formatStorageBytes(freeBytes)} free of ${formatStorageBytes(quota.limitBytes)} · Up to 5 GB per video`
                  : `Folder: ${CHOY_DRIVE_FOLDER_NAME} · Up to 5 GB per video`}
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                5TB Google Drive Video Backend ({GOOGLE_DRIVE_DEFAULT_EMAIL})
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                Sign in with Google to save Newsfeed &amp; Chat videos directly to your 5TB Drive.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {driveState.connected ? (
            <>
              <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-800 dark:text-emerald-200 cursor-pointer select-none px-2 py-1 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={driveState.enabledForVideos}
                  onChange={(e) => setUseGoogleDriveForVideos(e.target.checked)}
                  className="accent-blue-600 rounded"
                />
                <span>Use Drive</span>
              </label>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-200 hover:text-rose-700 text-[10px] font-bold inline-flex items-center gap-1 transition"
                title="Disconnect Google Drive"
              >
                <LogOut className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={connecting}
              onClick={() => void handleConnect()}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#1F1F1F] border border-[#747775]/50 shadow-sm text-[11px] font-medium inline-flex items-center gap-2 transition disabled:opacity-60"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <GoogleGLogo className="w-3.5 h-3.5" />}
              <span>{connecting ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-emerald-950/70 border border-blue-200 dark:border-blue-700/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-emerald-950 dark:text-white">
                Google Drive Video Storage Backend
              </h3>
              {driveState.connected ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/90 border border-emerald-400/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-black inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-[10px] font-black">
                  5TB Ready
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
              {driveState.connected
                ? `Uploads go straight to Google Drive (${driveState.email}) in "${CHOY_DRIVE_FOLDER_NAME}" — supports up to 5 GB per video with adaptive streaming.`
                : `Connect ${GOOGLE_DRIVE_DEFAULT_EMAIL} to store and stream large videos (up to 5 GB each) using your 5TB Google Drive instead of limited server disk.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!driveState.connected ? (
            <button
              type="button"
              disabled={connecting}
              onClick={() => void handleConnect()}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-[#1F1F1F] border border-[#747775]/60 shadow-sm text-xs font-medium inline-flex items-center gap-2.5 transition disabled:opacity-60"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <GoogleGLogo className="w-4 h-4" />
              )}
              <span>{connecting ? 'Connecting Google Drive...' : 'Sign in with Google'}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={refreshing}
                onClick={() => void handleRefreshQuota()}
                className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900 text-[11px] font-bold inline-flex items-center gap-1 transition disabled:opacity-50"
                title="Refresh Google Drive storage quota"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900 text-[11px] font-bold inline-flex items-center gap-1 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </>
          )}
        </div>
      </div>

      {(localError || driveState.lastError) && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{localError || driveState.lastError}</span>
        </div>
      )}

      {driveState.connected && (
        <div className="pt-2 border-t border-blue-100 dark:border-blue-800/60 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2 text-emerald-900 dark:text-emerald-100 font-semibold">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">
                <FolderOpen className="w-3.5 h-3.5" />
                {CHOY_DRIVE_FOLDER_NAME}
              </span>
              {quota && quota.limitBytes > 0 && (
                <span>
                  Used <strong>{formatStorageBytes(quota.usageBytes)}</strong> of{' '}
                  <strong>{formatStorageBytes(quota.limitBytes)}</strong> ({formatStorageBytes(freeBytes)} free)
                </span>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-[11px] font-bold text-emerald-900 dark:text-emerald-100 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={driveState.enabledForVideos}
                onChange={(e) => setUseGoogleDriveForVideos(e.target.checked)}
                className="accent-blue-600 w-3.5 h-3.5 rounded"
              />
              <span>Use Google Drive as primary video backend (Up to 5 GB)</span>
            </label>
          </div>

          {quota && quota.limitBytes > 0 && (
            <div className="w-full h-2 rounded-full bg-blue-100 dark:bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
