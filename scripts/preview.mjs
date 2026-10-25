import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transitResponse } from '../worker/transit.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const schedule = JSON.parse(await fs.readFile(path.join(root, 'transit-data.json'), 'utf8'));
const types = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/laundry') {
      res.writeHead(410, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Laundry tracking is no longer part of StudySignal.' }));
      return;
    }
    if (url.pathname === '/api/transit' && req.method === 'GET') {
      const response = await transitResponse(schedule);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Shared activity requires the Worker and D1 database. This local preview connects transit only.' }));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end('Method not allowed'); return;
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 503);
    res.end('Preview resource unavailable');
  }
});
server.listen(Number(process.env.PORT || 8080), '127.0.0.1', () => console.log(`StudySignal preview: http://127.0.0.1:${server.address().port} (live transit; shared activity unavailable)`));
