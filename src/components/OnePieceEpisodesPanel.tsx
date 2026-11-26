import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  CheckCircle2,
  Circle,
  ExternalLink,
  Film,
  Link2,
  Pause,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ONE_PIECE_LATEST_30_EPISODES,
  type OnePieceArc,
  type OnePieceEpisodeItem,
} from '../data/onePieceEpisodes';
import { ChatVideoPlayer } from './ChatVideoPlayer';

const WATCHED_STORAGE_KEY = 'choychat_one_piece_watched_eps_v1';
const EPISODE_LINKS_STORAGE_KEY = 'choychat_one_piece_ep_links_v1';
const RECAP_DURATION_SEC = 24;

function loadWatchedEpisodes(): number[] {
  try {
    const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function loadSavedEpisodeLinks(): Record<number, string> {
  try {
    const raw = localStorage.getItem(EPISODE_LINKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const epNum = Number(k);
      if (Number.isInteger(epNum) && typeof v === 'string' && /^https?:\/\//i.test(v)) {
        out[epNum] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function parseSafeVideoSource(rawUrl: string): { kind: 'video' | 'iframe'; url: string } | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('blob:')) {
    return { kind: 'video', url: trimmed };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    // Convert standard YouTube links into clean embed URLs
    if (host.includes('youtube.com') || host === 'youtu.be') {
      let ytId = '';
      if (host === 'youtu.be') {
        ytId = parsed.pathname.replace(/^\//, '').split('/')[0] || '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        ytId = parsed.pathname.replace('/embed/', '').split('/')[0] || '';
      } else {
        ytId = parsed.searchParams.get('v') || '';
      }
      if (/^[a-zA-Z0-9_-]{6,20}$/.test(ytId)) {
        return { kind: 'iframe', url: `https://www.youtube.com/embed/${ytId}?autoplay=1` };
      }
    }
    if (host.includes('vimeo.com')) {
      const vimeoId = parsed.pathname.split('/').filter(Boolean).pop() || '';
      if (/^\d{4,15}$/.test(vimeoId)) {
        return { kind: 'iframe', url: `https://player.vimeo.com/video/${vimeoId}?autoplay=1` };
      }
    }
    return { kind: 'video', url: parsed.toString() };
  } catch {
    return null;
  }
}

function drawRecapFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ep: OnePieceEpisodeItem,
  elapsedSec: number
) {
  const progress = Math.min(1, Math.max(0, elapsedSec / RECAP_DURATION_SEC));

  // Ocean & Sky Backdrop
  const bg = ctx.createLinearGradient(0, 0, width, height);
  if (ep.arc === 'Egghead') {
    bg.addColorStop(0, '#082f49');
    bg.addColorStop(0.55, '#0f172a');
    bg.addColorStop(1, '#022c22');
  } else {
    bg.addColorStop(0, '#022c22');
    bg.addColorStop(0.5, '#0f172a');
    bg.addColorStop(1, '#450a0a');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Moving Sun / Horizon Glow
  const glowX = width * (0.2 + progress * 0.6);
  const glowY = height * 0.28;
  const glow = ctx.createRadialGradient(glowX, glowY, 8, glowX, glowY, width * 0.45);
  glow.addColorStop(0, ep.arc === 'Egghead' ? 'rgba(34, 211, 238, 0.34)' : 'rgba(251, 191, 36, 0.32)');
  glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Rolling Sea Waves
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    const baseY = height * (0.76 + layer * 0.06);
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 16) {
      const wave =
        Math.sin(x * 0.02 + elapsedSec * (1.8 + layer * 0.5) + layer * 1.4) * (6 + layer * 2);
      ctx.lineTo(x, baseY + wave);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle =
      layer === 0
        ? 'rgba(16, 185, 129, 0.16)'
        : layer === 1
        ? 'rgba(6, 78, 59, 0.35)'
        : 'rgba(2, 6, 23, 0.7)';
    ctx.fill();
  }

  // Straw-Hat Compass Emblem Watermark Geometry (clean geometric ring)
  ctx.save();
  ctx.translate(width * 0.84, height * 0.3);
  ctx.rotate(elapsedSec * 0.25);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 24, Math.sin(ang) * 24);
    ctx.lineTo(Math.cos(ang) * 42, Math.sin(ang) * 42);
    ctx.stroke();
  }
  ctx.restore();

  // Top Header Text
  ctx.fillStyle = '#34d399';
  ctx.font = '700 13px sans-serif';
  ctx.fillText(`ONE PIECE · EPISODE ${ep.episodeNumber} · ${ep.arc.toUpperCase()} ARC`, 24, 34);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.font = '600 12px sans-serif';
  ctx.fillText(`${ep.seasonLabel} · Aired ${ep.airedDate}`, 24, 54);

  // Storyboard Phase Selection
  if (progress < 0.34) {
    // Phase 1: Episode Title Card
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px sans-serif';
    wrapCanvasText(ctx, ep.title, 24, 118, width - 48, 28);

    ctx.fillStyle = '#fde68a';
    ctx.font = '600 13px sans-serif';
    ctx.fillText(`Featured: ${ep.keyCharacters.join(' · ')}`, 24, height - 62);
  } else if (progress < 0.78) {
    // Phase 2: Episode Story Summary Beat
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '700 12px sans-serif';
    ctx.fillText('EPISODE STORY RECAP', 24, 96);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 16px sans-serif';
    wrapCanvasText(ctx, ep.summary, 24, 126, width - 48, 23);
  } else {
    // Phase 3: Next / Official Streaming Prompt
    ctx.fillStyle = '#fde68a';
    ctx.font = '700 12px sans-serif';
    ctx.fillText('CONTINUE ADVENTURE', 24, 98);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px sans-serif';
    wrapCanvasText(ctx, ep.title, 24, 128, width - 48, 26);

    ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
    ctx.font = '500 13px sans-serif';
    ctx.fillText('Load a local video file or open Crunchyroll below for the full 24-minute episode.', 24, height - 62);
  }

  // Bottom Timeline Strip inside Canvas
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(24, height - 28, width - 48, 5);
  ctx.fillStyle = '#34d399';
  ctx.fillRect(24, height - 28, (width - 48) * progress, 5);
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let currY = y;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currY);
      line = words[i];
      currY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currY);
  }
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const OnePieceEpisodesPanel: React.FC = () => {
  const [selectedEpNumber, setSelectedEpNumber] = useState<number>(
    ONE_PIECE_LATEST_30_EPISODES[0].episodeNumber
  );
  const [arcFilter, setArcFilter] = useState<'all' | OnePieceArc>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllRows, setShowAllRows] = useState(false);
  const [watchedEps, setWatchedEps] = useState<number[]>(loadWatchedEpisodes);

  // Recap & Custom Full-Episode Video Player State
  const [isRecapPlaying, setIsRecapPlaying] = useState(false);
  const [recapElapsedSec, setRecapElapsedSec] = useState(0);
  const [isRecapMuted, setIsRecapMuted] = useState(false);
  const [localEpisodeVideos, setLocalEpisodeVideos] = useState<Record<number, string>>({});
  const [savedEpisodeLinks, setSavedEpisodeLinks] = useState<Record<number, string>>(loadSavedEpisodeLinks);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(watchedEps));
    } catch {
      // ignore storage errors
    }
  }, [watchedEps]);

  useEffect(() => {
    try {
      localStorage.setItem(EPISODE_LINKS_STORAGE_KEY, JSON.stringify(savedEpisodeLinks));
    } catch {
      // ignore storage errors
    }
  }, [savedEpisodeLinks]);

  useEffect(() => {
    return () => {
      localUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const filteredEpisodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = ONE_PIECE_LATEST_30_EPISODES.filter((ep) => {
      if (arcFilter !== 'all' && ep.arc !== arcFilter) return false;
      if (!q) return true;
      return (
        String(ep.episodeNumber).includes(q) ||
        ep.title.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.keyCharacters.some((c) => c.toLowerCase().includes(q))
      );
    });
    return sortOrder === 'oldest' ? [...list].reverse() : list;
  }, [arcFilter, searchQuery, sortOrder]);

  const activeEpisode = useMemo(
    () =>
      ONE_PIECE_LATEST_30_EPISODES.find((e) => e.episodeNumber === selectedEpNumber) ||
      ONE_PIECE_LATEST_30_EPISODES[0],
    [selectedEpNumber]
  );

  const rawCustomSource =
    localEpisodeVideos[activeEpisode.episodeNumber] ||
    savedEpisodeLinks[activeEpisode.episodeNumber] ||
    '';
  const activeCustomSource = useMemo(() => parseSafeVideoSource(rawCustomSource), [rawCustomSource]);
  const activeCustomVideoUrl = activeCustomSource?.url || null;
  const visibleRows = showAllRows ? filteredEpisodes : filteredEpisodes.slice(0, 10);

  // Paint Canvas Recap Frame whenever episode or timestamp updates
  useEffect(() => {
    if (activeCustomVideoUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawRecapFrame(ctx, canvas.width, canvas.height, activeEpisode, recapElapsedSec);
  }, [activeCustomVideoUrl, activeEpisode, recapElapsedSec]);

  // Playback Tick + Gentle Adventure Chord Pulse when Playing Recap
  useEffect(() => {
    if (!isRecapPlaying || activeCustomVideoUrl) return;
    let lastTick = performance.now();
    let lastNoteBeat = -1;

    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;

      setRecapElapsedSec((prev) => {
        const next = prev + dt;
        const beat = Math.floor(next * 1.5);
        if (!isRecapMuted && beat !== lastNoteBeat) {
          lastNoteBeat = beat;
          const ctx = audioCtxRef.current;
          if (ctx && ctx.state === 'running') {
            try {
              const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
              const freq = scale[beat % scale.length];
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, ctx.currentTime);
              gain.gain.setValueAtTime(0.0001, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.04);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.48);
            } catch {
              // ignore audio synth glitches
            }
          }
        }

        if (next >= RECAP_DURATION_SEC) {
          setIsRecapPlaying(false);
          setWatchedEps((w) =>
            w.includes(activeEpisode.episodeNumber) ? w : [...w, activeEpisode.episodeNumber]
          );
          return RECAP_DURATION_SEC;
        }
        return next;
      });
    }, 50);

    return () => window.clearInterval(timer);
  }, [activeCustomVideoUrl, activeEpisode.episodeNumber, isRecapMuted, isRecapPlaying]);

  const toggleRecapPlay = () => {
    if (!isRecapPlaying && !isRecapMuted) {
      try {
        if (!audioCtxRef.current) {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            audioCtxRef.current = new AudioCtx();
          }
        }
        if (audioCtxRef.current?.state === 'suspended') {
          void audioCtxRef.current.resume().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
    if (recapElapsedSec >= RECAP_DURATION_SEC) {
      setRecapElapsedSec(0);
    }
    setIsRecapPlaying((prev) => !prev);
  };

  const selectEpisode = (epNum: number, autoStart = true) => {
    setSelectedEpNumber(epNum);
    setRecapElapsedSec(0);
    setIsRecapPlaying(autoStart);
    if (autoStart && !isRecapMuted) {
      try {
        if (!audioCtxRef.current) {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            audioCtxRef.current = new AudioCtx();
          }
        }
        if (audioCtxRef.current?.state === 'suspended') {
          void audioCtxRef.current.resume().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
  };

  const stepEpisode = (delta: -1 | 1) => {
    const idx = ONE_PIECE_LATEST_30_EPISODES.findIndex(
      (e) => e.episodeNumber === activeEpisode.episodeNumber
    );
    if (idx === -1) return;
    const nextIdx = (idx + delta + ONE_PIECE_LATEST_30_EPISODES.length) % ONE_PIECE_LATEST_30_EPISODES.length;
    selectEpisode(ONE_PIECE_LATEST_30_EPISODES[nextIdx].episodeNumber, true);
  };

  const toggleWatched = (epNum: number) => {
    setWatchedEps((prev) =>
      prev.includes(epNum) ? prev.filter((n) => n !== epNum) : [...prev, epNum]
    );
  };

  const handleLoadLocalVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    localUrlsRef.current.push(url);
    setIsRecapPlaying(false);
    setUrlError('');
    setLocalEpisodeVideos((prev) => ({
      ...prev,
      [activeEpisode.episodeNumber]: url,
    }));
  };

  const handleSaveEpisodeUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSafeVideoSource(urlDraft);
    if (!parsed || parsed.url.startsWith('blob:')) {
      setUrlError('Enter a valid https:// video link (.mp4, .webm, or YouTube URL).');
      return;
    }
    setUrlError('');
    setIsRecapPlaying(false);
    setLocalEpisodeVideos((prev) => {
      const next = { ...prev };
      delete next[activeEpisode.episodeNumber];
      return next;
    });
    setSavedEpisodeLinks((prev) => ({
      ...prev,
      [activeEpisode.episodeNumber]: urlDraft.trim(),
    }));
    setIsUrlInputOpen(false);
    setUrlDraft('');
  };

  const handleClearCustomSource = () => {
    const epNum = activeEpisode.episodeNumber;
    setLocalEpisodeVideos((prev) => {
      const next = { ...prev };
      delete next[epNum];
      return next;
    });
    setSavedEpisodeLinks((prev) => {
      const next = { ...prev };
      delete next[epNum];
      return next;
    });
  };

  const isWatched = watchedEps.includes(activeEpisode.episodeNumber);

  return (
    <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/50 rounded-2xl shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-3.5 border-b border-emerald-200/80 dark:border-emerald-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-emerald-950 dark:text-white truncate">
              One Piece — Latest 30 Episodes
            </h3>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 truncate">
              Episodes 1151–1180 · Egghead Finale &amp; Elbaph ·{' '}
              <span className="font-mono tabular-nums font-bold">
                {watchedEps.length}/30 watched
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
        >
          <ArrowDownUp className="w-3.5 h-3.5 shrink-0" />
          <span>{sortOrder === 'newest' ? 'Latest First (1180→1151)' : 'Chronological (1151→1180)'}</span>
        </button>
      </div>

      {/* Selected Episode Theater Player */}
      <div className="p-4 border-b border-emerald-200/80 dark:border-emerald-800/80 space-y-3 bg-emerald-50/40 dark:bg-emerald-950/40">
        {activeCustomSource ? (
          activeCustomSource.kind === 'iframe' ? (
            <div className="rounded-2xl overflow-hidden bg-black border border-emerald-500/40 shadow-md aspect-video w-full">
              <iframe
                src={activeCustomSource.url}
                title={`One Piece Episode ${activeEpisode.episodeNumber}`}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <ChatVideoPlayer
              src={activeCustomSource.url}
              title={`One Piece Episode ${activeEpisode.episodeNumber}: ${activeEpisode.title}`}
              subtitle={`${activeEpisode.arc} Arc · ${activeEpisode.airedDate}`}
              autoPlayWithSound
            />
          )
        ) : (
          <div className="rounded-2xl overflow-hidden bg-slate-950 border border-emerald-500/30 shadow-md">
            <div className="relative aspect-video w-full bg-slate-950">
              <canvas
                ref={canvasRef}
                width={720}
                height={405}
                className="w-full h-full object-contain block"
              />
              {!isRecapPlaying && (
                <button
                  type="button"
                  onClick={toggleRecapPlay}
                  aria-label={`Play Episode ${activeEpisode.episodeNumber} 24-second story preview`}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/35 hover:bg-slate-950/25 transition"
                >
                  <span className="min-h-[56px] px-5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-xl">
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play 24s Story Preview</span>
                  </span>
                </button>
              )}
            </div>

            {/* Video Recap Controls */}
            <div className="px-3.5 py-2.5 bg-slate-900 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stepEpisode(1)}
                  title="Previous episode (older)"
                  aria-label="Previous episode"
                  className="min-h-[40px] min-w-[40px] rounded-xl text-slate-200 hover:bg-slate-800 flex items-center justify-center transition"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleRecapPlay}
                  aria-label={isRecapPlaying ? 'Pause' : 'Play'}
                  className="min-h-[40px] px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 transition"
                >
                  {isRecapPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => stepEpisode(-1)}
                  title="Next episode (newer)"
                  aria-label="Next episode"
                  className="min-h-[40px] min-w-[40px] rounded-xl text-slate-200 hover:bg-slate-800 flex items-center justify-center transition"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecapElapsedSec(0);
                    setIsRecapPlaying(true);
                  }}
                  title="Restart recap"
                  aria-label="Restart recap"
                  className="min-h-[40px] min-w-[40px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center transition"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[140px] max-w-xs">
                <input
                  type="range"
                  min={0}
                  max={RECAP_DURATION_SEC}
                  step={0.1}
                  value={recapElapsedSec}
                  onChange={(e) => setRecapElapsedSec(Number(e.target.value))}
                  aria-label="Seek episode recap"
                  className="w-full h-1.5 accent-emerald-400 cursor-pointer bg-slate-700 rounded-lg"
                />
                <span className="text-[11px] font-mono tabular-nums text-slate-300 shrink-0">
                  {formatSeconds(recapElapsedSec)} / {formatSeconds(RECAP_DURATION_SEC)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsRecapMuted((m) => !m)}
                aria-label={isRecapMuted ? 'Unmute recap audio' : 'Mute recap audio'}
                className="min-h-[40px] min-w-[40px] rounded-xl text-slate-200 hover:bg-slate-800 flex items-center justify-center transition"
              >
                {isRecapMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Episode Synopsis & Actions */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Episode {activeEpisode.episodeNumber} · {activeEpisode.arc} Arc · Aired {activeEpisode.airedDate}
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-emerald-950 dark:text-white leading-snug mt-0.5">
                {activeEpisode.title}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => toggleWatched(activeEpisode.episodeNumber)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                isWatched
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800'
              }`}
            >
              {isWatched ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              <span>{isWatched ? 'Watched' : 'Mark Watched'}</span>
            </button>
          </div>

          <p className="text-xs text-emerald-900/90 dark:text-emerald-100/90 leading-relaxed">
            {activeEpisode.summary}
          </p>

          {!activeCustomVideoUrl && (
            <p className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300/70 dark:border-amber-700/60 rounded-xl px-3 py-2 leading-relaxed">
              Note: Ang built-in player nagpakita lang ug 24-second story preview tungod kay ang full 25–30 min nga copyrighted episode naa sa Crunchyroll/Netflix. Para mo-play ang full 25–30 min dinhi, pag-load ug downloaded video file o i-paste ang video link sa ubos.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleLoadLocalVideo}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>{localEpisodeVideos[activeEpisode.episodeNumber] ? 'Change Video File' : 'Load Video File'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUrlDraft(savedEpisodeLinks[activeEpisode.episodeNumber] || '');
                setUrlError('');
                setIsUrlInputOpen((prev) => !prev);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition"
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span>Paste Video Link</span>
            </button>
            {activeCustomVideoUrl && (
              <button
                type="button"
                onClick={handleClearCustomSource}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-200 hover:bg-rose-100 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap transition"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Clear Video</span>
              </button>
            )}
            <a
              href={activeEpisode.crunchyrollSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Crunchyroll</span>
            </a>
            <a
              href={`https://www.bilibili.tv/en/search-result?q=${encodeURIComponent(`One Piece ${activeEpisode.episodeNumber}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Bilibili</span>
            </a>
            <a
              href="https://www.netflix.com/title/80107103"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Netflix</span>
            </a>
          </div>

          {isUrlInputOpen && (
            <form onSubmit={handleSaveEpisodeUrl} className="pt-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder={`Paste MP4, WebM, or YouTube URL for Ep. ${activeEpisode.episodeNumber}...`}
                  className="flex-1 min-w-[200px] min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white placeholder-emerald-700/60 dark:placeholder-emerald-300/60 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold whitespace-nowrap transition"
                >
                  Load Episode
                </button>
              </div>
              {urlError && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-300">{urlError}</p>}
            </form>
          )}
        </div>
      </div>

      {/* Filter & Search Bar for the 30 Episodes */}
      <div className="px-4 py-3 border-b border-emerald-100 dark:border-emerald-800/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All 30 (1151–1180)' },
              { id: 'Elbaph', label: 'Elbaph (25)' },
              { id: 'Egghead', label: 'Egghead Finale (5)' },
            ] as const
          ).map((tab) => {
            const active = arcFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setArcFilter(tab.id)}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <label className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-emerald-700/70 dark:text-emerald-300/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search episode # or title..."
            className="w-full min-h-[40px] pl-8 pr-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white placeholder-emerald-700/60 dark:placeholder-emerald-300/60 focus:outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      {/* 30 Episodes Directory */}
      <div className="divide-y divide-emerald-100 dark:divide-emerald-800/70">
        {visibleRows.length === 0 ? (
          <div className="p-6 text-center text-xs text-emerald-700 dark:text-emerald-300">
            No matching One Piece episodes in the latest 30 list.
          </div>
        ) : (
          visibleRows.map((ep) => {
            const isSelected = ep.episodeNumber === activeEpisode.episodeNumber;
            const epWatched = watchedEps.includes(ep.episodeNumber);
            return (
              <div
                key={ep.episodeNumber}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 transition ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-800/50'
                    : 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectEpisode(ep.episodeNumber, true)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl"
                >
                  <div
                    className={`w-12 h-10 rounded-xl bg-gradient-to-br ${ep.accentGradient} flex items-center justify-center text-white font-mono tabular-nums text-xs font-extrabold shrink-0 shadow-sm`}
                  >
                    {ep.episodeNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs sm:text-sm font-extrabold truncate ${
                        isSelected
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-emerald-950 dark:text-white'
                      }`}
                    >
                      {ep.title}
                    </div>
                    <div className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80 truncate mt-0.5">
                      {ep.arc} Arc · {ep.airedDate} · {ep.durationLabel}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleWatched(ep.episodeNumber)}
                    aria-label={epWatched ? `Unmark episode ${ep.episodeNumber} watched` : `Mark episode ${ep.episodeNumber} watched`}
                    title={epWatched ? 'Watched' : 'Mark watched'}
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition ${
                      epWatched
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : 'text-emerald-700/40 dark:text-emerald-300/40 hover:text-emerald-700 dark:hover:text-emerald-200'
                    }`}
                  >
                    {epWatched ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectEpisode(ep.episodeNumber, true)}
                    aria-label={`Play episode ${ep.episodeNumber}`}
                    className={`min-h-[40px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap transition ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-200 dark:hover:bg-emerald-800'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isSelected ? 'Selected' : 'Play'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredEpisodes.length > 10 && (
        <div className="px-4 py-3 border-t border-emerald-100 dark:border-emerald-800/70 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllRows((prev) => !prev)}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-xs font-extrabold text-emerald-950 dark:text-white transition"
          >
            {showAllRows
              ? 'Show Latest 10 Only'
              : `Show All ${filteredEpisodes.length} Episodes (1151–1180)`}
          </button>
        </div>
      )}
    </div>
  );
};
