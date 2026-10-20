// Serve the built site (_site/) like GitHub Pages would, to try the install / offline parts: node tools/serve-site.js [port]
// A service worker needs localhost or https; localhost counts. Run `node tools/build-pages.js` first.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '_site'), port = Number(process.argv[2]) || 5174;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, () => console.log(`http://localhost:${port}`));
