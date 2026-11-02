// Scroll-driven 3D dissection and the light projection.
//
// The scene is plain CSS 3D: every sheet is a <canvas> on a plane at its own
// translateZ, inside one preserve-3d "world" that the scroll position rotates.
// Scroll progress p (0..1 over the sticky track) drives everything:
//   0.00-0.20  the painting turns from face-on to a three-quarter view
//   0.20-0.84  the strata peel apart, surface first, support last
//   0.84-1.00  fully exploded; invitation to switch on the light
// The light is a toggle, independent of scroll.

import { LAYERS, dissect, imageUrl } from "./layers.js";

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const N = LAYERS.length;
const SPREAD_START = 0.2, SPREAD_END = 0.84;
const BEAM_PLANES = 18;

const el = {
  viewer: $("viewer"), track: $("track"), world: $("world"), sheets: $("sheets"),
  wall: $("wall"), wallImg: $("wall-img"), beam: $("beam"), lamp: $("lamp"),
  intro: $("intro-card"), note: $("note"), index: $("layer-index"),
  light: $("light"), lens: $("lens"), loader: $("loader"), loaderText: $("loader-text"),
  bar: $("progress-bar"),
};

const state = {
  painting: null, list: [], token: 0,
  sw: 300, sh: 400, gap: 120,
  p: 0, pTarget: 0, lit: 0, litTarget: 0,
  mx: 0, my: 0, mxs: 0, mys: 0,
  active: -1, running: false, sheets: [],
};

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- build ----------

