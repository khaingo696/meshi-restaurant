/**
 * Meshi door intro: a full-screen pair of shoji panels that slide apart to
 * reveal the page underneath.
 *
 *   import { createDoorIntro } from './meshi-door/index.js';
 *   const intro = createDoorIntro(document.getElementById('meshi-door'), {
 *     assets: '/meshi-door/',                         // where meshi-door.webp / meshi-logo.webp are served
 *     interior: document.querySelector('video.hero'), // seen through the paper under the pointer
 *   });
 *
 * The door shows at once on a light Canvas 2D renderer; the 3D renderer
 * (three.js, loaded on demand) takes over with a crossfade when it is ready.
 * Without WebGL the 2D renderer stays. Once the door has opened, the GPU
 * context and textures are released.
 *
 * Events on the root: meshi-door:statechange {state}, meshi-door:open, meshi-door:opened.
 */
import { DEFAULTS, QUALITY } from './config.js';
import { clamp01, smoothstep, slideEase, momentumEase, exitEase, inverse, loadImage, webglAvailable, pickQuality } from './utils.js';
import { computeLayout } from './geometry.js';
import { cleanPaper, buildLogoPlate, grainTile } from './textures.js';
import { create2DView } from './canvas2d-view.js';
import { createSound } from './audio.js';

export { DEFAULTS, DOOR, LOGO, SUN, QUALITY } from './config.js';

const HERE = import.meta.url.slice(0, import.meta.url.lastIndexOf('/') + 1);
const TIERS = [QUALITY.high, QUALITY.medium, QUALITY.low];

