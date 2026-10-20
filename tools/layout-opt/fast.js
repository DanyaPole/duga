// Fast version of the effort model: precomputed slot→slot costs and a letter bigram matrix.
const { slots, makeModel, fromSpec, show } = require('./opt');
const D = Math.PI / 180;
const SPACE = { r0: 100, r1: 158, a0: 91 + 88 * 1.15 / 4.75, a1: 91 + 88 * 3.75 / 4.75 };
const STRAIN = 0.6;
const fitts = (d, w) => Math.log2(1 + d / w);
const strain = p => Math.max(0, (p.r - 242) / 56) * STRAIN;
function distToSpace(p) {
  const r = Math.hypot(p.x, p.y), a = Math.atan2(p.y, p.x) / D;
  const ac = Math.min(Math.max(a, SPACE.a0), SPACE.a1), rc = Math.min(Math.max(r, SPACE.r0), SPACE.r1);
  return Math.hypot(p.x - rc * Math.cos(ac * D), p.y - rc * Math.sin(ac * D));
}
function geometry(sizes) {
  const S = slots(sizes), n = S.length;
  const C = new Float64Array(n * n), toSp = new Float64Array(n), fromSp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    toSp[i] = fitts(distToSpace(S[i]), 58);
    fromSp[i] = fitts(distToSpace(S[i]), S[i].w) + strain(S[i]);
    for (let j = 0; j < n; j++) C[i * n + j] = fitts(Math.hypot(S[i].x - S[j].x, S[i].y - S[j].y), S[j].w) + strain(S[j]);
  }
  return { S, n, C, toSp, fromSp };
}
function freqs(lang, alpha) {
  const st = makeModel(lang), m = alpha.length, idx = {};
  [...alpha].forEach((c, i) => idx[c] = i);
  const F = new Float64Array(m * m), end = new Float64Array(m), start = new Float64Array(m);
  let tot = 0;
  for (const [k, f] of Object.entries(st.bi)) {
    const a = k[0], b = k[1];
    if (a === ' ' && b === ' ') continue;
    tot += f;
    if (a === ' ') start[idx[b]] += f; else if (b === ' ') end[idx[a]] += f; else F[idx[a] * m + idx[b]] += f;
  }
  for (const A of [F, end, start]) for (let i = 0; i < A.length; i++) A[i] /= tot;
  return { m, idx, F, end, start, alpha };
}
// items: array per slot of a char or '' ; returns mean bits per keystroke
function cost(g, fr, items) {
  const pos = new Int32Array(fr.m).fill(-1);
  items.forEach((c, s) => { if (c) pos[fr.idx[c]] = s; });
  let t = 0; const m = fr.m, n = g.n;
  for (let a = 0; a < m; a++) {
    const pa = pos[a];
    t += fr.end[a] * g.toSp[pa] + fr.start[a] * g.fromSp[pa];
    const row = pa * n;
    for (let b = 0; b < m; b++) { const f = fr.F[a * m + b]; if (f) t += f * g.C[row + pos[b]]; }
  }
  return t;
}
function anneal(g, fr, items, canSwap, iters = 300000, T0 = 0.03) {
  let cur = items.slice(), cc = cost(g, fr, cur), best = cur.slice(), bc = cc;
  const n = cur.length;
  for (let t = 0; t < iters; t++) {
    const T = T0 * (1 - t / iters) + 1e-6;
    const i = Math.random() * n | 0, j = Math.random() * n | 0;
    if (i === j || cur[i] === cur[j] || !canSwap(i, j)) continue;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    const c = cost(g, fr, cur);
    if (c < cc || Math.random() < Math.exp((cc - c) / T)) { cc = c; if (c < bc) { bc = c; best = cur.slice(); } }
    else [cur[i], cur[j]] = [cur[j], cur[i]];
  }
  return { items: best, cost: bc };
}
module.exports = { geometry, freqs, cost, anneal, fromSpec, show };
