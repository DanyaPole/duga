// «Пульк» once per visit: a soft drop with a little echo, on the first touch or key (browsers do not let a page
// sound before that). The same synthesis as the keyboard's «Буль», plus a short room reverb.
(function () {
  var done = false;
  try { if (sessionStorage.getItem('pulk-heard')) done = true; } catch (e) {}
  function play() {
    if (done) return; done = true;
    try { sessionStorage.setItem('pulk-heard', '1'); } catch (e) {}
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    var ctx = new AC(), rate = ctx.sampleRate, dur = 0.26;
    var buf = ctx.createBuffer(1, Math.round(dur * rate), rate), d = buf.getChannelData(0);
    // bubbles: start, from Hz, to Hz, rise s, decay s, level
    [[0, 300, 820, 0.035, 0.065, 1], [0.075, 620, 1050, 0.02, 0.035, 0.35]].forEach(function (b) {
      var ph = 0;
      for (var i = Math.round(b[0] * rate); i < d.length; i++) {
        var t = i / rate - b[0], f = b[1] + (b[2] - b[1]) * (1 - Math.exp(-t / b[3]));
        ph += 2 * Math.PI * f / rate;
        d[i] += Math.sin(ph) * (1 - Math.exp(-t / 0.006)) * Math.exp(-t / b[4]) * b[5];
      }
    });
    var y = 0; for (var i = 0; i < d.length; i++) { y += 0.35 * (d[i] - y); d[i] = y * 0.42; }
    // a small room: decaying noise as the impulse response, mixed in quietly
    var irLen = Math.round(1.4 * rate), ir = ctx.createBuffer(2, irLen, rate);
    for (var c = 0; c < 2; c++) { var r = ir.getChannelData(c); for (var j = 0; j < irLen; j++) r[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / irLen, 3); }
    var src = ctx.createBufferSource(); src.buffer = buf;
    var verb = ctx.createConvolver(); verb.buffer = ir;
    var dry = ctx.createGain(); dry.gain.value = 0.9;
    var wet = ctx.createGain(); wet.gain.value = 0.35;
    // an echo too: the drop once more, quieter, a quarter second later
    var echo = ctx.createDelay(1); echo.delayTime.value = 0.24;
    var eg = ctx.createGain(); eg.gain.value = 0.28;
    src.connect(dry).connect(ctx.destination);
    src.connect(verb).connect(wet).connect(ctx.destination);
    src.connect(echo).connect(eg).connect(ctx.destination);
    src.start();
    setTimeout(function () { try { ctx.close(); } catch (e) {} }, 2500);
  }
  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, play, { once: true, capture: true }); });
})();
