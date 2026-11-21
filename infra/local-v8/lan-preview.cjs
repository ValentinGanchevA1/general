'use strict';
// HTTPS-only opt-in LAN preview. Upstream is pinned to loopback; requests never
// select a destination. This is a test proxy, not a public reverse proxy.
const https = require('node:https');
const http = require('node:http');
const { readFileSync, createReadStream, statSync, existsSync, realpathSync } = require('node:fs');
const { resolve, join, extname, sep } = require('node:path');
const { isIP } = require('node:net');

const ROOT = resolve(__dirname, '..', '..', 'web');
const API = '127.0.0.1';
const API_PORT = 33188;
const PORT = 4176;
const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.map':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
};
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const ROOT_REAL = existsSync(ROOT) ? realpathSync(ROOT) : ROOT;

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
  const pathname = target.decodedPath;
  const full = resolve(ROOT, '.' + pathname);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  const candidate = full === ROOT ? join(ROOT, 'index.html') : full;
  const relative = candidate.slice(ROOT.length + 1).replaceAll('\\', '/');
  if (!/^(index\.html|(?:styles|map|connections)\.css|dist\/[a-zA-Z0-9._/-]+\.(?:js|css|mjs|map))$/.test(relative)) return null;
  try {
    const real = realpathSync(candidate);
    if (real !== ROOT_REAL && !real.startsWith(ROOT_REAL + sep)) return null;
    return statSync(real).isFile() ? real : null;
  } catch { return null; }
}

function proxyHeaders(headers) {
  const allowed = [
    'accept', 'accept-encoding', 'accept-language', 'content-type', 'content-length',
    'authorization', 'cookie', 'user-agent', 'x-nexa-web-session', 'x-csrf-token',
  ];
  const result = {};
  for (const name of allowed) {
    const value = headers[name];
    if (typeof value === 'string') result[name] = value;
  }
  result.host = API + ':' + API_PORT;
  result.origin = 'http://127.0.0.1:' + API_PORT;
  return result;
}

function safeResponseHeaders(headers) {
  const blocked = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade', 'location',
    'access-control-allow-origin', 'access-control-allow-credentials',
  ]);
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!blocked.has(name.toLowerCase()) && value !== undefined) result[name] = value;
  }
  return result;
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

    if (isApi(target.decodedPath)) {
      const upstream = http.request({
        hostname: API, port: API_PORT,
        path: target.pathname + target.search,
        method: req.method,
        headers: proxyHeaders(req.headers),
        timeout: 15000,
      }, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
          response.resume();
          res.writeHead(502).end('Local API redirect refused');
          return;
        }
        res.writeHead(response.statusCode || 502, safeResponseHeaders(response.headers));
        response.pipe(res);
      });
      upstream.on('timeout', () => upstream.destroy(new Error('Local API timeout')));
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Local API unavailable'); });
      res.on('close', () => upstream.destroy());
      req.pipe(upstream);
      return;
    }

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

  server.on('upgrade', (req, socket, head) => {
    const target = parseRequestTarget(req.url || '');
    const connection = String(req.headers.connection || '').toLowerCase().split(',').map((v) => v.trim());
    if (!isAllowedHost(req.headers, address) || !target ||
        !target.decodedPath.startsWith('/socket.io') ||
        (target.decodedPath !== '/socket.io' && !target.decodedPath.startsWith('/socket.io/')) ||
        req.method !== 'GET' || String(req.headers.upgrade || '').toLowerCase() !== 'websocket' ||
        !connection.includes('upgrade')) {
      socket.destroy();
      return;
    }

    const headers = proxyHeaders(req.headers);
    for (const name of ['connection', 'upgrade', 'sec-websocket-key', 'sec-websocket-version',
      'sec-websocket-protocol', 'sec-websocket-extensions']) {
      const value = req.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }
    headers.connection = 'Upgrade';
    headers.upgrade = 'websocket';

    const upstream = http.request({
      hostname: API, port: API_PORT, path: target.pathname + target.search,
      method: 'GET', headers, timeout: 15000,
    });
    upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
      const lines = ['HTTP/1.1 101 Switching Protocols'];
      for (const [name, value] of Object.entries(response.headers)) {
        const values = Array.isArray(value) ? value : [value];
        for (const entry of values) {
          if (typeof entry === 'string' && !/[\r\n]/.test(name + entry)) lines.push(name + ': ' + entry);
        }
      }
      socket.write(lines.join('\r\n') + '\r\n\r\n');
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) upstreamSocket.write(head);
      socket.pipe(upstreamSocket).pipe(socket);
      upstreamSocket.on('error', () => socket.destroy());
      socket.on('error', () => upstreamSocket.destroy());
    });
    upstream.on('response', () => socket.destroy());
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.end();
  });

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
  proxyHeaders, safeResponseHeaders, start,
};
