// Images derived from the door photo at runtime: the clean washi (lattice painted out),
// the printed logo plate and the film-grain tile.
import { clamp01, smoothstep, hexRgb, makeCanvas } from './utils.js';

// The photo with the lattice painted out of the paper (the 3D door draws real
// kumiko in front of it). Each bar is bridged by interpolating across it.
export function cleanPaper(doorImg, door) {
  const W = door.width, H = door.height;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(doorImg, 0, 0);
  const { top, bottom } = door.paper;
  let img;
  try {
    img = g.getImageData(0, top - 8, W, bottom - top + 16);   // only the paper rows
  } catch {
    return c;                     // tainted (file:// or no CORS): keep the painted lattice
  }
  const d = img.data, m = 2, oy = top - 8;
  const at = (x, y) => ((y - oy) * W + x) * 4;
  const mix = (i, a, b, t) => { for (let n = 0; n < 3; n++) d[i + n] = d[a + n] * (1 - t) + d[b + n] * t; };
  for (const [a, b] of door.kumiko.v) {
    const xa = a - m - 1, xb = b + m;
    for (let y = top; y < bottom; y++)
      for (let x = xa + 1; x < xb; x++) mix(at(x, y), at(xa, y), at(xb, y), (x - xa) / (xb - xa));
  }
  for (const [a, b] of door.kumiko.h) {
    const ya = a - m - 1, yb = b + m;
    for (const [x0, x1] of Object.values(door.paperX))
      for (let x = x0; x < x1; x++)
        for (let y = ya + 1; y < yb; y++) mix(at(x, y), at(x, ya), at(x, yb), (y - ya) / (yb - ya));
  }
  g.putImageData(img, 0, oy);
  return c;
}

// The logo, pre-composited against the paper it sits on into one RGBA plate
// (door space, R canvas px per door px): brand gold ink on the washi, with the
// paper fibre and backlight showing through; ink only lands on paper, so lattice
// and stiles stay in front. Edges come from the logo's alpha at screen resolution.
export function buildLogoPlate(o, doorImg, logoImg, pieces, R, maxSize = 2048) {
  if (!logoImg || !pieces.length) return null;
  const c = o.colors, k = pieces[0].k, pad = 4;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pieces) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + (p.sx1 - p.sx0) * k); y1 = Math.max(y1, p.y + (p.sy1 - p.sy0) * k);
  }
  [x0, y0, x1, y1] = [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
  const w = x1 - x0, h = y1 - y0;
  R = Math.min(R, maxSize / w, maxSize / h);
  const cw = Math.round(w * R), ch = Math.round(h * R);
  const ctx2d = cv => { const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; return g; };

  // logo pieces at their layout positions
  const logo = makeCanvas(cw, ch), lg = ctx2d(logo);
  for (const p of pieces)
    lg.drawImage(logoImg, p.sx0, p.sy0, p.sx1 - p.sx0, p.sy1 - p.sy0,
      (p.x - x0) * R, (p.y - y0) * R, (p.sx1 - p.sx0) * k * R, (p.sy1 - p.sy0) * k * R);
  // the paper underneath, sharp and blurred (local average for fibre detail / backlight)
  const sharp = makeCanvas(cw, ch), sg = ctx2d(sharp);
  sg.drawImage(doorImg, x0, y0, w, h, 0, 0, cw, ch);
  const small = makeCanvas(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 6)));
  ctx2d(small).drawImage(doorImg, x0, y0, w, h, 0, 0, small.width, small.height);
  const soft = makeCanvas(cw, ch), bg = ctx2d(soft);
  bg.drawImage(small, 0, 0, cw, ch);

  let A, P, B;
  try {
    A = lg.getImageData(0, 0, cw, ch).data;
    P = sg.getImageData(0, 0, cw, ch).data;
    B = bg.getImageData(0, 0, cw, ch).data;
  } catch {                       // tainted canvas: flat gold, no texture
    lg.globalCompositeOperation = 'source-in';
    lg.fillStyle = c.goldMid;
    lg.fillRect(0, 0, cw, ch);
    return { canvas: logo, x: x0, y: y0, w, h };
  }

  const out = lg.createImageData(cw, ch), O = out.data;
  const [gt, gm, gb] = [c.goldTop, c.goldMid, c.goldBottom].map(hexRgb);
  const logoTop = pieces[0].y - pieces[0].sy0 * k, logoH = o.logo.height * k;
  const gold = [0, 0, 0];
  for (let y = 0; y < ch; y++) {
    const ty = clamp01((y0 + y / R - logoTop) / logoH);       // logo-space height for the gold gradient
    const [ca, cb, f] = ty < 0.5 ? [gt, gm, ty * 2] : [gm, gb, ty * 2 - 1];
    for (let n = 0; n < 3; n++) gold[n] = ca[n] + (cb[n] - ca[n]) * f;
    for (let x = 0, i = y * cw * 4; x < cw; x++, i += 4) {
      const a = A[i + 3];
      if (!a) continue;
      const L = (0.299 * P[i] + 0.587 * P[i + 1] + 0.114 * P[i + 2]) / 255;
      const Lb = Math.max((0.299 * B[i] + 0.587 * B[i + 1] + 0.114 * B[i + 2]) / 255, 0.02);
      const detail = Math.min(1.25, Math.max(0.75, L / Lb));   // fibre, ~1 on average
      const glow = Math.min(1.08, Math.max(0.85, Lb / 0.8));   // backlight through the washi
      const tone = (1 + 1.1 * (detail - 1)) * glow;
      O[i] = gold[0] * tone;
      O[i + 1] = gold[1] * tone;
      O[i + 2] = gold[2] * tone;
      O[i + 3] = a * smoothstep(0.42, 0.6, L) * 0.96;          // ink only lands on paper
    }
  }
  lg.putImageData(out, 0, 0);
  return { canvas: logo, x: x0, y: y0, w, h };
}

// small tile of monochrome noise for the film-grain overlay
export function grainTile(size = 128) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.random() * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
