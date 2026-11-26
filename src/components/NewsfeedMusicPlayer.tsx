import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Disc3,
  ExternalLink,
  Link2,
  Music,
  Pause,
  Play,
  Plus,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  getOpmStreamingLinks,
  type OpmGenreGroup,
  type OpmSongTrack,
} from '../utils/opmAudioSynth';

const OPM_LINKS_STORAGE_KEY = 'choychat_opm_custom_links_v1';

interface NewsfeedMusicPlayerProps {
  tracks: OpmSongTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isShuffle: boolean;
  isRepeatOne: boolean;
  isMuted: boolean;
  volume: number;
  onSelectTrack: (trackId: string) => void;
  onTogglePlay: () => void;
  onPauseAudio: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (timeSec: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeatOne: () => void;
  onToggleMute: () => void;
  onVolumeChange: (val: number) => void;
  onUploadSongs: (files: FileList) => void;
  onAttachTrackAudioUrl: (trackId: string, audioUrl: string | null) => void;
  onRemoveCustomTrack: (trackId: string) => void;
}

function loadSavedSongLinks(): Record<string, string> {
  try {
    const raw = localStorage.getItem(OPM_LINKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function parseSafeSongSource(rawUrl: string): { kind: 'audio' | 'youtube'; url: string } | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
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
        return { kind: 'youtube', url: `https://www.youtube.com/embed/${ytId}?autoplay=1` };
      }
    }
    return { kind: 'audio', url: parsed.toString() };
  } catch {
    return null;
  }
}

function formatTrackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const NewsfeedMusicPlayer: React.FC<NewsfeedMusicPlayerProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  currentTime,
  duration,
  isShuffle,
  isRepeatOne,
  isMuted,
  volume,
  onSelectTrack,
  onTogglePlay,
  onPauseAudio,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onToggleShuffle,
  onToggleRepeatOne,
  onToggleMute,
  onVolumeChange,
  onUploadSongs,
  onAttachTrackAudioUrl,
  onRemoveCustomTrack,
}) => {
  const [genreFilter, setGenreFilter] = useState<'all' | OpmGenreGroup>('all');
  const [savedSongLinks, setSavedSongLinks] = useState<Record<string, string>>(loadSavedSongLinks);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(OPM_LINKS_STORAGE_KEY, JSON.stringify(savedSongLinks));
    } catch {
      // ignore storage errors
    }
  }, [savedSongLinks]);

  const activeTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) || tracks[0] || null,
    [tracks, currentTrackId]
  );

  const hasCustomTracks = useMemo(() => tracks.some((t) => t.isCustom), [tracks]);

  const visibleTracks = useMemo(() => {
    if (genreFilter === 'all') return tracks;
    return tracks.filter((t) => t.genreGroup === genreFilter);
  }, [tracks, genreFilter]);

  const savedSource = useMemo(() => {
    if (!activeTrack) return null;
    const raw = savedSongLinks[activeTrack.id];
    return raw ? parseSafeSongSource(raw) : null;
  }, [activeTrack, savedSongLinks]);

  const streamingLinks = useMemo(
    () => (activeTrack ? getOpmStreamingLinks(activeTrack) : null),
    [activeTrack]
  );

  const effectiveDuration = duration > 0 ? duration : activeTrack?.durationSec || 36;
  const clampedTime = Math.min(currentTime, effectiveDuration);
  const hasRealFullSource = Boolean(activeTrack?.isCustom || activeTrack?.audioUrl || savedSource);

  const handleSaveSongLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrack) return;
    const parsed = parseSafeSongSource(urlDraft);
    if (!parsed) {
      setUrlError('Enter a valid https:// audio link (.mp3, .m4a, .wav) or YouTube song URL.');
      return;
    }
    setUrlError('');
    setSavedSongLinks((prev) => ({
      ...prev,
      [activeTrack.id]: urlDraft.trim(),
    }));
    if (parsed.kind === 'audio') {
      onAttachTrackAudioUrl(activeTrack.id, parsed.url);
    } else {
      onPauseAudio();
      onAttachTrackAudioUrl(activeTrack.id, null);
    }
    setIsUrlInputOpen(false);
    setUrlDraft('');
  };

  const handleClearSongLink = () => {
    if (!activeTrack) return;
    setSavedSongLinks((prev) => {
      const next = { ...prev };
      delete next[activeTrack.id];
      return next;
    });
    onAttachTrackAudioUrl(activeTrack.id, null);
  };

  return (
    <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/50 rounded-2xl shadow-sm overflow-hidden">
      {/* Now Playing Deck */}
      {activeTrack && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 dark:from-emerald-950/90 dark:via-emerald-900/70 dark:to-slate-950/90 border-b border-emerald-200/80 dark:border-emerald-800/80 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${activeTrack.coverGradient} flex items-center justify-center shrink-0 shadow-md overflow-hidden`}
              >
                <Disc3
                  className={`w-9 h-9 text-white/90 ${
                    isPlaying && currentTrackId === activeTrack.id ? 'motion-safe:animate-spin' : ''
                  }`}
                  style={{ animationDuration: '6s' }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {savedSource?.kind === 'youtube'
                    ? 'Full Song · YouTube Embed'
                    : hasRealFullSource
                    ? 'Full Audio Track'
                    : isPlaying && currentTrackId === activeTrack.id
                    ? 'Playing Instrumental Preview'
                    : 'OPM Soundbar'}
                </p>
                <h3 className="text-base sm:text-lg font-extrabold text-emerald-950 dark:text-white truncate">
                  {activeTrack.title}
                </h3>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 truncate mt-0.5">
                  {activeTrack.artist} · {activeTrack.genre} · {activeTrack.year}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUploadSongs(e.target.files);
                  }
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
                title="Add your own MP3 or M4A song file to play full audio"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add MP3 / Audio</span>
              </button>
            </div>
          </div>

          {/* Embedded YouTube Song Player when user pasted a YouTube link for this OPM track */}
          {savedSource?.kind === 'youtube' ? (
            <div className="rounded-2xl overflow-hidden bg-black border border-emerald-500/40 shadow-md aspect-video w-full">
              <iframe
                src={savedSource.url}
                title={`${activeTrack.title} - ${activeTrack.artist}`}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <>
              {/* Seek Bar */}
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration}
                  step={0.1}
                  value={clampedTime}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  aria-label="Seek audio position"
                  className="w-full h-2 rounded-lg accent-emerald-500 cursor-pointer bg-emerald-200 dark:bg-emerald-950"
                />
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-emerald-800 dark:text-emerald-200">
                  <span>{formatTrackTime(clampedTime)}</span>
                  <span>{formatTrackTime(effectiveDuration)}</span>
                </div>
              </div>

              {/* Transport Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleShuffle}
                    aria-pressed={isShuffle}
                    aria-label="Toggle shuffle"
                    title="Shuffle playlist"
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition ${
                      isShuffle
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/70'
                    }`}
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleRepeatOne}
                    aria-pressed={isRepeatOne}
                    aria-label="Toggle repeat current song"
                    title="Repeat current song"
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition ${
                      isRepeatOne
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/70'
                    }`}
                  >
                    <Repeat1 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onPrevTrack}
                    aria-label="Previous song"
                    title="Previous song"
                    className="min-h-[44px] min-w-[44px] rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-white hover:bg-emerald-200 dark:hover:bg-emerald-800 flex items-center justify-center transition"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onTogglePlay}
                    aria-label={isPlaying ? 'Pause music' : 'Play music'}
                    title={isPlaying ? 'Pause' : 'Play'}
                    className="min-h-[48px] min-w-[48px] px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNextTrack}
                    aria-label="Next song"
                    title="Next song"
                    className="min-h-[44px] min-w-[44px] rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-white hover:bg-emerald-200 dark:hover:bg-emerald-800 flex items-center justify-center transition"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                    title={isMuted ? 'Unmute' : 'Mute'}
                    className="min-h-[44px] min-w-[44px] rounded-xl text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800/70 flex items-center justify-center transition"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => onVolumeChange(Number(e.target.value))}
                    aria-label="Audio volume"
                    className="hidden sm:block w-20 h-1.5 accent-emerald-500 cursor-pointer bg-emerald-200 dark:bg-emerald-950 rounded-lg"
                  />
                </div>
              </div>
            </>
          )}

          {!hasRealFullSource && (
            <p className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300/70 dark:border-amber-700/60 rounded-xl px-3 py-2 leading-relaxed">
              Note: Ang built-in OPM track kay instrumental preview lang tungod kay ang full original vocals ug MP3 naa sa YouTube, Spotify, o Apple Music. Para sa full song, i-click ang <strong>Add MP3 / Audio</strong>, <strong>Paste Song Link</strong> (MP3 o YouTube URL), o paminaw diretso sa ubos.
            </p>
          )}

          {/* Full Song Links & Paste Song URL Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUrlDraft(savedSongLinks[activeTrack.id] || '');
                setUrlError('');
                setIsUrlInputOpen((prev) => !prev);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition"
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span>Paste Song Link</span>
            </button>
            {savedSource && (
              <button
                type="button"
                onClick={handleClearSongLink}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-200 hover:bg-rose-100 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap transition"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Clear Link</span>
              </button>
            )}
            {streamingLinks && (
              <>
                <a
                  href={streamingLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>YouTube</span>
                </a>
                <a
                  href={streamingLinks.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Spotify</span>
                </a>
                <a
                  href={streamingLinks.appleMusic}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Apple Music</span>
                </a>
              </>
            )}
          </div>

          {isUrlInputOpen && (
            <form onSubmit={handleSaveSongLink} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder={`Paste YouTube or MP3 URL for "${activeTrack.title}"...`}
                  className="flex-1 min-w-[200px] min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white placeholder-emerald-700/60 dark:placeholder-emerald-300/60 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold whitespace-nowrap transition"
                >
                  Load Song
                </button>
              </div>
              {urlError && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-300">{urlError}</p>}
            </form>
          )}
        </div>
      )}

      {/* Genre Filter Row */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto border-b border-emerald-100 dark:border-emerald-800/70">
        {(
          [
            { id: 'all', label: 'All OPM' },
            { id: 'classic', label: 'Classic & Rock' },
            { id: 'indie', label: 'Indie & Folk' },
            { id: 'ballad', label: 'R&B & Ballad' },
            ...(hasCustomTracks ? [{ id: 'custom' as const, label: 'Added Songs' }] : []),
          ] as const
        ).map((tab) => {
          const active = genreFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGenreFilter(tab.id)}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition ${
                active
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/80 dark:hover:bg-emerald-800/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* OPM Playlist Rows */}
      <div className="divide-y divide-emerald-100 dark:divide-emerald-800/70">
        {visibleTracks.length === 0 ? (
          <div className="p-8 text-center text-xs text-emerald-700 dark:text-emerald-300">
            No OPM songs in this category yet.
          </div>
        ) : (
          visibleTracks.map((track, idx) => {
            const isSelected = currentTrackId === track.id;
            const isTrackPlaying = isSelected && isPlaying;
            const hasSavedLink = Boolean(savedSongLinks[track.id]);
            return (
              <div
                key={track.id}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 transition ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-800/50'
                    : 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const savedRaw = savedSongLinks[track.id];
                    const parsed = savedRaw ? parseSafeSongSource(savedRaw) : null;
                    if (parsed?.kind === 'youtube') {
                      onPauseAudio();
                      onSelectTrack(track.id);
                      return;
                    }
                    if (isSelected) {
                      onTogglePlay();
                    } else {
                      onSelectTrack(track.id);
                    }
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${track.coverGradient} flex items-center justify-center text-white shrink-0 shadow-sm`}
                  >
                    {isTrackPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : isSelected ? (
                      <Play className="w-4 h-4 fill-current" />
                    ) : (
                      <Music className="w-4 h-4 opacity-90" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono tabular-nums text-emerald-700/70 dark:text-emerald-300/70 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-sm font-extrabold truncate ${
                          isSelected
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-emerald-950 dark:text-white'
                        }`}
                      >
                        {track.title}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 truncate mt-0.5">
                      {track.artist} · {track.genre} · {track.year}
                      {hasSavedLink ? ' · Custom Link' : ''}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono tabular-nums text-emerald-800/80 dark:text-emerald-200/80">
                    {track.durationSec > 0 ? formatTrackTime(track.durationSec) : 'Full'}
                  </span>
                  {track.isCustom && (
                    <button
                      type="button"
                      onClick={() => onRemoveCustomTrack(track.id)}
                      aria-label={`Remove ${track.title}`}
                      title="Remove uploaded song"
                      className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
