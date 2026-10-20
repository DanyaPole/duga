// Swipe (gesture) typing decoder for Duga.
// Each dictionary word becomes an ideal path through the centres of its keys; a finger path is
// resampled to the same number of points and compared point by point (location channel, as in
// SHARK2), plus a word-frequency prior. Coordinates are keyboard base units (k = 1), so the
// decoder does not depend on screen size.
(function (root) {
  const N = 32; // points per resampled path

  function resample(pts, n, out, off) {
    // pts: flat [x0,y0,x1,y1,...]; writes n points into out at off
    const m = pts.length / 2;
    let total = 0;
    for (let i = 1; i < m; i++) total += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
    if (m === 1 || total === 0) {
      for (let j = 0; j < n; j++) { out[off + 2 * j] = pts[0]; out[off + 2 * j + 1] = pts[1]; }
      return;
    }
    const step = total / (n - 1);
    let seg = 1, segStart = 0, segLen = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]);
    for (let j = 0; j < n; j++) {
      const d = Math.min(j * step, total);
      while (seg < m - 1 && segStart + segLen < d) {
        segStart += segLen; seg++;
        segLen = Math.hypot(pts[2 * seg] - pts[2 * seg - 2], pts[2 * seg + 1] - pts[2 * seg - 1]);
      }
      const t = segLen ? Math.min(1, (d - segStart) / segLen) : 0;
      out[off + 2 * j] = pts[2 * seg - 2] + t * (pts[2 * seg] - pts[2 * seg - 2]);
      out[off + 2 * j + 1] = pts[2 * seg - 1] + t * (pts[2 * seg + 1] - pts[2 * seg - 1]);
    }
  }

  // words: array in frequency order; keyPos: { char: [x, y] }; fold: { 'ё': 'е', ... } letters typed on another key
  function build(words, keyPos, fold) {
    const keep = [], paths = [];
    for (const w of words) {
      const keys = [];
      let ok = true;
      for (const ch of w) {
        const k = fold[ch] || ch;
        if (!keyPos[k]) { ok = false; break; }
        if (keys[keys.length - 1] !== k) keys.push(k);
      }
      if (!ok || keys.length < 2) continue;
      keep.push(w); paths.push(keys);
    }
    const tpl = new Float32Array(keep.length * N * 2);
    const ends = new Float32Array(keep.length * 4);
    const prior = new Float32Array(keep.length);
    paths.forEach((keys, i) => {
      const flat = keys.flatMap(k => keyPos[k]);
      resample(flat, N, tpl, i * N * 2);
      const a = keyPos[keys[0]], b = keyPos[keys[keys.length - 1]];
      ends.set([a[0], a[1], b[0], b[1]], i * 4);
      prior[i] = Math.log(i + 20); // Zipf: cost grows with frequency rank
    });
    return { words: keep, tpl, ends, prior };
  }

  // path: flat [x,y,...] in base units. Returns best candidates, lowest score first.
  function decode(index, path, opts = {}) {
    const sigma = opts.sigma ?? 6, alpha = opts.alpha ?? 0.3, reach = opts.reach ?? 60, k = opts.top ?? 4;
    const u = new Float32Array(N * 2);
    resample(path, N, u, 0);
    const sx = u[0], sy = u[1], ex = u[2 * N - 2], ey = u[2 * N - 1];
    const { words, tpl, ends, prior } = index;
    const best = [];
    for (let i = 0; i < words.length; i++) {
      const e = i * 4;
      if (Math.hypot(ends[e] - sx, ends[e + 1] - sy) > reach || Math.hypot(ends[e + 2] - ex, ends[e + 3] - ey) > reach) continue;
      let d = 0;
      const o = i * N * 2;
      for (let j = 0; j < 2 * N; j += 2) d += Math.hypot(tpl[o + j] - u[j], tpl[o + j + 1] - u[j + 1]);
      const score = d / N / sigma + alpha * prior[i];
      if (best.length < k || score < best[best.length - 1].score) {
        best.push({ w: words[i], score });
        best.sort((a, b) => a.score - b.score);
        if (best.length > k) best.pop();
      }
    }
    return best;
  }

  root.DugaSwipe = { N, build, decode, resample };
})(typeof window !== 'undefined' ? window : globalThis);
