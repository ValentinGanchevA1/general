import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, resolve, sep } from 'node:path';
import { connect as tlsConnect } from 'node:tls';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT ?? 4174);
const PARSE_ORIGIN = 'https://nexa.invalid';
const PREVIEW_BACKEND_ORIGIN = 'https://g88-api-pr-578.onrender.com';
const PRODUCTION_BACKEND_ORIGIN = 'https://g88-api.onrender.com';
const backend = resolveBackendOrigin(process.env.BACKEND_ORIGIN);
const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
]);

const server = createServer((request, response) => {
  const target = parseRequestTarget(request.url);
  if (!target) {
    response.writeHead(400).end('Bad Request');
    return;
  }

  if (target.pathname === '/healthz') {
    setSecurityHeaders(response);
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end('{"ok":true}');
    return;
  }

  if (isProxyPath(target.pathname)) {
    proxyHttp(request, response, target.requestTarget);
    return;
  }

  serveStatic(target.pathname, response);
});

server.on('upgrade', (request, socket, head) => {
  const target = parseRequestTarget(request.url);
  if (!target || request.method !== 'GET' || !isSocketPath(target.pathname)) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }

  tunnelWebSocket(request, socket, head, target.requestTarget);
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`NEXA web edge listening on :${port}; backend=${backend.origin}`);
});

function resolveBackendOrigin(value) {
  // The preview edge is deliberately not a generic reverse proxy. Return URL
  // instances created from constants so request input can never select a host.
  if (value === PREVIEW_BACKEND_ORIGIN) return new URL(PREVIEW_BACKEND_ORIGIN);
  if (value === PRODUCTION_BACKEND_ORIGIN) return new URL(PRODUCTION_BACKEND_ORIGIN);
  throw new Error('BACKEND_ORIGIN is not an approved NEXA backend origin');
}

function parseRequestTarget(rawTarget) {
  if (typeof rawTarget !== 'string' || !rawTarget.startsWith('/') || rawTarget.startsWith('//')) {
    return null;
  }
  if (rawTarget.includes('\\') || /[\u0000-\u001F\u007F]/u.test(rawTarget)) return null;

  try {
    const parsed = new URL(rawTarget, PARSE_ORIGIN);
    if (parsed.origin !== PARSE_ORIGIN || parsed.hash) return null;
    return {
      pathname: parsed.pathname,
      requestTarget: `${parsed.pathname}${parsed.search}`,
    };
  } catch {
    return null;
  }
}

function isProxyPath(pathname) {
  return pathname === '/api/v1' || pathname.startsWith('/api/v1/') || isSocketPath(pathname);
}

function isSocketPath(pathname) {
  return pathname === '/socket.io' || pathname.startsWith('/socket.io/');
}

