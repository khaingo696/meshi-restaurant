#!/usr/bin/env node
/**
 * Dựng hai nền "ban ngày" từ tranh public domain đã có trong public/assets/bg/:
 *
 *   washi-day.webp  — giấy washi gần như trống (nền Signatures). Thớ giấy lấy
 *                     từ vùng trống của Sesshū Haboku (paper-mist.webp), chỉ giữ
 *                     tần số cao rồi phủ lên màu be ấm #dacbbe.
 *   shoji-pine.webp — giấy Rezervace: cùng thớ, tông be đậm hơn (#c8b6a6), thêm
 *                     bóng cây thông Tōhaku (pines-mist.webp) in mờ lên như nắng
 *                     rọi qua shōji.
 *                     Gốc dưới gần giấy nên sắc hơn, ngọn mềm hơn.
 *   tear-edge.webp  — mép washi xé tay, ngăn O nás và Signatures (RGBA, lặp ngang).
 *
 * Chạy: node scripts/build-day-bg.mjs [thư-mục-ra]
 */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(join(ROOT, 'package.json'))('sharp');
const BG = join(ROOT, 'public/assets/bg');
const OUT = process.argv[2] || BG;
const W = 2000, H = 1125;
// Giấy Signatures: #dacbbe = --paper trong global.css. Kem sáng #efe5d2 chói
// gấp ba nền sáng nhất còn lại; mật ong #e0cba5 và #dccbb7 thì còn quá vàng.
const PAPER = [218, 203, 190];
const HONEY = PAPER;
// Giấy Rezervace: --res-paper, cùng hue nhưng tối hơn một bậc (L* 83 → 75) —
// phẳng, không có vũng sáng như Signatures, nên ở L* 83 nó trông trắng.
const RES_PAPER = [200, 182, 166];

async function grayRaw(img) {
  const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// --- 1. Thớ giấy ------------------------------------------------------------
// Vùng trống bên trái Haboku (giấy ~L182). Trừ bản blur để bỏ loang sáng,
// chỉ còn sợi giấy và chấm bẩn nhỏ.
const crop = sharp(join(BG, 'paper-mist.webp')).extract({ left: 0, top: 0, width: 760, height: 1206 }).removeAlpha();
const base = await grayRaw(crop.clone());
const low = await grayRaw(crop.clone().blur(22));
const hp = new Float32Array(base.w * base.h);
for (let i = 0; i < hp.length; i++) hp[i] = (base.data[i] - low.data[i]) / 182;

// Ghép patch ngẫu nhiên, mép mềm. Ghép gương thì ra hoa văn đối xứng
// lộ liễu; patch dính nét mực bị bỏ.
const P = 360, STEP = 240;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const okPatch = (sx, sy) => {
  for (let y = 0; y < P; y += 3) for (let x = 0; x < P; x += 3) if (hp[(sy + y) * base.w + sx + x] < -0.1) return false;
  return true;
};
const acc = new Float32Array(W * H), wsum = new Float32Array(W * H);
const win = new Float32Array(P);
for (let i = 0; i < P; i++) win[i] = Math.sin(Math.PI * (i + 0.5) / P) ** 2;
for (let py = -P / 2; py < H; py += STEP) for (let px = -P / 2; px < W; px += STEP) {
  let sx, sy, tries = 0;
  do { sx = Math.floor(rnd() * (base.w - P)); sy = Math.floor(rnd() * (base.h - P)); } while (!okPatch(sx, sy) && ++tries < 200);
  const flip = rnd() < 0.5;
  for (let y = 0; y < P; y++) {
    const ty = py + y; if (ty < 0 || ty >= H) continue;
    for (let x = 0; x < P; x++) {
      const tx = px + x; if (tx < 0 || tx >= W) continue;
      const w = win[x] * win[y];
      acc[ty * W + tx] += hp[(sy + y) * base.w + sx + (flip ? P - 1 - x : x)] * w;
      wsum[ty * W + tx] += w * w;
    }
  }
}
// Chia cho căn tổng bình phương trọng số: chỗ chồng patch không bị nhạt đi.
const tex = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) tex[i] = wsum[i] ? acc[i] / Math.sqrt(wsum[i]) : 0;
const FIBRE = 1.1;
const paperPx = (i, c = PAPER) => { const f = 1 + tex[i] * FIBRE; return [c[0] * f, c[1] * f, c[2] * f]; };

