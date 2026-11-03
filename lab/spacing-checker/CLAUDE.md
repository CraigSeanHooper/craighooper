# Spacing checker — project knowledge

Last updated 2 November 2026.

The tool's code lives in this folder, `lab/spacing-checker/`, served at
craighooper.xyz/lab/spacing-checker/. The site-wide rules in the repo root's `CLAUDE.md`
(tokens, publishing, testing, how to talk to Craig) apply here too.

## What it is

A browser tool for inspecting a page's spacing. You enter a URL and choose a breakpoint (desktop, tablet or phone). Release 1 measures the vertical gaps between a page's main sections; comparing against Figma and the Foundations spacing scale comes later.

## Purpose and build plan

The tool is for checking external webpages: any public site, not Craig's own. Checking only craighooper.xyz pages would be of little use, since Claude builds those pages.

Version 1 checks craighooper.xyz pages only. It exists purely as a stepping stone to version 2 and isn't a product in its own right: it proves the measuring and the interface on test pages under `craighooper.xyz/lab/` without needing a server. Anything specific to version 1, such as the error message mentioning craighooper.xyz, is temporary.

Version 2 is the real tool. A Netlify function opens any public URL in a hidden browser at each breakpoint and measures it there. The measuring code is written so it carries over unchanged from version 1. Only the way the page is loaded gets swapped. The photo gallery won't be checked.

## User flow

Craig has connected the screens on the Spacer page with connector arrows (added through a plugin). The flow: landing → loading → desktop loaded, with loading able to end on the error screen instead. The breakpoint toggles switch between the loaded screens, and the URL field returns to loading.

## Desktop only

The tool is desktop only. It works at window widths of **1024 and up** (decided 31 October). Below 1024, Desktop would show most sites in their tablet layout and so measure the wrong design, and the tablet view needs its full 768 column plus room for the bar (up to 760 wide). Under 1024, everything hides and a message shows instead: "Not optimized for phones or small screens", centred over the same violet glow as the landing screen. The design is the `canvas - desktop - message` frame on the Spacer page, now 1023 wide (the widest window that gets the message).

## Headings

Headings (the landing "Spacing checker" heading, the error title and the small-screen message) use the local text style `spacer/heading` in the Lab file: Exposure [-10] Regular from 205TF, with size (`font-size/32`), line height (`line-height/34`) and letter spacing (`letter-spacing/heading`) bound to Foundations tokens. Exposure is deliberately kept out of Foundations because it's only used in the spacing checker; local styles are grouped by tool and page name, like `writer/` for the Writer page. The font is installed only on Craig's computer, so Claude can't set or apply it in Figma. The web font is `assets/fonts/Exposure10.woff2` (added 2 November), a single static cut, Exposure [-10] Regular, weight 425 (not a variable font).

Body text (the URL field, the Specs label, the gap count) uses `body/sm/lg`: Parabole Regular (`assets/fonts/Parabole-Regular.woff2`), `font-size/14`, `line-height/20`. Spec chips use `body-semibold/xs/lg` (`font-size/12`, `line-height/18`). Every Spacer screen is pinned to the Typography mode "Melange + Parabole".

## Breakpoints

The three breakpoints are desktop (full width), tablet (768) and phone (390). At tablet and phone the page sits in a centred column running the full height of the frame, with `surface/backdrop` filling the frame behind it and behind the bar.

## Figma

The file is Craighooper.xyz (Lab), fileKey `OfTv0sGvrystdl7kmkkLsx`. Screens are on the Spacer page; components are on the Components page.

Screens:

- `canvas - desktop` is the landing screen: the heading "Spacing checker", the breakpoint selector and the URL input, all centred. Behind them is `glow`, a large radial gradient (1170×670) rising from below the bottom edge, pinned to the bottom and clipped by the frame, with a 144px layer blur. It's meant to be subtle enough that some people won't notice it. The small-screen message frame has an identical glow.
- `canvas - desktop / loading`, `canvas - desktop / loaded`, `canvas - tablet / loaded` and `canvas - phone / loaded` show the states after a URL is entered. The page fills the frame (full width on desktop), and the control strip floats over it, centred at the bottom inside a `bar area` wrapper with `space/200` padding below. Clip content is off on every `bar area` so the strip's shadow isn't cut off.
- `canvas - desktop / error`, `canvas - desktop / no gaps` and `canvas - desktop - message` cover the error, no-gaps and small-screen cases.
- `canvas - desktop / specs on`, `canvas - tablet / specs on` and `canvas - phone / specs on` show the measurements over a mock page of grey stand-in sections, all using `gap-marker`. Each includes a 4px and an 8px gap (added 1 November) alongside the larger ones, and each bar reads "5 gaps". Desktop gaps are 40, 4, 64, 8 and 48; tablet 32, 4, 48, 8 and 40; phone 24, 4, 32, 8 and 24. The markers sit comfortably in both narrow columns, so the marker design needs no changes at tablet or phone.
- Three hidden frames, `loading - option A/B/C`, are the loading options that were compared. Option B (progress line along the top) was chosen.

