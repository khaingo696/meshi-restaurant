// Demo wiring for the prototype page (not part of the door module).
import { createDoorIntro } from './meshi-door/index.js';

const params = new URLSearchParams(location.search);
const doorEl = document.getElementById('meshi-door');
const pointerParam = params.get('pointer')?.split(',').map(Number);

// The site's hero video is the page background and the door's `interior`,
// so what glows through the paper is what you see once the door opens.
const intro = createDoorIntro(doorEl, {
  interior: document.querySelector('.demo-room'),
  renderer: ['webgl', '2d'].includes(params.get('renderer')) ? params.get('renderer') : 'auto',
  quality: params.get('quality') ?? 'auto',
  debugTime: params.has('t') ? Number(params.get('t')) : null,
  debugPointer: pointerParam?.length === 2 ? { x: pointerParam[0], y: pointerParam[1] } : null,
  autoOpen: params.has('autoplay') ? Number(params.get('autoplay')) || 0 : false,
});
window.meshiDoor = intro;

const heroEl = document.querySelector('.hero');
const heroKicker = document.querySelector('.hero-kicker');
const kickerNodes = heroKicker ? [...heroKicker.querySelectorAll('.kicker-node')] : [];

// Ambient cycle + Interactive hover/focus for Ideas 2 + 3 + 4
let activeWord = 0;
let isHovered = false;
let ambientTimer = 0;

const setActiveWord = idx => {
  activeWord = Number(idx);
  if (heroEl) heroEl.dataset.activeWord = String(activeWord);
};

const startAmbientCycle = () => {
  clearInterval(ambientTimer);
  ambientTimer = setInterval(() => {
    if (!isHovered) {
      setActiveWord((activeWord + 1) % 3);
    }
  }, 3200);
};

if (heroEl && heroKicker && kickerNodes.length) {
  startAmbientCycle();

  kickerNodes.forEach(node => {
    const idx = Number(node.dataset.word);
    node.addEventListener('pointerenter', () => {
      isHovered = true;
      heroEl.classList.add('is-word-hovered');
      setActiveWord(idx);
    });
    node.addEventListener('focus', () => {
      isHovered = true;
      heroEl.classList.add('is-word-hovered');
      setActiveWord(idx);
    });
    node.addEventListener('click', () => {
      setActiveWord(idx);
    });
  });

  heroKicker.addEventListener('pointerleave', () => {
    isHovered = false;
    heroEl.classList.remove('is-word-hovered');
  });

  heroKicker.addEventListener('focusout', e => {
    if (!heroKicker.contains(e.relatedTarget)) {
      isHovered = false;
      heroEl.classList.remove('is-word-hovered');
    }
  });
}

// Disciplined Door Threshold Sync:
// "Taste · Feel · Connect" emerges from the Shoji door center seam as it opens (0 -> 1),
// then rests quietly above the slogan.
let doorSyncRaf = 0;
const syncKickerWithDoor = () => {
  if (!heroKicker) return;
  const p = Math.min(1, Math.max(0, intro.progress ?? 1));
  heroKicker.style.setProperty('--door-p', p.toFixed(4));

  if (intro.state === 'opening' && p < 0.995) {
    heroKicker.classList.add('is-door-sync');
    doorSyncRaf = requestAnimationFrame(syncKickerWithDoor);
  } else {
    heroKicker.style.setProperty('--door-p', '1');
    heroKicker.classList.remove('is-door-sync');
  }
};

doorEl.addEventListener('meshi-door:statechange', () => {
  cancelAnimationFrame(doorSyncRaf);
  if (intro.state === 'opening') {
    syncKickerWithDoor();
  } else {
    heroKicker?.style.setProperty('--door-p', '1');
    heroKicker?.classList.remove('is-door-sync');
  }
});

// Magnetic physics on the Ritual CTA ("Prozkoumat menu")
const heroCta = document.querySelector('.hero-cta');
if (heroCta) {
  heroCta.addEventListener('pointermove', e => {
    const rect = heroCta.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.16;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.28;
    heroCta.style.setProperty('--mag-x', `${dx.toFixed(1)}px`);
    heroCta.style.setProperty('--mag-y', `${dy.toFixed(1)}px`);
  });
  heroCta.addEventListener('pointerleave', () => {
    heroCta.style.setProperty('--mag-x', '0px');
    heroCta.style.setProperty('--mag-y', '0px');
  });
}

const controls = document.querySelector('.dev-controls');
if (params.get('dev') === '0') controls.remove();
else {
  const status = controls.querySelector('[data-status]');
  const actions = { replay: () => intro.replay(), open: () => intro.open(), reset: () => intro.reset() };
  controls.addEventListener('click', e => actions[e.target.dataset.action]?.());
  controls.querySelector('[name=slow]').addEventListener('change', e => intro.setTimeScale(e.target.checked ? 0.25 : 1));
  const show = () => { status.textContent = [intro.state, intro.renderer, intro.quality].filter(Boolean).join(' · '); };
  doorEl.addEventListener('meshi-door:statechange', show);
  new MutationObserver(show).observe(doorEl, { attributeFilter: ['data-renderer', 'data-quality'] });
  show();
}
