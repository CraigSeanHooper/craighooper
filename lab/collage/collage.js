/*
  Collage — arranges photos from the gallery into editorial-style collages.

  Only photos are used. Each one is cropped, given levels and contrast, and
  blended toward a two-tone pair from the chosen palette. Pieces can be
  dragged by hand. A seed plus the slider values always rebuild the same
  picture, and the page address carries both so a result can be bookmarked.
*/
(function () {
  "use strict";

  // Where gallery photos come from. ?gallery=… overrides it (used for testing).
  var params = new URLSearchParams(location.search);
  var GALLERY = (params.get("gallery") || "https://photos.craighooper.xyz").replace(/\/$/, "");

  var PALETTES = {
    mesa:    { name: "Mesa",    paper: "#2e291f", colours: ["#a8701f", "#4a7fd8", "#d8d2bc", "#8f887a", "#1d1a13"] },
    badger:  { name: "Badger",  paper: "#e3ebde", colours: ["#2f3a10", "#b3d966", "#b1a78f", "#8a6c48", "#2b2b2c", "#6f8f2a"] },
    tongass: { name: "Tongass", paper: "#f4f1ea", colours: ["#2e2929", "#835639", "#776b35", "#d75a2e", "#aca083", "#cfc8bd"] },
    bureau:  { name: "Bureau",  paper: "#3c4555", colours: ["#5b6577", "#e0a3a3", "#5a3829", "#b5a47c", "#2c2a26", "#a3aec0"] },
    signal:  { name: "Signal",  paper: "#ffffff", colours: ["#000000", "#e8452f", "#1f6feb", "#f2c230", "#e9e6df"] }
  };

  var FORMATS = {
    "4:5":  [1600, 2000],
    "1:1":  [2000, 2000],
    "3:2":  [2400, 1600],
    "16:9": [2560, 1440]
  };

  // Sliders: key → [default, hash name, what changing it redoes].
  // "layout" rebuilds the arrangement; "image" repaints the same arrangement
  // and keeps anything moved by hand; "grain" and "draw" are cheaper still.
  var SLIDERS = {
    count:    [6,   "n", "layout"],
    gap:      [20,  "g", "layout"],
    margin:   [50,  "m", "layout"],
    variety:  [50,  "v", "layout"],
    zoom:     [30,  "z", "image"],
    contrast: [55,  "k", "image"],
    tone:     [100, "t", "image"],
    grain:    [55,  "r", "grain"],
    shadow:   [20,  "s", "draw"]
  };

  var state = {
    seed: randomSeed(),
    palette: "mesa",
    layout: "grid",
    format: "3:2",
    photos: [],        // { title, src, fallback } from the gallery
    ownPhotos: [],     // { title, img } added from this computer
    cache: {},         // src -> Promise<Image>
    moves: {},         // piece id -> { x, y } set by dragging
    z: null,           // piece ids in drawing order, once anything is dragged
    layoutKey: ""
  };
  Object.keys(SLIDERS).forEach(function (k) { state[k] = SLIDERS[k][0]; });

  // ---------- random ----------
  function randomSeed() { return Math.floor(Math.random() * 99999) + 1; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = Math.random;
  function rr(a, b) { return a + rnd() * (b - a); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- colour ----------
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function lum(h) { var c = hex(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  // Two palette colours with enough contrast; darker one first.
  function pairFrom(colours) {
    for (var k = 0; k < 30; k++) {
      var a = colours[Math.floor(rnd() * colours.length)], b = colours[Math.floor(rnd() * colours.length)];
      if (Math.abs(lum(a) - lum(b)) > 0.3) return lum(a) < lum(b) ? [a, b] : [b, a];
    }
    var sorted = colours.slice().sort(function (x, y) { return lum(x) - lum(y); });
    return [sorted[0], sorted[sorted.length - 1]];
  }

  // ---------- photos ----------
  function loadImage(src, fallback) {
    if (state.cache[src]) return state.cache[src];
    state.cache[src] = new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        if (!fallback) { reject(new Error("image")); return; }
        var img2 = new Image();
        img2.crossOrigin = "anonymous";
        img2.onload = function () { resolve(img2); };
        img2.onerror = function () { reject(new Error("image")); };
        img2.src = fallback;
      };
      img.src = src;
    });
    return state.cache[src];
  }

  function fetchGallery() {
    return fetch(GALLERY + "/photos.json")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        state.photos = list.map(function (p) {
          return {
            title: p.title || "",
            src: GALLERY + "/.netlify/images?url=" + encodeURIComponent(p.image) + "&w=1600&fm=jpg",
            fallback: GALLERY + p.image
          };
        });
      })
      .catch(function () { state.photos = []; });
  }

  // Choose the photos one composition needs (repeating only when there are
  // more pieces than photos), then load just those.
  function choosePhotos(n) {
    var pool = state.ownPhotos.concat(state.photos);
    if (!pool.length) return Promise.resolve([]);
    var chosen = [];
    while (chosen.length < n) chosen = chosen.concat(shuffle(pool));
    return Promise.all(chosen.slice(0, n).map(function (p) {
      if (p.img) return Promise.resolve(p.img);
      return loadImage(p.src, p.fallback).catch(function () { return null; });
    }));
  }

  function offscreen(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  // Paints one photo into a w×h piece. `crop` holds random choices made when
  // the arrangement was built, so image sliders never change the framing.
  function paintPhoto(w, h, img, crop, pair) {
    var c = offscreen(w, h), ctx = c.getContext("2d");
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var ar = c.width / c.height, zoom = 1 + state.zoom / 100 * 2.5;
    var cw = Math.min(iw, ih * ar) / zoom, ch = cw / ar;
    ctx.drawImage(img, crop.fx * (iw - cw), crop.fy * (ih - ch), cw, ch, 0, 0, c.width, c.height);

    var data = ctx.getImageData(0, 0, c.width, c.height), px = data.data, i;
    // levels from the histogram so every photo reaches both inks
    var hist = new Uint32Array(256), n = px.length / 4;
    for (i = 0; i < px.length; i += 4) hist[(px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) | 0]++;
    var lo = 0, hi = 255, acc = 0;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
    acc = 0;
    for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.02) { hi = i; break; } }
    var range = Math.max(1, hi - lo);

    // contrast: 50 is neutral, lower flattens, higher punches
    var cv = state.contrast, k = cv <= 50 ? 0.35 + 0.65 * cv / 50 : 1 + (cv - 50) / 50 * 1.6;
    var t = state.tone / 100, dk = hex(pair[0]), lt = hex(pair[1]), g = crop.gamma;
    function curve(v) { v = (v - lo) / range; v = (v - 0.5) * k + 0.5; return v < 0 ? 0 : v > 1 ? 1 : v; }
    for (i = 0; i < px.length; i += 4) {
      var r = px[i], gr = px[i + 1], b = px[i + 2];
      var l = curve(r * 0.2126 + gr * 0.7152 + b * 0.0722) + (Math.random() - 0.5) * 0.12;
      l = Math.pow(l < 0 ? 0 : l > 1 ? 1 : l, g);
      px[i]     = curve(r) * 255 * (1 - t) + (dk[0] + (lt[0] - dk[0]) * l) * t;
      px[i + 1] = curve(gr) * 255 * (1 - t) + (dk[1] + (lt[1] - dk[1]) * l) * t;
      px[i + 2] = curve(b) * 255 * (1 - t) + (dk[2] + (lt[2] - dk[2]) * l) * t;
    }
    ctx.putImageData(data, 0, 0);
    return c;
  }

  // ---------- layouts ----------
  function frame(W, H) {
    var base = Math.min(W, H);
    return { m: state.margin / 100 * base * 0.2, gap: state.gap / 100 * base * 0.06 };
  }

  // Grid: split the frame into exactly `count` blocks, separated by the gap.
  // Variety 0 gives even halves along the long side; 100 gives uneven cuts.
  function gridLayout(W, H) {
    var f = frame(W, H), v = state.variety / 100;
    var rects = [{ x: f.m, y: f.m, w: W - 2 * f.m, h: H - 2 * f.m }];
    while (rects.length < state.count) {
      rects.sort(function (a, b) { return b.w * b.h - a.w * a.h; });
      var r = rects.shift();
      var longSide = r.w > r.h;
      var vertical = rnd() < 1 - v * 0.3 ? longSide : !longSide;
      var cut = 0.5 + (rnd() - 0.5) * v * 0.7;
      if (vertical) rects.push({ x: r.x, y: r.y, w: r.w * cut, h: r.h }, { x: r.x + r.w * cut, y: r.y, w: r.w * (1 - cut), h: r.h });
      else rects.push({ x: r.x, y: r.y, w: r.w, h: r.h * cut }, { x: r.x, y: r.y + r.h * cut, w: r.w, h: r.h * (1 - cut) });
    }
    // pull every inner edge in by half the gap; outer edges stay on the margin
    var right = W - f.m, bottom = H - f.m, half = f.gap / 2, e = 0.5;
    return rects.map(function (r) {
      var l = r.x > f.m + e ? half : 0, t = r.y > f.m + e ? half : 0;
      var rt = r.x + r.w < right - e ? half : 0, b = r.y + r.h < bottom - e ? half : 0;
      return { x: r.x + l, y: r.y + t, w: Math.max(1, r.w - l - rt), h: Math.max(1, r.h - t - b) };
    });
  }

  // Scatter: one photo per cell of a loose grid, jittered so pieces overlap.
  // Gap shrinks the pieces; variety loosens sizes and positions.
  function scatterLayout(W, H) {
    var f = frame(W, H), v = state.variety / 100, n = state.count, out = [];
    var aw = W - 2 * f.m, ah = H - 2 * f.m;
    var cols = Math.max(1, Math.round(Math.sqrt(n * aw / ah))), rows = Math.ceil(n / cols);
    var cw = aw / cols, ch = ah / rows, scale = 1.3 - state.gap / 100 * 0.75;
    var cells = [];
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) cells.push([x, y]);
    shuffle(cells).slice(0, n).forEach(function (c) {
      var w = cw * scale * (1 + (rnd() - 0.5) * v * 0.7), h = ch * scale * (1 + (rnd() - 0.5) * v * 0.7);
      var cx = f.m + (c[0] + 0.5) * cw + (rnd() - 0.5) * v * 0.5 * cw;
      var cy = f.m + (c[1] + 0.5) * ch + (rnd() - 0.5) * v * 0.5 * ch;
      out.push({ x: cx - w / 2, y: cy - h / 2, w: w, h: h });
    });
    return out;
  }

  // ---------- compose ----------
  // build(): arrangement, crops and photo picks (seed + composition sliders).
  // paint(): turns those into piece canvases (palette + image sliders).
  // draw():  places pieces, shadows and grain; cheap enough to run on drag.
  var plan = null, comp = null, grainLayer = null;
  var busy = false, queued = false;

  function layoutKey() {
    return [state.seed, state.layout, state.format, state.count, state.gap, state.margin, state.variety, state.ownPhotos.length].join("|");
  }

  function build() {
    if (busy) { queued = true; return; }
    busy = true;
    var size = FORMATS[state.format], W = size[0], H = size[1];
    var key = layoutKey();
    if (key !== state.layoutKey) { state.moves = {}; state.z = null; state.layoutKey = key; }

    rnd = mulberry32(state.seed);
    var rects = state.layout === "grid" ? gridLayout(W, H) : scatterLayout(W, H);
    rnd = mulberry32(state.seed * 31 + 7);
    var crops = rects.map(function () {
      return { fx: rnd(), fy: rnd(), gamma: rr(0.85, 1.2), pairSeed: (rnd() * 1e9) | 0 };
    });

    setStatus("Loading photos…");
    rnd = mulberry32(state.seed * 13 + 1);
    choosePhotos(rects.length).then(function (imgs) {
      plan = { W: W, H: H, S: Math.max(W, H) / 2000, rects: rects, crops: crops, imgs: imgs };
      busy = false;
      if (queued) { queued = false; build(); return; }
      paint();
    });
  }

  function paint() {
    if (!plan || busy) return;
    var pal = PALETTES[state.palette], pieces = [];
    plan.rects.forEach(function (r, id) {
      var img = plan.imgs[id];
      if (!img) return;
      rnd = mulberry32(plan.crops[id].pairSeed);
      var canvas = paintPhoto(r.w, r.h, img, plan.crops[id], pairFrom(pal.colours));
      var moved = state.moves[id];
      pieces.push({ id: id, canvas: canvas, x: moved ? moved.x : r.x, y: moved ? moved.y : r.y });
    });
    if (state.z) pieces.sort(function (a, b) { return state.z.indexOf(a.id) - state.z.indexOf(b.id); });
    comp = { W: plan.W, H: plan.H, S: plan.S, paper: pal.paper, pieces: pieces };

    var canvas = document.getElementById("collage");
    if (canvas.width !== plan.W || canvas.height !== plan.H) { canvas.width = plan.W; canvas.height = plan.H; }
    if (!grainLayer || grainLayer.width !== plan.W || grainLayer.height !== plan.H) makeGrain();
    draw();
    document.getElementById("seed").textContent = state.seed;
    setStatus(pieces.length ? "Drag photos to move them" : "No photos loaded — add your own.");
    writeHash();
  }

  function draw() {
    if (!comp) return;
    var ctx = document.getElementById("collage").getContext("2d"), sh = state.shadow / 100, S = comp.S;
    ctx.fillStyle = comp.paper; ctx.fillRect(0, 0, comp.W, comp.H);
    comp.pieces.forEach(function (p) {
      ctx.save();
      var depth = sh + (p === dragging ? 0.4 : 0);
      if (depth > 0) {
        ctx.shadowColor = "rgba(0,0,0," + Math.min(0.6, 0.15 + depth * 0.3) + ")";
        ctx.shadowBlur = depth * 36 * S; ctx.shadowOffsetY = depth * 12 * S;
      }
      ctx.drawImage(p.canvas, Math.round(p.x), Math.round(p.y));
      ctx.restore();
    });
    if (grainLayer) ctx.drawImage(grainLayer, 0, 0);
  }

  // Grain sits on its own layer: light and dark specks over everything.
  function makeGrain() {
    var amt = state.grain / 100;
    if (!plan || amt <= 0) { grainLayer = null; return; }
    grainLayer = offscreen(plan.W, plan.H);
    var g = grainLayer.getContext("2d"), data = g.createImageData(plan.W, plan.H), px = data.data, k = amt * 60;
    for (var i = 0; i < px.length; i += 4) {
      var n = (Math.random() - 0.5) * k, v = n > 0 ? 255 : 0;
      px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = Math.abs(n) * 2;
    }
    g.putImageData(data, 0, 0);
  }

  // ---------- dragging ----------
  var dragging = null, grab = null;

  function toCanvas(e) {
    var c = document.getElementById("collage"), b = c.getBoundingClientRect();
    return { x: (e.clientX - b.left) * c.width / b.width, y: (e.clientY - b.top) * c.height / b.height };
  }
  function pieceAt(pt) {
    if (!comp) return null;
    for (var i = comp.pieces.length - 1; i >= 0; i--) {
      var p = comp.pieces[i];
      if (pt.x >= p.x && pt.y >= p.y && pt.x < p.x + p.canvas.width && pt.y < p.y + p.canvas.height) return p;
    }
    return null;
  }

  function bindDrag() {
    var c = document.getElementById("collage");
    c.addEventListener("pointerdown", function (e) {
      var pt = toCanvas(e), p = pieceAt(pt);
      if (!p) return;
      e.preventDefault();
      dragging = p; grab = { x: pt.x - p.x, y: pt.y - p.y };
      comp.pieces.splice(comp.pieces.indexOf(p), 1); comp.pieces.push(p);  // bring to front
      state.z = comp.pieces.map(function (q) { return q.id; });
      c.setPointerCapture(e.pointerId);
      c.classList.add("dragging");
      draw();
    });
    c.addEventListener("pointermove", function (e) {
      var pt = toCanvas(e);
      if (!dragging) { c.style.cursor = pieceAt(pt) ? "grab" : "default"; return; }
      dragging.x = pt.x - grab.x; dragging.y = pt.y - grab.y;
      state.moves[dragging.id] = { x: dragging.x, y: dragging.y };
      draw();
    });
    function end() { if (!dragging) return; dragging = null; c.classList.remove("dragging"); draw(); }
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  }

  // ---------- UI ----------
  function setStatus(text) { document.getElementById("status").textContent = text; }

  function writeHash() {
    var h = "seed=" + state.seed + "&p=" + state.palette + "&l=" + state.layout + "&f=" + state.format;
    Object.keys(SLIDERS).forEach(function (k) { h += "&" + SLIDERS[k][1] + "=" + state[k]; });
    history.replaceState(null, "", location.pathname + location.search + "#" + h);
  }
  function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (+h.get("seed")) state.seed = +h.get("seed");
    if (PALETTES[h.get("p")]) state.palette = h.get("p");
    if (h.get("l") === "grid" || h.get("l") === "scatter") state.layout = h.get("l");
    if (FORMATS[h.get("f")]) state.format = h.get("f");
    Object.keys(SLIDERS).forEach(function (k) {
      var v = h.get(SLIDERS[k][1]);
      if (v !== null && v !== "" && !isNaN(+v)) state[k] = +v;
    });
  }

  function buildPalettes() {
    var wrap = document.getElementById("palettes");
    Object.keys(PALETTES).forEach(function (key) {
      var p = PALETTES[key], btn = document.createElement("button");
      btn.type = "button"; btn.className = "palette"; btn.dataset.key = key;
      btn.setAttribute("aria-pressed", key === state.palette);
      var chips = '<span class="chips" style="background:' + p.paper + '">' +
        p.colours.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + "</span>";
      btn.innerHTML = chips + '<span class="palette-name">' + p.name + "</span>";
      btn.addEventListener("click", function () {
        state.palette = key;
        wrap.querySelectorAll(".palette").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.key === key); });
        paint();
      });
      wrap.appendChild(btn);
    });
  }

  function bindSegment(id, key) {
    var group = document.getElementById(id);
    group.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.value === state[key]);
      b.addEventListener("click", function () {
        state[key] = b.dataset.value;
        group.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        if (key === "format") sizeStage();
        build();
      });
    });
  }

  function bindSlider(key) {
    var el = document.getElementById(key), out = document.getElementById(key + "-value"), t, kind = SLIDERS[key][2];
    el.value = state[key]; out.textContent = state[key];
    el.addEventListener("input", function () {
      state[key] = +el.value; out.textContent = el.value;
      if (kind === "draw") { draw(); writeHash(); return; }
      clearTimeout(t);
      t = setTimeout(function () {
        if (kind === "layout") build();
        else if (kind === "image") paint();
        else { makeGrain(); draw(); writeHash(); }
      }, kind === "grain" ? 60 : 140);
    });
  }

  // fit the canvas inside the stage at its format's proportions
  function sizeStage() {
    var f = FORMATS[state.format], canvas = document.getElementById("collage");
    if (window.innerWidth < 820) { canvas.style.width = "100%"; canvas.style.height = "auto"; canvas.style.aspectRatio = f[0] + " / " + f[1]; return; }
    var stage = canvas.parentNode, cs = getComputedStyle(stage);
    var aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ah = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var s = Math.min(aw / f[0], ah / f[1]);
    canvas.style.aspectRatio = "";
    canvas.style.width = Math.floor(f[0] * s) + "px";
    canvas.style.height = Math.floor(f[1] * s) + "px";
  }

  function generate() { state.seed = randomSeed(); build(); }

  function download() {
    var canvas = document.getElementById("collage");
    try {
      canvas.toBlob(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "collage-" + state.palette + "-" + state.seed + ".png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      }, "image/png");
    } catch (e) {
      setStatus("This browser blocked the download.");
    }
  }

  function addOwn(files) {
    var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
    Promise.all(list.map(function (f) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve({ title: f.name, img: img }); };
        img.onerror = function () { resolve(null); };
        img.src = URL.createObjectURL(f);
      });
    })).then(function (added) {
      state.ownPhotos = state.ownPhotos.concat(added.filter(Boolean));
      updateCount();
      build();
    });
  }

  function updateCount() {
    var parts = [];
    if (state.photos.length) parts.push(state.photos.length + " from the gallery");
    if (state.ownPhotos.length) parts.push(state.ownPhotos.length + " added");
    document.getElementById("photo-count").textContent = parts.length ? parts.join(" · ") : "None loaded";
  }

  function init() {
    readHash();
    buildPalettes();
    bindSegment("layout", "layout");
    bindSegment("format", "format");
    Object.keys(SLIDERS).forEach(bindSlider);
    sizeStage();
    window.addEventListener("resize", sizeStage);
    bindDrag();
    document.getElementById("generate").addEventListener("click", generate);
    document.getElementById("download").addEventListener("click", download);
    var file = document.getElementById("file");
    document.getElementById("add").addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () { addOwn(file.files); file.value = ""; });
    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space" || e.key === "r") { e.preventDefault(); generate(); }
      if (e.key === "d") { e.preventDefault(); download(); }
    });
    setStatus("Loading photos…");
    fetchGallery().then(function () { updateCount(); build(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
