# Integrating the Meshi door intro into the Astro site

This folder is a self-contained, finished module. Integrate it as-is: **don't redesign, rewrite or "simplify" it**. Every visual and motion value was tuned with the client. Only the wiring described below needs to be done.

## What it is

A full-screen overlay shown when the home page loads. It is a 3D shoji door (three.js), with these effects:

- late-sun light and dust;
- warm light leaking through the gap;
- the logo printed on the paper;
- a "torch" under the pointer that shows the hero video softly through the paper.

The door opens in three ways:

- **Scroll, swipe, or ↓ in three pushes.** Push 1 opens it ~6.5%, push 2 ~22%, and push 3 throws it open.
- **Click, Enter or Space** opens it in ~1.45 s.
- **Horizontal drag** pulls the panels open.

It then fades out, reveals the page, and releases all GPU resources. Until then the page is scroll-locked.

On load, a short opening (~1.4 s, skipped by any input): the page appears in half light with the door left ajar, warm light in the crack; the door slides gently shut while the room comes up to full light.

When it opens, the sliding panels stir the dust in the sunlight, and the room behind is soft through the first crack, then pulls into focus. The sun patch stays where the window puts it while the panels slide out from under it; the light that gets through the gap lands softly on the room's floor, further in and to the right. The light fades a beat before the door, and the door fades while its panels are still moving, so nothing crawls to a stop on screen.

The door sits slightly low in the frame, so the sill and floor below it are off screen (`cropSill`).

Optional extras exist but are **off by default**, because the client rejected them: a dark opening shot with the logo soaking in, cinema bars, a figure behind the paper and procedural sound. Keep them off unless asked.

## Files

| File | Role |
|---|---|
| `MeshiDoor.astro` | Drop-in component. **Use this.** |
| `index.js` | `createDoorIntro(root, options)`: the entry point the component calls |
| `config.js` | All tunable values (`DEFAULTS`, `DOOR`, `LOGO`, `SUN`, `QUALITY`) |
| `geometry.js`, `textures.js`, `shaders.js` | Internals |
| `canvas2d-view.js` | Instant 2D renderer and the no-WebGL fallback |
| `webgl-view.js` | 3D renderer. Imports `three`; loaded with a dynamic `import()`, so it becomes its own chunk |
| `audio.js` | Procedural sound (Web Audio) |
| `door-intro.css` | All styles, scoped under `.md-root`; it also adds `.md-lock` to `<html>` while the door is shown. Outside the component, give the root `class="md-root is-loading"` and `<html>` `class="md-lock"` in the markup, or the page shows before the door covers it |
| `assets/` | `meshi-door.webp` (+ `.png` fallback), `meshi-logo.webp` (+ `.png` fallback) |

## Steps

1. Install three.js. The module was built against 0.160; any 0.160+ works.

   ```bash
   npm i three
   ```

2. Copy this folder, **without `assets/`**, to `src/components/meshi-door/`.

3. Copy `assets/*` to `public/meshi-door/`, so the files are served at `/meshi-door/meshi-door.webp` and so on.

   This step is required. After bundling, the module can't find images next to itself. The component passes `assets="/meshi-door/"` by default.

4. Make the hero background video selectable. The live hero has `<video autoplay muted loop playsinline poster="/assets/hero-poster.webp">`. Give it a class, for example `class="hero-bg"`.

   The video must be served from the same origin, which it is today (`/assets/background_video.mp4`). Otherwise the browser blocks reading its pixels, and the torch falls back to plain warm light.

