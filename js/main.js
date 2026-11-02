import { LAYERS, dissect, imageUrl, copySheet } from "./layers.js";
import { initViewer, openViewer, closeViewer } from "./viewer.js";

const $ = (id) => document.getElementById(id);
const home = $("home");
const FEATURED_ID = 299843; // Van Gogh, the most-viewed painting in the collection
let paintings = [];
const filter = { q: "", support: "all", sort: "views" };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
// Names as art history uses them, where the last word of the API name is not it.
const KNOWN_AS = { Rijn: "Rembrandt", Canal: "Canaletto", Angelico: "Fra Angelico" };
const surname = (name) => {
  const last = name.replace(/\s*\(.*\)/, "").split(",")[0].trim().split(" ").pop();
  return KNOWN_AS[last] || last;
};

// One passive scroll listener, batched to a single rAF; every scroll-linked
// effect on the page registers here instead of adding its own listener.
const scrollJobs = [];
let scrollQueued = false;
function onScroll(fn) {
  scrollJobs.push(fn);
}
addEventListener("scroll", () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    scrollJobs.forEach((fn) => fn(scrollY));
  });
}, { passive: true });

// ---------- starfield ----------

function stars() {
  const c = $("stars");
  const ctx = c.getContext("2d");
  let pts = [];
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = Array.from({ length: Math.round((innerWidth * innerHeight) / 7000) }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight * 3,
      r: Math.random() ** 3 * 1.3 + 0.25, d: Math.random() * 0.4 + 0.08, t: Math.random() * 6.28,
    }));
  };
  // Twinkling only needs ~12 fps; scrolling redraws immediately.
  let lastDraw = 0, lastY = -1;
  const draw = (time) => {
    requestAnimationFrame(draw);
    if (scrollY === lastY && time - lastDraw < 80) return;
    lastDraw = time;
    lastY = scrollY;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = "#fff";
    const H = innerHeight * 3;
    for (const s of pts) {
      const y = (((s.y - scrollY * s.d) % H) + H) % H;
      if (y > innerHeight) continue;
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(time / 1500 + s.t);
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, 6.283);
      ctx.fill();
    }
  };
  resize();
  addEventListener("resize", resize);
  requestAnimationFrame(draw);
}

// ---------- nav + menu ----------

