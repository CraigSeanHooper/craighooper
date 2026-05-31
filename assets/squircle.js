/* Squircle corners for .btn — matches Figma corner smoothing.
   Generates a superellipse path per button at its current size and applies it
   as a clip-path. Recomputes on load, after fonts settle, and on resize.
   Ported from the figma-squircle algorithm (equal corners). */
(function () {
  var RADIUS = 16;        // matches --radius
  var SMOOTHING = 1;      // 100% corner smoothing (the iOS squircle)
  var PRESERVE = true;    // keep smoothing faithful to Figma

  function rad(d) { return (d * Math.PI) / 180; }
  function n(v) { return v.toFixed(4); }

  function cornerParams(cornerRadius, smoothing, budget) {
    var p = (1 + smoothing) * cornerRadius;
    if (!PRESERVE) {
      var maxS = budget / cornerRadius - 1;
      smoothing = Math.min(smoothing, maxS);
      p = Math.min(p, budget);
    }
    var arcMeasure = 90 * (1 - smoothing);
    var arc = Math.sin(rad(arcMeasure / 2)) * cornerRadius * Math.sqrt(2);
    var alpha = (90 - arcMeasure) / 2;
    var p3p4 = cornerRadius * Math.tan(rad(alpha / 2));
    var beta = 45 * smoothing;
    var c = p3p4 * Math.cos(rad(beta));
    var d = c * Math.tan(rad(beta));
    var b = (p - arc - c - d) / 3;
    var a = 2 * b;
    if (PRESERVE && p > budget) {
      var maxDist = budget - d - arc - c;
      var minA = maxDist / 6;
      var maxB = maxDist - minA;
      b = Math.min(b, maxB);
      a = maxDist - b;
      p = Math.min(p, budget);
    }
    return { a: a, b: b, c: c, d: d, p: p, arc: arc, r: cornerRadius };
  }

  function path(w, h, radius, smoothing) {
    var budget = Math.min(w, h) / 2;
    var r = Math.min(radius, budget);
    var o = cornerParams(r, smoothing, budget);
    var a = o.a, b = o.b, c = o.c, d = o.d, p = o.p, arc = o.arc, cr = o.r;
    var tr = "c " + n(a) + " 0 " + n(a + b) + " 0 " + n(a + b + c) + " " + n(d) +
      " a " + n(cr) + " " + n(cr) + " 0 0 1 " + n(arc) + " " + n(arc) +
      " c " + n(d) + " " + n(c) + " " + n(d) + " " + n(b + c) + " " + n(d) + " " + n(a + b + c);
    var br = "c 0 " + n(a) + " 0 " + n(a + b) + " " + n(-d) + " " + n(a + b + c) +
      " a " + n(cr) + " " + n(cr) + " 0 0 1 " + n(-arc) + " " + n(arc) +
      " c " + n(-c) + " " + n(d) + " " + n(-(b + c)) + " " + n(d) + " " + n(-(a + b + c)) + " " + n(d);
    var bl = "c " + n(-a) + " 0 " + n(-(a + b)) + " 0 " + n(-(a + b + c)) + " " + n(-d) +
      " a " + n(cr) + " " + n(cr) + " 0 0 1 " + n(-arc) + " " + n(-arc) +
      " c " + n(-d) + " " + n(-c) + " " + n(-d) + " " + n(-(b + c)) + " " + n(-d) + " " + n(-(a + b + c));
    var tl = "c 0 " + n(-a) + " 0 " + n(-(a + b)) + " " + n(d) + " " + n(-(a + b + c)) +
      " a " + n(cr) + " " + n(cr) + " 0 0 1 " + n(arc) + " " + n(-arc) +
      " c " + n(c) + " " + n(-d) + " " + n(b + c) + " " + n(-d) + " " + n(a + b + c) + " " + n(-d);
    return ("M " + n(w - p) + " 0 " + tr +
      " L " + n(w) + " " + n(h - p) + " " + br +
      " L " + n(p) + " " + n(h) + " " + bl +
      " L 0 " + n(p) + " " + tl + " Z");
  }

  function apply() {
    var btns = document.querySelectorAll(".btn");
    for (var i = 0; i < btns.length; i++) {
      var el = btns[i];
      var r = el.getBoundingClientRect();
      var w = Math.round(r.width), h = Math.round(r.height);
      if (!w || !h) continue;
      var d = 'path("' + path(w, h, RADIUS, SMOOTHING) + '")';
      el.style.clipPath = d;
      el.style.webkitClipPath = d;
    }
  }

  if (document.readyState !== "loading") apply();
  else document.addEventListener("DOMContentLoaded", apply);
  window.addEventListener("load", apply);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);

  // Recompute on the animation frame during resize (no debounce lag, so the
  // clip never stretches over a stale size).
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; apply(); });
  }
  window.addEventListener("resize", schedule);

  // Update each button the instant its own box changes size — covers the
  // row->column reflow at the mobile breakpoint cleanly.
  if (typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(schedule);
    var all = document.querySelectorAll(".btn");
    for (var j = 0; j < all.length; j++) ro.observe(all[j]);
  }
})();
