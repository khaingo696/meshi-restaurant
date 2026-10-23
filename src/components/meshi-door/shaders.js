// GLSL for the 3D view. Screen-space passes use screen-height units with y down.

const NOISE = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }`;

export const FULLSCREEN_VERTEX = 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }';

// ---- the sunlight in the air -------------------------------------------------
// One volume between the window and the door: its edges continue the patch's
// slanted top and bottom edges; faint haze, denser toward where it lands, a
// touch wider toward the window (nearer the camera).
const SHAFT_COMMON = `
  uniform vec2 uRes; uniform float uI; uniform float uTime; uniform float uMotion; uniform float uShade;
  uniform vec3 uColor;
  uniform vec2 uDir; uniform vec2 uTL; uniform vec2 uBL; uniform float uXL; uniform float uXR; uniform float uReach;
  uniform float uStir;
  vec2 shaftCoord(vec2 p) {                                   // (along the light, across it) from the patch's top-left
    vec2 v = p - uTL;
    return vec2(dot(v, uDir), dot(v, vec2(uDir.y, -uDir.x)));
  }
  float shaftWiden(float before) { return 1.0 + 0.12 * smoothstep(0.0, 0.7, before); }
  float shaftMaskK(vec2 p, float k) {                         // k < 1: reaches further back toward the window
    float q = shaftCoord(p).y, qb = dot(uBL - uTL, vec2(uDir.y, -uDir.x));
    float before = max(uXL - p.x, 0.0) / max(uDir.x, 0.05);
    float qc = 0.5 * qb, hw = 0.5 * abs(qb) * shaftWiden(before);
    float q0 = qc - hw, q1 = qc + hw, e = 0.22 * abs(qb);
    float across = smoothstep(q0 - e, q0 + e, q) * (1.0 - smoothstep(q1 - e, q1 + e, q));
    float along = exp(-before * k / uReach) * (1.0 - smoothstep(uXR - 0.02, uXR + 0.04, p.x));
    return across * along;
  }`;

export const BEAM_FRAGMENT = `
  precision highp float;
  ${SHAFT_COMMON}
  ${NOISE}
  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes.y;
    float tm = uTime * uMotion;
    vec2 sq = shaftCoord(p);
    // large, slow smoke drifting down the light: the air is only visible where it carries dust
    vec2 hp = vec2(sq.x * 2.4 - tm * 0.07, sq.y * 6.0 + 0.2 * sin(tm * 0.11));
    float smoke = 0.5 * vnoise(hp) + 0.3 * vnoise(hp * 2.1 + 7.3) + 0.2 * vnoise(hp * 4.3 - 3.1 + tm * 0.05);
    float soft = 0.75 + 0.25 * vnoise(vec2(sq.y * 20.0 + tm * 0.04, sq.x * 0.5));
    float b = shaftMaskK(p, 1.0) * (0.35 + 1.1 * smoke) * soft;
    vec3 tint = uColor * mix(0.85, 1.0, smoothstep(-0.6, 0.2, sq.x));
    vec3 c = 1.0 - exp(-tint * b * uI);
    gl_FragColor = vec4(c, 1.0 - uShade * (1.0 - smoothstep(0.0, 0.3, b)));   // blend: src + dst * a
  }`;

// dust: fine motes drifting down through the volume, a few glinting (glints come first in the buffer)
export const DUST_VERTEX = `
  ${SHAFT_COMMON}
  uniform float uPR;
  attribute float aS; attribute float aQ; attribute float aSeed; attribute float aKind;
  varying float vA; varying float vKind;
  void main() {
    float tm = uTime * uMotion;
    vec2 n = vec2(uDir.y, -uDir.x);
    float qb = dot(uBL - uTL, n);
    float sEnd = (uXR - uTL.x) / max(uDir.x, 0.05), sStart = sEnd - 2.2;
    float ss = mod(aS + tm * (0.008 + 0.014 * aSeed), 1.0);
    float sv = mix(sStart, sEnd, ss) + 0.02 * sin(tm * 0.21 + aSeed * 31.0);
    vec2 p0 = uTL + sv * uDir + 0.5 * qb * n;
    float wid = shaftWiden(max(uXL - p0.x, 0.0) / max(uDir.x, 0.05));
    float qv = qb * (0.5 + (aQ - 0.5) * 1.3 * wid) + 0.012 * sin(tm * (0.17 + aSeed * 0.15) + aSeed * 53.0);
    vec2 p = uTL + sv * uDir + qv * n;
    // the panels slide away and drag the air: the dust swirls off with them
    p.x -= uStir * (0.035 + 0.06 * aSeed) * (0.6 + 0.4 * sin(tm * 1.7 + aSeed * 19.0));
    p.y += uStir * 0.025 * sin(tm * 2.3 + aSeed * 37.0);
    float ends = smoothstep(0.0, 0.06, ss) * smoothstep(1.0, 0.94, ss);
    float glint = pow(max(0.0, sin(tm * (0.6 + aSeed * 0.9) + aSeed * 71.0)), 10.0);
    float shimmer = 0.6 + 0.4 * sin(tm * (0.9 + aSeed * 1.7) + aSeed * 23.0);
    vA = shaftMaskK(p, 0.4) * ends * (aKind > 0.5 ? glint : shimmer);
    vKind = aKind;
    gl_PointSize = (aKind > 0.5 ? 13.0 + 11.0 * aSeed : 1.7 + 2.1 * aSeed) * uPR;
    gl_Position = vec4(p.x * uRes.y / uRes.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  }`;

export const DUST_FRAGMENT = `
  precision highp float;
  uniform float uDust; uniform vec3 uColor;
  varying float vA; varying float vKind;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0, a;
    if (vKind > 0.5) {                                   // four-point glint
      a = exp(-r * r * 22.0) + 0.55 * (exp(-abs(c.x) * 70.0) * exp(-abs(c.y) * 5.5) + exp(-abs(c.y) * 70.0) * exp(-abs(c.x) * 5.5));
    } else {
      a = 1.0 - smoothstep(0.25, 1.0, r);
    }
    float k = a * vA * uDust * (vKind > 0.5 ? 1.6 : 0.85);
    vec3 tint = vKind > 0.5 ? mix(uColor, vec3(1.0, 0.92, 0.82), 0.6) : uColor;
    gl_FragColor = vec4(tint * k, k);
  }`;

// ---- warm room light leaking through the gap ---------------------------------
export const GAP_FRAGMENT = `
  precision highp float;
  uniform vec2 uRes; uniform float uI; uniform float uTime; uniform float uCx; uniform float uHalf;
  uniform float uTop; uniform float uBot; uniform vec3 uColor;
  ${NOISE}
  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes.y;
    float v = clamp((p.y - uTop) / (uBot - uTop), 0.0, 1.0);          // 0 top of the opening .. 1 floor
    float spread = 0.018 + 0.05 * v * v;                             // the light fans a little toward the floor
    float d = max(abs(p.x - uCx) - uHalf, 0.0);
    float glow = exp(-d / spread) * 0.8 + exp(-d / (spread * 4.0)) * 0.25;
    glow *= mix(1.0, 0.15, step(abs(p.x - uCx), uHalf));           // inside the gap you see the room itself
    float vert = smoothstep(uTop - 0.02, uTop + 0.08, p.y) * (1.0 - smoothstep(uBot - 0.01, uBot + 0.06, p.y));
    float haze = 0.75 + 0.35 * vnoise(vec2(p.x * 14.0, p.y * 3.0 - uTime * 0.08));
    vec3 c = 1.0 - exp(-uColor * glow * vert * haze * uI);
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
  }`;

// ---- washi: torch, gap glow, a figure passing behind, the logo soaking in ----
// Patched into MeshLambertMaterial for the paper and the printed logo.
export const WASHI_VERTEX = ['#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vWashiW = (modelMatrix * vec4(transformed, 1.0)).xy;'];
export const WASHI_HEAD = `uniform vec2 uTorch; uniform float uTorchR; uniform float uPeek;
uniform sampler2D uRoom; uniform float uRoomOn; uniform vec2 uRes; uniform vec4 uCover; uniform float uPeekColor;
uniform float uGapX; uniform float uGapGlow; uniform vec3 uPeekTint;
uniform vec4 uKage;   // x, strength, walk phase, floor y (world)
uniform float uIsInk; uniform float uInk; uniform vec2 uInkC; uniform float uInkR;
varying vec2 vWashiW;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y);
}
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r;
}
// a person walking behind the paper, lit from the room: head, shoulders, body, striding legs (door px)
float kageSd(vec2 p) {
  float x = uKage.x, f = uKage.w, bob = 5.0 * abs(sin(uKage.z)), sw = 30.0 * sin(uKage.z);
  float d = length(p - vec2(x, f + 500.0 + bob)) - 42.0;
  d = min(d, sdCapsule(p, vec2(x, f + 425.0 + bob), vec2(x, f + 255.0 + bob), 72.0));
  d = min(d, sdCapsule(p, vec2(x - 64.0, f + 405.0 + bob), vec2(x + 64.0, f + 405.0 + bob), 36.0));
  d = min(d, sdCapsule(p, vec2(x - 22.0, f + 250.0 + bob), vec2(x - 22.0 + sw, f + 15.0), 32.0));
  d = min(d, sdCapsule(p, vec2(x + 22.0, f + 250.0 + bob), vec2(x + 22.0 - sw, f + 15.0), 32.0));
  return d;
}
`;
export const WASHI_FRAGMENT = ['#include <dithering_fragment>', `#include <dithering_fragment>
  float tq = exp(-pow(length(vWashiW - uTorch) / uTorchR, 2.0) * 1.4) * uPeek;
  if (tq > 0.002) {
    vec2 suv = (gl_FragCoord.xy / uRes) * uCover.xy + uCover.zw;
    vec3 room = uRoomOn > 0.5 ? texture2D(uRoom, suv).rgb : vec3(0.62, 0.5, 0.36);
    // the washi diffuses the room into light and shadow in the paper's own tone (like kage-e)
    float roomL = dot(room, vec3(0.3, 0.59, 0.11));
    float lift = clamp(1.0 + 1.1 * (roomL - 0.32), 0.62, 1.22);
    vec3 through = mix(vec3(lift), lift * normalize(room + 0.001) * 1.732, uPeekColor) * uPeekTint;
    gl_FragColor.rgb *= mix(vec3(1.0), through, tq);
  }
  float gq = exp(-max(abs(vWashiW.x) - uGapX, 0.0) / 110.0) * uGapGlow;   // room light seeping through beside the gap
  gl_FragColor.rgb *= 1.0 + gq * vec3(0.2, 0.12, 0.04);
  if (uKage.y > 0.002) {                     // kage-e: the paper diffuses the figure into a soft shadow
    float ks = 1.0 - smoothstep(-28.0, 52.0, kageSd(vWashiW));   // close behind the paper: a fairly clear silhouette
    gl_FragColor.rgb *= 1.0 - 0.42 * uKage.y * ks * vec3(1.0, 1.05, 1.12);
  }
  if (uIsInk > 0.5 && uInk < 0.999) {        // the logo soaking into the fibres from its centre
    float d = length(vWashiW - uInkC) / uInkR;
    float n = wNoise(vWashiW * 0.035) * 0.22 + wNoise(vWashiW * 0.14) * 0.1;
    float front = uInk * 1.38;
    gl_FragColor.rgb *= 1.0 - 0.22 * (1.0 - uInk) * smoothstep(front - 0.32, front - 0.04, d + n);   // the wet edge, a touch darker
    gl_FragColor.a *= 1.0 - smoothstep(front - 0.2, front, d + n);
  }`];

// ---- light from the room as the door opens -----------------------------------
const WORLD_VERTEX = (out = 'vec3 vW', assign = 'vW = w.xyz') => `varying ${out.split(' ')[0]} ${out.split(' ')[1]};
  void main() { vec4 w = modelMatrix * vec4(position, 1.0); ${assign}; gl_Position = projectionMatrix * viewMatrix * w; }`;

// pool of warm light on the floor: as wide as the gap, fanning out toward the viewer
export const POOL = {
  vertexShader: WORLD_VERTEX(),
  fragmentShader: `uniform float uGap; uniform float uStrength; uniform float uReach; uniform vec3 uColor; varying vec3 vW;
    void main() {
      float z = max(vW.z, 0.0);
      float edge = uGap + z * 0.55;
      float across = 1.0 - smoothstep(edge * 0.75, edge + 24.0, abs(vW.x));
      gl_FragColor = vec4(uColor * across * exp(-z / uReach) * uStrength, 1.0);
      #include <colorspace_fragment>
    }`,
};

// the sun through the open gap. The window and the sun do not move, so neither does the patch on
// the door; the panels slide out from under it, and the light that now gets through lands on the
// room's floor, further in and to the right: a sliver while the gap is narrow, the whole patch once
// it has passed. Each floor point is traced back along the light to the door plane, lit if it came
// through a pane and between the panels; the farther the light has come, the softer and dimmer it is.
export const ROOM_SUN = n => ({
  vertexShader: WORLD_VERTEX(),
  fragmentShader: `uniform vec4 uPanes[${n}]; uniform float uSlope; uniform vec3 uDir; uniform float uPaperZ;
    uniform vec2 uGap; uniform float uStrength; uniform vec3 uColor; varying vec3 vW;
    void main() {
      float t = (vW.z - uPaperZ) / uDir.z;
      vec2 d = vW.xy - uDir.xy * t;                       // where the light crossed the door plane
      float soft = 18.0 + 0.09 * t, lit = 0.0;
      for (int i = 0; i < ${n}; i++) {
        vec4 p = uPanes[i];                               // x0, x1, top edge at x0, height (world, y up)
        float top = p.z - uSlope * (d.x - p.x);
        float sx = smoothstep(p.x - soft, p.x + soft, d.x) * (1.0 - smoothstep(p.y - soft, p.y + soft, d.x));
        float sy = smoothstep(top - p.w - soft, top - p.w + soft, d.y) * (1.0 - smoothstep(top - soft, top + soft, d.y));
        lit = max(lit, sx * sy);
      }
      lit *= smoothstep(uGap.x - soft * 0.4, uGap.x + soft * 0.4, d.x) * (1.0 - smoothstep(uGap.y - soft * 0.4, uGap.y + soft * 0.4, d.x));
      vec3 c = 1.0 - exp(-uColor * lit * uStrength * exp(-t / 1600.0));
      gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
      #include <colorspace_fragment>
    }`,
});

// warm light blooming in the room behind the doorway
export const BLOOM = {
  vertexShader: WORLD_VERTEX('vec2 vW', 'vW = w.xy'),
  fragmentShader: `uniform float uStrength; uniform vec3 uColor; uniform float uTop; uniform float uBottom; varying vec2 vW;
    void main() {
      float v = clamp((vW.y - uBottom) / (uTop - uBottom), 0.0, 1.0);
      float a = uStrength * (0.55 + 0.45 * (1.0 - v)) * (1.0 - smoothstep(300.0, 1100.0, abs(vW.x)));
      gl_FragColor = vec4(uColor, a);
      #include <colorspace_fragment>
    }`,
};

// dust rising in the light that comes through the gap
export const MOTES = {
  vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; uniform float uRise; uniform float uBottom;
    varying float vSeed; varying vec3 vW;
    void main() {
      vec3 p = position;
      p.y = uBottom + mod(p.y - uBottom + uTime * (6.0 + 10.0 * seed), uRise);
      p.x += sin(uTime * 0.25 + seed * 40.0) * 14.0;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vW = p; vSeed = seed;
      gl_PointSize = (1.2 + 2.2 * seed) * uScale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform float uTime; uniform float uGap; uniform float uStrength; uniform vec3 uColor; varying float vSeed; varying vec3 vW;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float edge = uGap + max(vW.z, 0.0) * 0.55;
      float beam = 1.0 - smoothstep(edge * 0.6, edge + 20.0, abs(vW.x));
      float twinkle = 0.6 + 0.4 * sin(uTime * (0.6 + vSeed) + vSeed * 30.0);
      gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.2, 1.0, r)) * beam * twinkle * uStrength);
      #include <colorspace_fragment>
    }`,
};