function nav() {
  const bar = $("nav");
  let lastY = scrollY;
  onScroll((y) => {
    bar.classList.toggle("solid", y > 30);
    // Tuck the bar away while reading downwards on the home page; bring it back on any upward scroll.
    const inViewer = document.body.classList.contains("in-viewer");
    bar.classList.toggle("tuck", !inViewer && y > innerHeight && y > lastY + 2);
    if (y < lastY - 2) bar.classList.remove("tuck");
    lastY = y;
  });
  $("to-top").addEventListener("click", () => scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
}

const menu = {
  el: $("menu"), btn: $("menu-btn"), label: null, lastFocus: null,
  previews: {},
  open() {
    this.lastFocus = document.activeElement;
    this.el.hidden = false;
    document.body.classList.add("menu-open");
    this.btn.setAttribute("aria-expanded", "true");
    this.setLabel("Close");
    if (!$("menu-preview").getAttribute("src")) this.preview(0);
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.add("open")));
    setTimeout(() => this.el.querySelector(".menu-main a")?.focus({ preventScroll: true }), 300);
  },
  close(restoreFocus = true) {
    if (this.el.hidden) return;
    this.el.classList.remove("open");
    document.body.classList.remove("menu-open");
    this.btn.setAttribute("aria-expanded", "false");
    this.setLabel("Menu");
    setTimeout(() => { if (!this.el.classList.contains("open")) this.el.hidden = true; }, reduceMotion ? 0 : 900);
    if (restoreFocus) this.lastFocus?.focus?.({ preventScroll: true });
  },
  // Cross-fade the preview image. A token drops stale swaps when the pointer
  // sweeps across several links quickly.
  previewToken: 0,
  preview(key) {
    const p = this.previews[key];
    const img = $("menu-preview");
    if (!p) return;
    const src = imageUrl(p, 900);
    if (img.getAttribute("src") === src) { img.style.opacity = 1; return; }
    const token = ++this.previewToken;
    img.style.opacity = 0;
    const next = new Image();
    next.onload = () => { if (token === this.previewToken) { img.src = src; img.style.opacity = 1; } };
    next.src = src;
  },
  setLabel(text) {
    const roll = this.btn.querySelector(".roll");
    roll.dataset.text = text;
    roll.firstElementChild.textContent = text;
  },
  init() {
    this.btn.addEventListener("click", () => (this.el.hidden ? this.open() : this.close()));
    addEventListener("keydown", (e) => {
      if (this.el.hidden) return;
      if (e.key === "Escape") this.close();
      if (e.key === "Tab") {
        // Keep focus inside the menu (and its toggle) while it is open.
        const f = [this.btn, ...this.el.querySelectorAll("a, button")];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    this.el.addEventListener("click", (e) => { if (e.target.closest("a")) this.close(false); });
    this.el.querySelectorAll("[data-preview]").forEach((a) => {
      a.addEventListener("pointerenter", () => this.preview(a.dataset.preview));
      a.addEventListener("focus", () => this.preview(a.dataset.preview));
    });
    $("menu-random").addEventListener("click", (e) => { e.preventDefault(); this.close(false); surprise(); });
  },
};

function surprise() {
  const current = (location.hash.match(/^#\/p\/(\d+)/) || [])[1];
  const pool = paintings.filter((p) => String(p.id) !== current);
  location.hash = `#/p/${pool[Math.floor(Math.random() * pool.length)].id}`;
}

// ---------- hero: the featured painting's real strata ----------

function sheetStack(world, result, p, cls) {
  world.style.setProperty("--ar", (result.w / result.h).toFixed(4));
  world.innerHTML = "";
  LAYERS.forEach((L, k) => {
    const div = document.createElement("div");
    div.className = cls;
    div.style.setProperty("--k", k);
    div.dataset.name = `${pad(k + 1)}  ${L.name}`;
    div.appendChild(copySheet(result.sheets[L.key], 640));
    world.appendChild(div);
  });
}

async function hero(featured) {
  const world = $("hero-world");
  $("hero-featured").href = `#/p/${featured.id}`;
  let pointer = null;
  addEventListener("pointermove", (e) => {
    if (home.hidden || scrollY > innerHeight) return;
    if (!pointer) requestAnimationFrame(() => {
      world.style.setProperty("--px", (pointer.x / innerWidth - 0.5).toFixed(3));
      world.style.setProperty("--py", (pointer.y / innerHeight - 0.5).toFixed(3));
      pointer = null;
    });
    pointer = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  let spread = -1;
  onScroll((y) => {
    const s = home.hidden ? spread : Math.min(1, y / innerHeight).toFixed(3);
    if (s !== spread) world.style.setProperty("--spread", (spread = s));
  });
  // The photograph stands in while the strata are computed.
  world.style.setProperty("--ar", ((featured.width || 3) / (featured.height || 4)).toFixed(4));
  world.innerHTML = `<div class="hero-sheet" style="--k:6"><img src="${imageUrl(featured, 700)}" alt="" style="width:100%;height:100%;object-fit:cover" /></div>`;
  try {
    const result = await dissect(featured);
    sheetStack(world, result, featured, "hero-sheet");
    sheetStack($("method-world"), result, featured, "method-sheet");
    setMethodActive(methodActive);
  } catch (err) {
    console.error(err);
  }
}

// ---------- statement: words light up as you read ----------

function statement() {
  const el = $("statement-text");
  el.innerHTML = el.textContent.split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
  const words = [...el.children];
  let lit = -1;
  const update = () => {
    if (home.hidden) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < -innerHeight || r.top > innerHeight * 2) return;
    const t = (innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.35);
    const n = Math.round(Math.min(1, Math.max(0, t)) * words.length);
    if (n === lit) return;
    lit = n;
    words.forEach((w, i) => w.classList.toggle("on", i < n));
  };
  onScroll(update);
  update();
}

function marquee() {
  const names = [...new Set(paintings.map((p) => surname(p.artist)).filter((n) => n.length > 2 && !/unidentified|artist|chinese|korean|persian|roman/i.test(n)))];
  const html = names.map((n) => `<span>${esc(n)}</span>`).join("");
  $("marquee").innerHTML = html + html; // doubled for a seamless loop
}

// ---------- gallery ----------

function visible() {
  const q = filter.q.trim().toLowerCase();
  const list = paintings.filter((p) => {
    if (filter.support === "other" && (p.support === "canvas" || p.support === "panel")) return false;
    if (filter.support !== "all" && filter.support !== "other" && p.support !== filter.support) return false;
    return !q || [p.title, p.artist, p.dated, p.century, p.culture, p.medium].join(" ").toLowerCase().includes(q);
  });
  const by = {
    views: (a, b) => b.views - a.views,
    year: (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
    "-year": (a, b) => (b.year ?? -9999) - (a.year ?? -9999),
    artist: (a, b) => surname(a.artist).localeCompare(surname(b.artist)),
  }[filter.sort];
  return list.sort(by);
}

function renderGrid() {
  const list = visible();
  $("grid").innerHTML = list
    .map((p, i) => {
      const url = imageUrl(p, 520);
      const alt = esc(p.alt ? p.alt.slice(0, 200) : `${p.title} by ${p.artist}`);
      return `<a class="card" href="#/p/${p.id}" style="--i:${Math.min(i, 12)}" aria-label="${esc(p.title)}, ${esc(p.artist)}">
        <div class="card-media">
          <img class="ly ly2" src="${url}" alt="${alt}" loading="lazy" decoding="async" />
          <span class="glare"></span>
          <span class="card-go" aria-hidden="true">→</span>
        </div>
        <div class="card-meta">
          <span class="cap">No. ${pad(p.rank)}</span>
          <span class="cap">${esc(p.year ?? "")}</span>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.artist)}</p>
        </div>
      </a>`;
    })
    .join("");
  $("empty").hidden = list.length > 0;
  $("count").textContent = `${pad(list.length)} / ${paintings.length} works`;
}

// The two filtered "strata" behind each card are only built the first time a
// card is hovered or focused, so 60 cards decode 60 images, not 180.
function cardLayers() {
  const add = (e) => {
    const card = e.target.closest?.(".card");
    if (!card || card.dataset.layered) return;
    card.dataset.layered = "1";
    const photo = card.querySelector(".ly2");
    ["ly0", "ly1"].forEach((cls) => {
      const img = document.createElement("img");
      img.className = `ly ${cls}`;
      img.alt = "";
      img.decoding = "async";
      img.src = photo.currentSrc || photo.src;
      photo.before(img);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("ready")));
  };
  $("grid").addEventListener("pointerover", add);
  $("grid").addEventListener("focusin", add);
}

function tilt() {
  const grid = $("grid");
  if (reduceMotion || matchMedia("(hover: none)").matches) return;
  grid.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--ry", `${x * 12}deg`);
    card.style.setProperty("--rx", `${-y * 12}deg`);
    card.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  });
  grid.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".card");
    if (card && !card.contains(e.relatedTarget)) ["--rx", "--ry"].forEach((v) => card.style.removeProperty(v));
  });
}

function controls() {
  $("q").addEventListener("input", (e) => { filter.q = e.target.value; renderGrid(); });
  $("sort").addEventListener("change", (e) => { filter.sort = e.target.value; renderGrid(); });
  $("support-chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    filter.support = b.dataset.support;
    $("support-chips").querySelectorAll("button").forEach((c) => {
      c.classList.toggle("on", c === b);
      c.setAttribute("aria-pressed", String(c === b));
    });
    renderGrid();
  });
}

