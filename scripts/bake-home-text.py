"""Write the Pages CMS homepage text (content/home.json) into index.html.

Netlify runs this on every deploy (see netlify.toml), so the homepage arrives with
Craig's current headline, bio, email and social links already in place, instead of
swapping them in with JavaScript after the page loads.

It only changes Netlify's copy during the deploy. To preview locally, run it on a
copy of the site: python3 scripts/bake-home-text.py <site folder>
If any part of index.html it looks for is missing, it stops with an error, so the
deploy fails and the last good version stays live.
"""
import html
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
data = json.loads((root / "content/home.json").read_text(encoding="utf-8"))
page_path = root / "index.html"
page = page_path.read_text(encoding="utf-8")


def text(s):
    return html.escape(s, quote=False)


def swap(pattern, build):
    global page
    page, count = re.subn(pattern, build, page, count=1, flags=re.S)
    if count != 1:
        sys.exit(f"bake-home-text: couldn't find {pattern!r} in index.html")


headline = data.get("headline", "")
if headline.strip():
    inner = "<br>".join(text(line) for line in re.split(r"\r?\n", headline))
    swap(r'(<h1 class="display-1 headline">).*?(</h1>)',
         lambda m: m.group(1) + inner + m.group(2))

bio = [p for p in data.get("bio") or [] if p]
if bio:
    paras = "".join(f'\n      <p class="display-2">{text(p)}</p>' for p in bio)
    swap(r'(<div class="bio">).*?(</div>)',
         lambda m: m.group(1) + paras + "\n    " + m.group(2))

links = dict(data.get("social") or {})
if data.get("email"):
    links["email"] = "mailto:" + data["email"]
for key, url in links.items():
    if key in ("twitter", "instagram", "email") and url:
        swap(r'(<a href=")[^"]*(" [^>]*data-social="' + key + r'")',
             lambda m, u=url: m.group(1) + html.escape(u) + m.group(2))

page_path.write_text(page, encoding="utf-8")
print("bake-home-text: homepage text filled in from content/home.json")
