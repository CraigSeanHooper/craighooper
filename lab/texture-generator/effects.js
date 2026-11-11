/*
  Photo effects — a single-photo editor.

  Load one photo, then colour it (original, duotone or tritone with any
  colours), adjust it, and add grain and speckle texture.
  The preview is processed at screen size; Download re-runs the same steps
  on the full-size photo and saves it as a JPG or PNG. Nothing is uploaded:
  the photo stays in the browser.
*/
(function () {
  "use strict";

  var PREVIEW_MAX = 1600;   // longest side of the on-screen preview
  var DRAFT_MAX = 800;      // while a slider is being dragged: a quarter of the work, so the photo keeps up with the finger
  var EXPORT_MAX = 6000;    // longest side of a download

  // Two-colour sets for Duotone: a deep shadow and a lighter tint of the same hue.
  var DUO_PRESETS = [
    ["#1c1204", "#f2a71b"],  // ochre
    ["#070b3a", "#5b84ff"],  // ultramarine
    ["#170838", "#a98bff"],  // violet
    ["#2b0828", "#f07ad8"],  // plum
    ["#0f2405", "#a6d93a"],  // moss
    ["#2a0904", "#ff6a2b"],  // vermilion
    ["#000000", "#ffffff"]   // black and white
  ];
  // Three-colour sets for Tritone: shadow, midtone, highlight.
  var PRESETS = [
    ["#1c1204", "#c27c0e", "#f6e3b4"],  // ochre
    ["#070b3a", "#2f5cf0", "#dfe6ff"],  // ultramarine
    ["#170838", "#7a4cf0", "#ece2ff"],  // violet
    ["#2b0828", "#b4309e", "#fbe0f2"],  // plum
    ["#0f2405", "#5f9a12", "#e6f3c2"],  // moss
    ["#2a0904", "#e2441a", "#fde4d4"],  // vermilion
    ["#000000", "#808080", "#ffffff"]   // black and white
  ];

  var DEFAULTS = {
    mode: "duo",
    dark: DUO_PRESETS[0][0], mid: PRESETS[0][1], light: DUO_PRESETS[0][1],
    amount: 100,
    brightness: 0, contrast: 0, midtones: 0,
    grain: 0, grainSize: 4, speckle: 0,
    misregister: 0, vignette: 0,
    quality: 100,
    format: "jpg"
  };
  var SLIDERS = ["amount", "brightness", "contrast", "midtones", "misregister", "vignette",
                 "grain", "grainSize", "speckle", "quality"];

  var s = JSON.parse(JSON.stringify(DEFAULTS));
  var textureSeed = 1;   // fixed, so textures look the same every time
  var source = null;     // the loaded Image
  var fileBase = "photo";
  var previewBase = null; // source scaled to preview size
  var draftBase = null;   // smaller copy, used only while a slider is being dragged
  var sliding = false;    // a finger or the mouse is dragging a slider
  var showOriginal = false;

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function canvasOf(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  // Phones (iPhone Safari above all) cap how much memory a page may use for images.
  // Past the cap a canvas quietly comes back empty, so large ones are checked by
  // drawing one pixel in the far corner and reading it back.
  function checked(c) {
    var ctx = c.getContext("2d"), x = c.width - 1, y = c.height - 1;
    if (!ctx) throw new Error("no memory for this image size");
    ctx.fillStyle = "#000"; ctx.fillRect(x, y, 1, 1);
    var ok = ctx.getImageData(x, y, 1, 1).data[3] === 255;
    ctx.clearRect(x, y, 1, 1);
    if (!ok) { freeCanvas(c); throw new Error("no memory for this image size"); }
    return c;
  }
  // hands a canvas's memory back straight away, rather than whenever the browser gets round to it
  function freeCanvas(c) { if (c) { c.width = 0; c.height = 0; } }
  function scaled(img, max) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(iw, ih));
    var c = checked(canvasOf(iw * k, ih * k)), ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    var r = mulberry32(seed), perm = new Uint8Array(512), vals = new Float32Array(256), i;
    for (i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
    for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function v(x, y) { return vals[perm[(x & 255) + perm[y & 255]]]; }
    function sm(t) { return t * t * (3 - 2 * t); }
    function n2(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1), u = sm(xf), w = sm(yf);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    }
    return function (x, y, oct) {
      var sum = 0, amp = 0.5, f = 1, norm = 0;
      for (var o = 0; o < (oct || 4); o++) { sum += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
      return sum / norm;
    };
  }

  // ---------- keeping the page responsive ----------
  // The heavy steps hand control back to the browser every 40ms or so, so clicks,
  // taps and slider drags are still answered while a photo is being processed
  // (Chrome's guidance: no single task over 50ms).
  var deadline = 0;
  function startBudget() { deadline = performance.now() + 40; }
  function tick() {   // returns a promise to wait on once the budget is spent, otherwise null
    if (performance.now() < deadline) return null;
    var p = window.scheduler && typeof scheduler.yield === "function" ? scheduler.yield() : new Promise(function (r) { setTimeout(r, 0); });
    return p.then(startBudget);
  }
  // a copy of the settings, so a run in progress isn't changed halfway by a slider
  function snapshot() { var o = {}; for (var k in s) o[k] = s[k]; return o; }

  // ---------- processing ----------
  // Runs every step on `base` (a canvas holding the photo) and returns a new
  // canvas. Sizes are relative to the photo, so preview and download match.
  // `s` is a snapshot of the settings taken when the run started.
  // `freeBase` (downloads only) hands the base's memory back once it's copied.
  async function processImage(base, s, freeBase) {
    startBudget();
    var W = base.width, H = base.height, U = Math.max(W, H) / 2000;   // 1 unit ≈ 1px on a 2000px photo
    var out = checked(canvasOf(W, H)), ctx = out.getContext("2d");
    ctx.drawImage(base, 0, 0);
    if (freeBase) freeCanvas(base);
    var data = ctx.getImageData(0, 0, W, H), px = data.data, i, y, end, wait, row = W * 4;

    // levels from the histogram, so the colours always reach full range
    var hist = new Uint32Array(256), n = px.length / 4;
    for (y = 0; y < H; y++) {
      for (i = y * row, end = i + row; i < end; i += 4) hist[(px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) | 0]++;
      if ((wait = tick())) await wait;
    }
    var lo = 0, hi = 255, acc = 0;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.005) { lo = i; break; } }
    acc = 0;
    for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.005) { hi = i; break; } }
    if (s.mode === "original") { lo = Math.min(lo, 8); hi = Math.max(hi, 247); }  // keep originals close to as shot

    // one tone curve, as a lookup table: levels → brightness → contrast → midtones
    var bright = s.brightness / 100 * 0.35;
    var con = s.contrast >= 0 ? 1 + s.contrast / 100 * 2 : 1 + s.contrast / 100 * 0.8;
    var gamma = Math.pow(2, -s.midtones / 100 * 1.4);
    var lut = new Float32Array(256), range = Math.max(1, hi - lo);
    for (i = 0; i < 256; i++) {
      var v = (i - lo) / range + bright;
      v = (v - 0.5) * con + 0.5;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      lut[i] = Math.pow(v, gamma);
    }

    var t = s.mode === "original" ? 0 : s.amount / 100;
    var dk = hex(s.dark), md = hex(s.mid), lt = hex(s.light), tri = s.mode === "tri";
    for (y = 0; y < H; y++) {
     if ((wait = tick())) await wait;
     for (i = y * row, end = i + row; i < end; i += 4) {
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var l = lut[(r * 0.2126 + g * 0.7152 + b * 0.0722) | 0], cr, cg, cb;
      var or = lut[r], og = lut[g], ob = lut[b];
      if (tri) {
        if (l < 0.5) { var a = l * 2; cr = dk[0] + (md[0] - dk[0]) * a; cg = dk[1] + (md[1] - dk[1]) * a; cb = dk[2] + (md[2] - dk[2]) * a; }
        else { var c = (l - 0.5) * 2; cr = md[0] + (lt[0] - md[0]) * c; cg = md[1] + (lt[1] - md[1]) * c; cb = md[2] + (lt[2] - md[2]) * c; }
      } else {
        cr = dk[0] + (lt[0] - dk[0]) * l; cg = dk[1] + (lt[1] - dk[1]) * l; cb = dk[2] + (lt[2] - dk[2]) * l;
      }
      px[i]     = or * 255 * (1 - t) + cr * t;
      px[i + 1] = og * 255 * (1 - t) + cg * t;
      px[i + 2] = ob * 255 * (1 - t) + cb * t;
     }
    }
    // misregistration works on the same pixels before they go back, rather than reading a second copy
    if (s.misregister > 0) await misregister(px, W, H, U, s);
    ctx.putImageData(data, 0, 0);
    data = px = null;   // let the browser reclaim the pixel copy straight away
    if (s.vignette > 0) vignette(ctx, W, H, s.mode === "original" ? "#000000" : s.dark, s);

    // speckle is printed in the shadow colour (near-black in Original mode)
    if (s.speckle > 0) await speckle(ctx, W, H, U, s.mode === "original" ? "#141414" : s.dark, s);
    if (s.grain > 0) await grain(ctx, W, H, U, s);
    return out;
  }

  // ---------- print effects ----------
  // Slips the red and blue channels apart, like plates printed slightly out of
  // line. Each shifted channel is spread across a few nearby offsets and mostly
  // (85%) mixed in: a clearly visible offset whose fringe edges fade instead of
  // ending in a hard line. (A full hard shift was too harsh; a wide spread at
  // 60% and 8px was too faint.)
  // `p` is the photo's pixels, changed in place. Only the red and blue channels are
  // copied to read from (a quarter of the photo each), to keep memory down on phones.
  async function misregister(p, W, H, U, s) {
    var d = s.misregister / 100 * 14 * U;
    if (d < 0.5) return;
    var n = W * H, red = new Uint8Array(n), blue = new Uint8Array(n), wait;
    for (var k = 0; k < n; k++) { red[k] = p[k * 4]; blue[k] = p[k * 4 + 2]; }
    var taps = [0.55, 0.7, 0.85, 1], mix = 0.85;
    function at(x, y, ch) {
      x = x < 0 ? 0 : x > W - 1 ? W - 1 : x | 0; y = y < 0 ? 0 : y > H - 1 ? H - 1 : y | 0;
      return ch[y * W + x];
    }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (x === 0 && (wait = tick())) await wait;
      var i = (y * W + x) * 4, r = 0, b = 0;
      for (var t = 0; t < 4; t++) {
        var o = d * taps[t];
        r += at(x + o, y + o * 0.5, red);
        b += at(x - o, y - o * 0.5, blue);
      }
      var j = i >> 2;
      p[i] = red[j] * (1 - mix) + r / 4 * mix;
      p[i + 2] = blue[j] * (1 - mix) + b / 4 * mix;
    }
  }


  // Darkens the edges toward the shadow colour.
  function vignette(ctx, W, H, colour, s) {
    var c = hex(colour), r = Math.sqrt(W * W + H * H) / 2, k = s.vignette / 100;
    var g = ctx.createRadialGradient(W / 2, H / 2, r * (0.75 - k * 0.45), W / 2, H / 2, r);
    g.addColorStop(0, "rgba(" + c + ",0)");
    g.addColorStop(1, "rgba(" + c + "," + (0.25 + k * 0.6).toFixed(3) + ")");
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // Speckle: small round specks, gathered in drifts like dust or ink spatter.
  // (Larger blots were tried and removed: Craig prefers only the small ones.)
  async function speckle(ctx, W, H, U, ink, s) {
    var fbm = makeNoise(textureSeed * 3 + 1), rand = mulberry32(textureSeed * 7 + 5);
    var amt = s.speckle / 100, freq = 5 / Math.max(W, H);
    var tries = Math.round(W * H / (U * U) * 0.07 * amt), TAU = Math.PI * 2, wait;
    ctx.save();
    ctx.fillStyle = ink;
    for (var n = 0; n < tries; n++) {
      if ((n & 4095) === 0 && (wait = tick())) await wait;
      var x = rand() * W, y = rand() * H;
      // drifts: keep a speck only where the cluster noise is high enough
      var c = fbm(x * freq, y * freq, 4);
      if (rand() > Math.pow(Math.max(0, (c - 0.3) / 0.7), 1.3) * (0.4 + amt * 0.6)) continue;
      var size = rand(), r = U * (0.45 + 0.5 * size * size * size);   // small specks only
      ctx.globalAlpha = 0.65 + rand() * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Film grain: light and dark specks, scaled to the photo. Seeded, so the
  // pattern holds still while sliders move. (Two "improved" versions, soft
  // clumped grain and crisp blurred grain, were tried on 14 October and both
  // looked worse to Craig. This is the original; keep it.)
  async function grain(ctx, W, H, U, s) {
    var rand = mulberry32(textureSeed * 17 + 9);
    var size = Math.max(1, s.grainSize * 0.8 * U), gw = Math.ceil(W / size), gh = Math.ceil(H / size);
    var g = canvasOf(gw, gh), gc = g.getContext("2d"), d = gc.createImageData(gw, gh), p = d.data, k = s.grain / 100 * 70, wait, row = gw * 4;
    for (var i = 0; i < p.length; i += 4) {
      if (i % row === 0 && (wait = tick())) await wait;
      var nv = (rand() - 0.5) * k, v = nv > 0 ? 255 : 0;
      p[i] = v; p[i + 1] = v; p[i + 2] = v; p[i + 3] = Math.abs(nv) * 2;
    }
    gc.putImageData(d, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = size > 1.5;
    ctx.drawImage(g, 0, 0, gw * size, gh * size);
    freeCanvas(g);
    ctx.restore();
  }




  // ---------- preview ----------
  // One run at a time. Changes made while a run is going are picked up by one
  // more run straight after it, with the latest settings.
  var queued = false, busy = false, again = false, photoId = 0;
  function draw(img) {
    var c = $("preview");
    if (c.width !== previewBase.width || c.height !== previewBase.height) { c.width = previewBase.width; c.height = previewBase.height; fitPreview(); }
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);   // a draft is stretched to fill; full size again on release
  }
  function update() {
    if (!previewBase) return;
    if (showOriginal) { draw(previewBase); return; }   // the original needs no processing
    if (busy) { again = true; return; }
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }
  async function run() {
    queued = false; busy = true; again = false;
    var id = photoId, base = sliding && draftBase ? draftBase : previewBase, out = null;
    try { out = await processImage(base, snapshot()); } catch (e) { out = null; }
    busy = false;
    if (out && id === photoId && !showOriginal) draw(out);
    if (again || id !== photoId) update();
  }

  var PHOTO_SHARE = 530 / 840;   // Figma: photo-loaded frames, desktop (Craig, 8 November: "smaller, like Figma")
  function fitPreview() {
    var c = $("preview");
    if (!previewBase) return;
    var stage = $("stage"), cs = getComputedStyle(stage);
    var aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ah = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    // desktop: the photo stays as tall as in Craig's frames at most (530 of 840), centred with room around it
    if (!MOBILE.matches) ah = Math.min(ah, stage.clientHeight * PHOTO_SHARE);
    var k = Math.min(aw / c.width, ah / c.height);
    c.style.width = Math.floor(c.width * k) + "px";
    c.style.height = Math.floor(c.height * k) + "px";
  }

  // ---------- loading ----------
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { setStatus("That file isn't an image."); return; }
    loadImage(URL.createObjectURL(file), (file.name || "photo").replace(/\.[^.]+$/, "") || "photo");
  }

  // Shows a photo in the editor. The current settings carry over, so they
  // never land on a photo unseen.
  function loadImage(url, name) {
    var img = new Image();
    img.onload = function () {
      source = img;
      fileBase = name;
      photoId++;
      previewBase = scaled(img, PREVIEW_MAX);
      draftBase = scaled(img, DRAFT_MAX);
      $("preview").hidden = false;
      $("download").disabled = false;
      var w = img.naturalWidth, h = img.naturalHeight;
      setStatus(w + " × " + h + (matchMedia("(pointer: fine)").matches ? " · press and hold the photo to see the original" : ""), true);
      $("preview").width = 0;   // force a resize on the next update
      update();
    };
    img.onerror = function () { setStatus("This browser can't open that image. Try a JPG or PNG."); };
    img.src = url;
  }

  // ---------- download ----------
  // The full-size run hands control back to the browser as it goes, so the page
  // keeps responding while a large photo is prepared.
  // If the browser runs out of image memory (iPhones cap it), it tries again
  // smaller, and says so. Effects are sized to the photo, so a smaller file looks the same.
  var FALLBACK_SIZES = [4000, 3000, 2000];
  var exporting = false;
  function toBlob(c, type, q) { return new Promise(function (r) { c.toBlob(r, type, q); }); }
  async function download() {
    if (!source || exporting) return;
    exporting = true;
    var settings = snapshot(), name = fileBase, blob = null, w = 0, h = 0;
    var type = settings.format === "png" ? "image/png" : "image/jpeg";
    var full = Math.min(EXPORT_MAX, Math.max(source.naturalWidth, source.naturalHeight));
    var sizes = [full].concat(FALLBACK_SIZES.filter(function (n) { return n < full; }));
    setStatus("Preparing full-size image…");
    await new Promise(function (r) { setTimeout(r, 30); });   // let the message show first
    for (var k = 0; k < sizes.length && !blob; k++) {
      if (k > 0) setStatus("Not enough memory for full size. Trying a smaller size…");
      var out = null;
      try {
        out = await processImage(scaled(source, sizes[k]), settings, true);
        w = out.width; h = out.height;
        blob = await toBlob(out, type, settings.quality / 100);
      } catch (e) { blob = null; }
      freeCanvas(out);   // hand the memory back before saving or trying again
    }
    exporting = false;
    if (!blob) { setStatus("Couldn't create the file. Try a smaller photo."); return; }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name + "-edited." + settings.format;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    setStatus("Saved " + a.download + " · " + w + " × " + h + (k > 1 ? " (smaller than full size: this browser ran out of memory)" : ""));
  }

  // ---------- controls ----------
  // `size` marks the photo-size line, which phones don't show (Figma); messages always show
  function setStatus(t, size) { $("status").textContent = t; $("status").classList.toggle("size", !!size); }

  // Sizes a field to fit the longest value it can hold, so every box of the
  // same kind is the same width (the font's digits and letters vary in width,
  // so fitting each value exactly made the boxes uneven).
  var measurer = document.createElement("canvas").getContext("2d");
  var widthCache = {};
  function fitText(el) {
    if (!/-hex$/.test(el.id)) return;   // number boxes are a fixed 48px; only hex codes are fitted
    var cs = getComputedStyle(el), font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    var hexField = /-hex$/.test(el.id), key = font + (hexField ? "hex" : "num");
    if (!widthCache[key]) {
      measurer.font = font;
      var chars = hexField ? "0123456789ABCDEF" : "0123456789", widest = 0;
      for (var i = 0; i < chars.length; i++) widest = Math.max(widest, measurer.measureText(chars[i]).width);
      var w = hexField ? measurer.measureText("#").width + widest * 6 : measurer.measureText("-").width + widest * 3;
      widthCache[key] = Math.ceil(w) + 2;
    }
    el.style.width = widthCache[key] + "px";
  }

  // fills the bar up to the value; sliders that run below 0 fill out from 0 in the middle
  function fill(el) {
    var min = +el.min, max = +el.max, t = (el.value - min) / (max - min) * 100;
    var from = 0, len = t;
    if (min < 0) { var zero = -min / (max - min) * 100; from = Math.min(t, zero); len = Math.abs(t - zero); }
    var f = el.previousElementSibling;
    f.style.left = from + "%"; f.style.width = len + "%";
  }
  // the value shown above a slider: Strength reads as a percentage
  function readout(k) {
    var text = s[k] + (k === "amount" ? "%" : "");
    $(k + "-value").textContent = text;
    if (k === "amount") $(k).setAttribute("aria-valuetext", text);   // screen readers say "100%", as shown
  }

  function syncControls() {
    SLIDERS.forEach(function (k) { $(k).value = s[k]; readout(k); fill($(k)); });
    ["dark", "mid", "light"].forEach(function (k) { $("c-" + k).value = s[k]; $("c-" + k + "-hex").value = s[k].toUpperCase(); fitText($("c-" + k + "-hex")); });
    ["mode", "format"].forEach(function (id) {
      $(id).querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.value === s[id]); });
    });
    $("mid-row").hidden = s.mode !== "tri";
    var set = s.mode === "tri" ? PRESETS : DUO_PRESETS;
    var current = (s.mode === "tri" ? [s.dark, s.mid, s.light] : [s.dark, s.light]).join().toLowerCase();
    $("presets").querySelectorAll(".preset").forEach(function (b, i) {
      b.setAttribute("aria-label", "Use colours " + set[i].join(", "));
      b.setAttribute("aria-pressed", set[i].join().toLowerCase() === current);   // the stroke marks the preset in use
      b.firstChild.innerHTML = set[i].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("");
    });
    $("colours").dataset.off = s.mode === "original";
    var png = s.format === "png";
    $("quality").disabled = png;
    $("quality-field").dataset.off = png;
  }

  function bind() {
    SLIDERS.forEach(function (k) {
      var slider = $(k), bar = slider.parentNode;
      slider.addEventListener("input", function () {
        s[k] = +slider.value; readout(k); fill(slider);
        if (k !== "quality") update();
      });
      function set(v) {
        v = Math.min(+slider.max, Math.max(+slider.min, Math.round(v)));
        if (v !== +slider.value) { slider.value = v; slider.dispatchEvent(new Event("input")); }
      }
      // arrow keys nudge by 1 (the browser's own), or 10 with Shift
      slider.addEventListener("keydown", function (e) {
        var dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (!dir || !e.shiftKey) return;
        e.preventDefault(); set(s[k] + dir * 10);
      });
      // mouse: the photo redraws at draft size while the bar is held, full size on release
      slider.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") sliding = true; });
      // touch: a tap or an up-down swipe does nothing, so a swipe down can close the menu
      // without changing a setting. Once a finger moves sideways, the value follows it from
      // where it was. The whole field (name, value and bar, 44px tall) takes the finger.
      var field = bar.closest(".field"), drag = null, SLOP = 4;
      field.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" || slider.disabled) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, v: +slider.value, on: false };
      });
      field.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.on) {
          if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
          if (Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }   // up or down: leave it to the menu
          drag.on = true; sliding = true; field.setPointerCapture(e.pointerId);
        }
        set(drag.v + dx / bar.clientWidth * (slider.max - slider.min));
      });
      function end() { drag = null; }
      field.addEventListener("pointerup", end);
      field.addEventListener("pointercancel", end);
    });
    // letting go of any slider: back to the full-size preview
    ["pointerup", "pointercancel"].forEach(function (t) {
      window.addEventListener(t, function () { if (sliding) { sliding = false; update(); } });
    });
    ["mode", "format"].forEach(function (id) {
      $(id).querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () { s[id] = b.dataset.value; syncControls(); if (id !== "format") update(); });
      });
    });
    ["dark", "mid", "light"].forEach(function (k) {
      $("c-" + k).addEventListener("input", function () { s[k] = $("c-" + k).value; $("c-" + k + "-hex").value = s[k].toUpperCase(); fitText($("c-" + k + "-hex")); update(); });
      $("c-" + k + "-hex").addEventListener("input", function () { fitText($("c-" + k + "-hex")); });
      $("c-" + k + "-hex").addEventListener("change", function () {
        var v = $("c-" + k + "-hex").value.trim();
        if (v[0] !== "#") v = "#" + v;
        if (/^#[0-9a-f]{3}$/i.test(v)) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        if (/^#[0-9a-f]{6}$/i.test(v)) { s[k] = v.toLowerCase(); update(); }
        syncControls();
      });
    });
    // one row of preset buttons; their chips are redrawn for the current mode in syncControls
    PRESETS.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "preset sq";
      b.innerHTML = '<span class="chips"></span>';
      b.addEventListener("click", function () {
        if (s.mode === "tri") { s.dark = PRESETS[i][0]; s.mid = PRESETS[i][1]; s.light = PRESETS[i][2]; }
        else { s.dark = DUO_PRESETS[i][0]; s.light = DUO_PRESETS[i][1]; }
        syncControls(); update();
      });
      $("presets").appendChild(b);
    });

    var file = $("file");
    $("choose").addEventListener("click", function () { file.click(); });
    $("choose-start").addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () { loadFile(file.files[0]); file.value = ""; });
    $("export-download").addEventListener("click", download);

    var stage = $("stage");
    stage.addEventListener("dragover", function (e) { e.preventDefault(); stage.classList.add("drop"); });
    stage.addEventListener("dragleave", function () { stage.classList.remove("drop"); });
    stage.addEventListener("drop", function (e) { e.preventDefault(); stage.classList.remove("drop"); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
    document.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.files) || [];
      if (items[0]) loadFile(items[0]);
    });

    // press and hold the photo to compare with the original
    var pv = $("preview");
    // Desktop only: phones and tablets have no compare, so the photo is just a picture.
    pv.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      pv.setPointerCapture(e.pointerId); showOriginal = true; update();
    });
    function release() { if (!showOriginal) return; showOriginal = false; update(); }
    pv.addEventListener("pointerup", release);
    pv.addEventListener("pointercancel", release);

    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d") { e.preventDefault(); download(); }
    });
    window.addEventListener("resize", fitPreview);
    // the photo area changes size when the panel opens or closes
    if ("ResizeObserver" in window) new ResizeObserver(fitPreview).observe(stage);
  }

  // ---------- rail and panel ----------
  // A section icon opens the panel scrolled to that section; with the panel
  // open it scrolls there instead; clicking the selected icon closes the panel.
  // Scrolling the panel by hand moves the selection to the section in view.
  function initRail() {
    var app = document.querySelector(".app"), panel = $("panel"), body = $("panel-body");
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".rail-btn[data-section]"));
    var names = buttons.map(function (b) { return b.dataset.section; });
    var current = null, jumping = false, jumpTimer = 0;
    var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

    function select(name) {
      current = name;
      if (name) panel.dataset.section = name; else delete panel.dataset.section;   // phones show only this section
      // screen readers hear "expanded" on the icon whose section is open, "collapsed" on the others
      buttons.forEach(function (b) { b.setAttribute("aria-expanded", b.dataset.section === name); });
    }
    function topOf(name) { return $("sec-" + name).offsetTop - parseFloat(getComputedStyle(body).paddingTop); }
    // While the panel scrolls itself to a section, the selection stays on the
    // section clicked (the last ones can't reach the top of the panel).
    function jumpTo(name, smooth) {
      if (MOBILE.matches) { body.scrollTop = 0; return; }   // one section at a time: start at its top
      smooth = smooth && !reduceMotion.matches;
      jumping = true; clearTimeout(jumpTimer);
      body.scrollTo({ top: topOf(name), behavior: smooth ? "smooth" : "auto" });
      jumpTimer = setTimeout(function () { jumping = false; }, smooth ? 700 : 50);
    }
    function open(name) { showSheet(panel); app.classList.add("open"); select(name); jumpTo(name, false); }
    function close(instant) { hideSheet(panel, instant); app.classList.remove("open"); select(null); }
    // the close-panel button in the panel's header; focus goes back to the rail icon that was selected
    $("close-panel").addEventListener("click", function () {
      var was = current && document.querySelector('.rail-btn[data-section="' + current + '"]');
      close();
      if (was) was.focus();
    });

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.dataset.section;
        if (!isShown(panel)) open(name);
        else if (name === current) close();
        else { select(name); jumpTo(name, true); }
      });
    });

    // the person takes over scrolling: follow them again straight away
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach(function (t) {
      body.addEventListener(t, function () { jumping = false; }, { passive: true });
    });
    body.addEventListener("scroll", function () {
      if (jumping || !isShown(panel) || MOBILE.matches) return;   // phones: scrolling stays within one section
      // The marker line slides from the top of the panel to the bottom as it
      // scrolls, so every section gets selected on the way down, even the
      // last ones that can never reach the top.
      var max = Math.max(1, body.scrollHeight - body.clientHeight);
      var pad = parseFloat(getComputedStyle(body).paddingTop);
      var line = body.scrollTop + pad + (body.clientHeight - pad) * Math.min(1, body.scrollTop / max);
      var pick = names[0];
      names.forEach(function (n) { if ($("sec-" + n).offsetTop <= line + 1) pick = n; });
      if (pick !== current) select(pick);
    }, { passive: true });

    // phones: swipe the sheet down to close it
    swipeToClose(panel, body, close);

    select(null);
    // the panel starts closed on every screen size
    return { close: close };
  }

  // Dragging a bottom sheet down (from the grabber, or from the top of its
  // scrolled content) moves it with the finger; let go far enough and it closes.
  // ---------- phone sheets: slide in and out ----------
  // Rules from Emil Kowalski's gestures skill: the iOS sheet curve (Vaul's) over 500ms,
  // transitions rather than keyframes so a sheet can be turned around mid-slide, a sheet
  // leaves the way it came (down), and a quick snap back when a swipe doesn't close it.
  // Phone menus (9 November) float above the bar: they fade in over the same 500ms
  // while rising RISE px, and fade out sinking the same way.
  // Reduced motion: they fade without moving. Desktop: no animation at all.
  var SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)", SNAP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
  var REDUCE = matchMedia("(prefers-reduced-motion: reduce)");
  var RISE = 8;   // space/100
  function animates() { return MOBILE.matches; }
  function rise() { return REDUCE.matches ? 0 : RISE; }
  function settle(el) { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; }
  function offset(el) { var m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform); return m ? +m[1] : 0; }
  function slide(el, to, ms, ease, done, opacity) {
    var token = (el._slide || 0) + 1; el._slide = token;
    el.style.transition = "transform " + ms + "ms " + ease + ", opacity " + ms + "ms " + ease;
    el.style.transform = "translateY(" + to + "px)";
    el.style.opacity = opacity == null ? "" : opacity;
    var finish = function () { if (el._slide !== token) return; el._slide++; done && done(); };
    el.addEventListener("transitionend", function te(e) { if (e.target === el) { el.removeEventListener("transitionend", te); finish(); } });
    setTimeout(finish, ms + 80);   // in case transitionend never fires
  }
  // The panel shows and hides with `hidden`; the Export dialog is the browser's own
  // dialog, opened as a modal (focus stays inside it) and closed with close().
  function isDialog(el) { return el.tagName === "DIALOG"; }
  function isOut(el) { return isDialog(el) ? !el.open : el.hidden; }
  function reveal(el) { if (isDialog(el)) { if (!el.open) el.showModal(); } else el.hidden = false; }
  function conceal(el) { if (isDialog(el)) { if (el.open) el.close(); } else el.hidden = true; }
  function isShown(el) { return !isOut(el) && !el.dataset.closing; }
  function showSheet(el) {
    var wasClosing = !!el.dataset.closing;
    delete el.dataset.closing;
    reveal(el);
    if (!animates()) { el._slide = (el._slide || 0) + 1; settle(el); return; }
    if (!wasClosing) {   // start faded out, a little low; mid-close it turns around from where it is
      el.style.transition = "none"; el.style.transform = "translateY(" + rise() + "px)"; el.style.opacity = "0"; el.offsetHeight;
    }
    slide(el, 0, 500, SHEET_EASE, function () { settle(el); }, "1");
  }
  function hideSheet(el, instant) {
    if (isOut(el)) return;
    if (instant || !animates()) { el._slide = (el._slide || 0) + 1; delete el.dataset.closing; conceal(el); settle(el); return; }
    el.dataset.closing = "1";
    // the dialog fades out as an ordinary (non-modal) one, so the page answers taps straight away
    if (isDialog(el) && el.matches(":modal")) { var t = el.style.transform, o = el.style.opacity; el.close(); el.show(); el.style.transform = t; el.style.opacity = o; }
    slide(el, offset(el) + rise(), 500, SHEET_EASE, function () { delete el.dataset.closing; conceal(el); settle(el); }, "0");   // from wherever a swipe left it
  }
  function resetSheetsOnResize() {   // crossing the phone/desktop line mid-slide: finish at once
    MOBILE.addEventListener("change", function () {
      document.querySelectorAll(".panel, .dialog-wrap").forEach(function (el) {
        el._slide = (el._slide || 0) + 1; settle(el);
        if (el.dataset.closing) { delete el.dataset.closing; conceal(el); }
      });
    });
  }

  // Swipe down to close. The sheet follows the finger exactly; on release it closes if
  // dragged 40% of its height or flicked down quickly, otherwise it snaps back.
  function swipeToClose(sheet, scroller, onClose) {
    var startY = null, startX = 0, locked = false, dy = 0, lastY = 0, lastT = 0, speed = 0;
    sheet.addEventListener("touchstart", function (e) {
      if (!MOBILE.matches || e.touches.length !== 1 || sheet.dataset.closing) return;
      startX = e.touches[0].clientX; locked = false;   // a sideways move belongs to a slider, never the menu
      var fromGrabber = e.target.classList.contains("grabber");
      startY = (fromGrabber || !scroller || scroller.scrollTop <= 0) ? e.touches[0].clientY : null;
      dy = 0; speed = 0; lastY = startY; lastT = e.timeStamp;
    }, { passive: true });
    sheet.addEventListener("touchmove", function (e) {
      if (startY === null) return;
      var y = e.touches[0].clientY;
      dy = y - startY;
      if (!locked) {   // wait for a clear direction before moving the menu
        var dx = e.touches[0].clientX - startX;
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        if (Math.abs(dx) > Math.abs(dy)) { startY = null; return; }
        locked = true;
      }
      if (e.timeStamp > lastT) { speed = (y - lastY) / (e.timeStamp - lastT); lastY = y; lastT = e.timeStamp; }
      if (dy <= 0) { sheet.style.transition = "none"; sheet.style.transform = ""; if (dy < -4) startY = null; return; }   // dragging up scrolls as usual
      if (e.cancelable) e.preventDefault();
      sheet._slide = (sheet._slide || 0) + 1;   // the finger takes over from any slide in progress
      sheet.style.transition = "none";
      sheet.style.transform = "translateY(" + dy + "px)";
    }, { passive: false });
    function end() {
      if (startY === null) return;
      startY = null;
      if (dy <= 0) { settle(sheet); return; }
      if (dy > sheet.offsetHeight * 0.4 || speed > 0.5) onClose();   // 0.5px per ms = a flick
      else if (REDUCE.matches) settle(sheet);
      else slide(sheet, 0, 200, SNAP_EASE, function () { settle(sheet); });
    }
    sheet.addEventListener("touchend", end);
    sheet.addEventListener("touchcancel", function () { startY = null; settle(sheet); });
  }

  // ---------- Export dialog ----------
  // The rail's Download button opens it (and shows as selected while it's
  // open); clicking it again, Esc, the phone's back gesture, or a click anywhere
  // outside closes it. The dialog's own Download button saves the file and closes it.
  // While it's open the rest of the page can't be reached (the browser's modal dialog),
  // so a click on a rail or bar button behind it is passed on to that button.
  function initExport(rail) {
    var wrap = $("export-dialog"), railBtn = $("download");
    function isOpen() { return isShown(wrap); }
    function open() {
      if (MOBILE.matches) rail.close(true);   // on phones only one sheet shows at a time: swap without a slide out
      showSheet(wrap); railBtn.setAttribute("aria-expanded", "true");
      // focus lands on the Export heading (it has autofocus), not on a button, so no focus ring
      // shows on JPG when the dialog is opened by a tap or click; Tab moves on to the controls
      $("export-title").focus();
    }
    function close(backToRail, instant) {
      if (!isOpen()) return;
      hideSheet(wrap, instant); railBtn.setAttribute("aria-expanded", "false");
      if (backToRail) railBtn.focus();
    }
    railBtn.setAttribute("aria-expanded", "false");
    railBtn.addEventListener("click", function () { if (isOpen()) close(); else open(); });
    $("export-download").addEventListener("click", function () { close(); });
    swipeToClose(wrap, null, function () { close(); });
    // Esc and the back gesture: close with the usual fade rather than at once
    wrap.addEventListener("cancel", function (e) { e.preventDefault(); close(true); });
    // closed by the browser itself (a repeated Esc): keep the rail button in step
    wrap.addEventListener("close", function () {
      if (!wrap.dataset.closing) { settle(wrap); railBtn.setAttribute("aria-expanded", "false"); }
    });
    // a press and release outside the dialog close it; on a rail or bar button, that button then acts
    function outside(e) {
      var r = wrap.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    }
    function buttonAt(x, y) {
      var hit = null;
      document.querySelectorAll(".rail .rail-btn").forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (!b.disabled && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = b;
      });
      return hit;
    }
    var pressedOutside = false;
    wrap.addEventListener("pointerdown", function (e) { pressedOutside = e.target === wrap && outside(e); });
    wrap.addEventListener("click", function (e) {
      if (!pressedOutside || e.target !== wrap || !outside(e)) return;
      pressedOutside = false;
      var btn = buttonAt(e.clientX, e.clientY);
      if (btn === railBtn) { close(); return; }   // the Download button toggles it closed
      close(false, !!btn);   // tapping another bar icon swaps sheets without a slide out
      if (btn) btn.click();
    });
  }

  // ---------- squircle corners ----------
  // Smoothed ("squircle") corners, using the same geometry as Figma's corner
  // smoothing at 100%. Each .sq element gets its outline and a 1px-inset copy
  // as clip paths; CSS uses them to draw a crisp 1px border with smooth corners.
  // `o` shifts the shape up and left, for the focus ring that sits outside the edge.
  function squirclePath(w, h, radius, o) {
    o = o || 0;
    var budget = Math.min(w, h) / 2, r = Math.min(radius, budget), sm = 1;
    if (r <= 0) return "M" + -o + " " + -o + " H" + (w - o) + " V" + (h - o) + " H" + -o + " Z";
    var rad = function (deg) { return deg * Math.PI / 180; };
    var p = (1 + sm) * r;
    var arcMeasure = 90 * (1 - sm);
    var arc = Math.sin(rad(arcMeasure / 2)) * r * Math.sqrt(2);
    var alpha = (90 - arcMeasure) / 2;
    var p3p4 = r * Math.tan(rad(alpha / 2));
    var beta = 45 * sm;
    var c = p3p4 * Math.cos(rad(beta));
    var d = c * Math.tan(rad(beta));
    var b = (p - arc - c - d) / 3, a = 2 * b;
    if (p > budget) {
      var avail = budget - d - arc - c, b2 = avail - avail / 6;
      b = Math.min(b, b2); a = avail - b; p = Math.min(p, budget);
    }
    var f = function (n) { return +n.toFixed(3); };
    var abc = a + b + c, bc = b + c, ab = a + b;
    return [
      "M", f(w - p - o), f(-o),
      "c", f(a), 0, f(ab), 0, f(abc), f(d),
      "a", f(r), f(r), 0, 0, 1, f(arc), f(arc),
      "c", f(d), f(c), f(d), f(bc), f(d), f(abc),
      "L", f(w - o), f(h - p - o),
      "c", 0, f(a), 0, f(ab), f(-d), f(abc),
      "a", f(r), f(r), 0, 0, 1, f(-arc), f(arc),
      "c", f(-c), f(d), f(-bc), f(d), f(-abc), f(d),
      "L", f(p - o), f(h - o),
      "c", f(-a), 0, f(-ab), 0, f(-abc), f(-d),
      "a", f(r), f(r), 0, 0, 1, f(-arc), f(-arc),
      "c", f(-d), f(-c), f(-d), f(-bc), f(-d), f(-abc),
      "L", f(-o), f(p - o),
      "c", 0, f(-a), 0, f(-ab), f(d), f(-abc),
      "a", f(r), f(r), 0, 0, 1, f(arc), f(-arc),
      "c", f(c), f(-d), f(bc), f(-d), f(abc), f(-d),
      "Z"
    ].join(" ");
  }

  function radiusOf(el) {
    if (el.type === "color") return 4;   // radius/xs: colour swatch
    if (el.classList.contains("dialog") || el.classList.contains("sq-sheet")) return 16;   // radius/lg
    return 8;                            // radius/sm everywhere else
  }

  var MOBILE = matchMedia("(max-width: 1023px)");

  var RING = 2;   // focus ring width, outside the edge
  function shape(el) {
    var w = el.offsetWidth, h = el.offsetHeight, r = radiusOf(el);
    if (!w || !h) return;
    var hh = h;
    el.style.setProperty("--sq-outer", "path('" + squirclePath(w, hh, r) + "')");
    el.style.setProperty("--sq-inner", "path('" + squirclePath(w - 2, hh - 2, r - 1) + "')");
    var ring = squirclePath(w + RING * 2, h + RING * 2, r + RING, RING);
    el.style.setProperty("--sq-ring", "path('" + ring + "')");
    // the band alone, in ::after's own coordinates (it starts 2px up and left):
    // the ring's outline with the element's outline cut out of it
    el.style.setProperty("--sq-band", "path(evenodd, '" + squirclePath(w + RING * 2, h + RING * 2, r + RING) + " " + squirclePath(w, h, r, -RING) + "')");
  }

  function initSquircles() {
    var els = document.querySelectorAll(".sq, .sq-sheet, input[type=color]");
    var ro = "ResizeObserver" in window ? new ResizeObserver(function (entries) { entries.forEach(function (e) { shape(e.target); }); }) : null;
    els.forEach(function (el) { shape(el); if (ro) ro.observe(el); });
    MOBILE.addEventListener("change", function () { els.forEach(shape); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { els.forEach(shape); });
  }

  // ---------- rail tooltips (desktop only) ----------
  // Each rail button's name, 16px to its right. After a short hover delay; once one has
  // shown, moving to the next button shows its tooltip straight away. Keyboard focus shows
  // it at once. It stays while the pointer is on the button or the tooltip itself (so the
  // pointer can move onto it, for people using screen magnifiers) or the button has focus,
  // and hides when they leave, on a click, or on Esc.
  function initTooltips() {
    var tip = $("tooltip"), box = tip.firstElementChild, timer = 0, coolTimer = 0, leaveTimer = 0, warm = false, current = null;
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".rail .rail-btn"));
    function show(btn, instant) {
      clearTimeout(timer); clearTimeout(coolTimer); clearTimeout(leaveTimer);
      if (MOBILE.matches) return;
      var r = btn.getBoundingClientRect();
      box.textContent = btn.getAttribute("aria-label");
      tip.style.left = (r.right + 16) + "px";   // space/300
      tip.style.top = (r.top + r.height / 2) + "px";
      tip.classList.toggle("instant", instant || warm);
      if (tip.hidden) { tip.classList.remove("on"); tip.hidden = false; tip.offsetHeight; }
      tip.classList.add("on");
      current = btn; warm = true;
    }
    function hide() {
      clearTimeout(timer); clearTimeout(leaveTimer);
      if (!current) return;
      current = null; tip.classList.remove("on"); tip.hidden = true;
      coolTimer = setTimeout(function () { warm = false; }, 300);
    }
    // leaving the button: a moment's grace to cross the 16px gap onto the tooltip
    function leave() {
      clearTimeout(timer); clearTimeout(leaveTimer);
      if (current && document.activeElement === current && current.matches(":focus-visible")) return;   // still focused by keyboard
      leaveTimer = setTimeout(hide, 150);
    }
    tip.addEventListener("mouseenter", function () { clearTimeout(leaveTimer); });
    tip.addEventListener("mouseleave", leave);
    buttons.forEach(function (btn) {
      btn.addEventListener("mouseenter", function () {
        clearTimeout(timer); clearTimeout(leaveTimer);
        if (warm || current) show(btn, true); else timer = setTimeout(function () { show(btn, false); }, 500);
      });
      btn.addEventListener("mouseleave", leave);
      btn.addEventListener("focus", function () { if (btn.matches(":focus-visible")) show(btn, true); });
      btn.addEventListener("blur", hide);
      btn.addEventListener("pointerdown", hide);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    MOBILE.addEventListener("change", hide);
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    initTooltips();
    initExport(initRail());
    resetSheetsOnResize();
    syncControls();
    initSquircles();
    // start empty: no photo until one is chosen, dropped or pasted (the + in the middle asks for one)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncControls);   // re-measure hex fields once the font is in
  });
})();
