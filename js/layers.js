// The seven strata and the pixel work that produces them.
//
// Every sheet is generated in the browser from the museum's photograph of the
// painting. They are analogies for the stages of making a painting, not scans:
// each one isolates the kind of information a stage contributes.

const MAX_SIDE = 900;

// Back (index 0) to front (index 6).
export const LAYERS = [
  {
    key: "support",
    name: "Support",
    short: "The physical object: cloth, wood or wall.",
    tool: "Thread counting · tree-ring dating",
    sub: (p) => ({ canvas: "Woven canvas", panel: "Wood panel", paper: "Paper or board", silk: "Silk", plaster: "Clay & plaster wall" })[p.support],
    body: (p) =>
      p.support === "panel"
        ? "Before canvas, most European painting was done on wood: oak in the north, poplar in Italy. Planks were glued, planed and sometimes cradled. Everything above depends on this object, which shrinks and swells with the seasons."
        : p.support === "canvas"
        ? "From the 1500s, stretched linen made larger, lighter pictures possible. The weave stays: it shows through thin paint and holds the ground in its ridges."
        : "The physical object that carries the image. Its texture, absorbency and stiffness set limits on everything the painter does next.",
    instr: (p) =>
      p.support === "panel"
        ? "<b>Dendrochronology.</b> Matching the growth rings of an oak panel to a reference chronology dates the felling of the tree, and so the earliest possible date for the painting."
        : "<b>Thread counting.</b> Canvas density measured in X-radiographs can show that two pictures were cut from the same bolt. Thread counting has been used to date and authenticate Van Gogh's canvases.",
    how: "Procedural texture chosen from the medium line in the API record.",
  },
  {
    key: "ground",
    name: "Ground",
    short: "A primer that seals the support and sets the tone.",
    tool: "Cross-sections",
    sub: (p) => groundFor(p).label,
    body: (p) =>
      `A layer of glue size and then a ground seals the support and gives the paint something to hold. Its colour sets the temperature of every layer above. ${groundFor(p).why}`,
    instr: () =>
      "<b>Cross-sections.</b> A sample smaller than a pinhead is set in resin, cut and polished. Under the microscope the ground is the band at the bottom of the paint stack.",
    how: "A typical ground for the painting's date and support. A reconstruction, not a measurement.",
  },
  {
    key: "drawing",
    name: "Underdrawing",
    short: "The composition, sketched in carbon.",
    tool: "Infrared reflectography",
    sub: () => "Contours & hatching",
    body: () =>
      "Contours, then hatching for the shadows, in charcoal, chalk or thin dark paint. Painters often changed their minds. Those revisions are called <i>pentimenti</i>, from the Italian for \"repentances\".",
    instr: () =>
      "<b>Infrared reflectography (IRR).</b> Many pigments become transparent in the near infrared, but carbon absorbs it, so the drawing shows through. J. R. J. van Asperen de Boer developed the method in the late 1960s.",
    how: "Edges found with a Sobel filter on luminance, with hatching added in the deepest shadows.",
  },
  {
    key: "value",
    name: "Dead colouring",
    short: "Light and shadow, blocked in monochrome.",
    tool: "X-radiography",
    sub: () => "Light & shadow in monochrome",
    body: () =>
      "Old masters often modelled the whole design in browns and greys first, a grisaille or <i>dead colouring</i>. This fixed the chiaroscuro, the fall of light and shadow, before any colour went on.",
    instr: () =>
      "<b>X-radiography.</b> Lead white blocks X-rays, so an X-ray reads like a map of a painting's lights and reveals compositions painted over. The Fogg Museum began X-raying paintings systematically in the 1920s.",
    how: "Luminance, blurred and posterised into five tonal steps, then tinted umber.",
  },
  {
    key: "colour",
    name: "Colour lay-in",
    short: "Flat fields of local colour.",
    tool: "X-ray fluorescence",
    sub: (p) => `${p.colors.length} measured colours`,
    body: () =>
      "Local colour is laid into each zone as flat, opaque fields: the blue of a coat, the green of a wall. Here every pixel snaps to the nearest colour in the palette the museum's API measured for this painting.",
    instr: () =>
      "<b>X-ray fluorescence (XRF).</b> This finds elements without taking a sample: mercury means vermilion, copper means a green or azurite, lead means lead white. Harvard's Forbes Pigment Collection holds more than 2,500 reference pigments for comparison.",
    how: "Blurred image quantised to the API's <code>colors</code> palette for this object.",
  },
  {
    key: "glaze",
    name: "Glazes & highlights",
    short: "Translucent films and thick highlights.",
    tool: "Raking light",
    sub: () => "Translucent films, impasto",
    body: () =>
      "Last come thin, translucent glazes that deepen shadows and saturate colour, and thick touches of impasto for the highlights. Light passes through a glaze, reflects off the layers below and comes back tinted. This is where oil painting gets its glow.",
    instr: () =>
      "<b>Raking light & stereomicroscopy.</b> Light skimming across the surface throws impasto, brush direction and tool marks into relief.",
    how: "High-pass detail (the image minus a blurred copy) plus the brightest lights.",
  },
  {
    key: "surface",
    name: "Varnish & surface",
    short: "The picture as we see it, under varnish.",
    tool: "Ultraviolet fluorescence",
    sub: () => "The picture as we see it",
    body: () =>
      "A clear resin varnish saturates the colours and protects the paint. Natural varnishes yellow over decades, which is why cleaning a painting can change it so much. This top sheet is the museum's photograph.",
    instr: () =>
      "<b>Ultraviolet fluorescence.</b> Aged natural varnish glows a milky green under UV, while later retouching shows up as dark patches on top of it.",
    how: "The Harvard Art Museums photograph, unaltered.",
  },
];

