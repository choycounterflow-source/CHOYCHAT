import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Film,
  HardDrive,
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ChatVideoPlayer } from './ChatVideoPlayer';
import { GoogleDriveVideoBar } from './GoogleDriveVideoBar';
import {
  buildGoogleDriveDownloadUrl,
  CHOY_DRIVE_FOLDER_NAME,
  deleteGoogleDriveVideoFile,
  extractGoogleDriveFileId,
  getGoogleDriveState,
  MAX_GOOGLE_DRIVE_VIDEO_BYTES,
  subscribeGoogleDriveState,
  uploadVideoToGoogleDrive,
  type GoogleDriveConnectionState,
} from '../services/googleDriveVideoService';

export interface MusicTrackItem {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  fileName: string;
  durationSec: number;
  sizeBytes: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export interface LongVideoItem {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  fileName: string;
  durationSec: number;
  sizeBytes: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export function formatMediaDuration(sec?: number): string {
  const safe = Number.isFinite(Number(sec)) ? Math.max(0, Math.floor(Number(sec))) : 0;
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const rem = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export function formatFileSize(bytes?: number): string {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export function buildDownloadUrl(mediaUrl: string, fileName: string): string {
  if (!mediaUrl) return '#';
  const driveId = extractGoogleDriveFileId(mediaUrl);
  if (driveId) {
    return buildGoogleDriveDownloadUrl(driveId);
  }
  if (mediaUrl.startsWith('/api/media/local/')) {
    const sep = mediaUrl.includes('?') ? '&' : '?';
    return `${mediaUrl}${sep}download=1&name=${encodeURIComponent(fileName || 'download')}`;
  }
  return mediaUrl;
}

export function probeMediaDuration(file: File, kind: 'audio' | 'video'): Promise<number> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const el = document.createElement(kind);
    el.preload = 'metadata';
    const done = (dur: number) => {
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0);
    };
    const timer = window.setTimeout(() => done(0), 6000);
    el.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(el.duration);
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      done(0);
    };
    el.src = objectUrl;
  });
}

