# Stage runtime contract

**Parent:** [`stage-goal.md`](stage-goal.md) · **Terminology:** [`stage-glossary.md`](stage-glossary.md)

Boot behavior, URL params, debug UI, performance budget, evidence gate, and scoring dimensions.

---

## Reality > performance

**The illusion of reality is not negotiable.** The stage is built from pinned USGS bathymetry/topography, NOAA harbor
datums, NAIP ortho, and diagram-derived reef marks — see [`stage-ground-truth.md`](stage-ground-truth.md). **120 fps and
fast boot are goals; melting cliffs to hit them is a failure.**

Performance work must **tune around** fidelity, not **trade away** fidelity:

| Allowed (does not break land read)              | Forbidden (breaks land read)                                          |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Ocean FFT resolution / segment tiers            | DEM stride coarser than **4 m** (native cell size) on visible terrain |
| Async HDRI, GLB, set-wave schedule              | Subsampling heightfield vertices in cliff / shore / fallaway views    |
| Skip ocean FFT updates for a few frames at boot | Averaging cliff **rock faces** into gentle heightfield slopes         |
| Lazy module load, placeholder sky/ocean plane   | Ortho-only cliffs with no geometric steepness                         |
| Buoy spray / foam off until ramp settles        | Moving station or break pins to “look better”                         |

If frame budget conflicts with cliff fidelity, **reduce ocean cost first**, then shadows/post — **never** coarsen the
DEM mesh in views where cliffs are on screen.

---

## Evidence gate (every slice)

Do **not** advance backlog phases until the evidence gate is satisfied for the current slice:

1. **Data logs** — console or `window.__soundingBoot` / `?debug=perf` marks recorded in the commit message (**always**).
2. **Screenshot** — **visual slices only** — `scripts/save-picture.sh` → `.context/pictures/{epoch}_{slug}` (50% pixel
   dimensions + JPEG by default). The image must demonstrate the slice change (matching URL/view/debug/UI), not an
   arbitrary frame. **Non-visual slices** (rename-only, verify scripts, docs, wiring with no render delta): omit
   screenshot; write `Screenshot: n/a (non-visual)` in the commit body.
3. **Commit** — one conventional commit on the feature branch (**always**).

Operational steps (template, granularity, memory updates): `.cursor/rules/stage-slices.mdc` ·
`.cursor/commit-template-stage.md`.

If a slice regresses a prior gate, **stop**, revert or fix, re-capture, and recommit before continuing.

---

## Boot & URL contract

### Target: default loads everything

**Bare URL** (`/` or `/?view=fallaway`) must boot the **full stage**:

- USGS DEM terrain + albedo
- Spectral ocean at MHHW
- **Set-wave overlay** at break peak (scheduled waves within the heat loop)
- Moored buoy
- HDRI / sun / sky
- Overlay + `/api/reading`

No query param required for the complete demo.

### Current baseline (P3 default boot)

| URL           | Actual boot today                                                        |
| ------------- | ------------------------------------------------------------------------ |
| *(none)*      | Full stage (`ocean-boot-sea.js`) — DEM + ocean + set-wave overlay + buoy |
| `?focus=land` | Land-only (`land-asset-boot.js`) — DEM terrain QA without ocean FFT      |
| `?focus=sea`  | Full stage (legacy alias during transition)                              |

Integrated QA and captures may use bare URL or `?focus=sea`.

### `?focus` (target semantics)

| URL           | Target boot | Use                                      |
| ------------- | ----------- | ---------------------------------------- |
| *(none)*      | Full stage  | **Default** — homepage, QA, captures     |
| `?focus=land` | Land-only   | Terrain/albedo QA without ocean FFT cost |
| `?focus=sea`  | Full stage  | Legacy alias during transition           |

### Other URL params

| Param                   | Effect                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `?view=`                | Authored camera: `fallaway`, `reef`, `spectators`, `station`, …                 |
| `?debug=perf`           | Frame EMA, fps, boot marks on `window.__soundingBoot` (when implemented)        |
| `?debug=1…4`            | Ocean shader diagnostic modes (`4` = shoreline margin: blue=water, red=clipped) |
| `?nopanel` / `?panel=0` | Hide layer panel (when implemented)                                             |
| `?seed=`                | Override deterministic seed (default `46012`)                                   |
| `?loop_t=`              | Seek time in the compressed **heat loop** (seconds) for QA                      |

Runtime (sea stage): `window.__soundingSea.setView(name)`.

**No mouse look (v1)** — cameras are authored only.

---

## Debug UI (layer panel) — target

Full stage should expose a **Layers** panel (top-right) unless `?nopanel` or `?panel=0`.

| Control       | Effect                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Stage toggles | terrain mesh, buoy, spray, sky, HDRI IBL, sun                                                                                |
| Ocean toggles | ocean mesh, FFT cascade, background swell, set-wave overlay, break refraction, shoreline clip, beach mask, foam, detail chop |
| Shader mode   | Beauty, FFT height, normals, Jacobian, foam composite                                                                        |
| URL           | `?no=set-wave,foam` disable (legacy `?no=heat` until P0 rename); `?layers=terrain,ocean` enable only listed                  |

Perf telemetry: `?debug=perf` → boot marks + frame budget.

**Not implemented at baseline.** See [`stage-backlog.md`](stage-backlog.md) P3.

---

## Progressive bootstrap & perf budget (target)

| Milestone            | Wall clock    | What the user sees                       |
| -------------------- | ------------- | ---------------------------------------- |
| **First frame**      | **<100 ms**   | Sky + camera + placeholder terrain/ocean |
| **Progressive ramp** | **0–1000 ms** | Segments ↑, FFT 64→128, async HDRI/GLB   |
| **Fully ready**      | **≤2000 ms**  | Full default stage                       |
| **Steady-state**     | **≥120 fps**  | After settle                             |

### Perf budget — land is exempt from coarsening

Terrain uses **full 4 m DEM** at all quality tiers. Progressive boot may show a **flat placeholder** or low-detail
**silhouette** for <100 ms first frame, but the swap to final terrain must be **full stride** before any cliff QA
capture.

Ocean, spray, foam, and HDRI may tier down during ramp; **land geometry may not.**

---

## Dimensions (how we score every change)

| Dimension             | Target                                                                                                       | Hard constraints                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Ground truth**      | Every lock traceable to DEM, datum, diagram, or cited source                                                 | No silent overrides; reconcile before shader hacks                         |
| **Geodetic fidelity** | DS 684 `DEM_1` @ 4 m NAVD88; NOAA 9414131 datums; break line from diagram + −5…−6 m contour; WNW ~285° swell | Locks in `meta.json` + [`stage-ground-truth.md`](stage-ground-truth.md)    |
| **Hyperrealism**      | NAIP ortho + PBR cliffs; set-wave **face heights** **12–18 m** archetype                                     | Buoy ~3 m; cliffs ~40–52 m                                                 |
| **Performance**       | 120 fps steady-state; never block first frame                                                                | Ramp 0–2 s; **ocean/FX tiers only** — terrain stays full-res in hero views |
| **Stability**         | Zero tearing, shearing, z-fight, shimmer                                                                     | Fix root cause                                                             |
| **Load time**         | <100 ms first frame; ≤3 s full **stage** on **default boot**                                                 | Progressive placeholder → full by 2 s                                      |
| **Controls**          | Boot & URL contract above                                                                                    | Seed `46012` for captures                                                  |
| **Product**           | “Mavericks heat — compressed”; Pillar Point place name                                                       | Not NDBC replay by default                                                 |