export function groundFor(p) {
  const y = p.year || 1800;
  if (p.support === "plaster") return { rgb: [214, 200, 178], label: "Lime & clay", why: "Wall paintings go onto a smoothed layer of fine clay or lime." };
  if (y < 1550) return { rgb: [242, 238, 226], label: "White gesso", why: "Early Italian and Netherlandish panels were primed with bright white gesso of chalk or gypsum, which shines back through the paint." };
  if (y < 1800) return { rgb: [146, 86, 58], label: "Red-brown imprimatura", why: "From Venice on, Baroque painters often primed in warm red-brown or grey, working up the lights and letting the ground act as the middle tone." };
  if (y < 1860) return { rgb: [196, 182, 156], label: "Buff / grey priming", why: "Academic painters of the early 19th century often bought canvases ready-primed in muted buff or grey." };
  return { rgb: [236, 231, 219], label: "Off-white priming", why: "The Impressionists and their followers preferred pale grounds that kept colour bright and luminous." };
}

export function imageUrl(p, side = MAX_SIDE) {
  const tall = (p.height || 1) >= (p.width || 1);
  return `${p.image}?${tall ? "height" : "width"}=${side}`;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = url;
  });
}

// Yield to the browser between strata so the loader keeps animating.
// A MessageChannel task is not throttled the way setTimeout is in background tabs.
const channel = new MessageChannel();
const waiting = [];
channel.port1.onmessage = () => waiting.shift()?.();
const tick = () => new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });

// ---------- small image helpers ----------

// Two passes of a separable box blur (close to a gaussian), with clamped edges.
// Uses two scratch buffers and no per-pixel Math.min/max: this is the hottest
// loop in the dissection.
function boxBlur(src, w, h, r) {
  const n = w * h, inv = 1 / (2 * r + 1);
  const tmp = new Float32Array(n), out = new Float32Array(n);
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w, last = row + w - 1;
      let acc = a[row] * (r + 1);
      for (let x = 1; x <= r; x++) acc += a[x < w ? row + x : last];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc * inv;
        const add = x + r + 1 < w ? a[row + x + r + 1] : a[last];
        const sub = x - r > 0 ? a[row + x - r] : a[row];
        acc += add - sub;
      }
    }
    for (let x = 0; x < w; x++) {
      const lastY = (h - 1) * w + x;
      let acc = tmp[x] * (r + 1);
      for (let y = 1; y <= r; y++) acc += tmp[y < h ? y * w + x : lastY];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc * inv;
        const add = y + r + 1 < h ? tmp[(y + r + 1) * w + x] : tmp[lastY];
        const sub = y - r > 0 ? tmp[(y - r) * w + x] : tmp[x];
        acc += add - sub;
      }
    }
    a = out;
  }
  return out;
}

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function put(w, h, fill) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  return c;
}

// Draw a small canvas up to full size. Used for strata that carry only
// low-frequency information, which are computed at half resolution.
function upscale(src, w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

// 2x2 box downsample of a channel.
function half(src, w, h) {
  const w2 = w >> 1, h2 = h >> 1;
  const out = new Float32Array(w2 * h2);
  for (let y = 0; y < h2; y++) {
    const r0 = 2 * y * w, r1 = r0 + w;
    for (let x = 0; x < w2; x++) {
      const i = 2 * x;
      out[y * w2 + x] = (src[r0 + i] + src[r0 + i + 1] + src[r1 + i] + src[r1 + i + 1]) * 0.25;
    }
  }
  return out;
}

// ---------- the strata ----------

// The canvas weave is periodic, so one tile is generated once and repeated.
let weaveTile = null;
function weave() {
  if (weaveTile) return weaveTile;
  const T = 256, t = 4;
  return (weaveTile = put(T, T, (d) => {
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const over = (((x / t) | 0) + ((y / t) | 0)) & 1;
        const along = over ? (y % t) / t : (x % t) / t;
        const s = 0.8 + 0.14 * Math.sin(along * Math.PI) + (valueNoise(x * 0.3, y * 0.02) - 0.5) * 0.12 + (hash(x, y) - 0.5) * 0.05;
        const i = (y * T + x) * 4;
        d[i] = 200 * s; d[i + 1] = 184 * s; d[i + 2] = 150 * s; d[i + 3] = 255;
      }
    }
  }));
}

