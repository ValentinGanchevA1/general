import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 4174);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
]);
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "connect-src 'self' http://127.0.0.1:3001 ws://127.0.0.1:3001 http://localhost:3001 ws://localhost:3001",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname);
  const safe = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  let path = join(root, safe === '/' ? 'index.html' : safe);
  if (!path.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.setHeader('Content-Type', types.get(extname(path)) ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  createReadStream(path).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`NEXA web preview: http://127.0.0.1:${port}`));
