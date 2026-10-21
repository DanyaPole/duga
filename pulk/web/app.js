// Пульк в браузере: the star of «Пульс» on the page and «Говорить» — for a phone where Пульк cannot be the system
// keyboard (iPhone). Geometry, recogniser and word matching are the Android app's (Pulse.kt, Words.kt), in base
// units around the thumb's corner; phrases and lessons come from the app's sources through data.js.
(function () {
  'use strict';
  var D = window.PULK, DEG = Math.PI / 180;
  var $ = function (id) { return document.getElementById(id); };
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : 0; }
  // localStorage, read once per key: screens ask for the same lists on every keystroke
  var memo = Object.create(null);
  var store = {
    get: function (k, d) {
      if (k in memo) return memo[k];
      var v = d; try { var s = localStorage.getItem('pulk.' + k); if (s != null) v = JSON.parse(s); } catch (e) {}
      return (memo[k] = v);
    },
    set: function (k, v) { memo[k] = v; try { localStorage.setItem('pulk.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---- the star (as Pulse.kt) ----
  var R = 96, PAD = 158, OUTER = 300, P_MIN = 16, P_TURN = 14, HOLD_MS = 420;
  var PH = [262 * Math.cos(135 * DEG), 262 * Math.sin(135 * DEG)];
  var KINDS = ['c', 'l', 'r', 'b'];
  var SPOT = { c: [52, 0], l: [86, 14], r: [86, -14], b: [24, 0] };
  var ALT = { 'е': 'ё', 'ь': 'ъ', '?': '!', '.': '…', '-': '—' };
  var lang = 'ru', symbols = false, shiftOnce = false;
  function table() { return symbols ? D.SYM : (lang === 'ru' ? D.RU : D.EN); }
  function spot(p, k) { var s = SPOT[k], a = (p * 45 + s[1]) * DEG; return [PH[0] + s[0] * Math.cos(a), PH[1] + s[0] * Math.sin(a)]; }
  function petalOf(x, y) { return ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8; }
  function slot(t, p, kind) { var i = KINDS.indexOf(kind), v = t[p][i]; return v ? { petal: p, kind: kind, v: v } : { petal: p, kind: 'c', v: t[p][0] }; }
  var SPACE = { petal: -1, kind: 's', v: ' ' };
  function tap(t, x, y) {
    var d = Math.hypot(x - PH[0], y - PH[1]);
    if (d < 15 || d > R + 10) return SPACE;
    var best = null, bd = 1e9;
    for (var p = 0; p < 8; p++) for (var i = 0; i < 4; i++) { if (!t[p][i]) continue; var s = spot(p, KINDS[i]), dd = Math.hypot(x - s[0], y - s[1]); if (dd < bd) { bd = dd; best = { petal: p, kind: KINDS[i], v: t[p][i] }; } }
    return best;
  }
  function resolve(t, pts) {
    var ox = pts[0], oy = pts[1], n = pts.length / 2;
    function px(i) { return pts[2 * i] - ox; } function py(i) { return pts[2 * i + 1] - oy; }
    var far = 0, fi = 0;
    for (var i = 1; i < n; i++) { var d = Math.hypot(px(i), py(i)); if (d > far) { far = d; fi = i; } }
    if (far < P_MIN) return tap(t, ox, oy);
    var ex = px(n - 1), ey = py(n - 1), endD = Math.hypot(ex, ey);
    if (far >= 24 && endD < far * 0.5) return slot(t, petalOf(px(fi), py(fi)), 'b');
    var l = endD || 1, nx = -ey / l, ny = ex / l, dev = 0, ci = 0;
    for (var j = 1; j < n - 1; j++) { var dj = Math.abs(px(j) * nx + py(j) * ny); if (dj > dev) { dev = dj; ci = j; } }
    if (dev >= Math.max(7, 0.14 * l)) {
      var cx = px(ci), cy = py(ci), dt = Math.atan2(ey - cy, ex - cx) - Math.atan2(cy, cx);
      dt = Math.atan2(Math.sin(dt), Math.cos(dt));
      if (Math.abs(dt) >= 130 * DEG) return slot(t, petalOf(cx, cy), 'b');
      if (Math.abs(dt) >= 30 * DEG && Math.hypot(ex - cx, ey - cy) >= P_TURN) return slot(t, petalOf(cx, cy), dt > 0 ? 'l' : 'r');
    }
    return slot(t, petalOf(ex, ey), 'c');
  }
  // service keys: the corner is space and ⏎, ⌫ up the right edge, the rare keys along the bottom edge; 🔊 says it
  var KEYS = [
    { fn: 'space', r0: 30, r1: PAD, a0: 91, a1: 150 }, { fn: 'enter', r0: 30, r1: PAD, a0: 150, a1: 179 },
    { fn: 'bksp', r0: PAD, r1: OUTER, a0: 91, a1: 110 },
    { fn: 'shift', r0: PAD, r1: 194, a0: 160, a1: 179 }, { fn: 'lang', r0: 194, r1: 230, a0: 160, a1: 179 },
    { fn: 'sym', r0: 230, r1: 266, a0: 160, a1: 179 }, { fn: 'say', r0: 266, r1: OUTER, a0: 160, a1: 179 },
  ];
  function hit(x, y) {
    var r = Math.max(Math.hypot(x, y), 30), a = Math.atan2(y, x) / DEG; if (a < 0) a += 360;
    if (r >= PAD && (r >= OUTER || (a >= 110 && a < 160))) return null;
    a = Math.min(Math.max(a, 91.01), 178.99);
    for (var i = 0; i < KEYS.length; i++) { var k = KEYS[i]; if (r >= k.r0 && (r < k.r1 || k.r1 === OUTER) && a >= k.a0 && a < k.a1) return k; }
    return null;
  }

  // ---- drawing the keyboard ----
  var svg = $('kbd'), NS = 'http://www.w3.org/2000/svg';
  var left = store.get('hand', 'right') === 'left';
  var W = 0, H = 0, VH = 0, K = 1, CX = 0, CY = 0, C = {};
  function mx(x) { return left ? W - x : x; }
  function scr(bx, by) { return [mx(CX + bx * K), CY - by * K]; }
  function toBase(px, py) { return [(mx(px) - CX) / K, (CY - py) / K]; }
  function xy(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var a in attrs) e.setAttribute(a, attrs[a]); (parent || svg).appendChild(e); return e; }
  function arcPts(r0, r1, a0, a1) {
    var pts = [], steps = Math.max(2, Math.round((a1 - a0) / 3));
    for (var i = 0; i <= steps; i++) { var a = (a0 + (a1 - a0) * i / steps) * DEG; pts.push(scr(r1 * Math.cos(a), r1 * Math.sin(a))); }
    for (var j = steps; j >= 0; j--) { var b = (a0 + (a1 - a0) * j / steps) * DEG; pts.push(scr(r0 * Math.cos(b), r0 * Math.sin(b))); }
    return pts.map(xy).join(' ');
  }
  // colours are read once per layout (and when the phone switches light/dark), not on every frame
  function readColours() {
    var cs = getComputedStyle(document.documentElement);
    ['ink', 'muted', 'accent', 'on-accent', 'petal', 'press', 'zone', 'line', 'glass'].forEach(function (n) { C[n] = cs.getPropertyValue('--' + n).trim(); });
  }
  var petals = [], labels = [], keyEls = {}, bubble, bubbleText, trail, lit = -2, labelsKey = '', relayout = false;
  var guide = { path: null, dot: null, pts: null, len: 0, raf: 0, t0: 0, target: -1 };
  function layout(force) {
    if (touch) { relayout = true; return; }   // never move the star under a finger mid-stroke
    if (!force && W === window.innerWidth && VH === window.innerHeight) return;
    W = window.innerWidth; VH = window.innerHeight; readColours();
    // the big star takes more of the screen: more room for a thumb that does not land precisely
    var big = store.get('bigStar', false);
    K = Math.min(Math.min(W, big ? 520 : 440) / (OUTER * (big ? 0.98 : 1.047)), (W - 2) / OUTER, VH * (big ? 0.5 : 0.42) / (OUTER + 4));
    K = Math.max(K, 0.3);   // a page opened hidden reports no height: never draw the star inside out
    H = Math.ceil(OUTER * K + 4); CX = W + 4; CY = H + 4;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
    svg.innerHTML = ''; petals = []; labels = []; keyEls = {}; lit = -2; labelsKey = '';
    var fs = Math.max(K, 0.85);
    KEYS.forEach(function (k) {
      var poly = el('polygon', { points: arcPts(k.r0 + 3, k.r1 - 3, k.a0 + 0.8, k.a1 - 0.8), fill: C.glass, stroke: C.line, 'stroke-width': 1, 'stroke-linejoin': 'round' });
      var m = (k.r0 + k.r1) / 2, am = (k.a0 + k.a1) / 2 * DEG, p = scr(m * Math.cos(am), m * Math.sin(am));
      keyEls[k.fn] = { poly: poly, text: el('text', { x: p[0], y: p[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: C.ink, 'font-size': 16 * fs, 'font-weight': 600 }) };
    });
    for (var p = 0; p < 8; p++) {
      var g = 1.6 / R / DEG, gi = 1.6 / 18 / DEG, pts = [];
      for (var i = 0; i <= 8; i++) { var a = (p * 45 - 22.5 + g + (45 - 2 * g) * i / 8) * DEG; pts.push(scr(PH[0] + (R - 1) * Math.cos(a), PH[1] + (R - 1) * Math.sin(a))); }
      for (var j = 8; j >= 0; j--) { var b = (p * 45 - 22.5 + gi + (45 - 2 * gi) * j / 8) * DEG; pts.push(scr(PH[0] + 18 * Math.cos(b), PH[1] + 18 * Math.sin(b))); }
      petals.push(el('polygon', { points: pts.map(xy).join(' '), fill: C.petal, stroke: C.line, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    }
    for (var pp = 0; pp < 8; pp++) for (var kk = 0; kk < 4; kk++) {
      var q = scr.apply(null, spot(pp, KINDS[kk]));
      labels.push({ p: pp, i: kk, el: el('text', { x: q[0], y: q[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: kk === 0 ? C.ink : C.muted,
        'font-size': (kk === 0 ? 24 : kk === 3 ? 12 : 15) * fs, 'font-weight': kk === 0 ? 700 : 400 }) });
    }
    var c = scr(PH[0], PH[1]);
    el('circle', { cx: c[0], cy: c[1], r: 13 * K, fill: C.accent });
    trail = el('polyline', { points: '', fill: 'none', stroke: C.accent, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 });
    guide.path = el('polyline', { points: '', fill: 'none', stroke: C.accent, 'stroke-width': 3, 'stroke-dasharray': '6 7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.7, visibility: 'hidden' });
    guide.dot = el('circle', { cx: 0, cy: 0, r: 12 * fs, fill: C.accent, stroke: C['on-accent'], 'stroke-width': 3, visibility: 'hidden' });
    bubble = el('circle', { cx: c[0], cy: c[1], r: 26, fill: C.accent, visibility: 'hidden' });
    bubbleText = el('text', { x: c[0], y: c[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: C['on-accent'], 'font-size': 30, 'font-weight': 800, visibility: 'hidden' });
    paintLabels();
    showGuide(guided ? guided.word[guided.i] : null);
  }
  function caps() { return shiftOnce || !text || /[.!?…]\s$/.test(text) || /\n$/.test(text); }
  function paintLabels() {
    var up = caps() && !symbols, key = up + lang + symbols;
    if (key === labelsKey) return;
    labelsKey = key;
    var t = table();
    labels.forEach(function (l) { var s = t[l.p][l.i] || ''; l.el.textContent = up ? s.toUpperCase() : s; });
    var lab = { space: lang === 'ru' ? 'пробел' : 'space', enter: '⏎', bksp: '⌫', shift: '⇧', lang: lang.toUpperCase(), sym: symbols ? 'абв' : '?123', say: '🔊' };
    for (var f in keyEls) keyEls[f].text.textContent = lab[f];
  }
  // the lit petal changes a few times per stroke, not on every move: only then are the petals repainted
  function light(p, force) {
    if (p === lit && !force) return;
    lit = p;
    petals.forEach(function (e, i) {
      e.setAttribute('fill', i === p ? C.press : i === guide.target ? C.zone : C.petal);
      e.setAttribute('stroke', i === guide.target ? C.accent : C.line); e.setAttribute('stroke-width', i === guide.target ? 2.5 : 1);
    });
  }

  // ---- the guide: a dot that runs the needed stroke on the star, again and again, until the finger repeats it ----
  function strokeFor(ch) { var t = table(); for (var p = 0; p < 8; p++) for (var i = 0; i < 4; i++) if (t[p][i] === ch) return { p: p, i: i, kind: KINDS[i] }; return null; }
  function guidePts(p, kind) {
    var a = p * 45 * DEG, dx = Math.cos(a), dy = Math.sin(a), out = [[0, 0]];
    if (kind === 'c') out.push([dx * 80, dy * 80]);
    else if (kind === 'b') out.push([dx * 62, dy * 62], [dx * 14, dy * 14]);
    else { var b = a + (kind === 'l' ? 1 : -1) * Math.PI / 2; out.push([dx * 55, dy * 55], [dx * 55 + Math.cos(b) * 36, dy * 55 + Math.sin(b) * 36]); }
    return out.map(function (q) { return scr(PH[0] + q[0], PH[1] + q[1]); });
  }
  function showGuide(ch) {
    cancelAnimationFrame(guide.raf); guide.raf = 0;
    labels.forEach(function (l) { l.el.setAttribute('fill', l.i === 0 ? C.ink : C.muted); });
    var f = ch && strokeFor(ch);
    if (!f || !guide.path) {
      guide.target = -1;
      if (guide.path) { guide.path.setAttribute('visibility', 'hidden'); guide.dot.setAttribute('visibility', 'hidden'); }
      light(-1, true); return;
    }
    guide.target = f.p; guide.pts = guidePts(f.p, f.kind); guide.len = 0;
    for (var i = 1; i < guide.pts.length; i++) guide.len += Math.hypot(guide.pts[i][0] - guide.pts[i - 1][0], guide.pts[i][1] - guide.pts[i - 1][1]);
    guide.path.setAttribute('points', guide.pts.map(xy).join(' '));
    guide.path.setAttribute('visibility', 'visible');
    labels.forEach(function (l) { if (l.p === f.p && l.i === f.i) l.el.setAttribute('fill', C.accent); });
    light(-1, true); guide.t0 = performance.now();
    (function tick(now) {
      var run = 1300, rest = 700, u = ((now - guide.t0) % (run + rest)) / run;
      if (touch || u > 1) guide.dot.setAttribute('visibility', 'hidden');
      else {
        var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, d = e * guide.len;
        for (var i = 1; i < guide.pts.length; i++) {
          var a = guide.pts[i - 1], b = guide.pts[i], sl = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (d <= sl || i === guide.pts.length - 1) { var k = sl ? Math.min(d / sl, 1) : 0; guide.dot.setAttribute('cx', a[0] + (b[0] - a[0]) * k); guide.dot.setAttribute('cy', a[1] + (b[1] - a[1]) * k); break; }
          d -= sl;
        }
        guide.dot.setAttribute('visibility', 'visible');
      }
      guide.raf = requestAnimationFrame(tick);
    })(guide.t0);
  }

  // ---- words (as Words.kt): a letter may differ from the typed one only the way star strokes get confused —
  // the same petal with another gesture, or the neighbouring petal with the same gesture. Frequency decides. ----
  function fold(s) { return s.replace(/ё/g, 'е'); }
  function shape(w, typed) {
    if (typed.length > 1 && typed === typed.toUpperCase() && typed !== typed.toLowerCase()) return w.toUpperCase();
    return typed[0] && typed[0] !== typed[0].toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w;
  }
  function Words(list, t) {
    var words = [], folded = [], byFirst = Object.create(null), rank = Object.create(null), pos = Object.create(null);
    list.forEach(function (w) {
      w = w.trim().toLowerCase(); if (!w) return;
      var f = fold(w), i = words.length; words.push(w); folded.push(f);
      (byFirst[f[0]] || (byFirst[f[0]] = [])).push(i); if (!(f in rank)) rank[f] = i;
    });
    for (var p = 0; p < 8; p++) for (var k = 0; k < 4; k++) { var c = t[p][k]; if (c && c.length === 1) pos[c] = p * 4 + k; }
    if ('е' in pos) pos['ё'] = pos['е']; if ('ь' in pos) pos['ъ'] = pos['ь'];
    var NEAR = Object.create(null);
    Object.keys(pos).forEach(function (a) {
      NEAR[a] = Object.create(null);
      Object.keys(pos).forEach(function (b) {
        var pa = pos[a], pb = pos[b], d = ((pa >> 2) - (pb >> 2) + 8) % 8;
        if ((pa >> 2) === (pb >> 2) || ((pa & 3) === (pb & 3) && (d === 1 || d === 7))) NEAR[a][b] = true;
      });
    });
    function near(a, b) { var m = NEAR[a]; return !!(m && m[b]); }
    function allowance(n) { return n <= 2 ? 0 : n <= 5 ? 1 : 2; }
    var miss = 0;
    // rank: a dictionary index (its frequency order), or for the person's own words a count given as -count;
    // own words weigh more than in the app's keyboard: in a conversation, one's names and words come first
    function score(t, w, allow, rank) {
      if (w.length < t.length) return NaN;
      var m = 0;
      for (var j = 0; j < t.length; j++) { var a = t[j], b = w[j]; if (a === b) continue; if (!near(a, b) || ++m > allow) return NaN; }
      miss = m; var rest = w.length - t.length;
      return (rank >= 0 ? Math.log(rank + 20) : Math.log(20 - 400 / rank)) + m * 3 + rest * 0.12 + (rest === 0 ? -1 : 0);
    }
    function firsts(c, allow) { var out = []; if (byFirst[c]) out.push(byFirst[c]); if (allow > 0) for (var f in byFirst) if (f !== c && near(c, f)) out.push(byFirst[f]); return out; }
    this.known = function (w, user) { var f = fold(w.toLowerCase()); return f in rank || own(user, f) >= 2; };
    this.suggest = function (typed, n, user) {
      var t = fold(typed.toLowerCase()), best = [], allow = allowance(t.length);
      function offer(key, word, sc) {
        if (best.length === n && sc >= best[n - 1].sc) return;
        for (var i = 0; i < best.length; i++) if (best[i].key === key) { if (sc < best[i].sc) best.splice(i, 1); else return; break; }
        best.push({ key: key, word: word, sc: sc }); best.sort(function (a, b) { return a.sc - b.sc; }); if (best.length > n) best.pop();
      }
      firsts(t[0], allow).forEach(function (idx) { for (var i = 0; i < idx.length; i++) { var sc = score(t, folded[idx[i]], allow, idx[i]); if (sc === sc) offer(folded[idx[i]], words[idx[i]], sc); } });
      for (var w in user) { var cnt = user[w]; if (cnt >= 1) { var sc = score(t, w, allow, -cnt); if (sc === sc) offer(w, w, sc); } }
      return best.map(function (b) { return shape(b.word, typed); });
    };
    this.correction = function (typed, user) {
      if (typed.length < 2 || this.known(typed, user)) return null;
      var t = fold(typed.toLowerCase()), allow = allowance(t.length), best = null;
      function consider(w, rank, original) {
        if (w.length !== t.length) return;
        var sc = score(t, w, allow, rank); if (sc !== sc || miss === 0) return;
        if (!best || sc < best.sc) best = { word: original, sc: sc };
      }
      firsts(t[0], allow).forEach(function (idx) { for (var i = 0; i < idx.length; i++) consider(folded[idx[i]], idx[i], words[idx[i]]); });
      for (var w in user) if (user[w] >= 2) consider(w, -user[w], w);
      return best && shape(best.word, typed);
    };
  }
  var dicts = {}, next = Object.create(null);
  function loadDict(l) {
    if (dicts[l]) return;
    dicts[l] = 'loading';
    fetch('../../dict_' + l + '.txt').then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { dicts[l] = new Words(t.split(/\r?\n/), l === 'ru' ? D.RU : D.EN); paintChips(); })
      .catch(function () { dicts[l] = null; });
  }
  loadDict('ru');
  fetch('next_ru.txt').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
    t.split(/\r?\n/).forEach(function (l) { var i = l.indexOf('\t'); if (i > 0) next[l.slice(0, i)] = l.slice(i + 1).split(' '); });
  }).catch(function () {});
  function words() { var w = dicts[lang]; return w && w !== 'loading' && !symbols ? w : null; }
  // what this person says: their words are known to suggestions (and never "corrected"), their word pairs come first
  function userWords() { return store.get('user', {}); }
  function learnText(t) {
    var ws = fold(t.toLowerCase()).split(/[^\p{L}'-]+/u).filter(Boolean); if (!ws.length) return;
    var u = userWords(), pr = store.get('pairs', {}), prev = '^', fresh = 0;
    ws.forEach(function (w) {
      if (w.length >= 2) { if (!own(u, w)) fresh++; u[w] = own(u, w) + 1; }
      var m = own(pr, prev) || (pr[prev] = {}); m[w] = own(m, w) + 1; prev = w;
    });
    var keys = Object.keys(u);
    if (keys.length > 3000) keys.sort(function (a, b) { return u[a] - u[b]; }).slice(0, keys.length - 3000).forEach(function (k) { delete u[k]; });
    store.set('user', u); store.set('pairs', pr); return fresh;
  }
  function nextWords(prev) {
    var p = fold(prev), out = [], mine = own(store.get('pairs', {}), p) || {};
    Object.keys(mine).filter(function (w) { return mine[w] >= 2; }).sort(function (a, b) { return mine[b] - mine[a]; }).forEach(function (w) { if (out.indexOf(w) < 0) out.push(w); });
    (next[p] || []).forEach(function (w) { if (out.indexOf(w) < 0) out.push(w); });
    if (!out.length) out = (next['^'] || []).slice();
    return out.slice(0, 3);
  }
  function currentWord() { var m = /[\p{L}']+$/u.exec(text); return m ? m[0] : ''; }
  function wordChips() {
    var w = currentWord(), W = words();
    if (w.length) {
      if (!W) return [];
      var f = fold(w.toLowerCase());
      return W.suggest(w, 4, userWords()).filter(function (s) { return fold(s.toLowerCase()) !== f; }).slice(0, 3);
    }
    if (!text || /\s$/.test(text)) {
      if (lang !== 'ru' || symbols) return [];
      var prev = /([\p{L}']+)\s*$/u.exec(text), key = !text.trim() || /[.!?…]\s*$/.test(text) || !prev ? '^' : prev[1].toLowerCase();
      return nextWords(key).map(function (s) { return caps() ? s[0].toUpperCase() + s.slice(1) : s; });
    }
    return [];
  }

  // ---- typing ----
  var text = '', onEnter = null, lastFix = null;
  function render() {
    var t = $('text'); if (!t) return;
    t.textContent = text; var c = document.createElement('span'); c.className = 'caret'; t.appendChild(c);
    if (guided) { var rest = guided.word.slice(guided.i), r = document.createElement('span'); r.className = 'rest'; r.textContent = caps() ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest; t.appendChild(r); }
    paintLabels(); chipsSoon();
  }
  var chipsFrame = 0;
  function chipsSoon() { if (!chipsFrame) chipsFrame = requestAnimationFrame(function () { chipsFrame = 0; paintChips(); }); }
  function typeLetter(v) { tick(); lastFix = null; text += caps() && !symbols ? v.toUpperCase() : v; shiftOnce = false; render(); }
  // a finished word that is not a word, but is one stroke-slip away from a word, is corrected; ⌫ right after undoes it
  // which letters are hard for this hand: the game brings them more often
  function missed(ch) { ch = ch.toLowerCase(); var st = store.get('letters', {}), v = own(st, ch) || [0, 0]; v[1]++; st[ch] = v; store.set('letters', st); }
  function fixLastWord() {
    var w = currentWord(), W = words(); if (guided || !W || w.length < 2) return null;
    var c = W.correction(w, userWords());
    if (!c || c === w) return null;
    for (var i = 0; i < c.length; i++) if (fold(c[i].toLowerCase()) !== fold(w[i].toLowerCase())) missed(c[i]);
    var before = text; text = text.slice(0, text.length - w.length) + c; return { before: before, word: w };
  }
  function space() {
    var fix = fixLastWord();
    text += ' '; lastFix = fix && { undo: fix.before + ' ', at: text, word: fix.word };
    render(); sayWord();
  }
  function backspace() {
    if (lastFix && text === lastFix.at) { text = lastFix.undo; var u = userWords(), f = fold(lastFix.word.toLowerCase()); u[f] = Math.max(2, own(u, f) + 1); store.set('user', u); lastFix = null; render(); return; }
    lastFix = null; text = text.slice(0, -1); render();
  }
  function takeWord(s) { lastFix = null; var w = currentWord(); text = text.slice(0, text.length - w.length) + s + ' '; render(); sayWord(); }
  // a guided word: only the letter the guide shows is typed; a different one is not an error — the dot shows again,
  // and after three tries Пульк types it itself, so nobody gets stuck on the first steps
  var guided = null;
  function guidedStroke(t) {
    if (t.key) { guide.t0 = performance.now(); return; }   // a service key is not a try: just show the way again
    var want = guided.word[guided.i], s = resolve(table(), t.pts);
    if (s.petal >= 0 && s.v === want) { guided.note(''); return nextGuided(want); }
    missed(want);
    if (++guided.miss >= 3) { guided.note('Я помог с буквой «' + want + '». Дальше — ты.'); return nextGuided(want); }
    guided.note(s.petal >= 0 ? 'Это «' + s.v + '». Нужна «' + want + '» — веди пальцем, как бежит точка.' : 'Веди пальцем по звезде, как бежит точка.');
    guide.t0 = performance.now();
  }
  function nextGuided(ch) {
    typeLetter(ch); guided.i++; guided.miss = 0;
    if (guided.i < guided.word.length) { showGuide(guided.word[guided.i]); render(); return; }
    var g = guided; guided = null; showGuide(null); render(); g.done();
  }

  // ---- «Толчки» (as Pulse.kt): a whole word without lifting the finger. One touch is cut into jabs — from home
  // out towards a petal and back; each return home is a letter; lifting the finger ends the word with a space ----
  var JAB_OUT = 14, JAB_HOME = 10, JAB_SHORT = 30;
  function Jabs(ax, ay) { this.ax = ax; this.ay = ay; this.cur = []; this.far = 0; this.settling = false; this.hx = 0; this.hy = 0; this.best = 0; }
  Jabs.prototype.add = function (x, y) {
    if (this.settling) {   // after a jab the finger is still coming back: home settles where it comes closest to the old home
      var d0 = Math.hypot(x - this.hx, y - this.hy);
      if (d0 <= this.best + 0.8) { if (d0 < this.best) this.best = d0; this.ax = x; this.ay = y; return null; }
      this.settling = false;
    }
    var d = Math.hypot(x - this.ax, y - this.ay);
    if (!this.cur.length) { if (d < JAB_OUT) return null; this.cur.push(this.ax, this.ay); }
    this.cur.push(x, y); if (d > this.far) this.far = d;
    if (d < Math.max(JAB_HOME, this.far * 0.4)) {
      var r = this.cur; this.cur = []; this.far = 0;
      this.settling = true; this.hx = this.ax; this.hy = this.ay; this.best = d; this.ax = x; this.ay = y;
      return r;
    }
    return null;
  };
  Jabs.prototype.finish = function () { if (!this.cur.length) return null; var r = this.cur; this.cur = []; this.far = 0; return r; };
  // the letter of one jab: its way out decides, as a «Пульс» stroke would (straight, or with a turn)
  function jab(t, pts) {
    var ox = pts[0], oy = pts[1], n = pts.length / 2, far = 0, fi = 1;
    for (var i = 1; i < n; i++) { var d = Math.hypot(pts[2 * i] - ox, pts[2 * i + 1] - oy); if (d > far) { far = d; fi = i; } }
    var s = resolve(t, pts.slice(0, (fi + 1) * 2));
    if (s.petal < 0 || s.kind === 'b') s = slot(t, petalOf(pts[2 * fi] - ox, pts[2 * fi + 1] - oy), 'c');
    if (s.kind === 'c' && far < JAB_SHORT) s = slot(t, s.petal, 'b');
    return s;
  }
  function jabsOn() { return store.get('mode', 'pulse') === 'jabs' && !guided && !game; }

  // ---- touch on the keyboard ----
  var touch = null;
  function point(e) { var r = svg.getBoundingClientRect(); return toBase(e.clientX - r.left, e.clientY - r.top); }
  svg.addEventListener('pointerdown', function (e) {
    e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (x) {}
    if (touch) return;   // one thumb: a second finger is ignored
    var b = point(e);
    touch = { id: e.pointerId, key: hit(b[0], b[1]), pts: [b[0], b[1]], trail: [xy(scr(b[0], b[1]))], still: Date.now(), ax: b[0], ay: b[1], shown: '' };
    if (!touch.key && jabsOn()) touch.jabs = new Jabs(b[0], b[1]);
    if (touch.key && touch.key.fn === 'bksp' && !guided) { backspace(); touch.rep = setTimeout(function rep() { backspace(); if (touch) touch.rep = setTimeout(rep, 70); }, 450); }
    keepAwake();
  });
  svg.addEventListener('pointermove', function (e) {
    if (!touch || touch.id !== e.pointerId || touch.key) return;
    var b = point(e);
    if (touch.jabs) {
      var done = touch.jabs.add(b[0], b[1]);
      if (done) { typeLetter(jab(table(), done).v); light(-1); trail.setAttribute('points', ''); bubble.setAttribute('visibility', 'hidden'); bubbleText.setAttribute('visibility', 'hidden'); touch.shown = ''; return; }
      var cur = touch.jabs.cur; if (!cur.length) return;
      var js = jab(table(), cur), pts = [];
      for (var i = 0; i < cur.length; i += 2) pts.push(xy(scr(cur[i], cur[i + 1])));
      light(js.petal); trail.setAttribute('points', pts.join(' '));
      var jshown = caps() && !symbols ? js.v.toUpperCase() : js.v;
      if (jshown !== touch.shown) { touch.shown = jshown; bubbleText.textContent = jshown; bubble.setAttribute('visibility', 'visible'); bubbleText.setAttribute('visibility', 'visible'); }
      return;
    }
    touch.pts.push(b[0], b[1]); touch.trail.push(xy(scr(b[0], b[1])));
    if (Math.hypot(b[0] - touch.ax, b[1] - touch.ay) > 4) { touch.ax = b[0]; touch.ay = b[1]; touch.still = Date.now(); }
    var s = resolve(table(), touch.pts);
    light(s.petal);
    trail.setAttribute('points', touch.trail.join(' '));
    var shown = s.petal < 0 ? '·' : (Date.now() - touch.still > HOLD_MS && ALT[s.v] ? ALT[s.v] : s.v);
    if (caps() && !symbols) shown = shown.toUpperCase();
    if (shown !== touch.shown) { touch.shown = shown; bubbleText.textContent = shown; }
    if (touch.trail.length === 2) { bubble.setAttribute('visibility', 'visible'); bubbleText.setAttribute('visibility', 'visible'); }
  });
  function endTouch(e, cancelled) {
    if (!touch || touch.id !== e.pointerId) return;
    var t = touch; touch = null;
    clearTimeout(t.rep); light(-1); trail.setAttribute('points', ''); bubble.setAttribute('visibility', 'hidden'); bubbleText.setAttribute('visibility', 'hidden');
    if (relayout) { relayout = false; layout(true); }
    if (cancelled) return;
    if (guided) { guidedStroke(t); return; }
    if (game && !t.key) { gameStroke(t); return; }
    if (t.jabs) { var last = t.jabs.finish(); if (last) typeLetter(jab(table(), last).v); space(); return; }
    if (t.key) {
      switch (t.key.fn) {
        case 'space': space(); break; case 'enter': if (onEnter) onEnter(); break;
        case 'shift': shiftOnce = !shiftOnce; lastFix = null; paintLabels(); break;
        case 'lang': lang = lang === 'ru' ? 'en' : 'ru'; symbols = false; lastFix = null; loadDict(lang); render(); break;
        case 'sym': symbols = !symbols; lastFix = null; render(); break;
        case 'say': say(text.trim() || lastSaid); break;
      }
      return;
    }
    var s = resolve(table(), t.pts);
    if (s.petal < 0) { space(); return; }
    var n = t.pts.length, held = Date.now() - t.still > HOLD_MS && Math.hypot(t.pts[n - 2] - t.pts[0], t.pts[n - 1] - t.pts[1]) >= P_MIN;
    typeLetter(held && ALT[s.v] ? ALT[s.v] : s.v);
  }
  svg.addEventListener('pointerup', function (e) { endTouch(e, false); });
  svg.addEventListener('pointercancel', function (e) { endTouch(e, true); });

  // ---- phrases: own first, then history, the ready ones and the day's; a few first letters (or the first letters
  // of words: «ск ст») bring a whole phrase ----
  function norm(s) { return fold(s.toLowerCase()).trim(); }
  function completePhrase(typed) {
    var t = norm(typed); if (t.length < 2) return [];
    var all = [], seen = Object.create(null);
    [mine(), history(), D.situations.reduce(function (a, s) { return a.concat(s[1]); }, []), D.day.reduce(function (a, d) { return a.concat(d[2]); }, []), D.quick]
      .forEach(function (list) { list.forEach(function (p) { var k = norm(p); if (!seen[k]) { seen[k] = 1; all.push(p); } }); });
    var starts = all.filter(function (p) { var n = norm(p); return n.indexOf(t) === 0 && n !== t; });
    var pieces = t.split(' ').filter(Boolean);
    var byWords = pieces.length < 2 ? [] : all.filter(function (p) {
      if (starts.indexOf(p) >= 0) return false;
      var ws = norm(p).split(/[^\p{L}]+/u).filter(Boolean), w = 0;
      return pieces.every(function (pc) { while (w < ws.length && ws[w].indexOf(pc) !== 0) w++; if (w === ws.length) return false; w++; return true; });
    });
    return starts.concat(byWords).slice(0, 3);
  }

  // the row above the tabs: the screen's main action (under the thumb, never scrolled away), whole phrases, words
  var chipMode = 'speak', chipAction = null;
  function chip(label, cls, fn) { var b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; return b; }
  function paintChips() {
    var box = $('chips'); box.innerHTML = ''; if (!$('text')) return;
    if (chipAction && (!chipAction.ifText || text.trim())) box.appendChild(chip(chipAction.label, 'main', chipAction.fn));
    if (guided) return;
    var shown = Object.create(null);
    if (chipMode === 'speak') completePhrase(text).forEach(function (p) { shown[norm(p)] = 1; box.appendChild(chip(p, '', function () { text = p; sayAll(); })); });
    wordChips().forEach(function (s) { if (!shown[norm(s)]) box.appendChild(chip(s, '', function () { takeWord(s); })); });
  }

  // «пульк» on every letter: a short soft drop, heard without looking (there is no vibration on iPhone)
  var audio = null, drop = null;
  function tick() {
    if (!store.get('tick', true) || store.get('calm', false)) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!audio) {
        audio = new AC(); var sr = audio.sampleRate, n = Math.round(0.09 * sr); drop = audio.createBuffer(1, n, sr);
        var d = drop.getChannelData(0), ph = 0;
        for (var i = 0; i < n; i++) { var t = i / sr, f = 420 + 700 * (1 - Math.exp(-t / 0.02)); ph += 2 * Math.PI * f / sr; d[i] = Math.sin(ph) * (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.03) * 0.25; }
      }
      if (audio.state === 'suspended') audio.resume();
      var src = audio.createBufferSource(); src.buffer = drop; src.connect(audio.destination); src.start();
    } catch (e) {}
  }

  // ---- the voice ----
  var lastSaid = '', utter = null;
  function rate() { return store.get('rate', 1); }
  function voices(ru) { return window.speechSynthesis ? speechSynthesis.getVoices().filter(function (x) { return x.lang && x.lang.toLowerCase().indexOf(ru ? 'ru' : 'en') === 0; }) : []; }
  function say(t, word) {
    t = (t || '').trim(); if (!t || !window.speechSynthesis) return;
    if (!word) lastSaid = t;
    var ss = speechSynthesis, ru = /[а-яё]/i.test(t) || !/[a-z]/i.test(t);
    var u = new SpeechSynthesisUtterance(t), vs = voices(ru), chosen = store.get('voice', '');
    u.lang = ru ? 'ru-RU' : 'en-US'; u.rate = store.get('calm', false) ? Math.min(rate(), 0.9) : rate(); u.pitch = store.get('pitch', 1);
    u.voice = vs.filter(function (x) { return x.name === chosen; })[0] || vs[0] || null;
    utter = u;   // Safari may drop an utterance nobody holds on to
    // Safari can swallow a phrase spoken right after cancel(): cancel only what is still going, and give it a moment
    if (ss.speaking || ss.pending) { ss.cancel(); setTimeout(function () { if (utter === u) ss.speak(u); }, 60); } else ss.speak(u);
  }
  // «Говорить по словам»: each finished word is said at once, so the person beside follows the phrase as it grows
  function sayWord() { if (tab !== 'speak' || guided || !store.get('words', false)) return; var m = /([\p{L}\p{N}-]+) $/u.exec(text); if (m) say(m[1], true); }
  // the screen stays on during a conversation: while one types an answer, the partner waits, and so must the phone
  var wake = null;
  function keepAwake() {
    if (tab !== 'speak' || wake || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    wake = 'asking';
    navigator.wakeLock.request('screen').then(function (w) {
      if (tab !== 'speak') { w.release(); wake = null; return; }
      wake = w; w.addEventListener('release', function () { if (wake === w) wake = null; });
    }).catch(function () { wake = null; });
  }
  function letSleep() { if (wake && wake.release) wake.release(); wake = null; }
  document.addEventListener('visibilitychange', keepAwake);
  function history() { return store.get('phrases', []); }
  function remember(t) { t = t.trim(); store.set('phrases', [t].concat(history().filter(function (p) { return norm(p) !== norm(t); })).slice(0, 200)); logSaid(learnText(t) || 0); }
  // the conversation: what the child said and what the adult wrote, in turns, kept on this phone
  function talk(who, t) { t = (t || '').trim(); if (!t) return; var l = store.get('talk', []); l.push({ w: who, t: t, at: Date.now() }); store.set('talk', l.slice(-100)); }
  var talking = false;
  function sayAll() {
    var fix = fixLastWord(); if (fix) lastFix = null;   // a slip in the last word is fixed before it is said aloud
    var t = text.trim(); if (!t) return;
    say(t); remember(t); text = ''; lastFix = null;
    if (tab === 'speak') { talk('me', t); if (talking) talkScreen(); else speakScreen(true); } else render();
  }
  function showBig(t) { t = t || lastSaid || ''; var b = $('bigText'); b.textContent = t; b.style.fontSize = (t.length < 16 ? 60 : t.length < 50 ? 42 : 30) + 'px'; $('big').style.display = 'flex'; }
  var afterBig = null;
  $('flip').onclick = function () { $('big').classList.toggle('flip'); };
  $('back').onclick = function () { $('big').style.display = 'none'; var f = afterBig; afterBig = null; if (f) f(); };

  // ---- the pond ----
  function drops() { return store.get('drops', 0); }
  function addDrop() { store.set('drops', drops() + 1); return drops(); }

  // ---- screens ----
  var tab = 'speak';
  function btn(label, cls, fn) { return chip(label, cls, fn); }
  function h(tag, txt, cls) { var e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; }
  function row(cls) { var r = document.createElement('div'); r.className = cls || 'row'; return r; }
  function dots(n, at, label) { var d = h('div', '', 'dots'), b = document.createElement('b'); for (var i = 0; i < n; i++) b.textContent += i < at ? '●' : i === at ? '◉' : '○'; d.appendChild(b); d.appendChild(document.createTextNode(label)); return d; }
  function textBox(hint) { var t = document.createElement('div'); t.id = 'text'; t.setAttribute('data-hint', hint); return t; }
  function field(value, placeholder, onInput, multi) {
    var f = document.createElement(multi ? 'textarea' : 'input'); if (multi) f.rows = 3; else f.type = 'text';
    f.value = value; f.placeholder = placeholder; f.oninput = function () { onInput(f.value); }; return f;
  }
  function begin(mode) {   // every screen starts clean: no guide, no game, no leftover action or Enter
    talking = false; game = null; document.body.classList.remove('talking');
    var s = $('screen'); s.innerHTML = ''; chipMode = mode || 'none'; chipAction = null; onEnter = null; guided = null; showGuide(null); return s;
  }

  // «Говорить». Made for a conversation with the people close by: answers first, a choice the adult offers,
  // the phrase being typed, then phrases. Everything for the adult is on its own screen.
  function mine() { return store.get('mine', []); }
  function aboutMe() { return store.get('about', ''); }
  // «Сейчас»: phrases for this part of the day (as Phrases.now in the app)
  function dayNow() { var hr = new Date().getHours(), part = D.day[D.day.length - 1]; D.day.forEach(function (d) { if (hr >= d[1]) part = d; }); return ['Сейчас · ' + part[0], part[2]]; }
  // the family's own: words with photos (names, pets, favourite things) and the adult's own phrase groups
  function family() { return store.get('family', []); }
  function groups() { return store.get('groups', []); }
  function photoOf(word) { var n = norm(word), f = family().filter(function (x) { return norm(x.w) === n; })[0]; return f && f.img; }
  function situations() {
    var out = [];
    if (mine().length) out.push(['Мои', mine()]);
    if (family().length) out.push(['Семья', family()]);
    groups().forEach(function (g) { if (g.list.length) out.push([g.name, g.list, g]); });
    out.push(dayNow());
    return calm() ? out : out.concat(D.situations);   // calm: only one's own and the moment's phrases
  }
  function calm() { return store.get('calm', false); }
  function photoButton(label, img, cls, fn) {
    var b = btn('', cls, fn);
    if (img) { var i = document.createElement('img'); i.src = img; i.alt = ''; b.appendChild(i); b.classList.add('pic'); }
    b.appendChild(document.createTextNode(label)); return b;
  }
  var sitName = null;
  function speakScreen(top) {
    var s = begin('speak'); if (top === true) s.scrollTop = 0;
    // a choice the adult offered: big, first, said with one touch; a family photo shows on its option
    var ch = store.get('choice', null);
    if (ch && ch.opts && ch.opts.length) {
      var card = h('div', '', 'card choice');
      if (ch.q) card.appendChild(h('div', ch.q, 'cq'));
      var cg = row('choices');
      ch.opts.forEach(function (o, i) {
        cg.appendChild(photoButton((ch.picked === i ? '✓ ' : '') + o, photoOf(o), ch.picked === i ? 'main' : '', function () { say(o); remember(o); talk('me', o); ch.picked = i; store.set('choice', ch); speakScreen(); }));
      });
      card.appendChild(cg);
      card.appendChild(btn('Готово — убрать выбор', 'wide quiet', function () { store.set('choice', null); speakScreen(true); }));
      s.appendChild(card);
    }
    var g = row('answers');
    D.quick.forEach(function (p) { g.appendChild(btn(p.split(',')[0], '', function () { say(p); logSaid(0); talk('me', p); })); });
    s.appendChild(g);
    var cats = row('scroll'), list = document.createElement('div'), r0 = row();
    if (aboutMe()) { var am = btn('Про меня', 'main', function () { say(aboutMe()); showBig(aboutMe()); }); am.style.flex = '1'; r0.appendChild(am); }
    var ur = btn('Срочно', 'urgent', function () { sitName = 'Срочно'; paintSit(); list.scrollIntoView({ block: 'nearest' }); });
    ur.style.flex = '1'; r0.appendChild(ur);
    var tk = btn('💬 Разговор', '', talkScreen); tk.style.flex = '1'; r0.appendChild(tk);
    s.appendChild(r0);
    s.appendChild(textBox('Печатай звездой — я скажу'));
    var r = row();
    r.appendChild(btn('Сказать', 'main', sayAll)); r.appendChild(btn('Показать', '', function () { showBig(text.trim()); }));
    r.appendChild(btn('★ В мои', '', function () {
      var t = text.trim() || lastSaid; if (!t) return;
      store.set('mine', [t].concat(mine().filter(function (p) { return norm(p) !== norm(t); })).slice(0, 60)); sitName = 'Мои'; text = ''; speakScreen(true);
    }));
    r.appendChild(btn('Стереть', '', function () { text = ''; lastFix = null; render(); }));
    s.appendChild(r);
    s.appendChild(h('h2', 'Фразы'));
    s.appendChild(cats); s.appendChild(list);
    function paintSit() {
      var all = situations(), names = all.map(function (x) { return x[0]; });
      if (names.indexOf(sitName) < 0) sitName = names.indexOf('Семья') >= 0 ? 'Семья' : dayNow()[0];   // the family first, else «Сейчас»
      if (sitName === 'Срочно' && names.indexOf('Срочно') < 0) sitName = names[0];
      var cur = all[names.indexOf(sitName)] || all.concat([D.situations.filter(function (x) { return x[0] === 'Срочно'; })[0]])[all.length];
      cats.innerHTML = ''; list.innerHTML = '';
      all.forEach(function (x) { cats.appendChild(btn((x[0] === sitName ? '✓ ' : '') + x[0], x[0] === sitName ? 'main' : '', function () { sitName = x[0]; paintSit(); })); });
      if (cur[0] === 'Семья') {
        var tiles = row('tiles');
        cur[1].forEach(function (f) { tiles.appendChild(photoButton(f.w, f.img, '', function () { say(f.w); remember(f.w); talk('me', f.w); })); });
        list.appendChild(tiles); return;
      }
      cur[1].forEach(function (p) {
        var line = row('line');
        line.appendChild(btn(p, 'wide', function () { say(p); remember(p); talk('me', p); }));
        if (cur[0] === 'Мои') line.appendChild(btn('✕', 'x', function () { store.set('mine', mine().filter(function (q) { return q !== p; })); paintSit(); }));
        list.appendChild(line);
      });
    }
    paintSit();
    if (!calm()) {
      s.appendChild(h('h2', 'Сказано'));
      var hist = history().slice(0, 8);
      if (!hist.length) s.appendChild(h('p', 'Здесь появятся сказанные фразы — касание повторит.', 'muted'));
      hist.forEach(function (p) { s.appendChild(btn('↻ ' + p, 'wide', function () { say(p); talk('me', p); })); });
    }
    s.appendChild(h('h2', 'Для взрослого'));
    var ar = row();
    ar.appendChild(btn('Предложить выбор', '', function () { adultScreen('choice'); }));
    ar.appendChild(btn('Настройки и помощь', '', function () { adultScreen(); }));
    s.appendChild(ar);
    if (!calm()) s.appendChild(h('p', 'Звезда: прямой смах — крупная буква, смах с поворотом — мелкая снаружи, «туда и обратно» — у центра, касание в центре — пробел. ⏎ — сказать, 🔊 — ещё раз. Промахи звезды Пульк поправит сам; ⌫ сразу после — вернуть как было. Работает и без интернета, если страница открывалась хотя бы раз.', 'muted'));
    onEnter = sayAll; chipAction = { label: 'Сказать', fn: sayAll, ifText: true }; render(); keepAwake();
  }

  // «Разговор»: the child's phrases and the adult's, in turns, big — the adult can write a question too: many
  // autistic children follow written words more easily than spoken ones, and the feed shows whose turn it is
  function talkScreen() {
    var s = begin('speak'); talking = true; document.body.classList.add('talking');
    var top = row();
    top.appendChild(btn('← Говорить', '', function () { speakScreen(true); }));
    top.appendChild(btn('Новый разговор', 'quiet', function () { store.set('talk', []); talkScreen(); }));
    s.appendChild(top);
    var feed = h('div', '', 'feed'), list = store.get('talk', []).slice(-40), lastDay = '';
    if (!list.length) feed.appendChild(h('p', 'Здесь будет разговор по очереди: вопросы взрослого — слева, ответы — справа, крупно. Касание повторяет фразу вслух.', 'muted'));
    list.forEach(function (m) {
      var d = new Date(m.at), day = d.toDateString();
      if (day !== lastDay) { lastDay = day; feed.appendChild(h('div', d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }), 'day')); }
      var b = btn(m.t, 'bubble ' + (m.w === 'me' ? 'me' : 'you'), function () { say(m.t, m.w !== 'me'); });
      feed.appendChild(b);
    });
    s.appendChild(feed);
    var ar = row('line'), ask = '';
    var af = field('', 'Взрослый: вопрос или ответ', function (v) { ask = v; });
    af.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } };
    function send() { if (!ask.trim()) return; talk('you', ask); talkScreen(); }
    ar.appendChild(af); ar.appendChild(btn('→', 'main x', send));
    s.appendChild(ar);
    var g = row('scroll');
    D.quick.forEach(function (p) { g.appendChild(btn(p.split(',')[0], '', function () { say(p); logSaid(0); talk('me', p); talkScreen(); })); });
    s.appendChild(g);
    s.appendChild(textBox('Ответ — звездой'));
    onEnter = sayAll; chipAction = { label: 'Сказать', fn: sayAll, ifText: true }; render(); keepAwake();
    s.scrollTop = s.scrollHeight;
  }

  function toggle(label, key, def, after) {
    var b = btn('', 'wide', function () { store.set(key, !store.get(key, def)); paint(); if (after) after(); });
    function paint() { var on = store.get(key, def); b.textContent = (on ? '✓ ' : '') + label; b.className = on ? 'main wide' : 'wide'; }
    paint(); return b;
  }
  function voiceControls(s) {
    var vr = row(), st = row(), pt = row(); s.appendChild(vr); s.appendChild(st); s.appendChild(pt);
    function paintVoices() {
      vr.innerHTML = ''; var vs = voices(true), cur = store.get('voice', '') || (vs[0] && vs[0].name);
      if (!vs.length) vr.appendChild(h('p', 'Русский голос не найден. На iPhone: Настройки → Универсальный доступ → Устная речь → Голоса → Русский.', 'muted'));
      if (vs.length > 1) vs.forEach(function (v) { vr.appendChild(btn((v.name === cur ? '✓ ' : '') + v.name.replace(/\s*\(.*\)$/, ''), v.name === cur ? 'main' : '', function () { store.set('voice', v.name); paintVoices(); say('Привет! Это мой голос.', true); })); });
    }
    function choices(box, key, def, list, phrase) {
      box.innerHTML = '';
      list.forEach(function (x) { var on = store.get(key, def) === x[1]; box.appendChild(btn((on ? '✓ ' : '') + x[0], on ? 'main' : '', function () { store.set(key, x[1]); choices(box, key, def, list, phrase); say(phrase, true); })); });
    }
    paintVoices();
    choices(st, 'rate', 1, [['Медленно', 0.8], ['Обычно', 1], ['Быстро', 1.3]], 'Так я говорю.');
    // a higher pitch sounds younger: phones have no children's voices, this is the closest a page can get
    choices(pt, 'pitch', 1, [['Голос обычный', 1], ['Моложе', 1.3]], 'Привет! Это мой голос.');
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { if (vr.isConnected) paintVoices(); };
  }
  function handButtons() {
    var r = row('pair');
    [['Правая', false], ['Левая', true]].forEach(function (x) {
      r.appendChild(btn((left === x[1] ? '✓ ' : '') + x[0], left === x[1] ? 'main' : '', function () {
        left = x[1]; store.set('hand', left ? 'left' : 'right'); layout(true);
        var n = r.children; for (var i = 0; i < n.length; i++) { var on = i === (left ? 1 : 0); n[i].className = on ? 'main' : ''; n[i].textContent = (on ? '✓ ' : '') + (i ? 'Левая' : 'Правая'); }
      }));
    });
    return r;
  }
  // a photo from the camera or the gallery, made small and square: it lives in this browser's storage
  function pickPhoto(done) {
    var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
    f.onchange = function () {
      var file = f.files && f.files[0]; if (!file) return;
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var c = document.createElement('canvas'), n = 160, side = Math.min(img.width, img.height); c.width = c.height = n;
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, n, n);
        URL.revokeObjectURL(url); done(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = function () { URL.revokeObjectURL(url); };
      img.src = url;
    };
    f.click();
  }

  // the first visit: a calm page before the keyboard — the hand, the voice, a name; then a lesson or straight to speaking
  function welcomeScreen() {
    document.body.classList.add('welcome');
    var s = begin(); s.scrollTop = 0;
    var top = h('div', '', 'hello'), img = document.createElement('img'); img.src = '../icon.png'; img.alt = '';
    top.appendChild(img); var tt = document.createElement('div'); tt.appendChild(h('h1', 'Пульк'));
    tt.appendChild(h('p', 'Печатай одним пальцем — телефон скажет вслух.', 'note')); top.appendChild(tt);
    s.appendChild(top);

    var c1 = h('div', '', 'card'); s.appendChild(c1);
    c1.appendChild(h('h2', '1. Какой рукой?'));
    c1.appendChild(h('p', 'Клавиатура встанет под большой палец этой руки.', 'note'));
    c1.appendChild(handButtons());

    var c2 = h('div', '', 'card'); s.appendChild(c2);
    c2.appendChild(h('h2', '2. Голос'));
    c2.appendChild(h('p', 'Включите звук и послушайте. Так телефон будет говорить ваши слова.', 'note'));
    c2.appendChild(btn('🔊 Послушать', 'main wide', function () { say('Привет! Это мой голос. Я скажу всё, что ты напечатаешь.', true); }));
    voiceControls(c2);

    var c3 = h('div', '', 'card'); s.appendChild(c3);
    c3.appendChild(h('h2', '3. Как тебя зовут?'));
    c3.appendChild(h('p', 'Можно пропустить. Из имени получится карточка «Про меня» — её можно показать незнакомым.', 'note'));
    var name = '';
    c3.appendChild(field('', 'Имя', function (v) { name = v.trim(); }));

    function start(where) {
      if (name && !aboutMe()) store.set('about', 'Меня зовут ' + name + '. Я не говорю, но всё понимаю. Я отвечу на телефоне — подождите, пожалуйста.');
      store.set('welcomed', true); document.body.classList.remove('welcome');
      document.querySelector('#tabs button[data-tab="' + where + '"]').click();
    }
    s.appendChild(btn('Начать с урока — 3 минуты', 'main wide', function () { start('lesson'); }));
    s.appendChild(btn('Сразу говорить', 'wide', function () { start('speak'); }));
    s.appendChild(btn('Я взрослый рядом с ребёнком: как помочь', 'wide quiet', function () { parentsScreen(welcomeScreen); }));
    var tip = 'Всё это можно поменять потом: «Говорить» → «Настройки и помощь». Набранное остаётся на телефоне.';
    if (navigator.standalone === false) tip += ' Чтобы открывать как приложение: «Поделиться» → «На экран „Домой“».';
    s.appendChild(h('p', tip, 'muted'));
  }

  // the week, kept on this phone only: phrases said and new words, so the adult sees that it grows
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function logSaid(newWords) {
    var log = store.get('log', {}), k = today(), v = log[k] || [0, 0];
    v[0]++; v[1] += newWords; log[k] = v;
    var keys = Object.keys(log); if (keys.length > 60) delete log[keys[0]];
    store.set('log', log);
  }
  function week() {
    var log = store.get('log', {}), said = 0, fresh = 0, days = 0;
    for (var i = 0; i < 7; i++) { var d = new Date(Date.now() - i * 864e5), v = log[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()]; if (v) { said += v[0]; fresh += v[1]; days++; } }
    return { said: said, fresh: fresh, days: days };
  }
  // one small step for today, from what has (not) been tried yet
  function todayTip() {
    if (!store.get('lessonDone', false)) return 'Сегодня — урок «Учиться», 3 минуты. Вы рядом, палец — его.';
    if (!store.get('choices', []).length) return 'Сегодня — выбор из двух: «Предложить выбор» → «сок, вода». Спросите вслух и подождите.';
    if (family().length < 3) return 'Сегодня — словарь семьи: три слова с фото (мама, любимая игрушка, питомец).';
    if (!store.get('drillsDone', {})['Просьбы']) return 'Сегодня — тренировка «Просьбы» во вкладке «Тренировки».';
    var tips = [
      'Сегодня — фразы «Близким»: покажите «Обними меня» и «Посмотри!».',
      'Сегодня — ответьте через Пульк сами: напечатайте ему короткую фразу.',
      'Сегодня — один вопрос с выбором за едой: «Что ещё положить?»',
      'Сегодня — «Про меня»: покажите, как представиться незнакомому.',
      'Сегодня — пусть он напечатает одно своё слово. Любое.',
    ];
    return tips[Math.floor(Date.now() / 864e5) % tips.length];
  }

  // the adult's screen: what to try today, the week, a choice to offer, the family's words, own phrases, settings
  function adultScreen(focus) {
    var s = begin(); s.scrollTop = 0;
    s.appendChild(btn('← Вернуться', '', function () { sitName = null; speakScreen(true); }));
    s.appendChild(h('h1', 'Для взрослого'));
    var tc = h('div', '', 'card choice'); tc.appendChild(h('div', todayTip(), 'title')); s.appendChild(tc);
    var w = week();
    s.appendChild(h('p', w.said ? 'За неделю: сказано ' + w.said + ' раз, новых слов — ' + w.fresh + ', дней с Пульком — ' + w.days + '. Всё это хранится только на этом телефоне.' : 'Здесь появится, сколько сказано за неделю. Хранится только на этом телефоне.', 'muted'));

    var ch = h('h2', 'Предложить выбор'); s.appendChild(ch);
    s.appendChild(h('p', 'Спросите вслух и напишите варианты обычной клавиатурой. Ребёнок коснётся — телефон скажет. Фото из словаря семьи появятся на кнопках сами.', 'note'));
    var q = '', opts = '';
    s.appendChild(field('', 'Вопрос, можно пусто: Что будешь пить?', function (v) { q = v; }));
    s.appendChild(field('', 'Варианты через запятую: сок, вода, молоко', function (v) { opts = v; }));
    function offer(question, list) {
      list = list.map(function (o) { o = o.trim(); return o && o[0].toUpperCase() + o.slice(1); }).filter(Boolean).slice(0, 6); if (!list.length) return;
      var c = { q: question.trim(), opts: list, picked: -1 };
      store.set('choice', c); talk('you', c.q);
      var recent = store.get('choices', []).filter(function (x) { return x.opts.join() !== c.opts.join(); });
      store.set('choices', [{ q: c.q, opts: c.opts }].concat(recent).slice(0, 8));
      tab = 'speak'; speakScreen(true);
    }
    s.appendChild(btn('Показать ребёнку', 'main wide', function () { offer(q, opts.split(/[,;\n]/)); }));
    var recent = store.get('choices', []);
    if (recent.length) {
      s.appendChild(h('p', 'Недавние — одним касанием:', 'muted'));
      recent.forEach(function (c) { s.appendChild(btn((c.q ? c.q + ' — ' : '') + c.opts.join(', '), 'wide', function () { offer(c.q, c.opts); })); });
    }

    var fh = h('h2', 'Словарь семьи'); s.appendChild(fh);
    s.appendChild(h('p', 'Имена, питомцы, любимые вещи и места — с фото, если хотите. Эти слова первыми идут в подсказках, а фото — на кнопках выбора и во вкладке «Семья».', 'note'));
    var fw = '', fimg = null, fl = h('div', '', 'tiles'), fr = row();
    var fwf = field('', 'Слово: Барсик, бабушка, качели', function (v) { fw = v.trim(); });
    var pb = btn('📷 Фото', '', function () { pickPhoto(function (d) { fimg = d; pb.textContent = '📷 Фото ✓'; }); });
    fr.appendChild(pb);
    fr.appendChild(btn('Добавить', 'main', function () {
      if (!fw) return;
      var word = fw[0].toUpperCase() + fw.slice(1), list = family().filter(function (x) { return norm(x.w) !== norm(word); });
      list.push({ w: word, img: fimg }); store.set('family', list.slice(-60));
      var u = userWords(), k = fold(word.toLowerCase()); u[k] = Math.max(own(u, k), 5); store.set('user', u);   // known and first in suggestions
      fw = ''; fimg = null; fwf.value = ''; pb.textContent = '📷 Фото'; paintFamily();
    }));
    s.appendChild(fwf); s.appendChild(fr); s.appendChild(fl);
    function paintFamily() {
      fl.innerHTML = '';
      family().forEach(function (f) {
        fl.appendChild(photoButton(f.w + ' ✕', f.img, '', function () { store.set('family', family().filter(function (x) { return x !== f; })); paintFamily(); }));
      });
      if (family().length) fl.appendChild(h('p', 'Касание по слову здесь — убрать его.', 'muted'));
    }
    paintFamily();

    s.appendChild(h('h2', 'Свои фразы по темам'));
    s.appendChild(h('p', 'Например «Школа», «Бабушка», «Перед сном». Темы появятся в «Говорить» рядом с «Мои».', 'note'));
    var gname = '', gphrase = '', gl = document.createElement('div');
    var gnf = field('', 'Тема: Школа', function (v) { gname = v.trim(); });
    var gpf = field('', 'Фраза: Можно выйти?', function (v) { gphrase = v.trim(); });
    s.appendChild(gnf); s.appendChild(gpf);
    s.appendChild(btn('Добавить фразу в тему', 'wide', function () {
      if (!gname || !gphrase) return;
      var gs = groups(), g = gs.filter(function (x) { return norm(x.name) === norm(gname); })[0];
      if (!g) { g = { name: gname[0].toUpperCase() + gname.slice(1), list: [] }; gs.push(g); }
      if (!g.list.some(function (p) { return norm(p) === norm(gphrase); })) g.list.push(gphrase);
      store.set('groups', gs); gphrase = ''; gpf.value = ''; paintGroups();
    }));
    s.appendChild(gl);
    function paintGroups() {
      gl.innerHTML = '';
      groups().forEach(function (g) {
        gl.appendChild(h('div', g.name, 'title'));
        g.list.forEach(function (p) {
          var line = row('line'); line.appendChild(h('div', p, 'grow'));
          line.appendChild(btn('✕', 'x', function () {
            var gs = groups(); gs.forEach(function (x) { if (x.name === g.name) x.list = x.list.filter(function (y) { return y !== p; }); });
            store.set('groups', gs.filter(function (x) { return x.list.length; })); paintGroups();
          }));
          gl.appendChild(line);
        });
      });
    }
    paintGroups();

    s.appendChild(h('h2', 'Про меня'));
    s.appendChild(h('p', 'То, что ребёнок покажет и скажет незнакомым одним касанием.', 'note'));
    s.appendChild(field(aboutMe(), 'Меня зовут Миша. Я не говорю, но всё понимаю. Я отвечу на телефоне — подождите, пожалуйста.', function (v) { store.set('about', v.trim()); }, true));

    s.appendChild(h('h2', 'Голос'));
    voiceControls(s);
    s.appendChild(toggle('Говорить по словам, пока печатаю', 'words', false));

    s.appendChild(h('h2', 'Способ набора'));
    s.appendChild(h('p', '«Пульс» — смах на каждую букву. «Толчки» — целое слово одним касанием: палец на звезде, толчок к букве и назад, следующая буква, поднял палец — пробел. Включайте, когда «Пульс» освоен.', 'note'));
    var mr = row('pair'); s.appendChild(mr);
    function paintMode() {
      mr.innerHTML = '';
      [['Пульс', 'pulse'], ['Толчки', 'jabs']].forEach(function (x) { var on = store.get('mode', 'pulse') === x[1]; mr.appendChild(btn((on ? '✓ ' : '') + x[0], on ? 'main' : '', function () { store.set('mode', x[1]); paintMode(); })); });
    }
    paintMode();

    s.appendChild(h('h2', 'Удобство'));
    s.appendChild(handButtons());
    s.appendChild(toggle('Крупная звезда — больше места для пальца', 'bigStar', false, function () { layout(true); }));
    s.appendChild(toggle('Звук «пульк» на каждую букву', 'tick', true));
    s.appendChild(toggle('Спокойный режим: меньше кнопок, мягче голос, без звука букв', 'calm', false));

    s.appendChild(h('h2', 'Помощь'));
    var hr = row();
    hr.appendChild(btn('Первая проверка: что заметить', '', function () { checkScreen(function () { adultScreen(); }); }));
    hr.appendChild(btn('Как помочь ребёнку', '', function () { parentsScreen(function () { adultScreen(); }); }));
    hr.appendChild(btn('Первый экран', '', welcomeScreen));
    s.appendChild(hr);
    if (focus === 'choice') setTimeout(function () { ch.scrollIntoView({ block: 'start' }); }, 0);
    render();
  }

  // «Первая проверка»: what to notice in the first ten minutes with the child, and a place for notes to send on
  var CHECK = [
    ['До начала', ['Звук включён, телефон заряжен. Пульк на экране «Домой».', 'Пройдите приветствие вместе: рука, голос, имя.', 'Добавьте 2–3 слова в словарь семьи — лучше с фото.']],
    ['Что заметить', [
      'Понял ли, куда смотреть: на точку на звезде или на текст сверху?',
      'Какую руку и какой палец берёт сам? Держит телефон или кладёт на стол?',
      'Где замер дольше 10 секунд — на каком шаге?',
      'Какие буквы получаются сразу, а где Пульк помогал («Я помог…»)?',
      'Как реагирует на голос телефона: радуется, пугается, повторяет?',
      'Что сказал сам — первое своё слово или выбор?',
      'Когда устал или отвлёкся — на какой минуте?']],
    ['После', ['Запишите заметки ниже — коротко, как есть.', 'Кнопка «Скопировать заметки» — и отправьте их тому, кто делает Пульк. Больше ничего не отправляется.']],
  ];
  function checkScreen(back) {
    var s = begin(); s.scrollTop = 0;
    s.appendChild(btn('← Вернуться', '', back));
    s.appendChild(h('h1', 'Первая проверка'));
    s.appendChild(h('p', '10 минут с ребёнком. Ничего не нужно добиваться — нужно заметить.', 'note'));
    CHECK.forEach(function (sec) {
      s.appendChild(h('h2', sec[0]));
      var ul = document.createElement('ul'); ul.className = 'tips';
      sec[1].forEach(function (x) { ul.appendChild(h('li', x)); }); s.appendChild(ul);
    });
    var notes = field(store.get('notes', ''), 'Заметки: что получилось, где замер, что понравилось…', function (v) { store.set('notes', v); }, true);
    notes.rows = 6; s.appendChild(notes);
    var w = week(), ok = h('div', '', 'ok');
    s.appendChild(btn('Скопировать заметки', 'main wide', function () {
      var t = 'Пульк, первая проверка (' + today() + ')\n' + notes.value + '\n— за неделю сказано ' + w.said + ', новых слов ' + w.fresh + ', капель ' + drops();
      function fallback() { notes.focus(); notes.select(); ok.textContent = 'Выделено — нажмите «Скопировать».'; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { ok.textContent = 'Скопировано. Вставьте в сообщение.'; }, fallback); else fallback();
    }));
    s.appendChild(ok);
    render();
  }

  // «Учимся говорить»: tiny steps, one new thing each, nothing can go wrong. Letters come with a guide on the star:
  // first one straight stroke, then a word of straight strokes, only then a stroke with a turn.
  var LESSON = [
    { t: 'Коснись «Да»', n: 'Телефон скажет «да».', kind: 'tap', want: 'Да' },
    { t: 'Теперь коснись «Нет»', kind: 'tap', want: 'Нет' },
    { t: 'Первая буква — «а»', n: 'Смотри на звезду внизу: бежит точка. Проведи пальцем так же — вверх. Начинать можно где угодно на звезде.', kind: 'guide', want: 'а' },
    { t: 'Слово «нет»', n: 'Три буквы — три движения. Точка показывает каждое.', kind: 'guide', want: 'нет' },
    { t: 'Выбери «Хочу пить»', kind: 'pick', want: 'Хочу пить' },
    { t: 'Слово «мама»', n: 'Буква «м» — с поворотом: веди вправо и в конце поверни вверх. Точка покажет.', kind: 'guide', want: 'мама' },
    { t: 'Покажи фразу маме', n: 'Нажми «Показать» — фраза станет крупной.', kind: 'show', want: 'Привет' },
    { t: 'Своё слово', n: 'Напечатай что хочешь и нажми «Сказать» — над вкладками.', kind: 'free' },
  ];
  var step = 0;
  // one letter more, less or different: still the same word
  function almost(a, b) { a = norm(a); b = norm(b); if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false; var d = 0, i = 0, j = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; }
  function lessonScreen() {
    var s = begin();
    if (step >= LESSON.length) {
      store.set('lessonDone', true);
      s.appendChild(h('h1', 'Ты умеешь говорить с Пульком'));
      s.appendChild(h('p', 'Печатай — телефон скажет. «Сказать» — над вкладками или ⏎ в углу звезды. Быстрые ответы и фразы — во вкладке «Говорить».'));
      s.appendChild(btn('Ещё раз', 'wide', function () { step = 0; lessonScreen(); }));
      s.appendChild(btn('Для взрослого рядом', 'wide', function () { parentsScreen(lessonScreen); }));
      render(); return;
    }
    var st = LESSON[step];
    s.appendChild(dots(LESSON.length, step, 'шаг ' + (step + 1) + ' из ' + LESSON.length));
    if (step === 0) {
      var pc = h('div', '', 'card');
      pc.appendChild(h('div', 'Взрослому рядом: как помочь — на одну минуту чтения.', 'muted'));
      pc.appendChild(btn('Для взрослого рядом', 'wide', function () { parentsScreen(lessonScreen); }));
      s.appendChild(pc);
    }
    s.appendChild(h('h1', st.t));
    if (st.n) s.appendChild(h('p', st.n, 'note'));
    var ok = h('div', '', 'ok'), done = false;
    function success() { if (done) return; done = true; var n = addDrop(); ok.style.color = ''; ok.textContent = 'Получилось. +1 капля — в пруду ' + n; setTimeout(function () { if (tab === 'lesson' && LESSON[step] === st) { step++; lessonScreen(); } }, 1300); }
    if (st.kind === 'tap') {
      var r = row();
      (step === 0 ? ['Да'] : ['Да', 'Нет']).forEach(function (w) { var b = btn(w, w === st.want ? 'main' : '', function () { say(w); if (w === st.want) success(); }); b.className += ' big'; r.appendChild(b); });
      s.appendChild(r);
    }
    if (st.kind === 'guide') {
      text = ''; lang = 'ru'; symbols = false; shiftOnce = false; lastFix = null;
      s.appendChild(textBox(''));
      guided = { word: st.want, i: 0, miss: 0, note: function (m) { ok.style.color = 'var(--muted)'; ok.textContent = m; }, done: function () { say(text.trim()); success(); } };
      showGuide(st.want[0]);
    }
    if (st.kind === 'free') {
      text = ''; s.appendChild(textBox('Печатай звездой'));
      onEnter = function () { fixLastWord(); var t = text.trim(); if (!t) return; say(t); remember(t); success(); };
      chipAction = { label: 'Сказать', fn: function () { onEnter(); } };
    }
    if (st.kind === 'pick') ['Хочу есть', 'Хочу пить', 'Мне холодно'].forEach(function (p) { s.appendChild(btn(p, 'wide', function () { say(p); if (p === st.want) success(); })); });
    if (st.kind === 'show') { s.appendChild(h('h1', st.want)); s.appendChild(btn('Показать', 'main wide', function () { showBig(st.want); afterBig = success; })); }
    s.appendChild(ok); render();
  }

  // «Пузыри»: a letter in a bubble; the right stroke pops it with a «пульк». No time, no losing: a bubble waits.
  // Big letters first, then the ones at the centre, then the turns; letters this hand misses come more often.
  var game = null;
  function poppedAll() { return store.get('popped', 0); }
  function gameLevel() { var n = poppedAll(); return n < 15 ? 0 : n < 40 ? 1 : 2; }
  function pool() {
    var kinds = [[0], [0, 3], [0, 3, 1, 2]][gameLevel()], out = [];
    for (var p = 0; p < 8; p++) kinds.forEach(function (k) { var c = D.RU[p][k]; if (c && /[а-я]/.test(c)) out.push(c); });
    return out;
  }
  function nextLetter(prev) {
    var st = store.get('letters', {}), ls = pool().filter(function (c) { return c !== prev; }), sum = 0;
    var ws = ls.map(function (c) { var v = own(st, c) || [0, 0], w = 1 + 3 * v[1] / (v[0] + v[1] + 1); sum += w; return w; });
    var r = Math.random() * sum;
    for (var i = 0; i < ls.length; i++) { r -= ws[i]; if (r <= 0) return ls[i]; }
    return ls[ls.length - 1];
  }
  var ROUND = 10;
  function gameScreen() {
    var s = begin(); lang = 'ru'; symbols = false; shiftOnce = false; text = '';
    var lv = gameLevel();
    game = { letter: nextLetter(''), miss: 0, n: 0, level: lv };
    s.appendChild(h('h1', 'Пузыри'));
    s.appendChild(h('p', ['Крупные буквы: прямой смах.', 'Добавились буквы у центра: туда и обратно.', 'Все буквы: и с поворотом.'][lv] + ' Пузырь ждёт — спешить некуда.', 'note'));
    var d = h('div', '', 'dots'); s.appendChild(d);
    var area = h('div', '', 'pond-area'), bub = h('div', '', 'bubble-l'); area.appendChild(bub); s.appendChild(area);
    var ok = h('div', '', 'ok'); s.appendChild(ok);
    s.appendChild(btn('К тренировкам', 'wide', function () { theme = -1; drillsScreen(); }));
    function paint() {
      d.textContent = ''; var b = document.createElement('b');
      for (var i = 0; i < ROUND; i++) b.textContent += i < game.n ? '●' : '○';
      d.appendChild(b); d.appendChild(document.createTextNode(game.n + ' из ' + ROUND));
      bub.textContent = game.letter; bub.className = 'bubble-l';
      if (game.level === 0) showGuide(game.letter); else showGuide(null);   // at first the way is shown at once
    }
    game.hit = function () {
      var st = store.get('letters', {}), v = own(st, game.letter) || [0, 0]; v[0]++; st[game.letter] = v; store.set('letters', st);
      store.set('popped', poppedAll() + 1); tick();
      bub.className = 'bubble-l pop'; ok.style.color = ''; ok.textContent = ''; game.n++; game.miss = 0;
      var g = game;
      setTimeout(function () {
        if (game !== g) return;
        if (g.n < ROUND) { g.letter = nextLetter(g.letter); paint(); return; }
        showGuide(null); game = null;
        ok.textContent = ROUND + ' пузырей! +1 капля — в пруду ' + addDrop() + (gameLevel() > g.level ? '. Дальше — новые буквы.' : '');
        area.innerHTML = ''; area.appendChild(btn('Ещё раунд', 'main wide', gameScreen));
      }, 380);
    };
    game.wrong = function (got) {
      missed(game.letter); game.miss++;
      bub.className = 'bubble-l wobble'; void bub.offsetWidth; bub.className = 'bubble-l wobble';
      ok.style.color = 'var(--muted)';
      ok.textContent = got ? 'Это «' + got + '». Пузырь «' + game.letter + '» — смотри, как бежит точка.' : 'Веди пальцем по звезде, как бежит точка.';
      showGuide(game.letter);
    };
    paint(); render();
  }
  function gameStroke(t) { var s = resolve(table(), t.pts); if (s.petal >= 0 && s.v === game.letter) game.hit(); else game.wrong(s.petal >= 0 ? s.v : ''); }

  // «Тренировки»: everyday scenes; type or choose; any answer is said
  var theme = -1, at = 0;
  function themes() { return D.themes.concat(drops() >= 15 && D.play ? [D.play] : []); }
  function fits(a, task) { if (!task.keys.length) return !!a.trim(); var n = norm(a); return task.keys.some(function (k) { return n.indexOf(norm(k)) >= 0; }) || almost(a, task.model); }
  function drillsScreen() {
    var s = begin();
    if (theme < 0) {
      s.appendChild(h('h1', 'Тренировки'));
      s.appendChild(h('p', 'Короткие жизненные ситуации. Читаешь — отвечаешь: печатаешь звездой или выбираешь. Телефон говорит ответ.', 'muted'));
      var done = store.get('drillsDone', {});
      var gc = h('div', '', 'card choice');
      gc.appendChild(h('div', 'Пузыри — игра на буквы', 'title'));
      gc.appendChild(h('div', 'Лопай пузыри смахами. Трудные буквы попадаются чаще. Без времени и без проигрыша.', 'muted'));
      gc.appendChild(btn('Играть', 'main wide', gameScreen));
      s.appendChild(gc);
      themes().forEach(function (t, i) {
        var c = h('div', '', 'card');
        c.appendChild(h('div', (done[t.title] ? '✓ ' : '') + t.title, 'title')); c.appendChild(h('div', t.about, 'muted'));
        c.appendChild(btn(done[t.title] ? 'Ещё раз' : 'Начать', 'wide', function () { theme = i; at = 0; drillsScreen(); }));
        s.appendChild(c);
      });
      if (drops() < 15) s.appendChild(h('p', 'На 15 каплях откроется тема «Игра».', 'muted'));
      render(); return;
    }
    var th = themes()[theme];
    if (at >= th.tasks.length) {
      var dd = store.get('drillsDone', {}); dd[th.title] = 1; store.set('drillsDone', dd);
      s.appendChild(h('h1', '«' + th.title + '» — получилось'));
      s.appendChild(btn('К темам', 'main wide', function () { theme = -1; drillsScreen(); })); render(); return;
    }
    var task = th.tasks[at], tries = 0, moving = false;
    s.appendChild(dots(th.tasks.length, at, th.title + ' · ' + (at + 1) + ' из ' + th.tasks.length));
    s.appendChild(h('h1', task.scene));
    text = ''; s.appendChild(textBox('Напечатай ответ звездой'));
    var ok = h('div', '', 'ok');
    function answer(a) {
      if (moving || !a.trim()) return; say(a);
      var good = fits(a, task);
      if (good || ++tries >= 2) {
        moving = true; ok.style.color = '';
        ok.textContent = good ? 'Получилось. +1 капля — в пруду ' + addDrop() : 'Можно и так: «' + task.model + '». Дальше.';
        var cur = th.tasks[at];
        setTimeout(function () { if (tab === 'drills' && themes()[theme] === th && th.tasks[at] === cur) { at++; drillsScreen(); } }, good ? 1100 : 2400);
      } else { ok.style.color = 'var(--muted)'; ok.textContent = 'Сказано «' + a + '». Можно и так: «' + task.model + '».'; }
      text = ''; render();
    }
    onEnter = function () { fixLastWord(); answer(text.trim()); };
    chipAction = { label: 'Сказать', fn: onEnter };
    s.appendChild(h('p', '…или выбери:', 'muted'));
    task.choices.forEach(function (c) { s.appendChild(btn(c, 'wide', function () { answer(c); })); });
    s.appendChild(ok); s.appendChild(btn('К темам', 'wide', function () { theme = -1; drillsScreen(); }));
    render();
  }

  // «Для взрослого рядом»: most children start with a parent beside them; a minute of reading so the help helps
  var PARENTS = [
    ['Перед началом', [
      'Включите звук. Сядьте рядом, сбоку, а не напротив: так вы видите экран так же, как ребёнок.',
      'Телефон держит ребёнок или он лежит на столе. Палец — его.',
      'Пяти минут достаточно. Заканчивайте, пока ещё интересно.']],
    ['Как помогать', [
      'Покажите движение один раз своим пальцем над звездой — и уберите руку. Не водите его пальцем: тогда это сделал не он.',
      'Подождите 5–10 секунд, прежде чем подсказывать. Тишина — время подумать.',
      'Ошибок здесь нет. Не та буква просто не печатается, а точка на звезде показывает ещё раз. После трёх попыток Пульк поможет сам.',
      'Хвалите за попытку, коротко и спокойно: «Ты напечатал». Громкая похвала многим детям неприятна.']],
    ['Первый разговор', [
      'Начните с выбора. «Говорить» → «Предложить выбор»: спросите вслух и напишите «сок, вода». Ребёнок коснётся — телефон скажет. Так разговор получается сразу, ещё до того, как буквы стали лёгкими.',
      'В «Говорить» → «Фразы» → «Близким» — слова для вас: «Я тебя люблю», «Обними меня», «Посмотри!». Покажите их: речь — это не только просьбы.',
      'Пульк поправляет промахи звезды: «маьа» станет «мама». Если поправил не так — ⌫ сразу после пробела вернёт как было, и Пульк запомнит это слово.']],
    ['Когда ребёнок говорит', [
      'Отвечайте на сказанное как на настоящие слова. Сказал «нет» — это «нет»; уважайте его, когда это возможно. Так ребёнок узнаёт, что слова работают.',
      'Не экзаменуйте («Напиши, что это»). Предлагайте настоящий выбор: «Сок или воду?»',
      'Говорите и сами через Пульк: напечатайте и скажите ребёнку что-нибудь. Он увидит, как этим пользуются, — без требования повторить.']],
    ['Если что-то не так', [
      'Устал, расстроился, отворачивается — остановитесь. Вернётесь потом: капли в пруду не пропадают.',
      'Левой рукой удобнее: «Говорить» → «Голос, «Про меня», рука».',
      'Голос звучит плохо: Настройки iPhone → Универсальный доступ → Устная речь → Голоса → Русский, скачайте улучшенный голос.',
      'Чтобы ребёнок случайно не выходил со страницы: Настройки → Универсальный доступ → Гид-доступ. Включите, откройте Пульк и трижды нажмите боковую кнопку.',
      'Добавьте Пульк на экран «Домой»: в Safari «Поделиться» → «На экран „Домой“». Без адресной строки места больше.']],
    ['Что дальше', [
      'Урок → «Тренировки» по ситуациям (просьбы, самочувствие, окружение) → «Говорить» в жизни. Каждая получившаяся фраза в уроке и тренировках — капля в пруду.',
      'Всё набранное остаётся на этом телефоне: Пульк ничего никуда не отправляет.']],
  ];
  function parentsScreen(back) {
    var s = begin(); s.scrollTop = 0;
    s.appendChild(btn('← Вернуться', '', back));
    s.appendChild(h('h1', 'Для взрослого рядом'));
    s.appendChild(h('p', 'Пульк — способ говорить: ребёнок печатает одним пальцем, телефон произносит. Заранее ничего знать не нужно.', 'note'));
    PARENTS.forEach(function (sec) {
      s.appendChild(h('h2', sec[0]));
      var ul = document.createElement('ul'); ul.className = 'tips';
      sec[1].forEach(function (x) { ul.appendChild(h('li', x)); }); s.appendChild(ul);
    });
    s.appendChild(btn('Понятно — вернуться', 'main wide', back));
    render();
  }

  function pondScreen() {
    var s = begin(), n = drops();
    s.appendChild(h('h1', 'Мой пруд'));
    s.appendChild(h('div', 'Капель: ' + n, 'ok'));
    var w = Math.min(window.innerWidth - 32, 420), hh = 200, cx = w / 2, cy = hh / 2, r = hh / 2 - 6;
    var colours = ['var(--accent)', '#4CAF7D', '#E0A030', '#8E7CC3', '#E57373'], art = '';
    for (var i = 0; i < Math.min(n, 120); i++) { var a = i * 2.39996, rr = Math.sqrt(i / 120) * (r - 10); art += '<circle cx="' + (cx + Math.cos(a) * rr * 1.4).toFixed(1) + '" cy="' + (cy + Math.sin(a) * rr).toFixed(1) + '" r="5" fill="' + (n >= 5 ? colours[i % 5] : 'var(--accent)') + '" opacity="' + (0.6 + (i * 37 % 100) / 250) + '"/>'; }
    if (n >= 30) [[-0.55, -0.35], [0.5, 0.4]].forEach(function (f) { var x = cx + f[0] * r * 1.4, y = cy + f[1] * r; art += '<ellipse cx="' + x + '" cy="' + y + '" rx="14" ry="7" fill="#E0A030"/><polygon points="' + (x + 12) + ',' + y + ' ' + (x + 24) + ',' + (y - 8) + ' ' + (x + 24) + ',' + (y + 8) + '" fill="#E0A030"/>'; });
    var glow = n >= 50 && new Date().getHours() >= 18;
    s.insertAdjacentHTML('beforeend', '<svg width="' + w + '" height="' + hh + '" aria-hidden="true"><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r * 1.4 + '" ry="' + r + '" fill="' + (glow ? 'var(--press)' : 'var(--panel)') + '" stroke="var(--line)"/>' + art + '</svg>');
    s.appendChild(h('p', 'Каждый получившийся шаг урока или тренировки — капля. Капли только копятся.', 'muted'));
    D.pond.forEach(function (m) { s.appendChild(h('div', (n >= m[0] ? '✓ ' : '○ ') + m[0] + ' капель — ' + m[1], n >= m[0] ? '' : 'muted')); });
    render();
  }

  var SCREENS = { speak: function () { speakScreen(true); }, lesson: function () { step = 0; lessonScreen(); }, drills: function () { theme = -1; drillsScreen(); }, pond: pondScreen };
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.onclick = function () {
      tab = b.dataset.tab; $('screen').scrollTop = 0; if (tab !== 'speak') letSleep();
      document.querySelectorAll('#tabs button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      SCREENS[tab]();
    };
  });
  window.addEventListener('resize', function () { layout(); });
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { layout(true); }); }
  layout(true);
  // the welcome comes once; those who already used Пульк go straight on
  if (!store.get('welcomed', false) && !store.get('lessonDone', false) && !store.get('drops', 0)) welcomeScreen();
  else document.querySelector('#tabs button[data-tab="' + (store.get('lessonDone', false) ? 'speak' : 'lesson') + '"]').click();
  // for checks on a computer
  window.PULK_WEB = { resolve: resolve, table: table, spot: spot, PH: PH, hit: hit, text: function () { return text; }, lastSaid: function () { return lastSaid; },
    words: function () { return words(); }, userWords: userWords, geo: function () { return { K: K, CX: CX, CY: CY, W: W, left: left }; } };
})();
