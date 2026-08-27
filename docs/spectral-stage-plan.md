# Sounding stage — spectral rebuild plan

## Problem statement

Replace the flat / solitary-Gerstner homepage ocean with a **mechanism-backed spectral cascade** so the first viewport
reads like the skill reference (`spectral_ocean_reference.jpeg`): teal crest scatter, dark troughs, Jacobian foam,
shared sky reflection. Keep the product story: Mavericks heat archetype, one giant face at a time, buoy waterline + live
stats, Pillar Point land from existing assets only.

## Visual contract (skill-router step 1)

| Axis         | Target                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Subject      | Open-water Mavericks heat; one ~12–18 m face every 5–7 s through the buoy                                     |
| Scale        | Buoy ~3 m; faces dominate; land secondary silhouette                                                          |
| Camera       | Drone-esque: pulled back, higher, off-axis; **no mouse look** (v1)                                            |
| Motion       | 2-minute compressed heat; continuous spectral sea + timed face events                                         |
| Optics       | Spectral cascade shading (derivatives → normals, Jacobian foam history, shared sky)                           |
| Backend      | Skill example **WebGL2 fragment-FFT** compatibility tier first (`public/ocean/*`); WebGPU/TSL later if needed |
| Frame budget | Design for desktop 60 fps; drop resolution before dropping mechanism                                          |
| Seed         | Fixed `seed` for reproducible captures                                                                        |

**Out of scope for this rebuild:** WebMCP on Sounding, completing OpenAPI/MCP gaps, live deploy, hand-built cliffs,
inventing a new FFT stack.

## Skill routing

| Phase              | Load                                                               |
| ------------------ | ------------------------------------------------------------------ |
| Ocean mechanism    | `$threejs-spectral-ocean` → `examples/spectral-cascade-ocean/*`    |
| Framing            | `$threejs-camera-direction` (design frame + authored shot)         |
| Buoy / face motion | `$threejs-procedural-animation` only if springs/phases need it     |
| Acceptance         | `$threejs-visual-validation` (no-post baseline, seed, diagnostics) |

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
- **Gate:** no-post frame shows chop, foam streaks, teal scatter / dark troughs — not a flat plane.

### Phase 2 — Camera design frame

- Author one drone shot from subject size (buoy + face height), FOV, near/far.
- Horizon stable; sky camera-relative if needed.
- Still no pointer look.

### Phase 3 — Buoy + waterline

- Load existing `public/models/buoy.glb`.
- Sample spectral height at buoy XZ (GPU 1×1 probe preferred).
- Waterline = bottom edge of yellow float (boot-top), not mid-hull.

### Phase 4 — Heat face + live stats (**locked: hybrid**)

- Continuous spectral cascade stays ambient but **near-flat** (Mavericks is not Atlantic chop).
- Always-on long Gerstner swell provides the readable in-between sea.
- Timed solitary Gerstner faces roll through the buoy on set schedule (~5–7 s within set, longer breath between sets);
  tween faces between bombs; lull labels stay small.
- Face wavelength/steepness tuned to roll, not storm pinnacles.
- Overlay live from buoy sample + active heat event.
- **Break line locked** in `public/land/mavericks/meta.json` → `break_line` (peak `(-440, -20)`, polyline over −5…−6 m
  reef; from `.context/pictures/pillar-point-diagram.jpg` + DEM). Faces aim at `peak`; crest runs along `polyline`.

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
    sea-state.js         # spectrum + heat constants (client)
    ocean-boot.js        # Phase 1–2 renderer/scene/camera/ocean/sky loop
    (later) buoy.js, land.js, heat.js, height-probe.js
  scene.js               # thin entry
docs/
  spectral-stage-plan.md # this file
```

## Acceptance gates (incomplete until)

- Deterministic seed / reproducible inputs
- Debug modes for controlling fields (`debugMode` on ocean material)
- Parameters grouped by perceptual role (spectrum vs shading vs heat)
- Intentional resolution tier (e.g. 128 vs 256 cascades)
- No-post baseline still reads as spectral ocean

## Explicit non-goals this pass

- Replacing Worker API surface
- WebGPU migration mid-phase (stay WebGL2 until Phase 1–5 happy)
- Mouse orbit / free look
