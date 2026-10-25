// Build the GitHub Pages site into _site/: wrap duga.html in a full HTML document (the Claude artifact
// host adds this skeleton itself), add the "install on the home screen" parts (manifest, icons, service
// worker for offline use) and copy the files the page loads.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, '_site');
// Пульк в браузере lives in its own repository (DanyaPole/pulk, folder web/). On GitHub the workflow checks it
// out into pulk-src and sets PULK_SRC; locally it is the neighbour folder C:\dev\projects\pulk.
const pulkSrc = process.env.PULK_SRC || path.join(root, '..', 'pulk');
if (!fs.existsSync(path.join(pulkSrc, 'web', 'app.js'))) throw new Error('Пульк не найден: ' + pulkSrc + ' (нужна папка web/ репозитория DanyaPole/pulk)');
// It is tested first, with the dictionaries it loads on this site (../../dict_*.txt = this root):
// a failing test stops the build, so a broken version is never published
require('child_process').execFileSync(process.execPath, [path.join(pulkSrc, 'tools', 'test-web.js')],
  { stdio: 'inherit', env: Object.assign({}, process.env, { PULK_DICT_DIR: root }) });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const BUILD = Date.now().toString(36); // new cache name on every build, so updates reach installed copies
const FILES = ['index.html', 'swipe.js', 'dict_ru.txt', 'dict_en.txt', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

const page = fs.readFileSync(path.join(root, 'duga.html'), 'utf8');
const head = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<meta name="color-scheme" content="light dark">\n' + // the page has its own dark theme
  '<meta name="darkreader-lock">\n' + // so the Dark Reader extension leaves its colours alone
  '<meta name="description" content="Бесплатная клавиатура для набора одной рукой: дуга под большой палец.">\n' +
  '<meta name="theme-color" content="#E7ECEF" media="(prefers-color-scheme: light)">\n' +
  '<meta name="theme-color" content="#0D1215" media="(prefers-color-scheme: dark)">\n' +
  '<link rel="manifest" href="manifest.webmanifest">\n' +
  '<link rel="apple-touch-icon" href="icons/icon-180.png">\n' +
  '<link rel="icon" type="image/png" href="icons/icon-192.png">\n' +
  '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
  '<meta name="mobile-web-app-capable" content="yes">\n' +
  '<meta name="apple-mobile-web-app-title" content="Дуга">\n' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n' +
  // same reset as the artifact host: the page fits the screen between the phone's system bars
  '<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n' +
  '</head>\n<body>\n';
const tail = '\n<script>if("serviceWorker"in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})});</script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(out, 'index.html'), head + page + tail);

fs.mkdirSync(path.join(out, 'icons'));
for (const f of ['swipe.js', 'dict_ru.txt', 'dict_en.txt']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const f of ['icon-180.png', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(root, 'icons', f), path.join(out, 'icons', f));

// the Android keyboard Пульк: its own pages, icons and the installer file live here, served as they are;
// the browser version comes from Пульк's repository
fs.cpSync(path.join(root, 'pulk'), path.join(out, 'pulk'), { recursive: true });
fs.rmSync(path.join(out, 'pulk', 'web'), { recursive: true, force: true });
fs.cpSync(path.join(pulkSrc, 'web'), path.join(out, 'pulk', 'web'), { recursive: true });

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Дуга — клавиатура для одной руки', short_name: 'Дуга', lang: 'ru',
  description: 'Бесплатная клавиатура для набора одной рукой: дуга под большой палец.',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#0D1215', theme_color: '#0D1215',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 1));

// Offline: everything above is cached; pages come from the cache first and are refreshed in the
// background, so after one more visit the installed copy shows the new version.
fs.writeFileSync(path.join(out, 'sw.js'), `const CACHE = 'duga-${BUILD}';
const FILES = ${JSON.stringify(FILES.map(f => f === 'index.html' ? './' : f))};
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Пульк's pages change often and are tried on phones right after a release: network first, cache only offline
  if (u.pathname.includes('/pulk/')) { e.respondWith(caches.open(CACHE).then(c => fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => c.match(e.request, { ignoreSearch: true })))); return; }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || fresh;
  }));
});
`);
console.log('built', BUILD, fs.readdirSync(out).join(', '));
