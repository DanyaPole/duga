// Build letter + bigram stats from corpus JSON files (Wikipedia extracts).
const fs = require('fs'), path = require('path');
const dir = process.argv[2], lang = process.argv[3];
const ALPHA = { ru: 'абвгдежзийклмнопрстуфхцчшщыьэюя', en: 'abcdefghijklmnopqrstuvwxyz' }[lang];
let text = '';
for (const f of fs.readdirSync(dir).filter(f => f.startsWith(lang + '_'))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const p of Object.values(j.query.pages)) text += ' ' + (p.extract || '');
}
text = text.toLowerCase().replace(/ё/g, 'е').replace(/ъ/g, 'ь');
const set = new Set(ALPHA);
let s = '';
for (const c of text) s += set.has(c) ? c : ' ';
s = s.replace(/ +/g, ' ');
const uni = {}, bi = {};
for (let i = 0; i < s.length; i++) {
  uni[s[i]] = (uni[s[i]] || 0) + 1;
  if (i) { const k = s[i - 1] + s[i]; bi[k] = (bi[k] || 0) + 1; }
}
const N = s.length;
fs.writeFileSync(path.join(__dirname, `stats_${lang}.json`), JSON.stringify({ N, uni, bi }));
const top = Object.entries(uni).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c === ' ' ? '␣' : c}${(100 * n / N).toFixed(1)}`);
console.log(lang, 'chars', N); console.log(top.join(' '));
const tb = Object.entries(bi).filter(([k]) => !k.includes(' ')).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => `${k}${(100 * n / N).toFixed(2)}`);
console.log(tb.join(' '));