function supportSheet(p, w, h) {
  if (p.support === "canvas") {
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.fillStyle = ctx.createPattern(weave(), "repeat");
    ctx.fillRect(0, 0, w, h);
    return c;
  }
  // Wood grain, paper and plaster are low-frequency: half resolution is enough.
  const w2 = Math.ceil(w / 2), h2 = Math.ceil(h / 2);
  const tone = p.support === "panel" ? [164, 118, 74] : p.support === "plaster" ? [206, 194, 176] : [226, 216, 196];
  return upscale(put(w2, h2, (d) => {
    for (let y = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++) {
        const X = x * 2, Y = y * 2;
        const s = p.support === "panel"
          ? 0.78 + 0.16 * Math.sin((X + valueNoise(X * 0.01, Y * 0.002) * 30) * 0.22 + valueNoise(X * 0.05, Y * 0.01) * 4) + (hash(x, y) - 0.5) * 0.06
          : 0.86 + (valueNoise(X * 0.08, Y * 0.08) - 0.5) * 0.14 + (hash(x, y) - 0.5) * 0.06;
        const i = (y * w2 + x) * 4;
        d[i] = tone[0] * s; d[i + 1] = tone[1] * s; d[i + 2] = tone[2] * s; d[i + 3] = 255;
      }
    }
  }), w, h);
}

function groundSheet(p, w, h) {
  const [gr, gg, gb] = groundFor(p).rgb;
  const w2 = Math.ceil(w / 2), h2 = Math.ceil(h / 2);
  return upscale(put(w2, h2, (d) => {
    for (let y = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++) {
        const X = x * 2, Y = y * 2;
        // Broad horizontal brush sweeps.
        const sweep = valueNoise(X * 0.004, Y * 0.045) * 0.6 + valueNoise(X * 0.02, Y * 0.2) * 0.4;
        const k = 0.92 + (sweep - 0.5) * 0.16;
        const i = (y * w2 + x) * 4;
        d[i] = gr * k; d[i + 1] = gg * k; d[i + 2] = gb * k;
        d[i + 3] = 170 + sweep * 70;
      }
    }
  }), w, h);
}

function drawingSheet(L, w, h) {
  const Lb = boxBlur(L, w, h, 1);
  const G = new Float32Array(w * h);
  const sample = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -Lb[i - w - 1] - 2 * Lb[i - 1] - Lb[i + w - 1] + Lb[i - w + 1] + 2 * Lb[i + 1] + Lb[i + w + 1];
      const gy = -Lb[i - w - 1] - 2 * Lb[i - w] - Lb[i - w + 1] + Lb[i + w - 1] + 2 * Lb[i + w] + Lb[i + w + 1];
      G[i] = Math.sqrt(gx * gx + gy * gy);
      if ((i & 63) === 0) sample.push(G[i]);
    }
  }
  sample.sort((a, b) => a - b);
  const p92 = sample[Math.floor(sample.length * 0.92)] || 1;
  const Ls = boxBlur(L, w, h, 4);
  return put(w, h, (d) => {
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
      let a = smooth(0.35, 1.1, G[i] / p92);
      // Diagonal hatching in deep shadow, the way a draughtsman would model it.
      const dark = 1 - Ls[i] / 255;
      if (dark > 0.55 && (x + y) % 6 === 0) a = Math.max(a, smooth(0.55, 0.85, dark) * 0.55);
      if (dark > 0.75 && (x - y + 1000) % 6 === 0) a = Math.max(a, smooth(0.75, 0.95, dark) * 0.45);
      const o = i * 4;
      d[o] = 22; d[o + 1] = 19; d[o + 2] = 17;
      d[o + 3] = a * 235;
    }
  });
}

// Computed on half-resolution channels (see run): the result is blurred and
// posterised anyway, so the upscale is invisible and the work is a quarter.
function valueSheet(L, w, h) {
  const Lb = boxBlur(L, w, h, 2);
  const dark = [44, 32, 24], light = [236, 226, 204];
  return put(w, h, (d) => {
    for (let i = 0; i < w * h; i++) {
      const q = Math.round((Lb[i] / 255) * 4) / 4;
      const o = i * 4;
      d[o] = dark[0] + (light[0] - dark[0]) * q;
      d[o + 1] = dark[1] + (light[1] - dark[1]) * q;
      d[o + 2] = dark[2] + (light[2] - dark[2]) * q;
      d[o + 3] = 214;
    }
  });
}

