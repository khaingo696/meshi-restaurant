// Geometry, light and defaults of the Meshi door intro. Everything tunable lives here.

// Geometry of assets/meshi-door.*, in source pixels. World units are source
// pixels too: x = 0 at the seam, y = 0 at the image's vertical centre, z toward the viewer.
export const DOOR = {
  src: ['meshi-door.webp', 'meshi-door.png'],   // first that decodes wins (relative to `assets`)
  width: 2216,
  height: 709,
  // the doorway the two sliding panels fill (inside posts, header and sill)
  opening: { left: 164, right: 2056, top: 25, bottom: 670 },
  seam: 1108,                             // gap between the two meeting stiles
  stiles: { left: 1084, right: 1131 },    // both meeting stiles together
  posts: { left: [109, 161], right: [2059, 2107] },
  paper: { top: 38, bottom: 647 },        // shoji paper rows
  paperX: { left: [183, 1084], right: [1132, 2039] },
  // kumiko lattice bars [start, end) including their anti-aliased edges
  kumiko: {
    v: [[279, 287], [379, 386], [478, 484], [578, 584], [677, 683], [778, 783], [878, 883], [978, 984],
      [1232, 1237], [1333, 1338], [1433, 1439], [1533, 1539], [1633, 1639], [1735, 1741], [1836, 1842], [1936, 1943]],
    h: [[194, 199], [353, 359], [499, 505]],
  },
  // photo strips reused as wood for faces the photo doesn't show, [front, back]
  wood: { cols: [1090, 1102], rows: [27, 36], postCols: [155, 115] },
  edgeStrip: { left: 1085, right: 1110 }, // (2D renderer) stile columns for the side faces
  jambs: { left: [150, 110], right: [2066, 2106], header: [22, 11], sill: [672, 700] },
  // depths (z) of the 3D door
  frameDepth: 8,                          // posts and beam stand proud of the wall
  panel: { front: -4, thickness: 22, kumikoFront: -7, kumikoDepth: 10, paper: -17.5 },
  thickness: 20,                          // (2D renderer) panel thickness
  recess: 2,                              // (2D renderer) panels behind the frame face
  jambDepth: 40,
  overlap: 6,                             // panel hidden under the frame on the outer sides
};

// assets/meshi-logo.*, printed on the washi and split "ME | SHI" around the meeting stiles.
export const LOGO = {
  src: ['meshi-logo.webp', 'meshi-logo.png'],
  width: 593,
  height: 421,
  center: 296.5,
  emblem: { y0: 0, y1: 252 },
  rows: [
    // MESHI -> "ME" | "SHI"
    { y0: 286, y1: 379, left: [84, 274], right: [295, 507] },
    // "Traditional Asian" | "Cuisine & Premium Sushi"
    { y0: 397, y1: 413, left: [83, 246], right: [254, 499] },
  ],
  letterGap: 11, // half the wordmark's letter spacing, kept between letters and stiles
};

// Late sun through a high window, out of frame to the top-left. It is designed
// where it lands: a few panes of light on the door, parallelograms with
// vertical sides and tops / bottoms slanted along the sun (how window light
// falls on a wall).
export const SUN = {
  dir: [0.66, -0.52, -0.54],                  // world (x right, y up, z to the viewer): from the sun into the room
  panes: [[0, 105], [129, 234], [258, 287]],  // x offsets of the panes (door px at full size): two panes and a slit
  top: 70, height: 270,                       // below the top of the paper, door px at full size
  color: [1.0, 0.66, 0.38],                   // amber
};

// Rendering quality tiers. 'auto' picks one from the device and steps down at
// runtime if frames run long.
export const QUALITY = {
  high:   { name: 'high',   dpr: 2,   keyShadow: [4096, 2048], sunShadow: 2048, softShadows: true,  plate: 3,   roomBlur: true,  dust: 1,   idleFps: 60 },
  medium: { name: 'medium', dpr: 1.5, keyShadow: [2048, 1024], sunShadow: 1024, softShadows: true,  plate: 2,   roomBlur: false, dust: 0.7, idleFps: 60 },
  low:    { name: 'low',    dpr: 1,   keyShadow: [1024, 512],  sunShadow: 512,  softShadows: false, plate: 1.5,  roomBlur: false, dust: 0.45, idleFps: 30 },
};

