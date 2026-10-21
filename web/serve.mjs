import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 4174);
const types = new Map([['.html','text/html; charset=utf-8'],['.css','text/css; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.map','application/json; charset=utf-8']]);

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname);
  const safe = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  let path = join(root, safe === '/' ? 'index.html' : safe);
  if (!path.startsWith(root)) { response.writeHead(403).end('Forbidden'); return; }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) { response.writeHead(404).end('Not found'); return; }
  response.setHeader('Content-Type', types.get(extname(path)) ?? 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  createReadStream(path).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`NEXA web preview: http://127.0.0.1:${port}`));
