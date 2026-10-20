const { geometry, freqs, cost, fromSpec, show } = require('./fast');
const L = {
  ru: { a: 'абвгдежзийклмнопрстуфхцчшщыьэюя', v: {
    'Слоги':   [{ row: 'эыуоаеияю' }, { row: 'ймпрвнтскль' }, { row: 'фхбгдзчжшц' }, { fixed: ['.', ',', '-', 'щ', '?', '!', ':'] }],
    'ЙЦУКЕН':  [{ row: 'ячсмитьбю' }, { row: 'фывапролджэ' }, { row: 'йцукенгшщзх' }, { fixed: ['.', ',', '-', '?', '!', ':'] }],
    'Гласные': [{ freq: 'оеаиуяыюэ' }, { freq: 'нтсрвлкмдп' }, { freq: 'ьгзбчйхжшцщ' }, { fixed: ['.', ',', 'ф', '-', '?', '!', ':'] }],
    'Частоты': [{ freq: 'оеаинтс' }, { freq: 'рвлкмдпуя' }, { freq: 'ыьгзбчйхжш' }, { fixed: ['.', ',', 'ф', 'щ', 'ю', 'ц', 'э', '-', '?', '!'] }],
  } },
  en: { a: 'abcdefghijklmnopqrstuvwxyz', v: {
    'Слоги':   [{ row: 'uoaeiy' }, { row: 'fmlrdnstch' }, { row: 'qjbpvgwkxz' }, { fixed: ['.', ',', "'", '?', '!', '-', ':', '@'] }],
    'QWERTY':  [{ row: 'zxcvbnm' }, { row: 'asdfghjkl' }, { row: 'qwertyuiop' }, { fixed: ['.', ',', "'", '?', '!', '-', ':', '@'] }],
    'Гласные': [{ freq: 'eaoiuy' }, { freq: 'tnshrdlcm' }, { freq: 'wfgpbvkxjqz' }, { fixed: ['.', ',', "'", '?', '!', '-', ':', '@'] }],
    'Частоты': [{ freq: 'etaoins' }, { freq: 'hrdlcumwf' }, { freq: 'gypbvkjxqz' }, { fixed: ['.', ',', "'", '?', '!', '-', ':', '@'] }],
  } },
};
for (const [lang, { a, v }] of Object.entries(L)) {
  const fr = freqs(lang, a);
  for (const [k, r] of Object.entries(v)) { const s = fromSpec(r); console.log(lang, k.padEnd(8), cost(geometry(s.sizes), fr, s.items).toFixed(3)); }
}