function colourSheet(R, G, B, w, h, palette) {
  const r = boxBlur(R, w, h, 3), g = boxBlur(G, w, h, 3), b = boxBlur(B, w, h, 3);
  const pal = palette.length ? palette.map((c) => hexToRgb(c.hex)) : [[128, 128, 128]];
  return put(w, h, (d) => {
    for (let i = 0; i < w * h; i++) {
      let best = 0, bestD = Infinity;
      for (let k = 0; k < pal.length; k++) {
        // Weighted RGB distance ("redmean"), cheap but perceptually saner than plain RGB.
        const rm = (r[i] + pal[k][0]) / 2;
        const dr = r[i] - pal[k][0], dg = g[i] - pal[k][1], db = b[i] - pal[k][2];
        const dist = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
        if (dist < bestD) { bestD = dist; best = k; }
      }
      const o = i * 4;
      d[o] = pal[best][0]; d[o + 1] = pal[best][1]; d[o + 2] = pal[best][2];
      d[o + 3] = 222;
    }
  });
}

function glazeSheet(R, G, B, L, w, h) {
  const rb = boxBlur(R, w, h, 4), gb = boxBlur(G, w, h, 4), bb = boxBlur(B, w, h, 4);
  return put(w, h, (d) => {
    for (let i = 0; i < w * h; i++) {
      const dr = R[i] - rb[i], dg = G[i] - gb[i], db = B[i] - bb[i];
      const mag = (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
      const hi = smooth(205, 245, L[i]);
      const o = i * 4;
      d[o] = Math.min(255, R[i] + dr * 1.2 + hi * 40);
      d[o + 1] = Math.min(255, G[i] + dg * 1.2 + hi * 40);
      d[o + 2] = Math.min(255, B[i] + db * 1.2 + hi * 40);
      d[o + 3] = Math.min(255, Math.max(smooth(4, 26, mag) * 230, hi * 240));
    }
  });
}

// A scaled copy of a sheet, for when the same strata appear in more than one
// place at once (a canvas element can only live in one spot in the DOM).
export function copySheet(src, maxSide = 640) {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = makeCanvas(Math.round(src.width * s), Math.round(src.height * s));
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  c.setAttribute("aria-hidden", "true");
  return c;
}

// Each dissection holds seven ~900px canvases (~17 MB), so only the most
// recently used few are kept. A Map iterates in insertion order, which makes
// it a small LRU: re-inserting on use moves an entry to the back.
const cache = new Map();
const CACHE_SIZE = 4;

// Returns a promise of { w, h, sheets: { key: canvas } }. The promise is
// cached, so concurrent callers share one dissection; failures are not cached.
export function dissect(p, onProgress = () => {}) {
  let job = cache.get(p.id);
  if (job) {
    cache.delete(p.id);
  } else {
    job = run(p, onProgress);
    job.catch(() => cache.get(p.id) === job && cache.delete(p.id));
  }
  cache.set(p.id, job);
  while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
  return job;
}

async function run(p, onProgress) {
  onProgress(0, "Fetching photograph");
  const image = await loadImage(imageUrl(p));
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.round(image.naturalWidth * scale), h = Math.round(image.naturalHeight * scale);

  const base = makeCanvas(w, h);
  const bctx = base.getContext("2d", { willReadFrequently: true });
  bctx.drawImage(image, 0, 0, w, h);
  const px = bctx.getImageData(0, 0, w, h).data;
  const R = new Float32Array(w * h), G = new Float32Array(w * h), B = new Float32Array(w * h), L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    R[i] = px[i * 4]; G[i] = px[i * 4 + 1]; B[i] = px[i * 4 + 2];
    L[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  }
  const w2 = w >> 1, h2 = h >> 1;
  const [Rh, Gh, Bh, Lh] = [R, G, B, L].map((c) => half(c, w, h));

  const steps = [
    ["support", () => supportSheet(p, w, h)],
    ["ground", () => groundSheet(p, w, h)],
    ["drawing", () => drawingSheet(L, w, h)],
    ["value", () => upscale(valueSheet(Lh, w2, h2), w, h)],
    ["colour", () => upscale(colourSheet(Rh, Gh, Bh, w2, h2, p.colors), w, h)],
    ["glaze", () => glazeSheet(R, G, B, L, w, h)],
    ["surface", () => base],
  ];
  const sheets = {};
  for (let s = 0; s < steps.length; s++) {
    const [key, make] = steps[s];
    onProgress((s + 1) / steps.length, `Separating ${LAYERS[s].name.toLowerCase()}`);
    await tick();
    sheets[key] = make();
  }
  return { w, h, sheets };
}
