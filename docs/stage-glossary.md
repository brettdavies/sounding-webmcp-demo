# Stage glossary

**Parent:** [`stage-goal.md`](stage-goal.md)

Canonical vocabulary for Sounding stage docs. When docs and code disagree on **product language**, this glossary wins
for prose; see [Code aliases](#code-aliases-legacy) for identifier mapping.

## Vocabulary domains

| Domain                   | What it covers                                                                         | Examples                                          |
| ------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Surf & contest**       | Real ocean and competition language                                                    | heat, set, set wave, reef break, face height      |
| **Geospatial & terrain** | Survey data and world locks                                                            | DEM, NAVD88, ortho, pin, heightfield              |
| **Real-time 3D (CG)**    | How the demo is built in Three.js — scene graph, meshes, materials, cameras, rendering | scene, mesh, rig, shader, viewport                |
| **Ocean simulation**     | Mechanism-specific shader terms                                                        | spectral cascade, set-wave overlay, Jacobian foam |

**Real-time 3D** (also **computer graphics**, **CG**, **3D pipeline**) is the engineering side of interactive graphics:
**meshes, lights, materials, and frames drawn every refresh** — not print/layout design. Terms like **scene**, **mesh**,
and **rig** live here.

### Do not confuse

| Term                   | Means                                                       | Not                                   |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------- |
| **Stage**              | The whole Mavericks demo product (land + ocean + buoy + UI) | A single wave                         |
| **Scene**              | Three.js `THREE.Scene` — container for drawable objects     | The contest **heat**                  |
| **Stage locks / pins** | Geospatial marks in `meta.json`                             | Shader **uniforms**                   |
| **Set wave**           | One rideable wall in a **set**                              | The whole **heat**                    |
| **Face height**        | Trough-to-lip wall height of one wave (`face_m`)            | Offshore significant wave height (Hs) |
| **Crest line**         | Curved breaking line across the reef                        | Infinite straight Gerstner ridge      |

---

## Contest & session

| Term                    | Definition                                                                                             | In this project                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Heat**                | A timed contest session in which athletes catch waves for scoring — the **whole event**, not one wave. | The **2-minute compressed heat loop** (`mavericks-heat.json`, `loop_sec: 120`): opener → lull → main set → lull → closing. Product story is a **heat archetype**, not a replay of a dated contest day. |
| **Archetype**           | A representative synthetic pattern grounded in real conditions, not a historical reconstruction.       | Face heights, set pacing, and WNW swell climatology drawn from Mavericks big-wave reports; timing is compressed for demo.                                                                              |
| **Set**                 | A **group of waves** arriving in close succession, usually larger than the waves before and after.     | JSON `sets[]` blocks (`opener`, `main`, `closing`); each lists **face heights** for several waves in that set.                                                                                         |
| **Lull**                | A quieter period **between sets** — smaller waves or relative calm.                                    | JSON sets labeled `lull`; shader returns to ambient sea with only background swell.                                                                                                                    |
| **Within-set interval** | Time from one set wave to the next **inside the same set**.                                            | **5–7 s** (`wave_gap_sec`); not the longer breath between sets.                                                                                                                                        |
| **Between-set breath**  | Pause after a set finishes before the next set builds.                                                 | Implemented as extra schedule gap after non-lull sets (~2.4× within-set gap in `set-wave.js`).                                                                                                         |

---

## Waves & surf (ocean surface)

| Term                   | Definition                                                                                      | In this project                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Wave**               | A single traveling swell crest and trough.                                                      | One entry in a set’s `faces_m[]`; one **scheduled wave** in the overlay timeline.                                         |
| **Set wave**           | A **large rideable wave within a set** — the waves the heat is “about.”                         | Preferred doc term for what code sometimes labels a heat pulse. Targets **~12–18 m face** on main sets; **bombs** higher. |
| **Background swell**   | Continuous long-period sea between set waves; not the featured rideable wall.                   | Spectral FFT cascade + always-on Gerstner swell (`sea-state.js`); kept **near-flat** so set waves read clearly.           |
| **Swell**              | Organized long-period wave energy arriving from a distant fetch.                                | **WNW ~285°**, **~18 s** period; Mavericks Pacific approach. Distinct from wind chop.                                     |
| **Face** (face height) | The **visible vertical wall** of a wave from trough to lip — what surfers quote in feet/meters. | `face_m` in JSON and overlay; **not** offshore significant height (Hs). A 15 m face is a large Mavericks wall.            |
| **Bomb**               | An exceptionally large wave in a set — the biggest wall of the group.                           | e.g. **18 m** face in the `main` set; occasional **tube** read on bombs (~15% target).                                    |
| **Tween wave**         | A **smaller wave between two set waves** in the same set (not a lull).                          | Schedule `kind: 'tween'`; ~40% of preceding set-wave face height.                                                         |
| **Crest**              | The highest line along the top of a wave; the **lip** when breaking.                            | Set-wave overlay crest; reef **crest line** follows `break_line.polyline`.                                                |
| **Trough**             | The lowest point between crests.                                                                | Still-water reference is **MHHW**; troughs must not drain the cliff-toe shelf.                                            |
| **Lineup**             | Zone where surfers wait for set waves.                                                          | Buoy mooring at **break peak** `(−440, −20)` — reef focus for approach shots.                                             |
| **Peak** (break peak)  | The main takeoff / impact focus on the reef — the “Corner” focus.                               | Locked pin `break_line.peak`; set waves and buoy aim here.                                                                |
| **Period**             | Seconds between successive wave crests.                                                         | Swell **~18 s**; within-set spacing **5–7 s** (different concepts — do not conflate).                                     |

**Do not use:** **“heat face”** — a heat is the session; one wave is a **set wave** (or **wave** in context).

---

## Breaking & morphology

| Term              | Definition                                                                 | In this project                                                                         |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Break**         | Where and how a wave collapses on shallow bathymetry.                      | Mavericks **reef break** — focused by Pillar Point bathymetry; not a beach dump.        |
| **Reef break**    | Break caused by submerged reef; often powerful and hollow.                 | DEM −5…−6 m band at `break_line`; set waves refract along polyline.                     |
| **Crest line**    | The curved horizontal line where the wave is breaking across the reef.     | Target: follows `break_line.polyline` — **not** a straight infinite Gerstner line.      |
| **Spill**         | Break where the lip cascades down the face.                                | One of three **break styles** (with plunge, tube).                                      |
| **Plunge**        | Break where the lip throws forward aggressively.                           | Break style on steeper set waves.                                                       |
| **Tube** (barrel) | Hollow cylindrical space formed when the lip curls over.                   | Occasional read on bombs (~15%); break style, not every wave.                           |
| **Whitewash**     | Turbulent white water after the wave breaks.                               | **Reef whitewash** (Jacobian + lip foam); **shore whitewash** (spectator beach pulses). |
| **Lip**           | The throwing crest of a breaking wave.                                     | Lip foam on set waves; spray burst at buoy on impact.                                   |
| **Spray**         | Fine mist lofted by impact or wind.                                        | Buoy spray VFX on set-wave impact; off during lulls.                                    |
| **Refraction**    | Bending of swell as depth changes — curves the crest toward shallow spots. | Visual target from wave-energy diagram; break field phase delay from DEM depth.         |

---

## Tide & datums

| Term       | Definition                                                     | In this project                                                    |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| **NAVD88** | North American vertical datum — orthometric heights in meters. | DEM `height.f32`, station plateau **48.65 m**, tide datums.        |
| **MHHW**   | Mean higher high water — average of higher high tides.         | **Still-water plane** Y = **1.719 m** (`MSL_Y`); stage fill datum. |
| **MSL**    | Mean sea level.                                                | Harbor **0.924 m**; documented, not the ocean mesh plane.          |
| **MLLW**   | Mean lower low water.                                          | Reference only (**0.012 m**).                                      |

---

## Geospatial & terrain

| Term                   | Definition                                                   | In this project                                                          |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **DEM**                | Digital elevation model — gridded ground/bathymetry heights. | USGS DS 684 `height.f32`; **4 m** posting; source of cliff geometry.     |
| **Heightfield**        | Terrain mesh with single Y per (X, Z) — no overhangs.        | `PlaneGeometry` + `height.f32`; preserves max slope ~81° at full stride. |
| **Albedo**             | Base color texture (ortho + cliff bake).                     | `albedo.png` on DEM UV; does not create steepness.                       |
| **Orthophoto (ortho)** | Aerial image georeferenced to terrain.                       | NAIP 2022 export → `ortho.jpg` / baked `albedo.png`.                     |
| **Mask**               | Channel-encoded material zones.                              | `masks.png`: R cliff, G subtidal, B shore.                               |
| **Pin**                | A locked world-space mark (XZ + optional Y).                 | Station, break peak, Sail Rock — `meta.json`.                            |
| **Local frame**        | Stage coordinates in meters; origin at DEM grid center.      | +X east, +Z north, +Y NAVD88; see `meta.json` → `frame`.                 |

---

## Real-time 3D & scene graph

The **scene graph** is a tree of objects the renderer draws each frame. Three.js types map closely to these terms.

| Term                | Definition                                                                             | In this project                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Stage**           | The full Mavericks demo world — land, ocean, buoy, sky, cameras — as one product unit. | Booted by `ocean-boot.js` / `ocean-boot-sea.js`; also “full stage” in perf docs.                          |
| **Scene**           | Top-level container holding everything the renderer draws (`THREE.Scene`).             | Holds terrain `Group`, ocean `Mesh`, sky sphere, buoy, lights.                                            |
| **Object3D**        | Anything with a position, rotation, and scale in the graph.                            | Base type for meshes, groups, cameras, lights.                                                            |
| **Group**           | An empty organizational node; children inherit its transform.                          | `mavericksLand`, `station`, buoy root — bundle props without merging geometry.                            |
| **Mesh**            | **Geometry + material** — a drawable surface in the world.                             | `mavericksDem` terrain, ocean plane, procedural station boxes, buoy hull pieces.                          |
| **Geometry**        | Pure shape data: vertices, faces, UVs — no appearance yet.                             | `PlaneGeometry` for DEM and ocean; `BoxGeometry` / GLB buffers for props.                                 |
| **Vertex**          | One point in a geometry; displaced by heightfield or shader.                           | DEM: one vertex per `height.f32` cell; ocean: grid vertices displaced on GPU.                             |
| **Segment**         | Subdivision count of a parametric geometry (grid resolution).                          | Ocean `OCEAN_SEGMENTS` (360); DEM `cols−1` × `rows−1` quads. More segments = smoother, costlier.          |
| **Transform**       | Position, rotation, scale of an object in parent space.                                | Station at `station_local`; buoy heave/pitch/yaw updated each frame.                                      |
| **Origin**          | Reference point for coordinates — context-dependent.                                   | **World origin** = DEM grid center; **UTM origin** = NW corner in `meta.json`.                            |
| **Asset**           | External file loaded into the scene (model, texture, HDRI).                            | GLB buoy, Poly Haven textures, `height.f32` heightfield.                                                  |
| **GLB / GLTF**      | Standard 3D asset format (mesh + materials, often + animations).                       | `buoy.glb`, `coastal_cliff_01` cliff scrapes.                                                             |
| **Rig**             | **Skeleton hierarchy** (bones/joints) used to deform or animate a model.               | Buoy uses **procedural** heave/tilt on a `Group`, not a bone rig; future animated props may include rigs. |
| **Skinned mesh**    | Mesh whose vertices follow a bone rig.                                                 | Not used yet; would apply if a GLB shipped with walk/rotate bones.                                        |
| **Billboard**       | Quad that rotates to face the camera — common for spray/particles.                     | Planned buoy spray VFX (P1b).                                                                             |
| **Placeholder**     | Cheap stand-in geometry until final assets load.                                       | Flat ocean/terrain silhouette during progressive boot (<100 ms first frame).                              |
| **Frustum culling** | Skipping draw for objects outside the camera view.                                     | DEM mesh sets `frustumCulled = false` so cliffs don’t pop at oblique angles.                              |

---

## Materials, lighting & shading

| Term             | Definition                                                                                | In this project                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Material**     | Rules for how a surface looks when lit (`MeshStandardMaterial`, custom `ShaderMaterial`). | Terrain PBR + cliff overlay; ocean spectral shader; white radome `MeshPhysicalMaterial`. |
| **PBR**          | Physically based rendering — roughness/metalness approximate real light response.         | `MeshStandardMaterial` on terrain and props; Poly Haven maps are PBR-ready.              |
| **Texture**      | Image sampled across a surface (color, normal, roughness, …).                             | `albedo.png`, `masks.png`, cliff `rock_face_03`, ocean cascade FFT textures.             |
| **UV**           | 2D coordinates mapping texture pixels onto geometry.                                      | DEM albedo 1:1 with height grid; tiled UVs on cliff detail overlay.                      |
| **Normal map**   | Texture encoding surface micro-detail bump direction.                                     | Cliff `nor_gl` maps; ocean normals from FFT displacement derivatives.                    |
| **Shader**       | GPU program computing color/position per pixel/vertex.                                    | `ocean-material.js` fragment/vertex GLSL; terrain `onBeforeCompile` cliff mix.           |
| **Uniform**      | Named parameter passed from CPU to shader each frame.                                     | `time`, `setWaveActive`, `sunDirection`, cascade textures — updated in render loop.      |
| **HDRI**         | High-dynamic-range panoramic image used as sky/light source.                              | Poly Haven env map; shared sun direction on ocean + sky.                                 |
| **IBL**          | Image-based lighting — ambient/reflection from HDRI.                                      | Layer panel toggle “HDRI IBL”; lights cliffs and buoy consistently.                      |
| **Light**        | Scene illuminator (sun, ambient).                                                         | Directional sun + shadow map on terrain; ocean shares `sunDirection`.                    |
| **Exposure**     | Overall scene brightness scaling (tone mapping).                                          | Atmosphere tuning; must keep teal ocean + cliff read balanced.                           |
| **Displacement** | Moving vertices (or implied height) off a base surface.                                   | Ocean GPU displacement; distinct from **DEM height** (terrain only).                     |

---

## Camera, framing & composition

| Term                  | Definition                                                                      | In this project                                                                                 |
| --------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Camera**            | Viewpoint + projection matrix — what the user sees.                             | `THREE.PerspectiveCamera`; one active camera per boot.                                          |
| **Viewport**          | On-screen rectangle the renderer draws into (full window in v1).                | `#stage` canvas — entire homepage background.                                                   |
| **FOV**               | Field of view — vertical angle in degrees; wider = more scene, more distortion. | Per-view in `MAVERICKS_VIEWS` (38–50°).                                                         |
| **LookAt**            | World point the camera aims at.                                                 | `fallaway` looks at break peak; `spectators` at reef focus.                                     |
| **Authored view**     | Hand-placed camera preset — not user-controlled.                                | `?view=fallaway` etc.; **no mouse look** in v1.                                                 |
| **Near / far planes** | Clipping range; geometry closer than near or farther than far is not drawn.     | Ocean `far: 8000`; tuned so fallaway sees horizon without z-fighting.                           |
| **Composition**       | How subject, horizon, and land read in frame — visual design choice.            | Buoy + set wave as subject; Pillar Point silhouette secondary; see `$threejs-camera-direction`. |

---

## Rendering & performance

| Term                 | Definition                                                         | In this project                                                  |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Renderer**         | Draws the scene each frame (`WebGLRenderer`).                      | Full-viewport loop in `ocean-boot-sea.js`.                       |
| **Frame**            | One complete image/update cycle (target **120 fps** steady-state). | Evidence gate may log frame timing via `?debug=perf`.            |
| **Draw call**        | One GPU submission to draw a mesh/material pair.                   | Land + ocean + sky + buoy; perf work reduces ocean cost first.   |
| **Render target**    | Offscreen buffer (texture FBO) — used for FFT ocean passes.        | Cascade stages in `ocean-system.js`; not the main viewport.      |
| **Post-processing**  | Full-screen passes after the main scene (bloom, color grade).      | Future tier; skill router lists `threejs-postprocessing`.        |
| **LOD**              | Level of detail — cheaper representation when far away.            | **Forbidden on terrain** in hero views; ocean FFT tiers allowed. |
| **Tier**             | Quality preset ramping resolution or features over time.           | FFT 64→128, segment count, async HDRI during progressive boot.   |
| **Z-fighting**       | Flickering when two surfaces occupy the same depth.                | Hard constraint — fix with clip planes, shoreline mask, or bias. |
| **Progressive boot** | Placeholder → full quality within ~2 s.                            | [`stage-runtime-contract.md`](stage-runtime-contract.md)         |
| **Evidence gate**    | Logs + screenshot + commit per shipped slice.                      | [`stage-runtime-contract.md`](stage-runtime-contract.md)         |

---

## Ocean simulation (shader / mechanism)

| Term                  | Definition                                                              | In this project                                                                     |
| --------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Spectral cascade**  | FFT-based ocean: multiple wavelength bands summed on the GPU.           | `public/ocean/*` — ambient **background swell** texture; Jacobian foam history.     |
| **Gerstner wave**     | Analytic trochoidal wave — clean rolling crest for art-directed pulses. | **Set-wave overlay** (solitary Gerstner through buoy); always-on long swell layers. |
| **Set-wave overlay**  | Timed Gerstner pulse for one **scheduled set wave** in the heat loop.   | Driven by `set-wave.js` schedule; uniforms `setWaveActive`, `setWaveAmplitude`, …   |
| **Displacement**      | GPU vertical offset of ocean surface mesh.                              | Must match CPU buoy height sample — no floating/sinking hull.                       |
| **Jacobian foam**     | Foam from surface folding (determinant of displacement Jacobian).       | Cascade whitewash on reef; complements lip foam on set waves.                       |
| **Choppiness**        | Horizontal displacement sharpening crests (Gerstner Q).                 | Moderate on set waves; low on background swell.                                     |
| **Still-water plane** | Flat reference Y for ocean mesh before displacement.                    | **MHHW** — avoids dry cliff shelf in troughs.                                       |
| **Shoreline clip**    | Mask excluding water displacement over dry land.                        | P0 — no water on DEM above MHHW shore wedge.                                        |

---

## Code aliases (legacy)

Session-level identifiers keep **heat** where it means the whole contest loop (`mavericks-heat.json`, API copy
`Mavericks heat — compressed`). Set-wave overlay code uses glossary terms below.

| Code / identifier                      | Doc term                                    |
| -------------------------------------- | ------------------------------------------- |
| `set-wave.js`, `buildSetWaveSchedule`  | Set-wave schedule                           |
| `SetWaveEvent`, `sampleSetWave`        | Scheduled wave / set-wave sample            |
| `setWaveActive`, `setWaveAmplitude`, … | Set-wave overlay uniforms                   |
| `kind: 'set'`                          | Set wave (featured)                         |
| `kind: 'tween'`                        | Tween wave                                  |
| `kind: 'lull'`                         | Lull wave (small)                           |
| `mavericks-heat.json`                  | Heat loop data (session-level — name kept)  |
| `face_m`                               | Face height (meters) — valid in data fields |

Renamed in P0 ([`stage-backlog.md`](stage-backlog.md#p0--glossary-code-rename-scope)). Session file
`mavericks-heat.json` keeps **heat** in the name (correct surf term for the whole loop).

---

## Quick hierarchy

```text
Heat (2 min session)
├── Set (opener | main | closing | …)
│   ├── Set wave (bomb)     ← large rideable wall, ~12–18 m face
│   ├── Tween wave          ← smaller wave between set waves
│   └── Set wave …
├── Lull set                ← small face heights only
└── Background swell        ← always present between scheduled waves
```

**Break** happens where the reef is shallow (`break_line`); **set waves** are what roll through the lineup on schedule
during the **heat**.