// ---------- method: sticky stack, one sheet per step ----------

let methodActive = 0;

function setMethodActive(k) {
  methodActive = k;
  $("method-num").textContent = pad(k + 1);
  document.querySelectorAll(".method-sheet").forEach((s, i) => s.classList.toggle("on", i === k));
  document.querySelectorAll(".method-steps li").forEach((li, i) => li.classList.toggle("on", i === k));
}

function method() {
  const sample = { support: "canvas", year: 1880, colors: [] };
  $("method-list").innerHTML = LAYERS.map((L, k) => {
    const p = k === 0 ? { support: "panel" } : sample;
    return `<li data-k="${k}">
      <p class="cap">${pad(k + 1)} of ${pad(LAYERS.length)}</p>
      <h3>${L.name}</h3>
      <p class="m-short">${L.short}</p>
      <p class="m-tool cap">Seen with: ${L.tool}</p>
      <details class="more">
        <summary class="chip-btn">Read more</summary>
        <div class="more-body"><p>${L.body(p)}</p><p>${L.instr(p)}</p></div>
      </details>
    </li>`;
  }).join("");
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && setMethodActive(+e.target.dataset.k)),
    { rootMargin: "-48% 0px -48% 0px" }
  );
  document.querySelectorAll(".method-steps li").forEach((li) => io.observe(li));
  setMethodActive(0);
}

