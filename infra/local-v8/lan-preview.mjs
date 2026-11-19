// NEXUS v8 LAN preview: read-only discovery, never exposes auth or realtime.
// Explicit opt-in: NEXUS_V8_LAN_HOST=<private IPv4> node infra/local-v8/lan-preview.mjs
import { createServer, request as httpRequest } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';

const root = resolve(fileURLToPath(new URL('../../web/', import.meta.url)));
const host = process.env.NEXUS_V8_LAN_HOST ?? '';
const port = 4175;
const backend = '127.0.0.1';
const backendPort = 33188;
const isPrivate = (ip) => {
  const n = ip.split('.').map(Number);
  return n.length === 4 && n.every((v) => Number.isInteger(v) && v >= 0 && v <= 255) &&
    (n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
      (n[0] === 192 && n[1] === 168));
};
if (isIP(host) !== 4 || !isPrivate(host)) {
  throw new Error('Set NEXUS_V8_LAN_HOST to a private IPv4 assigned to this PC');
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.map': 'application/json; charset=utf-8' };
const security = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "connect-src 'self'", "object-src 'none'", "base-uri 'self'",
  "form-action 'self'", "frame-ancestors 'none'",
  "worker-src 'self'"
].join('; ');
const deny = (res, code = 403) => res.writeHead(code, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Unavailable in LAN preview');
const allowed = new Set(['GET', 'HEAD']);
const apiPaths = new Set(['/api/v1/feed']);
function handle(req, res) {
  res.setHeader('Content-Security-Policy', security);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  const raw = req.url ?? '/';
  let url;
  try { url = new URL(raw, 'http://localhost'); } catch { return deny(res, 400); }
  const path = url.pathname;
  // HTTP over Wi-Fi is not confidential: do not forward credentials or private API requests.
  if (path.startsWith('/api/') || path.startsWith('/socket.io')) {
    if (!allowed.has(req.method) || !apiPaths.has(path) || req.headers.authorization ||
        req.headers.cookie || req.headers['x-nexa-web-session']) return deny(res);
    const upstream = httpRequest({
      hostname: backend, port: backendPort, path: path + url.search,
      method: req.method, timeout: 4000,
      headers: { accept: 'application/json' },
    }, (up) => {
      res.writeHead(up.statusCode ?? 502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      up.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) deny(res, 502); else res.destroy(); });
    upstream.end();
    return;
  }
  if (!allowed.has(req.method)) return deny(res, 405);
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { return deny(res, 400); }
  if (decoded.includes('\\') || decoded.includes('\0')) return deny(res, 400);
  const target = resolve(root, '.' + (decoded === '/' ? '/index.html' : decoded));
  if (!(target === root || target.startsWith(root + sep)) || !existsSync(target) || !statSync(target).isFile()) return deny(res, 404);
  res.setHeader('Content-Type', types[extname(target)] ?? 'application/octet-stream');
  createReadStream(target).pipe(res);
}
createServer(handle).on('upgrade', (_req, socket) => socket.destroy())
  .listen(port, host, () => console.log(`NEXUS read-only LAN preview: http://${host}:${port} (no login/chat)`));
