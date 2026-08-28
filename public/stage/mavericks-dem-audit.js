/**
 * DEM mesh audit — full native stride + max slope from height.f32.
 * Ground truth: ~81° max at 4 m posting (docs/stage-ground-truth.md).
 */

/** v1 contract: no terrain subsampling LOD. */
export const TERRAIN_STRIDE = 1;

/** Minimum max-slope (deg) expected at full 4 m posting in Mavericks crop. */
export const MIN_DEM_MAX_SLOPE_DEG = 60;

/**
 * @param {number} rows
 * @param {number} cols
 * @param {number} [stride]
 */
export function terrainSegmentsForGrid(rows, cols, stride = TERRAIN_STRIDE) {
  if (stride !== TERRAIN_STRIDE) {
    throw new Error(
      `[mavericks] terrainStride ${stride} banned — v1 requires ${TERRAIN_STRIDE}`,
    );
  }
  const segX = cols - 1;
  const segZ = rows - 1;
  if (segX % stride !== 0 || segZ % stride !== 0) {
    throw new Error(
      `[mavericks] grid ${cols}x${rows} not divisible by stride ${stride}`,
    );
  }
  return { segX: segX / stride, segZ: segZ / stride, stride };
}

/**
 * Max face slope (deg) on the height grid (+X east, +Z north rows).
 * @param {Float32Array} heights
 * @param {number} rows
 * @param {number} cols
 * @param {number} pixelM
 */
export function maxDemSlopeDeg(heights, rows, cols, pixelM) {
  let maxDeg = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const h = heights[row * cols + col];
      const hE = heights[row * cols + col + 1];
      const hN = heights[(row + 1) * cols + col];
      const dhdx = (hE - h) / pixelM;
      const dhdz = (hN - h) / pixelM;
      const deg = (Math.atan(Math.hypot(dhdx, dhdz)) * 180) / Math.PI;
      if (deg > maxDeg) maxDeg = deg;
    }
  }
  return maxDeg;
}

/**
 * @param {Float32Array} heights
 * @param {{ rows: number, cols: number, pixel_m: number }} meta
 * @param {number} [stride]
 */
export function auditDemMesh(heights, meta, stride = TERRAIN_STRIDE) {
  const { rows, cols, pixel_m: pixelM } = meta;
  if (heights.length !== rows * cols) {
    return {
      ok: false,
      stride,
      error: `height size ${heights.length} ≠ ${rows * cols}`,
    };
  }
  const segments = terrainSegmentsForGrid(rows, cols, stride);
  const maxSlopeDeg = maxDemSlopeDeg(heights, rows, cols, pixelM);
  const slopeOk = maxSlopeDeg >= MIN_DEM_MAX_SLOPE_DEG;
  return {
    ok: stride === TERRAIN_STRIDE && slopeOk,
    stride,
    segments,
    vertexCount: rows * cols,
    maxSlopeDeg: Number(maxSlopeDeg.toFixed(2)),
    minSlopeDeg: MIN_DEM_MAX_SLOPE_DEG,
    slopeOk,
    pixelM,
  };
}
