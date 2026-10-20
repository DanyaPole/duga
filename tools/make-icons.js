// Draws the app icon (quarter-disc keyboard arcs from the bottom-right corner) as PNGs: node tools/make-icons.js
// Hand-written PNG encoder (zlib + CRC), no dependencies.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), cr = Buffer.alloc(4);
  len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, cr]);
}
function png(S, px) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const BG = [13, 18, 21], KEY = [[85, 186, 215], [60, 150, 178], [38, 112, 140]]; // dark ground, three rings of keys
// Rings (radius range as share of the icon size) and how many keys each holds; all inside the safe zone
const RINGS = [[0.16, 0.30, 2], [0.33, 0.47, 3], [0.50, 0.64, 4]];
function draw(S) {
  const px = Buffer.alloc(S * S * 4), cx = S * 0.80, cy = S * 0.80, SS = 3, gapA = 3.2; // degrees between keys
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const dx = x + (sx + .5) / SS - cx, dy = cy - (y + (sy + .5) / SS), rad = Math.hypot(dx, dy) / S;
      let ang = Math.atan2(dy, dx) * 180 / Math.PI, c = BG;
      if (ang >= 90 && ang <= 180) RINGS.forEach(([r0, r1, n], i) => {
        if (rad < r0 || rad > r1) return;
        const span = 90 / n, k = Math.min(n - 1, Math.floor((ang - 90) / span)), within = (ang - 90) - k * span;
        if (within > gapA / 2 && within < span - gapA / 2) c = KEY[i];
      });
      r += c[0]; g += c[1]; b += c[2];
    }
    const o = (y * S + x) * 4, q = SS * SS; px[o] = r / q; px[o + 1] = g / q; px[o + 2] = b / q; px[o + 3] = 255;
  }
  return px;
}
for (const [name, S] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(out, name), png(S, draw(S)));
  console.log(name, fs.statSync(path.join(out, name)).size, 'bytes');
}