function proxyHttp(request, response, requestTarget) {
  const method = request.method ?? 'GET';
  if (!allowedMethods.has(method)) {
    response.writeHead(405, { Allow: [...allowedMethods].join(', ') }).end('Method Not Allowed');
    return;
  }

  const headers = buildHttpRequestHeaders(request.headers);
  const upstream = httpsRequest({
    protocol: 'https:',
    hostname: backend.hostname,
    port: 443,
    method,
    path: requestTarget,
    headers,
    timeout: 65_000,
  }, (upstreamResponse) => {
    const statusCode = upstreamResponse.statusCode ?? 502;
    if (statusCode >= 300 && statusCode < 400) {
      upstreamResponse.resume();
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Unexpected upstream redirect');
      return;
    }

    response.writeHead(statusCode, buildHttpResponseHeaders(upstreamResponse.headers));
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

function buildHttpRequestHeaders(source) {
  const headers = {
    host: backend.host,
    'x-forwarded-proto': 'https',
  };

  const accept = safeHeader(source.accept);
  if (accept) headers.accept = accept;
  const acceptLanguage = safeHeader(source['accept-language']);
  if (acceptLanguage) headers['accept-language'] = acceptLanguage;
  const authorization = safeHeader(source.authorization);
  if (authorization) headers.authorization = authorization;
  const contentType = safeHeader(source['content-type']);
  if (contentType) headers['content-type'] = contentType;
  const contentLength = safeHeader(source['content-length']);
  if (contentLength && /^\d+$/u.test(contentLength)) headers['content-length'] = contentLength;
  const cookie = safeHeader(source.cookie);
  if (cookie) headers.cookie = cookie;
  const origin = safeHeader(source.origin);
  if (origin) headers.origin = origin;
  const userAgent = safeHeader(source['user-agent']);
  if (userAgent) headers['user-agent'] = userAgent;
  const webSession = safeHeader(source['x-nexa-web-session']);
  if (webSession) headers['x-nexa-web-session'] = webSession;

  return headers;
}

function buildHttpResponseHeaders(source) {
  const headers = {};
  const contentType = safeHeader(source['content-type']);
  if (contentType) headers['content-type'] = contentType;
  const contentLength = safeHeader(source['content-length']);
  if (contentLength && /^\d+$/u.test(contentLength)) headers['content-length'] = contentLength;
  const contentEncoding = safeHeader(source['content-encoding']);
  if (contentEncoding) headers['content-encoding'] = contentEncoding;
  const cacheControl = safeHeader(source['cache-control']);
  if (cacheControl) headers['cache-control'] = cacheControl;
  const etag = safeHeader(source.etag);
  if (etag) headers.etag = etag;
  const vary = safeHeader(source.vary);
  if (vary) headers.vary = vary;
  const retryAfter = safeHeader(source['retry-after']);
  if (retryAfter) headers['retry-after'] = retryAfter;
  const authenticate = safeHeader(source['www-authenticate']);
  if (authenticate) headers['www-authenticate'] = authenticate;

  const setCookie = source['set-cookie'];
  if (Array.isArray(setCookie)) {
    const safeCookies = setCookie.map(safeHeader).filter((value) => value != null);
    if (safeCookies.length > 0) headers['set-cookie'] = safeCookies;
  }

  return headers;
}

function tunnelWebSocket(request, clientSocket, head, requestTarget) {
  const upstream = tlsConnect({
    host: backend.hostname,
    port: 443,
    servername: backend.hostname,
    rejectUnauthorized: true,
    ALPNProtocols: ['http/1.1'],
  });

  let connected = false;
  upstream.once('secureConnect', () => {
    connected = true;
    upstream.write(buildUpgradeRequest(request.headers, requestTarget));
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

function buildUpgradeRequest(source, requestTarget) {
  const lines = [
    `GET ${requestTarget} HTTP/1.1`,
    `host: ${backend.host}`,
    'connection: Upgrade',
    'upgrade: websocket',
    'x-forwarded-proto: https',
  ];

  appendHeader(lines, 'sec-websocket-key', source['sec-websocket-key']);
  appendHeader(lines, 'sec-websocket-version', source['sec-websocket-version']);
  appendHeader(lines, 'sec-websocket-extensions', source['sec-websocket-extensions']);
  appendHeader(lines, 'sec-websocket-protocol', source['sec-websocket-protocol']);
  appendHeader(lines, 'cookie', source.cookie);
  appendHeader(lines, 'origin', source.origin);
  appendHeader(lines, 'user-agent', source['user-agent']);

  lines.push('', '');
  return lines.join('\r\n');
}

function appendHeader(lines, name, rawValue) {
  const value = safeHeader(rawValue);
  if (value) lines.push(`${name}: ${value}`);
}

function safeHeader(rawValue) {
  if (typeof rawValue !== 'string') return null;
  if (rawValue.length === 0 || /[\r\n\u0000]/u.test(rawValue)) return null;
  return rawValue;
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
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org https://api.maptiler.eu https://api.maptiler.com; connect-src 'self' https://api.maptiler.eu https://api.maptiler.com; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  response.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}
