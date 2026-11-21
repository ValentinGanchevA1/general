// NEXUS v8 LAN preview: read-only discovery, never exposes auth or realtime.
// Explicit opt-in: NEXUS_V8_LAN_HOST=<private IPv4> node infra/local-v8/lan-preview.mjs
import { createServer, request as httpRequest } from 'node:http';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isIP } from 'node:net';

const root = resolve(fileURLToPath(new URL('../../web/', import.meta.url)));
const rootReal = existsSync(root) ? realpathSync(root) : root;
const host = process.env.NEXUS_V8_LAN_HOST ?? '';
const port = 4175;
const backend = '127.0.0.1';
const backendPort = 33188;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const security = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "connect-src 'self'", "object-src 'none'", "base-uri 'self'",
  "form-action 'self'", "frame-ancestors 'none'", "worker-src 'self'",
].join('; ');
const deny = (res, code = 403) => res.writeHead(code, {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}).end('Unavailable in LAN preview');

function isPrivate(ip) {
  if (isIP(ip) !== 4) return false;
  const parts = ip.split('.').map(Number);
  return parts.every((value) => Number.isInteger(value) && value >= 0 && value <= 255) &&
    (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168));
}

function parseRequestTarget(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096 ||
      !raw.startsWith('/') || raw.startsWith('//') || raw.includes('#') ||
      /[\u0000-\u001f\u007f\\]/.test(raw)) return null;

  const queryIndex = raw.indexOf('?');
  const rawPath = queryIndex < 0 ? raw : raw.slice(0, queryIndex);
  const search = queryIndex < 0 ? '' : raw.slice(queryIndex);
  if (!rawPath.startsWith('/') || rawPath.startsWith('//') || search.length > 2048 ||
      /[\u0000-\u001f\u007f\\]/.test(search)) return null;

  let decodedPath;
  let decodedSearch;
  try {
    decodedPath = decodeURIComponent(rawPath);
    decodedSearch = decodeURIComponent(search);
  } catch { return null; }
  if (/[\u0000-\u001f\u007f\\]/.test(decodedPath + decodedSearch) ||
      decodedPath.split('/').some((segment) => segment === '.' || segment === '..')) return null;

  let nested = decodedPath;
  for (let depth = 0; depth < 2 && /%[0-9a-f]{2}/i.test(nested); depth += 1) {
    try { nested = decodeURIComponent(nested); } catch { return null; }
    if (/[\u0000-\u001f\u007f\\]/.test(nested) ||
        nested.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  }

  let parsed;
  try { parsed = new URL(raw, 'http://nexus-lan.invalid'); } catch { return null; }
  if (parsed.origin !== 'http://nexus-lan.invalid' || parsed.pathname !== rawPath) return null;
  return { pathname: parsed.pathname, decodedPath, search };
}

function isAllowedHost(headers, address = host) {
  if (!address || !headers || headers.host !== address + ':' + port) return false;
  const origin = headers.origin;
  return origin === undefined || origin === 'http://' + address + ':' + port;
}

function staticPath(raw) {
  const target = parseRequestTarget(raw);
  if (!target) return null;
  const pathname = target.decodedPath;
  if (pathname.split('/').some((segment) => segment.startsWith('.'))) return null;
  const candidate = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  try {
    const real = realpathSync(candidate);
    if (real !== rootReal && !real.startsWith(rootReal + sep)) return null;
    if (!statSync(real).isFile()) return null;
    const extension = extname(real).toLowerCase();
    return Object.hasOwn(types, extension) ? real : null;
  } catch { return null; }
}

function handle(req, res, address = host) {
  res.setHeader('Content-Security-Policy', security);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  if (!isAllowedHost(req.headers, address)) return deny(res, 421);
  if (req.method !== 'GET' && req.method !== 'HEAD') return deny(res, 405);

  const target = parseRequestTarget(req.url ?? '');
  if (!target) return deny(res, 400);
  const path = target.decodedPath;

  // HTTP over Wi-Fi is not confidential: only the anonymous feed may be proxied.
  if (path.startsWith('/api/') || path.startsWith('/socket.io')) {
    if ((path !== '/api/v1/feed') ||
        (req.headers.authorization !== undefined) ||
        (req.headers.cookie !== undefined) ||
        (req.headers['x-nexa-web-session'] !== undefined)) return deny(res);

    const upstream = httpRequest({
      hostname: backend,
      port: backendPort,
      path: target.pathname + target.search,
      method: req.method,
      timeout: 4000,
      headers: { accept: 'application/json' },
    }, (up) => {
      if (up.statusCode && up.statusCode >= 300 && up.statusCode < 400) {
        up.resume();
        return deny(res, 502);
      }
      res.writeHead(up.statusCode ?? 502, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      up.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) deny(res, 502); else res.destroy(); });
    res.on('close', () => upstream.destroy());
    upstream.end();
    return;
  }

  const file = staticPath(req.url ?? '/');
  if (!file) return deny(res, 404);
  res.setHeader('Content-Type', types[extname(file).toLowerCase()] ?? 'application/octet-stream');
  if (req.method === 'HEAD') return res.writeHead(200).end();
  const stream = createReadStream(file);
  stream.on('error', () => { if (!res.headersSent) deny(res, 404); else res.destroy(); });
  stream.pipe(res);
}

function start() {
  if (!isPrivate(host)) {
    throw new Error('Set NEXUS_V8_LAN_HOST to a private IPv4 assigned to this PC');
  }
  const server = createServer(handle);
  server.on('upgrade', (_req, socket) => socket.destroy());
  server.listen(port, host, () =>
    console.log('NEXUS read-only LAN preview: http://' + host + ':' + port + ' (no login/chat)'));
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) start();

export { isPrivate, parseRequestTarget, isAllowedHost, staticPath, handle, start };