export function createDoorIntro(root, options = {}) {
  const o = { ...DEFAULTS, ...options, colors: { ...DEFAULTS.colors, ...options.colors } };
  const door = o.door;
  const base = (o.assets ?? HERE + 'assets/').replace(/\/?$/, '/');
  const asset = src => [].concat(src).map(f => (/^([a-z]+:|\/)/i.test(f) ? f : base + f));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const still = o.debugTime != null || o.debugPointer != null;   // frozen frame for screenshots, no loop
  let tier = pickQuality(o.quality);
  const autoQuality = !QUALITY[o.quality];

  root.classList.add('md-root', 'is-loading');
  root.setAttribute('role', 'button');
  root.setAttribute('tabindex', '0');
  root.setAttribute('aria-label', o.label);
  root.innerHTML = '<div class="md-backdrop"></div>'
    + (o.rackFocus > 0 ? '<div class="md-focus"></div>' : '')
    + '<canvas class="md-canvas"></canvas>'
    + (o.grain ? '<div class="md-grain"></div>' : '')
    + (o.letterbox > 0 ? '<div class="md-bar md-bar-top"></div><div class="md-bar md-bar-bottom"></div>' : '')
    + (o.sound ? '<button class="md-sound" type="button" aria-label="Sound"><i></i><i></i><i></i></button>' : '')
    + (o.hint ? '<p class="md-hint" aria-hidden="true"><span lang="ja"></span><i></i><span></span></p>' : '')
    + '<div class="md-cursor" aria-hidden="true"></div>';
  if (o.hint) [root.querySelector('.md-hint [lang]').textContent, root.querySelector('.md-hint span:last-child').textContent] = o.hint;
  root.dataset.quality = tier.name;
  const backdrop = root.querySelector('.md-backdrop');
  const cursor = root.querySelector('.md-cursor');
  const grainEl = root.querySelector('.md-grain');
  const focusEl = root.querySelector('.md-focus');
  const soundBtn = root.querySelector('.md-sound');
  if (focusEl) root.style.setProperty('--md-focus', `${o.rackFocus}px`);
  if (o.letterbox > 0) root.style.setProperty('--md-letterbox', o.letterbox);
  const sound = createSound(o.sound);
  const showSound = () => soundBtn?.classList.toggle('is-muted', sound.muted);
  showSound();

  let state = 'loading';
  let t = 0, t0 = 0, raf = 0, last = 0, lastDraw = 0, running = false, timeScale = 1, replayTimer = 0;
  let view = null, geo = null, images = null, paper = null, plateCache = { key: '', plate: null };
  let glModule = null, glLoading = null, releaseTimer = 0;
  let p = 0, pVel = 0, drag = null, clock = 0, openMode = 'ease', p0 = 0;
  let ajar = false;                               // the door is still closing from the opening's crack
  const perf = { n: 0, sum: 0 };                   // frame-time sampling for the auto quality
  const pointer = { cx: 0, cy: 0, inside: false, hover: false };
  const ring = { x: -100, y: -100 };              // cursor: a point of light trailing the pointer
  const torch = { x: -500, y: -500, a: 0, r: 160 };
  const fs = { torch: {}, kage: null };           // frame state handed to the view (reused)
  // the opening shot: the sun comes up on the door, then the room, then the logo soaks in
  const intro = { r: o.intro > 0 && !still && !reduceMotion.matches ? 0 : 1, skip: false, lit: false };
  const air = { v: 0, lastP: 0 };                 // how much the moving panels stir the dust
  const kage = { x: 0, a: 0, phase: 0, t: -1, dir: 1, next: Infinity };

  // scroll: the door is heavy and every push is a shove. A push is one wheel burst (a trackpad
  // flick with its inertia), a swipe or a key press, whatever its length; pushes, not pixels,
  // move it from step to step (scrollSteps), and the push after the last step throws it open.
  const scrub = { on: false, steps: 0, target: 0, gSum: 0, counted: false, lastT: 0, lastPush: 0, returning: false };
  const scrubBy = (delta, newPush) => {
    if (state !== 'closed') return;
    if (!scrub.on) Object.assign(scrub, { on: true, steps: 0, target: p });
    if (newPush) Object.assign(scrub, { gSum: 0, counted: false });
    scrub.gSum += delta;
    if (scrub.counted || Math.abs(scrub.gSum) < 0.012) return;   // ignore jitter; one step per push
    scrub.counted = true;
    // from where the door actually is: a step still counts after the creep-back gave some of it back
    // (the opening's ajar crack is not a step: a push during it counts from closed)
    const at = ajar ? 0 : o.scrollSteps.filter(v => p >= v * (1 - o.scrollReturnAmount) - 0.01).length;
    ajar = false;
    scrub.steps = Math.max(0, at + Math.sign(scrub.gSum));
    scrub.lastPush = performance.now();
    scrub.returning = false;
    if (scrub.steps > o.scrollSteps.length) return open('momentum');
    sound.slide(0.55, 0.45 + 0.25 * scrub.steps);
    scrub.target = scrub.steps ? o.scrollSteps[scrub.steps - 1] : 0;
  };

  const setState = s => {
    state = s;
    root.dataset.state = s;
    root.dispatchEvent(new CustomEvent('meshi-door:statechange', { detail: { state: s } }));
  };
  const lockScroll = on => {
    if (!o.lockScroll) return;
    const html = document.documentElement;
    html.classList.toggle('md-lock', on);
    html.style.paddingRight = '';
    if (!on || html.scrollHeight <= innerHeight) return;
    // the page will scroll once the door is gone: hold the scrollbar's width now, so the page
    // doesn't jump sideways in the moment the scrollbar comes back
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;top:-200px;width:100px;height:100px;overflow:scroll';
    document.body.append(probe);
    const w = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    if (w) html.style.paddingRight = `${w}px`;
  };
  const total = () => (reduceMotion.matches ? o.reducedDuration : o.duration);

  // ---- renderers ----
  const wantGL = o.renderer === 'webgl' || (o.renderer === 'auto' && webglAvailable());
  const loadGL = () => (glLoading ??= import('./webgl-view.js').then(m => (glModule = m)).catch(err => {
    console.info('[meshi-door] 3D renderer unavailable, staying on Canvas 2D', err);
    return null;
  }));

  const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 400 }) : setTimeout(r, 40)));

  function createView(kind, { fade = false } = {}) {
    const canvas = document.createElement('canvas');
    let next;
    try {
      next = kind === 'webgl'
        ? glModule.createWebGLView(canvas, o, { photo: images[0], paper: (paper ??= cleanPaper(images[0], door)) })
        : create2DView(canvas, o, images[0]);
    } catch (err) {
      if (kind !== 'webgl') throw err;
      console.info('[meshi-door] WebGL failed, using Canvas 2D', err);
      return view ? false : createView('2d');
    }
    swapIn(next, canvas, { fade });
    return true;
  }

  function swapIn(next, canvas, { fade = true } = {}) {
    const old = root.querySelector('.md-canvas');
    canvas.className = 'md-canvas';
    if (next.kind === 'webgl') {
      canvas.addEventListener('webglcontextlost', e => {
        if (view !== next) return;                // our own release, not a loss
        e.preventDefault();
        createView('2d');
        layout();
        render();
      });
    }
    const prev = view;
    view = next;
    root.dataset.renderer = next.kind;
    if (fade && old) {                            // upgrade: crossfade from the 2D frame to the 3D scene
      canvas.style.opacity = '0';
      old.after(canvas);
      layout();
      render();
      requestAnimationFrame(() => requestAnimationFrame(() => { canvas.style.opacity = ''; }));
      setTimeout(() => { old.remove(); prev?.dispose(); }, 450);
    } else {
      old.replaceWith(canvas);
      prev?.dispose();
    }
  }

  // 2D -> 3D, in small steps while the browser is idle, so nothing stalls a frame for long:
  // clean washi, then the 3D logo plate, then the scene, compiled off the main thread where supported
  async function upgrade() {
    const ok = () => glModule && images && view?.kind === '2d' && state === 'closed';
    // never during the opening shot: each step below holds the main thread for a while (on a
    // phone, a second in all), which would freeze the door as it slides shut. Wait until it rests.
    const resting = () => intro.r >= 1 && !ajar && !drag && !scrub.on && Math.abs(pVel) < 1e-3;
    while (ok() && !resting()) await new Promise(r => setTimeout(r, 150));
    if (!ok()) return;
    await idle();
    if (!ok()) return;
    paper ??= cleanPaper(images[0], door);
    await idle();
    if (!ok()) return;
    const canvas = document.createElement('canvas');
    let next;
    try {
      next = glModule.createWebGLView(canvas, o, { photo: images[0], paper });
    } catch (err) {
      console.info('[meshi-door] WebGL failed, staying on Canvas 2D', err);
      return;
    }
    const geoNext = computeLayout(o, root.clientWidth || innerWidth, root.clientHeight || innerHeight);
    geoNext.plate = plateFor(next, geoNext);
    next.layout(geoNext, tier);
    await next.warm();
    await idle();
    if (!ok()) return next.dispose();
    swapIn(next, canvas);
  }

  function layout() {
    if (!view) return;
    const vw = root.clientWidth || innerWidth;
    const vh = root.clientHeight || innerHeight;
    geo = computeLayout(o, vw, vh);
    geo.plate = plateFor(view, geo);
    view.layout(geo, tier);
    torch.r = Math.min(260, Math.max(110, Math.min(vw, vh) * o.torchRadius));
  }

  // logo plate at screen resolution so the print stays crisp; rebuilt only when it changes
  function plateFor(v, g) {
    const R = Math.min(tier.plate, g.s * Math.min(devicePixelRatio, tier.dpr));
    const lp = g.logo[0];
    const key = lp ? [v.kind, lp.k.toFixed(4), R.toFixed(3)].join('|') : '';
    if (key !== plateCache.key) {
      plateCache = { key, plate: buildLogoPlate(o, v.plateSource ?? images[0], images[1], g.logo, R, tier === QUALITY.low ? 1536 : 2048) };
    }
    return plateCache.plate;
  }

  const toDoor = (cx, cy) => [door.seam + (cx - geo.vw / 2) / geo.s, door.height / 2 + (cy - geo.vh / 2 - geo.oy) / geo.s];

  // ---- simulation: pointer, torch, hover / drag / scroll springs, the opening timeline ----
  function step(dt) {
    const ease = rate => 1 - Math.exp((-rate * dt) / 1000);
    const calm = reduceMotion.matches;
    clock += dt;
    const lit = pointer.inside && (pointer.hover || drag) && state === 'closed';
    ring.x += (pointer.cx - ring.x) * ease(16);
    ring.y += (pointer.cy - ring.y) * ease(16);
    torch.x += (pointer.cx - torch.x) * ease(calm ? 60 : 9);
    torch.y += (pointer.cy - torch.y) * ease(calm ? 60 : 9);
    torch.a += ((lit && !drag?.moved ? 1 - p : 0) - torch.a) * ease(lit ? 3.5 : 6);

    if (intro.r < 1 && state !== 'loading') intro.r = Math.min(1, intro.r + dt / (intro.skip ? 280 : o.intro));
    if (!intro.lit && intro.r > 0.6) {
      intro.lit = true;
      root.classList.add('is-lit');               // letterbox and hint come in
      kage.next = clock + 4500;
    }
    // panels on the move drag the air: a quick rise, a slow settle
    const vel = Math.abs(p - air.lastP) / Math.max(dt, 1) * 1000;
    air.lastP = p;
    const stirTo = o.stir && !calm ? clamp01(vel * 0.45) : 0;
    air.v += (stirTo - air.v) * ease(stirTo > air.v ? 10 : 1.8);
    // now and then a figure walks past behind the paper (only while the door waits, undisturbed)
    if (o.kage && !calm && view?.kind === 'webgl') {
      if (kage.t < 0 && state === 'closed' && clock >= kage.next && torch.a < 0.05 && !scrub.on && !drag) {
        Object.assign(kage, { t: 0, dir: Math.random() < 0.5 ? -1 : 1 });
      }
      if (kage.t >= 0) {
        kage.t += dt;
        const u = kage.t / 9000;
        kage.x = kage.dir * (-1250 + 2500 * u);
        kage.phase = (kage.t / 1000) * 5.2;
        kage.a = smoothstep(0, 0.12, u) * (1 - smoothstep(0.86, 1, u)) * (1 - smoothstep(0, 0.2, p));
        if (u >= 1) Object.assign(kage, { t: -1, a: 0, next: clock + 30000 });
      }
    }

    if (state === 'opening') {
      if (openMode === 'momentum' && !calm) {
        // loose: the panels run on their own curve; the timeline clock keeps the fade in step
        const span = Math.max(o.slideDuration - t0, 1);
        t += dt * timeScale * (t < o.slideDuration ? span / o.momentum : 1);
        p = p0 + (1 - p0) * momentumEase(clamp01((t - t0) / span));
      } else {
        t += dt * timeScale;
        if (!calm) p = slideEase(clamp01(t / o.slideDuration));
      }
      if (t >= total()) finish();
    } else if (state === 'closed') {
      const s = dt / 1000;
      if (drag?.moved) {                          // the panels are heavy: they follow the hand with a lag
        p += (drag.p - p) * ease(12);
        pVel = 0;
      } else if (scrub.on) {                      // shoved to the next step: gets going, slides, comes to rest
        const peaked = Math.abs(scrub.target - p) < 0.012 && pVel < 0.05;
        if (!scrub.returning && o.scrollReturn > 0 && scrub.target > 0 && peaked && performance.now() - scrub.lastPush > 150 + o.scrollReturnDelay) {
          scrub.returning = true;                 // left alone: it creeps back a little, then friction holds it
          scrub.target *= 1 - o.scrollReturnAmount;
        }
        const w = scrub.returning ? o.scrollReturn : o.scrollSettle;
        pVel += (w * w * (scrub.target - p) - 2 * w * pVel) * s;
        p = Math.max(0, p + pVel * s);
        if (scrub.steps === 0 && Math.abs(p - scrub.target) < 0.002) scrub.on = false;
      } else {                                    // critically damped spring to rest / the hover crack
        const closing = intro.r < 1 && !intro.skip;   // the opening: the door, left ajar, slides gently shut
        const target = pointer.hover && pointer.inside && !calm ? o.hoverOpen : 0, w = closing ? 3.2 : 7;
        pVel += (w * w * (target - p) - 2 * w * pVel) * s;
        p = Math.max(0, p + pVel * s);
        if (ajar && p < 0.003) ajar = false;
      }
    }
  }

  function render() {
    if (!view || !geo) return;
    const calm = reduceMotion.matches;
    let exit = 0;
    if (state === 'opening') exit = calm ? clamp01(t / o.reducedDuration) : exitEase(clamp01((t - o.exitStart) / (o.duration - o.exitStart)));
    const [tx, ty] = toDoor(torch.x, torch.y);
    fs.p = p;
    fs.time = clock;
    fs.calm = calm;
    fs.interior = smoothstep(0, 0.3, p);
    fs.bloom = 0.15 * smoothstep(0.04, 0.4, p) * (1 - smoothstep(0.7, 1, p));   // warmth through the gap, gone before the page shows
    fs.gapLight = o.gapLight * smoothstep(0.004, 0.06, p) * (1 - smoothstep(0.4, 0.85, p));
    // the light breathes: a slow, uneven swell, like air moving in a lit room; on the way out it
    // goes a beat before the door, so nothing lingers over the page
    const lightOut = state === 'opening' && !calm ? smoothstep(o.exitStart - 350, o.exitStart + 300, t) : 0;
    fs.beam = (1 + (calm ? 0 : 0.07 * Math.sin(clock / 1400) + 0.04 * Math.sin(clock / 610 + 1.7))) * (1 - lightOut);
    Object.assign(fs.torch, { x: tx, y: ty, r: torch.r / geo.s, a: torch.a });
    const r = intro.r;
    const dim = o.introDim;                       // the opening starts in half light, never black
    fs.sunUp = dim + (1 - dim) * smoothstep(0, 0.7, r);
    fs.roomUp = dim + (1 - dim) * smoothstep(0.1, 1, r);
    fs.dustUp = smoothstep(0.2, 1, r);
    fs.ink = o.inkSpread ? smoothstep(0.42, 1, r) : 1;
    fs.stir = air.v;
    fs.kage = kage;
    view.draw(fs);
    // the dark interior hides the page only in the hover crack; a real opening shows the room behind
    const gapDark = 1 - smoothstep(0.012, 0.08, p);
    backdrop.style.opacity = (state === 'opening' ? Math.min(gapDark, 1 - smoothstep(0, 280, t - t0)) : gapDark).toFixed(3);
    root.style.opacity = exit ? (1 - exit).toFixed(3) : '';
    // rack focus: the room behind is soft through the first crack, pulled sharp as the door opens
    if (focusEl) focusEl.style.opacity = (smoothstep(0.012, 0.06, p) * (1 - smoothstep(0.25, 0.9, p))).toFixed(3);
    cursor.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
    root.classList.toggle('has-cursor', pointer.hover && pointer.inside && state === 'closed');
  }

  // auto quality: if frames keep running long while the door waits, step down a tier
  function watchPerf(dt) {
    if (!autoQuality || state !== 'closed' || document.hidden || view?.kind !== 'webgl') return;
    if (++perf.n <= 30) return;                    // let it warm up
    perf.sum += dt;
    if (perf.n < 120) return;
    const avg = perf.sum / (perf.n - 30);
    perf.n = perf.sum = 0;
    const i = TIERS.indexOf(tier);
    if (avg > 24 && i < TIERS.length - 1) {
      tier = TIERS[i + 1];
      root.dataset.quality = tier.name;
      layout();
    }
  }

  function loop(now) {
    const dt = Math.min(64, now - last);          // clamp jumps after a background tab
    last = now;
    step(dt);
    // waiting quietly on a modest device: ambient light and dust at a lower frame rate
    const idle = state === 'closed' && !drag && !scrub.on && torch.a < 0.01 && Math.abs(pVel) < 1e-4;
    if (!idle || tier.idleFps >= 60 || now - lastDraw >= 1000 / tier.idleFps - 2) {
      render();
      watchPerf(now - lastDraw);
      lastDraw = now;
    }
    if (state === 'open' || !running) { running = false; return; }
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || still || document.hidden) return;
    running = true;
    last = lastDraw = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(raf);
    running = false;
  }

  function finish() {
    stop();
    t = total();
    root.hidden = true;
    lockScroll(false);
    setState('open');
    root.dispatchEvent(new CustomEvent('meshi-door:opened'));
    // the door is gone: hand back the GPU context and the big buffers once the page has settled
    // (dropping a WebGL context stalls a few frames; never in the moment the page appears)
    releaseTimer = setTimeout(() => idle().then(() => {
      if (state !== 'open') return;               // replayed meanwhile
      view?.dispose();
      view = null;
      delete root.dataset.renderer;
      paper = null;
      plateCache = { key: '', plate: null };
    }), 1000);
  }

  // open from wherever the panels are (rest, hover, a drag or a scroll that broke them loose)
  function open(mode = 'ease') {
    if (state !== 'closed') return;
    openMode = mode;
    p0 = p;
    drag = null;
    scrub.on = false;
    root.classList.remove('is-dragging');
    t = t0 = reduceMotion.matches ? 0 : inverse(slideEase, clamp01(p)) * o.slideDuration;
    intro.skip = true;
    if (!reduceMotion.matches) {
      const run = mode === 'momentum' ? o.momentum / 1000 : (o.slideDuration - t0) / 1000;
      sound.slide(run * 0.85, mode === 'momentum' ? 1 : 0.8);
      sound.knock(mode === 'momentum' ? 0.9 : 0.6, run * (mode === 'momentum' ? 0.62 : 0.78));
      sound.room(2.8);
    }
    setState('opening');
    root.dispatchEvent(new CustomEvent('meshi-door:open'));
    start();
  }

  function reset() {
    if (!images) return;                          // still loading, or the door could not load
    stop();
    clearTimeout(replayTimer);
    clearTimeout(releaseTimer);
    t = t0 = 0;
    p = pVel = 0;
    drag = null;
    scrub.on = false;
    Object.assign(intro, { r: o.intro > 0 && !reduceMotion.matches ? 0 : 1, skip: false, lit: false });
    Object.assign(kage, { t: -1, a: 0, next: Infinity });
    root.classList.remove('is-lit');
    if (intro.r < 1) { p = o.introCrack; ajar = true; }
    root.hidden = false;
    lockScroll(true);
    setState('closed');
    if (!view) createView(glModule ? 'webgl' : '2d');
    layout();
    render();
    start();
  }

  function replay(delay = 350) {
    if (!images) return;
    reset();
    replayTimer = setTimeout(open, delay);
  }

  // ---- input: pointer (hover, torch, drag, swipe), wheel and keyboard ----
  const onMove = e => {
    if (!geo) return;
    pointer.inside = true;
    pointer.hover = e.pointerType === 'mouse';
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.axis === 'y') {                      // a vertical swipe reads as scrolling
      const ly = drag.ly;
      drag.ly = e.clientY;
      scrubBy((ly - e.clientY) / geo.vh);         // may break the door loose (and end the drag)
      return;
    }
    if (!drag.moved && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      if (reduceMotion.matches) { drag = null; return dy < 0 ? open() : undefined; }
      drag.axis = 'y';
      drag.ly = e.clientY;
      scrubBy(0, true);                           // a new push
      return;
    }
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      root.classList.add('is-dragging');
    }
    if (!drag.moved) return;
    const now = performance.now();
    drag.p = clamp01(drag.p0 + (1 - Math.exp(-Math.abs(dx) / (geo.vw * 0.42))) * 1.1);   // resists more as it goes
    drag.v = Math.abs(e.clientX - drag.lx) / Math.max(1, now - drag.lt);
    drag.lx = e.clientX;
    drag.lt = now;
  };
  const onDown = e => {
    intro.skip = true;
    sound.unlock();
    if (state !== 'closed' || e.button > 0) return;
    onMove(e);
    drag = { x0: e.clientX, y0: e.clientY, p0: p, p, lx: e.clientX, lt: performance.now(), v: 0, moved: false };
    root.setPointerCapture?.(e.pointerId);
  };
  const onUp = e => {
    if (e.pointerType !== 'mouse') pointer.inside = false;
    if (!drag) return;
    const d = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (d.axis === 'y') return;                   // a swipe is a push; the scrub takes it from here
    if (!d.moved) return open();                  // a tap / click
    if (d.p > o.dragOpen || d.v > 0.6) open();    // past the threshold or flicked
  };
  const onCancel = () => {
    drag = null;
    root.classList.remove('is-dragging');
  };
  const onLeave = () => { pointer.inside = false; };
  const onKey = e => {
    intro.skip = true;
    sound.unlock();
    if (['Enter', ' ', 'PageDown', 'End'].includes(e.key)) { e.preventDefault(); open(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); reduceMotion.matches ? open() : scrubBy(1, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); scrubBy(-1, true); }
  };
  const onWheel = e => {                          // the page stays locked: scrolling pushes the door instead
    intro.skip = true;
    if (state !== 'closed' || !geo) return;
    if (reduceMotion.matches) { if (e.deltaY > 0) open(); return; }
    const px = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? geo.vh : 1);
    const now = performance.now(), newPush = now - scrub.lastT > 220;
    scrub.lastT = now;
    scrubBy(px / geo.vh, newPush);
  };
  let resizeRaf = 0;
  const onResize = () => {                        // once per frame at most (rotation fires several)
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { layout(); render(); });
  };
  const onVisibility = () => {                    // nothing to draw in a background tab
    if (document.hidden) stop();
    else if (state === 'closed' || state === 'opening') start();
  };
  const listeners = [
    [root, 'pointermove', onMove], [root, 'pointerdown', onDown], [root, 'pointerup', onUp],
    [root, 'pointercancel', onCancel], [root, 'pointerleave', onLeave], [root, 'keydown', onKey],
    [window, 'wheel', onWheel, { passive: true }], [window, 'resize', onResize], [document, 'visibilitychange', onVisibility],
  ];
  for (const [target, type, fn, opts] of listeners) target.addEventListener(type, fn, opts);
  soundBtn?.addEventListener('pointerdown', e => e.stopPropagation());
  soundBtn?.addEventListener('keydown', e => e.stopPropagation());
  soundBtn?.addEventListener('click', e => {
    e.stopPropagation();
    sound.setMuted(!sound.muted);
    showSound();
  });

  // ---- boot: the door on Canvas 2D at once, 3D when three.js has arrived ----
  lockScroll(true);
  setState('loading');
  if (wantGL) loadGL();
  Promise.all([
    loadImage(asset(door.src)),
    o.logo ? loadImage(asset(o.logo.src)).catch(() => null) : null,
  ]).then(async imgs => {
    images = imgs;
    if (still && wantGL) await loadGL();          // screenshots: wait for the final renderer
    if (!(glModule && createView('webgl'))) createView('2d');
    if (view.kind === 'webgl') { layout(); await view.warm(); }
    if (grainEl && !grainEl.style.backgroundImage) grainEl.style.backgroundImage = `url(${grainTile()})`;
    lockScroll(true);                             // again, now that the page under the door has laid out
    setState('closed');
    layout();
    if (o.debugPointer) {
      Object.assign(pointer, { inside: true, hover: true });
      [pointer.cx, pointer.cy] = [(o.debugPointer.x + 1) / 2 * geo.vw, (o.debugPointer.y + 1) / 2 * geo.vh];
      Object.assign(ring, { x: pointer.cx, y: pointer.cy });
      Object.assign(torch, { x: pointer.cx, y: pointer.cy, a: 1 });
    }
    if (o.debugTime > 0) {
      setState('opening');
      t = o.debugTime;
      p = slideEase(clamp01(t / o.slideDuration));
      if (t >= total()) finish();
    }
    render();
    root.classList.remove('is-loading');
    if (still) root.classList.add('is-static');
    if (intro.r >= 1) { intro.lit = true; root.classList.add('is-lit'); kage.next = clock + 4500; }
    else if (state === 'closed') { p = o.introCrack; pVel = 0; ajar = true; }
    if (state !== 'closed') return;
    root.focus({ preventScroll: true });
    start();
    if (o.autoOpen !== false) replayTimer = setTimeout(open, o.autoOpen);
    if (wantGL && view.kind !== 'webgl') loadGL().then(upgrade);
  }).catch(err => {                               // never block the site if the door can't load
    console.warn('[meshi-door]', err);
    view = null;
    finish();
  });

  return {
    open, reset, replay,
    setTimeScale(v) { timeScale = v; },
    get state() { return state; },
    get progress() { return p; },                 // 0 closed .. 1 open
    get renderer() { return root.dataset.renderer ?? null; },
    get quality() { return tier.name; },
    destroy() {
      stop();
      clearTimeout(replayTimer);
      clearTimeout(releaseTimer);
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      lockScroll(false);
      sound.dispose();
      view?.dispose();
      view = null;
      root.replaceChildren();
    },
  };
}
