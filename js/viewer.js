// Scroll-driven 3D dissection, the projector, the light table and the sheet
// inspector.
//
// The scene is plain CSS 3D: every sheet is a <canvas> on a plane at its own
// translateZ inside one preserve-3d "world". Scroll progress p (0..1 over the
// sticky track) drives the camera and the separation:
//   0.00-0.20  the painting turns from face-on to a three-quarter view
//   0.20-0.84  the strata peel apart, surface first, support last
//   0.84-1.00  fully exploded; the light switch starts to pulse
// The light is a toggle, independent of scroll: switching it on swings the
// camera round to a "projector bench" view, wherever the reader is.

import { LAYERS, dissect, imageUrl, copySheet } from "./layers.js";

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const N = LAYERS.length;
const SPREAD_START = 0.2, SPREAD_END = 0.84;
const BEAM_PLANES = 18;
const ALL = () => LAYERS.map(() => true);

// Light-table presets: which sheets stay in the beam. Each mirrors a way of
// looking at a real painting.
const PRESETS = [
  { name: "Full painting", on: [0, 1, 2, 3, 4, 5, 6] },
  { name: "Under the varnish", on: [0, 1, 2, 3, 4, 5] },
  { name: "Infrared view", on: [1, 2] },
  { name: "X-ray view", on: [0, 3] },
  { name: "Colour only", on: [1, 4] },
];

const el = {
  viewer: $("viewer"), track: $("track"), stage: $("stage"), world: $("world"), sheets: $("sheets"),
  wall: $("wall"), projection: $("projection"), wallImg: $("wall-img"), wallCanvas: $("wall-canvas"),
  beam: $("beam"), lamp: $("lamp"), projector: $("projector"), floor: $("floor"),
  intro: $("intro-card"), note: $("note"), rail: $("rail"), hint: $("stage-hint"),
  light: $("light-btn"), lens: $("lens"), presets: $("presets"),
  loader: $("loader"), loaderText: $("loader-text"), retry: $("retry"),
  inspect: $("inspect"),
};

const state = {
  painting: null, list: [], token: 0, result: null, copies: {},
  sw: 300, sh: 400, gap: 120, side: 400,
  p: 0, lit: 0, litTarget: 0,
  mx: 0, my: 0, mxs: 0, mys: 0, drag: 0, dragS: 0, dragging: null,
  inBeam: ALL(), beamS: LAYERS.map(() => 1),
  active: -2, running: false, sheets: [], last: 0,
  inspectK: -1, lastFocus: null,
};

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const damp = (rate, dt) => (reduceMotion ? 1 : 1 - Math.exp(-rate * dt));

// ---------- build ----------

function buildRail() {
  // Left to right in dissection order: surface first, support last.
  el.rail.innerHTML = LAYERS.map((_, o) => {
    const k = N - 1 - o;
    return `<li><button type="button" data-k="${k}"><span class="r-fill"></span><span class="r-num">${pad(k + 1)}</span><span class="r-name">${LAYERS[k].name}</span></button></li>`;
  }).join("");
  el.railBtns = [...el.rail.querySelectorAll("button")];
  el.rail.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const k = +b.dataset.k;
    if (state.litTarget) toggleBeam(k);
    else scrollToProgress(SPREAD_START + ((N - 1 - k + 0.6) / N) * (SPREAD_END - SPREAD_START));
  });
}

