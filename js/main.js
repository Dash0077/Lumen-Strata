import { LAYERS, imageUrl } from "./layers.js";
import { initViewer, openViewer, closeViewer } from "./viewer.js";

const $ = (id) => document.getElementById(id);
const home = $("home");
let paintings = [];
const filter = { q: "", support: "all", sort: "views" };

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
    pts = Array.from({ length: Math.round((innerWidth * innerHeight) / 6500) }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight * 3,
      r: Math.random() ** 3 * 1.4 + 0.25, d: Math.random() * 0.5 + 0.1, t: Math.random() * 6.28,
    }));
  };
  const draw = (time) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const off = scrollY;
    for (const s of pts) {
      const y = (((s.y - off * s.d) % (innerHeight * 3)) + innerHeight * 3) % (innerHeight * 3);
      if (y > innerHeight) continue;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time / 1400 + s.t);
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, 6.283);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    requestAnimationFrame(draw);
  };
  resize();
  addEventListener("resize", resize);
  requestAnimationFrame(draw);
}

// ---------- hero ----------

const HERO_FILTERS = [
  "sepia(1) saturate(.4) brightness(.9) contrast(.6)",
  "grayscale(1) contrast(3) brightness(1.4) invert(1) opacity(.7)",
  "grayscale(1) contrast(1.6) sepia(.5)",
  "saturate(2.2) blur(3px) contrast(1.2)",
  "none",
];

function hero() {
  const world = $("hero-world");
  const caption = $("hero-caption");
  const top = paintings.slice(0, 6);
  let i = 0;
  const show = () => {
    const p = top[i % top.length];
    const url = imageUrl(p, 700);
    const ar = (p.width || 3) / (p.height || 4);
    world.style.setProperty("--ar", ar);
    world.innerHTML = HERO_FILTERS.map(
      (f, k) => `<div class="hero-sheet" style="--k:${k};--f:${f}"><img src="${url}" alt="" /></div>`
    ).join("");
    caption.innerHTML = `<b>${p.title}</b> · ${p.artist}, ${p.dated}`;
    world.onclick = () => (location.hash = `#/p/${p.id}`);
    i++;
  };
  show();
  setInterval(() => !home.hidden && document.visibilityState === "visible" && show(), 9000);
  addEventListener("pointermove", (e) => {
    world.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
    world.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
  });
  $("hero-random").addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = `#/p/${paintings[Math.floor(Math.random() * paintings.length)].id}`;
  });
}

// ---------- gallery ----------

function visible() {
  const q = filter.q.trim().toLowerCase();
  let list = paintings.filter((p) => {
    if (filter.support === "other" && (p.support === "canvas" || p.support === "panel")) return false;
    if (filter.support !== "all" && filter.support !== "other" && p.support !== filter.support) return false;
    if (!q) return true;
    return [p.title, p.artist, p.dated, p.century, p.culture, p.medium].join(" ").toLowerCase().includes(q);
  });
  const by = {
    views: (a, b) => b.views - a.views,
    year: (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
    "-year": (a, b) => (b.year ?? -9999) - (a.year ?? -9999),
    artist: (a, b) => a.artist.localeCompare(b.artist),
  }[filter.sort];
  return list.slice().sort(by);
}

function renderGrid() {
  const list = visible();
  const grid = $("grid");
  grid.innerHTML = list
    .map((p) => {
      const rank = paintings.indexOf(p) + 1;
      const url = imageUrl(p, 520);
      return `<a class="card" href="#/p/${p.id}" style="--ar:${(p.width || 3) / (p.height || 4)}">
        <div class="card-media">
          <img class="ly ly0" src="${url}" alt="" loading="lazy" />
          <img class="ly ly1" src="${url}" alt="" loading="lazy" />
          <img class="ly ly2" src="${url}" alt="${escapeAttr(p.title)} by ${escapeAttr(p.artist)}" loading="lazy" />
          <span class="glare"></span>
        </div>
        <div class="card-meta">
          <span class="rank mono">#${String(rank).padStart(2, "0")}</span>
          <h3>${escapeAttr(p.title)}</h3>
          <p>${escapeAttr(p.artist)} · ${escapeAttr(p.dated || "")}</p>
        </div>
      </a>`;
    })
    .join("");
  $("empty").hidden = list.length > 0;
}

function tilt() {
  const grid = $("grid");
  grid.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--ry", `${x * 14}deg`);
    card.style.setProperty("--rx", `${-y * 14}deg`);
    card.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  });
  grid.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".card");
    if (card && !card.contains(e.relatedTarget)) {
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    }
  });
}

function controls() {
  $("q").addEventListener("input", (e) => { filter.q = e.target.value; renderGrid(); });
  $("sort").addEventListener("change", (e) => { filter.sort = e.target.value; renderGrid(); });
  $("support-chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    filter.support = b.dataset.support;
    document.querySelectorAll("#support-chips .chip").forEach((c) => c.classList.toggle("on", c === b));
    renderGrid();
  });
}

// ---------- method ----------

function method() {
  const sample = { support: "canvas", year: 1880, colors: [] };
  $("method-list").innerHTML = LAYERS.map(
    (L, k, _, p = k === 0 ? { support: "panel" } : sample) => `<li style="--k:${k}">
      <div class="m-num mono">${String(k + 1).padStart(2, "0")}</div>
      <div class="m-sheet" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="m-text">
        <h3>${L.name}</h3>
        <p>${L.body(p)}</p>
        <p class="m-instr">${L.instr(p)}</p>
      </div>
    </li>`
  ).join("");
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// ---------- router ----------

function route() {
  const h = location.hash || "#/";
  const m = h.match(/^#\/p\/(\d+)/);
  if (m) {
    const p = paintings.find((x) => String(x.id) === m[1]);
    if (p) {
      home.hidden = true;
      document.body.classList.add("in-viewer");
      openViewer(p, paintings);
      return;
    }
  }
  const wasViewer = document.body.classList.contains("in-viewer");
  closeViewer();
  document.body.classList.remove("in-viewer");
  home.hidden = false;
  document.title = "Lumen-Strata";
  const section = { "#/collection": "collection", "#/method": "method", "#/light": "light" }[h];
  requestAnimationFrame(() => {
    if (section) $(section).scrollIntoView({ behavior: wasViewer ? "auto" : "smooth" });
    else scrollTo({ top: 0, behavior: wasViewer ? "auto" : "smooth" });
  });
}

async function boot() {
  stars();
  initViewer();
  method();
  const res = await fetch("data/paintings.json");
  paintings = (await res.json()).paintings;
  hero();
  controls();
  tilt();
  renderGrid();
  addEventListener("hashchange", route);
  route();
}

boot();
