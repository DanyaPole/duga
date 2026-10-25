// Run the page's actual speech boundary with a simulated browser; no speech or network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'duga.html'), 'utf8');
const speechCode = page.slice(page.indexOf('  const NAMES ='), page.indexOf('  const sayLetter'));
const ru = { lang: 'ru-RU', localService: true };
const en = { lang: 'en-US', localService: true };
const remote = { lang: 'ru-RU', localService: false, default: true };

function browser(voices = [], lang = 'ru', supported = true) {
  const note = { hidden: true, textContent: '' }, spoken = [], events = {};
  const speech = {
    voices,
    getVoices() { return this.voices; },
    addEventListener(name, fn) { events[name] = fn; },
    cancel() {},
    speak(u) { spoken.push(u); },
  };
  const context = vm.createContext({
    window: { speechSynthesis: supported ? speech : undefined },
    speechSynthesis: supported ? speech : undefined,
    SpeechSynthesisUtterance: function (text) { this.text = text; },
    lang, $: id => { assert.equal(id, 'voice-note'); return note; },
  });
  vm.runInContext(speechCode, context);
  return { note, spoken, speech, events, context,
    say: () => vm.runInContext('speak("Проверка", 1.1)', context) };
}

test('remote default alone never receives text; a persistent explanation is shown', () => {
  const b = browser([remote]); b.say();
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, false);
  assert.match(b.note.textContent, /не ушла в интернет/);
  assert.match(b.note.textContent, /показать.*собеседнику/);
});

test('repeated blocked requests do not repeat the status announcement', () => {
  const b = browser([remote]); let updates = 0, message = '';
  Object.defineProperty(b.note, 'textContent', {
    get: () => message,
    set: value => { updates++; message = value; },
  });
  b.say(); b.say();
  assert.equal(updates, 1);
});

for (const [lang, voice] of [['ru', ru], ['en', en]]) {
  test(`${lang}: selects the explicit local voice over a remote default`, () => {
    const b = browser([{ ...remote, lang: voice.lang }, voice], lang); b.say();
    assert.equal(b.spoken.length, 1);
    assert.equal(b.spoken[0].voice, voice);
    assert.equal(b.spoken[0].lang, voice.lang);
    assert.equal(b.spoken[0].rate, 1.1);
    assert.equal(b.note.hidden, true);
  });
}

for (const localService of [false, undefined, 'true', 1]) {
  test(`localService=${String(localService)} is rejected`, () => {
    const b = browser([{ lang: 'ru-RU', localService }]); b.say();
    assert.equal(b.spoken.length, 0);
    assert.equal(b.note.hidden, false);
  });
}

test('a local voice for a different language or region is rejected', () => {
  const b = browser([en, { lang: 'ru-UA', localService: true }]); b.say();
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, false);
});

test('empty voices block speech; voiceschanged permits only the next request', () => {
  const b = browser(); b.say();
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, false);
  b.speech.voices = [remote, ru];
  assert.equal(typeof b.events.voiceschanged, 'function');
  b.events.voiceschanged();
  assert.equal(b.spoken.length, 0); // Never replay previously typed text automatically.
  b.say();
  assert.equal(b.spoken[0].voice, ru);
  assert.equal(b.note.hidden, true);
});

test('voice removal is respected even before voiceschanged arrives', () => {
  const b = browser([ru]); b.say();
  b.speech.voices = [remote]; b.say();
  assert.equal(b.spoken.length, 1);
  assert.equal(b.note.hidden, false);
});

test('switching language reselects the local voice', () => {
  const b = browser([ru, en]); b.say();
  vm.runInContext('lang = "en"', b.context); b.say();
  assert.equal(b.spoken[1].voice, en);
});

test('an unsupported browser shows the explanation without speaking', () => {
  const b = browser([], 'ru', false); b.say();
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, false);
});

test('voice enumeration failure blocks speech without fallback', () => {
  const b = browser([ru]);
  b.speech.getVoices = () => { throw new Error('unavailable'); };
  b.say();
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, false);
});

test('a synthesis failure never retries using the default voice', () => {
  const b = browser([remote, ru]); let attempts = 0;
  b.speech.speak = u => { attempts++; assert.equal(u.voice, ru); throw new Error('unavailable'); };
  b.say();
  assert.equal(attempts, 1);
  assert.equal(b.note.hidden, false);
});

test('empty text makes no request', () => {
  const b = browser([ru]); vm.runInContext('speak("")', b.context);
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, true);
});

test('the entire inline page script still parses', () => {
  for (const match of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
