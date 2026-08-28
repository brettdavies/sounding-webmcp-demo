# Land surface textures (Mavericks DEM)

**Terminology:** [`docs/stage-glossary.md`](../../docs/stage-glossary.md)

## DEM / ortho

| Asset       | Path                               | Source                               |
| ----------- | ---------------------------------- | ------------------------------------ |
| Heightfield | `public/land/mavericks/height.f32` | USGS DS 684 DEM_1 crop (4 m, NAVD88) |
| Albedo bake | `public/land/mavericks/albedo.png` | NAIP 2022 + Poly Haven cliff/rock    |
| Slope masks | `public/land/mavericks/masks.png`  | R=cliff, G=subtidal, B=shore         |
| Ortho ref   | `public/land/mavericks/ortho.jpg`  | CA DFW NAIP_2022 ImageServer         |

## Poly Haven CC0 (2k)

- `public/textures/cliff/` — `rock_face_03`, `sandstone_cracks`, coastal/namaqualand cliff maps
- `public/textures/rock/` — `rocky_terrain_02`, `aerial_rocks_02`, `mossy_rock`
- `public/textures/beach/` — `coast_sand_rocks_02`, `aerial_beach_01`
- `public/textures/seafloor/` — `gray_rocks`, `rocks_ground_02`

Raw USGS GeoTIFF / NAIP masters live under `.context/topo/` (gitignored).

## Locked stage pins (`meta.json`)

| Mark                  | Local XZ (m)                  | Notes                                             |
| --------------------- | ----------------------------- | ------------------------------------------------- |
| `station_local`       | (−182, **+322**)              | AFS plateau; Y **48.65 m** NAVD88 (DEM-verified)  |
| `break_line.rocks`    | (−338, **−197**)              | Sail Rock — USCG 37°29′34″N 122°30′02″W           |
| `break_line.peak`     | (−440, −20)                   | Break peak — main **set wave** / reef crest focus |
| `break_line.polyline` | N→SSW over −5…−6 m reef       | **Crest line** ref; diagram + DEM contour         |
| `spectators`          | (−100, **+100**), eye Y ≈ 5.5 | Dry sand above MHHW; ground **≈ 3 m** → peak      |

Plan view only; stage **still-water plane** uses **MHHW Y = 1.719 m** NAVD88 (harbor MSL = 0.924). Authored view:
`?view=spectators`.
