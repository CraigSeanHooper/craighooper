"""
Builds the photo gallery at lab/photo-gallery/ before it goes live.

Reads lab/photo-gallery/content/photos/*.json, works out each photo's
orientation from the actual image file, and writes photos.json for the grid to
read. Then writes the heading and intro from content/page.json into index.html
between the <!--heading--> and <!--intro--> markers.

Runs on Netlify at publish time, after bake-home-text.py. If anything is wrong
it stops with an error, so the deploy fails and the last good version stays
live. Plain Python, no extra libraries. Nothing here needs editing by hand.
"""

import html
import json
import re
import struct
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
GALLERY = SITE / "lab" / "photo-gallery"
CONTENT_DIR = GALLERY / "content" / "photos"
OUT_FILE = GALLERY / "photos.json"
PAGE_FILE = GALLERY / "content" / "page.json"
INDEX_FILE = GALLERY / "index.html"

SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def fail(message):
    sys.exit("build-photo-gallery: " + message)


def image_size(path):
    """Reads width and height straight out of a JPEG or PNG header."""
    data = path.read_bytes()

    # PNG
    if len(data) > 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
        width, height = struct.unpack(">II", data[16:24])
        return width, height

    # JPEG: walk the segments until a start-of-frame marker
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 <= len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0xD9, 0xFF) or 0xD0 <= marker <= 0xD7:
                i += 2 if marker != 0xFF else 1
                continue
            if marker in SOF_MARKERS:
                height, width = struct.unpack(">HH", data[i + 5:i + 9])
                return width, height
            i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]

    fail("could not read dimensions from " + str(path.relative_to(SITE)))


def orientation(width, height):
    # Within 5% of square gets its own square frame, so it isn't cropped.
    if abs(width - height) / max(width, height) <= 0.05:
        return "square"
    return "landscape" if width > height else "portrait"


def build_photos():
    if not CONTENT_DIR.is_dir():
        print("No lab/photo-gallery/content/photos folder; writing an empty photos.json.")
        OUT_FILE.write_text("[]")
        return

    photos = []
    for file in sorted(CONTENT_DIR.glob("*.json")):
        record = json.loads(file.read_text(encoding="utf-8"))
        slug = file.stem

        image = record.get("image")
        if not image:
            fail(file.name + " has no image.")
        image_path = SITE / image.lstrip("/")
        if not image_path.is_file():
            fail(file.name + " points at a missing image: " + image)

        width, height = image_size(image_path)
        order = record.get("order")
        if isinstance(order, bool) or not isinstance(order, (int, float)):
            order = 9999
        tags = record.get("tags")

        photos.append({
            "slug": slug,
            "title": record.get("title") or slug,
            "image": image,
            "alt": record.get("alt") or "",
            "caption": record.get("caption") or "",
            "year": record.get("year") or "",
            "order": order,
            "tags": tags if isinstance(tags, list) else [],
            "orientation": orientation(width, height),
            "width": width,
            "height": height,
        })

    photos.sort(key=lambda p: (p["order"], p["slug"]))
    OUT_FILE.write_text(json.dumps(photos, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Wrote lab/photo-gallery/photos.json: " + str(len(photos)) + " photos.")


def build_page_text():
    """Drops the editable heading and intro into index.html between their markers.
    Rewriting the same markers each build keeps this safe to run repeatedly."""
    if not PAGE_FILE.is_file():
        print("No content/page.json; leaving the heading and intro as they are.")
        return

    page = json.loads(PAGE_FILE.read_text(encoding="utf-8"))
    text = INDEX_FILE.read_text(encoding="utf-8")

    for name in ("heading", "intro"):
        value = page.get(name)
        if value is None:
            continue
        pattern = re.compile("(<!--" + name + "-->)[\\s\\S]*?(<!--/" + name + "-->)")
        if not pattern.search(text):
            fail("lab/photo-gallery/index.html is missing the " + name + " markers.")
        safe = html.escape(str(value), quote=False)
        text = pattern.sub(lambda m: m.group(1) + safe + m.group(2), text, count=1)

    INDEX_FILE.write_text(text, encoding="utf-8")
    print("Updated the gallery heading and intro from content/page.json.")


build_photos()
build_page_text()
