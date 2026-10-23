// The 3D door (Three.js). Loaded on demand by index.js, so three.js never blocks the page.
//
// The door is rebuilt as real geometry in door px: frame, panels and kumiko are
// boxes textured with the photo's own wood; the washi (photo with the painted
// lattice removed) glows from behind; a key light and the sun (a far spotlight
// projecting the window panes) cast the lattice shadows. Screen-space passes on
// top: light through the gap, the sunlight in the air and its dust.
import {
  WebGLRenderer, PCFSoftShadowMap, PCFShadowMap, LinearToneMapping, Texture, CanvasTexture,
  SRGBColorSpace, NoColorSpace, LinearFilter, Color, Vector2, Vector3, Vector4,
  MeshLambertMaterial, ShaderMaterial, Scene, PerspectiveCamera, OrthographicCamera, Mesh, Group,
  AmbientLight, DirectionalLight, SpotLight, BufferGeometry, Float32BufferAttribute, PlaneGeometry, Points,
  AdditiveBlending, CustomBlending, OneFactor, ZeroFactor, SrcAlphaFactor, MathUtils,
} from 'three';
import { SUN } from './config.js';
import { SUN_D, SUN_SLOPE, SUN_SCREEN, inPanes, plateSpan, shaftVolume } from './geometry.js';
import { makeCanvas } from './utils.js';
import {
  FULLSCREEN_VERTEX, BEAM_FRAGMENT, DUST_VERTEX, DUST_FRAGMENT, GAP_FRAGMENT,
  WASHI_VERTEX, WASHI_HEAD, WASHI_FRAGMENT, POOL, BLOOM, MOTES, ROOM_SUN,
} from './shaders.js';

// Calibrated so a front face shows exactly the photo: ambient + key * cos(front) = 1.
const AMBIENT = 0.55, KEY = 0.64, KEY_DIR = [-0.45, 0.55, 0.7];
const PAPER_LIT = 0.35;           // share of the washi's look that comes from front light (rest: backlight)
const DUST_MAX = 440, GLINTS = 22, GAP_MOTES = 120;

// Accumulates textured quads into one BufferGeometry.
class Mesher {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  quad(points, normal, uvs) {
    const b = this.p.length / 3;
    for (const v of points) this.p.push(...v);
    for (let k = 0; k < 4; k++) this.n.push(...normal);
    for (const v of uvs) this.uv.push(...v);
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    return g;
  }
}

// screen-space overlay: additive (or light + shade) full-screen pass
const overlay = (uniforms, fragmentShader, extra = {}) => new ShaderMaterial({
  uniforms, vertexShader: FULLSCREEN_VERTEX, fragmentShader,
  depthTest: false, depthWrite: false, transparent: true, blending: CustomBlending,
  blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor, ...extra,
});

