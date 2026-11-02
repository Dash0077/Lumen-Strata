# Lumen-Strata

**Live site: <https://dash0077.github.io/Lumen-Strata/>**

Lumen-Strata takes paintings apart. Pick one of the sixty most-viewed paintings in the [Harvard Art Museums](https://harvardartmuseums.org) collection, and as you scroll, the canvas splits in 3D into seven transparent sheets, one for each stage of how a painting is traditionally built. Then switch on the **light**: a lamp shines through every sheet, and the image projected on the wall behind them is the painting again.

Built for **CS 85**.

---

## Background: the topic in art history

### Technical art history

A painting is not one surface. It is a sediment of layers laid down over time, and conservators and art historians study each layer with a different instrument. This field is called **technical art history**, and Harvard is one of the places where it began. In the 1920s and 30s, Alan Burroughs X-rayed paintings at the Fogg Museum, and Rutherford John Gettens and George Stout pioneered the scientific study of pigments and paint there. Their work continues today at the Straus Center for Conservation and Technical Studies, which also keeps Edward Forbes's pigment collection.

Each of Lumen-Strata's seven sheets pairs one **stage of making** with the **instrument** used to see it:

| # | Stratum | What the painter did | How conservators see it |
|---|---|---|---|
| 01 | Support | Canvas, oak or poplar panel, paper, plaster | Thread counting in X-rays; dendrochronology (tree-ring dating) of panels |
| 02 | Ground | Glue size + gesso or coloured priming | Cross-sections under the microscope |
| 03 | Underdrawing | Contours and hatching in charcoal or thin paint | Infrared reflectography (IRR), van Asperen de Boer, late 1960s |
| 04 | Dead colouring | Monochrome modelling of light and shadow (chiaroscuro) | X-radiography: lead white blocks X-rays |
| 05 | Colour lay-in | Flat fields of local colour | X-ray fluorescence (XRF), pigment reference collections |
| 06 | Glazes & highlights | Translucent oil films, impasto | Raking light, stereomicroscopy |
| 07 | Varnish & surface | Protective resin varnish | Ultraviolet fluorescence |

The ground changes with the painting's date and support, following broad historical practice: white gesso for panels before about 1550, red-brown imprimatura for Baroque works, buff or grey commercial priming in the early 1800s, and off-white priming for the Impressionists and later.

### Light and the camera obscura

The light toggle makes two arguments:

1. **Light through layers.** Oil paint is partly transparent. Light passes through glazes, reflects off a pale ground and comes back filtered by every layer, which is the source of oil painting's glow. In the viewer, light passes through all seven transparent sheets and lands on the wall as the finished painting. The whole is the sum of its strata.
2. **The camera obscura.** Light entering a dark room through a small opening casts an upside-down image of the outside world. Mozi and Aristotle noted the effect, Ibn al-Haytham explained it, and Della Porta (1558) recommended it to painters. Whether Vermeer used one is still debated (Steadman, *Vermeer's Camera*, 2001; the Hockney–Falco thesis). The **Obscura** lens button flips the projection to show the inversion.

### An honest caveat

The sheets are **computational analogies**, not scans of real paint layers. The Harvard Art Museums API does not publish X-ray or infrared images, so each sheet is generated in your browser from the museum's photograph to show what that stage contributes to the picture. The site says this in the Method section and in a "Here:" note on every sheet.

---

## How it works

### 1. Choosing the paintings (build time)

`scripts/build-data.mjs` queries the Harvard Art Museums API for objects with `classification=Paintings`, `hasimage=1` and `imagepermissionlevel:0` (public-domain images), sorted by the API's own **`totalpageviews`** field. "Popular" is therefore decided by the museum's visitors, not by me. It keeps the top 60 and writes `data/paintings.json` with each painting's title, artist, date, medium, dimensions, label text, image URL and the **colour palette the API measured for that object** (`colors`).

The list includes Van Gogh's *Self-Portrait Dedicated to Paul Gauguin*, Monet's *Gare Saint-Lazare*, Ingres's *Odalisque*, Picasso's *Mother and Child*, Degas, Renoir, Sargent, Beckmann's *Self-Portrait in Tuxedo*, Klimt, Rembrandt, Botticelli, van Eyck, Rubens, Cézanne, Manet, Seurat, Matisse and more.

Because the data is pre-built, the site is fully static. **The API key is used only on my machine when building and never ships to the browser.**

### 2. Splitting a painting into strata (in the browser)

`js/layers.js` loads the museum's image (Harvard's image server allows cross-origin canvas access) at up to 900 px and builds seven `<canvas>` sheets:

| Sheet | Algorithm |
|---|---|
| Support | Procedural texture chosen from the medium line: woven canvas, wood grain, paper fibre or plaster |
| Ground | Historical ground colour for the date and support, with value-noise brush sweeps |
| Underdrawing | Sobel edge detection on blurred luminance, plus diagonal hatching in the deepest shadows |
| Dead colouring | Luminance blurred and posterised into five tonal steps, tinted umber |
| Colour lay-in | Blurred image quantised to the API's measured palette using a "redmean" colour distance |
| Glazes & highlights | High-pass detail (image minus blurred image) plus the brightest highlights, on transparency |
| Surface | The original photograph |

The blurs are separable two-pass box blurs on `Float32Array`s, so the whole dissection takes a fraction of a second.

### 3. The 3D scene (CSS 3D, no WebGL)

`js/viewer.js` places each sheet on its own plane inside a `transform-style: preserve-3d` world. The page has a tall scroll track with a sticky stage, and scroll progress drives the camera:

- **0–20%**: the painting turns from face-on to a three-quarter view
- **20–84%**: the sheets peel apart, surface first and support last, like an excavation. A side card explains each stratum and its instrument.
- **84–100%**: fully exploded, and the light button starts to pulse

**Light on** swings the camera into a side "projector bench" view. A lamp sits in front, a volumetric beam built from 18 stacked translucent planes runs through the sheets, the sheets turn filmy, and the full painting flickers onto a textured wall behind them. **Obscura** rotates the projection 180°.

Motion is smoothed with frame-rate-independent damping, and `prefers-reduced-motion` is respected. The layout adapts to phones, where the note card becomes a bottom sheet.

Below the scroll track, a dossier shows the API's label text, facts, the measured palette as a proportional colour bar, and a link to the object's page on the museum website.

---

## Project structure

```
index.html              Home (hero, collection, method, light essay) and viewer markup
css/style.css           Space-black and white design, 3D cards, viewer, responsive rules
js/main.js              Data loading, hash router, hero stack, gallery filters, starfield
js/viewer.js            Scroll-driven 3D dissection, light projection, dossier
js/layers.js            The seven strata: art-history copy and pixel algorithms
data/paintings.json     60 paintings, generated from the API
scripts/build-data.mjs  Build script that queries the Harvard Art Museums API
assets/favicon.svg
```

## Run locally

Any static file server works:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Rebuild the data

Get a free key at <https://harvardartmuseums.org/collections/api>, then run:

```bash
HARVARD_API_KEY=your-key node scripts/build-data.mjs
```

`COUNT=80` changes how many paintings are kept.

## Deployment

The site is served by **GitHub Pages** from the `main` branch root. There is no build step, so every push to `main` redeploys.

## Credits

Data and images come from the [Harvard Art Museums API](https://harvardartmuseums.org/collections/api). Images are © President and Fellows of Harvard College and are used here for non-commercial educational purposes. Fonts: Instrument Serif, Inter and JetBrains Mono (Google Fonts).
