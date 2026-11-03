// Spacing checker

const landing = document.querySelector('.landing');
const tool = document.querySelector('.tool');
const strip = tool.querySelector('.strip');
const widthReadout = strip.querySelector('.width');
const progress = tool.querySelector('.progress');

// The control strip uses the same breakpoint selector as the landing screen.
strip.prepend(landing.querySelector('.selector').cloneNode(true));

const toggles = [...document.querySelectorAll('.toggle')];
const widths = { tablet: 768, phone: 390 };   // Desktop measures the live window width
let breakpoint = 'desktop';

function showWidth() {
  widthReadout.textContent = widths[breakpoint] || window.innerWidth;
}

// Breakpoint toggles: one is on at a time, kept in step on both screens. Each is its own
// Tab stop; Enter, Space or a click picks it.
function select(name) {
  breakpoint = name;
  toggles.forEach(t => t.setAttribute('aria-pressed', t.dataset.breakpoint === name));
  showWidth();
}

toggles.forEach(toggle => toggle.addEventListener('click', () => select(toggle.dataset.breakpoint)));
window.addEventListener('resize', showWidth);

// Specs switch
const specs = strip.querySelector('.switch');
specs.addEventListener('click', () => {
  specs.setAttribute('aria-checked', specs.getAttribute('aria-checked') !== 'true');
});

// Enter and the arrow button both load the page, from either screen.
function load(address) {
  strip.querySelector('.field input').value = address;
  landing.hidden = true;
  tool.hidden = false;
  showWidth();

  // The loading line creeps forward while waiting. Finishing it, once the page has
  // loaded and its specs are measured, comes with the measuring step.
  progress.classList.remove('creep');
  void progress.offsetWidth;
  progress.classList.add('creep');
}

document.querySelectorAll('.field').forEach(form => form.addEventListener('submit', e => {
  e.preventDefault();
  const address = form.querySelector('input').value.trim();
  if (address) load(address);
}));