{
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const p = paperPx(i, HONEY);
    out[i * 3] = clamp(p[0]); out[i * 3 + 1] = clamp(p[1]); out[i * 3 + 2] = clamp(p[2]);
  }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 78 }).toFile(join(OUT, 'washi-day.webp'));
}

// --- 2. Bóng thông trên shōji -------------------------------------------------
// Mật độ mực từ pines-mist (duotone: mực ~L19, giấy ~L84). Ngưỡng cắt bỏ
// loang giấy và vệt mối nối bình phong. Chỉ lấy cây lớn ở giữa — cụm cây
// mờ bên trái in ra trông như vết bẩn.
const SRC = sharp(join(BG, 'pines-mist.webp')).extract({ left: 400, top: 0, width: 750, height: 1171 }).removeAlpha();
const scale = (H * 1.18) / 1171;
const sw = Math.round(750 * scale), sh = Math.round(1171 * scale);
const g = await grayRaw(SRC.clone().resize(sw, sh));
const dens = Buffer.alloc(sw * sh);
for (let i = 0; i < dens.length; i++) dens[i] = clamp(smooth(0.14, 0.85, (84 - g.data[i]) / (84 - 19)) * 255);

const densImg = () => sharp(dens, { raw: { width: sw, height: sh, channels: 1 } });
const near = await grayRaw(densImg().blur(5));   // phần dưới, gần giấy
const far = await grayRaw(densImg().blur(15));   // ngọn, xa giấy
const OX = 330, OY = 190;   // gốc cây và nét đất rơi ra ngoài mép dưới
// Bóng không xám: xám nguội trên giấy ấm đọc thành vết bẩn. Nó nhuộm giấy
// về nâu umber (TINT) — như nắng qua giấy dầu, bóng mang màu của giấy.
// Chỗ đậm nhất trộn 26 % TINT; đậm hơn thì chữ vàng nhỏ trên bóng dưới 4 : 1.
const TINT = [124, 84, 50];
const S = 0.26;

const out = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  const k = smooth(0.15, 0.85, y / H);
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const sx = x - OX, sy = y - OY;
    let d = 0;
    if (sx >= 0 && sy >= 0 && sx < sw && sy < sh) {
      const j = sy * sw + sx;
      d = (far.data[j] * (1 - k) + near.data[j] * k) / 255;
    }
    // Cửa sổ ở góc trên phải sáng hơn chút, góc dưới trái lắng hơn chút.
    const lx = x / W - 0.8, ly = y / H - 0.15;
    const light = 1 + 0.045 * Math.max(0, 1 - Math.sqrt(lx * lx + ly * ly) / 0.75)
                    - 0.035 * smooth(0.4, 1, (y / H) * 0.6 + (1 - x / W) * 0.4);
    const p = paperPx(i, RES_PAPER);
    // Trộn về TINT theo mật độ bóng; thớ giấy (f trong p) giữ nguyên trên bóng.
    const w = S * d, f = p[0] / RES_PAPER[0];
    out[i * 3]     = clamp((p[0] * (1 - w) + TINT[0] * f * w) * light);
    out[i * 3 + 1] = clamp((p[1] * (1 - w) + TINT[1] * f * w) * light);
    out[i * 3 + 2] = clamp((p[2] * (1 - w) + TINT[2] * f * w) * light);
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 80 }).toFile(join(OUT, 'shoji-pine.webp'));

