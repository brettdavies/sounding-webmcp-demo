# Stage product spec

**Parent:** [`stage-goal.md`](stage-goal.md) · **Terminology:** [`stage-glossary.md`](stage-glossary.md) · **Mechanism
detail:** [`spectral-stage-plan.md`](spectral-stage-plan.md)

Break morphology, work domains, and Three.js skill routing.

---

## Break morphology & foam (locked product)

Mavericks is **not** a straight Gerstner line repeating forever. Each **set wave** should read as a **reef-focused
break** that varies wave-to-wave while staying geodetically grounded. Pins and polyline:
[`stage-ground-truth.md`](stage-ground-truth.md).

### Target (visual)

| Phenomenon            | Target                                            |
| --------------------- | ------------------------------------------------- |
| **Crest line**        | Curved, refracted — follows `break_line.polyline` |
| **Break variety**     | Spill, plunge, occasional tube on bombs (~15%)    |
| **Whitewash (reef)**  | Jacobian + lip foam; comes and goes with sets     |
| **Whitewash (shore)** | Pulses near spectator beach; not a permanent band |
| **Spray (buoy)**      | Mist burst on set-wave impact; off in lulls       |

### Baseline gap (`d0f7805`)

- Set-wave overlay = **1D Gerstner** + crest position (`heatCrestAlong` until P0 rename) → reads as straight **crest
  line** (should follow polyline)
- Foam = cascade Jacobian + set-wave threshold — no shore mask, no spray
- No per-wave break style (spill / plunge / tube)

### Implementation approach (no fluid sim)

1. **Break field** — depth proxy from DEM; phase delay in shallow water; polyline focus.
2. **Break style** — per-wave spill / plunge / tube from deterministic seed.
3. **Whitewash** — reef Jacobian + shore mask with temporal decay.
4. **Buoy spray** — instanced billboards on buoy kinematics.

---

## Discrete work domains

| Domain               | Scope                                             | Primary modules / assets                                                        | Done when                                                                               |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Land**             | DEM terrain, albedo, cliff materials, masks       | `public/land/mavericks/*`, `mavericks-terrain.js`                               | Tip ~49 m; reef bathymetry reads; **vertical cliff read** in hero views; fallaway holds |
| **Water / datum**    | Still-water plane, tide fill, shoreline contact   | `sea-state.js` (still-water Y = MHHW; code `MSL_Y`), ocean mesh, shoreline clip | No dry shelf at cliff toe; no water on dry sand; MHHW documented                        |
| **Background swell** | Spectral FFT cascade + long-period Gerstner sea   | `public/ocean/*`, `ocean-material.js`                                           | Near-flat between set waves; teal/dark read; Jacobian foam on reef                      |
| **Set waves**        | Set structure, set-wave overlay, break focus      | `heat.js`, `mavericks-heat.json`, `meta.break_line`                             | Curved crest line; varied break styles; 5–7 s within set; 2 min heat loop               |
| **Break & foam**     | Crest shape, curl/tube, spray, shore whitewash    | `ocean-material.js`, `heat.js`, future modules                                  | No straight infinite crest; foam pulses with sets; spray on bombs                       |
| **Buoy**             | Model, mooring, heave/pitch/yaw, waterline, spray | `buoy.js`, `height-probe.js`, `BUOY_XZ`                                         | Tracks wave surface; never airborne; waterline on hull lip                              |
| **Station**          | Radome, sheds, dish, mast on DEM plateau          | `mavericks-terrain.js`, optional GLBs                                           | Props at reconciled `station_local`; ~12 m dome                                         |
| **Atmosphere**       | Sun, HDRI env, fog, exposure                      | HDRI, directional light                                                         | Shared radiance on ocean + cliffs                                                       |
| **Camera**           | Authored views, `?view=`, `setView`               | `MAVERICKS_VIEWS`                                                               | fallaway default; spectators dry sand                                                   |
| **UI / API**         | Overlay, `/api/reading`                           | HTML overlay, Worker route                                                      | Live stats match stage state                                                            |
| **Performance**      | Progressive boot, 120 fps                         | future `boot-budget.js`, quality tiers                                          | <100 ms first frame; full stage ≤3 s; ≥120 fps at settle                                |
| **Debug / QA**       | Layer panel, captures                             | `scripts/save-picture.sh`                                                       | Epoch captures per view; no regressions                                                 |

---

## Three.js skills

**SoT:** `.cursor/skills/threejs-skill-router/SKILL.md` (full skill table + Sounding quick route).

**Harness:** `.cursor/rules/stage-graphics.mdc` auto-attaches on `public/stage/**`, `public/ocean/**`, `public/land/**`.

**P0 task:** complete router inventory for all 35 project skills — [`stage-backlog.md`](stage-backlog.md) P0.