Components:

- `breakpoint-toggle`, a single icon button, 32×32: the 24 icon plus `space/50` padding all round, hugging its contents (changed from a fixed 30 wide on 2 November). Corners are `radius/xs` at max smoothing (2 November): inside the track, a nested corner should be the outer corner minus the padding between them (8 − 4 = 4), so `radius/sm` looked wrong. Its properties are Device (Desktop, Tablet, Phone), Selected (True, False) and State (Default, Hover, Focus). Only unselected toggles have a Hover state.
- `breakpoint-selector`, a segmented control (2 November, like the product switcher in Figma's toolbar): the three toggles sit in a track filled with `control/segment/track`, `space/100` apart, with `space/50` padding and `radius/sm` corners at max smoothing, 120×40. Its one property is Active (None, Desktop, Tablet, Phone). The selected toggle uses `control/segment/selected` and the hover `control/segment/hover`.
- `input`, the URL field, now a component set (31 October). Properties: State (Default, Focus) and Filled (False, True), plus Label, Show Label and Show Icon. Focus adds the focus ring (`border/focus` at `stroke/md`, outside the edge, matching the toggles). Filled=True shows typed text in `text/primary` instead of the `text/muted` placeholder; the address in the control strip on every loaded screen uses Filled=True. Fill is `control/fill/field`, outline `border/subtle`, effect style `shadow/sm`. On the landing screen the input instance overrides this to `shadow/xs`, and the build follows the screen (2 November).
- `overlay-switch`, a labelled switch ("Specs") that shows or hides the spec overlay. Its properties are On (True, False) and State (Default, Focus). The track is 36×16 with `space/25` padding and `radius/full`; the knob is a 16×12 capsule in `control/fill/field`. The label is `text/secondary`, `space/100` from the track.
- `control-strip`, the compact floating bar shown once a page loads, like Figma's bottom toolbar. It hugs its contents (selector, width, input, gap count and overlay switch, `space/400` apart) and has `radius/lg` corners. Padding is `space/100` top and bottom and `space/400` at the sides. Effect style `shadow/xs`, no stroke (31 October). The selector and the switch are exposed nested instances, so Active and On are set on each instance.
  - **Width** (added 31 October): the width being measured, right after the breakpoint toggles, in `body/sm/lg` and `text/secondary`, as a plain number. Properties: Width (text) and Show Width (Boolean, on by default). It reads the live window width on Desktop, 768 on Tablet and 390 on Phone, and is hidden on the error screen. Placing it beside the gap count, or as a sticky label at the page's top-right, were both considered and rejected: the first mixes two readouts, the second covers part of the page being checked.
  - **Gap count** (added 31 October): a text beside the Specs switch in `body/sm/lg` and `text/secondary`. Properties: Show Count (Boolean, off by default) and Gap Count (text, e.g. "6 gaps" or "No gaps found"). It's on in the specs-on and no-gaps screens.
- `spec`, the pixel chip, with a Label text property.
- `gap-marker` (added 1 November): the whole marker for one gap, so the line, both end caps and the `spec` chip are one component. It's a vertical auto-layout (cap, line, cap) 40 wide; resize its height to the gap and the line stretches while the chip stays pinned to the vertical centre. Clip content is off and the chip sits on top, so on gaps smaller than the chip it overlaps the sections either side without being cut off. The `spec` chip is an exposed instance, so its value is set from outside. Property: Show Caps (Boolean, on by default), turned off for gaps under 8px so only the line shows.
- `loader` (added 1 November): a 16px circular loader, a `progress/track` ring with a `progress/fill` quarter arc, matching the loading line. It spins continuously in the build (static for reduced motion). It sits in the control strip after the gap count, behind the strip's Show Loader property (off by default); during a re-measure Show Count is off and Show Loader is on.
- Component properties use Title Case (e.g. Show Caps, Gap Count).

## Tokens

All values come from Foundations (fileKey `ToLD1LsCFuUnQQQySDPCOI`).

- `surface/chrome` is the control strip background (neutral/5 in Light, neutral/80 in Dark; Dark changed from neutral/95 on 1 November so the bar stands out on dark websites, where its shadow disappears).
- `surface/backdrop` is the area either side of the tablet and phone page (neutral/20 in Light, neutral/80 in Dark).
- `surface/page` is the landing screen background (neutral/0 Light, neutral/90 Dark).
- `surface/raised` fills the mock page sections (neutral/5 Light, neutral/95 Dark).
- `control/fill/field` is the text input fill on any surface (neutral/0 in Light, neutral/90 in Dark).
- `control/fill/open` was the selected toggle fill until 2 November (neutral/20 Light, neutral/50 Dark); the toggles now use `control/segment/selected`.
- `control/segment/track`, `control/segment/selected` and `control/segment/hover` (added 2 November) colour the breakpoint selector. Track: neutral/10 Light, neutral/70 Dark. Selected: neutral/0 Light (a white toggle on the grey track, like Apple's segmented controls), neutral/50 Dark. Hover: neutral/5 Light, neutral/60 Dark. They're separate from the general `control/fill/open` and `control/fill/hover`, which other controls use and which were left alone. (A pale track with a grey selected toggle was rejected: the track would vanish on the bar, which is neutral/5.)
- `border/subtle` is the input's outline (neutral/10 Light, neutral/80 Dark).
- `control/switch/track-off` and `control/switch/track-on` are the switch track (off: neutral/20 Light, neutral/70 Dark; on: neutral/90 Light, neutral/10 Dark).
- `text/primary` (neutral/90 Light, neutral/10 Dark), `text/secondary` (neutral/70 Light, neutral/20 Dark) and `text/muted` (neutral/50 both).
- `glow/centre`, `glow/mid` and `glow/edge` are the glow's gradient stops, fixed at 100%, 70% and 0% opacity within the gradient. Light: violet/20, violet/10, violet/5 (a deeper colour at low opacity gives the centre depth while staying faint). Dark: violet/80, violet/90, violet/95 (switched from clay on 31 October). Primitives such as violet are hidden from Figma's pickers (scopes off), so they're always used through semantic tokens like these.
- `spec/fill` is the spec chip fill (`colour/accent/red`, #EF4444, in both modes); chip text is `text/on-dark`.
- `border/focus` is the focus ring (neutral/90 in Light, neutral/10 in Dark), at `stroke/md` (2px), outside the edge.
- `progress/fill` is the loading line and the loader's arc: neutral/50 in Light, neutral/30 in Dark (Dark lightened from neutral/50 on 2 November, once the blank loading page started following the mode, so the line stands out on the dark page). `progress/track` is `colour/transparent` (a new Foundations primitive) in both modes, so there's no visible track. The loader in the bar shares both tokens.
- Effect styles: `shadow/xs` on the control strip, `shadow/sm` on the input component (but `shadow/xs` on the landing screen's input, an override the build follows).

Foundations has no disabled tokens. None are needed for release 1.

Writer-only control tokens are kept in a `writer/control/fill/` group. The spacing checker must not use them.

## Decisions

- Specs-on state: grey stand-in sections (`surface/raised`) with a 1px `spec/fill` line and end caps across each gap, and a `spec` chip beside the line showing the gap in pixels. Each gap marker is a vertical auto-layout (cap, line, cap) whose line fills the height, so it stretches with the gap. The chip is absolutely positioned and pinned to the vertical centre, so it keeps its size and stays centred. The lines, caps and chip all use `spec/fill`; no separate marker tokens. The marker sits at the horizontal centre of the page.
- Error state (`canvas - desktop / error`): the bar stays as it is, and the blank page shows a centred message, "This page couldn't load" (`spacer/heading`, `text/primary`) above "Check the address, and make sure it's a craighooper.xyz page." (`text/secondary`), `space/200` apart.
- Loading state (`canvas - desktop / loading`): a 2px progress line across the top of the page, `progress/track` with `progress/fill`. The page area stays blank until the specs are ready.
- No-gaps state (`canvas - desktop / no gaps`, 31 October): the page loads normally and the gap count reads "No gaps found". The Specs switch stays as it is; no disabled state.
- The control strip uses `shadow/xs` and no stroke so it stays visible over grey sections as well as white pages (31 October). The mock page keeps `surface/raised`.
- Glow strength is set only by the glow layer's opacity under Appearance (currently 24%), on both glows. Never adjust the gradient stops' opacities: they stay at 100%, 70% and 0%. Changing stop opacities proved confusing and broke the glow. Colours are changed only through the `glow/` tokens in Foundations.
- Controls sit centred on the landing screen and move into a floating bar at the bottom once a page loads.
- The bar must never permanently cover the bottom of the page. The tool sizes the page frame to the page's full height, scrolls the tool itself, and adds blank space below the page equal to the bar's height plus its gap, so the end of the page scrolls clear of the bar. The page being checked is never edited. The server version does the same below its full-page capture.
- The landing screen shows Desktop selected by default (Active=Desktop). The None variant exists but isn't used there.
- On the landing screen, the breakpoint toggles only choose the breakpoint: the selected toggle changes, nothing else on the screen moves, and nothing loads. When a URL is then entered, the page opens at the chosen breakpoint.
- The toggles have no pressed state, because the switch to selected is the feedback.
- Spec chips show the gap as a number (e.g. "40"), filled with `spec/fill`, which points to `colour/accent/red` (#EF4444) in both Light and Dark so it reads on any page. Chip text is `text/on-dark`. Chip padding is `space/50` top and bottom and `space/100` at the sides, with `radius/xs` corners.

- Build decisions (2 November). The `/ loaded` screens are skeletons; the `/ specs on` screens are the real design. Specs starts on after a page loads. Clicking the arrow in the URL field and pressing Enter both load the page. The loading line creeps forward while waiting, then runs to the end once the page has loaded and the specs are measured.
- Sizes with no token (2 November): the marker line stays 1px and the switch track width stays 36, both typed in. End caps stay 9px wide, typed in, so they centre exactly on the 1px line (8px was tried and reverted on 2 November: it sits half a pixel off). The switch knob and track heights use the 12 and 16 tokens.
- Corner smoothing (2 November): the toggles, URL field, control strip and spec chips have corner smoothing at max (100%) in Figma; the switch is fully round, so it doesn't apply. The build matches it with `smooth-corners.js`, which draws each shape, its outside strokes, focus ring and shadow in an SVG behind the content. Don't use the site's `assets/squircle.js` here: it trims the element to the shape and would cut off outlines, shadows and focus rings. Mark new smoothed parts with `data-smooth` and a `--corner` radius token; shadows go on the SVG as `drop-shadow` filters (blur halved to match Figma).
- Hover states (2 November): the URL field has no hover, by design (like the Claude app's chat input). The Specs switch has no hover in release 1, because Foundations has no hover colour token for it; revisit later. Only the unselected breakpoint toggles have a hover (`control/segment/hover`).
- Loading screen build (2 November): entering an address on the landing screen switches to the loading screen, with the address in the bar. While loading, the blank page area follows the mode (`surface/page`, decided 2 November), like the error screens, so dark mode doesn't flash white; in Figma the `page (desktop)` frame on both loading screens is bound to it. A loaded website keeps its own colours. The loading line uses `stroke/md` for its 2px height (no size token fits); in Figma the line and its track are bound to `stroke/md` too, on the loading and re-measuring screens in Light and Dark. Until measuring is built, it creeps to about 90% and stops there. The bar's breakpoint selector stays in step with the landing one, and the width readout follows the window on Desktop.
- Keyboard (2 November): Tab moves through each breakpoint toggle in turn, then the URL field, then the arrow button. Enter or Space picks a toggle. The arrow button gets its own focus ring (`border/focus` at `stroke/md`, `radius/sm`), which Figma doesn't show yet; the field's ring shows only while typing.

- Dark mode review (1 November): error screens' page area is bound to `surface/page`. Every `mock page` frame is pinned to Light mode, because a real website keeps its own colours whatever mode the tool is in. Dark copies of 13 screens, each named with "(dark)", sit in a row below the Light screens on the Spacer page.

## Release 1 scope (agreed 29 October, updated 31 October 2026)

The tool finds the main sections of a page and measures the vertical space between each section and the next. Each gap gets a red spec chip showing its pixel value, and the Specs switch shows or hides them. All chips are the same colour, because nothing is being judged against a scale yet. The bar shows the total, such as "6 gaps", or "No gaps found" when there are none; the count is part of release 1 (31 October).

## Next step

The tool looks inside each section and measures the spacing between the elements within it, such as heading to paragraph and paragraph to button. It uses the same measuring approach, one level deeper.

## Comparison, later

The second input is a link to a Figma frame, one for each breakpoint, because the design in Figma is the reference to check against. The tool measures the gaps between the main sections of that frame and lines them up with the page, section by section, showing where the page differs from the design and whether each gap is on the spacing scale. The scale doesn't need its own input; the tool reads it from the site. In the interface, the Figma link sits behind a small "Compare" button in the bar that opens a second field, so the bar stays as it is for release 1. The comparison release brings back on-scale and off-scale colours and nearest-token labels.

## How to reply to Craig

- Never dump a mountain of content. Give the few things that matter most (three to five at most), short, and offer more only if asked.
- When Craig asks what's next or says to wait, answer or wait. Don't start building until he asks for it.

## Build notes (for Claude, not for replies)

- Main sections: the visible direct children of `<main>`, plus header and footer; if there's no `<main>`, the visible direct children of `<body>`. Gaps are rounded to whole pixels.
- The spacing scale for comparison comes from the site's `space/` CSS variables. Figma's variables API is, as far as is known, Enterprise-only, so it isn't used for the scale.
- Below 1024px wide, show only the small-screen message.
- The control strip changes width as its text changes (the width readout, "Re-measuring", the gap count). It must animate smoothly when it widens and narrows, staying centred, rather than jumping. Respect reduced-motion settings (no animation for those users). Requested by Craig, 1 November.
- Don't mention HTML, CSS or API mechanics in replies to Craig.

## Edge cases to decide before the build (raised 31 October)

Each lists the possible solutions; the first one is Claude's suggestion. All six are decided.

### Resizing the window on Desktop — decided 31 October

With Desktop selected the page is as wide as the window, so narrowing it can cross the site's own breakpoints and move its sections. Tablet and phone are fixed widths and aren't affected.

Decision: hide the marks while the window is being resized, show the loading line, and re-measure once resizing stops. The width readout in the bar updates to the new window width. (Rejected: keeping the page at its loaded width, and re-measuring live while resizing.)

### The page changes after it's measured — decided 1 November

Late images, fonts, a cookie banner, an accordion or scroll-triggered animations can move sections after the marks are drawn.

Decision: wait for the page to settle before the first measure, then re-measure automatically whenever the page changes. During a re-measure the page stays visible, the marks are hidden, the loading line runs along the top, and the gap count is replaced by a small circular loader (`loader` component) until the new count comes back. The design is `canvas - desktop / re-measuring` on the Spacer page. (Rejected: a floating note above the bar, and a centred status over the page.)

### Full-height sections — decided 1 November

Pages are shown at full size, never scaled down. A hero built to match the screen's height must appear in the tool at the height of Craig's actual screen, exactly as a visitor sees it, so the gaps below it are measured in the right place. (Build note: the frame holding the page is as tall as the whole page, so screen-height sections must be held at the real window height before measuring.) (Rejected: scrolling inside the page frame, and leaving it until version 2.)

### Clicking a link inside the page — decided 1 November

Decision: links to pages within the site being tested load in the tool. The address in the bar updates to match, and the page is measured again using the re-measuring state. (Disabling links was considered, but it would force people to copy addresses from another tab.) Links to other websites end on an error screen, `canvas - desktop / error external`: "This link leaves the site" over "Only pages on craighooper.xyz can be measured. Go back to the last page.", where "Go back to the last page." is a `text/link` underlined link that reloads the page they came from. In version 1 the tested site is always craighooper.xyz; in version 2 it's whatever site was entered. A browse mode (like Pastel's Browse/Comment toggle) is a later idea, for measuring pages with a menu, tab or accordion opened.

### Overlapping or side-by-side sections — decided 1 November

Decision: skip them. Side-by-side sections count as one row, so the next gap is measured from the bottom of the taller one. When a section overlaps the one above it (e.g. a card pulled up over a hero), no marker is drawn for that pair; the next gap is measured from the lower of the two bottom edges. (Rejected for release 1: marking overlaps with a shaded band and an outlined "−24 overlap" chip. Worth revisiting in the comparison release, where an overlap that isn't in the Figma design would be a real finding.)

### Gaps smaller than the chip — decided 1 November

Decision: the chip stays centred on the line and overlaps the sections either side, always on top and never cut off by the page. For gaps under 8px the end caps are hidden and only the line shows (Show Caps off; the build does this automatically). (Rejected: moving the chip aside with a leader, and hiding the chip until hover.)

## Build plan (agreed 2 November)

1. Screens without measuring: landing, small-screen message, control strip and its parts, loading line, both error screens, Light and Dark. Check each against its Figma frame.
2. Test pages: one per decided case (4px and 8px gaps, side-by-side sections, an overlapping card, a full-height hero, a late-loading image, internal and external links, no gaps).
3. Measuring: find sections, measure gaps, draw `gap-marker`s, gap count, Specs switch.
4. Page changes: re-measure on resize and when the page shifts, the `loader`, the bar animating its width, in-site links.
5. Final check against Figma at all three breakpoints, both modes, reduced motion on.

Version 2 (Netlify function, any public site) comes after.

## Open items

- Test pages are still to be built (inside this folder).
- In Figma, the hint text on `canvas - desktop / error external` has no text style, and `canvas - desktop / re-measuring` has no flow arrows. Both are Craig's to fix.

