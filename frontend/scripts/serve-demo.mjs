// Local QA server only; not part of the Cloudflare deployment.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('dist');
const headerFile = await readFile(resolve(root, '_headers'), 'utf8');
const headers = Object.fromEntries(headerFile.split('\n').filter(line => line.startsWith('  ')).map(line => {
  const split = line.indexOf(':');
  return [line.slice(0, split).trim(), line.slice(split + 1).trim()];
}));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep) || path.startsWith('/api') || path.startsWith('/oauth2') || path === '/_headers' || path.endsWith('.map')) {
      response.writeHead(404, headers).end(); return;
    }
    const content = await readFile(file);
    response.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(content);
  } catch { response.writeHead(404, headers).end(); }
}).listen(4173, '127.0.0.1', () => console.log('Built browser demo ready on loopback :4173 with Pages headers.'));
