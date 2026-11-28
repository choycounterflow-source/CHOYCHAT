import {
  auth,
  googleDriveProvider,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from '../firebase';

export const CHOY_DRIVE_FOLDER_NAME = 'Choy Chat Videos';
export const GOOGLE_DRIVE_DEFAULT_EMAIL = 'choycounterflow@gmail.com';
export const MAX_GOOGLE_DRIVE_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB per browser upload
const DRIVE_CHUNK_BYTES = 8 * 1024 * 1024; // 8 MB (must be a multiple of 256 KB)
const SAFE_DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,80}$/;

export interface GoogleDriveQuotaInfo {
  limitBytes: number;
  usageBytes: number;
  usageInDriveBytes: number;
}

export interface GoogleDriveConnectionState {
  connected: boolean;
  enabledForVideos: boolean;
  email: string | null;
  displayName: string | null;
  folderId: string | null;
  quota: GoogleDriveQuotaInfo | null;
  lastError: string | null;
}

export interface GoogleDriveUploadedVideo {
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string;
  downloadUrl: string;
  webViewLink: string;
}

export interface GoogleDriveVideoEntry {
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdTime: string;
  previewUrl: string;
  downloadUrl: string;
}

// Strictly in-memory OAuth access token cache — NEVER persisted to localStorage or sessionStorage
let cachedAccessToken: string | null = null;
let cachedState: GoogleDriveConnectionState = {
  connected: false,
  enabledForVideos: true,
  email: null,
  displayName: null,
  folderId: null,
  quota: null,
  lastError: null,
};

type StateListener = (state: GoogleDriveConnectionState) => void;
const listeners = new Set<StateListener>();

function emitState(): void {
  const snapshot: GoogleDriveConnectionState = {
    ...cachedState,
    quota: cachedState.quota ? { ...cachedState.quota } : null,
  };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore individual subscriber errors
    }
  });
}

// Clear in-memory Drive OAuth token whenever Firebase Auth signs out
onAuthStateChanged(auth, (user) => {
  if (!user && cachedAccessToken) {
    cachedAccessToken = null;
    cachedState = {
      connected: false,
      enabledForVideos: cachedState.enabledForVideos,
      email: null,
      displayName: null,
      folderId: null,
      quota: null,
      lastError: null,
    };
    emitState();
  }
});

export function getGoogleDriveState(): GoogleDriveConnectionState {
  return {
    ...cachedState,
    quota: cachedState.quota ? { ...cachedState.quota } : null,
  };
}

export function subscribeGoogleDriveState(listener: StateListener): () => void {
  listeners.add(listener);
  listener(getGoogleDriveState());
  return () => {
    listeners.delete(listener);
  };
}

export function hasGoogleDriveToken(): boolean {
  return Boolean(cachedAccessToken && cachedState.connected);
}

export function isGoogleDriveBackendReady(): boolean {
  return Boolean(cachedAccessToken && cachedState.connected && cachedState.enabledForVideos);
}

export function setUseGoogleDriveForVideos(enabled: boolean): void {
  cachedState = {
    ...cachedState,
    enabledForVideos: Boolean(enabled),
  };
  emitState();
}

export function disconnectGoogleDrive(): void {
  cachedAccessToken = null;
  cachedState = {
    connected: false,
    enabledForVideos: cachedState.enabledForVideos,
    email: null,
    displayName: null,
    folderId: null,
    quota: null,
    lastError: null,
  };
  emitState();
}

export function extractGoogleDriveFileId(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'drive.google.com' && host !== 'docs.google.com') {
      return null;
    }
    const pathMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,80})/);
    if (pathMatch?.[1] && SAFE_DRIVE_FILE_ID_RE.test(pathMatch[1])) {
      return pathMatch[1];
    }
    const idParam = parsed.searchParams.get('id');
    if (idParam && SAFE_DRIVE_FILE_ID_RE.test(idParam)) {
      return idParam;
    }
  } catch {
    return null;
  }
  return null;
}

export function isGoogleDriveVideoUrl(rawUrl?: string | null): boolean {
  return extractGoogleDriveFileId(rawUrl) !== null;
}

