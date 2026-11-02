# Lumen-Strata

**Live site: <https://dash0077.github.io/Lumen-Strata/>**

Lumen-Strata is about two crafts that meet on a museum wall: the painter's, who builds a picture one layer of paint at a time, and the lighting designer's, who decides how those layers are finally seen.

Choose a painting from the [Harvard Art Museums](https://harvardartmuseums.org) and scroll. The assembled picture separates in 3D into seven translucent filters, one for each stage of how a painting is traditionally built. The moment they part, the picture is gone: no single sheet holds it. Switch on the **projector** and its beam passes through every filter, so the image comes back together on the wall. Lift sheets out of the beam and the wall shows only what the rest let through, the way a conservator reads a painting one layer at a time.

## Using it

| Action | What happens |
|---|---|
| **Scroll** | The painting turns, then peels apart into seven sheets, surface first |
| **Click a sheet** | Opens it full screen with a before/after slider against the original |
| **Drag** | Orbits the stack (double-click resets) |
| **Light** (or `L`) | Turns on the projector and swings the camera to a side view of the bench |
| **Click a sheet with the light on** | Slides it out of the beam; the wall recomposites |
| **Presets** | *Full painting · Under the varnish · Infrared view · X-ray view · Colour only* |
| **Obscura** (or `O`) | Flips the projection upside down, like a camera obscura |
| `←` `→` | Previous or next painting |

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

The projector makes three arguments:

1. **Light through layers.** Oil paint is partly transparent. Light passes through glazes, reflects off a pale ground and comes back filtered by every layer, which is the source of oil painting's glow. In the viewer, light passes through all seven transparent sheets and lands on the wall as the finished painting. The whole is the sum of its strata.
2. **The camera obscura.** Light entering a dark room through a small opening casts an upside-down image of the outside world. Mozi and Aristotle noted the effect, Ibn al-Haytham explained it, and Della Porta (1558) recommended it to painters. Whether Vermeer used one is still debated (Steadman, *Vermeer's Camera*, 2001; the Hockney–Falco thesis). The **Obscura** lens button flips the projection to show the inversion.
3. **The light table: what the projection is for.** Conservators rarely read one image alone. They register a painting's X-radiograph, infrared reflectogram and ultraviolet photograph over its normal photograph, then switch between them to see which layer holds which decision: a hidden drawing, a changed pose, a later repaint. Lumen-Strata's light table does the same with the seven sheets. Lift sheets out of the beam and the wall shows only the light that passes through what remains. The presets recombine the sheets into those professional ways of seeing: *Infrared view* (drawing on the ground), *X-ray view* (support and the map of lights), *Under the varnish*, and *Colour only*. With no sheets left, only bare lamplight reaches the wall.

### An honest caveat

The sheets are **computational analogies**, not scans of real paint layers. The Harvard Art Museums API does not publish X-ray or infrared images, so each sheet is a light filter generated in your browser from the museum's photograph, holding the kind of information that stage contributes to the picture. The site says this in the Method section ("Are these real paint layers?") and in each sheet's "Read more" note.

---

## How it works

### 1. Choosing the paintings (build time)

`scripts/build-data.mjs` queries the Harvard Art Museums API for objects with `classification=Paintings`, `hasimage=1` and `imagepermissionlevel:0` (public-domain images), sorted by the API's own **`totalpageviews`** field. "Popular" is therefore decided by the museum's visitors, not by me. It keeps the most-viewed works (60 by default) and writes `data/paintings.json` with each painting's title, artist, date, medium, dimensions, label text, image URL and the **colour palette the API measured for that object** (`colors`).

The list includes Van Gogh's *Self-Portrait Dedicated to Paul Gauguin*, Monet's *Gare Saint-Lazare*, Ingres's *Odalisque*, Picasso's *Mother and Child*, Degas, Renoir, Sargent, Beckmann's *Self-Portrait in Tuxedo*, Klimt, Rembrandt, Botticelli, van Eyck, Rubens, Cézanne, Manet, Seurat, Matisse and more.

Because the data is pre-built, the site is fully static. **The API key is used only on my machine when building and never ships to the browser.**

### 2. Splitting a painting into light filters (in the browser)

`js/layers.js` loads the museum's image at up to 900 px. Harvard's image server allows cross-origin canvas access. The browser then turns the image into seven **filters**: each sheet stores, per pixel and per colour channel, the fraction of light it lets through (its transmittance, *T*).

Stacked filters multiply, so their **optical densities** (*D = −ln T*) add. The photograph's density is shared out among the sheets: each takes only the kind of density its stage would hold, and never more than is left. Whatever remains goes to the glazes. As a result:

- **With all seven sheets in the beam,** lamp light × every filter reproduces the photograph (mean error about 0.3/255).
- **No single sheet contains the picture.** The front varnish is a nearly clear amber film.
- **Removing sheets is physically meaningful:** the wall shows exactly the light the remaining filters pass.

| Sheet | Density it takes |
|---|---|
| Support | Weave, wood grain, paper or plaster texture (from the medium line), as a faint tinted filter |
| Ground | A typical priming tint for the date and support, strongest where the brush sweeps are thickest |
| Underdrawing | Grey density along Sobel edges, plus hatching in the deepest shadows |
| Dead colouring | Grey density of the blurred tones, posterised into five steps (a grisaille) |
| Colour lay-in | Colour only: each zone takes the hue of the nearest colour in the API's measured palette, with its brightness removed |
| Glazes & highlights | Everything the other sheets have not absorbed: fine detail, deep shadow, final colour |
| Varnish | A thin, slightly uneven amber tint with a gloss streak; nearly clear |

Each filter is drawn two ways. In the 3D room it is a film: dense areas show their colour and clear areas almost vanish against a faint frosted backing. In the inspector and the Method section it appears as it would on a lightbox.

The heavy lifting is fast. The canvas weave is a cached tile, low-frequency strata are computed at half resolution, the separable box blur is branch-light, and densities use lookup tables. A dissection takes about half a second, and the three most recent are cached.

### 3. The 3D scene (CSS 3D, no WebGL)

`js/viewer.js` places each sheet on its own plane inside a `transform-style: preserve-3d` world. The page has a tall scroll track with a sticky stage, and scroll progress drives the camera:

- **0–20%**: the painting turns from face-on to a three-quarter view
- **20–84%**: the sheets peel apart, surface first and support last, like an excavation. A compact card names each stratum and the instrument used to see it, with longer text behind "Read more".
- **84–100%**: fully exploded, and the light switch starts to pulse

The room is built from CSS planes too: a gridded **floor**, a plaster **wall**, and a **projector** made of six faces with a lens barrel of stacked rings, standing on a pole. Switching the light on blends the scroll camera into a fixed "projector bench" camera, so it works from any scroll position. It also fans the sheets out, turns them filmy, and fills a volumetric beam built from 18 stacked translucent planes.

The **light table** multiplies the transmittances of the sheets still in the beam and draws the result on the wall. With all seven in, that product is the painting. Lifted sheets slide up out of the beam. With the light on, each sheet is also scaled to fill the cone of light at its depth (sheets near the lens shrink, sheets near the wall grow), so that from a point source all seven shadows land in register.

Before the sheets part, a plane showing the assembled product sits at the front of the stack. It fades out the moment they separate, so the picture exists only assembled or on the wall.

The **inspector** shows a sheet full screen, as a filter on a lightbox, clipped against the museum photograph with a draggable range slider. For the varnish sheet it compares the photograph with the product of all the strata beneath it.

Motion is smoothed with frame-rate-independent damping, `prefers-reduced-motion` is respected, and the layout adapts to phones.

### 4. The home page

The design is modelled on modern editorial sites: two typefaces (Instrument Serif and Familjen Grotesk), a full-screen menu, rolling-text hover links, and a hero whose 3D stack is built from the featured painting's real strata. A statement lights up word by word as you scroll, a marquee lists the artists, and the sticky Method section highlights one sheet per step.

---

## Project structure

```
index.html              Home (hero, collection, method, light essay) and viewer markup
css/style.css           Space-black and white design, 3D cards, viewer, responsive rules
js/main.js              Data loading, hash router, hero stack, gallery filters, starfield
js/viewer.js            Scroll-driven 3D dissection, light projection, dossier
js/layers.js            The seven strata: art-history copy and pixel algorithms
data/paintings.json     The paintings, generated from the API
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