// ---------- router ----------

function route() {
  menu.close(false);
  const h = location.hash || "#/";
  const m = h.match(/^#\/p\/(\d+)/);
  const p = m && paintings.find((x) => String(x.id) === m[1]);
  if (p) {
    firstRoute = false;
    home.hidden = true;
    document.body.classList.add("in-viewer");
    $("nav").classList.remove("tuck");
    openViewer(p, paintings);
    return;
  }
  const wasViewer = document.body.classList.contains("in-viewer");
  closeViewer();
  document.body.classList.remove("in-viewer");
  home.hidden = false;
  document.title = "Lumen-Strata — Light, layered.";
  const section = { "#/collection": "collection", "#/method": "method", "#/light": "light" }[h];
  // First load and returning from the viewer jump; in-page navigation glides.
  const behavior = firstRoute || wasViewer || reduceMotion ? "auto" : "smooth";
  const go = () => (section ? $(section).scrollIntoView({ behavior }) : scrollTo({ top: 0, behavior }));
  if (firstRoute && section) document.fonts.ready.then(() => requestAnimationFrame(go)); // wait for final layout
  else requestAnimationFrame(go);
  firstRoute = false;
}
let firstRoute = true;

// Following a link to the hash we are already on fires no hashchange; route
// anyway so "Collection" in the menu still scrolls there.
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.getAttribute("href") === (location.hash || "#/") && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    route();
  }
});

async function boot() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  stars();
  nav();
  menu.init();
  initViewer();
  method();
  try {
    const res = await fetch("data/paintings.json");
    if (!res.ok) throw new Error(`data/paintings.json: ${res.status}`);
    paintings = (await res.json()).paintings;
  } catch (err) {
    console.error(err);
    $("grid").innerHTML = "";
    $("empty").textContent = "The collection could not be loaded. Please refresh the page.";
    $("empty").hidden = false;
    return;
  }
  paintings.forEach((p, i) => (p.rank = i + 1));
  const byId = (id) => paintings.find((p) => p.id === id) || paintings[0];
  menu.previews = { 0: byId(228649), 1: byId(231830), 2: byId(299838), 3: paintings[Math.floor(Math.random() * paintings.length)] };
  statement();
  marquee();
  controls();
  tilt();
  cardLayers();
  renderGrid();
  addEventListener("hashchange", route);
  route();
  hero(byId(FEATURED_ID));
}

boot();
