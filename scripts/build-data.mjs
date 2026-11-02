// Builds data/paintings.json from the Harvard Art Museums API.
//
// The site itself is static (GitHub Pages), so the API key is only ever used
// here, on your machine, at build time. It is never shipped to the browser.
//
//   HARVARD_API_KEY=xxxx node scripts/build-data.mjs
//
// Selection rule: the most-viewed public-domain paintings in the collection
// (sorted by the API's own `totalpageviews` field), so "popular" is decided by
// the museum's visitors, not by us.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.HARVARD_API_KEY || process.env.HAM_API_KEY;
if (!KEY) {
  console.error("Set HARVARD_API_KEY (get one at https://harvardartmuseums.org/collections/api).");
  process.exit(1);
}

const TARGET = Number(process.env.COUNT || 60);
const API = "https://api.harvardartmuseums.org/object";
const FIELDS = [
  "id", "objectnumber", "title", "people", "dated", "datebegin", "culture",
  "period", "medium", "technique", "dimensions", "classification",
  "primaryimageurl", "images", "colors", "labeltext", "description",
  "creditline", "url", "totalpageviews", "division", "century",
].join(",");

// Works that are paintings in the API but are not a good fit for a "sheets of a
// single picture" dissection (multi-panel albums, modern reproductions, etc.).
const EXCLUDE = new Set([
  "1926.32.44", // Gilliéron's 20th-century reproduction of a Knossos fresco
]);

async function page(n) {
  const params = new URLSearchParams({
    apikey: KEY,
    classification: "Paintings",
    hasimage: "1",
    q: "imagepermissionlevel:0",
    sort: "totalpageviews",
    sortorder: "desc",
    size: "100",
    page: String(n),
    fields: FIELDS,
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// Guess the physical support from the medium line; drives the bottom sheet.
function support(medium = "") {
  const m = medium.toLowerCase();
  if (/on canvas/.test(m)) return "canvas";
  if (/panel|wood|oak|poplar/.test(m)) return "panel";
  if (/paper|cardboard|board|silk/.test(m)) return /silk/.test(m) ? "silk" : "paper";
  if (/fresco|plaster|wall/.test(m)) return "plaster";
  return "canvas";
}

function clean(text) {
  return (text || "").replace(/\r/g, "").replace(/\s+\n/g, "\n").trim();
}

function toPainting(r) {
  const artist = (r.people || []).find((p) => p.role === "Artist") || (r.people || [])[0];
  const img = (r.images || []).find((i) => i.baseimageurl === r.primaryimageurl) || (r.images || [])[0] || {};
  return {
    id: r.id,
    objectnumber: r.objectnumber,
    title: r.title,
    artist: artist ? artist.name : r.culture || "Unidentified artist",
    artistDates: artist ? artist.displaydate || null : null,
    dated: r.dated,
    year: r.datebegin || null,
    century: r.century || null,
    culture: r.culture || null,
    period: r.period || null,
    medium: r.medium || null,
    support: support(r.medium || ""),
    dimensions: clean(r.dimensions).split("\n")[0] || null,
    image: r.primaryimageurl,
    width: img.width || null,
    height: img.height || null,
    alt: img.alttext || null,
    colors: (r.colors || []).map((c) => ({ hex: c.color, hue: c.hue, percent: +c.percent.toFixed(4) })),
    text: clean(r.labeltext || r.description || ""),
    credit: r.creditline || null,
    url: r.url,
    views: r.totalpageviews,
  };
}

const out = [];
for (let n = 1; out.length < TARGET && n <= 5; n++) {
  const data = await page(n);
  for (const r of data.records) {
    if (out.length >= TARGET) break;
    if (!r.primaryimageurl || EXCLUDE.has(r.objectnumber)) continue;
    out.push(toPainting(r));
  }
}

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "paintings.json");
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify({ built: new Date().toISOString(), source: "Harvard Art Museums API", paintings: out }, null, 1));
console.log(`Wrote ${out.length} paintings to data/paintings.json`);
