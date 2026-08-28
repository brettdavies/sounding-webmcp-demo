# Stage ground truth

**Parent:** [`stage-goal.md`](stage-goal.md) · **Source of truth:** `public/land/mavericks/meta.json` · **Terminology:**
[`stage-glossary.md`](stage-glossary.md)

The world is **Pillar Point / Mavericks, California** — not a generic coast. All **stage locks** (pins, datums, break
line) trace to the datasets below.

---

## Rules

1. **Ground truth wins** — locks in `meta.json`, tide datums, and cited sources override convenience, aesthetics, or
   agent guesses.
2. **Improve before inventing** — when something looks wrong, first **reconcile or extend authoritative data** (DEM
   sample, diagram pin, tide datum, contour, ortho alignment). Only then adjust shaders, cameras, or procedural fill.
3. **Never override silently** — do not move break peak, mooring, station, spectators, swell bearing, or still-water
   datum without updating `meta.json`, citing the source, and noting the change in a commit.
4. **Synthetic ≠ fictional** — the **set-wave schedule** in `mavericks-heat.json` defines a **compressed heat
   archetype** grounded in historical big-wave reports; it is not a replay of a dated contest day and must remain
   consistent with reef geometry and WNW swell climatology.
5. **Procedural stand-ins are labeled** — placeholders (radome pad, harbor mesh, cliff GLB) are acceptable for async
   assets but must not contradict DEM scale, station position, or shoreline contact.

When sources disagree, **stop and reconcile** — do not pick the value that looks best in-frame.

---

## Authoritative sources (priority order)

| Priority | Source                                                                                   | What it locks                                                |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1        | `public/land/mavericks/meta.json`                                                        | Grid frame, UTM origin, pins, break line, tide notes         |
| 2        | `public/land/mavericks/height.f32`                                                       | Per-cell NAVD88 elevation (runtime terrain)                  |
| 3        | USGS DS 684 `DEM_1` Half Moon Bay (see inventory)                                        | Source topography/bathymetry                                 |
| 4        | NOAA CO-OPS **9414131** Pillar Point Harbor                                              | MLLW / MSL / MHHW still-water datums                         |
| 5        | CA DFW **NAIP_2022** ortho + `albedo.png` bake                                           | Planform color on DEM UV                                     |
| 6        | `masks.png` + **Poly Haven** CC0 cliff/rock textures                                     | Steep-face / shore / subtidal material slots (shader + bake) |
| 7        | **Sketchfab** + **Poly Haven** GLBs (see inventory)                                      | Buoy, seated cliff scrapes, station props (enhancement only) |
| 8        | Diagram + photo refs (`.context/pictures/`)                                              | Break polyline, reef focus, cliff QA targets                 |
| 9        | USCG **Sail Rock** 37°29′34″N 122°30′02″W                                                | `break_line.rocks` pin                                       |
| 10       | `docs/stage-backlog.md`, `docs/stage-runtime-contract.md`, `docs/spectral-stage-plan.md` | Phased work, perf policy, ocean mechanism                    |

---

## Locked stage contract (`meta.json`)

| Mark                    | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Still water (stage)     | **MHHW Y = 1.719 m** NAVD88 (harbor MSL = 0.924)   |
| Break peak              | **(−440, −20)** — reef **≈ −4.7 m**                |
| Break rocks (Sail Rock) | **(−338, −197)** — shoal **≈ 1.1 m**               |
| Buoy mooring            | break peak                                         |
| Spectators              | **(−100, +100)**, ground **≈ 3 m**, eye **+2.5 m** |
| Station                 | **(−182, +322)**, Y **48.65 m** (DEM-verified)     |
| Swell                   | **285°**, ~18 s period (heat archetype)            |

Full polyline, frame formulas, and sources: `public/land/mavericks/meta.json`.

---

## Geospatial inventory

Canonical numbers live in `meta.json`. **If they diverge, `meta.json` wins** until reconciled and committed.

### Elevation grid (`height.f32`)

| Field                        | Value                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Source product**           | USGS Data Series **684** (DS 684), **`DEM_1`** layer, Half Moon Bay / Pillar Point environs                                           |
| **Native posting**           | **2 m** (`DEM_1`); stage grid **resampled to 4 m** (“2 m → 4 m crop” per `mavericks-terrain.js`)                                      |
| **Vertical datum**           | **NAVD88** (orthometric heights, meters)                                                                                              |
| **Horizontal**               | **UTM zone 10N** (WGS 84)                                                                                                             |
| **Grid size**                | **1000 × 1000** cells                                                                                                                 |
| **Cell size**                | **4.0 m** (`pixel_m`)                                                                                                                 |
| **Coverage**                 | **≈ 3.996 km × 3.996 km** (999 × 4 m spans)                                                                                           |
| **UTM origin (grid corner)** | **E 542 490 m**, **N 4 151 852 m**                                                                                                    |
| **Elevation span in crop**   | **−37.0 m … +112.1 m** NAVD88 (`z_min` / `z_max`)                                                                                     |
| **Runtime asset**            | `public/land/mavericks/height.f32` — `float32`, row-major, **4 000 000** samples                                                      |
| **Stage frame**              | Local **XZ** meters, origin at grid center; **+Y** = NAVD88 up; mesh = `PlaneGeometry` with `Y = h(x,z)`                              |
| **Local axes**               | **+X** = east; **+Z** = north (increasing northing); **−Z** = toward open Pacific / reef                                              |
| **WGS 84 bounds (crop)**     | **NW** 37.512638°N 122.519210°W · **NE** 37.512445°N 122.473996°W · **SW** 37.476621°N 122.519441°W · **SE** 37.476428°N 122.474248°W |
| **Crop in full `DEM_1`**     | NW corner at **col 3003, row 1200** in native **2 m** grid (full `DEM_1` origin E 536 484, N 4 154 252)                               |
| **Max slope in crop**        | **≈ 81°** (E–W face; full 4 m posting — no LOD)                                                                                       |

