// A local stand-in for GitHub Pages serving a *project* site: the built site at /<repo>/ (never at the domain root),
// /<repo> redirected to /<repo>/, a directory served by its index.html, any missing path answered by 404.html with
// status 404, gzip when asked, and Pages' Cache-Control (max-age=600). It is for checking base-path robustness before a
// real staging deploy — not a replacement for one.
// Usage: node tools/pages_emulator.mjs <site dir> <repo name> [port]
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import zlib from 'node:zlib';
const [dir, repo, port = '8155'] = process.argv.slice(2);
if (!dir || !repo) { console.log('usage: node tools/pages_emulator.mjs <site dir> <repo name> [port]'); process.exit(2); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const base = `/${repo}/`;
function send(req, res, status, file) {
  const body = fs.readFileSync(file), gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ...(gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
  res.end(gz ? zlib.gzipSync(body) : body);
}
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  if (p === `/${repo}`) { res.writeHead(301, { Location: base + u.search }); return res.end(); }
  if (!p.startsWith(base)) return send(req, res, 404, path.join(dir, '404.html'));   // outside the project path, as on a user's github.io root without a site
  let f = path.join(dir, p.slice(base.length));
  if (!f.startsWith(path.resolve(dir))) return send(req, res, 404, path.join(dir, '404.html'));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' + u.search }); return res.end(); } f = path.join(f, 'index.html'); }
  if (!fs.existsSync(f)) return send(req, res, 404, path.join(dir, '404.html'));
  send(req, res, 200, f);
}).listen(+port, '127.0.0.1', () => console.log(`pages emulator: ${dir} at http://127.0.0.1:${port}${base}`));
