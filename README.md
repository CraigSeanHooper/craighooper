# Craig Hooper — alternate design (v2)

Standalone preview of the alternate Figma design (`home/desktop-2` + `home/mobile-2`).
This is SEPARATE from your live site — nothing here touches craighooper.xyz.

## Two assets needed to make it match exactly
The layout, copy, and links are all real. To finish the look, add:

1. **Fonts** — KMR Melange Grotesk (Bold + Medium). Licensed, so supply them yourself.
   Place the web versions at:
   - `assets/fonts/KMRMelangeGrotesk-Bold.woff2`
   - `assets/fonts/KMRMelangeGrotesk-Medium.woff2`
   (Send me the `.otf`/`.ttf` and I'll convert + drop them in.)

2. **Avatar** — the animated GIF above the heading. Export from Figma and save as:
   - `assets/avatar.gif`

Until both are added, it falls back to a system font and hides the avatar slot.

## Preview
Double-click `index.html`, or run a tiny server from this folder:
```
python3 -m http.server 8000
```

## If you decide to switch to this design
Nothing about hosting changes. I'd swap these files into your existing repo,
you upload to GitHub the usual way, and Netlify redeploys craighooper.xyz.
