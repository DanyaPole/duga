// Offline accuracy test for swipe.js: simulated noisy swipes over the real key geometry.
// Usage: node tools/swipe-test.js [ru|en] [syl|qwerty]
require('../swipe.js');
const fs = require('fs'), path = require('path');
const { build, decode } = globalThis.DugaSwipe;
const lang = process.argv[2] || 'ru', variant = process.argv[3] || 'syl';
const D = Math.PI / 180, A0 = 91, A1 = 179, BANDS = [[158, 214], [214, 270], [270, 326], [326, 382]];
const RINGS = {
  ru: { syl: [{ row: 'эыуоаеияю' }, { row: 'ймпрвнтскль' }, { row: 'фхбгдзчжшц' }, { fixed: ['.', ',', '-', 'щ', '?', '!', ':'] }],
        qwerty: [{ row: 'ячсмитьбю' }, { row: 'фывапролджэ' }, { row: 'йцукенгшщзх' }, { fixed: ['.', ',', '-', '?', '!', ':'] }] },
  en: { syl: [{ row: 'uoaeiy' }, { row: 'fmlrdnstch' }, { row: 'qjbpvgwkxz' }, { fixed: ['.', ',', "'", '?', '!', '-', ':', '@'] }],
        qwerty: [{ row: 'zxcvbnm' }, { row: 'asdfghjkl' }, { row: 'qwertyuiop' }, { fixed: ['.', ',', "'", '?', '!', '-', ':', '@'] }] },
}[lang][variant];
const keyPos = {}, keyW = {};
RINGS.forEach((r, i) => {
  const chars = r.row ? [...r.row].reverse() : r.fixed;
  const [r0, r1] = BANDS[i], rm = (r0 + r1) / 2, span = (A1 - A0) / chars.length;
  chars.forEach((c, j) => { const a = (A0 + span * (j + .5)) * D; keyPos[c] = [rm * Math.cos(a), rm * Math.sin(a)]; keyW[c] = Math.min(r1 - r0, rm * span * D); });
});
const fold = lang === 'ru' ? { 'ё': 'е', 'ъ': 'ь' } : {};
const words = fs.readFileSync(path.join(__dirname, '..', `dict_${lang}.txt`), 'utf8').split('\n').filter(Boolean);
const t0 = Date.now(); const idx = build(words, keyPos, fold); const tb = Date.now() - t0;

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
function fakeSwipe(w, noise) { // aim at each key with gaussian error, then draw a sampled line between the aims
  const keys = []; for (const ch of w) { const k = fold[ch] || ch; if (keys[keys.length - 1] !== k) keys.push(k); }
  const aims = keys.map(k => [keyPos[k][0] + gauss() * keyW[k] * noise, keyPos[k][1] + gauss() * keyW[k] * noise]);
  const pts = [];
  for (let i = 1; i < aims.length; i++) for (let t = 0; t < 1; t += .1) pts.push(aims[i - 1][0] + t * (aims[i][0] - aims[i - 1][0]) + gauss(), aims[i - 1][1] + t * (aims[i][1] - aims[i - 1][1]) + gauss());
  pts.push(...aims[aims.length - 1]);
  return pts;
}
const sample = []; // frequency-weighted sample of real usage (Zipf), words of 2+ keys
for (let i = 0; i < 1500; i++) { const r = Math.floor(Math.exp(rnd() * Math.log(idx.words.length))) - 1; sample.push(idx.words[Math.max(0, r)]); }
const grid = process.argv[4] === 'tune';
const settings = grid ? [5, 6].flatMap(s => [0, 0.1, 0.2, 0.3].map(a => ({ sigma: s, alpha: a }))) : [{}];
for (const noise of [0.2, 0.35]) for (const o of settings) {
  let top1 = 0, top3 = 0, ms = 0;
  for (const w of sample) {
    const p = fakeSwipe(w, noise); const t = Date.now(); const r = decode(idx, p, o); ms += Date.now() - t;
    if (r[0] && r[0].w === w) top1++; if (r.slice(0, 3).some(x => x.w === w)) top3++;
  }
  console.log(`${lang}/${variant} noise ${noise} sigma ${o.sigma ?? 'def'} alpha ${o.alpha ?? 'def'}: top1 ${(100 * top1 / sample.length).toFixed(1)}%  top3 ${(100 * top3 / sample.length).toFixed(1)}%  ${(ms / sample.length).toFixed(1)} ms/swipe`);
}
console.log(`dictionary: ${idx.words.length} words, built in ${tb} ms`);