function buildIndex() {
  el.index.innerHTML = "";
  // Listed in dissection order: surface first.
  for (let o = 0; o < N; o++) {
    const k = N - 1 - o;
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span>${String(k + 1).padStart(2, "0")}</span>${LAYERS[k].name}`;
    b.addEventListener("click", () => scrollToProgress(SPREAD_START + ((o + 0.6) / N) * (SPREAD_END - SPREAD_START)));
    li.appendChild(b);
    el.index.appendChild(li);
  }
}

function buildBeam() {
  el.beam.innerHTML = "";
  for (let i = 0; i < BEAM_PLANES; i++) el.beam.appendChild(document.createElement("i"));
}

function layout() {
  const p = state.painting;
  if (!p) return;
  const aspect = (p.width || 3) / (p.height || 4);
  const vw = innerWidth, vh = innerHeight;
  const mobile = vw < 760;
  const maxH = vh * (mobile ? 0.4 : 0.54);
  const maxW = vw * (mobile ? 0.56 : 0.3);
  state.sh = Math.min(maxH, maxW / aspect);
  state.sw = state.sh * aspect;
  // Fit the exploded stack between the layer index and the note card: at the
  // three-quarter view each gap advances ~0.72 of its length across the screen.
  const room = mobile ? vw * 0.92 : vw - 2 * Math.min(420, vw * 0.29);
  const fit = (room / 0.8 - state.sw * 0.7) / ((N - 1) * 0.72);
  state.gap = Math.max(state.sw * 0.12, Math.min(Math.max(state.sw, state.sh) * 0.34, fit));
  el.viewer.style.setProperty("--sw", `${state.sw}px`);
  el.viewer.style.setProperty("--sh", `${state.sh}px`);

  const { gap, sw, sh } = state;
  const back = -((N - 1) / 2) * gap;
  const front = ((N - 1) / 2) * gap;
  const side = Math.max(sw, sh);
  state.wallZ = back - side * 1.1;
  state.lampZ = front + side * 0.7;
  // Similar triangles from the lamp: the farther the wall, the larger the image.
  const wallScale = 2.4;
  el.wall.style.width = `${Math.max(sw * wallScale, side) * 1.7}px`;
  el.wall.style.height = `${Math.max(sh * wallScale, side) * 1.35}px`;
  el.wall.style.transform = `translate(-50%, -50%) translateZ(${state.wallZ}px)`;
  el.wallImg.style.width = `${sw * wallScale}px`;
  el.wallImg.style.height = `${sh * wallScale}px`;
  el.lamp.style.transform = `translate(-50%, -50%) translateZ(${state.lampZ}px)`;

  [...el.beam.children].forEach((plane, i) => {
    const t = i / (BEAM_PLANES - 1);
    const z = lerp(state.lampZ - gap * 0.2, state.wallZ + 4, t);
    const s = lerp(0.06, wallScale * 1.02, t);
    plane.style.width = `${sw * s}px`;
    plane.style.height = `${sh * s}px`;
    plane.style.transform = `translate(-50%, -50%) translateZ(${z}px)`;
    plane.style.setProperty("--a", (0.18 * Math.sin(Math.PI * (0.15 + t * 0.85)) + 0.04).toFixed(3));
  });
}

function mountSheets(result) {
  el.sheets.innerHTML = "";
  state.sheets = LAYERS.map((layer, k) => {
    const div = document.createElement("div");
    div.className = `sheet sheet-${layer.key}`;
    const canvas = result.sheets[layer.key];
    canvas.setAttribute("aria-hidden", "true");
    div.appendChild(canvas);
    div.insertAdjacentHTML(
      "beforeend",
      `<span class="reg tl"></span><span class="reg tr"></span><span class="reg bl"></span><span class="reg br"></span>
       <div class="sheet-tag mono"><b>${String(k + 1).padStart(2, "0")}</b>${layer.name}</div>`
    );
    el.sheets.appendChild(div);
    return div;
  });
}

// ---------- notes ----------

function showNote(o) {
  if (o === state.active) return;
  state.active = o;
  [...el.index.children].forEach((li, i) => li.classList.toggle("on", i === o));
  if (o < 0) return;
  const p = state.painting;
  if (o === N) {
    $("note-num").textContent = "All strata separated";
    $("note-title").textContent = "Now add them back up";
    $("note-sub").textContent = "Turn on the light";
    $("note-body").innerHTML =
      "Seven transparent sheets, front to back. Switch on the lamp: its beam passes through every sheet, and the image that lands on the wall behind them is the painting again.";
    $("note-instr").innerHTML =
      "Conservators read these strata separately, then put them back together into one account of how the picture was made. That is technical art history.";
    $("note-how").textContent = "";
    return;
  }
  const k = N - 1 - o;
  const L = LAYERS[k];
  $("note-num").textContent = `Stratum ${String(k + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
  $("note-title").textContent = L.name;
  $("note-sub").textContent = L.sub(p) || "";
  $("note-body").innerHTML = L.body(p);
  $("note-instr").innerHTML = L.instr(p);
  $("note-how").innerHTML = `Here: ${L.how}`;
  el.note.classList.remove("swap");
  void el.note.offsetWidth;
  el.note.classList.add("swap");
}

// ---------- frame ----------

function progressFromScroll() {
  const top = el.track.offsetTop;
  const span = el.track.offsetHeight - innerHeight;
  return clamp((scrollY - top) / span);
}

// Frame-rate independent smoothing: the same feel at 30, 60 or 120 fps.
const damp = (rate, dt) => (reduceMotion ? 1 : 1 - Math.exp(-rate * dt));

function frame(now) {
  if (!state.running) return;
  const dt = Math.min(0.25, (now - (state.last || now)) / 1000);
  state.last = now;
  state.pTarget = progressFromScroll();
  state.p = lerp(state.p, state.pTarget, damp(7, dt));
  state.lit = lerp(state.lit, state.litTarget, damp(3, dt));
  state.mxs = lerp(state.mxs, state.mx, damp(3, dt));
  state.mys = lerp(state.mys, state.my, damp(3, dt));

  const { p, lit, gap } = state;
  const mobile = innerWidth < 760;
  const turn = ease(clamp((p - 0.03) / (SPREAD_START - 0.03)));
  const spread = clamp((p - SPREAD_START) / (SPREAD_END - SPREAD_START));
  const done = p > SPREAD_END;

  // Camera.
  // With the light on, the camera swings further round: lamp, sheets and wall
  // read left to right like a projector bench.
  const rx = lerp(0, 12, turn) - lit * 4 + state.mys * 5;
  const ry = lerp(0, -46, turn) - lit * 14 + state.mxs * 8;
  const sc = lerp(1, 0.86, turn) * lerp(1, mobile ? 0.5 : 0.6, lit) * lerp(1, 0.92, ease(spread));
  const tx = mobile ? -lit * innerWidth * 0.16 : lerp(innerWidth * 0.14, -innerWidth * 0.03, turn) + lit * innerWidth * 0.03;
  const ty = mobile ? lerp(0, -innerHeight * 0.08, turn) : 0;
  el.world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sc}) rotateX(${rx}deg) rotateY(${ry}deg)`;

  // Sheets: surface (k = N-1) peels first.
  state.sheets.forEach((div, k) => {
    const o = N - 1 - k;
    const s = ease(clamp((spread - o * 0.085) / 0.49));
    const z = lerp((k - (N - 1) / 2) * 1.5, (k - (N - 1) / 2) * gap, s);
    div.style.transform = `translate(-50%, -50%) translateZ(${z}px)`;
    const activeO = Math.min(N - 1, Math.floor(spread * N));
    const isActive = spread > 0 && !done && o === activeO;
    div.classList.toggle("active", isActive || done);
    // Lit sheets turn filmy so the projection behind them shows through.
    const base = spread <= 0 || done ? (k === N - 1 && spread > 0.1 ? 0.9 : 1) : isActive ? 1 : 0.42;
    div.style.opacity = lerp(base, 0.38, lit).toFixed(3);
  });

  el.wall.style.opacity = (turn * (0.4 + 0.6 * lit)).toFixed(3);
  el.viewer.style.setProperty("--lit", lit.toFixed(3));

  el.intro.classList.toggle("gone", p > 0.06);
  el.note.classList.toggle("show", spread > 0.005);
  el.index.classList.toggle("show", spread > 0.005);
  showNote(spread <= 0 ? -1 : done ? N : Math.min(N - 1, Math.floor(spread * N)));
  el.light.classList.toggle("beckon", done && state.litTarget === 0);
  el.bar.style.transform = `scaleX(${p})`;

  requestAnimationFrame(frame);
}

function scrollToProgress(p) {
  const top = el.track.offsetTop;
  const span = el.track.offsetHeight - innerHeight;
  scrollTo({ top: top + span * p, behavior: reduceMotion ? "auto" : "smooth" });
}

// ---------- light ----------

function setLight(on) {
  state.litTarget = on ? 1 : 0;
  el.viewer.classList.toggle("lit", on);
  el.light.setAttribute("aria-pressed", String(on));
  $("light-state").textContent = on ? "on" : "off";
  updateLightCaption();
}

function setLens(on) {
  el.viewer.classList.toggle("obscura", on);
  el.lens.setAttribute("aria-pressed", String(on));
  updateLightCaption();
}

function updateLightCaption() {
  const obscura = el.viewer.classList.contains("obscura");
  $("light-mode").textContent = obscura ? "Lens · Camera obscura" : "Lens · Projector";
  $("light-text").innerHTML = obscura
    ? "Through a pinhole or a single lens, rays cross over: the wall shows the picture <b>upside down</b>, as on the back wall of a camera obscura."
    : `Light passes through all ${N} strata and lands on the wall as one image, <i>${state.painting?.title || ""}</i>. The whole is the sum of its layers.`;
}

// ---------- dossier ----------

function fillDossier(p, rank) {
  $("d-img").src = imageUrl(p, 900);
  $("d-img").alt = p.alt || `${p.title} by ${p.artist}`;
  $("d-eyebrow").textContent = `#${String(rank).padStart(2, "0")} most viewed · ${p.objectnumber}`;
  $("d-title").textContent = p.title;
  $("d-artist").textContent = [p.artist, p.artistDates].filter(Boolean).join(", ");
  const facts = [
    ["Date", p.dated], ["Culture", p.culture], ["Period", p.period], ["Medium", p.medium],
    ["Dimensions", p.dimensions], ["Page views", p.views?.toLocaleString()],
  ].filter(([, v]) => v);
  $("d-facts").innerHTML = facts.map(([k, v]) => `<div><dt class="mono">${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join("");
  $("d-text").innerHTML = p.text
    ? p.text.split(/\n+/).map((t) => `<p>${escapeHtml(t)}</p>`).join("")
    : `<p class="muted">The museum has not published a label text for this work.</p>`;
  $("d-swatches").innerHTML = p.colors
    .map((c) => `<span class="sw" style="--c:${c.hex};flex-grow:${Math.max(c.percent, 0.02)}" title="${c.hex} · ${c.hue} · ${(c.percent * 100).toFixed(1)}%"><i class="mono">${c.hex}</i></span>`)
    .join("");
  $("d-link").href = p.url;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// ---------- public ----------

export function initViewer() {
  buildIndex();
  buildBeam();
  el.light.addEventListener("click", () => setLight(state.litTarget === 0));
  el.lens.addEventListener("click", () => setLens(!el.viewer.classList.contains("obscura")));
  $("d-top").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  $("prev").addEventListener("click", () => step(-1));
  $("next").addEventListener("click", () => step(1));
  addEventListener("resize", layout);
  addEventListener("pointermove", (e) => {
    state.mx = e.clientX / innerWidth - 0.5;
    state.my = e.clientY / innerHeight - 0.5;
  });
  addEventListener("keydown", (e) => {
    if (el.viewer.hidden || e.target.closest("input, select, textarea")) return;
    if (e.key === "l" || e.key === "L") setLight(state.litTarget === 0);
    if (e.key === "o" || e.key === "O") setLens(!el.viewer.classList.contains("obscura"));
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
}

function step(d) {
  const i = state.list.findIndex((x) => x.id === state.painting.id);
  const next = state.list[(i + d + state.list.length) % state.list.length];
  location.hash = `#/p/${next.id}`;
}

export async function openViewer(p, list) {
  const token = ++state.token;
  state.painting = p;
  state.list = list;
  const rank = list.findIndex((x) => x.id === p.id) + 1;
  state.active = -2;
  state.p = state.pTarget = 0;
  setLight(false);
  setLens(false);

  el.viewer.hidden = false;
  scrollTo({ top: 0, behavior: "auto" });
  document.title = `${p.title} · Lumen-Strata`;
  $("v-rank").textContent = `#${String(rank).padStart(2, "0")}`;
  $("v-title").textContent = `${p.title}, ${p.artist}`;
  $("v-meta").textContent = [p.dated, p.medium].filter(Boolean).join(" · ");
  $("v-h1").textContent = p.title;
  $("v-artist").textContent = p.artist;
  el.wallImg.src = imageUrl(p, 1400);
  fillDossier(p, rank);

  el.sheets.innerHTML = "";
  el.loader.classList.add("show");
  el.loaderText.textContent = "Fetching photograph";
  layout();
  if (!state.running) {
    state.running = true;
    requestAnimationFrame(frame);
  }

  try {
    const result = await dissect(p, (f, msg) => {
      if (token === state.token) el.loaderText.textContent = `${msg} · ${Math.round(f * 100)}%`;
    });
    if (token !== state.token) return;
    mountSheets(result);
    el.loader.classList.remove("show");
  } catch (err) {
    if (token !== state.token) return;
    el.loaderText.textContent = "The museum's image server did not respond. Try again in a moment.";
    console.error(err);
  }
}

export function closeViewer() {
  state.running = false;
  state.token++;
  el.viewer.hidden = true;
  setLight(false);
}
