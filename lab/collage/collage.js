/*
  Collage — generates editorial-style collages from the photo gallery.

  Each composition is built from a seed, so the same seed, palette, layout
  and format always give the same picture. Pieces: two-tone photos, flat
  blocks, contour maps, speckle texture and circles, with torn edges and
  film grain over the top. Any piece can be dragged by hand.
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

  var state = {
    seed: randomSeed(),
    palette: "mesa",
    layout: "grid",
    format: "3:2",
    grain: 55,
    density: 50,
    tears: 50,
    photos: [],        // { title, src, fallback } from the gallery
    ownPhotos: [],     // { title, img } added from this computer
    cache: {}          // src -> Promise<Image>
  };

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
  function ri(a, b) { return Math.floor(rr(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function chance(p) { return rnd() < p; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- noise ----------
  function makeNoise(seed) {
    var r = mulberry32(seed), perm = new Uint8Array(512), vals = new Float32Array(256), i;
    for (i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
    for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function v(x, y) { return vals[perm[(x & 255) + perm[y & 255]]]; }
    function s(t) { return t * t * (3 - 2 * t); }
    function n2(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      var u = s(xf), w = s(yf);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    }
    return function fbm(x, y, oct) {
      var sum = 0, amp = 0.5, f = 1, norm = 0;
      for (var o = 0; o < (oct || 4); o++) { sum += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
      return sum / norm;
    };
  }

  // ---------- colour ----------
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function lum(h) { var c = hex(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function pairFrom(colours) {
    // two colours with enough contrast; darker one carries the shadows
    for (var k = 0; k < 30; k++) {
      var a = pick(colours), b = pick(colours);
      if (Math.abs(lum(a) - lum(b)) > 0.3) return lum(a) < lum(b) ? [a, b] : [b, a];
    }
    var sorted = colours.slice().sort(function (x, y) { return lum(x) - lum(y); });
    return [sorted[0], sorted[sorted.length - 1]];
  }
  function contrastWith(colour, colours) {
    var best = colours[0], d = -1;
    colours.forEach(function (c) { var dd = Math.abs(lum(c) - lum(colour)); if (dd > d && c !== colour) { d = dd; best = c; } });
    return best;
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

  // choose the photos one composition needs, then load only those
  function choosePhotos(n) {
    var pool = state.ownPhotos.length ? state.ownPhotos.concat(state.photos) : state.photos;
    if (!pool.length) return Promise.resolve([]);
    var chosen = shuffle(pool).slice(0, n);
    return Promise.all(chosen.map(function (p) {
      if (p.img) return Promise.resolve({ title: p.title, img: p.img });
      return loadImage(p.src, p.fallback).then(function (img) { return { title: p.title, img: img }; }, function () { return null; });
    })).then(function (list) { return list.filter(Boolean); });
  }

  // ---------- torn edges ----------
  // Builds the outline of a w×h piece; edges listed in `torn` are ragged.
  function tornPath(w, h, torn, S, fbm) {
    var path = new Path2D();
    var corners = [[0, 0], [w, 0], [w, h], [0, h]];
    var names = ["top", "right", "bottom", "left"];
    var off = rr(0, 100);
    path.moveTo(0, 0);
    for (var e = 0; e < 4; e++) {
      var a = corners[e], b = corners[(e + 1) % 4];
      if (!torn[names[e]]) { path.lineTo(b[0], b[1]); continue; }
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var steps = Math.max(8, Math.floor(len / (3 * S)));
      // inward normal
      var nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      var amp = rr(6, 16) * S;
      var bite = chance(0.35) ? { at: rr(0.2, 0.8), width: rr(0.15, 0.4), depth: rr(20, 70) * S } : null;
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        var x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        var d = 0;
        if (i < steps) {
          d = (fbm(t * len / (90 * S) + off, e * 7.1, 4) - 0.35) * amp * 2 + rr(0, 1.6) * S;
          if (bite) {
            var q = (t - bite.at) / (bite.width / 2);
            if (Math.abs(q) < 1) d += bite.depth * Math.cos(q * Math.PI / 2) * Math.cos(q * Math.PI / 2);
          }
          d = Math.max(0, d);
        }
        path.lineTo(x + nx * d, y + ny * d);
      }
    }
    path.closePath();
    return path;
  }

  // ---------- piece painters (draw into an offscreen canvas) ----------
  function offscreen(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  function paintPhoto(ctx, w, h, photo, pair, S) {
    var img = photo.img;
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var ar = w / h, zoom = rr(1, 1.8);
    var cw = Math.min(iw, ih * ar) / zoom, ch = cw / ar;
    var sx = rr(0, iw - cw), sy = rr(0, ih - ch);
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height), px = data.data;
    // auto-levels from the histogram so every photo reaches both inks
    var hist = new Uint32Array(256), n = px.length / 4, i, l;
    for (i = 0; i < px.length; i += 4) hist[(px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) | 0]++;
    var lo = 0, hi = 255, acc = 0;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
    acc = 0;
    for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.02) { hi = i; break; } }
    var range = Math.max(1, hi - lo), dk = hex(pair[0]), lt = hex(pair[1]), g = rr(0.8, 1.25);
    for (i = 0; i < px.length; i += 4) {
      l = ((px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) - lo) / range;
      l = Math.min(1, Math.max(0, l + (Math.random() - 0.5) * 0.16));
      l = Math.pow(l, g);
      px[i] = dk[0] + (lt[0] - dk[0]) * l;
      px[i + 1] = dk[1] + (lt[1] - dk[1]) * l;
      px[i + 2] = dk[2] + (lt[2] - dk[2]) * l;
    }
    ctx.putImageData(data, 0, 0);
  }

  function contourLines(ctx, w, h, colour, S, fbm, opts) {
    var cell = 5 * S, cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
    var sc = rr(0.0015, 0.004) / S, ox = rr(0, 50), oy = rr(0, 50);
    var f = new Float32Array(cols * rows), x, y;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) f[y * cols + x] = fbm(x * cell * sc + ox, y * cell * sc + oy, 4);
    var levels = ri(14, 26), step = 0.7 / levels;
    ctx.strokeStyle = colour;
    ctx.lineWidth = rr(1.1, 1.8) * S;
    ctx.globalAlpha = opts.alpha || 0.9;
    if (opts.dashed) ctx.setLineDash([6 * S, 4 * S]);
    ctx.beginPath();
    for (var k = 1; k < levels; k++) {
      var t = 0.15 + k * step;
      for (y = 0; y < rows - 1; y++) for (x = 0; x < cols - 1; x++) {
        var a = f[y * cols + x], b = f[y * cols + x + 1], c = f[(y + 1) * cols + x + 1], d = f[(y + 1) * cols + x];
        var idx = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        var X = x * cell, Y = y * cell;
        var top = [X + cell * (t - a) / (b - a), Y], right = [X + cell, Y + cell * (t - b) / (c - b)];
        var bot = [X + cell * (t - d) / (c - d), Y + cell], left = [X, Y + cell * (t - a) / (d - a)];
        var segs = {
          1: [[left, bot]], 2: [[bot, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bot, right]],
          6: [[top, bot]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bot]], 10: [[left, bot], [top, right]],
          11: [[top, right]], 12: [[left, right]], 13: [[bot, right]], 14: [[left, bot]]
        }[idx];
        for (var s = 0; s < segs.length; s++) { ctx.moveTo(segs[s][0][0], segs[s][0][1]); ctx.lineTo(segs[s][1][0], segs[s][1][1]); }
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function paintSpeckle(ctx, w, h, base, dot, S, fbm) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    var data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height), px = data.data;
    var W = ctx.canvas.width, sc = rr(0.003, 0.008) / S, ox = rr(0, 80), c = hex(dot), den = rr(0.5, 0.9);
    for (var i = 0; i < px.length; i += 4) {
      var p = i / 4, x = p % W, y = (p / W) | 0;
      var n = fbm(x * sc + ox, y * sc, 5);
      var prob = Math.max(0, (n - 0.45) * 3) * den;
      if (Math.random() < prob) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; }
    }
    ctx.putImageData(data, 0, 0);
  }

  // ---------- layouts ----------
  // Grid: split the frame into blocks, then leave some empty.
  function gridLayout(W, H, S) {
    var m = Math.min(W, H) * rr(0.08, 0.13);
    var unitX = (W - 2 * m) / 12, unitY = (H - 2 * m) / 12;
    var target = Math.round(6 + state.density / 100 * 10);
    var rects = [{ x: 0, y: 0, w: 12, h: 12 }];
    var guard = 0;
    while (rects.length < target && guard++ < 200) {
      rects.sort(function (a, b) { return b.w * unitX * b.h * unitY - a.w * unitX * a.h * unitY; });
      var r = rects[chance(0.7) ? 0 : ri(0, Math.min(2, rects.length - 1))];
      var vertical = r.w * unitX > r.h * unitY ? chance(0.8) : chance(0.2);
      var span = vertical ? r.w : r.h;
      if (span < 2) continue;
      var cut = ri(1, span - 1);
      rects.splice(rects.indexOf(r), 1);
      if (vertical) rects.push({ x: r.x, y: r.y, w: cut, h: r.h }, { x: r.x + cut, y: r.y, w: r.w - cut, h: r.h });
      else rects.push({ x: r.x, y: r.y, w: r.w, h: cut }, { x: r.x, y: r.y + cut, w: r.w, h: r.h - cut });
    }
    return rects.map(function (r) {
      return {
        x: m + r.x * unitX, y: m + r.y * unitY, w: r.w * unitX, h: r.h * unitY,
        edge: { top: r.y === 0, right: r.x + r.w === 12, bottom: r.y + r.h === 12, left: r.x === 0 }
      };
    });
  }

  // Scatter: a handful of overlapping rectangles, like pasted scraps.
  function scatterLayout(W, H, S) {
    // one piece per cell of a loose grid, jittered so pieces overlap
    var n = Math.round(4 + state.density / 100 * 6), out = [];
    var cols = Math.max(2, Math.round(Math.sqrt(n * W / H))), rows = Math.ceil(n / cols);
    var cw = W * 0.86 / cols, ch = H * 0.86 / rows;
    var cells = [];
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) cells.push([x, y]);
    shuffle(cells).slice(0, n).forEach(function (c) {
      var w = cw * rr(0.8, 1.35), h = ch * rr(0.6, 1.2);
      var cx = W * 0.07 + (c[0] + 0.5) * cw + rr(-0.2, 0.2) * cw, cy = H * 0.07 + (c[1] + 0.5) * ch + rr(-0.2, 0.2) * ch;
      var px = Math.min(Math.max(cx - w / 2, W * 0.03), W * 0.97 - w), py = Math.min(Math.max(cy - h / 2, H * 0.03), H * 0.97 - h);
      out.push({ x: px, y: py, w: w, h: h, edge: { top: true, right: true, bottom: true, left: true } });
    });
    return out;
  }

  // ---------- compose ----------
  // A composition is a list of pieces, each pre-rendered to its own canvas
  // with its final shape, plus a position. Dragging only moves positions.
  var rendering = false, pending = false;
  var comp = null;     // { W, H, S, paper, shadow, pieces: [{ canvas, x, y }] }
  var grainLayer = null;

  function render() {
    if (rendering) { pending = true; return; }
    rendering = true;
    rnd = mulberry32(state.seed);
    var fbm = makeNoise(state.seed);
    var size = FORMATS[state.format], W = size[0], H = size[1], S = Math.max(W, H) / 2000;
    var pal = PALETTES[state.palette];
    var layout = state.layout === "grid" ? gridLayout(W, H, S) : scatterLayout(W, H, S);
    var photoCount = Math.min(5, Math.max(2, Math.round(layout.length * (state.layout === "grid" ? 0.35 : 0.5))));

    setStatus("Composing…");
    choosePhotos(photoCount).then(function (photos) {
      rnd = mulberry32(state.seed * 7 + 3);

      // biggest blocks get the photos
      var order = layout.map(function (r, i) { return i; }).sort(function (a, b) { return layout[b].w * layout[b].h - layout[a].w * layout[a].h; });
      var types = {};
      var photoSlots = 0;
      order.forEach(function (i, rank) {
        var r = layout[i], ar = r.w / r.h;
        // leave a few of the smaller blocks empty so the paper shows through
        if (state.layout === "grid" && rank > order.length / 2 && chance(0.3)) { types[i] = "empty"; return; }
        if (photoSlots < photos.length && (photoSlots < 2 || chance(0.45))) { types[i] = "photo"; photoSlots++; return; }
        if (ar > 0.75 && ar < 1.35 && chance(0.45)) { types[i] = "circle"; return; }
        types[i] = pick(["solid", "solid", "contour", "contour", "speckle"]);
      });

      var pieces = [], tearAmount = state.tears / 100, pi = 0;
      var others = pal.colours.filter(function (c) { return Math.abs(lum(c) - lum(pal.paper)) > 0.08; });
      if (!others.length) others = pal.colours;
      var drawOrder = state.layout === "scatter" ? shuffle(order) : order;

      drawOrder.forEach(function (i) {
        var r = layout[i], type = types[i];
        if (type === "empty") return;

        if (type === "circle") {
          var rad = Math.min(r.w, r.h) / 2 * rr(0.86, 1);
          var cc = offscreen(rad * 2, rad * 2), cx = cc.getContext("2d"), fill = pick(others);
          cx.beginPath(); cx.arc(cc.width / 2, cc.height / 2, rad, 0, Math.PI * 2); cx.clip();
          cx.fillStyle = fill; cx.fillRect(0, 0, cc.width, cc.height);
          if (chance(0.45)) contourLines(cx, cc.width, cc.height, contrastWith(fill, pal.colours), S, fbm, { alpha: 0.85 });
          pieces.push({ canvas: cc, x: r.x + r.w / 2 - rad, y: r.y + r.h / 2 - rad });
          return;
        }

        // rectangular pieces, optionally torn
        var flat = offscreen(r.w, r.h), fc = flat.getContext("2d");
        if (type === "photo") {
          paintPhoto(fc, flat.width, flat.height, photos[pi++], pairFrom(pal.colours), S);
        } else if (type === "contour") {
          var base = chance(0.3) ? pal.paper : pick(others);
          fc.fillStyle = base; fc.fillRect(0, 0, flat.width, flat.height);
          contourLines(fc, flat.width, flat.height, contrastWith(base, pal.colours), S, fbm, { dashed: chance(0.3) });
        } else if (type === "speckle") {
          var sp = pairFrom(pal.colours);
          paintSpeckle(fc, flat.width, flat.height, sp[1], sp[0], S, fbm);
        } else {
          fc.fillStyle = pick(others); fc.fillRect(0, 0, flat.width, flat.height);
        }

        var torn = {};
        ["top", "right", "bottom", "left"].forEach(function (e) {
          var p = r.edge[e] ? 0.55 : 0.08;
          if (state.layout === "scatter") p = 0.3;
          if (chance(p * tearAmount * 1.6)) torn[e] = true;
        });
        var piece = offscreen(r.w, r.h), pc = piece.getContext("2d");
        pc.clip(tornPath(piece.width, piece.height, torn, S, fbm));
        pc.drawImage(flat, 0, 0);
        pieces.push({ canvas: piece, x: r.x, y: r.y });

        // scatter mode: tick rules beside some pieces
        if (state.layout === "scatter" && chance(0.4)) {
          var tc = contrastWith(pal.paper, pal.colours), lines = ri(5, 10), len = rr(40, 140) * S, gap = 14 * S;
          var tick = offscreen(len + 4 * S, lines * gap + 4 * S), tx = tick.getContext("2d");
          tx.strokeStyle = tc; tx.globalAlpha = 0.7; tx.lineWidth = 1.5 * S;
          tx.setLineDash(chance(0.5) ? [] : [len * 0.6, 4 * S, len * 0.1, 4 * S]);
          for (var q = 0; q < lines; q++) { tx.beginPath(); tx.moveTo(0, 2 * S + q * gap); tx.lineTo(len * rr(0.5, 1), 2 * S + q * gap); tx.stroke(); }
          pieces.push({ canvas: tick, x: chance(0.5) ? r.x - len - 10 * S : r.x + r.w + 10 * S, y: r.y + rr(0, r.h * 0.5), flat: true });
        }
      });

      comp = { W: W, H: H, S: S, paper: pal.paper, shadow: state.layout === "scatter", pieces: pieces };
      var canvas = document.getElementById("collage");
      canvas.width = W; canvas.height = H;
      makeGrain();
      draw();
      document.getElementById("seed").textContent = state.seed;
      setStatus(photos.length ? "Drag pieces to move them" : "No photos loaded — add your own below.");
      writeHash();
      rendering = false;
      if (pending) { pending = false; render(); }
    });
  }

  function draw() {
    if (!comp) return;
    var ctx = document.getElementById("collage").getContext("2d");
    ctx.fillStyle = comp.paper; ctx.fillRect(0, 0, comp.W, comp.H);
    comp.pieces.forEach(function (p) {
      ctx.save();
      if (comp.shadow && !p.flat) { ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 10 * comp.S; ctx.shadowOffsetY = 3 * comp.S; }
      if (p === dragging) { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 24 * comp.S; ctx.shadowOffsetY = 8 * comp.S; }
      ctx.drawImage(p.canvas, Math.round(p.x), Math.round(p.y));
      ctx.restore();
    });
    if (grainLayer) ctx.drawImage(grainLayer, 0, 0);
  }

  // Grain sits on its own layer: light and dark specks, drawn over everything.
  function makeGrain() {
    var amt = state.grain / 100;
    if (!comp || amt <= 0) { grainLayer = null; return; }
    grainLayer = offscreen(comp.W, comp.H);
    var g = grainLayer.getContext("2d"), data = g.createImageData(comp.W, comp.H), px = data.data, k = amt * 60;
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
      var p = comp.pieces[i], lx = Math.floor(pt.x - p.x), ly = Math.floor(pt.y - p.y);
      if (lx < 0 || ly < 0 || lx >= p.canvas.width || ly >= p.canvas.height) continue;
      if (p.canvas.getContext("2d").getImageData(lx, ly, 1, 1).data[3] > 10) return p;
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
      c.setPointerCapture(e.pointerId);
      c.classList.add("dragging");
      draw();
    });
    c.addEventListener("pointermove", function (e) {
      var pt = toCanvas(e);
      if (!dragging) { c.style.cursor = pieceAt(pt) ? "grab" : "default"; return; }
      dragging.x = pt.x - grab.x; dragging.y = pt.y - grab.y;
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
    history.replaceState(null, "", location.pathname + location.search + "#" + h);
  }
  function readHash() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (+h.get("seed")) state.seed = +h.get("seed");
    if (PALETTES[h.get("p")]) state.palette = h.get("p");
    if (h.get("l") === "grid" || h.get("l") === "scatter") state.layout = h.get("l");
    if (FORMATS[h.get("f")]) state.format = h.get("f");
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
        render();
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
        render();
      });
    });
  }

  function bindSlider(id, key) {
    var el = document.getElementById(id), out = document.getElementById(id + "-value"), t;
    el.value = state[key]; out.textContent = state[key];
    el.addEventListener("input", function () {
      state[key] = +el.value; out.textContent = el.value;
      clearTimeout(t);
      t = setTimeout(key === "grain" ? function () { makeGrain(); draw(); } : render, 150);
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

  function generate() { state.seed = randomSeed(); render(); }

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
        img.onload = function () { resolve({ title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), img: img }); };
        img.onerror = function () { resolve(null); };
        img.src = URL.createObjectURL(f);
      });
    })).then(function (added) {
      state.ownPhotos = state.ownPhotos.concat(added.filter(Boolean));
      updateCount();
      render();
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
    bindSlider("grain", "grain");
    bindSlider("density", "density");
    bindSlider("tears", "tears");
    sizeStage();
    window.addEventListener("resize", sizeStage);
    document.getElementById("generate").addEventListener("click", generate);
    document.getElementById("download").addEventListener("click", download);
    bindDrag();
    var file = document.getElementById("file");
    document.getElementById("add").addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () { addOwn(file.files); file.value = ""; });
    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space" || e.key === "r") { e.preventDefault(); generate(); }
      if (e.key === "d") { e.preventDefault(); download(); }
    });
    setStatus("Loading photos…");
    fetchGallery().then(function () { updateCount(); render(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