function buildPresets() {
  el.presets.innerHTML = PRESETS.map((p, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${p.name}</button>`).join("");
  el.presets.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const on = PRESETS[+b.dataset.i].on;
    state.inBeam = LAYERS.map((_, k) => on.includes(k));
    beamChanged();
  });
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
  state.sh = Math.min(vh * (mobile ? 0.42 : 0.6), (vw * (mobile ? 0.62 : 0.34)) / aspect);
  state.sw = state.sh * aspect;
  const side = (state.side = Math.max(state.sw, state.sh));
  // Fit the exploded stack beside the note card: at the three-quarter view each
  // gap advances ~0.72 of its length across the screen.
  const room = mobile ? vw * 0.95 : vw - 2 * Math.min(330, vw * 0.24);
  const fit = (room / 0.82 - state.sw * 0.7) / ((N - 1) * 0.72);
  state.gap = Math.max(state.sw * 0.14, Math.min(side * 0.36, fit));
  el.viewer.style.setProperty("--sw", `${state.sw}px`);
  el.viewer.style.setProperty("--sh", `${state.sh}px`);

  const { gap, sw, sh } = state;
  const back = -((N - 1) / 2) * gap;
  const front = ((N - 1) / 2) * gap;
  const wallZ = back - side * 1.15;
  const lensZ = front + side * 0.6;
  const floorY = sh / 2 + side * 0.32;

  // Wall: stands on the floor; the projection is centred on the beam axis (y = 0).
  const wallScale = 2.3;
  const wallW = Math.max(sw * wallScale, side) * 1.7;
  const wallH = floorY + sh * wallScale * 0.62 + side * 0.25;
  Object.assign(el.wall.style, {
    width: `${wallW}px`, height: `${wallH}px`,
    transform: `translate(-50%, -100%) translateY(${floorY}px) translateZ(${wallZ}px)`,
  });
  Object.assign(el.projection.style, { width: `${sw * wallScale}px`, height: `${sh * wallScale}px`, top: `${wallH - floorY}px` });

  // Floor: from just behind the wall to beyond the projector.
  const floorBack = wallZ - 2, floorFront = lensZ + side * 0.9;
  Object.assign(el.floor.style, {
    width: `${wallW}px`, height: `${floorFront - floorBack}px`,
    transform: `translate(-50%, -50%) translateY(${floorY}px) translateZ(${(floorBack + floorFront) / 2}px) rotateX(90deg)`,
  });

  // Projector: lens face at lensZ, body behind it (towards the viewer), stand down to the floor.
  const pw = side * 0.44, ph = side * 0.25, pd = side * 0.5;
  el.projector.style.setProperty("--pw", `${pw}px`);
  el.projector.style.setProperty("--ph", `${ph}px`);
  el.projector.style.setProperty("--pd", `${pd}px`);
  el.projector.style.setProperty("--stand", `${floorY - ph / 2}px`);
  el.projector.style.transform = `translateZ(${lensZ + pd / 2}px)`;
  el.lamp.style.transform = `translate(-50%, -50%) translateZ(${lensZ - side * 0.06}px)`;

  [...el.beam.children].forEach((plane, i) => {
    const t = i / (BEAM_PLANES - 1);
    const z = lerp(lensZ - side * 0.08, wallZ + 4, t);
    const s = lerp(0.07, wallScale * 1.02, t);
    plane.style.width = `${sw * s}px`;
    plane.style.height = `${sh * s}px`;
    plane.style.transform = `translate(-50%, -50%) translateZ(${z}px)`;
    plane.style.setProperty("--a", (0.17 * Math.sin(Math.PI * (0.12 + t * 0.88)) + 0.04).toFixed(3));
  });
}

function mountSheets(result) {
  el.sheets.innerHTML = "";
  state.sheets = LAYERS.map((layer, k) => {
    const div = document.createElement("div");
    div.className = `sheet sheet-${layer.key}`;
    div.dataset.k = k;
    const canvas = result.sheets[layer.key];
    canvas.setAttribute("aria-hidden", "true");
    div.appendChild(canvas);
    div.insertAdjacentHTML(
      "beforeend",
      `<span class="reg tl"></span><span class="reg tr"></span><span class="reg bl"></span><span class="reg br"></span>
       <div class="sheet-tag cap"><b>${pad(k + 1)}</b>${layer.name}</div>`
    );
    el.sheets.appendChild(div);
    return div;
  });
}

// ---------- note (compact) ----------

function showNote(o) {
  if (o === state.active) return;
  state.active = o;
  if (o < 0) return;
  const more = $("note-more");
  more.open = false;
  if (o === N) {
    $("note-num").textContent = "All seven strata";
    $("note-title").textContent = "Now add them back up";
    $("note-short").textContent = "Switch on the projector. Its beam passes through every sheet and lands on the wall as the painting.";
    $("note-tool").textContent = "";
    $("note-inspect").hidden = true;
    more.hidden = true;
  } else {
    const k = N - 1 - o;
    const L = LAYERS[k];
    const p = state.painting;
    $("note-num").textContent = `${pad(k + 1)} of ${pad(N)} · ${L.sub(p) || ""}`;
    $("note-title").textContent = L.name;
    $("note-short").textContent = L.short;
    $("note-tool").textContent = `Seen with: ${L.tool}`;
    $("note-body").innerHTML = L.body(p);
    $("note-instr").innerHTML = L.instr(p);
    $("note-how").innerHTML = `How this sheet was made: ${L.how}`;
    $("note-inspect").hidden = false;
    more.hidden = false;
  }
  el.note.classList.remove("swap");
  void el.note.offsetWidth;
  el.note.classList.add("swap");
}

// ---------- frame ----------

function trackSpan() {
  return { top: el.track.offsetTop, span: el.track.offsetHeight - innerHeight };
}

function frame(now) {
  if (!state.running) return;
  const dt = Math.min(0.25, (now - (state.last || now)) / 1000);
  state.last = now;
  const { top, span } = trackSpan();
  state.p = lerp(state.p, clamp((scrollY - top) / span), damp(7, dt));
  state.lit = lerp(state.lit, state.litTarget, damp(2.6, dt));
  state.mxs = lerp(state.mxs, state.mx, damp(3, dt));
  state.mys = lerp(state.mys, state.my, damp(3, dt));
  state.dragS = lerp(state.dragS, state.drag, damp(6, dt));
  for (let k = 0; k < N; k++) state.beamS[k] = lerp(state.beamS[k], state.inBeam[k] ? 1 : 0, damp(5, dt));

  // Skip all DOM writes once everything has settled: an idle viewer costs
  // nothing but this comparison.
  const sig = `${state.p.toFixed(4)}|${state.lit.toFixed(4)}|${state.mxs.toFixed(4)}|${state.mys.toFixed(4)}|${state.dragS.toFixed(3)}|${state.beamS.map((b) => b.toFixed(3))}|${innerWidth}x${innerHeight}|${state.sheets.length}|${state.litTarget}`;
  if (sig === state.sig) {
    requestAnimationFrame(frame);
    return;
  }
  state.sig = sig;

  const { p, lit, gap, sh } = state;
  const vw = innerWidth, vh = innerHeight;
  const mobile = vw < 760;
  const turn = ease(clamp((p - 0.03) / (SPREAD_START - 0.03)));
  const spread = clamp((p - SPREAD_START) / (SPREAD_END - SPREAD_START));
  const done = p > SPREAD_END;
  const L = ease(lit);

  // Camera: blend the scroll camera into the projector-bench camera.
  const cam = {
    rx: lerp(0, 12, turn), ry: lerp(0, -44, turn),
    sc: lerp(1, 0.9, turn) * lerp(1, 0.95, ease(spread)),
    // Centre the exploded stack in the space left of the note card.
    tx: mobile ? 0 : lerp(vw * 0.14, -(Math.min(320, vw * 0.26) + Math.min(48, vw * 0.034)) / 2, turn),
    ty: mobile ? lerp(0, -vh * 0.07, turn) : lerp(0, -vh * 0.02, turn),
  };
  const bench = { rx: 14, ry: -50, sc: mobile ? 0.5 : 0.56, tx: mobile ? 0 : vw * 0.03, ty: mobile ? -vh * 0.08 : -vh * 0.03 };
  const rx = lerp(cam.rx, bench.rx, L) + state.mys * 4;
  const ry = lerp(cam.ry, bench.ry, L) + state.mxs * 6 + state.dragS;
  const sc = lerp(cam.sc, bench.sc, L);
  const tx = lerp(cam.tx, bench.tx, L);
  const ty = lerp(cam.ty, bench.ty, L);
  el.world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sc}) rotateX(${rx}deg) rotateY(${ry}deg)`;

  // Sheets. Surface (k = N-1) peels first; the light fans them all out.
  const activeO = Math.min(N - 1, Math.floor(spread * N));
  state.sheets.forEach((div, k) => {
    const o = N - 1 - k;
    const s = Math.max(ease(clamp((spread - o * 0.085) / 0.49)), L);
    const z = lerp((k - (N - 1) / 2) * 1.5, (k - (N - 1) / 2) * gap, s);
    const out = 1 - state.beamS[k];
    div.style.transform = `translate(-50%, -50%) translateY(${-out * sh * 0.95}px) translateZ(${z}px)`;
    const isActive = spread > 0 && !done && o === activeO;
    div.classList.toggle("active", (isActive || done) && lit < 0.5);
    div.classList.toggle("out", !state.inBeam[k]);
    const base = spread <= 0 || done ? (k === N - 1 && spread > 0.1 ? 0.92 : 1) : isActive ? 1 : 0.4;
    div.style.opacity = (lerp(base, 0.5, L) * lerp(1, 0.3, out)).toFixed(3);
  });

  const scene = Math.max(turn, L);
  el.wall.style.opacity = Math.max(turn * 0.5, L).toFixed(3);
  el.floor.style.opacity = (scene * lerp(0.6, 1, L)).toFixed(3);
  el.projector.style.opacity = Math.max(turn * 0.5, L).toFixed(3);
  el.viewer.style.setProperty("--lit", lit.toFixed(3));

  el.intro.classList.toggle("gone", p > 0.06 || lit > 0.05);
  el.note.classList.toggle("show", spread > 0.005 && state.litTarget === 0);
  showNote(spread <= 0 ? -1 : done ? N : activeO);
  el.light.classList.toggle("beckon", done && state.litTarget === 0);
  if (p > 0.6) loadWall(); // fetch the wall's high-res photograph before the light is likely needed

  // Rail: each segment fills as its stratum peels away.
  el.railBtns.forEach((b, o) => {
    b.style.setProperty("--f", clamp(spread * N - o).toFixed(3));
    b.classList.toggle("on", state.litTarget === 0 && spread > 0 && !done && o === activeO);
    b.classList.toggle("off", state.litTarget === 1 && !state.inBeam[N - 1 - o]);
  });

  const hint = state.litTarget ? "Click a sheet to slide it out of the beam" : spread > 0.02 && state.sheets.length ? "Click any sheet to view it · drag to rotate" : "";
  if (el.hint.textContent !== hint) el.hint.textContent = hint;

  requestAnimationFrame(frame);
}

function scrollToProgress(p) {
  const { top, span } = trackSpan();
  scrollTo({ top: top + span * p, behavior: reduceMotion ? "auto" : "smooth" });
}

// ---------- light + light table ----------

// The wall's 1400px photograph is only fetched once it may be seen.
function loadWall() {
  const src = el.wallImg.dataset.src;
  if (src && el.wallImg.getAttribute("src") !== src) el.wallImg.src = src;
}

function setLight(on) {
  if (on) loadWall();
  state.litTarget = on ? 1 : 0;
  el.viewer.classList.toggle("lit", on);
  el.light.setAttribute("aria-pressed", String(on));
  $("light-state").textContent = on ? "on" : "off";
  if (!on) {
    state.inBeam = ALL();
    beamChanged();
  }
  updateLightCaption();
}

function setLens(on) {
  el.viewer.classList.toggle("obscura", on);
  el.lens.setAttribute("aria-pressed", String(on));
  updateLightCaption();
}

function toggleBeam(k) {
  state.inBeam[k] = !state.inBeam[k];
  beamChanged();
}

function beamChanged() {
  const onCount = state.inBeam.filter(Boolean).length;
  el.presets.querySelectorAll("button").forEach((b) => {
    const pr = PRESETS[+b.dataset.i].on;
    b.setAttribute("aria-pressed", String(pr.length === onCount && pr.every((k) => state.inBeam[k])));
  });
  composite();
  updateLightCaption();
}

// What reaches the wall: lamp light filtered through every sheet still in the
// beam, composited back to front. With all seven in, it is the photograph.
function composite() {
  const r = state.result;
  // Until the high-res photograph arrives, the canvas (all sheets) stands in.
  const photo = state.inBeam.every(Boolean) && el.wallImg.complete && el.wallImg.naturalWidth > 0;
  el.projection.classList.toggle("partial", !photo);
  if (!r || photo) return;
  const c = el.wallCanvas;
  c.width = r.w;
  c.height = r.h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fbf3e2"; // bare lamp light
  ctx.fillRect(0, 0, r.w, r.h);
  LAYERS.forEach((L, k) => state.inBeam[k] && ctx.drawImage(r.sheets[L.key], 0, 0));
}

function updateLightCaption() {
  const obscura = el.viewer.classList.contains("obscura");
  const n = state.inBeam.filter(Boolean).length;
  const preset = PRESETS.find((pr) => pr.on.length === n && pr.on.every((k) => state.inBeam[k]));
  $("light-mode").textContent = obscura ? "Camera obscura · image inverted" : `Light table · ${n} of ${N} sheets in the beam`;
  $("light-text").innerHTML = obscura
    ? "Through a single opening the rays cross, so the picture lands <i>upside down</i>."
    : n === N
    ? `All seven strata add up to <i>${esc(state.painting?.title)}</i>.`
    : n === 0
    ? "No sheets in the beam: only bare lamplight reaches the wall."
    : preset
    ? `${preset.name}: what remains when the other sheets are lifted out.`
    : "Lift sheets out of the beam to see what each one contributes.";
}

// ---------- inspector ----------

function copyOf(key) {
  if (!state.copies[key]) state.copies[key] = copySheet(state.result.sheets[key], 1100);
  return state.copies[key];
}

function beneathVarnish() {
  if (state.copies._beneath) return state.copies._beneath;
  const r = state.result;
  const c = document.createElement("canvas");
  c.width = r.w;
  c.height = r.h;
  const ctx = c.getContext("2d");
  LAYERS.slice(0, N - 1).forEach((L) => ctx.drawImage(r.sheets[L.key], 0, 0));
  return (state.copies._beneath = c);
}

function openInspect(k) {
  if (!state.result) return;
  const opening = el.inspect.hidden;
  if (opening) state.lastFocus = document.activeElement;
  state.inspectK = k;
  const L = LAYERS[k];
  const p = state.painting;
  $("ins-num").textContent = `${pad(k + 1)} of ${pad(N)} · ${L.sub(p) || ""}`;
  $("ins-title").textContent = L.name;
  $("ins-short").textContent = L.short;
  $("ins-tool").textContent = `Seen with: ${L.tool}`;
  $("ins-body").innerHTML = L.body(p);
  $("ins-instr").innerHTML = L.instr(p);
  const surface = k === N - 1;
  $("cmp-top").replaceChildren(surface ? beneathVarnish() : copyOf(L.key));
  $("cmp-base").replaceChildren(copyOf("surface"));
  $("cmp-top").dataset.key = surface ? "beneath" : L.key;
  $("cmp-l").textContent = surface ? "Strata beneath" : L.name;
  $("compare").style.setProperty("--ar", (state.result.w / state.result.h).toFixed(4));
  [...$("ins-strip").children].forEach((b, i) => b.setAttribute("aria-selected", String(i === k)));
  el.inspect.querySelector("details").open = false;
  if (opening) {
    el.inspect.hidden = false;
    document.body.classList.add("inspecting");
    requestAnimationFrame(() => el.inspect.classList.add("open"));
    $("ins-close").focus({ preventScroll: true });
  }
}

function closeInspect() {
  if (el.inspect.hidden) return;
  el.inspect.classList.remove("open");
  el.inspect.hidden = true;
  document.body.classList.remove("inspecting");
  state.inspectK = -1;
  state.lastFocus?.focus?.({ preventScroll: true });
}

function buildInspectStrip() {
  $("ins-strip").innerHTML = LAYERS.map((L, k) => `<button type="button" role="tab" data-k="${k}" aria-selected="false"><span class="thumb"></span><span class="cap">${pad(k + 1)} ${L.name}</span></button>`).join("");
  $("ins-strip").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) openInspect(+b.dataset.k);
  });
}

