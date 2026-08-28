/**
 * MHHW verification for MAVERICKS_VIEWS — ensures cameras frame pins at still-water datum.
 */

/** @typedef {{ position: { x: number, y: number, z: number }, lookAt: { x: number, y: number, z: number }, fov: number }} MavericksView */

export const MAVERICKS_VIEW_NAMES = Object.freeze([
  'aerial',
  'shore',
  'cliff',
  'reef',
  'fallaway',
  'station',
  'tip',
  'spectators',
]);

/**
 * @param {number} mslY MHHW still-water plane (NAVD88 m).
 */
export function waveLipY(mslY) {
  return mslY + 4.5;
}

/**
 * @param {import('./mavericks-pins.js').MavericksPins} pins
 * @param {number} [mslY]
 */
export function mhhwViewAnchors(pins, mslY = pins.mslY) {
  const peak = pins.breakPeak;
  const station = pins.station;
  const lipY = waveLipY(mslY);
  return {
    mslY,
    lipY,
    peak,
    station,
    /** Views that must frame the break peak at or above MHHW. */
    breakLookAt: { x: peak.x, y: lipY, z: peak.z },
    reefLookAt: { x: peak.x + 160, y: mslY + 2.5, z: peak.z - 180 },
    shoreLookAt: { x: peak.x * 0.5, y: lipY, z: peak.z - 60 },
    stationLookAt: station
      ? { x: station.x, y: station.y * 0.88, z: station.z - 60 }
      : { x: -182, y: 43, z: 262 },
    stationPosition: station
      ? { x: station.x + 142, y: station.y + 47, z: station.z - 402 }
      : { x: -40, y: 95, z: -80 },
  };
}

/**
 * @param {Record<string, MavericksView>} views
 * @param {import('./mavericks-pins.js').MavericksPins} pins
 */
export function verifyMavericksViews(views, pins) {
  const mslY = pins.mslY;
  const lipY = waveLipY(mslY);
  const peak = pins.breakPeak;
  const station = pins.station;
  /** @type {Array<{ view: string, check: string, detail?: string }>} */
  const issues = [];

  for (const name of MAVERICKS_VIEW_NAMES) {
    const view = views[name];
    if (!view) {
      issues.push({ view: name, check: 'missing' });
      continue;
    }

    if (name === 'spectators' && view.position.y < mslY) {
      issues.push({
        view: name,
        check: 'camera_below_mhhw',
        detail: `y=${view.position.y} mslY=${mslY}`,
      });
    }

    if (['reef', 'fallaway', 'shore'].includes(name) && view.lookAt.y < mslY) {
      issues.push({
        view: name,
        check: 'lookAt_below_mhhw',
        detail: `y=${view.lookAt.y} mslY=${mslY}`,
      });
    }

    if (['fallaway', 'reef', 'spectators'].includes(name)) {
      const dx = Math.abs(view.lookAt.x - peak.x);
      const dz = Math.abs(view.lookAt.z - peak.z);
      if (dx > 200 || dz > 220) {
        issues.push({
          view: name,
          check: 'break_peak_aim',
          detail: `dx=${dx.toFixed(0)} dz=${dz.toFixed(0)}`,
        });
      }
    }

    if (name === 'station' && station) {
      const dx = Math.abs(view.lookAt.x - station.x);
      const dz = Math.abs(view.lookAt.z - station.z);
      if (dx > 40 || dz > 120) {
        issues.push({
          view: name,
          check: 'station_aim',
          detail: `dx=${dx.toFixed(0)} dz=${dz.toFixed(0)}`,
        });
      }
      if (view.lookAt.y < mslY) {
        issues.push({
          view: name,
          check: 'station_lookAt_below_mhhw',
          detail: `y=${view.lookAt.y}`,
        });
      }
    }
  }

  const report = {
    ok: issues.length === 0,
    mslY,
    lipY,
    views: MAVERICKS_VIEW_NAMES.filter((n) => views[n]),
    issues,
  };
  return report;
}

/**
 * @param {ReturnType<typeof verifyMavericksViews>} report
 * @param {string} [label]
 */
export function logViewVerification(report, label = '[mavericks] views MHHW verify') {
  console.log(label, report);
  return report;
}
