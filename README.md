# Craig Hooper — website

A static one-page site rebuilt from your Figma design. No build step, no
framework, no dependencies. Everything is included — fonts and image both in.

## Files
```
craighooper/
├── index.html              the page
├── styles.css              all styling + responsive behavior
└── assets/
    ├── bg-portrait.jpg      blurred portrait (full-res 2400×1360, ~72 KB)
    ├── squircle.js          draws the squircle button corners
    └── fonts/
        ├── MarlinSoftSQ-ExtraBlack.woff2
        └── Parabole-Regular.woff2
```

## View it
Double-click `index.html`, or run a tiny server from this folder:
```
python3 -m http.server 8000
```
then open http://localhost:8000

## One thing to set
The three button links in `index.html` are placeholders (marked `TODO`):
- **Say hello** → `mailto:` (your email)
- **Twitter** → your X/Twitter URL
- **Cosmos** → wherever this points

## Optional tweaks
- The headline has a uniform 2px blur (matching the Figma design). It's the
  single `filter: blur(2px)` line on `.headline` in `styles.css` — change the
  value or delete the line for sharp text.
- There's a subtle fade-up on load. To remove it, delete the
  `prefers-reduced-motion` block at the bottom of `styles.css`.

## Hosting
Drop this folder on any static host — Cloudflare Pages, Netlify, Vercel, or
GitHub Pages all work and have free tiers. Point your domain at it, then turn
off Framer.
