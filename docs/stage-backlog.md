# Stage backlog

**Parent:** [`stage-goal.md`](stage-goal.md) · **Terminology:** [`stage-glossary.md`](stage-glossary.md)

Phased implementation order, async user assets, and definition of done. Each slice passes the
[evidence gate](stage-runtime-contract.md#evidence-gate-every-slice) per `.cursor/rules/stage-slices.mdc`.

---

## Phased backlog

### P0 — Shoreline integrity (current priority)

- [x] **Skill router inventory** — all 35 `.cursor/skills/` entries routed in `threejs-skill-router` (+ Sounding quick
  route)
- [ ] Ocean height mask vs DEM (no water on land, no dry cliff shelf in trough)
- [ ] GPU displacement aligned with CPU buoy sample
- [ ] All `MAVERICKS_VIEWS` verified at MHHW
- [x] **Station / pillar XZ ↔ DEM elevation reconciled** (`meta.json` 2026-08-27)
- [ ] Wire reconciled pins into `mavericks-terrain.js` views, `sea-state.js`, buoy mooring QA
- [ ] **Rename code to match [`stage-glossary.md`](stage-glossary.md)** — set-wave overlay vocabulary (see scope below)

#### P0 — Glossary code rename (scope)

Align identifiers with surf terms. **Keep** session-level names (`mavericks-heat.json`, heat loop in API copy).

| Current                                                                                                             | Target (doc term)                                       |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `public/stage/heat.js`                                                                                              | `set-wave.js` (or split schedule vs overlay helpers)    |
| `buildHeatSchedule`, `sampleHeat`, `HeatEvent`                                                                      | `buildSetWaveSchedule`, `sampleSetWave`, `SetWaveEvent` |
| `heatDisplacementAt`, `applyHeatUniforms`, `idleHeat`                                                               | `setWaveDisplacementAt`, `applySetWaveUniforms`, …      |
| `ocean-material.js` uniforms `heatActive`, `heatAmplitude`, `heatK`, `heatWidth`, `heatCrestAlong`, `heatDirection` | `setWave*` (shader + GLSL must stay in sync)            |
| `heatGerstnerGlsl`, `heatDisplacement`, `heatHeightVarying`, …                                                      | `setWave*`                                              |
| Imports/callers                                                                                                     | `ocean-boot-sea.js`, tests, comments                    |

One evidence-gated commit; no behavior change — rename only. Update glossary
[Code aliases](stage-glossary.md#code-aliases-legacy) when done.

### P0b — Cliff / terrain fidelity (blocks perf work that touches land)

- [ ] **`terrainStride: 1` only** — remove or ban any terrain subsampling LOD
- [ ] Cliffs in `fallaway`, `cliff`, `shore`, `reef` match reference photos (near-vertical, not melted hills)
- [ ] Optional seated cliff GLBs on steep mask cells — enhancement only, DEM geometry unchanged underneath
- [ ] Cliff QA captures in manifest before any ocean perf tier ships

### P1 — Set-wave readability & break shape

- [ ] Curved crest along `break_line.polyline`
- [ ] Per-wave **break style** (spill / plunge / tube)
- [ ] Lip/foam Jacobian visible; tube read on bombs
- [ ] Overlay view + wave tag consistent

### P1b — Foam, spray, shore wash

- [ ] Shore whitewash mask + temporal decay
- [ ] Reef whitewash: cascade history + set-wave lip
- [ ] Buoy spray on set-wave impact
- [ ] QA: no permanent white band at beach; spray off in lulls

### P2 — Land polish

- [ ] Station props (radome GLB priority)
- [ ] Harbor breakwater silhouette if DEM allows
- [ ] Slope-aware wet sand strip (optional)

### P3 — Boot, default URL, debug UI, 120 fps

- [ ] **Default boot = full stage** (invert current land/sea split)
- [ ] `boot-budget.js` marks; `window.__soundingBoot`
- [ ] Layer panel (`layer-controls.js`); URL + runtime toggles
- [ ] Placeholder-first path <100 ms verified
- [ ] Quality ramp 0–2 s without blocking HDRI/GLB
- [ ] ≥120 fps steady-state via **ocean/FX tiers**; `?debug=perf`
- [ ] Perf tuning **must not** reintroduce terrain stride LOD (see
  [reality > performance](stage-runtime-contract.md#reality--performance))

### P4 — Visual validation manifest

- [ ] `docs/qa-manifest.json` on default URL
- [ ] Capture script: load → 4 views → save pictures (<20 s)
- [ ] Stress seed + low-end tier snapshot

### P5 — Optional upgrade path

- [ ] WebGPU/TSL spectral tier (after WebGL2 gates green)
- [ ] Coastal breaker skill if shore becomes hero

---

## Async asset backlog (user — non-blocking)

| Priority | Asset            | Path                                 |
| -------- | ---------------- | ------------------------------------ |
| P0       | Golf-ball radome | `public/models/radome.glb`           |
| P1       | Station shed     | `public/models/station-building.glb` |
| P2       | Satellite dish   | `public/models/satellite-dish.glb`   |
| P3       | Radio mast       | `public/models/radio-tower.glb`      |

Agent may pull **Poly Haven CC0** without asking. **Sketchfab** models require user download + license check; wire when
dropped in `public/models/`. Procedural stand-ins must not contradict ground truth — see
[`stage-ground-truth.md`](stage-ground-truth.md).

---

## Definition of done (demo “best”)

- [ ] **fallaway**, **reef**, **spectators** pass visual QA at MHHW on **default boot**
- [ ] Cliffs read **near-vertical** in hero views (not melted slopes)
- [ ] Set wave every **5–7 s within a set**; curved **crest line**; occasional tube on bombs
- [ ] Buoy tracks wave surface; never airborne
- [ ] Shore whitewash pulses; reef foam comes and goes with sets
- [ ] **≥120 fps** after quality settle
- [ ] **<100 ms** first frame; full **stage** **≤2 s**
- [ ] Progressive ramp by **2 s** without pop-in
- [ ] `/api/reading` reflects buoy-sampled stats
- [ ] QA manifest with epoch-prefixed shots
- [ ] All **stage locks** traceable to cited ground truth
- [ ] PR-ready branch
