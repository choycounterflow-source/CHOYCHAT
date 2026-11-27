import React, { useRef, useState } from 'react';
import {
  Camera,
  FolderPlus,
  Folder,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  Trash2,
  Upload,
  Video,
  FileText,
  ExternalLink,
} from 'lucide-react';
import type { UserDashboardData, UserMediaFolder, UserMediaFolderItem } from './UserDashboardPanels';
import defaultCoverPhotoUrl from '../assets/images/choy_default_cover_1795806668841.jpg';

interface ProfileCoverMediaBarProps {
  currentUserName: string;
  avatarUrl: string;
  isCustomAvatar: boolean;
  dashboard: UserDashboardData;
  authToken?: string | null;
  onTriggerProfilePic: () => void;
  onDashboardAction: (payload: Record<string, unknown>) => Promise<boolean>;
  onZoomImage?: (img: { src: string; caption: string }) => void;
}

const DEFAULT_COVER_URL = defaultCoverPhotoUrl;

async function uploadMediaFile(
  file: File,
  folder: string,
  authToken?: string | null
): Promise<string> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Media-Folder': folder,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.uploaded && typeof data?.url === 'string') {
      return data.url;
    }
  } catch {
    // fallback to data URL below
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export const ProfileCoverMediaBar: React.FC<ProfileCoverMediaBarProps> = ({
  currentUserName,
  avatarUrl,
  isCustomAvatar,
  dashboard,
  authToken,
  onTriggerProfilePic,
  onDashboardAction,
  onZoomImage,
}) => {
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<'photo' | 'video' | 'music' | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'photo' | 'video' | 'music' | 'folders'>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [customFileName, setCustomFileName] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const folders: UserMediaFolder[] = Array.isArray(dashboard.mediaFolders) ? dashboard.mediaFolders : [];
  const activeFolderId = selectedFolderId || folders[0]?.id || '';
  const coverUrl = dashboard.coverPhotoUrl || DEFAULT_COVER_URL;

  const handleCoverUpload = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingCover(true);
    setStatusNotice(null);
    try {
      const url = await uploadMediaFile(file, 'covers', authToken);
      const ok = await onDashboardAction({
        action: 'update_cover_photo',
        coverPhotoUrl: url,
      });
      if (ok) {
        setStatusNotice('Cover photo updated and saved!');
      }
    } catch {
      setStatusNotice('Could not upload cover photo.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFolderName.trim();
    if (!clean) return;
    const nextFolder: UserMediaFolder = {
      id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: clean,
      items: [],
      createdAt: new Date().toISOString(),
    };
    const nextFolders = [nextFolder, ...folders];
    const ok = await onDashboardAction({
      action: 'save_media_folders',
      mediaFolders: nextFolders,
    });
    if (ok) {
      setSelectedFolderId(nextFolder.id);
      setNewFolderName('');
      setStatusNotice(`Created folder "${clean}".`);
    }
  };

  const handleUploadMediaToFolder = async (
    kind: 'photo' | 'video' | 'music',
    file: File | undefined
  ) => {
    if (!file) return;
    setUploadingKind(kind);
    setStatusNotice(null);
    try {
      const url = await uploadMediaFile(file, `user-${kind}`, authToken);
      const itemName = customFileName.trim() || file.name || `${kind}-${Date.now()}`;
      const newItem: UserMediaFolderItem = {
        id: `itm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: itemName,
        kind,
        url,
        createdAt: new Date().toISOString(),
      };

      let nextFolders: UserMediaFolder[];
      if (folders.length === 0) {
        const defaultFolder: UserMediaFolder = {
          id: `fld-default-${Date.now()}`,
          name: 'My Uploads',
          items: [newItem],
          createdAt: new Date().toISOString(),
        };
        nextFolders = [defaultFolder];
        setSelectedFolderId(defaultFolder.id);
      } else {
        const targetId = activeFolderId || folders[0].id;
        nextFolders = folders.map((f) =>
          f.id === targetId ? { ...f, items: [newItem, ...f.items] } : f
        );
      }

      const ok = await onDashboardAction({
        action: 'save_media_folders',
        mediaFolders: nextFolders,
      });
      if (ok) {
        setCustomFileName('');
        setStatusNotice(`Uploaded "${itemName}" (${kind}) successfully!`);
      }
    } catch {
      setStatusNotice(`Could not upload ${kind}.`);
    } finally {
      setUploadingKind(null);
    }
  };

  const handleDeleteItem = async (folderId: string, itemId: string) => {
    const nextFolders = folders.map((f) =>
      f.id === folderId ? { ...f, items: f.items.filter((i) => i.id !== itemId) } : f
    );
    await onDashboardAction({
      action: 'save_media_folders',
      mediaFolders: nextFolders,
    });
  };

  const handleDeleteFolder = async (folderId: string) => {
    const nextFolders = folders.filter((f) => f.id !== folderId);
    await onDashboardAction({
      action: 'save_media_folders',
      mediaFolders: nextFolders,
    });
    if (selectedFolderId === folderId) {
      setSelectedFolderId(nextFolders[0]?.id || '');
    }
  };

  const allItems = folders.flatMap((f) =>
    f.items.map((item) => ({ ...item, folderId: f.id, folderName: f.name }))
  );
  const visibleItems =
    activeCategory === 'all' || activeCategory === 'folders'
      ? allItems
      : allItems.filter((i) => i.kind === activeCategory);

  return (
    <div className="space-y-4">
      {/* Hidden File Inputs */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleCoverUpload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadMediaToFolder('photo', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadMediaToFolder('video', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={musicInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          void handleUploadMediaToFolder('music', e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Facebook-style Cover Photo Banner + Overlapping Avatar */}
      <div className="bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="relative h-44 sm:h-56 w-full bg-emerald-950 overflow-hidden group">
          <img
            src={coverUrl}
            alt={`${currentUserName} Cover Photo`}
            onClick={() => onZoomImage?.({ src: coverUrl, caption: `${currentUserName} · Cover Photo` })}
            className="w-full h-full object-cover cursor-zoom-in transition duration-300 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
          <button
            type="button"
            disabled={uploadingCover}
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 px-3.5 py-2 rounded-xl bg-black/75 hover:bg-black/90 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-lg backdrop-blur-xs transition disabled:opacity-60"
          >
            {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            <span>{uploadingCover ? 'Uploading Cover...' : 'Edit Cover Photo'}</span>
          </button>

          {/* Overlapping Profile Avatar */}
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <button
              type="button"
              onClick={onTriggerProfilePic}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-4 border-white dark:border-emerald-950 bg-emerald-100 dark:bg-emerald-950 overflow-hidden shadow-xl group/av"
              title="Change Profile Picture"
            >
              <img
                src={avatarUrl}
                alt={currentUserName}
                className={`w-full h-full ${isCustomAvatar ? 'object-cover' : 'object-contain p-1'}`}
              />
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover/av:opacity-100 flex items-center justify-center text-white transition">
                <Camera className="w-4 h-4" />
              </span>
            </button>
            <div className="pb-1 text-white drop-shadow">
              <div className="text-base sm:text-lg font-black leading-tight">{currentUserName}</div>
              <div className="text-[11px] font-medium text-emerald-100">Personal Media &amp; Profile Hub</div>
            </div>
          </div>
        </div>

        {/* User Dashboard Category Buttons */}
        <div className="p-4 space-y-3">
          {statusNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-900 dark:text-emerald-100 text-xs font-bold">
              {statusNotice}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTriggerProfilePic}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Profile Pic</span>
            </button>
            <button
              type="button"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Cover Photo</span>
            </button>
            <button
              type="button"
              disabled={uploadingKind !== null}
              onClick={() => photoInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {uploadingKind === 'photo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Upload Photo</span>
            </button>
            <button
              type="button"
              disabled={uploadingKind !== null}
              onClick={() => videoInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {uploadingKind === 'video' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
              <span>Upload Video</span>
            </button>
            <button
              type="button"
              disabled={uploadingKind !== null}
              onClick={() => musicInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {uploadingKind === 'music' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
              <span>Upload Music</span>
            </button>
          </div>

          {/* Create Folder / File Name Setup */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-black text-emerald-950 dark:text-white flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Create File / Folder Name &amp; Organize Uploads</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(['all', 'photo', 'video', 'music'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                      activeCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateFolder} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name (e.g. Family Photos, Fav Music)..."
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Folder</span>
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="Optional custom file name before clicking Upload..."
                className="px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
              {folders.length > 0 && (
                <select
                  value={activeFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-950 dark:text-white"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      Save uploads to folder: {f.name} ({f.items.length})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Folders Chips */}
            {folders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold ${
                      activeFolderId === f.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-emerald-900 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(f.id)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>{f.name} ({f.items.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteFolder(f.id)}
                      className="opacity-70 hover:opacity-100"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Uploaded Media Grid */}
            {visibleItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-emerald-950 dark:text-white truncate flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          {item.folderName} · {item.kind.toUpperCase()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteItem(item.folderId, item.id)}
                        className="p-1 rounded-lg text-rose-600 hover:bg-rose-500/10"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {item.kind === 'photo' && (
                      <img
                        src={item.url}
                        alt={item.name}
                        onClick={() => onZoomImage?.({ src: item.url, caption: item.name })}
                        className="w-full h-32 object-cover rounded-lg cursor-zoom-in"
                      />
                    )}
                    {item.kind === 'video' && (
                      <video src={item.url} controls className="w-full h-32 rounded-lg bg-black" />
                    )}
                    {item.kind === 'music' && (
                      <audio src={item.url} controls className="w-full h-9" />
                    )}
                    {item.kind === 'file' && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-300 inline-flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open File
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
