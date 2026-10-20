// Thumb-effort model for Duga layouts + simulated annealing.
const fs = require('fs'), path = require('path');
const D = Math.PI / 180, A0 = 91, A1 = 179;
const BANDS = [[158, 214], [214, 270], [270, 326], [326, 382]];
const STRAIN = 0.6; // bits per ring-depth beyond the comfort middle (r=242)
const SPACE = { r0: 100, r1: 158, a0: 91 + 88 * 1.15 / 4.75, a1: 91 + 88 * 3.75 / 4.75 };

function slots(sizes) { // sizes per ring -> [{ring, idx, r, a, w}]
  const out = [];
  sizes.forEach((n, ring) => {
    const [r0, r1] = BANDS[ring], rm = (r0 + r1) / 2, span = 88 / n;
    for (let i = 0; i < n; i++) {
      const a = A0 + span * (i + .5);
      out.push({ ring, idx: i, r: rm, a, w: Math.min(r1 - r0, rm * span * D), x: rm * Math.cos(a * D), y: rm * Math.sin(a * D) });
    }
  });
  return out;
}
function distToSpace(p) { // shortest distance from a key centre to the space sector
  const r = Math.hypot(p.x, p.y), a = Math.atan2(p.y, p.x) / D;
  const ac = Math.min(Math.max(a, SPACE.a0), SPACE.a1), rc = Math.min(Math.max(r, SPACE.r0), SPACE.r1);
  return Math.hypot(p.x - rc * Math.cos(ac * D), p.y - rc * Math.sin(ac * D));
}
const fitts = (d, w) => Math.log2(1 + d / w);
const strain = p => Math.max(0, (p.r - 242) / 56) * STRAIN;

function makeModel(lang) {
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, `stats_${lang}.json`)));
  return st;
}
// layout: { sizes, items: array of chars per slot ('' = punctuation filler) }
function cost(st, sizes, items) {
  const S = slots(sizes), pos = {};
  items.forEach((c, i) => { if (c) pos[c] = S[i]; });
  let tot = 0, n = 0;
  for (const [k, f] of Object.entries(st.bi)) {
    const a = k[0], b = k[1];
    let c;
    if (b === ' ') { if (a === ' ') continue; c = fitts(distToSpace(pos[a]), 58); }
    else {
      const pb = pos[b];
      if (a === ' ') c = fitts(distToSpace(pb), pb.w) + strain(pb);
      else { const pa = pos[a]; c = fitts(Math.hypot(pa.x - pb.x, pa.y - pb.y), pb.w) + strain(pb); }
    }
    tot += f * c; n += f;
  }
  return tot / n; // mean index of difficulty per keystroke, bits
}
// arrange a ring string the way the page does: freq (centre-out), row (reversed), fixed
function ringItems(spec) {
  if (spec.freq) {
    const ch = [...spec.freq], n = ch.length, c = (n - 1) / 2;
    const sl = [...Array(n).keys()].sort((a, b) => Math.abs(a - c) - Math.abs(b - c) || a - b);
    const out = Array(n); sl.forEach((s, i) => out[s] = ch[i]); return out;
  }
  if (spec.row) return [...spec.row].reverse();
  return spec.fixed.map(c => /\p{L}/u.test(c) ? c : '');
}
function fromSpec(rings) { return { sizes: rings.map(r => ringItems(r).length), items: rings.flatMap(ringItems) }; }

function anneal(st, sizes, items, canSwap, iters = 200000, T0 = 0.05) {
  let cur = items.slice(), cc = cost(st, sizes, cur), best = cur.slice(), bc = cc;
  const n = cur.length;
  for (let t = 0; t < iters; t++) {
    const T = T0 * (1 - t / iters) + 1e-5;
    const i = Math.random() * n | 0, j = Math.random() * n | 0;
    if (i === j || cur[i] === cur[j] || !canSwap(i, j, cur)) continue;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    const c = cost(st, sizes, cur);
    if (c < cc || Math.random() < Math.exp((cc - c) / T)) { cc = c; if (c < bc) { bc = c; best = cur.slice(); } }
    else [cur[i], cur[j]] = [cur[j], cur[i]];
  }
  return { items: best, cost: bc };
}
function show(sizes, items) {
  let k = 0;
  return sizes.map(n => { const r = items.slice(k, k + n).map(c => c || '·').join(''); k += n; return r; }).join(' | ');
}
module.exports = { cost, fromSpec, anneal, show, slots, makeModel, ringItems };
