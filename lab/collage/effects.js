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
    dark: PRESETS[0][0], mid: PRESETS[0][1], light: PRESETS[0][2],
    amount: 100,
    brightness: 0, contrast: 15, midtones: 0,
    grain: 40, grainSize: 2, speckle: 0,
    ink: "dark",
    quality: 92,
    format: "jpg"
  };
  var SLIDERS = ["amount", "brightness", "contrast", "midtones", "grain", "grainSize", "speckle", "quality"];

  var s = JSON.parse(JSON.stringify(DEFAULTS));
  var textureSeed = 1;
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
      if (tri) {
        if (l < 0.5) { var a = l * 2; cr = dk[0] + (md[0] - dk[0]) * a; cg = dk[1] + (md[1] - dk[1]) * a; cb = dk[2] + (md[2] - dk[2]) * a; }
        else { var c = (l - 0.5) * 2; cr = md[0] + (lt[0] - md[0]) * c; cg = md[1] + (lt[1] - md[1]) * c; cb = md[2] + (lt[2] - md[2]) * c; }
      } else {
        cr = dk[0] + (lt[0] - dk[0]) * l; cg = dk[1] + (lt[1] - dk[1]) * l; cb = dk[2] + (lt[2] - dk[2]) * l;
      }
      px[i]     = lut[r] * 255 * (1 - t) + cr * t;
      px[i + 1] = lut[g] * 255 * (1 - t) + cg * t;
      px[i + 2] = lut[b] * 255 * (1 - t) + cb * t;
    }
    ctx.putImageData(data, 0, 0);

    var inkHex = s.ink === "dark" ? s.dark : s.light;
    if (s.mode === "original") inkHex = s.ink === "dark" ? "#141414" : "#f2f2f2";
    if (s.speckle > 0) speckle(ctx, W, H, U, inkHex);
    if (s.grain > 0) grain(ctx, W, H, U);
    return out;
  }

  // Clusters of fine dots, like ink spatter or a rough print.
  function speckle(ctx, W, H, U, ink) {
    var fbm = makeNoise(textureSeed * 3 + 1), rand = mulberry32(textureSeed * 7 + 5);
    var cell = Math.max(1, Math.round(1.6 * U)), amt = s.speckle / 100, freq = 6 / Math.max(W, H);
    ctx.fillStyle = ink;
    for (var y = 0; y < H; y += cell) for (var x = 0; x < W; x += cell) {
      var nv = fbm(x * freq, y * freq, 5);
      var p = Math.max(0, (nv - (0.62 - amt * 0.22)) * 3.2) * amt;
      if (rand() < p) ctx.fillRect(x, y, cell, cell);
    }
  }

  // Film grain: light and dark specks, scaled to the photo.
  function grain(ctx, W, H, U) {
    var size = Math.max(1, s.grainSize * 0.8 * U), gw = Math.ceil(W / size), gh = Math.ceil(H / size);
    var g = canvasOf(gw, gh), gc = g.getContext("2d"), d = gc.createImageData(gw, gh), p = d.data, k = s.grain / 100 * 70;
    for (var i = 0; i < p.length; i += 4) {
      var nv = (Math.random() - 0.5) * k, v = nv > 0 ? 255 : 0;
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
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      source = img;
      fileBase = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
      previewBase = scaled(img, PREVIEW_MAX);
      $("file-name").textContent = file.name || "Pasted image";
      $("file-name").title = file.name || "";
      $("empty").hidden = true;
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

  function syncControls() {
    SLIDERS.forEach(function (k) { $(k).value = s[k]; $(k + "-value").textContent = s[k]; });
    ["dark", "mid", "light"].forEach(function (k) { $("c-" + k).value = s[k]; $("c-" + k + "-hex").value = s[k].toUpperCase(); });
    ["mode", "ink", "format"].forEach(function (id) {
      $(id).querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.value === s[id]); });
    });
    $("mid-row").hidden = s.mode !== "tri";
    $("colours").dataset.off = s.mode === "original";
    $("quality").disabled = s.format === "png";
  }

  function bind() {
    SLIDERS.forEach(function (k) {
      $(k).addEventListener("input", function () {
        s[k] = +$(k).value; $(k + "-value").textContent = s[k];
        if (k !== "quality") update();
      });
    });
    ["mode", "ink", "format"].forEach(function (id) {
      $(id).querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () { s[id] = b.dataset.value; syncControls(); if (id !== "format") update(); });
      });
    });
    ["dark", "mid", "light"].forEach(function (k) {
      $("c-" + k).addEventListener("input", function () { s[k] = $("c-" + k).value; $("c-" + k + "-hex").value = s[k].toUpperCase(); update(); });
      $("c-" + k + "-hex").addEventListener("change", function () {
        var v = $("c-" + k + "-hex").value.trim();
        if (v[0] !== "#") v = "#" + v;
        if (/^#[0-9a-f]{3}$/i.test(v)) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        if (/^#[0-9a-f]{6}$/i.test(v)) { s[k] = v.toLowerCase(); update(); }
        syncControls();
      });
    });
    PRESETS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "preset"; b.setAttribute("aria-label", "Use colours " + p.join(", "));
      b.innerHTML = p.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("");
      b.addEventListener("click", function () { s.dark = p[0]; s.mid = p[1]; s.light = p[2]; syncControls(); update(); });
      $("presets").appendChild(b);
    });
    $("swap").addEventListener("click", function () { var t = s.dark; s.dark = s.light; s.light = t; syncControls(); update(); });
    $("reseed").addEventListener("click", function () { textureSeed = Math.floor(Math.random() * 1e6) + 1; update(); });
    $("reset").addEventListener("click", function () { var f = s.format; s = JSON.parse(JSON.stringify(DEFAULTS)); s.format = f; syncControls(); update(); });

    var file = $("file");
    ["choose", "choose-3"].forEach(function (id) { $(id).addEventListener("click", function () { file.click(); }); });
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

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    syncControls();
  });
})();
