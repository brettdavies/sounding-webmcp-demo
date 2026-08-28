# Sounding stage — spectral rebuild plan

**Terminology:** [`stage-glossary.md`](stage-glossary.md) · **Product contract:** [`stage-goal.md`](stage-goal.md)

## Problem statement

Replace the flat / legacy solitary-Gerstner homepage ocean with a **mechanism-backed spectral cascade** so the first
viewport reads like the skill reference (`spectral_ocean_reference.jpeg`): teal crest scatter, dark troughs, Jacobian
foam, shared sky reflection. Keep the product story: Mavericks **heat archetype**, one **set wave** at a time through
the buoy, live stats, Pillar Point land from existing assets only.

## Visual contract (skill-router step 1)

| Axis         | Target                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Subject      | Open-water Mavericks **heat**; one **~12–18 m set wave** (face height) every **5–7 s within a set** at the buoy |
| Scale        | Buoy ~3 m; set-wave walls dominate; land secondary silhouette                                                   |
| Camera       | Drone-esque: pulled back, higher, off-axis; **no mouse look** (v1)                                              |
| Motion       | 2-minute compressed heat; background swell + timed **set-wave overlay** pulses                                  |
| Optics       | Spectral cascade shading (derivatives → normals, Jacobian foam history, shared sky)                             |
| Backend      | Skill example **WebGL2 fragment-FFT** compatibility tier first (`public/ocean/*`); WebGPU/TSL later if needed   |
| Frame budget | Design for desktop 60 fps; drop resolution before dropping mechanism                                            |
| Seed         | Fixed `seed` for reproducible captures                                                                          |

**Out of scope for this rebuild:** WebMCP on Sounding, completing OpenAPI/MCP gaps, live deploy, hand-built cliffs,
inventing a new FFT stack.

## Skill routing

| Phase                  | Load                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| Ocean mechanism        | `$threejs-spectral-ocean` → `examples/spectral-cascade-ocean/*`    |
| Framing                | `$threejs-camera-direction` (design frame + authored shot)         |
| Buoy / set-wave motion | `$threejs-procedural-animation` only if springs/phases need it     |
| Acceptance             | `$threejs-visual-validation` (no-post baseline, seed, diagnostics) |

Do **not** invent FFT/spectrum/material. Prefer copy-and-wire from the skill example. Land/station reuse existing Poly
Haven + station massing assets already in `public/`.

## Phases

### Phase 0 — Contract + layout (this doc)

Agree problem, contract, reuse boundaries, acceptance gates.

### Phase 1 — Bare spectral ocean (gate: reference read)

- Entry: `public/scene.js` boots a thin stage module.
- Wire **unchanged** `public/ocean/{fft-pipeline,spectrum,ocean-system,ocean-material,detail-texture}.js`.
- Full-viewport mesh + shared sky dome + sun uniforms shared with material.
- Deterministic seed; `debugMode` uniform exposed (0 = beauty).
- Overlay can stay; stats may be static/placeholder.
- **Gate:** no-post frame shows **background swell** texture, foam streaks, teal scatter / dark troughs — not a flat
  plane.

### Phase 2 — Camera design frame

- Author one **authored view** from subject size (buoy + set-wave **face height**), FOV, near/far planes.
- Horizon stable; sky camera-relative if needed.
- Still no pointer look.

### Phase 3 — Buoy + waterline

- Load existing `public/models/buoy.glb`.
- Sample spectral height at buoy XZ (GPU 1×1 probe preferred).
- Waterline = bottom edge of yellow float (boot-top), not mid-hull.

### Phase 4 — Set-wave overlay + live stats (**locked: hybrid**)

- Continuous spectral cascade stays ambient but **near-flat** (Mavericks is not Atlantic chop).
- Always-on long Gerstner swell provides the readable **background swell**.
- Timed Gerstner **set-wave overlay** pulses roll through the buoy on the **set-wave schedule** (~5–7 s **within-set
  interval**, longer **between-set breath**); **tween waves** between bombs; **lull** sets stay small.
- Wavelength/steepness tuned to roll, not storm pinnacles.
- Overlay live from buoy sample + active scheduled wave.
- **Break line locked** in `public/land/mavericks/meta.json` → `break_line` (peak `(-440, -20)`, polyline over −5…−6 m
  reef; from `.context/pictures/1787862950_pillar-point-diagram.jpg` + DEM). **Set waves** aim at `peak`; **crest line**
  runs along `polyline`.
- Stage **still-water plane** at **MHHW Y = 1.719 m** NAVD88 (harbor MSL = 0.924); DEM terrain under sea (`?focus=sea`).
  **Spectators** **authored view**: `?view=spectators`. Review shots: `{epoch}_{slug}` via `scripts/save-picture.sh`.

### Phase 5 — Land + station

- Existing cliff GLBs (`coastal_cliff_01`, `namaqualand_cliff_01`) + HDRI env (not background).
- Station: optional GLBs per `public/ASSETS.md`, else procedural radome/pad/shed on cliff tip.
- Seat props from cliff bbox top. Coastal breaker skill not required unless waterline becomes the defining view.

### Phase 6 — Visual validation

- Fixed camera + seed manifest.
- No-post baseline; optional spectrum/height/foam debug modes.
- Near / design / far frames; one stress seed; note compromises.

## Module layout (incremental)

```text
public/
  ocean/                 # skill example (source of truth; re-sync from skills)
  stage/
    sea-state.js         # background swell + set-wave overlay constants (client)
    ocean-boot.js        # Phase 1–2 renderer / Three.js Scene / camera / ocean / sky loop
    (later) buoy.js, land.js, heat.js → set-wave.js, height-probe.js
  scene.js               # thin entry (boots stage module)
docs/
  spectral-stage-plan.md # this file
```

## Acceptance gates (incomplete until)

- Deterministic seed / reproducible inputs
- Debug modes for controlling fields (`debugMode` on ocean material)
- Parameters grouped by perceptual role (spectral cascade vs shading vs **set-wave overlay**)
- Intentional resolution tier (e.g. 128 vs 256 cascades)
- No-post baseline still reads as spectral ocean

## Explicit non-goals this pass

- Replacing Worker API surface
- WebGPU migration mid-phase (stay WebGL2 until Phase 1–5 happy)
- Mouse orbit / free look
