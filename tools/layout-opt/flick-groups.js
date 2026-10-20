// Optimise which letters share a flick cell ("Флик" mode of the «Слоги» layout).
// Cost = glide ambiguity + thumb effort:
//   ambiguity: share of word usage (frequency-weighted, top N dictionary words) whose path through
//              the cells is the same as a more frequent word's (lazy glide through cell centres)
//   effort:    per typed letter, reach of the cell's ring + extra for a flick instead of a tap
//              (the most frequent letter of a cell is the tap)
// Usage: node tools/layout-opt/flick-groups.js ru|en [weight of ambiguity, default 4]
const fs = require('fs'), path = require('path');
const lang = process.argv[2] || 'ru', W_AMB = Number(process.argv[3] || 4);
const CFG = {
  ru: { alpha: 'абвгдежзийклмнопрстуфхцчшщыьэюя', fold: { 'ё': 'е', 'ъ': 'ь' }, caps: [[3, 3, 3], [3, 3, 3, 3], [4, 3, 3]] },
  en: { alpha: 'abcdefghijklmnopqrstuvwxyz', fold: {}, caps: [[3, 3, 3], [3, 3, 3], [3, 3, 2]] },
}[lang];
const RING_COST = [0, 0.35, 0.8], FLICK_COST = 0.5, TOP = 10000;
const st = JSON.parse(fs.readFileSync(path.join(__dirname, `stats_${lang}.json`)));
const freq = {}; let tot = 0;
for (const c of CFG.alpha) { freq[c] = st.uni[c] || 0; tot += freq[c]; }
for (const c in freq) freq[c] /= tot;
const L = [...CFG.alpha], li = Object.fromEntries(L.map((c, i) => [c, i]));
const words = fs.readFileSync(path.join(__dirname, '..', '..', `dict_${lang}.txt`), 'utf8').split('\n').filter(Boolean).slice(0, TOP)
  .map(w => [...w].map(c => li[CFG.fold[c] || c])).filter(a => a.every(x => x !== undefined));
const wt = words.map((_, i) => 1 / (i + 20)), wtot = wt.reduce((a, b) => a + b, 0);

const slots = []; // [ring, group index] per letter slot
CFG.caps.forEach((ring, r) => ring.forEach((n, g) => { for (let k = 0; k < n; k++) slots.push([r, `${r}.${g}`]); }));
const groupIds = [...new Set(slots.map(s => s[1]))];

function evaluate(assign) { // assign[slot] = letter index
  const gOf = new Int32Array(L.length), ringOf = new Int32Array(L.length);
  assign.forEach((l, s) => { gOf[l] = groupIds.indexOf(slots[s][1]); ringOf[l] = slots[s][0]; });
  // effort
  const best = {}; // most frequent letter per group = tap
  assign.forEach(l => { const g = gOf[l]; if (best[g] === undefined || freq[L[l]] > freq[L[best[g]]]) best[g] = l; });
  let effort = 0;
  for (let l = 0; l < L.length; l++) effort += freq[L[l]] * (RING_COST[ringOf[l]] + (best[gOf[l]] === l ? 0 : FLICK_COST));
  // ambiguity
  const seen = new Set(); let lost = 0;
  for (let i = 0; i < words.length; i++) {
    let sig = '', prev = -1;
    for (const l of words[i]) { const g = gOf[l]; if (g !== prev) { sig += String.fromCharCode(65 + g); prev = g; } }
    if (seen.has(sig)) lost += wt[i]; else seen.add(sig);
  }
  const amb = lost / wtot;
  return { cost: W_AMB * amb + effort, amb, effort };
}
function show(assign) {
  const byG = {};
  assign.forEach((l, s) => { (byG[slots[s][1]] = byG[slots[s][1]] || []).push(L[l]); });
  return CFG.caps.map((ring, r) => ring.map((_, g) => byG[`${r}.${g}`].sort((a, b) => freq[b] - freq[a]).join('')).join(' ')).join(' | ');
}
// start: letters by frequency, filled ring by ring
let cur = L.map((_, i) => i).sort((a, b) => freq[L[b]] - freq[L[a]]);
let ce = evaluate(cur), best = cur.slice(), be = ce;
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ITER = 30000;
for (let t = 0; t < ITER; t++) {
  const T = 0.02 * (1 - t / ITER) + 1e-5;
  const i = rnd() * cur.length | 0, j = rnd() * cur.length | 0;
  if (i === j || slots[i][1] === slots[j][1]) continue;
  [cur[i], cur[j]] = [cur[j], cur[i]];
  const e = evaluate(cur);
  if (e.cost < ce.cost || rnd() < Math.exp((ce.cost - e.cost) / T)) { ce = e; if (e.cost < be.cost) { be = e; best = cur.slice(); } }
  else [cur[i], cur[j]] = [cur[j], cur[i]];
}
console.log(`${lang} w=${W_AMB}: ambiguity ${(100 * be.amb).toFixed(1)}%  effort ${be.effort.toFixed(3)}`);
console.log(show(best));
module.exports = { evaluate };
