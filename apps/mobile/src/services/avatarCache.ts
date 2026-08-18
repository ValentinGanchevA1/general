import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * Offline-first avatar (and small face/cover) image cache.
 *
 * Layers:
 *  1. In-memory Map  remoteUrl → file:// path
 *  2. Disk under CacheDir/avatars + AsyncStorage index (key → { path, at })
 *  3. Network download via react-native-blob-util
 *
 * Cache key = origin + pathname (query stripped) so rotating S3 signatures
 * still hit the same object when the key path is stable.
 */

const INDEX_KEY = '@g88/avatarCache/v1';
const MAX_ENTRIES = 150;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface IndexEntry {
  /** Absolute filesystem path (no file:// prefix). */
  path: string;
  at: number;
}

type Index = Record<string, IndexEntry>;

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

let indexLoaded: Promise<Index> | null = null;
let dirReady: Promise<string> | null = null;

function cacheKey(uri: string): string {
  try {
    const u = new URL(uri);
    return `${u.origin}${u.pathname}`;
  } catch {
    const q = uri.indexOf('?');
    return q >= 0 ? uri.slice(0, q) : uri;
  }
}

/** FNV-1a 32-bit — short stable filename. */
function hashKey(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function extFromUri(uri: string): string {
  try {
    const path = new URL(uri).pathname.toLowerCase();
    if (path.endsWith('.png')) return 'png';
    if (path.endsWith('.webp')) return 'webp';
    if (path.endsWith('.heic')) return 'heic';
    if (path.endsWith('.gif')) return 'gif';
  } catch {
    /* ignore */
  }
  return 'jpg';
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function ensureDir(): Promise<string> {
  if (!dirReady) {
    dirReady = (async () => {
      const dir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/avatars`;
      const exists = await ReactNativeBlobUtil.fs.isDir(dir);
      if (!exists) {
        await ReactNativeBlobUtil.fs.mkdir(dir);
      }
      return dir;
    })();
  }
  return dirReady;
}

async function loadIndex(): Promise<Index> {
  if (!indexLoaded) {
    indexLoaded = (async () => {
      try {
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Index;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    })();
  }
  return indexLoaded;
}

async function saveIndex(index: Index): Promise<void> {
  indexLoaded = Promise.resolve(index);
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* best-effort */
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return await ReactNativeBlobUtil.fs.exists(path);
  } catch {
    return false;
  }
}

async function prune(index: Index): Promise<Index> {
  const now = Date.now();
  const entries = Object.entries(index).sort((a, b) => b[1].at - a[1].at);
  const next: Index = {};
  for (const [k, v] of entries) {
    if (now - v.at > MAX_AGE_MS) {
      void ReactNativeBlobUtil.fs.unlink(v.path).catch(() => undefined);
      memory.delete(k);
      continue;
    }
    if (Object.keys(next).length >= MAX_ENTRIES) {
      void ReactNativeBlobUtil.fs.unlink(v.path).catch(() => undefined);
      memory.delete(k);
      continue;
    }
    next[k] = v;
  }
  if (Object.keys(next).length !== Object.keys(index).length) {
    await saveIndex(next);
  }
  return next;
}

async function downloadToCache(uri: string, key: string): Promise<string | null> {
  const dir = await ensureDir();
  const dest = `${dir}/${hashKey(key)}.${extFromUri(uri)}`;
  try {
    const res = await ReactNativeBlobUtil.config({
      path: dest,
      fileCache: true,
      timeout: 20_000,
    }).fetch('GET', uri);

    const status = res.info().status;
    if (status < 200 || status >= 300) {
      void ReactNativeBlobUtil.fs.unlink(dest).catch(() => undefined);
      return null;
    }

    const index = await loadIndex();
    index[key] = { path: dest, at: Date.now() };
    await saveIndex(await prune(index));

    const fileUri = toFileUri(dest);
    memory.set(key, fileUri);
    return fileUri;
  } catch {
    void ReactNativeBlobUtil.fs.unlink(dest).catch(() => undefined);
    return null;
  }
}

/**
 * Resolve a remote image URL to a local `file://` URI when cached/downloadable.
 * Falls back to the original remote URI if offline download fails (online paint).
 * Returns null only when input is null/empty.
 */
export async function resolveAvatarUri(
  uri: string | null | undefined,
): Promise<string | null> {
  if (!uri || uri.trim() === '') return null;
  if (uri.startsWith('file://') || uri.startsWith('data:')) return uri;

  const key = cacheKey(uri);

  const mem = memory.get(key);
  if (mem) return mem;

  const existing = inflight.get(key);
  if (existing) return existing;

  const job = (async (): Promise<string | null> => {
    const index = await loadIndex();
    const hit = index[key];
    if (hit) {
      if (Date.now() - hit.at <= MAX_AGE_MS && (await fileExists(hit.path))) {
        hit.at = Date.now();
        index[key] = hit;
        void saveIndex(index);
        const fileUri = toFileUri(hit.path);
        memory.set(key, fileUri);
        return fileUri;
      }
      delete index[key];
      void saveIndex(index);
      void ReactNativeBlobUtil.fs.unlink(hit.path).catch(() => undefined);
    }

    const downloaded = await downloadToCache(uri, key);
    // Prefer local; if download failed, still return remote for online display.
    return downloaded ?? uri;
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

/** Fire-and-forget warm cache for map viewport faces. */
export function prefetchAvatars(uris: Array<string | null | undefined>): void {
  const unique = new Set<string>();
  for (const u of uris) {
    if (u && !u.startsWith('file://') && !u.startsWith('data:')) {
      unique.add(u);
    }
  }
  for (const u of unique) {
    void resolveAvatarUri(u);
  }
}

export async function clearAvatarCache(): Promise<void> {
  memory.clear();
  inflight.clear();
  try {
    const dir = await ensureDir();
    const exists = await ReactNativeBlobUtil.fs.isDir(dir);
    if (exists) {
      await ReactNativeBlobUtil.fs.unlink(dir);
      await ReactNativeBlobUtil.fs.mkdir(dir);
    }
  } catch {
    /* ignore */
  }
  indexLoaded = Promise.resolve({});
  await AsyncStorage.removeItem(INDEX_KEY);
}
