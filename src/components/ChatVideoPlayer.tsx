import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Volume2, VolumeX, Play, Maximize2, Minimize2, X, RefreshCw, AlertTriangle, ExternalLink, Download, HardDrive } from 'lucide-react';
import {
  extractGoogleDriveFileId,
  buildGoogleDrivePreviewUrl,
  buildGoogleDriveDownloadUrl,
} from '../services/googleDriveVideoService';

interface ChatVideoPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  autoPlayWithSound?: boolean;
}

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const R2_MEDIA_PATH_RE =
  /((?:posts|messages|voice|avatars)\/\d{4}-\d{2}\/[a-zA-Z0-9_-]+\.(?:mp4|webm|mov|m4v|3gp|mkv|ogv))/i;

function extractR2ProxyUrl(rawSrc: string): string | null {
  if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('blob:') || rawSrc.startsWith('/api/media/r2/')) {
    return null;
  }
  try {
    const parsed = new URL(rawSrc);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('.r2.dev') && !host.endsWith('.r2.cloudflarestorage.com')) {
      return null;
    }
    const match = parsed.pathname.match(R2_MEDIA_PATH_RE);
    if (match?.[1]) {
      return `/api/media/r2/${match[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

function isPrivateR2S3Url(rawSrc: string): boolean {
  try {
    return new URL(rawSrc).hostname.toLowerCase().endsWith('.r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/^data:([^;]+)/i);
    const rawMime = mimeMatch?.[1]?.toLowerCase() || 'video/mp4';
    const normalizedMime = rawMime === 'video/quicktime' || rawMime === 'video/x-m4v' ? 'video/mp4' : rawMime;
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: normalizedMime });
  } catch {
    return null;
  }
}

export const ChatVideoPlayer: React.FC<ChatVideoPlayerProps> = ({
  src,
  title,
  subtitle,
  compact = false,
  autoPlayWithSound = false,
}) => {
  const videoRef = useRef<FullscreenVideoElement>(null);
  const fsVideoRef = useRef<FullscreenVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreenOverlay, setIsFullscreenOverlay] = useState(false);
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [blobObjectUrl, setBlobObjectUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string>('');
  const [retryNonce, setRetryNonce] = useState(0);
  const resumeTimeRef = useRef(0);

  const driveFileId = useMemo(() => extractGoogleDriveFileId(src), [src]);
  const drivePreviewUrl = useMemo(
    () => (driveFileId ? buildGoogleDrivePreviewUrl(driveFileId) : null),
    [driveFileId]
  );
  const driveDownloadUrl = useMemo(
    () => (driveFileId ? buildGoogleDriveDownloadUrl(driveFileId) : null),
    [driveFileId]
  );

  const r2ProxyUrl = useMemo(() => extractR2ProxyUrl(src), [src]);
  const forceProxyFirst = useMemo(() => isPrivateR2S3Url(src) && Boolean(r2ProxyUrl), [src, r2ProxyUrl]);

  // Convert large data:video/... strings into Blob URLs so Android Chrome & iOS Safari play reliably
  useEffect(() => {
    setUseProxyFallback(false);
    setVideoError('');
    setIsPlaying(false);

    if (!src || !src.startsWith('data:')) {
      setBlobObjectUrl(null);
      return;
    }

    const blob = dataUrlToBlob(src);
    if (!blob) {
      setBlobObjectUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(blob);
    setBlobObjectUrl(objUrl);
    return () => {
      URL.revokeObjectURL(objUrl);
    };
  }, [src]);

  const effectiveSrc = useMemo(() => {
    if (blobObjectUrl) return blobObjectUrl;
    if ((forceProxyFirst || useProxyFallback) && r2ProxyUrl) {
      return retryNonce > 0 ? `${r2ProxyUrl}?r=${retryNonce}` : r2ProxyUrl;
    }
    if (retryNonce > 0 && src && !src.startsWith('data:') && !src.startsWith('blob:')) {
      const sep = src.includes('?') ? '&' : '?';
      return `${src}${sep}r=${retryNonce}`;
    }
    return src;
  }, [blobObjectUrl, forceProxyFirst, useProxyFallback, r2ProxyUrl, src, retryNonce]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    if (autoPlayWithSound) {
      el.play().catch(async () => {
        // Fallback to muted autoplay if browser autoplay policy requires gesture
        try {
          el.muted = true;
          setIsMuted(true);
          await el.play();
        } catch {
          // Wait for explicit user tap
        }
      });
    }
  }, [effectiveSrc, autoPlayWithSound]);

  useEffect(() => {
    if (!isFullscreenOverlay) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseFullscreenOverlay();
    };
    window.addEventListener('keydown', onKeyDown);
    const fsEl = fsVideoRef.current;
    if (fsEl) {
      fsEl.currentTime = resumeTimeRef.current;
      fsEl.muted = isMuted;
      fsEl.volume = 1;
      fsEl.play().catch(() => {});
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreenOverlay]);

  const handleVideoError = () => {
    // Automatically switch to same-origin signed R2 proxy if direct r2.dev stream failed
    if (!forceProxyFirst && !useProxyFallback && r2ProxyUrl) {
      setUseProxyFallback(true);
      setVideoError('');
      return;
    }
    const el = videoRef.current;
    const code = el?.error?.code;
    if (code === 4) {
      setVideoError('Video format or source could not be decoded by this browser.');
    } else if (code === 2) {
      setVideoError('Network interrupted while loading video.');
    } else {
      setVideoError('Could not load video. Tap Retry to stream again.');
    }
    setIsPlaying(false);
  };

  const handlePlayWithSound = async () => {
    const el = videoRef.current;
    if (!el) return;
    setVideoError('');
    if (el.readyState === 0) {
      el.load();
    }
    el.muted = false;
    el.volume = 1;
    setIsMuted(false);
    try {
      await el.play();
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') {
        try {
          el.muted = true;
          setIsMuted(true);
          await el.play();
          return;
        } catch {
          // fall through
        }
      }
      if (!forceProxyFirst && !useProxyFallback && r2ProxyUrl) {
        setUseProxyFallback(true);
      } else {
        setVideoError('Tap Retry or open video directly if your browser blocks playback.');
      }
    }
  };

  const handleRetryPlayback = () => {
    setVideoError('');
    if (!useProxyFallback && r2ProxyUrl) {
      setUseProxyFallback(true);
    }
    setRetryNonce((n) => n + 1);
    window.setTimeout(() => {
      const el = videoRef.current;
      if (el) {
        el.load();
        el.play().catch(() => {});
      }
    }, 80);
  };

  const handleToggleMute = () => {
    const el = isFullscreenOverlay ? fsVideoRef.current : videoRef.current;
    if (!el) return;
    const nextMuted = !el.muted;
    el.muted = nextMuted;
    if (!nextMuted && el.volume === 0) {
      el.volume = 1;
    }
    setIsMuted(nextMuted);
  };

  const handleOpenFullscreen = async () => {
    const el = videoRef.current;
    if (!el) return;

    resumeTimeRef.current = el.currentTime || 0;

    // Try native Fullscreen API first (Android Chrome / Desktop / iOS Safari)
    try {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen();
        el.play().catch(() => {});
        return;
      }
      if (typeof el.webkitRequestFullscreen === 'function') {
        await el.webkitRequestFullscreen();
        el.play().catch(() => {});
        return;
      }
      if (typeof el.webkitEnterFullscreen === 'function') {
        el.webkitEnterFullscreen();
        el.play().catch(() => {});
        return;
      }
    } catch {
      // Fall back to full-viewport theater modal (works in iframes & all WebViews)
    }

    el.pause();
    setIsFullscreenOverlay(true);
  };

  const handleCloseFullscreenOverlay = () => {
    const fsEl = fsVideoRef.current;
    const mainEl = videoRef.current;
    if (fsEl && mainEl) {
      mainEl.currentTime = fsEl.currentTime || 0;
      mainEl.muted = fsEl.muted;
      setIsMuted(fsEl.muted);
    }
    setIsFullscreenOverlay(false);
  };

  if (driveFileId && drivePreviewUrl) {
    return (
      <div className="w-full space-y-1.5">
        <div className="relative w-full rounded-xl overflow-hidden bg-black border border-blue-500/60">
          <iframe
            src={drivePreviewUrl}
            title={title || 'Google Drive Video'}
            allow="autoplay; fullscreen"
            allowFullScreen
            className={`w-full border-0 bg-black ${compact ? 'h-48' : 'h-64 sm:h-72'}`}
          />
          <div className="px-2.5 py-1.5 bg-slate-950/95 border-t border-blue-500/30 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 font-bold text-blue-300">
              <HardDrive className="w-3 h-3" />
              <span>Google Drive Video Stream</span>
            </span>
            <div className="flex items-center gap-1.5">
              {driveDownloadUrl && (
                <a
                  href={driveDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1 transition"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </a>
              )}
              <a
                href={drivePreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold inline-flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open</span>
              </a>
              <button
                type="button"
                onClick={() => setIsFullscreenOverlay(true)}
                className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 font-bold inline-flex items-center gap-1 transition"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Theater</span>
              </button>
            </div>
          </div>
        </div>

        {(title || subtitle) && (
          <div className="flex items-center justify-between text-[10px] px-0.5 gap-2">
            {title && <span className="font-bold text-white truncate">{title}</span>}
            {subtitle && <span className="text-emerald-300 shrink-0">{subtitle}</span>}
          </div>
        )}

        {isFullscreenOverlay && (
          <div className="fixed inset-0 z-[75] bg-black flex flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-950/95 border-b border-blue-800/70 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{title || 'Google Drive Video'}</div>
                {subtitle && <div className="text-[10px] text-blue-300 truncate">{subtitle}</div>}
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreenOverlay(false)}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                title="Exit Theater Mode"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 bg-black">
              <iframe
                src={drivePreviewUrl}
                title={title || 'Google Drive Video Fullscreen'}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="w-full h-full border-0 bg-black"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="relative w-full rounded-xl overflow-hidden bg-black border border-emerald-700/60">
        <video
          key={effectiveSrc}
          ref={videoRef}
          src={effectiveSrc}
          controls
          playsInline
          preload="metadata"
          muted={isMuted}
          onCanPlay={() => setVideoError('')}
          onError={handleVideoError}
          onPlay={() => {
            setVideoError('');
            if (videoRef.current) {
              setIsMuted(videoRef.current.muted);
            }
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onVolumeChange={() => {
            if (videoRef.current) {
              setIsMuted(videoRef.current.muted || videoRef.current.volume === 0);
            }
          }}
          className={`w-full bg-black object-contain ${compact ? 'max-h-44' : 'max-h-72'}`}
        />

        {!isPlaying && !videoError && (
          <button
            type="button"
            onClick={handlePlayWithSound}
            className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-emerald-400/95 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow hover:bg-emerald-300 transition"
            title="Play with sound"
          >
            <Play className="w-3 h-3 fill-current" /> Play with Sound
          </button>
        )}

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleMute}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow transition ${
              isMuted
                ? 'bg-red-500/90 text-white'
                : 'bg-slate-950/80 border border-emerald-400/60 text-emerald-300'
            }`}
            title={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            <span>{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenFullscreen}
            className="px-2 py-1 rounded-lg bg-slate-950/85 border border-cyan-400/70 text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow transition"
            title="Fullscreen Video"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fullscreen</span>
          </button>
        </div>

        {videoError && (
          <div className="px-3 py-2 bg-rose-950/90 border-t border-rose-500/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-100">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{videoError}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleRetryPlayback}
                className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-[10px] inline-flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
              {effectiveSrc && !effectiveSrc.startsWith('data:') && !effectiveSrc.startsWith('blob:') && (
                <a
                  href={effectiveSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] inline-flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {(title || subtitle) && (
        <div className="flex items-center justify-between text-[10px] px-0.5 gap-2">
          {title && <span className="font-bold text-white truncate">{title}</span>}
          {subtitle && <span className="text-emerald-300 shrink-0">{subtitle}</span>}
        </div>
      )}

      {/* Full-Viewport Video Fullscreen Fallback (for iframes & mobile browsers blocking native fullscreen) */}
      {isFullscreenOverlay && (
        <div className="fixed inset-0 z-[75] bg-black flex flex-col">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-950/90 border-b border-emerald-800/70 shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{title || 'Video Fullscreen'}</div>
              {subtitle && <div className="text-[10px] text-emerald-300 truncate">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleMute}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
                  isMuted
                    ? 'bg-red-500 text-white'
                    : 'bg-emerald-950 border border-emerald-500/60 text-emerald-200'
                }`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isMuted ? 'Muted' : 'Sound'}</span>
              </button>
              <button
                type="button"
                onClick={handleCloseFullscreenOverlay}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1"
                title="Exit Fullscreen"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={fsVideoRef}
              src={effectiveSrc}
              controls
              playsInline
              autoPlay
              muted={isMuted}
              onVolumeChange={() => {
                if (fsVideoRef.current) {
                  setIsMuted(fsVideoRef.current.muted || fsVideoRef.current.volume === 0);
                }
              }}
              className="w-full h-full object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
