'use strict';
// HTTPS-only opt-in LAN preview. Upstream is pinned to loopback; requests never
// select a destination. This is a test proxy, not a public reverse proxy.
const https = require('node:https');
const { readFileSync, createReadStream, statSync, existsSync, realpathSync, readdirSync } = require('node:fs');
const { resolve, join, extname, sep } = require('node:path');
const { isIP } = require('node:net');

const ROOT = resolve(__dirname, '..', '..', 'web');
const PORT = 4176;
const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.map':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
};
const METHODS = new Set(['GET', 'HEAD']);
const ROOT_REAL = existsSync(ROOT) ? realpathSync(ROOT) : ROOT;
const STATIC_FILES = new Map();

function registerStaticFile(route, candidate) {
  try {
    const real = realpathSync(candidate);
    if ((real !== ROOT_REAL && !real.startsWith(ROOT_REAL + sep)) || !statSync(real).isFile()) return;
    STATIC_FILES.set(route, real);
  } catch { /* Build output may be incomplete before the web build. */ }
}

function scanDistAssets(directory, routePrefix) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!/^[A-Za-z0-9_.-]+$/.test(entry.name) || entry.name.startsWith('.')) continue;
    const candidate = join(directory, entry.name);
    const route = routePrefix + '/' + entry.name;
    if (entry.isDirectory()) {
      scanDistAssets(candidate, route);
    } else if (entry.isFile() && /\.(?:js|css|mjs|map)$/i.test(entry.name)) {
      registerStaticFile(route, candidate);
    }
  }
}

for (const name of ['index.html', 'styles.css', 'map.css', 'connections.css']) {
  registerStaticFile(name === 'index.html' ? '/' : '/' + name, join(ROOT, name));
  registerStaticFile('/' + name, join(ROOT, name));
}
scanDistAssets(join(ROOT, 'dist'), '/dist');


function assertLanAddress(address) {
  if (isIP(address) !== 4 || !(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address))) {
    throw Error('Use an explicit private IPv4 LAN address, never 0.0.0.0 or a public address');
  }
  return address;
}

function parseRequestTarget(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 8192 ||
      !raw.startsWith('/') || raw.startsWith('//') || raw.includes('#') ||
      /[\u0000-\u001f\u007f\\]/.test(raw)) return null;

  const queryIndex = raw.indexOf('?');
  const rawPath = queryIndex < 0 ? raw : raw.slice(0, queryIndex);
  const search = queryIndex < 0 ? '' : raw.slice(queryIndex);
  if (!rawPath.startsWith('/') || rawPath.startsWith('//') || search.length > 4096 ||
      /[\u0000-\u001f\u007f\\]/.test(search)) return null;

  let decodedPath;
  try { decodedPath = decodeURIComponent(rawPath); } catch { return null; }
  if (/[\u0000-\u001f\u007f\\]/.test(decodedPath) ||
      decodedPath.split('/').some((segment) => segment === '.' || segment === '..')) return null;

  // Reject double-encoded separators/dot traversal rather than relying on how
  // a downstream router or filesystem might decode the same input.
  let nested = decodedPath;
  for (let depth = 0; depth < 2 && /%[0-9a-f]{2}/i.test(nested); depth += 1) {
    try { nested = decodeURIComponent(nested); } catch { return null; }
    if (/[\u0000-\u001f\u007f\\]/.test(nested) ||
        nested.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  }

  let parsed;
  try { parsed = new URL(raw, 'https://nexus-lan.invalid'); } catch { return null; }
  if (parsed.origin !== 'https://nexus-lan.invalid' || parsed.pathname !== rawPath) return null;
  return { pathname: parsed.pathname, decodedPath, search };
}

function isApi(path) {
  return path === '/api/v1' || path.startsWith('/api/v1/') ||
    path === '/socket.io' || path.startsWith('/socket.io/');
}

function isAllowedHost(headers, address) {
  if (!headers || headers.host !== address + ':' + PORT) return false;
  const origin = headers.origin;
  return origin === undefined || origin === 'https://' + address + ':' + PORT;
}

function staticPath(raw) {
  const target = parseRequestTarget(raw);
  if (!target) return null;
  const route = target.decodedPath === '/' ? '/' : target.decodedPath;
  return STATIC_FILES.get(route) ?? null;
}

function start({ address, cert, key }) {
  assertLanAddress(address);
  if (!cert || !key) throw Error('TLS certificate and key are required');
  const tls = { cert: readFileSync(cert), key: readFileSync(key), minVersion: 'TLSv1.2' };

  const server = https.createServer(tls, (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');

    if (!isAllowedHost(req.headers, address)) { res.writeHead(421).end('Host not allowed'); return; }
    if (!METHODS.has(req.method || '')) { res.writeHead(405).end('Method not allowed'); return; }

    const target = parseRequestTarget(req.url || '');
    if (!target) { res.writeHead(400).end('Invalid request target'); return; }

    // Static-only LAN preview: API and Socket.IO are denied until a separately
    // reviewed, route-specific local proxy is designed and tested.
    if (isApi(target.decodedPath)) { res.writeHead(403).end('Backend access disabled in LAN preview'); return; }

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const file = staticPath(req.url || '/');
    if (!file) { res.writeHead(404).end('Not found'); return; }
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://tile.openstreetmap.org https://api.maptiler.eu https://api.maptiler.com; connect-src 'self' https://api.maptiler.eu https://api.maptiler.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    if (req.method === 'HEAD') { res.writeHead(200).end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); });
    stream.pipe(res);
  });

  // No WebSocket upgrades are accepted by the static-only LAN preview.
  server.on('upgrade', (_req, socket) => socket.destroy());

  server.listen(PORT, address, () =>
    process.stdout.write('NEXUS HTTPS LAN preview ready on https://' + address + ':' + PORT + '\n'));
  return server;
}

if (require.main === module) {
  try { start({ address: process.env.NEXUS_LAN_IP, cert: process.env.NEXUS_LAN_CERT, key: process.env.NEXUS_LAN_KEY }); }
  catch (error) { process.stderr.write('LAN preview refused: ' + error.message + '\n'); process.exitCode = 2; }
}

module.exports = {
  assertLanAddress, parseRequestTarget, isApi, isAllowedHost, staticPath,
  start, MIME,
};
