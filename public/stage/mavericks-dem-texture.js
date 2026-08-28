/**
 * DEM height sampler for ocean shoreline clip (NAVD88 meters).
 * UV contract matches `mavericks-terrain.js` PlaneGeometry + meta.json frame.
 */
import * as THREE from 'three';

/**
 * @param {Float32Array} heights
 * @param {{ rows: number, cols: number, pixel_m: number, frame?: { half_span_m?: number } }} meta
 */
export function createDemHeightTexture(heights, meta) {
  const { rows, cols, pixel_m: pixelM } = meta;
  if (heights.length !== rows * cols) {
    throw new Error(
      `[mavericks-dem] height size ${heights.length} ≠ ${rows * cols}`,
    );
  }

  const halfSpan =
    meta.frame?.half_span_m ?? ((cols - 1) * pixelM) * 0.5;

  const texture = new THREE.DataTexture(
    heights,
    cols,
    rows,
    THREE.RedFormat,
    THREE.FloatType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  /**
   * @param {number} x Local X (m)
   * @param {number} z Local Z (m)
   */
  function sampleAt(x, z) {
    const col = (x + halfSpan) / pixelM;
    const row = (halfSpan - z) / pixelM;
    if (col < 0 || col > cols - 1 || row < 0 || row > rows - 1) {
      return Number.NaN;
    }
    const c0 = Math.floor(col);
    const r0 = Math.floor(row);
    const c1 = Math.min(c0 + 1, cols - 1);
    const r1 = Math.min(r0 + 1, rows - 1);
    const fx = col - c0;
    const fz = row - r0;
    const h00 = heights[r0 * cols + c0];
    const h10 = heights[r0 * cols + c1];
    const h01 = heights[r1 * cols + c0];
    const h11 = heights[r1 * cols + c1];
    const hx0 = h00 * (1 - fx) + h10 * fx;
    const hx1 = h01 * (1 - fx) + h11 * fx;
    return hx0 * (1 - fz) + hx1 * fz;
  }

  return {
    texture,
    halfSpan,
    pixelM,
    cols,
    rows,
    sampleAt,
    dispose() {
      texture.dispose();
    },
  };
}

/**
 * @param {ReturnType<typeof createDemHeightTexture>} dem
 * @param {number} waterY Still-water + displacement world Y (m NAVD88)
 * @param {number} terrainY DEM sample (m NAVD88)
 * @param {number} [biasM]
 */
export function isOceanVisibleAt(dem, waterY, terrainY, biasM = 0.08) {
  if (!Number.isFinite(terrainY)) return true;
  return terrainY < waterY - biasM;
}

/**
 * QA log for shoreline clip evidence.
 * @param {ReturnType<typeof createDemHeightTexture>} dem
 * @param {number} mslY
 * @param {Array<{ name: string, x: number, z: number }>} points
 */
export function logShorelineSamples(dem, mslY, points) {
  const rows = points.map(({ name, x, z }) => {
    const terrainY = dem.sampleAt(x, z);
    const visible = isOceanVisibleAt(dem, mslY, terrainY);
    return { name, x, z, terrainY, waterY: mslY, oceanVisible: visible };
  });
  console.log('[mavericks] shoreline clip samples', rows);
  return rows;
}
