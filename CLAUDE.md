# craighooper.xyz — Website Playbook

Last updated 2 November 2026.

## What this project is
Craig's personal site — a portfolio and a testbed for design ideas. Built as plain
static HTML/CSS/JS from Figma designs. No frameworks or build tools, apart from one small
deploy step for the homepage text (below).

**Current homepage (live since 2026-10-25):** built from the Figma frames `desktop-10.3`
(`3351:55`) and `mobile-10.3` (`3362:68`). Large Melange headline (`display-1`), bio
(`display-2`), Craig's portrait with a handwritten note laid over it (separate desktop and
mobile SVG overlays on `assets/portrait.jpg`), avatar top-left and Twitter / Instagram /
email icons top-right. Both corners scroll with the page (not sticky) and only fade in on
load — no slide — so they always land exactly in place. The 404 (`2836:364` / `2836:375`)
uses `display-1` for "Go home" over the bar photo.

`preview/` holds the draft the homepage was built from and is free for whatever comes next.
`lab/` holds standalone experiments: `hero-grid`, `infinite`, `texture-generator`, and the
spacing checker (`lab/spacing-checker/`). The v9 archives
were deleted on 2 November 2026, along with the fonts only they used (Means Web, KMR
Apparat, Marlin Soft).

The photo gallery (photos.craighooper.xyz) is a separate repo and Netlify site,
`CraigSeanHooper/craighooper-photos`. Nothing here applies to it.

## Who Craig is
Product designer in Ottawa, working on design systems and digital modernization at
Canadian Blood Services. He's not a developer — explanations should be plain and free
of dev jargon.

## Two kinds of change

**Words and links** — Craig handles these himself in Pages CMS (app.pagescms.org),
connected to GitHub. Editable: headline, bio paragraphs (a list), email address, and
Social Links (one Twitter URL, one Instagram URL — these drive the icons).

**How the text reaches the page (since 10 November 2026):** on every deploy, Netlify runs
`scripts/bake-home-text.py` (set in `netlify.toml`), which writes `content/home.json` into
`index.html`. The page arrives with the text already in it; there's no script swapping it in
after load (that made the headline change on screen). The text in the repo's `index.html` can
fall behind the CMS; that's fine, but don't hand-edit it as if it were the source. To preview
locally, run the script on your copy of the site. If the homepage markup it looks for changes
(the `headline` h1, the `bio` div, the `data-social` links), update the script too, or the
deploy fails and the last good version stays live.

The CMS depends on `.pages.yml` in the repo root. If a change adds or removes CMS fields,
update `.pages.yml` too. Never overwrite `content/home.json` with an older copy: Craig
edits it through the CMS, so a stale copy would quietly revert his live text.

**Design and features** — layout, styling, animation, new pages. That's Claude's part:
1. Craig shares Figma node IDs for the desktop *and* mobile frames, or says what to change.
2. Claude builds it as clean static files and tests it.
3. Claude asks Craig, then commits and pushes to `main`. Netlify deploys.
4. Claude tells Craig in a sentence or two what changed. Craig reviews on the live site.

## Publishing

The website's Claude Code project is Dropbox › Claude › Personal Digital Work, with the repo cloned at
`~/Library/CloudStorage/Dropbox/Claude/Personal Digital Work/craighooper` (moved there 10 November
2026). This is the only copy on the Mac: the website, the spacing checker and the texture
generator are all worked on from here (the tools' separate Dropbox folders were removed on
10 November 2026). Each tool's notes sit outside the repo, in Personal Digital Work ›
spacing-checker and › texture-generator, because this repo is public. Never put private
notes in the repo. If git errors oddly, Dropbox may have damaged its hidden files: clone
fresh from GitHub. The GitHub CLI is at
`~/.local/bin/gh` (not on the PATH) and is signed in as CraigSeanHooper; git uses it
for pushing. Set up 2 November 2026.

- **Pull `main` before starting work.** Craig edits words through the CMS, which
  commits to GitHub, so the local copy goes stale.
- **Always ask Craig before each commit and push.** Say in plain words what will go
  out. One yes covers one push, not the next.
- Commit straight to `main`. No branches, no pull requests.
- Commit as `Claude <noreply@anthropic.com>` (set per commit, not globally).
- Pull again right before pushing, then push.
- **Confirm it's live before saying so.** A push is not a deploy. Check the live page
  (add a `?v=` query to dodge caches, for your own checks only). If Netlify's build fails with "Host key
  verification failed", the fix is Netlify → Deploys → Trigger deploy → Clear cache and
  deploy site; if it repeats, relink the repo in Netlify.
- **Give Craig plain addresses**, like craighooper.xyz/lab/spacing-checker/, never with
  `?v=` on the end. If he may be seeing an old copy, tell him to press Cmd + Shift + R.
- The previous version is always in GitHub's history, so any publish can be undone.
- **Never ask Craig to type in the terminal.** Run commands yourself; at most send him to a
  web page or a Finder window.
- Craig sometimes asks for a zip to keep his own copy: zip the current `main` (full repo,
  no `.git`) and say where it ended up.

