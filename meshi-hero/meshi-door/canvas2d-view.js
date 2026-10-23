// Canvas 2D view: the photo, sliced and projected by hand. Used while three.js
// loads, and for browsers without WebGL. Planes are drawn as rectangles at their
// projected depth: exact for the frame and panels, close for the thin side faces.
import { SUN_D, SUN_SCREEN, plateSpan, shaftVolume, roomSunQuads } from './geometry.js';
import { smoothstep, makeCanvas } from './utils.js';

export function create2DView(canvas, o, doorImg) {
  const door = o.door, op = door.opening, j = door.jambs;
  const T = door.thickness, J = door.jambDepth, ov = door.overlap;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  let geo = null, dpr = 1, light = null, motes = [];

  // screen px per door px at depth z, and projections (the camera never moves)
  const k = z => (geo.s * geo.D) / (geo.D - z);
  const px = (x, z = 0) => geo.vw / 2 + (x - door.seam) * k(z);
  const py = (y, z = 0) => geo.vh / 2 + geo.oy + (y - door.height / 2) * k(z);

  // the sunlight (patch on the door, the volume in the air), blurred once per layout; two layers,
  // because the panels slide out from under the patch while the air stays lit
  function buildLight() {
    const { vw, vh } = geo, H = vh, sc = 0.5;          // half resolution: it is soft anyway
    const layer = () => {
      const c = makeCanvas(Math.ceil(vw * sc), Math.ceil(vh * sc)), g = c.getContext('2d');
      g.scale(sc, sc);
      const blur = r => { if ('filter' in g) g.filter = `blur(${Math.max(1, Math.round(r * sc))}px)`; };
      return [c, g, blur];
    };
    const [patch, pg, pblur] = layer();
    pblur(3);
    pg.fillStyle = 'rgba(255,170,100,0.32)';
    for (const p of geo.panes) {
      pg.beginPath();
      pg.moveTo(px(p.x0), py(p.top(p.x0))); pg.lineTo(px(p.x1), py(p.top(p.x1)));
      pg.lineTo(px(p.x1), py(p.top(p.x1) + p.h)); pg.lineTo(px(p.x0), py(p.top(p.x0) + p.h));
      pg.fill();
    }
    const [c, g, blur] = layer();
    const [dx, dy] = SUN_SCREEN;
    const vol = shaftVolume(geo.panes, (x, y) => [px(x) / H, py(y) / H]);
    const [tlx, tly] = vol.tl.map(v => v * H), [blx, bly] = vol.bl.map(v => v * H), xr = vol.xr * H, len = 2.2 * H;
    const qb = (blx - tlx) * dy - (bly - tly) * dx, sEnd = (xr - tlx) / dx;
    const a = Math.min(1, 1.4 * o.beam);
    blur(Math.abs(qb) * 0.2);
    g.translate(tlx, tly);
    g.rotate(Math.atan2(dy, dx));
    const grad = g.createLinearGradient(sEnd - len, 0, sEnd, 0);
    grad.addColorStop(0, 'rgba(242,128,90,0)');
    grad.addColorStop(0.65, `rgba(250,150,96,${a * 0.5})`);
    grad.addColorStop(0.95, `rgba(255,170,100,${a})`);
    grad.addColorStop(1, 'rgba(255,170,100,0)');
    g.fillStyle = grad;
    const c0 = -qb / 2, hw = Math.abs(qb) / 2, hwFar = hw * 1.12;   // a touch wider toward the window
    g.beginPath();
    g.moveTo(sEnd, c0 - hw); g.lineTo(sEnd - len, c0 - hwFar); g.lineTo(sEnd - len, c0 + hwFar); g.lineTo(sEnd, c0 + hw);
    g.fill();
    return { patch, shaft: c, tlx, tly, qb, sEnd, len, xr };
  }

  return {
    kind: '2d',
    layout(g, q) {
      geo = g;
      dpr = Math.min(devicePixelRatio, q.dpr, 1.5);    // software-friendly resolution
      canvas.width = Math.round(g.vw * dpr);
      canvas.height = Math.round(g.vh * dpr);
      light = o.beam > 0 || o.sun > 0 ? buildLight() : null;
      motes = Array.from({ length: Math.round(150 * q.dust) }, (_, i) => ({ s: Math.random(), q: Math.random(), seed: Math.random(), glint: i < 8 }));
    },
    draw(fs) {
      if (!geo) return;
      const { vw, vh } = geo;
      const blit = (sx0, sy0, sx1, sy1, dx0, dy0, dx1, dy1, img = doorImg) => {
        if (Math.abs(dx1 - dx0) < 0.25 || Math.abs(dy1 - dy0) < 0.25) return;
        ctx.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, Math.min(dx0, dx1), Math.min(dy0, dy1), Math.abs(dx1 - dx0), Math.abs(dy1 - dy0));
      };
      const fill = (style, x0, y0, x1, y1) => {
        ctx.fillStyle = style;
        ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      };
      const ramp = (x0, x1, rgb, a0, a1) => {
        const grad = ctx.createLinearGradient(x0, 0, x1, 0);
        grad.addColorStop(0, `rgba(${rgb},${a0})`);
        grad.addColorStop(1, `rgba(${rgb},${a1})`);
        return grad;
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, vw, vh);
      ctx.imageSmoothingQuality = 'high';

      // jambs (revealed behind the panels)
      const shade = a => `rgba(0,0,0,${a})`;
      blit(op.left, j.header[1], op.right, j.header[0], px(op.left), py(op.top), px(op.right), py(op.top, -J));
      fill(shade(0.6), px(op.left), py(op.top), px(op.right), py(op.top, -J));
      blit(op.left, j.sill[0], op.right, j.sill[1], px(op.left), py(op.bottom, -J), px(op.right), py(op.bottom));
      fill(shade(0.4), px(op.left), py(op.bottom, -J), px(op.right), py(op.bottom));
      for (const [x, cols] of [[op.left, j.left], [op.right, j.right]]) {
        blit(Math.min(...cols), op.top, Math.max(...cols), op.bottom, px(x), py(op.top), px(x, -J), py(op.bottom));
        fill(shade(0.55), px(x), py(op.top), px(x, -J), py(op.bottom));
      }

      const shift = geo.travel * fs.p;
      const y0 = op.top - ov, y1 = op.bottom + ov;
      const edges = dir => [px(door.seam + dir * shift), px(door.seam + dir * shift, -T)];   // inner side face span
      const shadow = 0.6 * smoothstep(0, 0.06, fs.p) * (1 - smoothstep(0.85, 1, fs.p));
      if (shadow > 0) for (const dir of [-1, 1]) {   // contact shadows into the opening
        const e1 = edges(dir)[1], w = -dir * 60 * k(-T);
        fill(ramp(e1, e1 + w, '10,6,3', shadow, 0), e1, py(y0), e1 + w, py(y1));
      }

      // the sun that gets through the gap lands on the room's floor, further in and to the right
      // (drawn before the panels, which hide what lands behind them)
      const sunIn = light && o.sun > 0 && o.roomSun > 0 && shift > 0
        ? roomSunQuads(geo.panes, door.seam - shift, door.seam + shift - (T * SUN_D[0]) / -SUN_D[2], 0, op.bottom) : [];
      if (sunIn.length) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px(op.left, -J), py(op.top, -J), px(op.right, -J) - px(op.left, -J), py(op.bottom, -J) - py(op.top, -J));
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        if ('filter' in ctx) ctx.filter = 'blur(22px)';
        ctx.fillStyle = `rgba(255,170,100,${Math.min(1, 0.07 * o.roomSun * fs.beam * fs.sunUp)})`;
        ctx.beginPath();
        for (const q of sunIn) q.forEach(([x, z], i) => ctx[i ? 'lineTo' : 'moveTo'](px(x, z), py(op.bottom, z)));
        ctx.fill();
        ctx.restore();
      }

      for (const side of ['left', 'right']) {
        const isLeft = side === 'left', dir = isLeft ? -1 : 1;
        const x0 = isLeft ? op.left - ov : door.seam, x1 = isLeft ? door.seam : op.right + ov;
        const m = dir * shift;
        const [e0, e1] = edges(dir);
        blit(x0, y0, x1, y1, px(x0 + m), py(y0), px(x1 + m), py(y1));
        const span = geo.plate && plateSpan(geo.plate, side, door.seam);
        if (span && fs.ink > 0.01) {
          const pl = geo.plate, r = pl.canvas.width / pl.w, [sa, sb] = span;
          ctx.globalAlpha = fs.ink;
          blit((sa - pl.x) * r, 0, (sb - pl.x) * r, pl.canvas.height, px(sa + m), py(pl.y), px(sb + m), py(pl.y + pl.h), pl.canvas);
          ctx.globalAlpha = 1;
        }
        if (fs.p > 0) {                             // panels darken toward the pocket
          const [a, b] = isLeft ? [px(x0 + m), px(x1 + m)] : [px(x1 + m), px(x0 + m)];
          fill(ramp(a, b, '18,10,5', 0.55 * fs.p, 0.14 * fs.p), a, py(y0), b, py(y1));
        }
        const s0 = door.edgeStrip[side];           // inner side face (thickness)
        blit(s0, y0, s0 + T, y1, e0, py(y0), e1, py(y1));
        fill(ramp(e0, e1, '0,0,0', 0.28, 0.6), e0, py(y0), e1, py(y1));
      }

      // frame face on top (sides overlap the bands by 1px to avoid hairlines)
      const W = door.width, H = door.height;
      blit(0, 0, W, op.top, px(0), py(0), px(W), py(op.top));
      blit(0, op.bottom, W, H, px(0), py(op.bottom), px(W), py(H));
      blit(0, op.top - 1, op.left, op.bottom + 1, px(0), py(op.top - 1), px(op.left), py(op.bottom + 1));
      blit(op.right, op.top - 1, W, op.bottom + 1, px(op.right), py(op.top - 1), px(W), py(op.bottom + 1));

      ctx.globalCompositeOperation = 'lighter';
      const spill = 0.35 * smoothstep(0, 0.3, fs.p);
      if (spill > 0) {                              // light spilling onto the floor
        const grad = ctx.createLinearGradient(0, py(op.bottom), 0, py(op.bottom + 34));
        grad.addColorStop(0, `rgba(255,210,154,${spill})`);
        grad.addColorStop(1, 'rgba(255,210,154,0)');
        fill(grad, px(door.seam - shift), py(op.bottom), px(door.seam + shift), py(op.bottom + 34));
      }

      // low-key, then the sunlight and its dust
      ctx.globalCompositeOperation = 'source-over';
      fill(`rgba(0,0,0,${1 - o.exposure + o.beamShade})`, 0, 0, vw, vh);
      if (fs.roomUp < 1) fill(`rgba(8,5,3,${0.92 * (1 - fs.roomUp)})`, 0, 0, vw, vh);   // the opening shot: the room still dark
      if (!light) return;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, fs.beam * fs.sunUp * (1 + 0.6 * fs.stir));
      ctx.save();                                  // the patch stays put: the panels slide out from under it
      if (shift > 0) {
        ctx.beginPath();
        ctx.rect(0, 0, vw, vh);
        ctx.rect(px(door.seam - shift), 0, px(door.seam + shift) - px(door.seam - shift), vh);
        ctx.clip('evenodd');
      }
      ctx.drawImage(light.patch, 0, 0, vw, vh);
      ctx.restore();
      ctx.drawImage(light.shaft, 0, 0, vw, vh);
      ctx.globalAlpha = 1;
      if (o.dust <= 0) return;
      const [dx, dy] = SUN_SCREEN, time = fs.time / 1000, still = fs.calm ? 0 : 1;
      const { tlx, tly, qb, sEnd, len, xr } = light;
      for (const mo of motes) {
        const ss = (mo.s + still * time * (0.008 + 0.014 * mo.seed)) % 1;
        const sv = sEnd - len + ss * len, qv = -qb * (mo.q * 1.1 - 0.05) + still * 0.012 * vh * Math.sin(time * (0.17 + mo.seed * 0.15) + mo.seed * 53);
        const x = tlx + sv * dx + qv * dy - fs.stir * vh * (0.035 + 0.06 * mo.seed) * (0.6 + 0.4 * Math.sin(time * 1.7 + mo.seed * 19));
        const y = tly + sv * dy - qv * dx + fs.stir * vh * 0.025 * Math.sin(time * 2.3 + mo.seed * 37);
        if (x > xr) continue;
        const flash = mo.glint ? Math.max(0, Math.sin(still * time * (0.6 + mo.seed * 0.9) + mo.seed * 71)) ** 10 : 0.6 + 0.4 * Math.sin(still * time * 0.9 + mo.seed * 23);
        const a = smoothstep(0, 0.06, ss) * (1 - smoothstep(0.94, 1, ss)) * smoothstep(0.2, 0.7, ss) * flash * o.dust * fs.beam * fs.dustUp * (mo.glint ? 1.6 : 0.85);
        if (a < 0.01) continue;
        ctx.fillStyle = `rgba(255,190,130,${Math.min(1, a)})`;
        ctx.beginPath();
        ctx.arc(x, y, mo.glint ? 1.6 : 0.6 + mo.seed * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    dispose() { light = null; },
  };
}
