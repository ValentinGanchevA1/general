/**
 * Browser origins allowed for REST + Socket.IO.
 * localhost ≠ 127.0.0.1 — admin Vite binds 127.0.0.1:5173 (strictPort).
 * Always union env list with required admin/dev origins so a thin .env
 * cannot silently break the admin Live indicator.
 */
const REQUIRED_DEV_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

export function corsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const set = new Set<string>(fromEnv);
  if (process.env.NODE_ENV !== 'production') {
    for (const o of REQUIRED_DEV_ORIGINS) set.add(o);
  } else {
    // Production: still ensure admin origins if someone runs admin against prod API in a pinch
    for (const o of ['http://127.0.0.1:5173', 'http://localhost:5173']) {
      if (fromEnv.length === 0) set.add(o);
    }
  }

  if (set.size === 0) {
    set.add('http://localhost:3000');
  }
  return [...set];
}