Tried and rejected for demos — don't offer these again:
- **Claude artifacts.** They open in the app's side panel, which Craig finds useless for
  judging desktop work. Never post site work or demos there.
- **Netlify branch deploys / test branches / pull-request previews.** Too much hassle;
  Craig will not change Netlify settings or click through pull requests for this.

## Design source
- Figma is the single source of truth. The website file is **Craighooper.xyz (Lab)**
  (`OfTv0sGvrystdl7kmkkLsx`) for lab work; **Foundations** (`ToLD1LsCFuUnQQQySDPCOI`) is
  the library holding Primitives, Scale, Colour (Light/Dark), and Typography.
  Colour, spacing, radius, stroke, and type are all bound to Foundations — new work uses
  those tokens, not one-off values.
- Match desktop and mobile artboards closely. Build the mobile layout to the mobile
  artboard, not a squished desktop.
- Figma is a reference, not a contract. Where a deliberate decision differs, the decision
  wins.
- Known quirk: the Figma variable plugin can't load KMR Melange Grotesk and will report
  "Regular" regardless of actual weight. The rendered canvas is ground truth.
- Never open, read or change a Figma file without Craig's go-ahead.

## Tokens, always
**Every value comes from Foundations. No exceptions, no raw numbers.** Colour, spacing,
radius, stroke width, and every part of type. In Figma, bind the variable. In CSS, use the
custom property: `var(--space-50)`, never `4px`.

**If no token fits, stop and say so.** Don't invent a one-off value or round to the nearest
token. The only raw values allowed are ones that aren't design decisions: aspect ratio
maths and image dimensions. Read token names out of Figma every time, not the resolved
pixel values.

## Typography roles
Typography holds **roles**, not fonts. Each role has one value per mode (modes include
FT System + Parabole, Melange + Parabole, and Melange), and text styles bind to a role.

What ships on the homepage and 404 is one face: **KMR Melange Grotesk SemiBold**,
-0.5px tracking, stylistic alternates on.

| Text style | Desktop | Mobile (≤820px) | Used for |
|---|---|---|---|
| `display-1/lg` · `/sm` | 64 / 60 | 40 / 40 | Headline, 404 "Go home" |
| `display-2/lg` · `/sm` | 48 / 48 | 24 / 26 | Bio |

Parabole Regular is the body face for some lab pages (`hero-grid`, `infinite`). The spacing
checker uses Inter instead (since 7 November; see its notes). Switching a
typeface is a token change plus a woff2 in `assets/fonts/`.

## Working with type in Figma (important)
- **Never set fontSize, lineHeight, fontFamily or fontStyle directly on a text node.**
  Doing so detaches its text style. This has repeatedly stripped Craig's styling.
- **Text styles bind to Typography only.** Primitives feed Typography, not styles.
- A node showing type bindings *is fine* when it also has a text style — those are
  inherited. Only nodes with **no style** need attention.
- Renaming a primitive is safe, but **changing its value flows everywhere it's aliased**.
- **A family variable holds the family name only** (`Means Web`, not `Means Web Light`).
- **Bind fontStyle before fontFamily.** Family first makes Figma refuse the write.
- Font family *and* style must both match what's installed exactly, or Figma silently
  doesn't swap.
- Components moved into Foundations can keep pointing at old imported copies of styles.
  Fix in Foundations: repoint the text to the local style of the same name, then publish.
- Claude's Figma session doesn't have Craig's locally installed fonts. To apply a style
  whose font is unavailable, pin the frame to a mode whose font *is* available, apply,
  then clear the override.

## CSS structure
`styles.css` mirrors Foundations: primitives → semantic → text-style classes. The class
names match the Figma style names, so `display-1/lg` is `.display-1` and steps down to its
`/sm` value at the 820px breakpoint. Keep that mapping.

**Headings:** use the semantic element and apply a text-style class to it —
`<h1 class="h1">`, `<h2 class="body-md primary">`. Reset only the default **margin**; don't
reset `font-weight`. Each text-style class sets its own weight already.

`font: inherit` on a button wipes the text-style class. Don't use it.

## Hosting
GitHub → Netlify, auto-deploy on push. Settled — don't re-open it unless Craig asks.

`_headers` lets photos.craighooper.xyz read `content/home.json`, so the gallery's
"Say hello" button uses the same CMS email as this site. Keep it.

## Conventions
- File and folder names: lowercase kebab-case only. Never underscores.
- Narrow request, narrow edit. Don't rebuild or delete assets that weren't asked about;
  ask first.
- Verify before publishing — test both breakpoints, both colour schemes, and that
  references actually resolve, in a real browser. Don't just confirm the code was written.
- Verify factual or technical claims before stating them.
- When recommending a tool or service, include its URL.

## How to communicate with Craig
- Brief. Long or meandering replies get called out. Lead with the answer.
- When Craig says he's confused, **don't re-explain at greater length.** Shorten
  drastically, or just tell him which buttons to press.
- Plain language. No play-by-play, no recaps, no code or file paths unless he asks.
- Publish, say what changed in a sentence or two, done.

## Continuity
This file and the tools' notes in Personal Digital Work carry context between sessions. If the
workflow changes, update this file.
