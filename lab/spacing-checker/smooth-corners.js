// Smooth corners (Figma corner smoothing at 100%).
//
// The site's assets/squircle.js trims the element to the smooth shape, which would cut
// off outlines, shadows and focus rings drawn outside it. Here the shape is drawn
// instead: each element with data-smooth gets an SVG behind its content holding
//   .shape            the fill
//   .edge, .ring      strokes that sit outside the shape, like Figma's outside strokes
// Colours, stroke widths and shadows stay in styles.css. The corner radius comes from
// the element's --corner property. Path maths follows figma-squircle, as squircle.js does.

(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const rad = deg => deg * Math.PI / 180;
  const n = x => +x.toFixed(4);

  // One corner's curve measurements, with smoothing kept even on tight shapes.
  function corner(radius, smoothing, budget) {
    let p = (1 + smoothing) * radius;
    const arcMeasure = 90 * (1 - smoothing);
    const arc = Math.sin(rad(arcMeasure / 2)) * radius * Math.SQRT2;
    const p3ToP4 = radius * Math.tan(rad((90 - arcMeasure) / 4));
    const beta = 45 * smoothing;
    const c = p3ToP4 * Math.cos(rad(beta));
    const d = c * Math.tan(rad(beta));
    let b = (p - arc - c - d) / 3;
    let a = 2 * b;
    if (p > budget) {
      const p1ToP3 = budget - d - arc - c;
      b = Math.min(b, p1ToP3 - p1ToP3 / 6);
      a = p1ToP3 - b;
      p = budget;
    }
    return { a, b, c, d, p, arc, r: radius };
  }

  function path(w, h, radius, smoothing = 1) {
    const budget = Math.min(w, h) / 2;
    const k = corner(Math.min(radius, budget), smoothing, budget);
    const { a, b, c, d, p, arc, r } = k;
    if (!r) return `M0 0H${w}V${h}H0Z`;
    return [
      `M${n(w - p)} 0`,
      `c${n(a)} 0 ${n(a + b)} 0 ${n(a + b + c)} ${n(d)}`,
      `a${n(r)} ${n(r)} 0 0 1 ${n(arc)} ${n(arc)}`,
      `c${n(d)} ${n(c)} ${n(d)} ${n(b + c)} ${n(d)} ${n(a + b + c)}`,
      `L${n(w)} ${n(h - p)}`,
      `c0 ${n(a)} 0 ${n(a + b)} ${n(-d)} ${n(a + b + c)}`,
      `a${n(r)} ${n(r)} 0 0 1 ${n(-arc)} ${n(arc)}`,
      `c${n(-c)} ${n(d)} ${n(-(b + c))} ${n(d)} ${n(-(a + b + c))} ${n(d)}`,
      `L${n(p)} ${n(h)}`,
      `c${n(-a)} 0 ${n(-(a + b))} 0 ${n(-(a + b + c))} ${n(-d)}`,
      `a${n(r)} ${n(r)} 0 0 1 ${n(-arc)} ${n(-arc)}`,
      `c${n(-d)} ${n(-c)} ${n(-d)} ${n(-(b + c))} ${n(-d)} ${n(-(a + b + c))}`,
      `L0 ${n(p)}`,
      `c0 ${n(-a)} 0 ${n(-(a + b))} ${n(d)} ${n(-(a + b + c))}`,
      `a${n(r)} ${n(r)} 0 0 1 ${n(arc)} ${n(-arc)}`,
      `c${n(c)} ${n(-d)} ${n(b + c)} ${n(-d)} ${n(a + b + c)} ${n(-d)}`,
      'Z'
    ].join('');
  }

  function draw(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const radius = parseFloat(getComputedStyle(el).getPropertyValue('--corner')) || 0;
    const svg = el.querySelector(':scope > .smooth');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const part of svg.children) {
      // Outside strokes: grow the shape by half the stroke so the stroke's inner edge
      // meets the shape's edge.
      const grow = part.classList.contains('shape') ? 0
        : (parseFloat(getComputedStyle(part).strokeWidth) || 0) / 2;
      part.setAttribute('d', path(w + 2 * grow, h + 2 * grow, radius + grow));
      part.setAttribute('transform', grow ? `translate(${-grow} ${-grow})` : '');
    }
  }

  const els = [...document.querySelectorAll('[data-smooth]')];
  const observer = new ResizeObserver(entries => entries.forEach(e => draw(e.target)));
  for (const el of els) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'smooth');
    svg.setAttribute('aria-hidden', 'true');
    for (const part of ['shape', ...el.dataset.smooth.split(' ').filter(Boolean)]) {
      const p = document.createElementNS(SVG, 'path');
      p.setAttribute('class', part);
      svg.append(p);
    }
    el.prepend(svg);
    draw(el);
    observer.observe(el);
  }
})();