function fillInspectThumbs() {
  [...$("ins-strip").children].forEach((b, k) => b.querySelector(".thumb").replaceChildren(copySheet(state.result.sheets[LAYERS[k].key], 140)));
}

// ---------- dossier + next ----------

function fillDossier(p, rank) {
  $("d-img").src = imageUrl(p, 900);
  $("d-img").alt = p.alt || `${p.title} by ${p.artist}`;
  $("d-eyebrow").textContent = `No. ${pad(rank)} most viewed · ${p.objectnumber}`;
  $("d-title").textContent = p.title;
  $("d-artist").textContent = [p.artist, p.artistDates].filter(Boolean).join(", ");
  const facts = [["Date", p.dated], ["Medium", p.medium], ["Dimensions", p.dimensions], ["Culture", p.culture]].filter(([, v]) => v);
  $("d-facts").innerHTML = facts.map(([k, v]) => `<div><dt class="cap">${k}</dt><dd>${esc(v)}</dd></div>`).join("");
  $("d-text").innerHTML = p.text
    ? p.text.split(/\n+/).map((t) => `<p>${esc(t)}</p>`).join("")
    : `<p class="muted">The museum has not published a label text for this work.</p>`;
  document.querySelector(".d-more").open = false;
  $("d-swatches").innerHTML = p.colors
    .map((c) => `<span class="sw" style="--c:${c.hex};flex-grow:${Math.max(c.percent, 0.02)}" title="${c.hex} · ${c.hue} · ${(c.percent * 100).toFixed(1)}%"><i>${c.hex}</i></span>`)
    .join("");
  $("d-link").href = p.url;
}

