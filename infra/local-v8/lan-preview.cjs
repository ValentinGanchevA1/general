'use strict';
// HTTPS-only LAN preview. No public bind, no production target, no credentials in source.
const https = require('node:https');
const http = require('node:http');
const { readFileSync, createReadStream, statSync, existsSync } = require('node:fs');
const { resolve, join, extname, sep } = require('node:path');
const { isIP } = require('node:net');

const ROOT = resolve(__dirname, '..', '..', 'web');
const API = '127.0.0.1';
const API_PORT = 33188;
const PORT = 4176;
const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.map':'application/json; charset=utf-8','.svg':'image/svg+xml' };
function assertLanAddress(address) {
  if (isIP(address) !== 4 || !(/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address))) {
    throw Error('Use an explicit private IPv4 LAN address, never 0.0.0.0 or a public address');
  }
  return address;
}
function isApi(path) { return path === '/api/v1' || path.startsWith('/api/v1/') || path === '/socket.io' || path.startsWith('/socket.io/'); }
function staticPath(raw) {
  let pathname;
  try {
    // Reject traversal before URL normalization, including percent-encoded segments.
    const rawPath = raw.split('?')[0].split('#')[0];
    const decoded = decodeURIComponent(rawPath);
    if (decoded.includes('\\\\') || decoded.includes('\\0') ||
        decoded.split('/').some(segment => segment === '..' || segment === '.')) return null;
    pathname = new URL(raw, 'https://localhost').pathname;
  } catch { return null; }
  const full = resolve(ROOT, '.' + pathname);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  const candidate = full === ROOT ? join(ROOT, 'index.html') : full;
  // Never expose source, credentials, package metadata or private project files.
  const relative = candidate.slice(ROOT.length + 1).replaceAll('\\\\', '/');
  if (!(/^(index\\.html|(?:styles|map|connections)\\.css|dist\\/[a-zA-Z0-9._/-]+\\.(?:js|css|mjs|map))$/.test(relative))) return null;
  return existsSync(candidate) && statSync(candidate).isFile() ? candidate : null;
}
function proxyHeaders(headers) {
  const result = { ...headers, host: API + ':' + API_PORT, origin: 'http://127.0.0.1:33188' };
  delete result['x-forwarded-for'];
  delete result['x-forwarded-host'];
  delete result['x-forwarded-proto'];
  return result;
}
function start({ address, cert, key }) {
  assertLanAddress(address);
  if (!cert || !key) throw Error('TLS certificate and key are required');
  const tls = { cert: readFileSync(cert), key: readFileSync(key), minVersion: 'TLSv1.2' };
  const server = https.createServer(tls, (req, res) => {
    const url = req.url || '/';
    const pathname = new URL(url, 'https://localhost').pathname;
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    if (isApi(pathname)) {
      const upstream = http.request({ hostname: API, port: API_PORT, path: url, method: req.method, headers: proxyHeaders(req.headers), timeout: 15000 }, (response) => {
        const headers = { ...response.headers };
        delete headers['access-control-allow-origin'];
        delete headers['access-control-allow-credentials'];
        res.writeHead(response.statusCode || 502, headers);
        response.pipe(res);
      });
      upstream.on('timeout', () => upstream.destroy());
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Local API unavailable'); });
      req.pipe(upstream);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const file = staticPath(url);
    if (!file) { res.writeHead(404).end('Not found'); return; }
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://tile.openstreetmap.org https://api.maptiler.eu https://api.maptiler.com; connect-src 'self' https://api.maptiler.eu https://api.maptiler.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    if (req.method === 'HEAD') { res.writeHead(200).end(); return; }
    createReadStream(file).pipe(res);
  });
  server.on('upgrade', (req, socket, head) => {
    let pathname;
    try { pathname = new URL(req.url || '/', 'https://localhost').pathname; }
    catch { socket.destroy(); return; }
    if (!isApi(pathname) || !pathname.startsWith('/socket.io')) { socket.destroy(); return; }
    const upstream = http.request({hostname:API,port:API_PORT,path:req.url,headers:proxyHeaders(req.headers)});
    upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(response.headers).map(([k,v])=>k+': '+v+'\r\n').join('') + '\r\n');
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) upstreamSocket.write(head);
      socket.pipe(upstreamSocket).pipe(socket);
    });
    upstream.on('error',()=>socket.destroy());
    upstream.end();
  });
  server.listen(PORT,address,()=>process.stdout.write('NEXUS HTTPS LAN preview ready on https://'+address+':'+PORT+'\n'));
  return server;
}
if (require.main === module) {
  try { start({address:process.env.NEXUS_LAN_IP,cert:process.env.NEXUS_LAN_CERT,key:process.env.NEXUS_LAN_KEY}); }
  catch (error) { process.stderr.write('LAN preview refused: '+error.message+'\n'); process.exitCode=2; }
}
module.exports={assertLanAddress,isApi,staticPath,proxyHeaders,start};