export async function uploadFileChunked(params: {
  file: File;
  folder: 'music' | 'videos' | 'posts' | 'messages';
  authToken?: string;
  onProgress?: (percent: number, uploadedBytes: number, totalBytes: number) => void;
}): Promise<{ url: string; mediaType: 'image' | 'video' | 'audio'; sizeBytes: number }> {
  const { file, folder, authToken, onProgress } = params;
  const baseHeaders: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (authToken) {
    baseHeaders.Authorization = `Bearer ${authToken}`;
  }

  const initRes = await fetch('/api/media/chunked/init', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folder,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalSize: file.size,
    }),
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok || !initData.uploadId) {
    throw new Error(initData.error || `Failed to start upload (${initRes.status})`);
  }

  const uploadId: string = String(initData.uploadId);
  const chunkSize: number = Math.max(512 * 1024, Math.min(6 * 1024 * 1024, Number(initData.chunkSize) || 4 * 1024 * 1024));
  let offset = 0;
  let chunkIndex = 0;

  while (offset < file.size) {
    const end = Math.min(file.size, offset + chunkSize);
    const slice = file.slice(offset, end);
    const chunkRes = await fetch(`/api/media/chunked/${encodeURIComponent(uploadId)}/chunk?index=${chunkIndex}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/octet-stream',
      },
      body: slice,
    });
    const chunkData = await chunkRes.json().catch(() => ({}));
    if (!chunkRes.ok) {
      throw new Error(chunkData.error || `Chunk upload failed at ${Math.round((offset / file.size) * 100)}%`);
    }
    offset = end;
    chunkIndex += 1;
    onProgress?.(Math.min(99, Math.round((offset / Math.max(1, file.size)) * 100)), offset, file.size);
  }

  const completeRes = await fetch(`/api/media/chunked/${encodeURIComponent(uploadId)}/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const completeData = await completeRes.json().catch(() => ({}));
  if (!completeRes.ok || !completeData.url) {
    throw new Error(completeData.error || 'Failed to finalize upload.');
  }

  onProgress?.(100, file.size, file.size);
  return {
    url: String(completeData.url),
    mediaType: (completeData.mediaType as 'image' | 'video' | 'audio') || (folder === 'music' ? 'audio' : 'video'),
    sizeBytes: Number(completeData.sizeBytes) || file.size,
  };
}

// ============================================================
// MP3 MUSIC LIBRARY & DOWNLOADER PANEL
// ============================================================
export interface Mp3MusicLibraryPanelProps {
  tracks: MusicTrackItem[];
  currentUser: { id: string; name: string; role: 'admin' | 'member' | 'user' };
  authToken?: string;
  onTracksChanged: (next: MusicTrackItem[]) => void;
}

export const Mp3MusicLibraryPanel: React.FC<Mp3MusicLibraryPanelProps> = ({
  tracks,
  currentUser,
  authToken,
  onTracksChanged,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(tracks[0]?.id || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);

  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0] || null;

  useEffect(() => {
    if (!activeTrackId && tracks.length > 0) {
      setActiveTrackId(tracks[0].id);
    }
  }, [activeTrackId, tracks]);

  const playTrack = (track: MusicTrackItem) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (audioEl.src !== new URL(track.audioUrl, window.location.origin).href) {
      audioEl.src = track.audioUrl;
    }
    audioEl.volume = isMuted ? 0 : volume;
    setActiveTrackId(track.id);
    setCurrentTime(0);
    setDuration(track.durationSec || 0);
    void audioEl
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const togglePlayPause = () => {
    const audioEl = audioRef.current;
    if (!audioEl || !activeTrack) return;
    if (isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
      return;
    }
    if (!audioEl.src || audioEl.src !== new URL(activeTrack.audioUrl, window.location.origin).href) {
      audioEl.src = activeTrack.audioUrl;
    }
    audioEl.volume = isMuted ? 0 : volume;
    void audioEl
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const playNext = () => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === activeTrack?.id);
    const next = tracks[(idx + 1) % tracks.length];
    if (next) playTrack(next);
  };

  const playPrev = () => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === activeTrack?.id);
    const prev = tracks[idx > 0 ? idx - 1 : tracks.length - 1];
    if (prev) playTrack(prev);
  };

  const handleSelectAudioFile = (file: File | null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name);
    if (!isAudio) {
      setErrorMsg('Please select an MP3 or audio file (.mp3, .m4a, .wav, .ogg, .aac).');
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      setErrorMsg('MP3/Audio file must be 60 MB or smaller.');
      return;
    }
    setSelectedFile(file);
    if (!songTitle.trim()) {
      setSongTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim());
    }
  };

  const handleUploadTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!selectedFile) {
      setErrorMsg('Please choose an MP3 file first.');
      return;
    }
    const cleanTitle = songTitle.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
    const cleanArtist = songArtist.trim() || currentUser.name;

    setUploading(true);
    setUploadPercent(2);
    try {
      const durationSec = await probeMediaDuration(selectedFile, 'audio');
      const uploaded = await uploadFileChunked({
        file: selectedFile,
        folder: 'music',
        authToken,
        onProgress: (pct) => setUploadPercent(pct),
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch('/api/choy/media-library/music', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          title: cleanTitle,
          artist: cleanArtist,
          audioUrl: uploaded.url,
          fileName: selectedFile.name,
          durationSec,
          sizeBytes: uploaded.sizeBytes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save MP3 track.');
      }
      if (Array.isArray(data.tracks)) {
        onTracksChanged(data.tracks as MusicTrackItem[]);
      }
      setSongTitle('');
      setSongArtist('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccessMsg(`"${cleanTitle}" added to MP3 Music Library! Everyone can play & download it now.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload MP3.');
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    setDeletingId(trackId);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`/api/choy/media-library/music/${encodeURIComponent(trackId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to delete track.');
        return;
      }
      if (activeTrackId === trackId && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      if (Array.isArray(data.tracks)) {
        onTracksChanged(data.tracks as MusicTrackItem[]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error deleting track.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        className="hidden"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setDuration(e.currentTarget.duration);
          }
        }}
        onEnded={playNext}
      />

      {/* Upload MP3 Card */}
      <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-white">
                MP3 Music Library &amp; Downloader
              </h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Upload your MP3 songs into the app so you &amp; members can stream and download MP3s anytime.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[10px] font-black">
            {tracks.length} {tracks.length === 1 ? 'MP3 Track' : 'MP3 Tracks'}
          </span>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-600 text-xs font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleUploadTrack} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              maxLength={120}
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="Song Title (e.g. Favorite Song)"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              maxLength={80}
              value={songArtist}
              onChange={(e) => setSongArtist(e.target.value)}
              placeholder="Artist / Singer (Optional)"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac"
            className="hidden"
            onChange={(e) => handleSelectAudioFile(e.target.files?.[0] || null)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{selectedFile ? 'Change MP3 File' : 'Choose MP3 File'}</span>
              </button>
              {selectedFile && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 truncate max-w-[220px]">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="px-4 py-2 rounded-xl bg-[#FF5A1F] hover:bg-orange-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
              <span>{uploading ? `Uploading ${uploadPercent}%...` : 'Add MP3 to App'}</span>
            </button>
          </div>

          {uploading && (
            <div className="w-full h-2 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
              <div
                className="h-full bg-[#FF5A1F] transition-all duration-200"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          )}
        </form>
      </div>

      {/* Active MP3 Player Bar */}
      {activeTrack && (
        <div className="bg-emerald-950 text-white border border-emerald-700/80 rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                {isPlaying ? 'Now Playing MP3' : 'Selected MP3'}
              </div>
              <div className="text-sm font-black truncate">{activeTrack.title}</div>
              <div className="text-[11px] text-emerald-300 truncate">
                {activeTrack.artist} · {formatFileSize(activeTrack.sizeBytes)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={playPrev}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                aria-label="Previous track"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-10 h-10 rounded-xl bg-[#FF5A1F] hover:bg-orange-500 text-white flex items-center justify-center shadow transition"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              <button
                type="button"
                onClick={playNext}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                aria-label="Next track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <a
                href={buildDownloadUrl(activeTrack.audioUrl, activeTrack.fileName || `${activeTrack.title}.mp3`)}
                download={activeTrack.fileName || `${activeTrack.title}.mp3`}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download MP3</span>
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-[11px] font-mono">
            <span>{formatMediaDuration(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, duration || activeTrack.durationSec || 1)}
              value={Math.min(currentTime, Math.max(1, duration || activeTrack.durationSec || 1))}
              onChange={(e) => {
                const t = Number(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = t;
                setCurrentTime(t);
              }}
              className="flex-1 accent-[#FF5A1F]"
            />
            <span>{formatMediaDuration(duration || activeTrack.durationSec)}</span>
            <button
              type="button"
              onClick={() => {
                const next = !isMuted;
                setIsMuted(next);
                if (audioRef.current) audioRef.current.volume = next ? 0 : volume;
              }}
              className="p-1 rounded-lg hover:bg-white/10"
              aria-label="Toggle mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setIsMuted(v === 0);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              className="w-16 accent-emerald-400 hidden sm:block"
            />
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-2.5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
          Saved MP3 Songs ({tracks.length})
        </div>

        {tracks.length === 0 ? (
          <div className="p-6 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center text-xs text-emerald-700 dark:text-emerald-300">
            No MP3 songs uploaded yet. Tap <strong>Choose MP3 File</strong> above to add music into the app!
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((track) => {
              const isCurrent = activeTrack?.id === track.id;
              const canDelete = currentUser.role === 'admin' || track.uploadedById === currentUser.id;
              return (
                <div
                  key={track.id}
                  className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition ${
                    isCurrent
                      ? 'bg-emerald-100/80 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-500'
                      : 'bg-emerald-50/70 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => (isCurrent && isPlaying ? togglePlayPause() : playTrack(track))}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCurrent && isPlaying
                          ? 'bg-[#FF5A1F] text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-emerald-950 dark:text-white truncate">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                        {track.artist} · {formatMediaDuration(track.durationSec)} · {formatFileSize(track.sizeBytes)} · by {track.uploadedByName}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={buildDownloadUrl(track.audioUrl, track.fileName || `${track.title}.mp3`)}
                      download={track.fileName || `${track.title}.mp3`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                    {canDelete && (
                      <button
                        type="button"
                        disabled={deletingId === track.id}
                        onClick={() => void handleDeleteTrack(track.id)}
                        className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900 transition disabled:opacity-50"
                        title="Delete MP3"
                      >
                        {deletingId === track.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// LONG VIDEO HUB (25–30+ MINS PER VIDEO, CHUNKED UP TO 500 MB)
// ============================================================
export interface LongVideoHubPanelProps {
  videos: LongVideoItem[];
  currentUser: { id: string; name: string; role: 'admin' | 'member' | 'user' };
  authToken?: string;
  onVideosChanged: (next: LongVideoItem[]) => void;
}

export const LongVideoHubPanel: React.FC<LongVideoHubPanelProps> = ({
  videos,
  currentUser,
  authToken,
  onVideosChanged,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [driveState, setDriveState] = useState<GoogleDriveConnectionState>(() =>
    getGoogleDriveState()
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedDurationSec, setDetectedDurationSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadBytesInfo, setUploadBytesInfo] = useState('');
  const [uploadDestinationLabel, setUploadDestinationLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteVideo, setPendingDeleteVideo] = useState<LongVideoItem | null>(null);
  const [alsoDeleteFromDrive, setAlsoDeleteFromDrive] = useState(true);

  useEffect(() => {
    return subscribeGoogleDriveState(setDriveState);
  }, []);

  const useGoogleDrive = driveState.connected && driveState.enabledForVideos;
  const maxAllowedBytes = useGoogleDrive ? MAX_GOOGLE_DRIVE_VIDEO_BYTES : 500 * 1024 * 1024;
  const maxAllowedLabel = useGoogleDrive ? '5 GB' : '500 MB';

  const handleSelectVideoFile = async (file: File | null) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDetectedDurationSec(0);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name);
    if (!isVideo) {
      setErrorMsg('Please select a valid video file (.mp4, .webm, .mov, .m4v, .mkv).');
      return;
    }
    if (file.size > maxAllowedBytes) {
      setErrorMsg(
        useGoogleDrive
          ? 'Maximum single browser upload to Google Drive is 5 GB per video.'
          : 'Maximum server video size is 500 MB. Connect your 5TB Google Drive above to upload videos up to 5 GB!'
      );
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim());
    }
    const dur = await probeMediaDuration(file, 'video');
    setDetectedDurationSec(dur);
  };

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!selectedFile) {
      setErrorMsg('Please select a video file first.');
      return;
    }
    if (selectedFile.size > maxAllowedBytes) {
      setErrorMsg(`Selected video exceeds the current ${maxAllowedLabel} upload limit.`);
      return;
    }
    const cleanTitle = title.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
    setUploading(true);
    setUploadPercent(1);
    setUploadBytesInfo(`0 MB / ${formatFileSize(selectedFile.size)}`);
    setUploadDestinationLabel(
      useGoogleDrive
        ? `Uploading directly to Google Drive (${driveState.email || '5TB Drive'} · ${CHOY_DRIVE_FOLDER_NAME})...`
        : 'Uploading video in chunks...'
    );
    try {
      const durationSec = detectedDurationSec || (await probeMediaDuration(selectedFile, 'video'));

      let uploadedUrl = '';
      let uploadedSizeBytes = selectedFile.size;

      if (useGoogleDrive) {
        const driveResult = await uploadVideoToGoogleDrive({
          file: selectedFile,
          title: cleanTitle,
          onProgress: (pct, sent, total) => {
            setUploadPercent(pct);
            setUploadBytesInfo(`${formatFileSize(sent)} / ${formatFileSize(total)}`);
          },
        });
        uploadedUrl = driveResult.previewUrl;
        uploadedSizeBytes = driveResult.sizeBytes;
      } else {
        const uploaded = await uploadFileChunked({
          file: selectedFile,
          folder: 'videos',
          authToken,
          onProgress: (pct, sent, total) => {
            setUploadPercent(pct);
            setUploadBytesInfo(`${formatFileSize(sent)} / ${formatFileSize(total)}`);
          },
        });
        uploadedUrl = uploaded.url;
        uploadedSizeBytes = uploaded.sizeBytes;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const res = await fetch('/api/choy/media-library/videos', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          title: cleanTitle,
          description: description.trim(),
          videoUrl: uploadedUrl,
          fileName: selectedFile.name,
          durationSec,
          sizeBytes: uploadedSizeBytes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save video.');
      }
      if (Array.isArray(data.videos)) {
        onVideosChanged(data.videos as LongVideoItem[]);
      }
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setDetectedDurationSec(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccessMsg(
        useGoogleDrive
          ? `Video "${cleanTitle}" uploaded to Google Drive (${driveState.email}) and ready to stream!`
          : `Video "${cleanTitle}" uploaded successfully and ready to stream!`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload video.');
    } finally {
      setUploading(false);
      setUploadPercent(0);
      setUploadBytesInfo('');
      setUploadDestinationLabel('');
    }
  };

  const requestDeleteVideo = (video: LongVideoItem) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setAlsoDeleteFromDrive(Boolean(extractGoogleDriveFileId(video.videoUrl) && driveState.connected));
    setPendingDeleteVideo(video);
  };

  const confirmDeleteVideo = async () => {
    if (!pendingDeleteVideo) return;
    const targetVideo = pendingDeleteVideo;
    const driveFileId = extractGoogleDriveFileId(targetVideo.videoUrl);
    const shouldDeleteDriveFile = Boolean(driveFileId && driveState.connected && alsoDeleteFromDrive);

    setPendingDeleteVideo(null);
    setDeletingId(targetVideo.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      let driveDeleteWarning = '';
      if (shouldDeleteDriveFile && driveFileId) {
        try {
          await deleteGoogleDriveVideoFile(driveFileId);
        } catch (driveErr) {
          driveDeleteWarning =
            driveErr instanceof Error
              ? ` (Note: ${driveErr.message})`
              : ' (Note: could not remove file from Google Drive.)';
        }
      }

      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`/api/choy/media-library/videos/${encodeURIComponent(targetVideo.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to delete video.');
        return;
      }
      if (Array.isArray(data.videos)) {
        onVideosChanged(data.videos as LongVideoItem[]);
      }
      setSuccessMsg(
        shouldDeleteDriveFile && !driveDeleteWarning
          ? `Deleted "${targetVideo.title}" from Choy Chat and Google Drive.`
          : `Removed "${targetVideo.title}" from Choy Chat.${driveDeleteWarning}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error deleting video.');
    } finally {
      setDeletingId(null);
    }
  };

  const pendingDriveFileId = pendingDeleteVideo
    ? extractGoogleDriveFileId(pendingDeleteVideo.videoUrl)
    : null;

  return (
    <div className="space-y-4">
      {/* 5TB Google Drive Video Backend Connection Bar */}
      <GoogleDriveVideoBar
        onStatusMessage={(msg) => {
          setErrorMsg(null);
          setSuccessMsg(msg);
        }}
      />

      {/* Upload Long Video Card */}
      <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/70 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-300 flex items-center justify-center shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-white">
                {useGoogleDrive
                  ? 'Google Drive Video Uploads (5TB Backend Active)'
                  : 'Long Video Uploads (25–30+ Mins Supported)'}
              </h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                {useGoogleDrive
                  ? `Upload full HD & long videos up to 5 GB directly to "${CHOY_DRIVE_FOLDER_NAME}" with link-viewer streaming for Choy Chat members.`
                  : 'Upload full 25 to 30+ minute videos (up to 500 MB on server, or up to 5 GB when Google Drive is connected above).'}
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
              useGoogleDrive
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                : 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200'
            }`}
          >
            {useGoogleDrive ? 'Google Drive · Up to 5 GB' : 'Server · Up to 500 MB'}
          </span>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-600 text-xs font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleUploadVideo} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video Title (e.g. Full Episode / Vlog 30 mins)"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (Optional)"
              className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov,.m4v,.mkv"
            className="hidden"
            onChange={(e) => void handleSelectVideoFile(e.target.files?.[0] || null)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {selectedFile
                    ? 'Change Video File'
                    : useGoogleDrive
                    ? 'Choose Video (Up to 5 GB · Drive)'
                    : 'Choose Video (Up to 30+ Mins)'}
                </span>
              </button>
              {selectedFile && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {selectedFile.name} · {formatFileSize(selectedFile.size)}
                  {detectedDurationSec > 0 ? ` · ${formatMediaDuration(detectedDurationSec)}` : ''}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className={`px-4 py-2 rounded-xl text-white text-xs font-black inline-flex items-center gap-1.5 shadow transition disabled:opacity-50 ${
                useGoogleDrive
                  ? 'bg-blue-600 hover:bg-blue-500'
                  : 'bg-[#FF5A1F] hover:bg-orange-500'
              }`}
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : useGoogleDrive ? (
                <HardDrive className="w-3.5 h-3.5" />
              ) : (
                <Video className="w-3.5 h-3.5" />
              )}
              <span>
                {uploading
                  ? `Uploading ${uploadPercent}%...`
                  : useGoogleDrive
                  ? 'Upload to Google Drive'
                  : 'Upload Video'}
              </span>
            </button>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                <span>{uploadDestinationLabel || 'Uploading video...'}</span>
                <span>
                  {uploadPercent}% ({uploadBytesInfo})
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    useGoogleDrive ? 'bg-blue-500' : 'bg-[#FF5A1F]'
                  }`}
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Uploaded Long Videos List */}
      <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
          Uploaded Videos ({videos.length})
        </div>

        {videos.length === 0 ? (
          <div className="p-6 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center text-xs text-emerald-700 dark:text-emerald-300">
            No long videos uploaded yet. Connect your 5TB Google Drive or select a video above to upload and watch right inside the app!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((vid) => {
              const canDelete = currentUser.role === 'admin' || vid.uploadedById === currentUser.id;
              const isDriveVideo = Boolean(extractGoogleDriveFileId(vid.videoUrl));
              return (
                <div
                  key={vid.id}
                  className="rounded-2xl overflow-hidden bg-emerald-50/80 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex flex-col justify-between"
                >
                  <div className="bg-black">
                    {isDriveVideo ? (
                      <ChatVideoPlayer src={vid.videoUrl} title={vid.title} />
                    ) : (
                      <video
                        src={vid.videoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-64 object-contain bg-black"
                      />
                    )}
                  </div>
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="text-xs font-black text-emerald-950 dark:text-white break-words">
                            {vid.title}
                          </div>
                          {isDriveVideo && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 text-[9px] font-black inline-flex items-center gap-1">
                              <HardDrive className="w-2.5 h-2.5" />
                              Google Drive
                            </span>
                          )}
                        </div>
                        {vid.description && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 break-words">
                            {vid.description}
                          </p>
                        )}
                      </div>
                      {vid.durationSec > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-900 text-emerald-200 text-[10px] font-mono font-bold shrink-0 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatMediaDuration(vid.durationSec)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/80 dark:border-emerald-800">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                        By {vid.uploadedByName} · {formatFileSize(vid.sizeBytes)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={buildDownloadUrl(vid.videoUrl, vid.fileName || `${vid.title}.mp4`)}
                          download={vid.fileName || `${vid.title}.mp4`}
                          target={isDriveVideo ? '_blank' : undefined}
                          rel={isDriveVideo ? 'noopener noreferrer' : undefined}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 transition"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                        {canDelete && (
                          <button
                            type="button"
                            disabled={deletingId === vid.id}
                            onClick={() => requestDeleteVideo(vid)}
                            className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900 transition disabled:opacity-50"
                            title="Delete video"
                          >
                            {deletingId === vid.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Explicit Delete Confirmation Modal (Required before deleting Google Drive files) */}
      {pendingDeleteVideo && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-video-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-black text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span id="delete-video-modal-title">Confirm Video Deletion</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteVideo(null)}
                className="p-1 rounded-lg text-rose-700 dark:text-rose-300 hover:bg-rose-200/70 dark:hover:bg-rose-900 transition"
                aria-label="Close confirmation dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-700 dark:text-slate-200">
              <p>
                Are you sure you want to delete{' '}
                <strong className="text-slate-950 dark:text-white">
                  &ldquo;{pendingDeleteVideo.title}&rdquo;
                </strong>{' '}
                ({formatFileSize(pendingDeleteVideo.sizeBytes)}) from Choy Chat?
              </p>

              {pendingDriveFileId && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200 text-[11px]">
                    <HardDrive className="w-3.5 h-3.5 shrink-0" />
                    <span>Stored in Google Drive ({CHOY_DRIVE_FOLDER_NAME})</span>
                  </div>
                  {driveState.connected ? (
                    <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={alsoDeleteFromDrive}
                        onChange={(e) => setAlsoDeleteFromDrive(e.target.checked)}
                        className="mt-0.5 accent-rose-600 rounded"
                      />
                      <span>
                        Also permanently delete this video file from Google Drive (
                        <strong>{driveState.email}</strong>) to free up storage space.
                      </span>
                    </label>
                  ) : (
                    <p className="text-[11px] text-blue-800/80 dark:text-blue-200/80">
                      Google Drive is currently disconnected, so only the Choy Chat listing will be removed. The video file in your Google Drive will stay untouched.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPendingDeleteVideo(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteVideo()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs inline-flex items-center gap-1.5 shadow transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
