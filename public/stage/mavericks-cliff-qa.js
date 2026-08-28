/**
 * Cliff hero-view QA — steep DEM faces visible from fallaway/cliff/shore/reef cameras.
 * Acceptance proxy: per-view max slope along sight corridor ≥ threshold (not melted hills).
 */
import { maxDemSlopeDeg } from './mavericks-dem-audit.js';

export const CLIFF_HERO_VIEWS = Object.freeze([
  'fallaway',
  'cliff',
  'shore',
  'reef',
]);

/** Min slope (deg) along a hero view corridor for "near-vertical" read. */
export const MIN_CLIFF_VIEW_SLOPE_DEG = 55;

/** Min grid cells in corridor at or above MIN_CLIFF_VIEW_SLOPE_DEG. */
export const MIN_STEEP_SAMPLES_PER_VIEW = 1;

/**
 * @param {Float32Array} heights
 * @param {number} rows
 * @param {number} cols
 * @param {number} pixelM
 * @param {number} col
 * @param {number} row
 */
function slopeDegAtCell(heights, rows, cols, pixelM, col, row) {
  if (col < 0 || row < 0 || col >= cols - 1 || row >= rows - 1) {
    return 0;
  }
  const h = heights[row * cols + col];
  const hE = heights[row * cols + col + 1];
  const hN = heights[(row + 1) * cols + col];
  const dhdx = (hE - h) / pixelM;
  const dhdz = (hN - h) / pixelM;
  return (Math.atan(Math.hypot(dhdx, dhdz)) * 180) / Math.PI;
}

/**
 * @param {Float32Array} heights
 * @param {{ rows: number, cols: number, pixel_m: number, frame?: { half_span_m?: number } }} meta
 * @param {{ position: { x: number, y: number, z: number }, lookAt: { x: number, y: number, z: number }, fov?: number }} view
 * @param {number} mslY
 */
export function auditCliffViewCorridor(heights, meta, view, mslY) {
  const { rows, cols, pixel_m: pixelM } = meta;
  const halfSpan =
    meta.frame?.half_span_m ?? ((cols - 1) * pixelM) * 0.5;
  const cam = view.position;
  const target = view.lookAt;
  const fovDeg = view.fov ?? 44;
  const dx = target.x - cam.x;
  const dz = target.z - cam.z;
  const forwardLen = Math.hypot(dx, dz) || 1;
  const fx = dx / forwardLen;
  const fz = dz / forwardLen;
  const halfTan = Math.tan((fovDeg * Math.PI) / 180 / 2);
  const maxDist = forwardLen * 1.15;
  const lateralPad = 180;

  const minX = Math.min(cam.x, target.x) - lateralPad;
  const maxX = Math.max(cam.x, target.x) + lateralPad;
  const minZ = Math.min(cam.z, target.z) - lateralPad;
  const maxZ = Math.max(cam.z, target.z) + lateralPad;

  const col0 = Math.max(0, Math.floor((minX + halfSpan) / pixelM));
  const col1 = Math.min(cols - 2, Math.ceil((maxX + halfSpan) / pixelM));
  const row0 = Math.max(0, Math.floor((halfSpan - maxZ) / pixelM));
  const row1 = Math.min(rows - 2, Math.ceil((halfSpan - minZ) / pixelM));

  let maxSlopeDeg = 0;
  let steepSamples = 0;
  let landSamples = 0;

  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      const x = col * pixelM - halfSpan;
      const z = halfSpan - row * pixelM;
      const relX = x - cam.x;
      const relZ = z - cam.z;
      const along = relX * fx + relZ * fz;
      if (along < 0 || along > maxDist) continue;
      const lateral = Math.abs(relX * -fz + relZ * fx);
      if (lateral > along * halfTan + lateralPad * 0.35) continue;

      const terrainY = heights[row * cols + col];
      if (!Number.isFinite(terrainY) || terrainY < mslY + 2) continue;
      landSamples++;
      const slope = slopeDegAtCell(heights, rows, cols, pixelM, col, row);
      if (slope > maxSlopeDeg) maxSlopeDeg = slope;
      if (slope >= MIN_CLIFF_VIEW_SLOPE_DEG) steepSamples++;
    }
  }

  const ok =
    steepSamples >= MIN_STEEP_SAMPLES_PER_VIEW &&
    maxSlopeDeg >= MIN_CLIFF_VIEW_SLOPE_DEG;

  return {
    ok,
    maxSlopeDeg: Number(maxSlopeDeg.toFixed(2)),
    steepSamples,
    landSamples,
    minSlopeDeg: MIN_CLIFF_VIEW_SLOPE_DEG,
  };
}

/**
 * @param {Float32Array} heights
 * @param {{ rows: number, cols: number, pixel_m: number, frame?: { half_span_m?: number } }} meta
 * @param {Record<string, { position: { x: number, y: number, z: number }, lookAt: { x: number, y: number, z: number } }>} views
 * @param {number} mslY
 */
export function verifyCliffHeroViews(heights, meta, views, mslY) {
  const demMaxSlopeDeg = maxDemSlopeDeg(
    heights,
    meta.rows,
    meta.cols,
    meta.pixel_m,
  );
  /** @type {Record<string, ReturnType<typeof auditCliffViewCorridor>>} */
  const perView = {};
  /** @type {Array<{ view: string, detail: string }>} */
  const issues = [];

  for (const name of CLIFF_HERO_VIEWS) {
    const view = views[name];
    if (!view) {
      issues.push({ view: name, detail: 'missing view' });
      continue;
    }
    const report = auditCliffViewCorridor(heights, meta, view, mslY);
    perView[name] = report;
    if (!report.ok) {
      issues.push({
        view: name,
        detail: `maxSlope=${report.maxSlopeDeg} steep=${report.steepSamples}/${report.landSamples}`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    demMaxSlopeDeg: Number(demMaxSlopeDeg.toFixed(2)),
    mslY,
    views: CLIFF_HERO_VIEWS,
    perView,
    issues,
  };
}

/**
 * @param {ReturnType<typeof verifyCliffHeroViews>} report
 * @param {string} [label]
 */
export function logCliffQa(report, label = '[mavericks] cliff QA') {
  console.log(label, report);
  return report;
}
