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
  var EXPORT_MAX = 6000;    // longest side of a download

  // Two-colour sets for Duotone: a deep shadow and a lighter tint of the same hue.
  var DUO_PRESETS = [
    ["#2b2418", "#e9b45a"],  // ochre
    ["#0f1d3d", "#7fa8f0"],  // cobalt
    ["#1f2a0c", "#b9d36a"],  // moss
    ["#2a1a14", "#f08a5d"],  // rust
    ["#2a1f22", "#f0b8b8"],  // rose
    ["#1e2633", "#b8c4d8"],  // slate
    ["#000000", "#ffffff"]   // black and white
  ];
  // Three-colour sets for Tritone: shadow, midtone, highlight.
  var PRESETS = [
    ["#2e291f", "#a8701f", "#e9dfc4"],  // ochre
    ["#14213d", "#4a7fd8", "#e2ddcb"],  // cobalt
    ["#2f3a10", "#6f8f2a", "#dbe8b4"],  // moss
    ["#2e2929", "#d75a2e", "#f2e8da"],  // rust
    ["#2c2a26", "#e0a3a3", "#f4e6df"],  // rose
    ["#2c3442", "#7d8aa3", "#e6e8ec"],  // slate
    ["#000000", "#808080", "#ffffff"]   // black and white
  ];

  var DEFAULTS = {
    mode: "duo",
    dark: DUO_PRESETS[0][0], mid: PRESETS[0][1], light: DUO_PRESETS[0][1],
    amount: 100,
    brightness: 0, contrast: 15, midtones: 0,
    grain: 40, grainSize: 2, speckle: 0,
    misregister: 0, vignette: 0,
    quality: 92,
    format: "jpg"
  };
  var SLIDERS = ["amount", "brightness", "contrast", "midtones", "misregister", "vignette",
                 "grain", "grainSize", "speckle", "quality"];

  var s = JSON.parse(JSON.stringify(DEFAULTS));
  var textureSeed = 1;   // fixed, so textures look the same every time
  var source = null;     // the loaded Image
  var fileBase = "photo";
  var previewBase = null; // source scaled to preview size
  var showOriginal = false;

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function canvasOf(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function scaled(img, max) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(iw, ih));
    var c = canvasOf(iw * k, ih * k), ctx = c.getContext("2d");
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

  // ---------- processing ----------
  // Runs every step on `base` (a canvas holding the photo) and returns a new
  // canvas. Sizes are relative to the photo, so preview and download match.
  function processImage(base) {
    var W = base.width, H = base.height, U = Math.max(W, H) / 2000;   // 1 unit ≈ 1px on a 2000px photo
    var out = canvasOf(W, H), ctx = out.getContext("2d");
    ctx.drawImage(base, 0, 0);
    var data = ctx.getImageData(0, 0, W, H), px = data.data, i;

    // levels from the histogram, so the colours always reach full range
    var hist = new Uint32Array(256), n = px.length / 4;
    for (i = 0; i < px.length; i += 4) hist[(px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) | 0]++;
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
    for (i = 0; i < px.length; i += 4) {
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
    ctx.putImageData(data, 0, 0);

    if (s.misregister > 0) misregister(ctx, W, H, U);
    if (s.vignette > 0) vignette(ctx, W, H, s.mode === "original" ? "#000000" : s.dark);

    // speckle is printed in the shadow colour (near-black in Original mode)
    if (s.speckle > 0) speckle(ctx, W, H, U, s.mode === "original" ? "#141414" : s.dark);
    if (s.grain > 0) grain(ctx, W, H, U);
    return out;
  }

  // ---------- print effects ----------
  // Slips the red and blue channels apart, like plates printed slightly out of
  // line. Each shifted channel is spread across a few nearby offsets and mostly
  // (85%) mixed in: a clearly visible offset whose fringe edges fade instead of
  // ending in a hard line. (A full hard shift was too harsh; a wide spread at
  // 60% and 8px was too faint.)
  function misregister(ctx, W, H, U) {
    var d = s.misregister / 100 * 14 * U;
    if (d < 0.5) return;
    var img = ctx.getImageData(0, 0, W, H), src = new Uint8ClampedArray(img.data), p = img.data;
    var taps = [0.55, 0.7, 0.85, 1], mix = 0.85;
    function at(x, y, c) {
      x = x < 0 ? 0 : x > W - 1 ? W - 1 : x | 0; y = y < 0 ? 0 : y > H - 1 ? H - 1 : y | 0;
      return src[(y * W + x) * 4 + c];
    }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = (y * W + x) * 4, r = 0, b = 0;
      for (var t = 0; t < 4; t++) {
        var o = d * taps[t];
        r += at(x + o, y + o * 0.5, 0);
        b += at(x - o, y - o * 0.5, 2);
      }
      p[i] = src[i] * (1 - mix) + r / 4 * mix;
      p[i + 2] = src[i + 2] * (1 - mix) + b / 4 * mix;
    }
    ctx.putImageData(img, 0, 0);
  }


  // Darkens the edges toward the shadow colour.
  function vignette(ctx, W, H, colour) {
    var c = hex(colour), r = Math.sqrt(W * W + H * H) / 2, k = s.vignette / 100;
    var g = ctx.createRadialGradient(W / 2, H / 2, r * (0.75 - k * 0.45), W / 2, H / 2, r);
    g.addColorStop(0, "rgba(" + c + ",0)");
    g.addColorStop(1, "rgba(" + c + "," + (0.25 + k * 0.6).toFixed(3) + ")");
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // Speckle: small round specks, gathered in drifts like dust or ink spatter.
  // (Larger blots were tried and removed: Craig prefers only the small ones.)
  function speckle(ctx, W, H, U, ink) {
    var fbm = makeNoise(textureSeed * 3 + 1), rand = mulberry32(textureSeed * 7 + 5);
    var amt = s.speckle / 100, freq = 5 / Math.max(W, H);
    var tries = Math.round(W * H / (U * U) * 0.07 * amt), TAU = Math.PI * 2;
    ctx.save();
    ctx.fillStyle = ink;
    for (var n = 0; n < tries; n++) {
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
  function grain(ctx, W, H, U) {
    var rand = mulberry32(textureSeed * 17 + 9);
    var size = Math.max(1, s.grainSize * 0.8 * U), gw = Math.ceil(W / size), gh = Math.ceil(H / size);
    var g = canvasOf(gw, gh), gc = g.getContext("2d"), d = gc.createImageData(gw, gh), p = d.data, k = s.grain / 100 * 70;
    for (var i = 0; i < p.length; i += 4) {
      var nv = (rand() - 0.5) * k, v = nv > 0 ? 255 : 0;
      p[i] = v; p[i + 1] = v; p[i + 2] = v; p[i + 3] = Math.abs(nv) * 2;
    }
    gc.putImageData(d, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = size > 1.5;
    ctx.drawImage(g, 0, 0, gw * size, gh * size);
    ctx.restore();
  }




  // ---------- preview ----------
  var queued = false;
  function update() {
    if (!previewBase || queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var out = showOriginal ? previewBase : processImage(previewBase);
      var c = $("preview");
      if (c.width !== out.width || c.height !== out.height) { c.width = out.width; c.height = out.height; fitPreview(); }
      c.getContext("2d").drawImage(out, 0, 0);
    });
  }

  function fitPreview() {
    var c = $("preview");
    if (!previewBase) return;
    if (window.innerWidth < 820) { c.style.width = "100%"; c.style.height = "auto"; return; }
    var stage = $("stage"), cs = getComputedStyle(stage);
    var aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ah = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
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
      previewBase = scaled(img, PREVIEW_MAX);
      $("preview").hidden = false;
      $("download").disabled = false;
      var w = img.naturalWidth, h = img.naturalHeight;
      setStatus(w + " × " + h + " · press and hold the photo to see the original");
      $("preview").width = 0;   // force a resize on the next update
      update();
    };
    img.onerror = function () { setStatus("This browser can't open that image. Try a JPG or PNG."); };
    img.src = url;
  }

  // ---------- download ----------
  function download() {
    if (!source) return;
    setStatus("Preparing full-size image…");
    setTimeout(function () {
      var out = processImage(scaled(source, EXPORT_MAX));
      var type = s.format === "png" ? "image/png" : "image/jpeg";
      out.toBlob(function (blob) {
        if (!blob) { setStatus("Couldn't create the file."); return; }
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileBase + "-edited." + s.format;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        setStatus("Saved " + a.download + " · " + out.width + " × " + out.height);
      }, type, s.quality / 100);
    }, 30);
  }

  // ---------- controls ----------
  function setStatus(t) { $("status").textContent = t; }

  // Sizes a field to fit the longest value it can hold, so every box of the
  // same kind is the same width (the font's digits and letters vary in width,
  // so fitting each value exactly made the boxes uneven).
  var measurer = document.createElement("canvas").getContext("2d");
  var widthCache = {};
  function fitText(el) {
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

  // fills the slider track up to the thumb
  function fill(el) { el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min) * 100) + "%"); }

  function syncControls() {
    SLIDERS.forEach(function (k) { $(k).value = s[k]; $(k + "-value").value = s[k]; fitText($(k + "-value")); fill($(k)); });
    ["dark", "mid", "light"].forEach(function (k) { $("c-" + k).value = s[k]; $("c-" + k + "-hex").value = s[k].toUpperCase(); fitText($("c-" + k + "-hex")); });
    ["mode", "format"].forEach(function (id) {
      $(id).querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.value === s[id]); });
    });
    $("mid-row").hidden = s.mode !== "tri";
    var set = s.mode === "tri" ? PRESETS : DUO_PRESETS;
    $("presets").querySelectorAll(".preset").forEach(function (b, i) {
      b.setAttribute("aria-label", "Use colours " + set[i].join(", "));
      b.firstChild.innerHTML = set[i].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("");
    });
    $("colours").dataset.off = s.mode === "original";
    var png = s.format === "png";
    $("quality").disabled = png; $("quality-value").disabled = png;
    $("quality-field").dataset.off = png;
  }

  function bind() {
    SLIDERS.forEach(function (k) {
      $(k).addEventListener("input", function () {
        s[k] = +$(k).value; $(k + "-value").value = s[k]; fitText($(k + "-value")); fill($(k));
        if (k !== "quality") update();
      });
      // the number box: type a value and press Enter (or click away); arrow keys nudge by 1, Shift by 10
      var box = $(k + "-value"), slider = $(k);
      function commit(v) {
        var min = +slider.min, max = +slider.max;
        v = Math.round(+v);
        if (isNaN(v)) v = s[k];
        v = Math.min(max, Math.max(min, v));
        s[k] = v; slider.value = v; box.value = v; fitText(box); fill(slider);
        if (k !== "quality") update();
      }
      box.addEventListener("input", function () { box.value = box.value.replace(/[^0-9-]/g, ""); fitText(box); });
      box.addEventListener("change", function () { commit(box.value); });
      box.addEventListener("focus", function () { box.select(); });
      box.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { commit(box.value); box.blur(); }
        else if (e.key === "Escape") { box.value = s[k]; fitText(box); box.blur(); }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          commit(s[k] + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
        }
      });
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
      b.type = "button"; b.className = "preset";
      b.innerHTML = '<span class="chips"></span>';
      b.addEventListener("click", function () {
        if (s.mode === "tri") { s.dark = PRESETS[i][0]; s.mid = PRESETS[i][1]; s.light = PRESETS[i][2]; }
        else { s.dark = DUO_PRESETS[i][0]; s.light = DUO_PRESETS[i][1]; }
        syncControls(); update();
      });
      $("presets").appendChild(b);
    });
    $("swap").addEventListener("click", function () { var t = s.dark; s.dark = s.light; s.light = t; syncControls(); update(); });
    $("reset").addEventListener("click", function () { var f = s.format; s = JSON.parse(JSON.stringify(DEFAULTS)); s.format = f; syncControls(); update(); });

    var file = $("file");
    $("choose").addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () { loadFile(file.files[0]); file.value = ""; });
    $("download").addEventListener("click", download);

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
    pv.addEventListener("pointerdown", function (e) { showOriginal = true; pv.setPointerCapture(e.pointerId); update(); });
    function release() { if (!showOriginal) return; showOriginal = false; update(); }
    pv.addEventListener("pointerup", release);
    pv.addEventListener("pointercancel", release);

    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d") { e.preventDefault(); download(); }
    });
    window.addEventListener("resize", fitPreview);
  }

  // ---------- squircle corners ----------
  // Smoothed ("squircle") corners, using the same geometry as Figma's corner
  // smoothing at 100%. Each .sq element gets its outline and a 1px-inset copy
  // as clip paths; CSS uses them to draw a crisp 1px border with smooth corners.
  function squirclePath(w, h, radius) {
    var budget = Math.min(w, h) / 2, r = Math.min(radius, budget), sm = 1;
    if (r <= 0) return "M0 0 H" + w + " V" + h + " H0 Z";
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
      "M", f(w - p), 0,
      "c", f(a), 0, f(ab), 0, f(abc), f(d),
      "a", f(r), f(r), 0, 0, 1, f(arc), f(arc),
      "c", f(d), f(c), f(d), f(bc), f(d), f(abc),
      "L", f(w), f(h - p),
      "c", 0, f(a), 0, f(ab), f(-d), f(abc),
      "a", f(r), f(r), 0, 0, 1, f(-arc), f(arc),
      "c", f(-c), f(d), f(-bc), f(d), f(-abc), f(d),
      "L", f(p), f(h),
      "c", f(-a), 0, f(-ab), 0, f(-abc), f(-d),
      "a", f(r), f(r), 0, 0, 1, f(-arc), f(-arc),
      "c", f(-d), f(-c), f(-d), f(-bc), f(-d), f(-abc),
      "L", 0, f(p),
      "c", 0, f(-a), 0, f(-ab), f(d), f(-abc),
      "a", f(r), f(r), 0, 0, 1, f(arc), f(-arc),
      "c", f(c), f(-d), f(bc), f(-d), f(abc), f(-d),
      "Z"
    ].join(" ");
  }

  function radiusOf(el) {
    if (el.type === "color") return 5;
    return 8;
  }

  function shape(el) {
    var w = el.offsetWidth, h = el.offsetHeight, r = radiusOf(el);
    if (!w || !h) return;
    el.style.setProperty("--sq-outer", "path('" + squirclePath(w, h, r) + "')");
    el.style.setProperty("--sq-inner", "path('" + squirclePath(w - 2, h - 2, r - 1) + "')");
  }

  function initSquircles() {
    var els = document.querySelectorAll(".sq, input[type=color]");
    var ro = "ResizeObserver" in window ? new ResizeObserver(function (entries) { entries.forEach(function (e) { shape(e.target); }); }) : null;
    els.forEach(function (el) { shape(el); if (ro) ro.observe(el); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { els.forEach(shape); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    syncControls();
    initSquircles();
    // start with a sample photo from the gallery, so the controls are live straight away
    loadImage("sample.jpg", "dead-rat");
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncControls);   // re-measure hex fields once the font is in
  });
})();
