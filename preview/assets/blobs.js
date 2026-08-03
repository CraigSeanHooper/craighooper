/* ============================================================
   craighooper.xyz — generative blob artwork
   Self-contained. No dependencies. ~7kb.

   TUNED SETTINGS (agreed with Craig — do not change without asking):
     palette   : "Signal"  — black mass + #E8452F, #1F6FEB, #F2C230
                 the mass is filled by CSS (--blob-mass) so it flips to
                 white in dark mode; the accents never change
     roundness : "Round"   — see ROUND below
     morph     : LERP 0.09 (deliberately slowed; 0.16 felt too fast)
     shapes    : 4 only. Cursor must NOT spawn new shapes.
     mobile    : renders the same artwork, interaction disabled

   HOW IT WORKS (one paragraph, so nobody re-derives it):
     Shapes are not drawn as paths. A coarse cell grid is filled by a
     random walk (the big mass) or overlapping discs (the accents),
     blurred into a smooth field, then an outline is traced along a
     fixed threshold through that field and rounded into a curve.
     The cursor flips cells on/off underneath it, and the path is
     re-traced each frame — that's what makes holes open and close.
   ============================================================ */
(function () {
  var NS = 'http://www.w3.org/2000/svg';

  var CONFIG = {
    desktop: { vw: 570, vh: 320, gw: 24, gh: 13 },
    mobile:  { vw: 350, vh: 224, gw: 20, gh: 13 },
    mobileBreakpoint: 820,
    palette: { mass: '#000000', accents: ['#E8452F', '#1F6FEB', '#F2C230'] },
    round: { blur: 9, clean: 2, tension: 0.18, threshold: 0.50 },
    lerp: 0.09,
    brush: 2.1,
    upsample: 6,
    pad: 14
  };

  var isMobile = window.matchMedia('(max-width:' + CONFIG.mobileBreakpoint + 'px)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var interactive = !isMobile && !reduceMotion;

  var M = isMobile ? CONFIG.mobile : CONFIG.desktop;
  var VW = M.vw, VH = M.vh, GW = M.gw, GH = M.gh;
  var UP = CONFIG.upsample, PD = CONFIG.pad;
  var FW = GW * UP + 2 * PD, FH = GH * UP + 2 * PD;
  var CS = Math.min((VW - 36) / GW, (VH - 24) / GH);
  var OX = (VW - GW * CS) / 2, OY = (VH - GH * CS) / 2;
  var R = CONFIG.round, LP = CONFIG.lerp, BRU = CONFIG.brush;
  var PAL = CONFIG.palette.accents, DK = CONFIG.palette.mass;

  var host = document.getElementById('blobs');
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Generative blob artwork');
  var MK = document.createElementNS(NS, 'g');
  svg.appendChild(MK);
  host.appendChild(svg);

  var rnd = Math.random;
  function q(a, b) { return a + rnd() * (b - a); }
  function ri(n) { return Math.floor(rnd() * n); }
  function blank() { return new Uint8Array(GW * GH); }

  function walk() {
    var b = blank(), x = GW >> 1, y = GH >> 1;
    b[y * GW + x] = 1;
    var n = 1, g = 0, tgt = Math.floor(GW * GH * q(0.34, 0.46));
    while (n < tgt && g++ < 5000) {
      x += [-1, 0, 1][ri(3)]; y += [-1, 0, 1][ri(3)];
      x = Math.max(0, Math.min(GW - 1, x));
      y = Math.max(0, Math.min(GH - 1, y));
      var i = y * GW + x;
      if (!b[i]) { b[i] = 1; n++; }
    }
    return b;
  }

  function discs(cx, cy, sz) {
    var b = blank(), med = sz === 'med';
    var n = med ? 3 + ri(2) : 2 + ri(2);
    var j = med ? 1.9 : 1.4, r0 = med ? 2 : 1.8, r1 = med ? 2.7 : 2.4;
    if (sz === 'tiny') { n = 2; j = 1.1; r0 = 1.7; r1 = 2.2; }
    for (var i = 0; i < n; i++) {
      var ox = cx + q(-j, j), oy = cy + q(-j, j), rr = q(r0, r1);
      for (var y = 0; y < GH; y++)
        for (var x = 0; x < GW; x++)
          if (Math.hypot(x - ox, y - oy) <= rr) b[y * GW + x] = 1;
    }
    return b;
  }

  function clean(b, passes) {
    for (var k = 0; k < passes; k++) {
      var o = b.slice(), changed = false;
      for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) {
        var c = 0;
        if (x > 0 && b[y * GW + x - 1]) c++;
        if (x < GW - 1 && b[y * GW + x + 1]) c++;
        if (y > 0 && b[(y - 1) * GW + x]) c++;
        if (y < GH - 1 && b[(y + 1) * GW + x]) c++;
        var i = y * GW + x;
        if (b[i]) { if (c <= 1) { o[i] = 0; changed = true; } }
        else if (c >= 3) { o[i] = 1; changed = true; }
      }
      b = o;
      if (!changed) break;
    }
    return b;
  }

  function boxblur(F, w, h, r, passes) {
    var T = new Float32Array(w * h), i, x, y, s, d = 2 * r + 1;
    for (i = 0; i < passes; i++) {
      for (y = 0; y < h; y++) {
        s = 0;
        for (x = 0; x <= r; x++) s += F[y * w + x];
        for (x = 0; x < w; x++) {
          T[y * w + x] = s / d;
          var ad = x + r + 1, rm = x - r;
          if (ad < w) s += F[y * w + ad];
          if (rm >= 0) s -= F[y * w + rm];
        }
      }
      for (x = 0; x < w; x++) {
        s = 0;
        for (y = 0; y <= r; y++) s += T[y * w + x];
        for (y = 0; y < h; y++) {
          F[y * w + x] = s / d;
          var ad2 = y + r + 1, rm2 = y - r;
          if (ad2 < h) s += T[ad2 * w + x];
          if (rm2 >= 0) s -= T[rm2 * w + x];
        }
      }
    }
    return F;
  }

  function field(b, br) {
    var F = new Float32Array(FW * FH), r, c, dy, dx;
    for (r = 0; r < GH; r++) for (c = 0; c < GW; c++) {
      if (!b[r * GW + c]) continue;
      for (dy = 0; dy < UP; dy++) for (dx = 0; dx < UP; dx++)
        F[(PD + r * UP + dy) * FW + (PD + c * UP + dx)] = 1;
    }
    return boxblur(F, FW, FH, br, 3);
  }

  var TB = {1:[[3,2]],2:[[2,1]],3:[[3,1]],4:[[1,0]],5:[[3,0],[2,1]],6:[[2,0]],
            7:[[3,0]],8:[[0,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[0,1]],
            12:[[1,3]],13:[[1,2]],14:[[2,3]]};

  function ip(x1, y1, v1, x2, y2, v2, T) {
    var t = (T - v1) / ((v2 - v1) || 1e-6);
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  }

  function contours(F, TH) {
    var segs = [], x, y;
    for (y = 0; y < FH - 1; y++) for (x = 0; x < FW - 1; x++) {
      var a = F[y*FW+x], b = F[y*FW+x+1], c = F[(y+1)*FW+x+1], d = F[(y+1)*FW+x];
      var id = (a>TH?8:0)|(b>TH?4:0)|(c>TH?2:0)|(d>TH?1:0), tb = TB[id];
      if (!tb) continue;
      var E = [ip(x,y,a,x+1,y,b,TH), ip(x+1,y,b,x+1,y+1,c,TH),
               ip(x,y+1,d,x+1,y+1,c,TH), ip(x,y,a,x,y+1,d,TH)];
      for (var i = 0; i < tb.length; i++) segs.push([E[tb[i][0]], E[tb[i][1]]]);
    }
    var key = function (p) { return p[0].toFixed(3) + '_' + p[1].toFixed(3); };
    var mp = {}, i2;
    for (i2 = 0; i2 < segs.length; i2++) {
      var k = key(segs[i2][0]);
      (mp[k] = mp[k] || []).push(i2);
    }
    var used = new Uint8Array(segs.length), loops = [];
    for (i2 = 0; i2 < segs.length; i2++) {
      if (used[i2]) continue;
      used[i2] = 1;
      var cur = segs[i2], st = key(cur[0]), pts = [cur[0]], g = 0;
      while (g++ < 6000) {
        pts.push(cur[1]);
        var cand = mp[key(cur[1])], nx = -1;
        if (cand) for (var z = 0; z < cand.length; z++)
          if (!used[cand[z]]) { nx = cand[z]; break; }
        if (nx < 0) break;
        used[nx] = 1; cur = segs[nx];
        if (key(cur[1]) === st) { pts.push(cur[1]); break; }
      }
      if (pts.length > 10) loops.push(pts);
    }
    return loops;
  }

  function resamp(p, n) {
    var L = p.concat([p[0]]), cum = [0], t = 0, i;
    for (i = 1; i < L.length; i++) {
      t += Math.hypot(L[i][0] - L[i-1][0], L[i][1] - L[i-1][1]);
      cum.push(t);
    }
    if (t < 2) return null;
    var out = [], sg = 0, stp = t / n;
    for (i = 0; i < n; i++) {
      var d = i * stp;
      while (sg < cum.length - 2 && cum[sg+1] < d) sg++;
      var sp = cum[sg+1] - cum[sg] || 1, f = (d - cum[sg]) / sp;
      out.push([L[sg][0] + (L[sg+1][0]-L[sg][0]) * f,
                L[sg][1] + (L[sg+1][1]-L[sg][1]) * f]);
    }
    return out;
  }

  function smooth(p, k) {
    var n = p.length, o = p, i, j;
    for (j = 0; j < k; j++) {
      var t = [];
      for (i = 0; i < n; i++) {
        var a = o[(i-1+n)%n], b = o[i], c = o[(i+1)%n];
        t.push([(a[0] + 2*b[0] + c[0]) / 4, (a[1] + 2*b[1] + c[1]) / 4]);
      }
      o = t;
    }
    return o;
  }

  function toSvg(p) {
    return [OX + (p[0] - PD) / UP * CS, OY + (p[1] - PD) / UP * CS];
  }

  function spline(p, tn) {
    var n = p.length, g = function (i) { return p[((i % n) + n) % n]; };
    var d = 'M' + g(0)[0].toFixed(2) + ',' + g(0)[1].toFixed(2);
    for (var i = 0; i < n; i++) {
      var a = g(i-1), b = g(i), c = g(i+1), e = g(i+2);
      d += 'C' + (b[0] + (c[0]-a[0])*tn).toFixed(2) + ',' + (b[1] + (c[1]-a[1])*tn).toFixed(2)
         + ' ' + (c[0] - (e[0]-b[0])*tn).toFixed(2) + ',' + (c[1] - (e[1]-b[1])*tn).toFixed(2)
         + ' ' + c[0].toFixed(2) + ',' + c[1].toFixed(2);
    }
    return d + 'Z';
  }

  function dOf(F, TH) {
    var ls = contours(F, TH), o = '';
    for (var i = 0; i < ls.length; i++) {
      var n = Math.max(28, Math.min(130, Math.round(ls[i].length * 0.46)));
      var rs = resamp(ls[i], n);
      if (!rs) continue;
      o += spline(smooth(rs, 1).map(toSvg), R.tension) + ' ';
    }
    return o;
  }

  var A = [];

  function build() {
    while (MK.firstChild) MK.removeChild(MK.firstChild);
    A = [];
    var i, sizes = ['med', 'small', 'tiny'];
    for (i = sizes.length - 1; i > 0; i--) {
      var j = ri(i + 1), t = sizes[i];
      sizes[i] = sizes[j]; sizes[j] = t;
    }
    var anch = [[GW*0.76, GH*0.24], [GW*0.24, GH*0.76], [GW*0.84, GH*0.72]];
    var raw = [{ b: walk(), c: DK, big: true }];
    for (i = 0; i < 3; i++)
      raw.push({ b: discs(anch[i][0], anch[i][1], sizes[i]), c: PAL[i % 3], big: false });

    for (i = 0; i < raw.length; i++) {
      var big = raw[i].big;
      var cp = big ? R.clean : Math.min(2, R.clean);
      var br = big ? R.blur : Math.round(R.blur * 0.85);
      var th = big ? R.threshold : 0.48;
      var bs = clean(raw[i].b.slice(), cp), f = field(bs, br);
      var e = document.createElementNS(NS, 'path');
      /* The mass is coloured by CSS (.blob-mass -> --blob-mass) so it follows
         the colour scheme. The fill attribute below is only a fallback for
         when the stylesheet hasn't applied. */
      if (big) e.setAttribute('class', 'blob-mass');
      e.setAttribute('fill', raw[i].c);
      e.setAttribute('fill-rule', 'evenodd');
      MK.appendChild(e);
      e.setAttribute('d', dOf(f, th));
      A.push({ base: bs, fb: f, now: new Float32Array(f), to: f, el: e, br: br, th: th });
    }
  }

  build();

  if (!interactive) return;   // mobile / reduced motion: static artwork, no listeners

  function disc(c, r) {
    var o = [], dx, dy;
    for (dy = -3; dy <= 3; dy++) for (dx = -3; dx <= 3; dx++) {
      if (Math.hypot(dx, dy) > BRU) continue;
      var x = c + dx, y = r + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH) o.push(y * GW + x);
    }
    return o;
  }

  function cellAt(ev) {
    var b = svg.getBoundingClientRect();
    var x = (ev.clientX - b.left) / b.width * VW;
    var y = (ev.clientY - b.top) / b.height * VH;
    var c = Math.floor((x - OX) / CS), r = Math.floor((y - OY) / CS);
    return (c < 0 || r < 0 || c >= GW || r >= GH) ? null : [c, r];
  }

  function hitAt(cl) {
    if (!cl) return -1;
    var ix = disc(cl[0], cl[1]);
    for (var i = A.length - 1; i >= 0; i--)
      for (var j = 0; j < ix.length; j++)
        if (A[i].base[ix[j]]) return i;
    return -1;
  }

  var last = null, raf = false;

  function tick() {
    var mx = 0;
    for (var i = 0; i < A.length; i++) {
      var o = A[i], mm = 0;
      for (var j = 0; j < o.now.length; j++) {
        var d = o.to[j] - o.now[j];
        o.now[j] += d * LP;
        var ab = d < 0 ? -d : d;
        if (ab > mm) mm = ab;
      }
      if (mm > 5e-4) o.el.setAttribute('d', dOf(o.now, o.th));
      if (mm > mx) mx = mm;
    }
    if (mx > 0.003) requestAnimationFrame(tick); else raf = false;
  }

  function go() { if (!raf) { raf = true; requestAnimationFrame(tick); } }

  svg.addEventListener('pointermove', function (ev) {
    if (ev.pointerType === 'touch') return;
    var cl = cellAt(ev), k = cl ? cl[0] + ',' + cl[1] : null;
    if (k === last) return;
    last = k;
    for (var i = 0; i < A.length; i++) A[i].to = A[i].fb;
    var h = hitAt(cl);
    if (h >= 0 && cl) {
      var nb = A[h].base.slice(), ix = disc(cl[0], cl[1]);
      for (var j = 0; j < ix.length; j++) nb[ix[j]] ^= 1;
      A[h].to = field(nb, A[h].br);
    }
    go();
  });

  svg.addEventListener('pointerleave', function () {
    last = null;
    for (var i = 0; i < A.length; i++) A[i].to = A[i].fb;
    go();
  });

  svg.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'touch') return;
    var cl = cellAt(ev);
    if (!cl) return;
    var h = hitAt(cl);
    if (h < 0) return;                       // empty space does nothing — no new shapes
    var ix = disc(cl[0], cl[1]);
    for (var j = 0; j < ix.length; j++) A[h].base[ix[j]] ^= 1;
    A[h].fb = field(A[h].base, A[h].br);
    A[h].to = A[h].fb;
    last = null;
    go();
  });
})();