export function buildGoogleDrivePreviewUrl(fileId: string): string {
  if (!SAFE_DRIVE_FILE_ID_RE.test(fileId)) {
    throw new Error('Invalid Google Drive file ID.');
  }
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function buildGoogleDriveDownloadUrl(fileId: string): string {
  if (!SAFE_DRIVE_FILE_ID_RE.test(fileId)) {
    throw new Error('Invalid Google Drive file ID.');
  }
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function formatStorageBytes(bytes?: number | null): string {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const tb = 1024 * 1024 * 1024 * 1024;
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  if (n >= tb) return `${(n / tb).toFixed(2)} TB`;
  if (n >= gb) return `${(n / gb).toFixed(2)} GB`;
  if (n >= mb) return `${(n / mb).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function handleDriveAuthError(status: number, fallbackMsg: string): never {
  if (status === 401 || status === 403) {
    cachedAccessToken = null;
    cachedState = {
      ...cachedState,
      connected: false,
      lastError: 'Google Drive session expired. Please sign in with Google again.',
    };
    emitState();
    throw new Error('Google Drive session expired. Tap "Sign in with Google" to reconnect.');
  }
  throw new Error(fallbackMsg);
}

async function fetchDriveAbout(token: string): Promise<{
  email: string | null;
  displayName: string | null;
  quota: GoogleDriveQuotaInfo | null;
}> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName),storageQuota(limit,usage,usageInDrive)',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (res.status === 401) {
    handleDriveAuthError(res.status, 'Google Drive authorization expired.');
  }
  if (!res.ok) {
    return { email: null, displayName: null, quota: null };
  }
  const data = (await res.json().catch(() => ({}))) as {
    user?: { emailAddress?: string; displayName?: string };
    storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
  };
  const limitBytes = Number(data.storageQuota?.limit || 0);
  const usageBytes = Number(data.storageQuota?.usage || 0);
  const usageInDriveBytes = Number(data.storageQuota?.usageInDrive || 0);

  return {
    email: data.user?.emailAddress || null,
    displayName: data.user?.displayName || null,
    quota:
      limitBytes > 0 || usageBytes > 0
        ? {
            limitBytes: Number.isFinite(limitBytes) ? limitBytes : 0,
            usageBytes: Number.isFinite(usageBytes) ? usageBytes : 0,
            usageInDriveBytes: Number.isFinite(usageInDriveBytes) ? usageInDriveBytes : 0,
          }
        : null,
  };
}

export async function refreshGoogleDriveQuota(): Promise<GoogleDriveConnectionState> {
  if (!cachedAccessToken) {
    return getGoogleDriveState();
  }
  const about = await fetchDriveAbout(cachedAccessToken);
  cachedState = {
    ...cachedState,
    email: about.email || cachedState.email,
    displayName: about.displayName || cachedState.displayName,
    quota: about.quota || cachedState.quota,
    lastError: null,
  };
  emitState();
  return getGoogleDriveState();
}

export async function connectGoogleDrive(): Promise<GoogleDriveConnectionState> {
  try {
    const result = await signInWithPopup(auth, googleDriveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      throw new Error(
        'Google did not return a Drive access token. Please allow Google Drive permission when signing in.'
      );
    }

    cachedAccessToken = accessToken;
    const about = await fetchDriveAbout(accessToken).catch(() => ({
      email: result.user.email,
      displayName: result.user.displayName,
      quota: null,
    }));

    let folderId: string | null = null;
    try {
      folderId = await ensureChoyVideosFolder(accessToken);
    } catch {
      folderId = null;
    }

    cachedState = {
      connected: true,
      enabledForVideos: true,
      email: about.email || result.user.email || GOOGLE_DRIVE_DEFAULT_EMAIL,
      displayName: about.displayName || result.user.displayName || null,
      folderId,
      quota: about.quota,
      lastError: null,
    };
    emitState();
    return getGoogleDriveState();
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    let message = err instanceof Error ? err.message : 'Failed to connect Google Drive.';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      message = 'Google sign-in popup was closed before completing.';
    } else if (code === 'auth/popup-blocked') {
      message = 'Browser blocked the Google sign-in popup. Please allow popups for this app and try again.';
    }
    cachedState = {
      ...cachedState,
      lastError: message,
    };
    emitState();
    throw new Error(message);
  }
}

export async function ensureChoyVideosFolder(tokenOverride?: string): Promise<string> {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    throw new Error('Google Drive is not connected. Tap "Sign in with Google" first.');
  }
  if (cachedState.folderId && SAFE_DRIVE_FILE_ID_RE.test(cachedState.folderId)) {
    return cachedState.folderId;
  }

  const query = `name = '${CHOY_DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=5`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (searchRes.status === 401 || searchRes.status === 403) {
    handleDriveAuthError(searchRes.status, 'Could not access Google Drive folder.');
  }
  if (searchRes.ok) {
    const searchData = (await searchRes.json().catch(() => ({}))) as {
      files?: Array<{ id?: string; name?: string }>;
    };
    const existingId = searchData.files?.[0]?.id;
    if (existingId && SAFE_DRIVE_FILE_ID_RE.test(existingId)) {
      cachedState = { ...cachedState, folderId: existingId };
      emitState();
      return existingId;
    }
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: CHOY_DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (createRes.status === 401 || createRes.status === 403) {
    handleDriveAuthError(createRes.status, 'Could not create Choy Chat Videos folder in Google Drive.');
  }
  const created = (await createRes.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !created.id || !SAFE_DRIVE_FILE_ID_RE.test(created.id)) {
    throw new Error(created.error?.message || 'Failed to create Google Drive videos folder.');
  }
  cachedState = { ...cachedState, folderId: created.id };
  emitState();
  return created.id;
}

export async function uploadVideoToGoogleDrive(params: {
  file: File;
  title?: string;
  onProgress?: (percent: number, uploadedBytes: number, totalBytes: number) => void;
}): Promise<GoogleDriveUploadedVideo> {
  const { file, title, onProgress } = params;
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Drive is not connected. Tap "Sign in with Google" first.');
  }
  if (file.size <= 0) {
    throw new Error('Selected video file is empty.');
  }
  if (file.size > MAX_GOOGLE_DRIVE_VIDEO_BYTES) {
    throw new Error('Maximum single browser upload to Google Drive is 5 GB per video.');
  }

  const folderId = await ensureChoyVideosFolder(token);
  const safeExtMatch = file.name.match(/(\.[a-zA-Z0-9]{2,5})$/);
  const ext = safeExtMatch ? safeExtMatch[1].toLowerCase() : '.mp4';
  const cleanBase = (title || file.name.replace(/\.[^/.]+$/, ''))
    .replace(/[^\w\s.-]+/g, ' ')
    .trim()
    .slice(0, 100) || `choy-video-${Date.now()}`;
  const driveFileName = cleanBase.toLowerCase().endsWith(ext) ? cleanBase : `${cleanBase}${ext}`;
  const mimeType = file.type && file.type.startsWith('video/') ? file.type : 'video/mp4';

  // Step 1: Initiate Google Drive Resumable Upload session
  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({
        name: driveFileName,
        mimeType,
        parents: [folderId],
        description: 'Uploaded via Choy Chat 5TB Google Drive Video Backend',
      }),
    }
  );

  if (initRes.status === 401 || initRes.status === 403) {
    handleDriveAuthError(initRes.status, 'Google Drive authorization failed while starting upload.');
  }
  const uploadUrl = initRes.headers.get('Location');
  if (!initRes.ok || !uploadUrl) {
    const errBody = await initRes.text().catch(() => '');
    throw new Error(errBody || `Failed to start Google Drive upload (${initRes.status}).`);
  }

  // Step 2: Stream file in 8 MB resumable chunks
  let offset = 0;
  let uploadedFile: {
    id?: string;
    name?: string;
    size?: string;
    mimeType?: string;
    webViewLink?: string;
  } | null = null;

  while (offset < file.size) {
    const end = Math.min(file.size, offset + DRIVE_CHUNK_BYTES);
    const chunk = file.slice(offset, end);
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Range': `bytes ${offset}-${end - 1}/${file.size}`,
      },
      body: chunk,
    });

    if (putRes.status === 308) {
      // Chunk accepted; Google returns the Range header of bytes received so far
      const rangeHeader = putRes.headers.get('Range');
      if (rangeHeader) {
        const rangeMatch = rangeHeader.match(/bytes=0-(\d+)/);
        if (rangeMatch?.[1]) {
          offset = Number(rangeMatch[1]) + 1;
        } else {
          offset = end;
        }
      } else {
        offset = end;
      }
      const pct = Math.min(97, Math.round((offset / file.size) * 97));
      onProgress?.(pct, offset, file.size);
      continue;
    }

    if (putRes.status === 200 || putRes.status === 201) {
      uploadedFile = (await putRes.json().catch(() => null)) as {
        id?: string;
        name?: string;
        size?: string;
        mimeType?: string;
        webViewLink?: string;
      } | null;
      offset = file.size;
      onProgress?.(98, file.size, file.size);
      break;
    }

    if (putRes.status === 401 || putRes.status === 403) {
      handleDriveAuthError(putRes.status, 'Google Drive session expired mid-upload.');
    }

    const errText = await putRes.text().catch(() => '');
    throw new Error(errText || `Google Drive chunk upload failed (${putRes.status}).`);
  }

  const fileId = uploadedFile?.id;
  if (!fileId || !SAFE_DRIVE_FILE_ID_RE.test(fileId)) {
    throw new Error('Google Drive upload finished without returning a valid file ID.');
  }

  // Step 3: Grant link-viewer read permission so all Choy Chat members can stream the video
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );
  if (!permRes.ok && permRes.status !== 409) {
    // Non-fatal: file is still uploaded in Drive, though only owner may view if org policy restricts anyone-with-link
    console.warn('Could not set anyone-reader permission on Google Drive video:', permRes.status);
  }

  onProgress?.(100, file.size, file.size);

  // Refresh Drive storage quota in background
  void refreshGoogleDriveQuota().catch(() => {});

  return {
    fileId,
    name: uploadedFile?.name || driveFileName,
    mimeType: uploadedFile?.mimeType || mimeType,
    sizeBytes: Number(uploadedFile?.size || file.size) || file.size,
    previewUrl: buildGoogleDrivePreviewUrl(fileId),
    downloadUrl: buildGoogleDriveDownloadUrl(fileId),
    webViewLink: uploadedFile?.webViewLink || buildGoogleDrivePreviewUrl(fileId),
  };
}