// --- 3. Mép washi xé tay ------------------------------------------------------
// Giấy kozo xé không ra răng cưa: mép lượn chậm, xơ ra thành viền mỏng sáng
// hơn (chỗ giấy mỏng) và có sợi thò ra ngoài. Mọi sóng có chu kỳ nguyên trên
// TW nên ảnh lặp ngang liền mạch. Không có sóng tần số cao: chúng tạo răng
// cưa, mà răng cưa là giấy văn phòng phẩm, không phải washi.
const TW = 1600;
const TAU = Math.PI * 2;
// alpha: 1 = giấy (dưới mép), light: 1 = viền xơ / sợi sáng.
function tearShape(TH, baseFrac) {
  const waves = [];
  const addWaves = (ks, amp) => ks.forEach((k, i) => waves.push([k, amp[i] ?? amp[0], rnd() * TAU]));
  addWaves([1, 2, 3, 5], [9, 7, 5, 4]);           // chậm, cả tờ
  addWaves([8, 13, 21, 34], [3, 2.4, 1.6, 1]);   // từng mảng xé
  const edgeY = new Float32Array(TW);
  for (let x = 0; x < TW; x++) {
    let y = TH * baseFrac;
    for (const [k, a, ph] of waves) y += a * Math.sin(TAU * k * x / TW + ph);
    edgeY[x] = y;
  }
  // Độ dài phần xơ theo từng cột: nhiễu ngẫu nhiên làm mượt vòng tròn.
  const rawF = Float32Array.from({ length: TW }, () => rnd());
  const fuzz = new Float32Array(TW);
  for (let x = 0; x < TW; x++) { let s = 0; for (let d = -1; d <= 1; d++) s += rawF[(x + d + TW) % TW]; fuzz[x] = s / 3; }

  const alpha = new Float32Array(TW * TH);
  const light = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const d = y - edgeY[x];
    const core = smooth(-1, 3, d);
    // Xơ: dải mỏng, mờ, sọc theo sợi (từng cột dài ngắn khác nhau).
    const len = 3 + 11 * fuzz[x] * fuzz[x];
    const feather = d < 0 ? 0.38 * (1 - smooth(0, len, -d)) : 0;
    const i = y * TW + x;
    alpha[i] = Math.max(core, feather);
    light[i] = d < 0 ? 1 : Math.exp(-d / 5);
  }
  // Sợi dài, mảnh, phần lớn nằm nghiêng theo mép — sợi dựng đứng trông như cỏ.
  for (let n = 0; n < 260; n++) {
    const x0 = rnd() * TW, y0 = edgeY[Math.floor(x0)] + 1 + rnd() * 5;
    const side = rnd() < 0.5 ? -1 : 1;
    const ang = -Math.PI / 2 + side * (0.6 + rnd() * 0.85), len = 10 + rnd() * 22, bend = -side * (0.02 + rnd() * 0.05);
    let px = x0, py = y0, a = ang;
    for (let s = 0; s < len; s += 0.3) {
      px += Math.cos(a) * 0.3; py += Math.sin(a) * 0.3; a += bend * 0.3;
      const fade = 0.38 * (1 - s / len) ** 0.7;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const xx = Math.floor(px) + ox, yy = Math.floor(py) + oy;
        if (yy < 0 || yy >= TH) continue;
        const w = Math.exp(-((px - xx - 0.5) ** 2 + (py - yy - 0.5) ** 2) / 0.22);
        const i = yy * TW + ((xx % TW) + TW) % TW;
        if (fade * w > alpha[i]) { alpha[i] = fade * w; light[i] = 1; }
      }
    }
  }
  return { alpha, light };
}

// Thớ giấy nối vòng: 200 cột đầu trộn với cột TW…TW+200 của tex.
const R = 200;
const texT = (x, y) => {
  const a = x < R ? smooth(0, 1, x / R) : 1;
  const v1 = tex[y * W + x], v2 = x < R ? tex[y * W + x + TW] : 0;
  return x < R ? (v1 * a + v2 * (1 - a)) / Math.sqrt(a * a + (1 - a) * (1 - a)) : v1;
};

// 3a. O nás → Signatures: dải giấy màu EDGE (mép trên vũng sáng), đè lên
// O nás; nửa dưới mờ dần để chìm vào giấy của pin.
{
  const TH = 200, EDGE = [174, 155, 141];   // = --honey-edge
  const { alpha, light } = tearShape(TH, 0.36);
  const out = Buffer.alloc(TW * TH * 4);
  for (let y = 0; y < TH; y++) {
    const tail = 1 - smooth(TH * 0.78, TH, y);
    for (let x = 0; x < TW; x++) {
      const i = y * TW + x;
      const f = (1 + texT(x, y) * FIBRE) * (1 + 0.16 * light[i]);
      out[i * 4] = clamp(EDGE[0] * f); out[i * 4 + 1] = clamp(EDGE[1] * f); out[i * 4 + 2] = clamp(EDGE[2] * f);
      out[i * 4 + 3] = clamp(alpha[i] * tail * 255);
    }
  }
  await sharp(out, { raw: { width: TW, height: TH, channels: 4 } }).webp({ quality: 86, alphaQuality: 100 }).toFile(join(OUT, 'tear-edge.webp'));
}

console.log('washi-day, shoji-pine, tear-edge →', OUT);
