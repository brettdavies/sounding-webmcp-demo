/**
 * Curved set-wave crest along `break_line.polyline` (reef refracted break).
 * Phase xi measures swell-direction distance from the moving crest on the polyline.
 */

/** @typedef {{ x: number, z: number }} XzPoint */

export const MAX_BREAK_LINE_VERTS = 8;

/**
 * @param {XzPoint[]} polyline
 */
export function normalizeBreakPolyline(polyline) {
  const pts = (polyline ?? []).filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.z),
  );
  if (pts.length < 2) {
    return [
      { x: -480, z: 100 },
      { x: -450, z: 40 },
      { x: -440, z: -20 },
      { x: -460, z: -80 },
      { x: -500, z: -140 },
    ];
  }
  return pts.slice(0, MAX_BREAK_LINE_VERTS);
}

/**
 * @param {number} x
 * @param {number} z
 * @param {XzPoint[]} polyline
 * @returns {{ x: number, z: number, along: number, perp: number, seg: number }}
 */
export function closestPointOnBreakLine(x, z, polyline) {
  const pts = normalizeBreakPolyline(polyline);
  let bestQx = pts[0].x;
  let bestQz = pts[0].z;
  let bestPerp = Infinity;
  let bestAlong = 0;
  let bestSeg = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x;
    const az = pts[i].z;
    const bx = pts[i + 1].x;
    const bz = pts[i + 1].z;
    const abx = bx - ax;
    const abz = bz - az;
    const abLen2 = abx * abx + abz * abz;
    if (abLen2 < 1e-6) continue;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * abx + (z - az) * abz) / abLen2),
    );
    const qx = ax + abx * t;
    const qz = az + abz * t;
    const dx = x - qx;
    const dz = z - qz;
    const perp = Math.hypot(dx, dz);
    if (perp < bestPerp) {
      bestPerp = perp;
      bestQx = qx;
      bestQz = qz;
      bestSeg = i + t;
    }
  }

  return {
    x: bestQx,
    z: bestQz,
    perp: bestPerp,
    seg: bestSeg,
  };
}

/**
 * Signed swell-direction phase distance from curved crest.
 * @param {number} x
 * @param {number} z
 * @param {number} crestAlong
 * @param {number} buoyAlong
 * @param {{ x: number, y: number }} dir Unit swell vector (XZ as x,y).
 * @param {XzPoint[]} polyline
 */
export function crestXiAt(x, z, crestAlong, buoyAlong, dir, polyline) {
  const q = closestPointOnBreakLine(x, z, polyline);
  const sP = dir.x * x + dir.y * z;
  const sQ = dir.x * q.x + dir.y * q.z;
  return sP - crestAlong - (sQ - buoyAlong);
}

/**
 * Pack polyline for shader uniforms (vec2 array, count).
 * @param {XzPoint[]} polyline
 */
export function breakLineUniforms(polyline) {
  const pts = normalizeBreakPolyline(polyline);
  const points = [];
  for (let i = 0; i < MAX_BREAK_LINE_VERTS; i++) {
    const p = pts[i] ?? pts[pts.length - 1] ?? { x: 0, z: 0 };
    points.push({ x: p.x, z: p.z });
  }
  return { count: pts.length, points };
}

/**
 * Crest should sit on polyline vertices when crestAlong matches buoy at peak.
 * @param {XzPoint[]} polyline
 * @param {number} buoyAlong
 * @param {{ x: number, y: number }} dir
 */
export function verifyCurvedCrestOnPolyline(polyline, buoyAlong, dir) {
  const pts = normalizeBreakPolyline(polyline);
  const crestAlong = buoyAlong;
  /** @type {Array<{ i: number, xi: number, perp: number }>} */
  const samples = [];
  let ok = true;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const xi = crestXiAt(p.x, p.z, crestAlong, buoyAlong, dir, pts);
    const q = closestPointOnBreakLine(p.x, p.z, pts);
    samples.push({ i, xi: Number(xi.toFixed(4)), perp: Number(q.perp.toFixed(4)) });
    if (Math.abs(xi) > 0.05 || q.perp > 0.05) ok = false;
  }
  const mid = pts[Math.floor(pts.length / 2)];
  const offAxis = crestXiAt(mid.x + 80, mid.z - 40, crestAlong, buoyAlong, dir, pts);
  const curved = Math.abs(offAxis) > 0.5;
  return {
    ok: ok && curved,
    vertexCount: pts.length,
    samples,
    offAxisXi: Number(offAxis.toFixed(3)),
    curved,
  };
}

