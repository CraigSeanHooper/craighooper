/* Banner collage.

   The composition is fixed here, not in the CMS. Each slot is a position and a
   width, given as a percentage of a 1600 x 937.5 stage, so the whole collage
   scales as one piece at every screen size.

   The CMS controls what goes IN the slots — the photo and its alt text — plus
   the headline. Photos are listed in the same order as the slots below, so
   reordering them in the CMS reshuffles the composition.

   Each photo also carries its own size. Photos are exported at twice their
   intended size, so once one loads its width is taken from the file itself.
   That way a photo keeps the size it was drawn at even if it's moved to a
   different slot. The width on each slot below is just the starting value. */

const SLOTS = [
  { x: 47.6875, y: 72.1067, w: 18.75    },
  { x: 80.4375, y: 74.9867, w: 13.375   },
  { x: 71.0625, y: -3.52,   w: 18.0625  },
  { x: 44.8954, y:  4.1168, w: 12.0625  },
  { x: -2.5,    y: 58.24,   w: 11.75    },
  { x: 16.1875, y: 30.9333, w: 11.75    },
  { x: 70.5,    y: 37.44,   w: 13.375   },
  { x: 18.75,   y: -4.0533, w: 17.0625  },
  { x: 87.8197, y: 28.8199, w: 16.0625  },
  { x: -4.5537, y: 23.2112, w: 14.75    },
  { x: 22.6527, y: 76.9954, w: 16.0625  }
];

/* Used when the content file can't be loaded — opening index.html straight from
   the folder, for instance. Keeps the page working offline. */
const FALLBACK = {
  headline: "A more meaningful home for photography",
  photos: [
    { src: "assets/images/image-11.jpg", alt: "" },
    { src: "assets/images/image-10.jpg", alt: "" },
    { src: "assets/images/image-9.jpg",  alt: "" },
    { src: "assets/images/image-8.jpg",  alt: "" },
    { src: "assets/images/image-7.jpg",  alt: "" },
    { src: "assets/images/image-6.jpg",  alt: "" },
    { src: "assets/images/image-5.jpg",  alt: "" },
    { src: "assets/images/image-4.jpg",  alt: "" },
    { src: "assets/images/image-3.jpg",  alt: "" },
    { src: "assets/images/image-2.jpg",  alt: "" },
    { src: "assets/images/image-1.jpg",  alt: "" }
  ]
};

function render(data) {
  const stage = document.getElementById("stage");
  const headline = document.getElementById("headline");

  headline.textContent = data.headline || FALLBACK.headline;

  const photos = (data.photos || []).filter(p => p && p.src);
  stage.innerHTML = "";

  photos.slice(0, SLOTS.length).forEach((photo, i) => {
    const slot = SLOTS[i];
    const figure = document.createElement("figure");
    figure.className = "photo";
    figure.style.setProperty("--x", slot.x + "%");
    figure.style.setProperty("--y", slot.y + "%");
    figure.style.setProperty("--w", slot.w + "%");
    figure.style.animationDelay = (i * 0.05) + "s";

    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = photo.alt || "";
    img.decoding = "async";

    /* once loaded, size the photo from the file rather than the slot */
    img.addEventListener("load", () => {
      const width = img.naturalWidth / 2;
      if (width) figure.style.setProperty("--w", (width / 1600 * 100) + "%");
      document.dispatchEvent(new Event("photos:ready"));
    });

    figure.appendChild(img);
    stage.appendChild(figure);
  });

  /* tells squircle.js the photos exist and can have their corners shaped */
  document.dispatchEvent(new Event("photos:ready"));
}

fetch("../../content/hero-grid.json", { cache: "no-store" })
  .then(r => (r.ok ? r.json() : Promise.reject()))
  .then(render)
  .catch(() => render(FALLBACK));
