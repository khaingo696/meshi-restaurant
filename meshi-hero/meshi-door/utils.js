// Small shared helpers: math, easing, image loading, device checks.
import { QUALITY } from './config.js';

export const clamp01 = v => Math.min(1, Math.max(0, v));
export const smoothstep = (a, b, v) => { const x = clamp01((v - a) / (b - a)); return x * x * (3 - 2 * x); };
export const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const makeCanvas = (width, height) => Object.assign(document.createElement('canvas'), { width, height });

export function cubicBezier(x1, y1, x2, y2) {
  const coef = (p1, p2) => { const c = 3 * p1, b = 3 * (p2 - p1) - c; return [1 - c - b, b, c]; };
  const [ax, bx, cx] = coef(x1, x2), [ay, by, cy] = coef(y1, y2);
  const at = (a, b, c, t) => ((a * t + b) * t + c) * t;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) {
      const v = at(ax, bx, cx, t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return at(ay, by, cy, t);
  };
}
export const slideEase = cubicBezier(0.6, 0, 0.35, 1);      // click / key: heavy start, steady glide off screen
export const momentumEase = cubicBezier(0.42, 0, 0.16, 1);  // the final shove: brief build-up, fast run, friction into the pocket
export const exitEase = t => 0.5 - 0.5 * Math.cos(Math.PI * t);

// x such that fn(x) = y, for monotonic fn on [0, 1]
export function inverse(fn, y) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (fn(m) < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// Loads the first source that decodes (e.g. WebP, then PNG for very old browsers).
export async function loadImage(srcs) {
  let error;
  for (const src of [].concat(srcs)) {
    const img = new Image();
    img.decoding = 'async';
    if (new URL(src, location.href).origin !== location.origin) img.crossOrigin = 'anonymous';   // keep pixels readable
    img.src = src;
    try {
      await img.decode();
      return img;
    } catch (err) {
      error = err;
    }
  }
  throw error ?? new Error('no image source');
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Quality tier for this device: phones and small / modest devices start at 'medium';
// the component steps down further at runtime if frames run long.
export function pickQuality(q) {
  if (QUALITY[q]) return QUALITY[q];
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.max(innerWidth, innerHeight) < 1100;
  const modest = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  return coarse || small || modest ? QUALITY.medium : QUALITY.high;
}