export function createWebGLView(canvas, o, { photo: photoImg, paper: paperImg }) {
  const door = o.door, op = door.opening, W = door.width, H = door.height;
  const pz = door.panel, J = door.jambDepth, ov = door.overlap, jb = door.jambs, wd = door.wood;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;          // shadows are redrawn only when the panels move
  renderer.toneMapping = LinearToneMapping;
  renderer.toneMappingExposure = o.exposure;

  const X = x => x - door.seam;
  const Y = y => H / 2 - y;
  const U = x => x / W;
  const V = y => 1 - y / H;

  // faces; cols / rows are [front, back] photo strips mapped across the depth
  const front = (m, x0, y0, x1, y1, z) => m.quad(
    [[X(x0), Y(y1), z], [X(x1), Y(y1), z], [X(x1), Y(y0), z], [X(x0), Y(y0), z]], [0, 0, 1],
    [[U(x0), V(y1)], [U(x1), V(y1)], [U(x1), V(y0)], [U(x0), V(y0)]]);
  const left = (m, x, y0, y1, z0, z1, [cf, cb]) => m.quad(
    [[X(x), Y(y1), z0], [X(x), Y(y1), z1], [X(x), Y(y0), z1], [X(x), Y(y0), z0]], [-1, 0, 0],
    [[U(cb), V(y1)], [U(cf), V(y1)], [U(cf), V(y0)], [U(cb), V(y0)]]);
  const right = (m, x, y0, y1, z0, z1, [cf, cb]) => m.quad(
    [[X(x), Y(y1), z1], [X(x), Y(y1), z0], [X(x), Y(y0), z0], [X(x), Y(y0), z1]], [1, 0, 0],
    [[U(cf), V(y1)], [U(cb), V(y1)], [U(cb), V(y0)], [U(cf), V(y0)]]);
  const top = (m, y, x0, x1, z0, z1, [rf, rb]) => m.quad(
    [[X(x0), Y(y), z1], [X(x1), Y(y), z1], [X(x1), Y(y), z0], [X(x0), Y(y), z0]], [0, 1, 0],
    [[U(x0), V(rf)], [U(x1), V(rf)], [U(x1), V(rb)], [U(x0), V(rb)]]);
  const bottom = (m, y, x0, x1, z0, z1, [rf, rb]) => m.quad(
    [[X(x1), Y(y), z1], [X(x0), Y(y), z1], [X(x0), Y(y), z0], [X(x1), Y(y), z0]], [0, -1, 0],
    [[U(x1), V(rf)], [U(x0), V(rf)], [U(x0), V(rb)], [U(x1), V(rb)]]);
  const box = (m, x0, y0, x1, y1, z0, z1, cols = wd.cols, rows = wd.rows) => {
    front(m, x0, y0, x1, y1, z1);
    left(m, x0, y0, y1, z0, z1, cols);
    right(m, x1, y0, y1, z0, z1, cols);
    top(m, y0, x0, x1, z0, z1, rows);
    bottom(m, y1, x0, x1, z0, z1, rows);
  };

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const texture = src => {
    const t = src instanceof HTMLCanvasElement ? new CanvasTexture(src) : new Texture(src);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = aniso;
    t.needsUpdate = true;
    return t;
  };
  const photo = texture(photoImg), paperTex = texture(paperImg);
  let plateTex = null;
  const grey = v => new Color(v, v, v);
  const wood = new MeshLambertMaterial({ map: photo });
  const floorMat = new MeshLambertMaterial({ map: photo, color: grey(1.1) });
  const paperMat = new MeshLambertMaterial({ map: paperTex, color: grey(PAPER_LIT), emissive: grey(1 - PAPER_LIT), emissiveMap: paperTex });

  // torch: under the pointer the washi is lit by the room behind it. A tiny copy of
  // options.interior (blurry by construction) modulates the paper, mapped like
  // object-fit: cover so it lines up with the real background once the door opens.
  const roomCanvas = makeCanvas(128, 72), roomCtx = roomCanvas.getContext('2d');
  const roomTex = new CanvasTexture(roomCanvas);
  Object.assign(roomTex, { minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false });
  roomTex.colorSpace = NoColorSpace;
  const peekTint = (() => {   // sun colour at peekWarm strength, same overall brightness
    const t = SUN.color.map(c => 1 + (c - 1) * o.peekWarm), l = 0.3 * t[0] + 0.59 * t[1] + 0.11 * t[2];
    return new Vector3(...t.map(c => c / l));
  })();
  const washiU = {
    uTorch: { value: new Vector2() }, uTorchR: { value: 150 }, uPeek: { value: 0 },
    uRoom: { value: roomTex }, uRoomOn: { value: 0 }, uRes: { value: new Vector2(1, 1) }, uCover: { value: new Vector4(1, 1, 0, 0) },
    uPeekColor: { value: o.peekColor }, uPeekTint: { value: peekTint }, uGapX: { value: 0 }, uGapGlow: { value: 0 },
    uKage: { value: new Vector4(0, 0, 0, Y(op.bottom)) },
    uInk: { value: 1 }, uInkC: { value: new Vector2() }, uInkR: { value: 1 },
  };
  const washiMats = [];                           // paper + printed logo: their backlight comes up with the room
  const washi = (m, ink = false) => {
    washiMats.push(m);
    m.customProgramCacheKey = () => (ink ? 'meshi-washi-ink' : 'meshi-washi');
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, washiU, { uIsInk: { value: ink ? 1 : 0 } });
      sh.vertexShader = 'varying vec2 vWashiW;\n' + sh.vertexShader.replace(...WASHI_VERTEX);
      sh.fragmentShader = WASHI_HEAD + sh.fragmentShader.replace(...WASHI_FRAGMENT);
    };
    return m;
  };
  washi(paperMat);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 1, 10000);
  const mesh = (geometry, material, parent = scene, { cast = false, receive = false, order = 0 } = {}) => {
    const m = new Mesh(geometry, material);
    Object.assign(m, { castShadow: cast, receiveShadow: receive, renderOrder: order });
    parent.add(m);
    return m;
  };

  // lights
  const ambient = new AmbientLight(0xffffff, AMBIENT * Math.PI);
  scene.add(ambient);
  const key = new DirectionalLight(0xffffff, KEY * Math.PI);
  key.position.set(...KEY_DIR).multiplyScalar(3000);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -1300, right: 1300, top: 700, bottom: -700, near: 500, far: 6000 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.6;
  scene.add(key, key.target);

  // the sun: far and narrow (rays nearly parallel), projecting the window panes, with shadows
  const sun = new SpotLight(new Color(...SUN.color), 0, 0, 0.1, 0, 0);
  sun.castShadow = true;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.4;
  const goboCanvas = makeCanvas(256, 256);
  const gobo = new CanvasTexture(goboCanvas);
  sun.map = gobo;
  scene.add(sun, sun.target);
  let goboKey = '';
  function aimSun(panes) {
    const xs = panes.flatMap(p => [p.x0, p.x1]), ys = panes.flatMap(p => [p.top(p.x0), p.top(p.x1) + p.h]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const T = new Vector3(X((x0 + x1) / 2), Y((y0 + y1) / 2), pz.paper), dist = 4000;
    sun.target.position.copy(T);
    sun.position.set(T.x - SUN_D[0] * dist, T.y - SUN_D[1] * dist, T.z - SUN_D[2] * dist);
    sun.angle = Math.atan((Math.hypot(x1 - x0, y1 - y0) * 0.62) / dist);
    Object.assign(sun.shadow.camera, { near: dist * 0.75, far: dist * 1.25 });
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    sun.shadow.updateMatrices(sun);
    const gk = [x0, x1, y0, y1].map(v => v.toFixed(1)).join();
    if (gk === goboKey) return;
    goboKey = gk;
    // gobo: trace each texel of the light's view to the paper plane and test the panes there
    const g = goboCanvas.getContext('2d'), img = g.createImageData(256, 256), v = new Vector3();
    for (let r = 0; r < 256; r++) for (let c = 0; c < 256; c++) {
      v.set(((c + 0.5) / 256) * 2 - 1, 1 - ((r + 0.5) / 256) * 2, 0.5).unproject(sun.shadow.camera).sub(sun.position);
      const k = (pz.paper - sun.position.z) / v.z;
      const val = inPanes(panes, sun.position.x + v.x * k + door.seam, H / 2 - (sun.position.y + v.y * k)) * 255;
      const i = (r * 256 + c) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    gobo.needsUpdate = true;
  }

  // warm light from the room behind, on the panels' inner edges as they part
  const interior = new SpotLight(o.colors.light, 0, 0, Math.PI / 5, 0.75, 0);
  interior.position.set(0, Y(250), -700);
  interior.target.position.set(0, Y(H), 320);
  scene.add(interior, interior.target);

  // frame: beam and posts stand proud of the wall, doorway jambs run back
  const fd = door.frameDepth, set = new Mesher();
  box(set, 0, 0, W, op.top, 0, fd, wd.cols, [op.top - 3, op.top - 12]);
  for (const [x0, x1] of Object.values(door.posts)) box(set, x0, op.top, x1, op.bottom, 0, fd, wd.postCols, wd.rows);
  front(set, 0, op.top, door.posts.left[0], op.bottom, 0);
  front(set, door.posts.left[1], op.top, op.left, op.bottom, 0);
  front(set, op.right, op.top, door.posts.right[0], op.bottom, 0);
  front(set, door.posts.right[1], op.top, W, op.bottom, 0);
  right(set, op.left, op.top, op.bottom, -J, 0, jb.left);
  left(set, op.right, op.top, op.bottom, -J, 0, jb.right);
  bottom(set, op.top, op.left, op.right, -J, 0, jb.header);
  mesh(set.geometry(), wood, scene, { cast: true, receive: true });
  const floor = mesh(new BufferGeometry(), floorMat, scene, { receive: true });

  // floor: a plane running toward the viewer, its texture mapped so the
  // photo's floor band lines up at rest (rows are perspective-foreshortened)
  function floorGeometry(D) {
    const m = new Mesher(), cy = H / 2, yb = op.bottom;
    const row = z => (z <= 0 ? yb + 0.5 : Math.min(H - 0.5, cy + ((yb - cy) * D) / (D - z)));
    const zs = [-J - 30, 0];
    for (let i = 1; i <= 16; i++) zs.push((0.35 * D * i) / 16);
    for (let i = 0; i < zs.length - 1; i++) top(m, yb, -400, W + 400, zs[i], zs[i + 1], [row(zs[i + 1]), row(zs[i])]);
    return m.geometry();
  }

  const additive = { transparent: true, depthWrite: false, blending: AdditiveBlending };
  const pool = new ShaderMaterial({
    ...POOL, ...additive,
    uniforms: { uGap: { value: 0 }, uStrength: { value: 0 }, uReach: { value: 300 }, uColor: { value: new Color(o.colors.light) } },
  });
  const poolMesh = new Mesher();
  top(poolMesh, op.bottom - 0.5, op.left, op.right, -J, 2000, [0, 0]);
  const poolM = mesh(poolMesh.geometry(), pool, scene, { order: 3 });

  const bloom = new ShaderMaterial({
    ...BLOOM, ...additive,
    uniforms: { uStrength: { value: 0 }, uColor: { value: new Color(o.colors.light) }, uTop: { value: Y(op.top) }, uBottom: { value: Y(op.bottom) } },
  });
  const bloomMesh = new Mesher();
  front(bloomMesh, op.left, op.top, op.right, op.bottom, -J - 4);
  const bloomM = mesh(bloomMesh.geometry(), bloom, scene, { order: 1 });

  const motePos = [], moteSeed = [];
  for (let i = 0; i < GAP_MOTES; i++) {
    motePos.push((Math.random() - 0.5) * 1400, Y(op.bottom) + Math.random() * (op.bottom - op.top), -30 + Math.random() * 320);
    moteSeed.push(Math.random());
  }
  const moteGeo = new BufferGeometry();
  moteGeo.setAttribute('position', new Float32BufferAttribute(motePos, 3));
  moteGeo.setAttribute('seed', new Float32BufferAttribute(moteSeed, 1));
  const motes = new ShaderMaterial({
    ...MOTES, ...additive,
    uniforms: {
      uTime: { value: 0 }, uGap: { value: 0 }, uStrength: { value: 0 }, uScale: { value: 1 },
      uRise: { value: op.bottom - op.top }, uBottom: { value: Y(op.bottom) }, uColor: { value: new Color(o.colors.mote) },
    },
  });
  const moteCloud = new Points(moteGeo, motes);
  Object.assign(moteCloud, { renderOrder: 4, frustumCulled: false });
  scene.add(moteCloud);

  // the sun that gets through the gap, on the room's floor (over the page behind: blended like the screen passes)
  const roomSun = new ShaderMaterial({
    ...ROOM_SUN(SUN.panes.length),
    transparent: true, depthWrite: false, blending: CustomBlending,
    blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor,
    uniforms: {
      uPanes: { value: SUN.panes.map(() => new Vector4()) }, uSlope: { value: SUN_SLOPE },
      uDir: { value: new Vector3(...SUN_D) }, uPaperZ: { value: pz.paper }, uGap: { value: new Vector2() },
      uStrength: { value: 0 }, uColor: { value: new Vector3(...SUN.color) },
    },
  });
  const roomSunMesh = new Mesher();
  top(roomSunMesh, op.bottom, door.seam - 3000, door.seam + 3000, -3000, -J - 30, [0, 0]);
  const roomSunM = mesh(roomSunMesh.geometry(), roomSun, scene, { order: 2 });
  const openingOnly = [poolM, bloomM, moteCloud, roomSunM];   // invisible (and skipped) while the door is shut

  // panels: stiles + rails (thickness), kumiko lattice in front of the washi
  const panels = {}, logos = {};
  for (const side of ['left', 'right']) {
    const g = new Group(), m = new Mesher(), paper = new Mesher();
    const [p0, p1] = door.paperX[side];
    const z1 = pz.front, z0 = z1 - pz.thickness;
    const yT = op.top - ov, yB = op.bottom + ov, pT = door.paper.top, pB = door.paper.bottom;
    const stiles = side === 'left' ? [[op.left - ov, p0], [p1, door.seam]] : [[door.seam, p0], [p1, op.right + ov]];
    for (const [a, b] of stiles) box(m, a, yT, b, yB, z0, z1);
    box(m, p0, yT, p1, pT, z0, z1);
    box(m, p0, pB, p1, yB, z0, z1);
    const k1 = pz.kumikoFront, k0 = k1 - pz.kumikoDepth;
    for (const [a, b] of door.kumiko.v) if (a >= p0 && b <= p1) box(m, a, pT, b, pB, k0, k1);
    for (const [a, b] of door.kumiko.h) box(m, p0, a, p1, b, k0, k1);
    mesh(m.geometry(), wood, g, { cast: true, receive: true });
    front(paper, p0, pT, p1, pB, pz.paper);
    mesh(paper.geometry(), paperMat, g, { receive: true });
    logos[side] = new Group();
    g.add(logos[side]);
    scene.add(g);
    panels[side] = g;
  }

  // printed logo: the shared plate, on the washi and under the kumiko
  function setPlate(plate) {
    for (const g of Object.values(logos)) {
      for (const m of g.children) { m.geometry.dispose(); m.material.dispose(); }
      g.clear();
    }
    plateTex?.dispose();
    plateTex = null;
    washiMats.length = 1;                        // keep the paper, drop the old ink
    if (!plate) return;
    washiU.uInkC.value.set(X(plate.x + plate.w / 2), Y(plate.y + plate.h / 2));
    washiU.uInkR.value = Math.hypot(plate.w, plate.h) / 2;
    plateTex = texture(plate.canvas);
    for (const side of ['left', 'right']) {
      const span = plateSpan(plate, side, door.seam);
      if (!span) continue;
      const [a, b] = span, [y0, y1] = [plate.y, plate.y + plate.h], u = x => (x - plate.x) / plate.w;
      const z = pz.paper + 0.05, m = new Mesher();
      m.quad([[X(a), Y(y1), z], [X(b), Y(y1), z], [X(b), Y(y0), z], [X(a), Y(y0), z]], [0, 0, 1],
        [[u(a), 0], [u(b), 0], [u(b), 1], [u(a), 1]]);
      const ink = washi(new MeshLambertMaterial({
        map: plateTex, color: grey(PAPER_LIT), emissive: grey(1 - PAPER_LIT), emissiveMap: plateTex,
        transparent: true, depthWrite: false,
      }), true);
      mesh(m.geometry(), ink, logos[side], { receive: true, order: 1 });
    }
  }

  // ---- screen-space passes ----
  const screenCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = () => new PlaneGeometry(2, 2);

  const gapU = {
    uRes: { value: new Vector2() }, uI: { value: 0 }, uTime: { value: 0 }, uCx: { value: 0 }, uHalf: { value: 0 },
    uTop: { value: 0 }, uBot: { value: 1 }, uColor: { value: new Vector3(1.0, 0.78, 0.5) },
  };
  const gapScene = new Scene(), gapMat = overlay(gapU, GAP_FRAGMENT);
  gapScene.add(new Mesh(quad(), gapMat));

  const beamU = {
    uRes: { value: new Vector2() }, uI: { value: 0 }, uTime: { value: 0 }, uMotion: { value: 1 }, uShade: { value: 0 },
    uColor: { value: new Vector3(...SUN.color) }, uDir: { value: new Vector2(...SUN_SCREEN) },
    uTL: { value: new Vector2() }, uBL: { value: new Vector2() }, uXL: { value: 0 }, uXR: { value: 0 }, uReach: { value: 0.7 },
    uPR: { value: 1 }, uDust: { value: 0 }, uStir: { value: 0 },
  };
  const beamScene = new Scene(), dustScene = new Scene();
  const beamMat = overlay(beamU, BEAM_FRAGMENT, { blendDst: SrcAlphaFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor });
  beamScene.add(new Mesh(quad(), beamMat));
  const dustMat = new ShaderMaterial({ uniforms: beamU, vertexShader: DUST_VERTEX, fragmentShader: DUST_FRAGMENT,
    depthTest: false, depthWrite: false, transparent: true, blending: CustomBlending,
    blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor });
  const dustGeo = (() => {   // glints first, so a smaller draw range keeps them
    const sv = [], q = [], seed = [], kind = [], pos = [];
    for (let i = 0; i < DUST_MAX; i++) {
      sv.push(Math.random()); q.push(Math.random()); seed.push(Math.random());
      kind.push(i < GLINTS ? 1 : 0);
      pos.push(0, 0, 0);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    for (const [name, data] of [['aS', sv], ['aQ', q], ['aSeed', seed], ['aKind', kind]]) g.setAttribute(name, new Float32BufferAttribute(data, 1));
    return g;
  })();
  const dust = new Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dustScene.add(dust);


  const projected = new Vector3();
  const toScreen = (x, y, z = pz.paper) => {       // door px on a plane -> screen-height units (y down)
    projected.set(X(x), Y(y), z).project(camera);
    return [((projected.x + 1) / 2) * (geo.vw / geo.vh), (1 - projected.y) / 2];
  };

  let geo = null, tier = null, lastP = -1, gapScale = 0, gapCx = 0, moteScale = 1;
  return {
    kind: 'webgl',
    plateSource: paperImg,
    // compile every program (incl. the ones only used while opening) without blocking the page
    async warm() {
      for (const m of openingOnly) m.visible = true;
      interior.visible = true;
      const jobs = [[scene, camera], [gapScene, screenCam], [beamScene, screenCam], [dustScene, screenCam]];
      for (const [sc, cam] of jobs) {
        if (renderer.compileAsync) await renderer.compileAsync(sc, cam);
        else renderer.compile(sc, cam);
      }
    },
    layout(g, q) {
      geo = g;
      camera.fov = MathUtils.radToDeg(2 * Math.atan(g.vh / g.s / 2 / g.D));
      camera.aspect = g.vw / g.vh;
      camera.near = g.D * 0.05;
      camera.far = g.D * 6;
      camera.position.set(0, 0, g.D);              // the camera stays put, square to the door
      camera.lookAt(0, 0, 0);
      // cropSill: a lens shift, not a tilt, so the door stays square and the perspective unchanged
      if (g.oy) camera.setViewOffset(g.vw, g.vh, 0, -g.oy, g.vw, g.vh);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      if (q !== tier) {
        tier = q;
        renderer.shadowMap.type = q.softShadows ? PCFSoftShadowMap : PCFShadowMap;
        for (const [light, size] of [[key, q.keyShadow], [sun, [q.sunShadow, q.sunShadow]]]) {
          light.shadow.mapSize.set(...size);
          light.shadow.map?.dispose();
          light.shadow.map = null;
        }
        roomCtx.filter = q.roomBlur && 'filter' in roomCtx ? 'blur(2.5px)' : 'none';
        dustGeo.setDrawRange(0, Math.round(DUST_MAX * q.dust));
      }
      renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr));
      renderer.setSize(g.vw, g.vh, false);
      for (const u of [washiU, gapU, beamU]) renderer.getDrawingBufferSize(u.uRes.value);
      beamU.uPR.value = renderer.getPixelRatio();
      floor.geometry.dispose();
      floor.geometry = floorGeometry(g.D);
      const f = (g.D - pz.front) / g.D;            // panels sit behind the frame: match the photo at rest
      for (const p of Object.values(panels)) p.scale.set(f, f, 1);
      setPlate(g.plate);
      aimSun(g.panes);
      g.panes.forEach((p, i) => roomSun.uniforms.uPanes.value[i].set(X(p.x0), X(p.x1), Y(p.top(p.x0)), p.h));
      // everything screen-space is fixed for a layout (the camera never moves)
      const vol = shaftVolume(g.panes, toScreen);
      beamU.uTL.value.set(...vol.tl);
      beamU.uBL.value.set(...vol.bl);
      beamU.uXL.value = vol.xl;
      beamU.uXR.value = vol.xr;
      gapCx = toScreen(door.seam, 0, pz.front)[0];
      gapScale = Math.abs(toScreen(door.seam + 100, 0, pz.front)[0] - gapCx) / 100;
      gapU.uCx.value = gapCx;
      gapU.uTop.value = toScreen(door.seam, op.top)[1];
      gapU.uBot.value = toScreen(door.seam, op.bottom)[1];
      moteScale = (g.vh * renderer.getPixelRatio()) / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
      lastP = -1;                                  // redraw the shadows
    },
    draw(fs) {
      if (!geo) return;
      const half = geo.travel * fs.p, time = fs.time / 1000;
      panels.left.position.x = -half;
      panels.right.position.x = half;
      if (Math.abs(fs.p - lastP) > 1e-5) {         // the panels moved: their shadows move too
        renderer.shadowMap.needsUpdate = true;
        lastP = fs.p;
      }

      washiU.uTorch.value.set(X(fs.torch.x), Y(fs.torch.y));
      washiU.uTorchR.value = fs.torch.r;
      washiU.uPeek.value = o.peek * fs.torch.a;
      washiU.uGapX.value = half;
      washiU.uGapGlow.value = fs.gapLight;
      washiU.uInk.value = fs.ink;
      washiU.uKage.value.set(fs.kage.x, fs.kage.a, fs.kage.phase, Y(op.bottom));
      // the opening shot: the room's light (ambient, key, the washi's backlight) comes up after the sun
      const room = 0.04 + 0.96 * fs.roomUp;
      ambient.intensity = AMBIENT * Math.PI * room;
      key.intensity = KEY * Math.PI * room;
      for (const m of washiMats) m.emissiveIntensity = room;
      const src = o.interior, sw = src?.videoWidth || src?.naturalWidth || src?.width, sh = src?.videoHeight || src?.naturalHeight || src?.height;
      washiU.uRoomOn.value = sw && sh ? 1 : 0;
      if (sw && sh && washiU.uPeek.value > 0.002) {
        // object-fit: cover, in screen uv (y up; the canvas texture is flipped to match)
        const va = geo.vw / geo.vh, sa = sw / sh;
        const [kx, ky] = sa > va ? [va / sa, 1] : [1, sa / va];
        washiU.uCover.value.set(kx, ky, (1 - kx) / 2, (1 - ky) / 2);
        roomCtx.drawImage(src, -8, -8, roomCanvas.width + 16, roomCanvas.height + 16);   // overscan hides the blur's dark rim
        roomTex.needsUpdate = true;
      }

      const opening = fs.interior > 0.001;
      for (const m of openingOnly) m.visible = opening;
      interior.visible = opening;
      if (opening) {
        bloom.uniforms.uStrength.value = fs.bloom;
        motes.uniforms.uTime.value = time;
        motes.uniforms.uGap.value = half;
        motes.uniforms.uStrength.value = 0.55 * fs.interior;
        motes.uniforms.uScale.value = moteScale;
        interior.intensity = fs.interior * Math.PI * 1.1;
        pool.uniforms.uGap.value = half;
        pool.uniforms.uReach.value = geo.D * 0.12;
        pool.uniforms.uStrength.value = 0.45 * fs.interior;
        // the light gets past the left panel's front edge and the right panel's back edge
        const r = SUN_D[0] / -SUN_D[2];
        roomSun.uniforms.uGap.value.set(-half + r * (pz.front - pz.paper), half - r * (pz.paper - pz.front + pz.thickness));
        roomSun.uniforms.uStrength.value = 0.12 * o.roomSun * (o.sun / 2.6) * fs.beam * fs.sunUp;
      }
      sun.intensity = o.sun * Math.PI * fs.beam * fs.sunUp;

      renderer.render(scene, camera);
      renderer.autoClear = false;
      if (fs.gapLight > 0.002) {
        gapU.uHalf.value = half * gapScale;
        gapU.uI.value = 0.45 * fs.gapLight;
        gapU.uTime.value = time;
        renderer.render(gapScene, screenCam);
      }
      beamU.uTime.value = time;
      beamU.uMotion.value = fs.calm ? 0 : 1;
      beamU.uStir.value = fs.stir;
      if (o.beam > 0 && fs.beam > 0.002) {
        beamU.uI.value = o.beam * fs.beam * fs.sunUp * (1 + 0.6 * fs.stir);   // the stirred air catches more light
        beamU.uShade.value = o.beamShade * Math.min(1, fs.beam);
        renderer.render(beamScene, screenCam);
      }
      if (o.dust > 0 && fs.beam > 0.002) {
        beamU.uDust.value = o.dust * fs.beam * fs.dustUp;
        renderer.render(dustScene, screenCam);
      }
      renderer.autoClear = true;
    },
    dispose() {
      for (const sc of [scene, gapScene, beamScene, dustScene]) sc.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); });
      for (const t of [photo, paperTex, plateTex, roomTex, gobo]) t?.dispose();
      for (const l of [key, sun]) l.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();               // hand the GPU context back (mobile browsers cap them)
    },
  };
}
