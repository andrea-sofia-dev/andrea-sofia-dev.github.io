import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/press-start-2p';
import './style.css';
import { it as IT, nodes, skills, terminalScripts } from './content.js';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let scene = null;

// ---------- language ----------
// English is in the HTML; Italian comes from content.js.
const i18nEls = [...document.querySelectorAll('[data-i18n]')];
const EN = new Map(i18nEls.map((el) => [el, el.textContent]));
const enTitle = document.title;
const langButton = document.getElementById('lang');

function storedLang() {
  try {
    return localStorage.getItem('lang');
  } catch {
    return null;
  }
}

function storeLang(value) {
  try {
    localStorage.setItem('lang', value);
  } catch {
    // private mode or blocked storage: the choice just isn't remembered
  }
}

let lang = storedLang() || (navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en');

function text(el) {
  return lang === 'it' ? (IT[el.dataset.i18n] ?? EN.get(el)) : EN.get(el);
}

function applyLang(value) {
  lang = value === 'it' ? 'it' : 'en';
  root.lang = lang;
  for (const el of i18nEls) el.textContent = text(el);
  document.title = lang === 'it' ? IT['meta.title'] : enTitle;
  langButton.textContent = lang === 'it' ? 'EN' : 'IT';
  langButton.lang = lang === 'it' ? 'en' : 'it';
  langButton.setAttribute('aria-label', lang === 'it' ? 'Read in English' : 'Leggi in italiano');
  scene?.setLanguage(lang);
}

langButton.addEventListener('click', () => {
  applyLang(lang === 'it' ? 'en' : 'it');
  storeLang(lang);
});
if (lang !== 'en') applyLang(lang);

// ---------- copy buttons ----------
for (const button of document.querySelectorAll('[data-copy]')) {
  let timeout;
  button.addEventListener('click', async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
    } catch {
      ok = false;
    }
    button.textContent = ok ? (lang === 'it' ? IT.copied : 'Copied') : '✕';
    clearTimeout(timeout);
    timeout = setTimeout(() => (button.textContent = text(button)), 1600);
  });
}

// ---------- scroll: which section, and how far between two ----------
const sections = [...document.querySelectorAll('[data-shot]')];
const navLinks = [...document.querySelectorAll('.nav a')];
let centers = [];

function measure() {
  centers = sections.map((s) => {
    const r = s.getBoundingClientRect();
    return r.top + window.scrollY + r.height / 2;
  });
}

function progress() {
  const mid = window.scrollY + window.innerHeight / 2;
  if (mid <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (mid < centers[i + 1]) return i + (mid - centers[i]) / (centers[i + 1] - centers[i]);
  }
  return centers.length - 1;
}

let activeIndex = -1;
function setActive(index) {
  if (index === activeIndex) return;
  activeIndex = index;
  const id = sections[index]?.id;
  for (const a of navLinks) {
    if (a.hash === `#${id}`) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
}

let queued = false;
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    const p = progress();
    setActive(Math.round(p));
    scene?.setProgress(p);
  });
}

measure();
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });
new ResizeObserver(() => {
  measure();
  onScroll();
}).observe(document.querySelector('main'));

// ---------- project cards <-> 3D nodes ----------
const cards = new Map([...document.querySelectorAll('[data-node]')].map((c) => [c.dataset.node, c]));
for (const [id, card] of cards) {
  card.addEventListener('pointerenter', () => scene?.highlight(id));
  card.addEventListener('pointerleave', () => scene?.highlight(null));
  card.addEventListener('focusin', () => scene?.highlight(id));
  card.addEventListener('focusout', () => scene?.highlight(null));
}

function onNodeHover(id) {
  for (const [cardId, card] of cards) card.classList.toggle('is-linked', cardId === id);
}

// A click on a garage opens its project card.
function onNodeClick(id) {
  const card = cards.get(id);
  if (!card) {
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    return;
  }
  card.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  card.focus({ preventScroll: true });
  card.classList.remove('is-pulsed');
  void card.offsetWidth; // restart the animation
  card.classList.add('is-pulsed');
}

// ---------- the 3D scene, loaded after the text ----------
import('./scene.js')
  .then(({ createScene }) => {
    scene = createScene({
      canvas: document.getElementById('scene'),
      labelLayer: document.getElementById('labels'),
      nodes,
      skills,
      scripts: terminalScripts,
      lang,
      reducedMotion,
      onNodeHover,
      onNodeClick,
    });
    root.classList.add(scene ? 'webgl' : 'no-webgl');
    onScroll();
  })
  .catch((error) => {
    root.classList.add('no-webgl');
    console.warn('3D scene not available:', error);
  });
