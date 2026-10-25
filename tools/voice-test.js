// Run the page's actual speech boundary with a simulated browser; no speech or network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'duga.html'), 'utf8');
const speechCode = page.slice(page.indexOf('  const NAMES ='), page.indexOf('  const sayLetter'));
const settingsCode = page.slice(page.indexOf('  function setSound('), page.indexOf("  for (const m of ['off', 'clicks', 'voice']) $('snd-' + m).onclick"))
  + page.slice(page.indexOf('  function setLang('), page.indexOf('  const MODE_NAMES ='));
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
    lang, sound: 'voice', di: 0, lastSwipe: null,
    store: { set() {} }, paintSound() {}, audio() {}, tone() {}, SCALE: [0, 1, 2, 3, 4, 5],
    paintVariants() {}, buildRings() {}, layout() {}, render() {}, warmSwipe() {},
    $: id => {
      if (id === 'lang-ru' || id === 'lang-en') return { setAttribute() {} };
      assert.equal(id, 'voice-note'); return note;
    },
  });
  vm.runInContext(speechCode + settingsCode, context);
  return { note, spoken, speech, events, context,
    say: () => vm.runInContext('speak("Проверка", 1.1)', context) };
}

test('remote default alone never receives text; a persistent explanation is shown', () => {
  const b = browser([remote]); b.say();
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, false);
  assert.match(b.note.textContent, /своего голоса устройства/);
  assert.match(b.note.textContent, /Щелчки/);
  assert.match(b.note.textContent, /скачай голос в настройках устройства/);
  assert.doesNotMatch(b.note.textContent, /фраз|собеседник|локальн/i);
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

test('a local voice for a different language is rejected', () => {
  const b = browser([en, { lang: 'russian', localService: true }]); b.say();
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, false);
});

for (const [lang, tag] of [['ru', 'ru_RU'], ['ru', 'ru'], ['ru', 'ru-UA'], ['en', 'en-GB']]) {
  test(`${lang}: accepts the local language variant ${tag}`, () => {
    const voice = { lang: tag, localService: true };
    const b = browser([{ ...remote, lang: tag }, voice], lang); b.say();
    assert.equal(b.spoken.length, 1);
    assert.equal(b.spoken[0].voice, voice);
    assert.equal(b.spoken[0].lang, tag.replace(/_/g, '-'));
  });
}

for (const [lang, exact, fallback] of [['ru', ru, 'ru-UA'], ['en', en, 'en-GB']]) {
  test(`${lang}: prefers the exact region over an earlier local variant`, () => {
    const b = browser([{ lang: fallback, localService: true }, exact], lang); b.say();
    assert.equal(b.spoken[0].voice, exact);
  });
}

test('a case-insensitive underscore region is preferred over another region', () => {
  const exact = { lang: 'RU_ru', localService: true };
  const b = browser([{ lang: 'ru-UA', localService: true }, exact]); b.say();
  assert.equal(b.spoken[0].voice, exact);
  assert.equal(b.spoken[0].lang, 'RU-ru');
});

test('malformed language tags do not hide a later valid local voice', () => {
  const b = browser([null, undefined, 1, {}].map(lang => ({ lang, localService: true })).concat(ru));
  b.say();
  assert.equal(b.spoken.length, 1);
  assert.equal(b.spoken[0].voice, ru);
});

test('malformed tags and remote regional variants never receive text', () => {
  const b = browser([{ lang: null, localService: true }, { lang: 'en-GB', localService: false }], 'en');
  b.say();
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
  vm.runInContext('setLang("en")', b.context); b.say();
  assert.equal(b.spoken[1].voice, en);
});

for (const mode of ['off', 'clicks']) {
  test(`switching sound to ${mode} hides the stale voice note`, () => {
    const b = browser([remote]); b.say();
    assert.equal(b.note.hidden, false);
    vm.runInContext(`setSound("${mode}")`, b.context);
    assert.equal(b.note.hidden, true);
    assert.equal(b.spoken.length, 0);
  });
}

test('switching language hides the stale note and updates the next explanation', () => {
  const b = browser([remote]); b.say();
  assert.equal(b.note.hidden, false);
  const previous = b.note.textContent;
  vm.runInContext('setLang("en")', b.context);
  assert.equal(b.note.hidden, true);
  b.say();
  assert.equal(b.note.hidden, false);
  assert.notEqual(b.note.textContent, previous);
  assert.match(b.note.textContent, /Clicks/);
  assert.match(b.note.textContent, /download.*device settings/);
  assert.doesNotMatch(b.note.textContent, /phrase|other person|local voice/i);
});

test('the voice note is an accessible live status', () => {
  assert.match(page, /<p\b[^>]*id="voice-note"[^>]*role="status"/);
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
  assert.match(b.note.textContent, /Щелчки/);
  assert.doesNotMatch(b.note.textContent, /фраз|собеседник/i);
});

test('empty text makes no request', () => {
  const b = browser([ru]); vm.runInContext('speak("")', b.context);
  assert.equal(b.spoken.length, 0);
  assert.equal(b.note.hidden, true);
});

test('the entire inline page script still parses', () => {
  for (const match of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