export const DEFAULTS = {
  door: DOOR,
  logo: LOGO,           // null to disable the logo
  assets: null,         // base URL of the door / logo images (default: ./assets/ next to this module)
  renderer: 'auto',     // 'auto' | 'webgl' | '2d'
  quality: 'auto',      // 'auto' | 'high' | 'medium' | 'low'
  interior: null,       // what is behind the door (video / image / canvas), seen through the paper under the torch

  // timeline (click / key / drag release)
  duration: 1450,       // total ms, including the fade into the page
  slideDuration: 1400,  // the panels are still moving when the fade takes them: they never crawl to a stop on screen
  exitStart: 900,       // when the scene starts fading out (the light goes a beat earlier)
  reducedDuration: 400, // prefers-reduced-motion: a short fade instead
  cameraDistance: 1.25, // camera distance as a multiple of the visible door height (lower = stronger perspective)

  // light
  exposure: 0.9,        // low-key: the whole door sits a little below the photo so the sun reads
  sun: 2.6,             // the patch of late sun on the door (0 = off)
  beam: 0.15,           // the same sunlight seen in the air: one hazy volume (0 = off)
  dust: 0.6,            // dust and glints drifting in that light (0 = off)
  beamShade: 0.06,      // extra shadow around the shaft
  gapLight: 1,          // warm room light leaking through the gap as the door parts (0 = off)
  roomSun: 1,           // the sun that gets through the opening gap, soft on the room's floor (relative; 0 = off)
  colors: { goldTop: '#e2c287', goldMid: '#c09450', goldBottom: '#9a6d31', light: '#ffd29a', mote: '#ffe9cf' },

  // pointer: a torch held to the door
  peek: 0.9,            // how strongly the room behind shows through the washi (0 = off)
  peekColor: 0,         // how much of the room's colour reaches the paper (0 = light and shadow only)
  peekWarm: 0.2,        // warms the see-through light toward the sun (0 = the paper's own tone)
  torchRadius: 0.2,     // torch size, fraction of the shorter screen side
  hoverOpen: 0.012,     // how far the panels part on hover (fraction of their travel)

  // drag / scroll: a heavy door on a rail
  dragOpen: 0.28,       // drag released past this fraction (or flicked) -> opens
  scrollSteps: [0.065, 0.22],   // where each push leaves the door; the push after the last one throws it open
  scrollSettle: 6.5,    // how the door answers a push: higher = snappier
  scrollReturn: 0.9,    // left alone, it creeps back a little: lower = slower; 0 = it stays
  scrollReturnAmount: 0.35, // ...giving back this share of its opening (1 = all the way shut)
  scrollReturnDelay: 0, // extra ms to rest at the top of a push before creeping back
  momentum: 1100,       // ms for the final shove: a short build-up, a fast run, friction into the pocket

  // cinema
  intro: 1400,           // ms of the opening: the door, left ajar, slides shut while the room comes up to full light (0 = none)
  inkSpread: false,      // the logo soaks into the paper during the opening (rejected look; off)
  introCrack: 0.05,     // how far the door is ajar when the page appears (fraction of its travel)
  introDim: 0.55,       // how much of the light is already there when the opening starts
  stir: true,           // the sliding panels stir the dust in the sunlight
  rackFocus: 8,         // px of blur on the room behind as the door parts, pulled into focus as it opens (0 = off)
  letterbox: 0,       // cinema bars on wide screens with a mouse, as this aspect ratio; they draw back as it opens (0 = off)
  kage: false,           // now and then a figure passes behind the washi, a soft shadow on the paper (3D only)
  sound: false,          // procedural sound: the rail, the knock, the room (after the visitor's first click / tap / key)

  // page
  cropSill: true,       // sit the door lower so the sill and floor below it are off screen (false: centred)
  lockScroll: true,     // keep the page from scrolling until the door has opened
  autoOpen: false,      // ms after load to open by itself, or false to wait for the visitor
  grain: true,          // film grain + vignette over the scene
  hint: null,           // [line 1, line 2] under the door, or null
  label: 'Open the entrance',

  // development
  debugTime: null,      // freeze the opening at this ms (screenshots)
  debugPointer: null,   // { x, y } in -1..1: freeze the pointer there (screenshots)
};
