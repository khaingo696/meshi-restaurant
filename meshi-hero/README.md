# Meshi door intro

A full-screen intro: two shoji panels slide apart to reveal the page underneath. It has:

- a real 3D door built from the photo, with late sun through a high window, a hazy shaft and dust;
- warm room light leaking through the gap;
- the logo printed on the washi;
- a torch under the pointer that lets the room behind glow through the paper.

The door is heavy: scrolling shoves it open in steps.

The door itself lives in [`meshi-door/`](meshi-door/), a self-contained module ready for Astro. The rest of this folder is a demo page for trying it out.

## Run the demo

Requirements: Node.js 18 or later. The demo loads three.js and the hero video from the internet.

```bash
node server.mjs          # http://localhost:5173
```

| URL parameter | Effect |
|---|---|
| `?renderer=2d` | Force the Canvas 2D renderer (default `auto`) |
| `?quality=low` | Force a quality tier: `high`, `medium` or `low` (default `auto`) |
| `?t=900` | Freeze the opening at 900 ms (screenshots) |
| `?pointer=0.3,0.1` | Freeze the pointer at that position, -1..1 (screenshots) |
| `?autoplay=500` | Open by itself 500 ms after load |
| `?dev=0` | Hide the dev panel (Replay / Open / Reset, Slow ×4, state · renderer · quality) |

## Module layout

```
meshi-door/
  index.js           createDoorIntro(): input, timeline, renderer switching (entry point)
  config.js          DOOR, LOGO, SUN, QUALITY tiers, DEFAULTS: every tunable value
  geometry.js        framing, logo layout, sun patch and shaft geometry
  textures.js        clean washi, printed logo plate, film grain
  canvas2d-view.js   Canvas 2D renderer (instant first frame; no-WebGL fallback)
  webgl-view.js      3D renderer (three.js, loaded on demand)
  shaders.js         GLSL: shaft, dust, gap light, washi (torch, figure, ink), room light
  audio.js           procedural sound: rail, knock, room air (Web Audio)
  door-intro.css     styles, all scoped under .md-root
  MeshiDoor.astro    drop-in Astro component
  assets/            meshi-door.webp (174 KB) + .png fallback, meshi-logo.webp + .png
```

## Astro

1. `npm i three`
2. Copy `meshi-door/` to `src/components/meshi-door/`. Copy its `assets/` to `public/meshi-door/`.
3. In the page, as the first element of `<body>`:

   ```astro
   ---
   import MeshiDoor from '../components/meshi-door/MeshiDoor.astro';
   ---
   <MeshiDoor interior="video.hero-bg" once="session" />
   ```

   - `interior` is a selector for the hero's background `<video>`. Under the pointer, it glows through the paper. The video must be same-origin, or served with CORS.
   - `once="session"` shows the door once per browser session. Leave it out to show it every time.
   - `assets` defaults to `/meshi-door/`.
   - `hint` takes two lines of text shown under the door.

Without the component:

```js
import { createDoorIntro } from './meshi-door/index.js';
import './meshi-door/door-intro.css';
const intro = createDoorIntro(document.getElementById('meshi-door'), { assets: '/meshi-door/', interior: videoEl });
```

The API is `open()`, `reset()`, `replay()`, `destroy()`, plus `state`, `progress` (0..1), `renderer` and `quality`. The root element fires the events `meshi-door:statechange`, `meshi-door:open` and `meshi-door:opened`.

## Interaction

- **Scroll, swipe vertically, or press ↓ / ↑.** Every push is a shove on a heavy door. A push is one wheel burst, one trackpad flick with its inertia, one swipe or one key press, whatever its length.
  - Push 1 moves the door to about 6.5% open, push 2 to about 22% (`scrollSteps`). Each time it gets going, slides, and comes to rest (`scrollSettle`).
  - Left alone, it creeps back a little, about 35% of its opening (`scrollReturn`, `scrollReturnAmount`).
  - Push 3 throws it open: a short build-up, a fast run, and friction easing it into the wall pocket (`momentum`).
  - Pushing back closes it a step.
- **Click, tap, Enter, Space, PageDown or End** opens the door in 1.8 s.
- **Drag sideways** to pull the panels. Release past 28% (`dragOpen`), or flick, to open.
- **Pointer.** A torch: under it, the room behind glows through the washi as light and shadow, warmed toward the sun (`peek`, `peekWarm`, `torchRadius`). With a mouse, the panels part a crack on hover.
- **The camera never moves.** The page stays locked until the door has opened.
- **`prefers-reduced-motion`.** Every input opens the door with a 0.4 s fade.

## Cinema

On by default:
- `intro` (1.4 s, skipped by any input): the page appears in half light with the door left ajar and warm light in the crack; it slides gently shut as the room comes up to full light (`introCrack`, `introDim`).
- `stir`: the sliding panels stir the dust in the sunlight.
- `rackFocus`: the room is soft through the first crack, then pulls into focus.

Off by default (tried and rejected):
- `inkSpread`: a dark opening shot with the logo soaking in;
- `letterbox`: cinema bars;
- `kage`: a figure behind the paper;
- `sound`: procedural sound.

## Light

- **Sun.** A far spotlight projects the window panes as a patch on the door, and the kumiko cast real shadows inside it (`sun`).
- **Shaft.** The same sunlight in the air: one hazy volume continuing the patch's edges toward the window, with drifting smoke (`beam`, `beamShade`) and dust glinting in it (`dust`).
- **Gap light.** Warm room light through the gap as the door parts, peaking while it is barely open (`gapLight`).
- **Exposure.** Slightly low-key overall, so the sun reads (`exposure`).

## Performance

- **Instant door, lazy 3D.** The door shows on the light Canvas 2D renderer as soon as its 174 KB image decodes.
  - three.js (about 170 KB gzipped) loads in parallel. The 3D scene is then prepared in small idle-time steps: clean washi, logo plate, scene, and shaders compiled with `compileAsync` where supported. Only then does it crossfade in.
  - If three.js is cached, the door starts directly in 3D.
- **Quality tiers.** `high` / `medium` / `low` set the pixel ratio (2 / 1.5 / 1), shadow-map sizes, soft or hard shadows, logo-plate resolution and dust count.
  - `auto` starts phones and modest devices on `medium`.
  - It steps down if frames average over 24 ms while the door waits.
  - On `low`, the idle scene renders at 30 fps.
- **Rendering on demand.**
  - Shadow maps are redrawn only when the panels move. The camera is fixed, so all screen-space geometry is computed once per layout.
  - Room-light meshes are skipped while the door is shut.
  - The loop pauses in background tabs.
- **Clean exit.** When the door has opened, the WebGL context, textures and buffers are released. In Astro, the component also removes the element.
- **2D fallback.** The sunlight and shaft are blurred once per layout into a half-resolution layer, not per frame. Film grain is off on touch devices.

Measured on the demo, in headless Chrome with software WebGL, phone viewport, 4× CPU slowdown:
- the door shows at about 0.5 s and turns 3D at about 1.3 s;
- idle and opening hold 60 fps;
- long tasks happen only while loading.

Real-device numbers depend on the GPU. Check them on a mid-range Android phone and an iPhone before launch.

## Tuning

Every value is in [`meshi-door/config.js`](meshi-door/config.js) (`DEFAULTS`, `SUN`, `QUALITY`), and can be overridden per call: `createDoorIntro(el, { beam: 0.2, scrollSteps: [0.05, 0.2] })`.

If you replace the door photo, update the pixel geometry in `DOOR`: opening, seam, stiles, posts, paper, kumiko bars.
