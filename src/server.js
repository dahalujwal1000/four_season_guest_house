/**
 * Four Seasons Guest House & Restaurant - website, booking engine and admin panel.
 * Zero dependencies: node src/server.js
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePublic } from './api-public.js';
import { handleAdmin } from './api-admin.js';
import { db } from './db.js';
import { turnstileEnabled, siteKey } from './turnstile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4173);

/* --------------------------- tiny .env loader --------------------------- */
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) process.env[key] = value.replace(/^["']|["']$/g, '');
  }
}
loadEnv();

/* ------------------------------ static files ---------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

async function serveStatic(req, res, pathname) {
  let urlPath = decodeURIComponent(pathname);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return true;
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const isAsset = /\.(jpg|jpeg|png|webp|svg|ico|woff2?)$/i.test(filePath);
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': isAsset ? 'public, max-age=604800' : 'no-cache'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------- server -------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('x-frame-options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
    res.end();
    return;
  }

  try {
    if (url.pathname.startsWith('/api/admin/')) return await handleAdmin(req, res, url);
    if (url.pathname.startsWith('/api/')) return await handlePublic(req, res, url);
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, turnstile: turnstileEnabled() }));
      return;
    }
    if (await serveStatic(req, res, url.pathname)) return;
    // pretty URLs: /rooms -> /rooms.html
    if (!path.extname(url.pathname) && (await serveStatic(req, res, `${url.pathname}.html`))) return;

    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(path.join(PUBLIC_DIR, '404.html')));
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[error]', err);
    if (res.headersSent) return;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message || 'Something went wrong' }));
  }
});

server.listen(PORT, async () => {
  const data = await db();
  const rooms = data.roomTypes.reduce((sum, r) => sum + r.rooms, 0);
  console.log('');
  console.log('  Four Seasons Guest House & Restaurant');
  console.log('  ------------------------------------');
  console.log(`  Website   http://localhost:${PORT}`);
  console.log(`  Admin     http://localhost:${PORT}/admin`);
  console.log(`  Inventory ${rooms} rooms across ${data.roomTypes.length} room types`);
  console.log(`  Turnstile ${turnstileEnabled() ? 'ON' : 'off (dev fallback: honeypot + rate limit)'}`);
  console.log('');
});
