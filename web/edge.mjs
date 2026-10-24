import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, resolve, sep } from 'node:path';
import { connect as tlsConnect } from 'node:tls';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT ?? 4174);
const backend = parseBackendOrigin(process.env.BACKEND_ORIGIN);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
]);

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url ?? '/', 'http://nexa.invalid').pathname;
  } catch {
    response.writeHead(400).end('Bad Request');
    return;
  }

  if (pathname === '/healthz') {
    setSecurityHeaders(response);
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end('{"ok":true}');
    return;
  }

  if (isProxyPath(pathname)) {
    proxyHttp(request, response);
    return;
  }

  serveStatic(pathname, response);
});

server.on('upgrade', (request, socket, head) => {
  let pathname;
  try {
    pathname = new URL(request.url ?? '/', 'http://nexa.invalid').pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (!isSocketPath(pathname)) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }

  tunnelWebSocket(request, socket, head);
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`NEXA web edge listening on :${port}; backend=${backend.origin}`);
});

function parseBackendOrigin(value) {
  if (!value) throw new Error('BACKEND_ORIGIN is required');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error('BACKEND_ORIGIN must use HTTPS');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('BACKEND_ORIGIN must be a bare HTTPS origin');
  }
  return parsed;
}

function isProxyPath(pathname) {
  return pathname === '/api/v1' || pathname.startsWith('/api/v1/') || isSocketPath(pathname);
}

function isSocketPath(pathname) {
  return pathname === '/socket.io' || pathname.startsWith('/socket.io/');
}

function proxyHttp(request, response) {
  const headers = { ...request.headers };
  headers.host = backend.host;
  headers['x-forwarded-host'] = request.headers.host ?? '';
  headers['x-forwarded-proto'] = 'https';

  const upstream = httpsRequest({
    protocol: 'https:',
    hostname: backend.hostname,
    port: backend.port || 443,
    method: request.method,
    path: request.url,
    headers,
    timeout: 65_000,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Upstream unavailable');
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
}

function tunnelWebSocket(request, clientSocket, head) {
  const upstream = tlsConnect({
    host: backend.hostname,
    port: Number(backend.port || 443),
    servername: backend.hostname,
    rejectUnauthorized: true,
    ALPNProtocols: ['http/1.1'],
  });

  let connected = false;
  upstream.once('secureConnect', () => {
    connected = true;
    upstream.write(buildUpgradeRequest(request));
    if (head.length > 0) upstream.write(head);
    clientSocket.pipe(upstream).pipe(clientSocket);
  });

  upstream.on('error', () => {
    if (!connected && !clientSocket.destroyed) {
      clientSocket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    } else {
      clientSocket.destroy();
    }
  });
  clientSocket.on('error', () => upstream.destroy());
  clientSocket.on('close', () => upstream.destroy());
}

function buildUpgradeRequest(request) {
  const lines = [`${request.method ?? 'GET'} ${request.url ?? '/socket.io/'} HTTP/1.1`];

  for (const [name, rawValue] of Object.entries(request.headers)) {
    const lower = name.toLowerCase();
    if (lower === 'host' || lower === 'x-forwarded-host' || lower === 'x-forwarded-proto') continue;
    if (rawValue === undefined) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) lines.push(`${name}: ${value}`);
  }

  lines.push(`host: ${backend.host}`);
  lines.push(`x-forwarded-host: ${request.headers.host ?? ''}`);
  lines.push('x-forwarded-proto: https');
  lines.push('', '');
  return lines.join('\r\n');
}

function serveStatic(pathname, response) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end('Bad Request');
    return;
  }

  const relative = decoded === '/' ? 'index.html' : `.${decoded}`;
  let path = resolve(root, relative);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
  if (!existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end('Not Found');
    return;
  }

  setSecurityHeaders(response);
  response.setHeader('Content-Type', types.get(extname(path)) ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(path).pipe(response);
}

function setSecurityHeaders(response) {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  response.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}