function fillNextUp(p) {
  const i = state.list.findIndex((x) => x.id === p.id);
  const j = (i + 1) % state.list.length;
  const n = state.list[j];
  $("next-up").innerHTML = `<a href="#/p/${n.id}">
      <div><span class="cap dim">Next · No. ${pad(j + 1)}</span>
      <strong>${esc(n.title)}</strong>
      <span class="cap dim nx-artist">${esc(n.artist)}</span></div>
      <img src="${imageUrl(n, 480)}" alt="" loading="lazy" />
    </a>`;
}

// ---------- public ----------

export function initViewer() {
  buildRail();
  buildPresets();
  buildBeam();
  buildInspectStrip();
  el.light.addEventListener("click", () => setLight(state.litTarget === 0));
  el.lens.addEventListener("click", () => setLens(!el.viewer.classList.contains("obscura")));
  $("d-top").addEventListener("click", () => scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  $("prev").addEventListener("click", () => step(-1));
  $("next").addEventListener("click", () => step(1));
  $("retry").addEventListener("click", () => state.painting && openViewer(state.painting, state.list));
  $("note-inspect").addEventListener("click", () => state.active >= 0 && state.active < N && openInspect(N - 1 - state.active));
  $("ins-close").addEventListener("click", closeInspect);
  $("ins-prev").addEventListener("click", () => openInspect((state.inspectK + N - 1) % N));
  $("ins-next").addEventListener("click", () => openInspect((state.inspectK + 1) % N));
  el.inspect.addEventListener("click", (e) => { if (e.target === el.inspect) closeInspect(); });
  el.wallImg.addEventListener("load", composite);
  $("cmp-range").addEventListener("input", (e) => $("compare").style.setProperty("--x", `${e.target.value}%`));
  addEventListener("resize", layout);
  addEventListener("pointermove", (e) => {
    state.mx = e.clientX / innerWidth - 0.5;
    state.my = e.clientY / innerHeight - 0.5;
  });

  // Drag to orbit; a click without movement on a sheet opens it (or, with the
  // light on, slides it in or out of the beam). Vertical swipes still scroll.
  const stage = el.stage;
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button, a, input, summary, .note, .hud-bottom")) return;
    state.dragging = { x: e.clientX, y: e.clientY, start: state.drag, moved: false, sheet: e.target.closest(".sheet") };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    const d = state.dragging;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
      d.moved = true;
      stage.classList.add("dragging");
    }
    if (d.moved) state.drag = clamp(d.start + (e.clientX - d.x) * 0.25, -70, 70);
  });
  stage.addEventListener("pointerup", () => {
    const d = state.dragging;
    state.dragging = null;
    stage.classList.remove("dragging");
    if (d && !d.moved && d.sheet) {
      const k = +d.sheet.dataset.k;
      state.litTarget ? toggleBeam(k) : openInspect(k);
    }
  });
  stage.addEventListener("pointercancel", () => { state.dragging = null; stage.classList.remove("dragging"); });
  stage.addEventListener("dblclick", () => (state.drag = 0));

  addEventListener("keydown", (e) => {
    if (el.viewer.hidden || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input:not([type=range]), select, textarea")) return;
    if (document.body.classList.contains("menu-open")) return;
    if (!el.inspect.hidden) {
      if (e.key === "Escape") closeInspect();
      if (e.key === "Tab") {
        const f = [...el.inspect.querySelectorAll("button, summary, input")].filter((x) => x.offsetParent);
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        return;
      }
      if (e.target.type === "range") return;
      if (e.key === "ArrowLeft") openInspect((state.inspectK + N - 1) % N);
      if (e.key === "ArrowRight") openInspect((state.inspectK + 1) % N);
      return;
    }
    if (e.key === "l" || e.key === "L") setLight(state.litTarget === 0);
    if (e.key === "o" || e.key === "O") setLens(!el.viewer.classList.contains("obscura"));
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
}

function step(d) {
  const i = state.list.findIndex((x) => x.id === state.painting.id);
  location.hash = `#/p/${state.list[(i + d + state.list.length) % state.list.length].id}`;
}

export async function openViewer(p, list) {
  const token = ++state.token;
  closeInspect();
  state.painting = p;
  state.list = list;
  state.result = null;
  state.copies = {};
  state.active = -2;
  state.p = 0;
  state.drag = state.dragS = 0;
  state.sheets = [];
  setLight(false);
  setLens(false);
  const rank = list.findIndex((x) => x.id === p.id) + 1;

  el.viewer.hidden = false;
  scrollTo({ top: 0, behavior: "auto" });
  document.title = `${p.title} · Lumen-Strata`;
  $("nav-title").innerHTML = `<b>No. ${pad(rank)}</b>${esc(p.title)} — ${esc(p.artist)}`;
  el.world.setAttribute("aria-label", `3D dissection of ${p.title} by ${p.artist}`);
  $("v-meta").textContent = [p.dated, p.medium].filter(Boolean).join(" · ");
  $("v-h1").textContent = p.title;
  $("v-artist").textContent = p.artist;
  el.wallImg.removeAttribute("src");
  el.wallImg.dataset.src = imageUrl(p, 1400);
  state.sig = "";
  fillDossier(p, rank);
  fillNextUp(p);

  el.sheets.innerHTML = "";
  el.loader.classList.add("show");
  el.retry.hidden = true;
  el.loaderText.textContent = "Separating strata";
  layout();
  if (!state.running) {
    state.running = true;
    state.last = 0;
    requestAnimationFrame(frame);
  }

  try {
    const result = await dissect(p);
    if (token !== state.token) return;
    state.result = result;
    mountSheets(result);
    fillInspectThumbs();
    composite();
    el.loader.classList.remove("show");
  } catch (err) {
    if (token !== state.token) return;
    el.loaderText.textContent = "The museum's image server did not respond.";
    el.retry.hidden = false;
    console.error(err);
  }
}

export function closeViewer() {
  state.running = false;
  state.token++;
  closeInspect();
  el.viewer.hidden = true;
  setLight(false);
}
