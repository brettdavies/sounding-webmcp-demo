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
