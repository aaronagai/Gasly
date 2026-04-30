#!/usr/bin/env node
'use strict';

/**
 * Local dev server with Vercel-like clean URLs.
 *
 * Routes:
 * - /            -> 302 /app
 * - /app         -> app.html
 * - /dashboard   -> dashboard.html
 * - /terminal    -> terminal.html
 * - /home        -> home/index.html
 * - /about       -> about/index.html
 * - /careers     -> careers/index.html
 * - /faq         -> faq/index.html
 *
 * Static assets are served from the repo root (e.g. /assets/*, /api/*, etc).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT || '3000', 10);

const ROUTES = new Map([
  ['/app', 'app.html'],
  ['/dashboard', 'dashboard.html'],
  ['/terminal', 'terminal.html'],
  ['/home', path.join('home', 'index.html')],
  ['/about', path.join('about', 'index.html')],
  ['/careers', path.join('careers', 'index.html')],
  ['/faq', path.join('faq', 'index.html')],
]);

const HTML_REDIRECTS = new Map([
  ['/app.html', '/app'],
  ['/dashboard.html', '/dashboard'],
  ['/terminal.html', '/terminal'],
  ['/home.html', '/home'],
  ['/about.html', '/about'],
  ['/careers.html', '/careers'],
  ['/faq.html', '/faq'],
  ['/index.html', '/app'],
]);

function contentTypeFor(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function safeJoin(root, reqPath) {
  const cleaned = reqPath.replace(/\/+/g, '/');
  const rel = cleaned.replace(/^\//, '');
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root)) return null;
  return abs;
}

function send(res, code, headers, body) {
  res.writeHead(code, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(u.pathname || '/');
    pathname = pathname.replace(/\/+$/, '') || '/';

    // Root redirect (matches production).
    if (pathname === '/') {
      return send(res, 302, { Location: '/app' }, '');
    }

    // Redirect legacy .html paths to clean URLs.
    const htmlRedirect = HTML_REDIRECTS.get(pathname);
    if (htmlRedirect) {
      return send(res, 302, { Location: htmlRedirect }, '');
    }

    // Clean URL route -> file.
    const routeHit = ROUTES.get(pathname);
    if (routeHit) {
      const abs = path.resolve(ROOT, routeHit);
      const buf = fs.readFileSync(abs);
      return send(res, 200, { 'Content-Type': contentTypeFor(abs), 'Cache-Control': 'no-store' }, buf);
    }

    // Also support /x/ -> /x for convenience.
    if (req.url && /\/$/.test(u.pathname) && ROUTES.get(pathname.replace(/\/+$/, ''))) {
      return send(res, 302, { Location: pathname.replace(/\/+$/, '') }, '');
    }

    // Static file.
    const abs = safeJoin(ROOT, pathname);
    if (!abs) return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad path');

    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const buf = fs.readFileSync(abs);
      return send(res, 200, { 'Content-Type': contentTypeFor(abs) }, buf);
    }

    return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
  } catch (e) {
    return send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, String(e && e.message ? e.message : e));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`dev server: http://localhost:${PORT} (clean URLs enabled)`);
});

