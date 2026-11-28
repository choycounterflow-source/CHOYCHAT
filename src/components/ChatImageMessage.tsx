import React, { useState, useEffect } from 'react';
import { ImageOff, RefreshCw, Loader2 } from 'lucide-react';

const R2_IMAGE_PATH_RE =
  /((?:posts|messages|voice|avatars|marketplace|music|videos|kyc|receipts)\/\d{4}-\d{2}\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|avif|bmp))/i;

export function resolveR2ImageProxyUrl(rawSrc: string): string | null {
  if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('blob:') || rawSrc.startsWith('/api/media/r2/')) {
    return null;
  }
  try {
    const parsed = new URL(rawSrc);
    const host = parsed.hostname.toLowerCase();
    const isR2Like =
      host.endsWith('.r2.dev') ||
      host.endsWith('.r2.cloudflarestorage.com') ||
      R2_IMAGE_PATH_RE.test(parsed.pathname);
    if (!isR2Like) return null;
    const match = parsed.pathname.match(R2_IMAGE_PATH_RE);
    if (match?.[1]) {
      return `/api/media/r2/${match[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

interface ChatImageMessageProps {
  src: string;
  alt?: string;
  onZoom?: (resolvedSrc: string) => void;
}

export const ChatImageMessage: React.FC<ChatImageMessageProps> = ({
  src,
  alt = 'Chat Photo',
  onZoom,
}) => {
  const [activeSrc, setActiveSrc] = useState(src);
  const [triedProxy, setTriedProxy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setActiveSrc(src);
    setTriedProxy(false);
    setLoaded(false);
    setFailed(false);
    setRetryCount(0);
  }, [src]);

  const handleError = () => {
    if (!triedProxy) {
      const proxyUrl = resolveR2ImageProxyUrl(activeSrc);
      if (proxyUrl && proxyUrl !== activeSrc) {
        setTriedProxy(true);
        setActiveSrc(proxyUrl);
        return;
      }
    }
    setFailed(true);
    setLoaded(true);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCount = retryCount + 1;
    setRetryCount(nextCount);
    setFailed(false);
    setLoaded(false);
    if (activeSrc.startsWith('data:') || activeSrc.startsWith('blob:')) {
      setActiveSrc(src);
    } else {
      const sep = activeSrc.includes('?') ? '&' : '?';
      setActiveSrc(`${activeSrc.split('&_retry=')[0].split('?_retry=')[0]}${sep}_retry=${nextCount}`);
    }
  };

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 px-4 py-5 text-center min-w-[180px]">
        <ImageOff className="w-6 h-6 text-slate-500 dark:text-slate-300" />
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          Image could not load
        </span>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] transition"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onZoom?.(activeSrc)}
      className="relative block rounded-xl overflow-hidden cursor-zoom-in bg-white p-1 max-w-full border border-slate-200/80 dark:border-slate-700/80 shadow-xs"
      title="Tap to zoom picture"
    >
      {!loaded && (
        <div className="flex items-center justify-center min-w-[140px] min-h-[110px] rounded-lg bg-slate-100 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        </div>
      )}
      <img
        src={activeSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onError={handleError}
        className={`max-h-64 max-w-full w-auto h-auto rounded-lg object-contain bg-white block mx-auto ${
          loaded ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
        }`}
      />
    </button>
  );
};
