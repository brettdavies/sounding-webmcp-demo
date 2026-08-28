# Land surface textures (Mavericks DEM)

## DEM / ortho

| Asset       | Path                               | Source                               |
| ----------- | ---------------------------------- | ------------------------------------ |
| Heightfield | `public/land/mavericks/height.f32` | USGS DS 684 DEM_1 crop (4 m, NAVD88) |
| Albedo bake | `public/land/mavericks/albedo.png` | NAIP 2022 + Poly Haven cliff/rock    |
| Slope masks | `public/land/mavericks/masks.png`  | R=cliff, G=undersea, B=shore         |
| Ortho ref   | `public/land/mavericks/ortho.jpg`  | CA DFW NAIP_2022 ImageServer         |

## Poly Haven CC0 (2k)

- `public/textures/cliff/` — `rock_face_03`, `sandstone_cracks`, coastal/namaqualand cliff maps
- `public/textures/rock/` — `rocky_terrain_02`, `aerial_rocks_02`, `mossy_rock`
- `public/textures/beach/` — `coast_sand_rocks_02`, `aerial_beach_01`
- `public/textures/seafloor/` — `gray_rocks`, `rocks_ground_02`

Raw USGS GeoTIFF / NAIP masters live under `.context/topo/` (gitignored).

## Locked scene marks (`meta.json`)

| Mark                  | Local XZ (m)              | Notes                                             |
| --------------------- | ------------------------- | ------------------------------------------------- |
| `station_local`       | (−182, −322)              | AFS plateau; Y ≈ 49 m NAVD88                      |
| `break_line.rocks`    | (−338, 197)               | Sail Rock / diagram “Rocks”                       |
| `break_line.peak`     | (−440, −20)               | Main crest focus for heat faces                   |
| `break_line.polyline` | N→SSW over −5…−6 m reef   | From `pillar-point-diagram.jpg` + DEM contour     |
| `spectators`          | (−100, −100), eye Y ≈ 5.5 | Dry sand near tip (above MHHW); ~2.5 m eye → peak |

Plan view only; stage still-water uses **MHHW Y ≈ 1.72 m** NAVD88 (harbor MSL 0.92). View key: `?view=spectators`.
