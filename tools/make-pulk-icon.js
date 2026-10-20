// The Pulk app icon: the star of «Пульс» (8 petals around a hub). node tools/make-pulk-icon.js <output folder>
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const out = process.argv[2] || path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
function png(S, px) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const BG = [13, 18, 21], SHADES = [[85, 186, 215], [60, 150, 178], [85, 186, 215], [60, 150, 178], [85, 186, 215], [60, 150, 178], [85, 186, 215], [60, 150, 178]];
function draw(S) {
  const px = Buffer.alloc(S * S * 4), c = S / 2, R = S * 0.40, hub = S * 0.09, gap = 2.6, SS = 3;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const dx = x + (sx + .5) / SS - c, dy = c - (y + (sy + .5) / SS), d = Math.hypot(dx, dy);
      let col = BG;
      if (d <= R && d >= hub * 1.7) {
        let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a < 0) a += 360;
        const p = Math.floor(((a + 22.5) % 360) / 45), within = ((a + 22.5) % 360) - p * 45;
        if (within > gap / 2 && within < 45 - gap / 2) col = SHADES[p];
      } else if (d < hub) col = [228, 235, 238];
      r += col[0]; g += col[1]; b += col[2];
    }
    const o = (y * S + x) * 4, q = SS * SS; px[o] = r / q; px[o + 1] = g / q; px[o + 2] = b / q; px[o + 3] = 255;
  }
  return px;
}
for (const [name, S] of [['ic_launcher.png', 192], ['ic_launcher_512.png', 512]]) { fs.writeFileSync(path.join(out, name), png(S, draw(S))); console.log(name); }
