const { geometry, freqs, cost, anneal, show } = require('./fast');
const cfg = {
  ru: { alpha: 'абвгдежзийклмнопрстуфхцчшщыьэюя', vowels: 'оеаиуяыюэ', punct: 6 },
  en: { alpha: 'abcdefghijklmnopqrstuvwxyz', vowels: 'eaoiuy', punct: 8 },
};
const lang = process.argv[2], C = cfg[lang], fr = freqs(lang, C.alpha);
const cons = [...C.alpha].filter(c => !C.vowels.includes(c));
const out = [];
const options = lang === 'ru'
  ? [[10, 11, 1], [11, 10, 1], [10, 10, 2], [9, 11, 2], [11, 11, 0], [9, 10, 3]]
  : [[9, 11, 0], [10, 10, 0], [8, 10, 2], [9, 9, 2], [10, 8, 2], [8, 9, 3]];
for (const [n2, n3, nOut] of options) {
  const sizes = [C.vowels.length, n2, n3, C.punct + nOut];
  const g = geometry(sizes);
  const n1 = sizes[0];
  // initial: vowels, consonants by frequency, fillers in outer
  const byF = cons.slice().sort((a, b) => (fr.start[fr.idx[b]] + fr.end[fr.idx[b]] + fr.F.slice(fr.idx[b] * fr.m, fr.idx[b] * fr.m + fr.m).reduce((s, x) => s + x, 0)) - (fr.start[fr.idx[a]] + fr.end[fr.idx[a]] + fr.F.slice(fr.idx[a] * fr.m, fr.idx[a] * fr.m + fr.m).reduce((s, x) => s + x, 0)));
  const items = [...C.vowels, ...byF, ...Array(C.punct).fill('')];
  let best;
  for (let s = 0; s < 3; s++) { const r = anneal(g, fr, items, (i, j) => (i < n1) === (j < n1), 250000); if (!best || r.cost < best.cost) best = r; }
  out.push([best.cost, sizes.join('/'), show(sizes, best.items), best.items]);
  console.log(best.cost.toFixed(3), sizes.join('/'), show(sizes, best.items));
}
out.sort((a, b) => a[0] - b[0]);
require('fs').writeFileSync(`best_${lang}.json`, JSON.stringify(out));
