// Shared layout: viewport framing, logo layout, the sun patch and its shaft. All in door px.
import { SUN } from './config.js';
import { smoothstep } from './utils.js';

export const OVERSCAN = 1.06;   // the door is framed a touch tighter than cover, so no edge ever shows

const SUN_LEN = Math.hypot(...SUN.dir);
export const SUN_D = SUN.dir.map(v => v / SUN_LEN);                        // world, unit
export const SUN_SLOPE = -SUN_D[1] / SUN_D[0];                             // door px: y (down) per x along the patch edges, ~38°
export const SUN_SCREEN = (() => { const l = Math.hypot(SUN_D[0], SUN_D[1]); return [SUN_D[0] / l, -SUN_D[1] / l]; })();   // y down

// Viewport -> door framing (cover fit), camera distance and panel travel.
export function computeLayout(o, vw, vh) {
  const door = o.door, op = door.opening;
  const s = Math.max(vw / door.width, vh / door.height) * OVERSCAN;   // screen px per door px
  const visHalfW = vw / s / 2;
  // cropSill: the door sits lower, so the sill and the floor below it fall off the bottom edge
  // (as far as the overscan above allows; a door px is kept so the top edge never shows)
  const spare = door.height / 2 - vh / s / 2;
  const drop = o.cropSill ? Math.max(0, Math.min(spare - 1, door.height / 2 + vh / s / 2 - op.bottom)) : 0;
  const D = (vh / s) * o.cameraDistance;
  const f = (D + door.recess) / D;                                    // recess compensation (2D)
  // slide into the wall pocket when the posts are on screen, else just past the edge
  const panelW = Math.min(door.seam - op.left, op.right - door.seam);
  const pastEdge = visHalfW + 40 + (door.panel.thickness * visHalfW) / D;
  return {
    vw, vh, s, D, f,
    oy: drop * s,                                                     // screen px the door is moved down
    travel: Math.min(panelW + 4, pastEdge) * f,
    logo: layoutLogo(o, s, vw),
    panes: sunPanes(o, s, vw),
  };
}

// Logo pieces in door px: { side, sx0, sx1, sy0, sy1 (logo px), x, y (door px, top-left), k }.
// The emblem is split at the seam; each text row splits "ME | SHI" around the stiles.
export function layoutLogo(o, s, vw) {
  const lg = o.logo, door = o.door;
  if (!lg) return [];
  const paperH = door.paper.bottom - door.paper.top;
  const stileHalf = (door.stiles.right - door.stiles.left + 1) / 2;

  // how far each row reaches out from the stiles, [left, right] in logo px: the wordmark hugs the
  // stiles; the rows under it keep their outer edges where the logo has them against the wordmark,
  // pushed out only where they would run into the stiles ("Cuisine" sits across the logo's centre)
  const w = lg.rows[0];
  const hug = r => [lg.letterGap + r.left[1] - r.left[0], lg.letterGap + r.right[1] - r.right[0]];
  const [wl, wr] = hug(w);
  const reach = lg.rows.map(r => {
    const [l, rt] = hug(r);
    return [Math.max(l, wl + w.left[0] - r.left[0]), Math.max(rt, wr + r.right[1] - w.right[1])];
  });

  // scale (door px per logo px): ~42% of the paper height, never wider than 90% of the viewport
  const maxHalf = (vw * 0.45) / s;
  const limits = [(paperH * 0.42) / lg.height, maxHalf / Math.max(lg.center, lg.width - lg.center)];
  for (const u of reach) limits.push((maxHalf - stileHalf) / Math.max(...u));
  const k = Math.min(...limits);
  const top = door.paper.top + (paperH - lg.height * k) / 2 - paperH * 0.02;
  const seam = door.seam;
  const pieces = [];
  const piece = (side, sx0, sx1, sy0, sy1, x) => pieces.push({ side, sx0, sx1, sy0, sy1, x, y: top + sy0 * k, k });
  piece('left', 0, lg.center, lg.emblem.y0, lg.emblem.y1, seam - lg.center * k);
  piece('right', lg.center, lg.width, lg.emblem.y0, lg.emblem.y1, seam);
  lg.rows.forEach((r, i) => {
    piece('left', r.left[0], r.left[1], r.y0, r.y1, seam - stileHalf - reach[i][0] * k);
    piece('right', r.right[0], r.right[1], r.y0, r.y1, seam + stileHalf + (reach[i][1] - (r.right[1] - r.right[0])) * k);
  });
  return pieces;
}

// door-x range of the logo plate carried by each panel (it splits at the seam)
export function plateSpan(plate, side, seam) {
  const [a, b] = side === 'left' ? [plate.x, Math.min(plate.x + plate.w, seam)] : [Math.max(plate.x, seam), plate.x + plate.w];
  return b > a ? [a, b] : null;
}

// The sun's panes for this viewport: the patch sits at ~1/5 of the visible width, scaled to fit.
export function sunPanes(o, s, vw) {
  const door = o.door, visW = vw / s, k = Math.min(1, Math.max(0.45, visW / 1260));
  const left = door.seam - visW / 2 + visW * 0.2, y0 = door.paper.top + SUN.top * k;
  return SUN.panes.map(([a, b]) => {
    const x0 = left + a * k, x1 = left + b * k, h = SUN.height * k;
    const top = x => y0 + SUN_SLOPE * (x - left);
    return { x0, x1, h, top, cx: (x0 + x1) / 2, cy: top((x0 + x1) / 2) + h / 2 };
  });
}

export function inPanes(panes, x, y, soft = 5) {
  let v = 0;
  for (const p of panes) {
    const t = p.top(x);
    const sx = smoothstep(p.x0 - soft, p.x0 + soft, x) * (1 - smoothstep(p.x1 - soft, p.x1 + soft, x));
    const sy = smoothstep(t - soft, t + soft, y) * (1 - smoothstep(t + p.h - soft, t + p.h + soft, y));
    v = Math.max(v, sx * sy);
  }
  return v;
}

// The sun through the open gap: each pane cut to the gap [gl, gr] on the door plane (depth z0) and
// carried on along the light to the room's floor (y = floorY). Quads of [x, z] on the floor.
export function roomSunQuads(panes, gl, gr, z0, floorY) {
  const land = (x, y) => { const t = (floorY - y) / -SUN_D[1]; return [x + SUN_D[0] * t, z0 + SUN_D[2] * t]; };
  const quads = [];
  for (const p of panes) {
    const a = Math.max(p.x0, gl), b = Math.min(p.x1, gr);
    if (b > a) quads.push([land(a, p.top(a)), land(b, p.top(b)), land(b, p.top(b) + p.h), land(a, p.top(a) + p.h)]);
  }
  return quads;
}

// The light in the air, in screen space (screen-height units, y down): one volume whose
// upper and lower edges continue the patch's slanted top and bottom edges toward the window.
export function shaftVolume(panes, project) {
  const a = panes[0], z = panes[panes.length - 1];
  return {
    tl: project(a.x0, a.top(a.x0)), bl: project(a.x0, a.top(a.x0) + a.h),
    xl: project(a.x0, a.cy)[0], xr: project(z.x1, z.cy)[0],
  };
}
