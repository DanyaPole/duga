// Пульк в браузере: the star of «Пульс» on the page and «Говорить» — for a phone where Пульк cannot be the system
// keyboard (iPhone). Geometry and recogniser are the Android app's (Pulse.kt), in base units around the thumb's corner.
(function () {
  'use strict';
  var D = window.PULK, DEG = Math.PI / 180;
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('pulk.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('pulk.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---- the star (as Pulse.kt) ----
  var R = 96, PAD = 158, OUTER = 300, P_MIN = 16, P_TURN = 14;
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
  var W = 0, H = 0, K = 1, CX = 0, CY = 0;
  function mx(x) { return left ? W - x : x; }
  function scr(bx, by) { return [mx(CX + bx * K), CY - by * K]; }
  function toBase(px, py) { return [(mx(px) - CX) / K, (CY - py) / K]; }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var a in attrs) e.setAttribute(a, attrs[a]); (parent || svg).appendChild(e); return e; }
  function arcPts(r0, r1, a0, a1, cxb, cyb) {
    var pts = [], steps = Math.max(2, Math.round((a1 - a0) / 3));
    for (var i = 0; i <= steps; i++) { var a = (a0 + (a1 - a0) * i / steps) * DEG; pts.push(scr(cxb + r1 * Math.cos(a), cyb + r1 * Math.sin(a))); }
    for (var j = steps; j >= 0; j--) { var b = (a0 + (a1 - a0) * j / steps) * DEG; pts.push(scr(cxb + r0 * Math.cos(b), cyb + r0 * Math.sin(b))); }
    return pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  }
  var petals = [], labels = [], keyEls = {}, bubble, bubbleText, trail;
  function layout() {
    W = window.innerWidth;
    var kd = Math.min(W, 440) / (OUTER * 1.047); kd = Math.min(kd, (W - 2) / OUTER, window.innerHeight * 0.42 / (OUTER + 4));
    K = kd; H = Math.ceil(OUTER * K + 4); CX = W + 4; CY = H + 4;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H);
    svg.innerHTML = ''; petals = []; labels = []; keyEls = {};
    var css = getComputedStyle(document.documentElement), v = function (n) { return css.getPropertyValue(n).trim(); };
    KEYS.forEach(function (k) {
      var poly = el('polygon', { points: arcPts(k.r0 + 3, k.r1 - 3, k.a0 + 0.8, k.a1 - 0.8, 0, 0), fill: v('--glass'), stroke: v('--line'), 'stroke-width': 1, 'stroke-linejoin': 'round' });
      var m = (k.r0 + k.r1) / 2, am = (k.a0 + k.a1) / 2 * DEG, p = scr(m * Math.cos(am), m * Math.sin(am));
      var t = el('text', { x: p[0], y: p[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: v('--ink'), 'font-size': 16 * Math.max(K, 0.85), 'font-weight': 600 });
      keyEls[k.fn] = { poly: poly, text: t };
    });
    for (var p = 0; p < 8; p++) {
      var g = 1.6 / R / DEG, gi = 1.6 / 18 / DEG;
      var pts = [], steps = 8;
      for (var i = 0; i <= steps; i++) { var a = (p * 45 - 22.5 + g + (45 - 2 * g) * i / steps) * DEG; pts.push(scr(PH[0] + (R - 1) * Math.cos(a), PH[1] + (R - 1) * Math.sin(a))); }
      for (var j = steps; j >= 0; j--) { var b = (p * 45 - 22.5 + gi + (45 - 2 * gi) * j / steps) * DEG; pts.push(scr(PH[0] + 18 * Math.cos(b), PH[1] + 18 * Math.sin(b))); }
      petals.push(el('polygon', { points: pts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '), fill: v('--petal'), stroke: v('--line'), 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    }
    for (var pp = 0; pp < 8; pp++) for (var kk = 0; kk < 4; kk++) {
      var s = spot(pp, KINDS[kk]), q = scr(s[0], s[1]);
      labels.push({ p: pp, i: kk, el: el('text', { x: q[0], y: q[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: kk === 0 ? v('--ink') : v('--muted'),
        'font-size': (kk === 0 ? 24 : kk === 3 ? 12 : 15) * Math.max(K, 0.85), 'font-weight': kk === 0 ? 700 : 400 }) });
    }
    var c = scr(PH[0], PH[1]);
    el('circle', { cx: c[0], cy: c[1], r: 13 * K, fill: v('--accent') });
    trail = el('polyline', { points: '', fill: 'none', stroke: v('--accent'), 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 });
    guide.path = el('polyline', { points: '', fill: 'none', stroke: v('--accent'), 'stroke-width': 3, 'stroke-dasharray': '6 7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.7, visibility: 'hidden' });
    guide.dot = el('circle', { cx: 0, cy: 0, r: 12 * Math.max(K, 0.85), fill: v('--accent'), stroke: v('--on-accent'), 'stroke-width': 3, visibility: 'hidden' });
    bubble = el('circle', { cx: c[0], cy: c[1], r: 26, fill: v('--accent'), visibility: 'hidden' });
    bubbleText = el('text', { x: c[0], y: c[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: v('--on-accent'), 'font-size': 30, 'font-weight': 800, visibility: 'hidden' });
    paintLabels();
    showGuide(guided ? guided.word[guided.i] : null);
  }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  // ---- the guide: a dot that runs the needed stroke on the star, again and again, until the finger repeats it ----
  var guide = { path: null, dot: null, pts: null, len: 0, raf: 0, t0: 0, target: -1, label: -1 };
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
    labels.forEach(function (l) { l.el.setAttribute('fill', l.i === 0 ? cssv('--ink') : cssv('--muted')); });
    var f = ch && strokeFor(ch);
    if (!f || !guide.path) { guide.target = -1; if (guide.path) { guide.path.setAttribute('visibility', 'hidden'); guide.dot.setAttribute('visibility', 'hidden'); } light(-1); return; }
    guide.target = f.p; guide.pts = guidePts(f.p, f.kind); guide.len = 0;
    for (var i = 1; i < guide.pts.length; i++) guide.len += Math.hypot(guide.pts[i][0] - guide.pts[i - 1][0], guide.pts[i][1] - guide.pts[i - 1][1]);
    guide.path.setAttribute('points', guide.pts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '));
    guide.path.setAttribute('visibility', 'visible');
    labels.forEach(function (l) { if (l.p === f.p && l.i === f.i) l.el.setAttribute('fill', cssv('--accent')); });
    light(-1); guide.t0 = performance.now();
    (function tick(now) {
      var run = 1300, rest = 700, u = ((now - guide.t0) % (run + rest)) / run;
      if (touch || u > 1) guide.dot.setAttribute('visibility', 'hidden');
      else {
        var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, d = e * guide.len, i = 1;
        for (; i < guide.pts.length; i++) { var sl = Math.hypot(guide.pts[i][0] - guide.pts[i - 1][0], guide.pts[i][1] - guide.pts[i - 1][1]); if (d <= sl || i === guide.pts.length - 1) { var k = sl ? Math.min(d / sl, 1) : 0; guide.dot.setAttribute('cx', guide.pts[i - 1][0] + (guide.pts[i][0] - guide.pts[i - 1][0]) * k); guide.dot.setAttribute('cy', guide.pts[i - 1][1] + (guide.pts[i][1] - guide.pts[i - 1][1]) * k); break; } d -= sl; }
        guide.dot.setAttribute('visibility', 'visible');
      }
      guide.raf = requestAnimationFrame(tick);
    })(guide.t0);
  }
  function caps() { return shiftOnce || !text || /[.!?…]\s$/.test(text) || /\n$/.test(text); }
  function paintLabels() {
    var t = table(), up = caps() && !symbols;
    labels.forEach(function (l) { var s = t[l.p][l.i] || ''; l.el.textContent = up ? s.toUpperCase() : s; });
    var lab = { space: lang === 'ru' ? 'пробел' : 'space', enter: '⏎', bksp: '⌫', shift: '⇧', lang: lang.toUpperCase(), sym: symbols ? 'абв' : '?123', say: '🔊' };
    for (var f in keyEls) keyEls[f].text.textContent = lab[f];
  }
  function light(p) {
    var css = getComputedStyle(document.documentElement);
    petals.forEach(function (e, i) {
      e.setAttribute('fill', css.getPropertyValue(i === p ? '--press' : i === guide.target ? '--zone' : '--petal').trim());
      e.setAttribute('stroke', css.getPropertyValue(i === guide.target ? '--accent' : '--line').trim()); e.setAttribute('stroke-width', i === guide.target ? 2.5 : 1);
    });
  }

  // ---- typing ----
  var text = '';
  function render() {
    var t = $('text'); if (!t) return;
    t.textContent = text; var c = document.createElement('span'); c.className = 'caret'; t.appendChild(c);
    if (guided) { var rest = guided.word.slice(guided.i), r = document.createElement('span'); r.className = 'rest'; r.textContent = caps() ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest; t.appendChild(r); }
    paintLabels(); paintChips();
  }
  // a guided word: only the letter the guide shows is typed; a different one is not an error — the dot shows again,
  // and after three tries Пульк types it itself, so nobody gets stuck on the first steps
  var guided = null;
  function guidedStroke(t) {
    var want = guided.word[guided.i], s = t.key ? null : resolve(table(), t.pts);
    if (s && s.petal >= 0 && s.v === want) { guided.note(''); return nextGuided(want); }
    if (++guided.miss >= 3) { guided.note('Я помог с буквой «' + want + '». Дальше — ты.'); return nextGuided(want); }
    guided.note(s && s.petal >= 0 ? 'Это «' + s.v + '». Нужна «' + want + '» — веди пальцем, как бежит точка.' : 'Веди пальцем по звезде, как бежит точка.');
    guide.t0 = performance.now();
  }
  function nextGuided(ch) {
    typeLetter(ch); guided.i++; guided.miss = 0;
    if (guided.i < guided.word.length) { showGuide(guided.word[guided.i]); render(); return; }
    var g = guided; guided = null; showGuide(null); render(); g.done();
  }
  function typeLetter(v) { text += caps() && !symbols ? v.toUpperCase() : v; shiftOnce = false; render(); }
  function space() { text += ' '; render(); sayWord(); }
  function backspace() { text = text.slice(0, -1); render(); }
  function enter() { if (onEnter) onEnter(); }
  var onEnter = null;

  // touch on the keyboard
  var touch = null;
  svg.addEventListener('pointerdown', function (e) {
    e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (x) {}
    var r = svg.getBoundingClientRect(), b = toBase(e.clientX - r.left, e.clientY - r.top);
    touch = { id: e.pointerId, key: hit(b[0], b[1]), pts: [b[0], b[1]], still: Date.now(), ax: b[0], ay: b[1] };
    if (touch.key && touch.key.fn === 'bksp') { backspace(); touch.rep = setTimeout(function rep() { backspace(); touch && (touch.rep = setTimeout(rep, 70)); }, 450); }
  });
  svg.addEventListener('pointermove', function (e) {
    if (!touch || touch.id !== e.pointerId || touch.key) return;
    var r = svg.getBoundingClientRect(), b = toBase(e.clientX - r.left, e.clientY - r.top);
    touch.pts.push(b[0], b[1]);
    if (Math.hypot(b[0] - touch.ax, b[1] - touch.ay) > 4) { touch.ax = b[0]; touch.ay = b[1]; touch.still = Date.now(); }
    var s = resolve(table(), touch.pts);
    light(s.petal);
    trail.setAttribute('points', touch.pts.reduce(function (acc, v, i) { if (i % 2) { var q = scr(touch.pts[i - 1], v); acc.push(q[0].toFixed(1) + ',' + q[1].toFixed(1)); } return acc; }, []).join(' '));
    var shown = s.petal < 0 ? '·' : (Date.now() - touch.still > 420 && ALT[s.v] ? ALT[s.v] : s.v);
    bubbleText.textContent = caps() && !symbols ? shown.toUpperCase() : shown;
    bubble.setAttribute('visibility', 'visible'); bubbleText.setAttribute('visibility', 'visible');
  });
  function endTouch(e, cancelled) {
    if (!touch || touch.id !== e.pointerId) return;
    var t = touch; touch = null;
    clearTimeout(t.rep); light(-1); trail.setAttribute('points', ''); bubble.setAttribute('visibility', 'hidden'); bubbleText.setAttribute('visibility', 'hidden');
    if (cancelled) return;
    if (guided) { guidedStroke(t); return; }
    if (t.key) {
      switch (t.key.fn) {
        case 'space': space(); break; case 'enter': enter(); break;
        case 'shift': shiftOnce = !shiftOnce; paintLabels(); break;
        case 'lang': lang = lang === 'ru' ? 'en' : 'ru'; symbols = false; paintLabels(); break;
        case 'sym': symbols = !symbols; paintLabels(); break;
        case 'say': say(text.trim() || lastSaid); break;
      }
      return;
    }
    var s = resolve(table(), t.pts);
    if (s.petal < 0) { space(); return; }
    var held = Date.now() - t.still > 420 && Math.hypot(t.pts[t.pts.length - 2] - t.pts[0], t.pts[t.pts.length - 1] - t.pts[1]) >= P_MIN;
    typeLetter(held && ALT[s.v] ? ALT[s.v] : s.v);
  }
  svg.addEventListener('pointerup', function (e) { endTouch(e, false); });
  svg.addEventListener('pointercancel', function (e) { endTouch(e, true); });

  // ---- words: suggestions and the next word (the same dictionary and table as the app) ----
  var dict = [], next = {};
  fetch('../../dict_ru.txt').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) { dict = t.split(/\r?\n/).filter(Boolean); paintChips(); }).catch(function () {});
  fetch('next_ru.txt').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
    t.split(/\r?\n/).forEach(function (l) { var i = l.indexOf('\t'); if (i > 0) next[l.slice(0, i)] = l.slice(i + 1).split(' '); });
  }).catch(function () {});
  function currentWord() { var m = /[\p{L}']+$/u.exec(text); return m ? m[0] : ''; }
  function wordChips() {
    var w = currentWord();
    if (w.length) {
      var lw = w.toLowerCase().replace(/ё/g, 'е'), out = [];
      for (var i = 0; i < dict.length && out.length < 3; i++) if (dict[i].replace(/ё/g, 'е').startsWith(lw) && dict[i] !== lw) out.push(dict[i]);
      return out.map(function (s) { return w[0] === w[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s; });
    }
    if (!text || /\s$/.test(text)) {
      var prev = /([\p{L}']+)\s*$/u.exec(text), key = !text.trim() || /[.!?…]\s*$/.test(text) ? '^' : (prev ? prev[1].toLowerCase() : '^');
      return (next[key] || next['^'] || []).slice(0, 3).map(function (s) { return caps() ? s[0].toUpperCase() + s.slice(1) : s; });
    }
    return [];
  }
  function takeWord(s) { var w = currentWord(); text = text.slice(0, text.length - w.length) + s + ' '; render(); sayWord(); }

  // phrases: own first, then ready; a few first letters (or first letters of words) bring a whole phrase
  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е').trim(); }
  function completePhrase(typed) {
    var t = norm(typed); if (t.length < 2) return [];
    var all = [], seen = {};
    mine().concat(history(), D.situations.reduce(function (a, s) { return a.concat(s[1]); }, []), D.day.reduce(function (a, d) { return a.concat(d[2]); }, []), D.quick).forEach(function (p) { var k = norm(p); if (!seen[k]) { seen[k] = 1; all.push(p); } });
    var starts = all.filter(function (p) { return norm(p).indexOf(t) === 0 && norm(p) !== t; });
    var pieces = t.split(' ').filter(Boolean);
    var byWords = pieces.length < 2 ? [] : all.filter(function (p) {
      if (starts.indexOf(p) >= 0) return false;
      var words = norm(p).split(/[^\p{L}]+/u).filter(Boolean), w = 0;
      return pieces.every(function (pc) { while (w < words.length && words[w].indexOf(pc) !== 0) w++; if (w === words.length) return false; w++; return true; });
    });
    return starts.concat(byWords).slice(0, 3);
  }

  var chipMode = 'speak', chipAction = null;
  function paintChips() {
    var box = $('chips'); box.innerHTML = ''; if (!$('text')) return;
    // the screen's main action sits here, just above the star — under the thumb, never scrolled away
    if (chipAction && (!chipAction.ifText || text.trim())) box.appendChild(btn(chipAction.label, 'main', chipAction.fn));
    if (guided) return;
    var shown = {};
    if (chipMode === 'speak') completePhrase(text).forEach(function (p) {
      shown[norm(p)] = 1; var b = document.createElement('button'); b.textContent = p;
      b.onclick = function () { text = p; render(); sayAll(); }; box.appendChild(b);
    });
    wordChips().forEach(function (s) { if (shown[norm(s)]) return; var b = document.createElement('button'); b.textContent = s; b.onclick = function () { takeWord(s); }; box.appendChild(b); });
  }

  // ---- the voice ----
  var lastSaid = '';
  function rate() { return store.get('rate', 1); }
  function voices(ru) { return window.speechSynthesis ? speechSynthesis.getVoices().filter(function (x) { return x.lang && x.lang.toLowerCase().indexOf(ru ? 'ru' : 'en') === 0; }) : []; }
  function say(t, word) {
    t = (t || '').trim(); if (!t || !window.speechSynthesis) return;
    if (!word) lastSaid = t;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(t), ru = /[а-яё]/i.test(t);
    u.lang = ru ? 'ru-RU' : 'en-US'; u.rate = rate();
    var vs = voices(ru), mine = store.get('voice', ''), v = vs.filter(function (x) { return x.name === mine; })[0] || vs[0];
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  // «Говорить по словам»: each finished word is said at once, so the person beside follows the phrase as it grows
  function sayWord() { if (tab !== 'speak' || guided || !store.get('words', false)) return; var m = /([\p{L}\p{N}-]+) $/u.exec(text); if (m) say(m[1], true); }
  // the screen stays on during a conversation: while one types an answer, the partner waits, and so must the phone
  var wake = null;
  function keepAwake() {
    if (tab !== 'speak' || wake || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    wake = 'asking';
    navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () { wake = null; });
  }
  function letSleep() { if (wake && wake.release) wake.release(); wake = null; }
  document.addEventListener('visibilitychange', keepAwake);
  function history() { return store.get('phrases', []); }
  function remember(t) { var h = history().filter(function (p) { return norm(p) !== norm(t); }); h.unshift(t.trim()); store.set('phrases', h.slice(0, 200)); }
  function sayAll() { var t = text.trim(); if (!t) return; say(t); remember(t); text = ''; render(); if (tab === 'speak') speakScreen(true); }
  function showBig(t) { t = t || lastSaid || ''; var b = $('bigText'); b.textContent = t; b.style.fontSize = (t.length < 16 ? 60 : t.length < 50 ? 42 : 30) + 'px'; $('big').style.display = 'flex'; }
  $('flip').onclick = function () { $('big').classList.toggle('flip'); };
  $('back').onclick = function () { $('big').style.display = 'none'; };

  // ---- the pond ----
  function drops() { return store.get('drops', 0); }
  function addDrop() { store.set('drops', drops() + 1); return drops(); }

  // ---- screens ----
  var tab = 'speak';
  function btn(label, cls, fn) { var b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; return b; }
  function h(tag, txt, cls) { var e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; }
  function dots(n, at, label) { var d = document.createElement('div'); d.className = 'dots'; var b = document.createElement('b'); for (var i = 0; i < n; i++) b.textContent += i < at ? '●' : i === at ? '◉' : '○'; d.appendChild(b); d.appendChild(document.createTextNode(label)); return d; }
  function textBox(hint) { var t = document.createElement('div'); t.id = 'text'; t.setAttribute('data-hint', hint); return t; }

  // what the person keeps: own phrases and «Про меня» (a card that introduces them to a stranger)
  function mine() { return store.get('mine', []); }
  function aboutMe() { return store.get('about', ''); }
  // «Сейчас»: phrases for this part of the day (as Phrases.now in the app)
  function dayNow() { var hr = new Date().getHours(), part = D.day[D.day.length - 1]; D.day.forEach(function (d) { if (hr >= d[1]) part = d; }); return ['Сейчас · ' + part[0], part[2]]; }
  function situations() { return (mine().length ? [['Мои', mine()]] : []).concat([dayNow()], D.situations); }
  var sit = null;
  function speakScreen(top) {
    var s = $('screen'); s.innerHTML = ''; if (top === true) s.scrollTop = 0; chipMode = 'speak'; chipAction = null;
    // answers first: in a conversation «да», «нет», «подожди» are needed most and fastest
    var g = document.createElement('div'); g.className = 'answers';
    D.quick.forEach(function (p) { g.appendChild(btn(p.split(',')[0], '', function () { say(p); })); });
    s.appendChild(g);
    var cats = document.createElement('div'), list = document.createElement('div'), all = situations();
    var r0 = document.createElement('div'); r0.className = 'row';
    if (aboutMe()) { var am = btn('Про меня', 'main', function () { say(aboutMe()); showBig(aboutMe()); }); am.style.flex = '1'; r0.appendChild(am); }
    var ur = btn('Срочно', 'urgent', function () { sit = situations().map(function (x) { return x[0]; }).indexOf('Срочно'); paintSit(); list.scrollIntoView({ block: 'nearest' }); });
    ur.style.flex = '1'; r0.appendChild(ur);
    s.appendChild(r0);
    s.appendChild(textBox('Печатай звездой — я скажу'));
    var r = document.createElement('div'); r.className = 'row';
    r.appendChild(btn('Сказать', 'main', sayAll)); r.appendChild(btn('Показать', '', function () { showBig(text.trim()); }));
    r.appendChild(btn('★ В мои', '', function () {
      var t = text.trim() || lastSaid; if (!t) return;
      store.set('mine', [t].concat(mine().filter(function (p) { return norm(p) !== norm(t); })).slice(0, 60)); sit = 0; text = ''; speakScreen(true);
    }));
    r.appendChild(btn('Стереть', '', function () { text = ''; render(); }));
    s.appendChild(r);
    s.appendChild(h('h2', 'Фразы'));
    cats.className = 'scroll'; s.appendChild(cats); s.appendChild(list);
    if (sit == null || sit >= all.length) sit = mine().length ? 1 : 0;   // «Сейчас» by default; own phrases are one touch left
    function paintSit() {
      all = situations(); cats.innerHTML = ''; list.innerHTML = '';
      all.forEach(function (x, i) { cats.appendChild(btn((i === sit ? '✓ ' : '') + x[0], i === sit ? 'main' : '', function () { sit = i; paintSit(); })); });
      all[sit][1].forEach(function (p) {
        var row = document.createElement('div'); row.className = 'line';
        row.appendChild(btn(p, 'wide', function () { say(p); remember(p); }));
        if (all[sit][0] === 'Мои') row.appendChild(btn('✕', 'x', function () { store.set('mine', mine().filter(function (q) { return q !== p; })); if (!mine().length) sit = 0; paintSit(); }));
        list.appendChild(row);
      });
    }
    paintSit();
    s.appendChild(h('h2', 'Сказано'));
    var hist = history().slice(0, 8);
    if (!hist.length) s.appendChild(h('p', 'Здесь появятся сказанные фразы — касание повторит.', 'muted'));
    hist.forEach(function (p) { s.appendChild(btn('↻ ' + p, 'wide', function () { say(p); })); });

    s.appendChild(h('h2', 'Голос'));
    var vr = document.createElement('div'); vr.className = 'row'; s.appendChild(vr);
    function paintVoices() {
      vr.innerHTML = ''; var vs = voices(true), cur = store.get('voice', '') || (vs[0] && vs[0].name);
      if (!vs.length) vr.appendChild(h('p', 'Русский голос не найден. На iPhone: Настройки → Универсальный доступ → Устная речь → Голоса → Русский.', 'muted'));
      vs.forEach(function (v) { vr.appendChild(btn((v.name === cur ? '✓ ' : '') + v.name.replace(/\s*\(.*\)$/, ''), v.name === cur ? 'main' : '', function () { store.set('voice', v.name); paintVoices(); say('Привет! Это мой голос.', true); })); });
    }
    paintVoices();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { if (tab === 'speak' && vr.isConnected) paintVoices(); };
    var st = document.createElement('div'); st.className = 'row';
    [['Медленно', 0.8], ['Обычно', 1], ['Быстро', 1.3]].forEach(function (x) { st.appendChild(btn((rate() === x[1] ? '✓ ' : '') + x[0], rate() === x[1] ? 'main' : '', function () { store.set('rate', x[1]); speakScreen(); })); });
    s.appendChild(st);
    var words = store.get('words', false);
    s.appendChild(btn((words ? '✓ ' : '') + 'Говорить по словам, пока печатаю', words ? 'main wide' : 'wide', function () { store.set('words', !words); speakScreen(); }));

    s.appendChild(h('h2', 'Для взрослого'));
    s.appendChild(h('p', '«Про меня» — то, что человек показывает и говорит незнакомым. Напишите обычной клавиатурой:', 'muted'));
    var ta = document.createElement('textarea'); ta.rows = 3; ta.value = aboutMe();
    ta.placeholder = 'Меня зовут Миша. Я не говорю, но всё понимаю. Я отвечу на телефоне — подождите, пожалуйста.';
    ta.oninput = function () { store.set('about', ta.value.trim()); };
    ta.onblur = function () { if (tab === 'speak') speakScreen(); };
    s.appendChild(ta);
    var hr = document.createElement('div'); hr.className = 'row';
    hr.appendChild(btn('Рука: ' + (left ? 'левая' : 'правая'), '', function () { left = !left; store.set('hand', left ? 'left' : 'right'); layout(); speakScreen(); }));
    hr.appendChild(btn('Как помочь', '', function () { parentsScreen(speakScreen); }));
    s.appendChild(hr);
    s.appendChild(h('p', 'Звезда: прямой смах — крупная буква, смах с поворотом — мелкая снаружи, «туда и обратно» — у центра, касание в центре — пробел. ⏎ — сказать. 🔊 — сказать ещё раз. Работает и без интернета, если страница открывалась хотя бы раз.', 'muted'));
    onEnter = sayAll; chipAction = { label: 'Сказать', fn: sayAll, ifText: true }; render(); keepAwake();
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
  function close(a, b) { a = norm(a); b = norm(b); if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false; var d = 0, i = 0, j = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; }
  function lessonScreen() {
    var s = $('screen'); s.innerHTML = ''; chipMode = 'none'; chipAction = null; guided = null; showGuide(null);
    if (step >= LESSON.length) {
      store.set('lessonDone', true);
      s.appendChild(h('h1', 'Ты умеешь говорить с Пульком'));
      s.appendChild(h('p', 'Печатай — телефон скажет. «Сказать» — над вкладками или ⏎ в углу звезды. Быстрые ответы и фразы — во вкладке «Говорить».'));
      s.appendChild(btn('Ещё раз', 'wide', function () { step = 0; lessonScreen(); }));
      s.appendChild(btn('Для взрослого рядом', 'wide', function () { parentsScreen(lessonScreen); }));
      onEnter = null; render(); return;
    }
    var st = LESSON[step];
    s.appendChild(dots(LESSON.length, step, 'шаг ' + (step + 1) + ' из ' + LESSON.length));
    if (step === 0) {
      var pc = document.createElement('div'); pc.className = 'card';
      pc.appendChild(h('div', 'Взрослому рядом: как помочь — на одну минуту чтения.', 'muted'));
      pc.appendChild(btn('Для взрослого рядом', 'wide', function () { parentsScreen(lessonScreen); }));
      s.appendChild(pc);
    }
    s.appendChild(h('h1', st.t));
    if (st.n) s.appendChild(h('p', st.n, 'note'));
    var ok = h('div', '', 'ok');
    function success() { var n = addDrop(); ok.style.color = ''; ok.textContent = 'Получилось. +1 капля — в пруду ' + n; setTimeout(function () { step++; lessonScreen(); }, 1300); }
    if (st.kind === 'tap') { var r = document.createElement('div'); r.className = 'row'; (step === 0 ? ['Да'] : ['Да', 'Нет']).forEach(function (w) { var b = btn(w, w === st.want ? 'main' : '', function () { say(w); if (w === st.want) success(); }); b.style.flex = '1'; b.style.minHeight = '96px'; b.style.fontSize = '26px'; r.appendChild(b); }); s.appendChild(r); }
    onEnter = null;
    if (st.kind === 'guide') {
      text = ''; lang = 'ru'; symbols = false; shiftOnce = false;
      s.appendChild(textBox(''));
      guided = { word: st.want, i: 0, miss: 0, note: function (m) { ok.style.color = 'var(--muted)'; ok.textContent = m; }, done: function () { say(text.trim()); success(); } };
      showGuide(st.want[0]);
    }
    if (st.kind === 'free') {
      text = ''; s.appendChild(textBox('Печатай звездой'));
      onEnter = function () { var t = text.trim(); if (!t) return; say(t); remember(t); success(); };
      chipAction = { label: 'Сказать', fn: function () { onEnter(); } };
    }
    if (st.kind === 'pick') ['Хочу есть', 'Хочу пить', 'Мне холодно'].forEach(function (p) { s.appendChild(btn(p, 'wide', function () { say(p); if (p === st.want) success(); })); });
    if (st.kind === 'show') { s.appendChild(h('h1', st.want)); s.appendChild(btn('Показать', 'main wide', function () { showBig(st.want); $('back').onclick = function () { $('big').style.display = 'none'; $('back').onclick = function () { $('big').style.display = 'none'; }; success(); }; })); }
    s.appendChild(ok); render();
  }

  // «Тренировки»: everyday scenes; type or choose; any answer is said
  var theme = -1, at = 0;
  function themes() { return D.themes.concat(drops() >= 15 && D.play ? [D.play] : []); }
  function fits(a, task) { if (!task.keys.length) return !!a.trim(); var n = norm(a); return task.keys.some(function (k) { return n.indexOf(norm(k)) >= 0; }) || close(a, task.model); }
  function drillsScreen() {
    var s = $('screen'); s.innerHTML = ''; chipMode = 'none'; onEnter = null; chipAction = null;
    if (theme < 0) {
      s.appendChild(h('h1', 'Тренировки'));
      s.appendChild(h('p', 'Короткие жизненные ситуации. Читаешь — отвечаешь: печатаешь звездой или выбираешь. Телефон говорит ответ.', 'muted'));
      var done = store.get('drillsDone', {});
      themes().forEach(function (t, i) { var c = document.createElement('div'); c.className = 'card'; c.appendChild(h('div', (done[t.title] ? '✓ ' : '') + t.title, '')); c.firstChild.style.fontWeight = '700'; c.appendChild(h('div', t.about, 'muted')); c.appendChild(btn(done[t.title] ? 'Ещё раз' : 'Начать', 'wide', function () { theme = i; at = 0; drillsScreen(); })); s.appendChild(c); });
      if (drops() < 15) s.appendChild(h('p', 'На 15 каплях откроется тема «Игра».', 'muted'));
      render(); return;
    }
    var th = themes()[theme];
    if (at >= th.tasks.length) {
      var dd = store.get('drillsDone', {}); dd[th.title] = 1; store.set('drillsDone', dd);
      s.appendChild(h('h1', '«' + th.title + '» — получилось'));
      s.appendChild(btn('К темам', 'main wide', function () { theme = -1; drillsScreen(); })); render(); return;
    }
    var task = th.tasks[at], tries = 0;
    s.appendChild(dots(th.tasks.length, at, th.title + ' · ' + (at + 1) + ' из ' + th.tasks.length));
    s.appendChild(h('h1', task.scene));
    text = ''; s.appendChild(textBox('Напечатай ответ звездой'));
    var ok = h('div', '', 'ok');
    function answer(a) {
      if (!a.trim()) return; say(a);
      var good = fits(a, task);
      if (good || ++tries >= 2) { ok.style.color = ''; ok.textContent = good ? 'Получилось. +1 капля — в пруду ' + addDrop() : 'Можно и так: «' + task.model + '». Дальше.'; setTimeout(function () { at++; drillsScreen(); }, good ? 1100 : 2400); }
      else { ok.style.color = 'var(--muted)'; ok.textContent = 'Сказано «' + a + '». Можно и так: «' + task.model + '».'; }
      text = ''; render();
    }
    onEnter = function () { answer(text.trim()); };
    chipAction = { label: 'Сказать', fn: function () { answer(text.trim()); } };
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
    ['Когда ребёнок говорит', [
      'Отвечайте на сказанное как на настоящие слова. Сказал «нет» — это «нет»; уважайте его, когда это возможно. Так ребёнок узнаёт, что слова работают.',
      'Не экзаменуйте («Напиши, что это»). Предлагайте настоящий выбор: «Сок или воду?»',
      'Говорите и сами через Пульк: напечатайте и скажите ребёнку что-нибудь. Он увидит, как этим пользуются, — без требования повторить.']],
    ['Если что-то не так', [
      'Устал, расстроился, отворачивается — остановитесь. Вернётесь потом: капли в пруду не пропадают.',
      'Левой рукой удобнее — во вкладке «Говорить» есть настройка «Рука».',
      'Голос звучит плохо: Настройки iPhone → Универсальный доступ → Устная речь → Голоса → Русский, скачайте улучшенный голос.',
      'Чтобы ребёнок случайно не выходил со страницы: Настройки → Универсальный доступ → Гид-доступ. Включите, откройте Пульк и трижды нажмите боковую кнопку.',
      'Добавьте Пульк на экран «Домой»: в Safari «Поделиться» → «На экран „Домой“». Без адресной строки места больше.']],
    ['Что дальше', [
      'Урок → «Тренировки» по ситуациям (просьбы, самочувствие, окружение) → «Говорить» в жизни. Каждая получившаяся фраза — капля в пруду.',
      'Всё набранное остаётся на этом телефоне: Пульк ничего никуда не отправляет.']],
  ];
  function parentsScreen(back) {
    var s = $('screen'); s.innerHTML = ''; chipMode = 'none'; chipAction = null; onEnter = null; guided = null; showGuide(null);
    s.appendChild(btn('← Вернуться', '', back));
    s.appendChild(h('h1', 'Для взрослого рядом'));
    s.appendChild(h('p', 'Пульк — способ говорить: ребёнок печатает одним пальцем, телефон произносит. Заранее ничего знать не нужно.', 'note'));
    PARENTS.forEach(function (sec) {
      s.appendChild(h('h2', sec[0]));
      var ul = document.createElement('ul'); ul.className = 'tips';
      sec[1].forEach(function (x) { ul.appendChild(h('li', x)); }); s.appendChild(ul);
    });
    s.appendChild(btn('Понятно — вернуться', 'main wide', back));
    s.scrollTop = 0; render();
  }

  function pondScreen() {
    var s = $('screen'); s.innerHTML = ''; chipMode = 'none'; onEnter = null;
    var n = drops();
    s.appendChild(h('h1', 'Мой пруд'));
    s.appendChild(h('div', 'Капель: ' + n, 'ok'));
    var w = Math.min(window.innerWidth - 32, 420), hh = 200, cx = w / 2, cy = hh / 2, r = hh / 2 - 6;
    var colours = ['var(--accent)', '#4CAF7D', '#E0A030', '#8E7CC3', '#E57373'];
    var dots = '';
    for (var i = 0; i < Math.min(n, 120); i++) { var a = i * 2.39996, rr = Math.sqrt(i / 120) * (r - 10); dots += '<circle cx="' + (cx + Math.cos(a) * rr * 1.4).toFixed(1) + '" cy="' + (cy + Math.sin(a) * rr).toFixed(1) + '" r="5" fill="' + (n >= 5 ? colours[i % 5] : 'var(--accent)') + '" opacity="' + (0.6 + (i * 37 % 100) / 250) + '"/>'; }
    if (n >= 30) [[-0.55, -0.35], [0.5, 0.4]].forEach(function (f) { var x = cx + f[0] * r * 1.4, y = cy + f[1] * r; dots += '<ellipse cx="' + x + '" cy="' + y + '" rx="14" ry="7" fill="#E0A030"/><polygon points="' + (x + 12) + ',' + y + ' ' + (x + 24) + ',' + (y - 8) + ' ' + (x + 24) + ',' + (y + 8) + '" fill="#E0A030"/>'; });
    var glow = n >= 50 && new Date().getHours() >= 18;
    s.insertAdjacentHTML('beforeend', '<svg width="' + w + '" height="' + hh + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r * 1.4 + '" ry="' + r + '" fill="' + (glow ? 'var(--press)' : 'var(--panel)') + '" stroke="var(--line)"/>' + dots + '</svg>');
    s.appendChild(h('p', 'Каждая получившаяся фраза или шаг — капля. Капли только копятся.', 'muted'));
    D.pond.forEach(function (m) { s.appendChild(h('div', (n >= m[0] ? '✓ ' : '○ ') + m[0] + ' капель — ' + m[1], n >= m[0] ? '' : 'muted')); });
    render();
  }

  var SCREENS = { speak: speakScreen, lesson: function () { step = 0; lessonScreen(); }, drills: function () { theme = -1; drillsScreen(); }, pond: pondScreen };
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.onclick = function () { guided = null; showGuide(null); chipAction = null; tab = b.dataset.tab; $('screen').scrollTop = 0; if (tab !== 'speak') letSleep(); document.querySelectorAll('#tabs button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); SCREENS[tab](); };
  });
  window.addEventListener('resize', function () { layout(); });
  layout();
  document.querySelector('#tabs button[data-tab="' + (store.get('lessonDone', false) ? 'speak' : 'lesson') + '"]').click();
  // for checks on a computer
  window.PULK_WEB = { resolve: resolve, table: table, spot: spot, PH: PH, hit: hit, text: function () { return text; }, lastSaid: function () { return lastSaid; },
    geo: function () { return { K: K, CX: CX, CY: CY, W: W, left: left }; } };
})();
