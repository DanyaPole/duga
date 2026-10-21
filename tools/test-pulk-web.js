// Tests for Пульк в браузере, run on every build of the site (tools/build-pages.js): if one fails, nothing is
// published. The pure core (pulk/web/core.js) is checked against the same expectations as the Android app's
// tests (PulseTest, WordsTest); the data shared with the app (pulk/web/data.js) is checked for completeness; the
// page script is checked to parse. No libraries: node tools/test-pulk-web.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const box = { window: {}, Math, Object, Array, JSON, isNaN };
box.globalThis = box.window;
vm.createContext(box);
for (const f of ['pulk/web/data.js', 'pulk/web/core.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), box, { filename: f });
const D = box.window.PULK, P = box.window.PulkCore;

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.log('  ✗ ' + name + ': ' + (e && e.message || e)); }
}
function eq(a, b, what) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((what ? what + ': ' : '') + 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function ok(c, what) { if (!c) throw new Error(what || 'not true'); }

// strokes in base units from the star's centre, as the Android tests draw them
const at = (pts) => { const out = []; pts.forEach(p => out.push(P.PH[0] + p[0], P.PH[1] + p[1])); return out; };
const line = (deg, len) => { const a = deg * P.DEG, o = []; for (let i = 0; i <= 6; i++) o.push([Math.cos(a) * len * i / 6, Math.sin(a) * len * i / 6]); return at(o); };
const turn = (deg, sign) => {
  const a = deg * P.DEG, b = (deg + sign * 90) * P.DEG, o = [];
  for (let i = 0; i <= 5; i++) o.push([Math.cos(a) * 50 * i / 5, Math.sin(a) * 50 * i / 5]);
  for (let i = 1; i <= 4; i++) o.push([Math.cos(a) * 50 + Math.cos(b) * 30 * i / 4, Math.sin(a) * 50 + Math.sin(b) * 30 * i / 4]);
  return at(o);
};
const outBack = (deg) => { const a = deg * P.DEG, o = []; for (const r of [0, 20, 40, 55, 40, 20, 5]) o.push([Math.cos(a) * r, Math.sin(a) * r]); return at(o); };

test('the data shared with the app is whole', () => {
  eq(D.RU.length, 8, 'RU petals'); D.RU.forEach((p, i) => eq(p.length, 4, 'petal ' + i));
  const letters = [].concat(...D.RU).filter(Boolean).join('');
  for (const c of 'абвгдежзийклмнопрстуфхцчшщыьэюя') ok(letters.includes(c), 'missing «' + c + '»');
  ok(D.quick.length >= 6, 'quick replies'); eq(D.day.length, 4, 'parts of the day');
  ok(D.situations.some(s => s[0] === 'Срочно'), '«Срочно»'); ok(D.situations.some(s => s[0] === 'Близким'), '«Близким»');
  ok(D.themes.some(t => t.title === 'Разминка'), '«Разминка»'); ok(D.pond.length >= 4, 'pond');
});

test('a straight stroke is the big letter of its petal', () => {
  for (let p = 0; p < 8; p++) eq(P.resolve(D.RU, line(p * 45, 60)).v, D.RU[p][0], 'petal ' + p);
});
test('a stroke with a turn is the small letter on that side', () => {
  for (let p = 0; p < 8; p++) {
    eq(P.resolve(D.RU, turn(p * 45, 1)).v, D.RU[p][1] || D.RU[p][0], 'left of ' + p);
    eq(P.resolve(D.RU, turn(p * 45, -1)).v, D.RU[p][2] || D.RU[p][0], 'right of ' + p);
  }
});
test('out and back is the letter at the centre', () => {
  for (let p = 0; p < 8; p++) eq(P.resolve(D.RU, outBack(p * 45)).v, D.RU[p][3] || D.RU[p][0], 'petal ' + p);
});
test('a touch in the middle is a space, a touch on a letter is that letter', () => {
  eq(P.resolve(D.RU, at([[0, 0]])).petal, -1);
  const s = P.spot(2, 'c'); eq(P.resolve(D.RU, [s[0], s[1]]).v, D.RU[2][0]);
});
test('the service keys are where the thumb expects them', () => {
  const k = (r, a) => (P.hit(r * Math.cos(a * P.DEG), r * Math.sin(a * P.DEG)) || {}).fn;
  eq(k(90, 120), 'space'); eq(k(90, 165), 'enter'); eq(k(230, 100), 'bksp'); eq(k(283, 170), 'say'); eq(k(176, 170), 'shift');
  eq(P.hit(P.PH[0], P.PH[1]), null, 'the star is not a key');
});

test('«Толчки»: each jab out and back is a letter, a short one the centre letter', () => {
  const j = new P.Jabs(0, 0), got = [];
  const push = (deg, len) => { const a = deg * P.DEG; for (let i = 1; i <= 6; i++) { const r = j.add(Math.cos(a) * len * i / 6, Math.sin(a) * len * i / 6); if (r) got.push(P.jab(D.RU, r).v); } for (let i = 5; i >= 0; i--) { const r = j.add(Math.cos(a) * len * i / 6, Math.sin(a) * len * i / 6); if (r) got.push(P.jab(D.RU, r).v); } };
  push(0, 50); push(45, 50); push(90, 22);
  eq(got, [D.RU[0][0], D.RU[1][0], D.RU[2][3]]);
});

test('the 1€ filter calms a shaking hand and lets a quick stroke through', () => {
  const f = new P.OneEuro(0.8, 0.02); let maxDev = 0;
  f.f(10, 0);   // the first point passes as it is
  for (let t = 16; t < 1000; t += 16) maxDev = Math.max(maxDev, Math.abs(f.f(10 + (t / 16 % 2 ? 3 : -3), t) - 10));
  ok(maxDev < 3, 'jitter of ±3 kept within ' + maxDev.toFixed(2));
  const g = new P.OneEuro(3, 0.02); let x = 0; for (let t = 0; t <= 200; t += 16) x = g.f(t * 0.5, t);
  ok(x > 70, 'a quick stroke lags too much: ' + x.toFixed(1));
});

// words, with the real dictionary
const dict = fs.readFileSync(path.join(root, 'dict_ru.txt'), 'utf8').split(/\r?\n/);
const W = new P.Words(dict, D.RU);
test('a stroke slip in a word is corrected', () => {
  eq(W.correction('маьа', {}), 'мама'); eq(W.correction('нит', {}), 'нет'); eq(W.correction('Маьа', {}), 'Мама');
  eq(W.correction('мама', {}), null, 'a real word stays');
});
test('suggestions: frequent words first, the person\'s own words before them', () => {
  eq(W.suggest('прив', 3, {})[0], 'привет');
  eq(W.suggest('ми', 3, { 'миша': 3 })[0], 'миша');
  eq(W.correction('ьиша', { 'миша': 2 }), 'миша', 'own words are known to the correction');
});
test('words keep the case that was typed', () => { eq(P.shape('привет', 'Пр'), 'Привет'); eq(P.shape('привет', 'ПР'), 'ПРИВЕТ'); });

test('the page script parses', () => {
  for (const f of ['pulk/web/app.js']) new Function(fs.readFileSync(path.join(root, f), 'utf8'));
});

console.log('Пульк в браузере: ' + passed + ' tests, ' + failed + ' failed');
if (failed) process.exit(1);
