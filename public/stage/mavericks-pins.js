/**
 * Stage pins from `public/land/mavericks/meta.json` (ground-truth SoT).
 * Sync fallbacks mirror reconciliation_2026_08_27 when meta is not yet loaded.
 */

/** @typedef {{
 *   mslY: number,
 *   breakPeak: { x: number, z: number },
 *   breakRocks: { x: number, z: number },
 *   buoyXz: { x: number, z: number },
 *   swellFromDeg: number,
 *   spectators: {
 *     x: number,
 *     z: number,
 *     ground_y: number,
 *     eye_height_m: number,
 *     look_at: { x: number, y: number, z: number },
 *   } | null,
 *   station: { x: number, y: number, z: number } | null,
 *   polyline: { x: number, z: number }[],
 * }} MavericksPins */

export const PIN_FALLBACKS = Object.freeze({
  mslY: 1.719,
  breakPeak: Object.freeze({ x: -440, z: -20 }),
  breakRocks: Object.freeze({ x: -338, z: -197 }),
  swellFromDeg: 285,
});

/**
 * @param {Record<string, unknown>} meta
 * @returns {MavericksPins}
 */
export function extractPins(meta) {
  const tide = /** @type {{ stage_still_water_m?: number, mhhw_m?: number }} */ (
    meta.tide_datums_noaa_9414131 ?? {}
  );
  const breakLine = /** @type {{
 *   peak?: { x: number, z: number },
 *   rocks?: { x: number, z: number },
 *   swell_from_deg?: number,
 *   polyline?: { x: number, z: number }[],
 * }} */ (meta.break_line ?? {});
  const peak = breakLine.peak ?? PIN_FALLBACKS.breakPeak;
  const rocks = breakLine.rocks ?? PIN_FALLBACKS.breakRocks;

  return {
    mslY: tide.stage_still_water_m ?? tide.mhhw_m ?? PIN_FALLBACKS.mslY,
    breakPeak: { x: peak.x, z: peak.z },
    breakRocks: { x: rocks.x, z: rocks.z },
    buoyXz: { x: peak.x, z: peak.z },
    swellFromDeg: breakLine.swell_from_deg ?? PIN_FALLBACKS.swellFromDeg,
    spectators: /** @type {MavericksPins['spectators']} */ (meta.spectators ?? null),
    station: /** @type {MavericksPins['station']} */ (meta.station_local ?? null),
    polyline: breakLine.polyline ?? [],
  };
}

/**
 * @param {string} [url]
 * @returns {Promise<{ meta: Record<string, unknown>, pins: MavericksPins }>}
 */
export async function loadMavericksMeta(url = '/land/mavericks/meta.json') {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[mavericks] meta fetch ${response.status}`);
  }
  const meta = await response.json();
  return { meta, pins: extractPins(meta) };
}

/**
 * @param {MavericksPins} pins
 * @param {string} [label]
 */
export function logPinSample(pins, label = '[mavericks] pins') {
  const spec = pins.spectators;
  console.log(label, {
    mslY: pins.mslY,
    breakPeak: pins.breakPeak,
    breakRocks: pins.breakRocks,
    buoyXz: pins.buoyXz,
    swellFromDeg: pins.swellFromDeg,
    spectators: spec
      ? {
          x: spec.x,
          z: spec.z,
          eyeY: (spec.ground_y ?? 0) + (spec.eye_height_m ?? 2.5),
        }
      : null,
    station: pins.station,
  });
}
