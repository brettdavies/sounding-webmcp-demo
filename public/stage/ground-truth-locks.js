/**
 * Verify stage locks in meta.json match docs/stage-ground-truth.md table.
 * Node-safe — meta.json is authoritative SoT.
 */

/** @param {Record<string, unknown>} meta */
export function verifyGroundTruthLocks(meta) {
  const tide = /** @type {{ mhhw_m?: number, stage_still_water_m?: number, station_id?: string }} */ (
    meta.tide_datums_noaa_9414131 ?? {}
  );
  const bl = /** @type {{
 *   peak?: { x: number, z: number },
 *   rocks?: { x: number, z: number },
 *   swell_from_deg?: number,
 *   source?: unknown[],
 * }} */ (meta.break_line ?? {});
  const spec = /** @type {{ x?: number, z?: number, ground_y?: number, eye_height_m?: number }} */ (
    meta.spectators ?? {}
  );
  const station = /** @type {{ x?: number, z?: number, y?: number }} */ (
    meta.station_local ?? {}
  );

  /** @type {Record<string, boolean>} */
  const checks = {
    mhhw: tide.mhhw_m === 1.719 && tide.stage_still_water_m === 1.719,
    noaaStation: tide.station_id === '9414131',
    breakPeak: bl.peak?.x === -440 && bl.peak?.z === -20,
    breakRocks: bl.rocks?.x === -338 && bl.rocks?.z === -197,
    buoyAtPeak:
      bl.peak?.x === -440 &&
      bl.peak?.z === -20,
    spectators: spec.x === -100 && spec.z === 100,
    station: station.x === -182 && station.z === 322,
    stationElev:
      typeof meta.pillar_elev_m === 'number' &&
      Math.abs(meta.pillar_elev_m - 48.646) < 0.02,
    swell: bl.swell_from_deg === 285,
    demSource:
      typeof meta.source === 'string' && meta.source.includes('DS684'),
    pixelM: meta.pixel_m === 4,
    breakSources: Array.isArray(bl.source) && bl.source.length >= 2,
    polyline: Array.isArray(bl.polyline) && bl.polyline.length >= 3,
  };

  const ok = Object.values(checks).every(Boolean);
  return { ok, checks };
}