**Coverage intent:** Pillar Point hook, AFS tracking station plateau, Mavericks reef / fallaway, harbor-side shore, and
offshore shelf sufficient for fallaway and reef hero views.

**Source citation:** Foxgrover & Barnard, USGS Data Series 684 — [doi:10.3133/ds684](https://doi.org/10.3133/ds684),
[pubs.usgs.gov/ds/684/](https://pubs.usgs.gov/ds/684/).

### Ortho / albedo

| Field                             | Value                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Ortho source**                  | California DFW **`NAIP_2022`** via ImageServer export (`meta.ortho`)                                 |
| **NAIP native GSD**               | **≈ 0.6 m** (standard NAIP 2022); stage ortho is a **downsampled export**, not native posting        |
| **Reference master**              | `public/land/mavericks/ortho.jpg` — **1024 × 1024** JPEG (~3.9 m/px over crop)                       |
| **Runtime albedo**                | `public/land/mavericks/albedo.png` — **1000 × 1000** PNG, **resampled to DEM grid (4 m/post)**       |
| **Cliff enhancement (textures)**  | **Poly Haven** CC0 **`rock_face_03`** (and related) mixed on steep cells via shader + `masks.png` R  |
| **Cliff enhancement (geometry)**  | Optional seated **Sketchfab** or **Poly Haven** cliff GLBs on steep mask cells — see third-party art |
| **Not a substitute for geometry** | Ortho provides planform color; **cliff steepness comes from `height.f32`**, not texture alone        |

### Slope / material masks (`masks.png`)

| Channel | Meaning                  | Derived from                 |
| ------- | ------------------------ | ---------------------------- |
| **R**   | Cliff / steep rock faces | DEM slope + aspect           |
| **G**   | Subtidal / reef shelf    | Depth below MHHW             |
| **B**   | Shore / beach wedge      | Intertidal band + harbor toe |

Used for cliff albedo overlay and future foam/shoreline gates. Paths: `public/land/ASSETS.md`.

### Tide datums (NOAA 9414131 — Pillar Point Harbor)

Station **9414131** (NOAA CO-OPS; lat 37.5025°N, lon 122.48217°W). API datums epoch **1983–2001**, orthometric
**NAVD88** ([datums.json](https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9414131/datums.json)):

| Datum    | NAVD88 Y (m) | API (ft) | Stage use                                                                                                                |
| -------- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| **MLLW** | **0.012**    | 0.04     | Reference only                                                                                                           |
| **MSL**  | **0.924**    | 3.03     | Documented harbor mean; not the still-water plane                                                                        |
| **MHHW** | **1.719**    | 5.64     | **Still-water plane** at Y = **1.719 m** NAVD88 (code constant `MSL_Y`) — fills troughs without draining cliff-toe shelf |

### Named pins (local XZ meters, NAVD88 Y where noted)

Local **+Z = north** (toward plateau / harbor headland); **−Z = south** (toward Pacific reef). All elevations verified
by sampling `height.f32` at full **4 m** posting (2026-08-27 reconciliation).

| Mark                  | Local (X, Z)     | DEM Y / note                       | Provenance                                             |
| --------------------- | ---------------- | ---------------------------------- | ------------------------------------------------------ |
| **Pillar / station**  | (−182, **+322**) | plateau **48.65 m**                | UTM **(544 306, 4 150 176)**; Pillar Point AFS plateau |
| **Break peak**        | (−440, −20)      | reef **≈ −4.7 m**                  | Diagram + DEM −5…−6 m contour band                     |
| **Sail Rock / rocks** | (−338, **−197**) | shoal **≈ 1.1 m**                  | USCG 37°29′34″N 122°30′02″W → UTM (544 150, 4 149 657) |
| **Spectators**        | (−100, **+100**) | ground **≈ 3.0 m**, eye **+2.5 m** | Harbor-facing dry sand above MHHW; diagram beach toe   |
| **Break polyline**    | 5 verts N→SSW    | vertices **−4.7 … −6.6 m**         | Diagram + wave-energy ref + DEM contour                |

Full polyline vertices, frame formulas, and `break_line.source[]` citations: `meta.json` → `frame`,
`reconciliation_2026_08_27`.

### Bathymetry / reef bands (from DEM, not invented)

| Band                 | Depth (NAVD88 below MHHW plane)    | Role                        |
| -------------------- | ---------------------------------- | --------------------------- |
| Reef crest / corner  | **−4.5 … −6.5 m** (`depth_band_m`) | Where set waves focus       |
| Inner reef / fingers | **−8 … −16 m** (typical in crop)   | Mavericks finger bathymetry |
| Outer shelf          | **≈ −30 m** (FFT depth proxy)      | Open-water swell approach   |
| Deep Pacific         | **≤ −37 m** (crop min)             | Fallaway floor              |

### Review / diagram assets (QA targets)

| Asset                                                   | Role                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `.context/pictures/1787862950_pillar-point-diagram.jpg` | “Waves Break Here”, spectators, rocks                                           |
| `.context/pictures/1787862980_wave-energy.jpeg`         | Reef refraction / energy focus                                                  |
| `.context/pictures/*` cliff and coast photos            | Near-vertical wall acceptance targets                                           |
| `.context/topo/`                                        | Gitignored USGS GeoTIFF + NAIP masters used to build `height.f32` / `ortho.jpg` |

---

## Third-party art (enhancement only)

Two primary download sources. **Neither replaces DEM geometry** — they add PBR detail on top of `height.f32`.

### Poly Haven ([polyhaven.com](https://polyhaven.com)) — CC0

No account required. Agent may pull CC0 assets without asking.

| Role                           | In repo                                                    | Notes                                              |
| ------------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| Cliff / rock **textures** (2k) | `public/textures/cliff/`, `rock/`, `beach/`, `seafloor/`   | e.g. `rock_face_03` — runtime shader + albedo bake |
| Cliff **GLBs**                 | `public/models/coastal_cliff_01/`, `namaqualand_cliff_01/` | Seated scrapes on steep `masks.png` R cells        |
| **HDRI**                       | `public/hdri/` (when present)                              | e.g. `salt_rock_beach_cloudy`                      |

Catalogued in `public/land/ASSETS.md`.

### Sketchfab ([sketchfab.com](https://sketchfab.com)) — licensed downloads

Requires account; **check license per model** (prefer Free Standard or CC-BY with attribution). User drops GLBs into
`public/models/`; agent wires loaders only.

| Role                          | In repo                                 | Notes                                                             |
| ----------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| **Buoy**                      | `public/models/buoy.glb`                | Oceanographic Buoy MSM — Gerard Llorach / ICATMAR (Free Standard) |
| **Station / coast** (backlog) | `radome.glb`, `station-building.glb`, … | User-sourced; see [`stage-backlog.md`](stage-backlog.md)          |

Record attribution strings in commit messages or overlay credits when a Sketchfab license requires it.

---

## Reconciliation log (2026-08-27)

**Root cause:** Several pins used **inverted local Z** (treated south as north). The Three.js mesh maps grid row 0 to
**local Z = +1998 m** (northwest / high northing); **+Z is north**, not south.

| Pin              | Was (wrong)        | Now (DEM-verified)     | DEM sample        |
| ---------------- | ------------------ | ---------------------- | ----------------- |
| Station / pillar | (−182, −322)       | (−182, **+322**)       | **48.65 m**       |
| Pillar UTM       | 544 490, 4 149 850 | **544 306, 4 150 176** | plateau cell      |
| Sail Rock        | (−338, +197)       | (−338, **−197**)       | **≈ 1.1 m**       |
| Spectators       | (−100, −100)       | (−100, **+100**)       | **≈ 3.0 m** (dry) |
| Break peak/poly  | unchanged          | on **−5…−6 m** reef    | already correct   |

**Committed in `meta.json`.** Code still at baseline `d0f7805` — cameras (`MAVERICKS_VIEWS.station`, `spectators`,
`cliff`) and `sea-state.js` `BREAK_ROCKS` read from `mavericks-pins.js` fallbacks; runtime boot resolves via
`extractPins(meta)`.

---

## Cliff fidelity (requirement)

The USGS **DS 684 `DEM_1`** grid at **native 4 m posting** (2 m source resampled) contains cells at **~60–73°** on the
west face and tip. Reference photos show **near-vertical** rock walls. The shipped stage **must** reproduce that read in
`fallaway`, `cliff`, `shore`, and `reef` views.

**Acceptance:** side-by-side with `.context/pictures/` reference captures — cliffs are faceted and steep, not rounded
hills with ortho draped on them.

**Implementation (grounded in data, not fiction):**

1. **Full native DEM mesh** — `terrainStride: 1` always (4 m posts); no perf LOD on terrain in v1.
2. **Seated cliff scrapes** (optional enhancement) — **Sketchfab** or **Poly Haven** cliff GLBs on steep mask cells from
   `masks.png` R channel, anchored to DEM normals — adds texture detail **on top of** correct geometry, not instead of
   it.
3. **Heightfield limits** — single-valued Y per XZ cannot model overhangs; do not invent overhangs. Do preserve maximum
   slope the DEM supports at full resolution.

Perf regressions from full terrain are solved by **ocean tiering, async assets, and draw-order** — not by coarsening
land. See [`stage-runtime-contract.md`](stage-runtime-contract.md) — reality > performance.
