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
    how: "The weave or grain implied by the medium line in the API record, as a faint tinted filter.",
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
    how: "A typical ground tint for the painting's date and support (a reconstruction, not a measurement), as a light filter.",
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
    how: "Grey density along edges found with a Sobel filter, with hatching in the deepest shadows.",
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
    how: "Grey density from the blurred lights and shadows, in five tonal steps.",
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
    how: "A colour-only filter: each zone takes the hue of the nearest colour in the API's <code>colors</code> palette, with its brightness removed.",
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
    how: "Whatever light the other six sheets have not already filtered: fine detail, deep shadow and the last touches of colour.",
  },
  {
    key: "surface",
    name: "Varnish & surface",
    short: "A thin, clear skin that saturates everything beneath.",
    tool: "Ultraviolet fluorescence",
    sub: () => "Nearly clear resin film",
    body: () =>
      "A clear resin varnish saturates the colours and protects the paint. Natural varnishes yellow over decades, which is why cleaning a painting can change it so much. Here it is a nearly clear amber film: the picture exists only where the light lands.",
    instr: () =>
      "<b>Ultraviolet fluorescence.</b> Aged natural varnish glows a milky green under UV, while later retouching shows up as dark patches on top of it.",
    how: "A thin amber tint, slightly uneven where resin pooled, with a gloss highlight. Nearly clear.",
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

// ---------- strata as light filters ----------
//
// Each sheet is a filter: it lets through a fraction T of the light in each
// colour channel. Stacked filters multiply (T1 x T2 x ...), so in optical
// density D = -ln T they add. The photograph's density is shared out among
// the seven sheets, back to front, each taking only what it is "meant" to
// hold and never more than is left. Whatever remains goes to the glazes. With
// all seven in the beam, lamp light x every filter = the painting; with any
// one removed, the wall shows what that stratum contributed.

const I_MIN = 0.02; // darkest transmittance a sheet stack may reach
const EXP_STEPS = 1024; // density lookup resolution per unit
const EXP_MAX = 5;
const EXP_LUT = new Float32Array(EXP_STEPS * EXP_MAX + 1).map((_, i) => Math.exp(-i / EXP_STEPS));
const DENSITY_LUT = new Float32Array(256).map((_, v) => -Math.log(Math.max(v / 255, I_MIN)));
const transmit = (d) => EXP_LUT[Math.min(EXP_STEPS * EXP_MAX, (d * EXP_STEPS) | 0)];

// Edge strength (0..1) for the underdrawing, with hatching in deep shadow.
function drawingAlpha(L, w, h) {
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
  const A = new Float32Array(w * h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    let a = smooth(0.35, 1.1, G[i] / p92);
    const dark = 1 - Ls[i] / 255;
    if (dark > 0.55 && (x + y) % 6 === 0) a = Math.max(a, smooth(0.55, 0.85, dark) * 0.55);
    if (dark > 0.75 && (x - y + 1000) % 6 === 0) a = Math.max(a, smooth(0.75, 0.95, dark) * 0.45);
    A[i] = a;
  }
  return A;
}

// Take density from what remains. `want(i, out)` writes the desired density
// per channel; neutral sheets take the same amount from every channel so
// they stay grey. Returns the sheet's transmittance as RGB bytes.
function take(rem, n, want, neutral = false) {
  const T = new Uint8ClampedArray(n * 3);
  const d = [0, 0, 0];
  const [r0, r1, r2] = rem;
  for (let i = 0; i < n; i++) {
    want(i, d);
    let a, b, c;
    if (neutral) {
      a = b = c = Math.max(0, Math.min(d[0], r0[i], r1[i], r2[i]));
    } else {
      a = Math.max(0, Math.min(d[0], r0[i]));
      b = Math.max(0, Math.min(d[1], r1[i]));
      c = Math.max(0, Math.min(d[2], r2[i]));
    }
    r0[i] -= a; r1[i] -= b; r2[i] -= c;
    const o = i * 3;
    T[o] = 255 * transmit(a); T[o + 1] = 255 * transmit(b); T[o + 2] = 255 * transmit(c);
  }
  return T;
}

// How a filter looks as a sheet of film in the dark room: its colour where it
// is dense, nearly invisible where it is clear.
function filmCanvas(T, w, h, sheen = false) {
  const c = put(w, h, (d) => {
    for (let i = 0, n = w * h; i < n; i++) {
      const o = i * 3, q = i * 4;
      const t = (T[o] + T[o + 1] + T[o + 2]) / 765;
      const chroma = Math.max(T[o], T[o + 1], T[o + 2]) - Math.min(T[o], T[o + 1], T[o + 2]);
      d[q] = T[o]; d[q + 1] = T[o + 1]; d[q + 2] = T[o + 2];
      d[q + 3] = Math.min(240, 255 * (1 - t) * 1.5 + chroma * 0.9 + 6);
    }
  });
  if (sheen) {
    // Varnish: a soft specular streak across a nearly clear film.
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0.18, "rgba(255,250,235,0)");
    g.addColorStop(0.3, "rgba(255,250,235,0.16)");
    g.addColorStop(0.36, "rgba(255,250,235,0.04)");
    g.addColorStop(0.5, "rgba(255,250,235,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

// The same filter on a lightbox: opaque, as it would look backlit on white.
export function filterCanvas(r, key, maxSide = Infinity) {
  const T = r.filters[key];
  const full = put(r.w, r.h, (d) => {
    for (let i = 0, n = r.w * r.h; i < n; i++) {
      d[i * 4] = T[i * 3]; d[i * 4 + 1] = T[i * 3 + 1]; d[i * 4 + 2] = T[i * 3 + 2]; d[i * 4 + 3] = 255;
    }
  });
  return maxSide < Math.max(r.w, r.h) ? copySheet(full, maxSide) : full;
}

// Lamp light through the chosen filters: the per-channel product of their
// transmittances. Draws into `target` (resized to fit) or a new canvas.
export function project(r, keys, target = makeCanvas(r.w, r.h)) {
  target.width = r.w;
  target.height = r.h;
  const ctx = target.getContext("2d");
  const img = ctx.createImageData(r.w, r.h);
  const d = img.data, fs = keys.map((k) => r.filters[k]), n = r.w * r.h;
  for (let i = 0; i < n; i++) {
    let a = 255, b = 255, c = 255;
    for (const T of fs) { a = (a * T[i * 3]) / 255; b = (b * T[i * 3 + 1]) / 255; c = (c * T[i * 3 + 2]) / 255; }
    d[i * 4] = a; d[i * 4 + 1] = b; d[i * 4 + 2] = c; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return target;
}

function pixels(canvas) {
  return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
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

// Each dissection holds ~35 MB of canvases and filters, so only the most
// recently used few are kept. A Map iterates in insertion order, which makes
// it a small LRU: re-inserting on use moves an entry to the back.
const cache = new Map();
const CACHE_SIZE = 3;

// Returns a promise of { w, h, sheets, filters, photo, product }:
//   sheets   key -> canvas, the film as it appears in the 3D room
//   filters  key -> RGB transmittance bytes
//   photo    the museum photograph; product: all filters multiplied
// The promise is cached, so concurrent callers share one dissection.
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
  const n = w * h;

  const photo = makeCanvas(w, h);
  const pctx = photo.getContext("2d", { willReadFrequently: true });
  pctx.drawImage(image, 0, 0, w, h);
  const px = pctx.getImageData(0, 0, w, h).data;
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), L = new Float32Array(n);
  const rem = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    R[i] = px[i * 4]; G[i] = px[i * 4 + 1]; B[i] = px[i * 4 + 2];
    L[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
    rem[0][i] = DENSITY_LUT[px[i * 4]]; rem[1][i] = DENSITY_LUT[px[i * 4 + 1]]; rem[2][i] = DENSITY_LUT[px[i * 4 + 2]];
  }

  const filters = {};
  let done = 0;
  const step = async (k, label, make) => {
    onProgress(done++ / 7, `Separating ${label}`);
    await tick();
    filters[LAYERS[k].key] = make();
  };

  // Support: its weave or grain as a faint tinted filter.
  await step(0, "support", () => {
    const tex = pixels(supportSheet(p, w, h));
    return take(rem, n, (i, d) => { for (let c = 0; c < 3; c++) d[c] = -Math.log(1 - (1 - tex[i * 4 + c] / 255) * 0.24); });
  });
  // Ground: the priming tint, strongest where the brush laid it thickest.
  await step(1, "ground", () => {
    const g = pixels(groundSheet(p, w, h));
    return take(rem, n, (i, d) => {
      const k = 0.34 * (g[i * 4 + 3] / 255);
      for (let c = 0; c < 3; c++) d[c] = -Math.log(1 - (1 - g[i * 4 + c] / 255) * k);
    });
  });
  // Varnish is allocated early so its thin amber tint is always available,
  // but it sits at the front of the stack.
  await step(6, "varnish", () => take(rem, n, (i, d) => {
    const pool = 0.8 + 0.4 * valueNoise((i % w) * 0.006, ((i / w) | 0) * 0.006);
    d[0] = 0.012 * pool; d[1] = 0.03 * pool; d[2] = 0.08 * pool;
  }));
  // Underdrawing: neutral grey density along contours and in hatching.
  await step(2, "underdrawing", () => {
    const A = drawingAlpha(L, w, h);
    return take(rem, n, (i, d) => (d[0] = A[i] * 1.1), true);
  });
  // Dead colouring: neutral density of the blurred tones, in five steps.
  await step(3, "dead colouring", () => {
    const Lb = boxBlur(L, w, h, 4);
    return take(rem, n, (i, d) => (d[0] = Math.round(DENSITY_LUT[Lb[i] | 0] / 0.42) * 0.42 * 0.8), true);
  });
  // Colour lay-in: the hue of the nearest measured palette colour, with its
  // brightness removed, so this sheet carries colour and nothing else.
  await step(4, "colour lay-in", () => {
    const w2 = w >> 1, h2 = h >> 1;
    const [r, g, b] = [R, G, B].map((ch) => boxBlur(half(ch, w, h), w2, h2, 3));
    const pal = (p.colors.length ? p.colors.map((c) => hexToRgb(c.hex)) : [[128, 128, 128]]).map((c) => {
      const m = Math.max(...c, 1);
      return c.map((v) => -Math.log(Math.max(v / m, 0.08)) * 0.9);
    });
    const raw = p.colors.length ? p.colors.map((c) => hexToRgb(c.hex)) : [[128, 128, 128]];
    const idx = new Uint8Array(w2 * h2);
    for (let i = 0; i < w2 * h2; i++) {
      let best = 0, bestD = Infinity;
      for (let k = 0; k < raw.length; k++) {
        const rm = (r[i] + raw[k][0]) / 2;
        const dr = r[i] - raw[k][0], dg = g[i] - raw[k][1], db = b[i] - raw[k][2];
        const dist = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
        if (dist < bestD) { bestD = dist; best = k; }
      }
      idx[i] = best;
    }
    return take(rem, n, (i, d) => {
      const x = Math.min(w2 - 1, (i % w) >> 1), y = Math.min(h2 - 1, ((i / w) | 0) >> 1);
      const c = pal[idx[y * w2 + x]];
      d[0] = c[0]; d[1] = c[1]; d[2] = c[2];
    });
  });
  // Glazes: everything the other sheets have not absorbed (the fine detail,
  // deep shadows and last touches of colour).
  await step(5, "glazes", () => take(rem, n, (i, d) => { d[0] = rem[0][i]; d[1] = rem[1][i]; d[2] = rem[2][i]; }));

  onProgress(1, "Assembling");
  await tick();
  const sheets = {};
  for (const L_ of LAYERS) sheets[L_.key] = filmCanvas(filters[L_.key], w, h, L_.key === "surface");
  const result = { w, h, sheets, filters, photo };
  result.product = project(result, LAYERS.map((x) => x.key));
  return result;
}
