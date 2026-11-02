// Spacing checker

const toggles = [...document.querySelectorAll('.landing .toggle')];
let breakpoint = 'desktop';

// Breakpoint toggles behave as one radio group: click to pick, arrow keys to move.
function select(toggle, focus) {
  toggles.forEach(t => {
    const on = t === toggle;
    t.setAttribute('aria-checked', on);
    t.tabIndex = on ? 0 : -1;
  });
  breakpoint = toggle.dataset.breakpoint;
  if (focus) toggle.focus();
}

toggles.forEach((toggle, i) => {
  toggle.addEventListener('click', () => select(toggle));
  toggle.addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    select(toggles[(i + step + toggles.length) % toggles.length], true);
  });
});

// Enter and the arrow button both submit. Loading and measuring come in later steps.
document.querySelector('.landing .field').addEventListener('submit', e => {
  e.preventDefault();
});
