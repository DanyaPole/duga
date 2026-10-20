const { geometry, freqs, cost, anneal, show } = require('./fast');
const fr = freqs('ru', 'абвгдежзийклмнопрстуфхцчшщыьэюя');
const sizes = [9, 11, 10, 7], g = geometry(sizes), n1 = 9;
const best = JSON.parse(require('fs').readFileSync('best_ru.json')).find(r => r[1] === '9/11/10/7')[3];
const cons = best.slice(n1);
const orders = { // written left→right on screen; arc order (from top-right) is the reverse
  optimum: 'эыуоеаияю', hardSoft: 'эыуоаеияю', mirror: 'эыуоаяеюи', alphabet: 'аеиоуыэюя',
};
const results = {};
for (const [k, o] of Object.entries(orders)) {
  const vow = [...o].reverse();
  let r = { items: [...vow, ...cons], cost: cost(g, fr, [...vow, ...cons]) };
  for (let s = 0; s < 3; s++) { const t = anneal(g, fr, [...vow, ...cons], (i, j) => i >= n1 && j >= n1, 200000); if (t.cost < r.cost) r = t; }
  results[k] = r;
  console.log(k.padEnd(9), r.cost.toFixed(3), show(sizes, r.items));
}
require('fs').writeFileSync('vowel_orders.json', JSON.stringify(results));
