/* The centred photo of Craig. Each click (or tap) shows the next photo, instantly;
   after the last one it goes back to the first. To add a photo, put it in
   /assets/craig-photos/ (square, 432 × 432, no corners: the frame rounds them) and add a line to this list. */
const PHOTOS = [
  { src: "/assets/craig-photos/craig-1.jpg", alt: "Craig taking a mirror selfie." },
  { src: "/assets/craig-photos/craig-2.jpg", alt: "Craig taking a mirror selfie." },
  { src: "/assets/craig-photos/craig-3.jpg", alt: "Craig taking a mirror selfie." },
  { src: "/assets/craig-photos/craig-4.jpg", alt: "Craig taking a mirror selfie." },
];

(() => {
  const button = document.getElementById("photo");
  const img = button && button.querySelector("img");
  if (!img) return;

  // load the rest ahead of time so each swap is instant
  const preload = () => PHOTOS.slice(1).forEach(p => { const i = new Image(); i.src = p.src; });
  document.readyState === "complete" ? preload() : addEventListener("load", preload);

  let current = 0;
  button.addEventListener("click", () => {
    current = (current + 1) % PHOTOS.length;
    img.src = PHOTOS[current].src;
    img.alt = PHOTOS[current].alt;
  });
})();