export async function listGoogleDriveAppVideos(): Promise<GoogleDriveVideoEntry[]> {
  const token = cachedAccessToken;
  if (!token) return [];
  const folderId = await ensureChoyVideosFolder(token);
  const query = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,mimeType,size,createdTime)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (res.status === 401 || res.status === 403) {
    handleDriveAuthError(res.status, 'Could not list Google Drive videos.');
  }
  if (!res.ok) return [];
  const data = (await res.json().catch(() => ({}))) as {
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
      createdTime?: string;
    }>;
  };
  return (data.files || [])
    .filter((f): f is { id: string; name?: string; mimeType?: string; size?: string; createdTime?: string } =>
      Boolean(f.id && SAFE_DRIVE_FILE_ID_RE.test(f.id))
    )
    .map((f) => ({
      fileId: f.id,
      name: f.name || 'Drive Video',
      mimeType: f.mimeType || 'video/mp4',
      sizeBytes: Number(f.size || 0) || 0,
      createdTime: f.createdTime || '',
      previewUrl: buildGoogleDrivePreviewUrl(f.id),
      downloadUrl: buildGoogleDriveDownloadUrl(f.id),
    }));
}

export async function deleteGoogleDriveVideoFile(fileId: string): Promise<void> {
  if (!SAFE_DRIVE_FILE_ID_RE.test(fileId)) {
    throw new Error('Invalid Google Drive file ID.');
  }
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Drive is not connected. Sign in with Google to delete the Drive file.');
  }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 404) {
    return; // Already deleted from Drive
  }
  if (res.status === 401 || res.status === 403) {
    handleDriveAuthError(res.status, 'Google Drive permission expired while deleting file.');
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Failed to delete file from Google Drive (${res.status}).`);
  }
  void refreshGoogleDriveQuota().catch(() => {});
}
