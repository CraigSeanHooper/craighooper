// Spacing checker

const toggles = [...document.querySelectorAll('.landing .toggle')];
let breakpoint = 'desktop';

// Breakpoint toggles: one is on at a time. Each is its own Tab stop; Enter, Space or a
// click picks it.
function select(toggle) {
  toggles.forEach(t => t.setAttribute('aria-pressed', t === toggle));
  breakpoint = toggle.dataset.breakpoint;
}

toggles.forEach(toggle => toggle.addEventListener('click', () => select(toggle)));

// Enter and the arrow button both submit. Loading and measuring come in later steps.
document.querySelector('.landing .field').addEventListener('submit', e => {
  e.preventDefault();
});
