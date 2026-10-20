// Build the GitHub Pages site into _site/: wrap duga.html in a full HTML document (the Claude artifact
// host adds this skeleton itself) and copy the files it loads.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, '_site');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const page = fs.readFileSync(path.join(root, 'duga.html'), 'utf8');
const head = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<meta name="color-scheme" content="light dark">\n' + // the page has its own dark theme
  '<meta name="darkreader-lock">\n' + // so the Dark Reader extension leaves its colours alone
  '<title>Клавиатура Дуга</title>\n' +
  '<meta name="description" content="Бесплатная клавиатура для набора одной рукой: дуга под большой палец.">\n' +
  // same reset as the artifact host: the page fits the screen between the phone's system bars
  '<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n' +
  '</head>\n<body>\n';
fs.writeFileSync(path.join(out, 'index.html'), head + page + '\n</body>\n</html>\n');
for (const f of ['swipe.js', 'dict_ru.txt', 'dict_en.txt']) fs.copyFileSync(path.join(root, f), path.join(out, f));
console.log('built', fs.readdirSync(out).join(', '));