5. Render the component on the **home page only**, as the first element inside `<body>` (or the home layout's top):

   ```astro
   ---
   import MeshiDoor from '../components/meshi-door/MeshiDoor.astro';
   ---
   <MeshiDoor interior="video.hero-bg" once="session" />
   ```

   | Prop | Meaning |
   |---|---|
   | `interior` | CSS selector of the element seen through the paper (the hero video) |
   | `once="session"` | Show the door once per browser session. Omit it to show it on every visit. |
   | `assets` | Image base URL. Default `/meshi-door/`. |
   | `hint` | Optional two-line text under the door, e.g. `["いらっしゃいませ", "Slide or scroll to enter"]`. The site already loads EB Garamond and Shippori Mincho. |

6. Check the stacking order. The overlay is `position: fixed; z-index: 1000`. If the site header or any fixed element uses a higher `z-index`, lower it, or raise `.md-root` in `door-intro.css`, so the door covers everything.

## Things not to do

- **Don't edit `DOOR` / `LOGO` in `config.js`.** They are pixel measurements of the bundled images. Change them only if the images are replaced.
- **Don't import three.js statically elsewhere just for this.** The door loads it lazily on purpose, so first paint isn't blocked.
- **Don't keep the element around after it opens.** The component already calls `destroy()` and removes it on `meshi-door:opened`.
- **Don't render it inside a component re-mounted by view transitions.** If the site uses Astro's `<ClientRouter />` / view transitions, render the door only on a full load of the home page. For example, guard the script so it runs once, or don't add the component to persisted layouts.
- **Don't remove `touch-action: none` or the scroll lock.** Scroll and swipe are how the door is opened.

## Tuning (optional)

Pass overrides through `createDoorIntro(el, { ... })`, or change `DEFAULTS` in `config.js`. The defaults are the values signed off with the client; change one at a time and check it against the notes below.

### Opening timeline (click / Enter / Space / drag release)

All in ms from the moment the door starts to open.

| Option | Default | Effect |
|---|---|---|
| `slideDuration` | `1400` | How long the panels take to slide off screen |
| `exitStart` | `900` | When the door starts fading into the page. The light (sun patch, shaft, dust) starts fading ~350 ms before this and is gone ~300 ms after it. |
| `duration` | `1450` | Total length; the door is gone and the page unlocked at this point |
| `momentum` | `1100` | Duration of the final slide when a scroll / swipe throws the door open (the fade keeps in step) |
| `reducedDuration` | `400` | `prefers-reduced-motion`: length of the plain fade |

Keep these in proportion, or the exit looks stuck:

- **`duration` only a little above `slideDuration`** (≤ ~100 ms). The panels slow down at the end of their slide; if the door is still visible then, they crawl to a stop on screen.
- **`exitStart` around 60–70% of `slideDuration`**, so the door fades while the panels are still moving. Later feels like it hangs; much earlier and the panels are gone before they are seen to move.
- To make the whole opening faster or slower, scale all three together (e.g. ×1.2 → `1680 / 1080 / 1740`).

### Light

| Option | Default | Effect |
|---|---|---|
| `sun`, `beam`, `dust`, `gapLight` | `2.6`, `0.15`, `0.6`, `1` | Light strengths: the sun patch on the door, the shaft in the air, the dust in it, the warm light through the crack |
| `roomSun` | `1` | The sun that gets through the gap as it opens, a soft patch on the room's floor. Relative: `0.5` = half, `0` = off. Kept deliberately faint; the client found it too strong above ~`1`. |
| `peek`, `peekWarm` | `0.9`, `0.2` | Strength and warmth of the see-through torch |

### Framing

| Option | Default | Effect |
|---|---|---|
| `cropSill` | `true` | Sit the door lower so the sill and floor below it are off screen. Uses the spare image above the door, no extra zoom, and a lens shift so the perspective is unchanged. `false` = centred, with the sill and floor visible. When the door is open, a thin strip of the threshold inside the doorway still shows. |

### Interaction and the rest

| Option | Default | Effect |
|---|---|---|
| `scrollSteps` | `[0.065, 0.22]` | Door position after push 1 and push 2. Push 3 opens it. |
| `scrollReturn` / `scrollReturnAmount` | `0.9` / `0.35` | How fast / how much it creeps back when left alone |
| `quality` | `'auto'` | Force `'high'`, `'medium'` or `'low'` |
| `hint` | `null` | Text under the door |
| `intro` | `1400` | Opening length in ms: the door, left ajar, slides shut as the light comes up (0 = none) |
| `introCrack`, `introDim` | `0.05`, `0.55` | How far it starts ajar, and how much light is already there |
| `stir` | `true` | Dust stirred by the sliding panels |
| `kage` | `false` | Figure passing behind the paper (off) |
| `rackFocus` | `8` | px of blur on the room through the first crack (0 = off) |
| `letterbox` | `0` | Cinema bars (off) |
| `sound` | `false` | Procedural sound and its toggle (off) |

Not options, but worth knowing before changing anything nearby:

- **No flash on load.** The component renders the root with `class="md-root is-loading"` and imports `door-intro.css` in its frontmatter, and an inline script locks `<html>` before the first paint. Keep all three, or the page shows for a moment before the door covers it.
- **GPU release.** The WebGL context is dropped ~1 s after the door has gone, when the browser is idle. Dropping a context stalls the page for a few frames (~65 ms measured), so it must not happen in the moment the page appears.
- **Scrollbar.** While the page is locked, `<html>` gets `padding-right` equal to the scrollbar width, so the page doesn't shift sideways when the scrollbar comes back. Fixed elements still lose that width when it returns.

## API (if not using the component)

```js
import { createDoorIntro } from './meshi-door/index.js';
import './meshi-door/door-intro.css';
const intro = createDoorIntro(document.getElementById('meshi-door'), { assets: '/meshi-door/', interior: videoEl });
// intro.open(), intro.reset(), intro.replay(), intro.destroy()
// intro.state ('loading' | 'closed' | 'opening' | 'open'), intro.progress (0..1), intro.renderer, intro.quality
// events on the root element: meshi-door:statechange, meshi-door:open, meshi-door:opened
```

## Verify after integrating

1. **Desktop, home page.**
   - Hard reload: the page never shows before the door (a dark screen, then the door fades in).
   - A Canvas 2D frame comes first, then a crossfade to 3D.
   - Hovering shows a warm torch with the video through the paper.
   - Three wheel notches: ~6.5% open, then ~22%, then the door slides open and the page appears.
2. **Click, and Enter**, each open the door.
3. **Mobile (real device).** Vertical swipes push the door in steps. The motion is smooth. Nothing behind the overlay scrolls.
4. **After it opens:**
   - the exit is one smooth movement: no stop before the fade, no hitch or sideways jump as the page appears (Windows, with a visible scrollbar);
   - the page scrolls normally;
   - `#meshi-door` is gone from the DOM;
   - with `once="session"`, a reload doesn't show the door again in the same tab session.
5. **`prefers-reduced-motion`.** Any input opens the door with a short fade.
6. **Console.** No errors. In the network panel, three.js arrives as its own lazily loaded chunk.

---

## Part 2: Integrating the Avant-Garde Hero Section & Door-Sync Architecture

The prototype in the root workspace (`index.html`, `style.css`, `main.js`) pairs `meshi-door` with a deconstructed, choreographed Hero Section designed specifically to continue the physical motion of the sliding Shoji door.

### Architectural Highlights of the Redesigned Hero

1. **Pure Depth-of-Field Kicker (`TASTE    Feel    CONNECT` — Zero Decorative Lines):**
   - **Door Threshold Split:** Driven by `intro.progress` (`--door-p: 0 -> 1`). As the Shoji panels part at the center seam, the three words emerge from the threshold gap and glide diagonally down into their resting positions.
   - **Cinema Lens Rack-Focus (Zero Lines):** Instead of cluttering the stage with connector lines or underlines, the three words are separated purely by negative space (*Ma*). At any moment, the active word pulls into razor-sharp luminous focus (`filter: blur(0px)`), while the other two soften into a shallow depth-of-field (`filter: blur(0.65px); opacity: 0.34`). This ensures the porcelain dish & chopsticks beneath `"Plate"` remain the **only** line-art on the stage.

2. **Deconstructed Omakase Headline & Cross-Element Chopstick Sympathy:**
   - **Spatial Offset & Scale Contrast:** Line 1 (`"A Taste of Home."`) acts as a clean, poised prelude (`clamp(28px, 4.1vw, 52px)`); Line 2 (`"On Your Plate"`) steps diagonally right (`margin-left: clamp(28px, 6.8vw, 108px)`) at dramatic scale (`clamp(46px, 7.6vw, 98px)`).
   - **Porcelain Dish, Exclusive Rising Steam & Reactive Chopsticks:** Anchored beneath `"Plate"`. When the user hovers either `"Plate"` or the `"Prozkoumat menu"` CTA below, CSS `:has(.hero-cta:hover)` awakens the chopsticks (`.hashi-upper` and `.hashi-lower` uncross slightly as if preparing to pick up the first piece of Omakase) while the steam wisps intensify.

3. **Luxury Smoked-Glass CTA Button (`Prozkoumat menu`):**
   - A solid, tactile fine-dining button (`border-radius: 4px`, smoked-glass `backdrop-filter: blur(12px)`, warm gold border, inner diamond accent `.hero-cta-gem`) with magnetic cursor physics (`--mag-x`, `--mag-y`). It guarantees 100% legibility and instant click affordance over bright moving video backgrounds without adding stray lines.

4. **Michelin Editorial Colophon & Star Constellation (`.hero-meta`):**
   - **Sculptural Score (`4.9 /5`) + 5-Point Golden Constellation SVG:** Replaces standard Unicode `★★★★★` stars with an animated constellation arc where a luminous pulse traces across 5 star nodes. Hovering rolls the label vertically from `GOOGLE REVIEWS` to `PLZEŇ · MAPA ↗`.
   - **Warm Lantern Ember (`.lantern-ember`):** Replaces the generic green chat dot with a rotating diamond amber core and breathing halo ring (`#f5c97b`).

---

### How to Port the Hero Section into the Main Astro App

1. **Fonts (`<head>`):**
   Ensure `Cormorant Garamond` (300, 400, regular & italic) and `Plus Jakarta Sans` (300, 400, 500) are loaded:
   ```html
   <link
     rel="stylesheet"
     href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap"
   />
   ```

2. **Hero Markup (`index.html`):**
   Copy `<section class="hero" data-active-word="0">...</section>` from `index.html` into your Astro Hero component (omit `<aside class="dev-controls">` in production).

3. **Hero Styles (`style.css`):**
   Copy the Hero CSS blocks from `style.css` (CSS variables, `.hero`, `.hero-kicker`, `.hero-title`, `.hero-cta-wrap`, `.hero-meta`, and the `@media` queries).

4. **Client Script Wiring (Door Sync + Ambient Cycle + Magnetic CTA):**
   `MeshiDoor.astro` exposes `window.meshiDoor = intro`. In your Hero component's `<script>`, wire up the interactive cycle, door progress sync, and magnetic CTA:

   ```js
   const doorEl = document.getElementById('meshi-door');
   const heroEl = document.querySelector('.hero');
   const heroKicker = document.querySelector('.hero-kicker');
   const kickerNodes = heroKicker ? [...heroKicker.querySelectorAll('.kicker-node')] : [];

   // 1. Ambient 3-word cycle + Interactive hover/focus spotlight
   let activeWord = 0;
   let isHovered = false;

   const setActiveWord = idx => {
     activeWord = Number(idx);
     if (heroEl) heroEl.dataset.activeWord = String(activeWord);
   };

   if (heroEl && heroKicker && kickerNodes.length) {
     setInterval(() => {
       if (!isHovered) setActiveWord((activeWord + 1) % 3);
     }, 3200);

     kickerNodes.forEach(node => {
       const idx = Number(node.dataset.word);
       const activate = () => {
         isHovered = true;
         heroEl.classList.add('is-word-hovered');
         setActiveWord(idx);
       };
       node.addEventListener('pointerenter', activate);
       node.addEventListener('focus', activate);
       node.addEventListener('click', () => setActiveWord(idx));
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

   // 2. Sync "Taste · Feel · Connect" threshold glide with Shoji door progress (0 -> 1)
   let doorSyncRaf = 0;
   const syncKickerWithDoor = () => {
     const intro = window.meshiDoor;
     if (!heroKicker || !intro) return;
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

   if (doorEl) {
     doorEl.addEventListener('meshi-door:statechange', () => {
       cancelAnimationFrame(doorSyncRaf);
       const intro = window.meshiDoor;
       if (!intro) return;
       if (intro.state === 'opening') {
         syncKickerWithDoor();
       } else {
         heroKicker?.style.setProperty('--door-p', '1');
         heroKicker?.classList.remove('is-door-sync');
       }
     });
   }

   // 3. Magnetic pull on the Ritual CTA ("Prozkoumat menu")
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
   ```

