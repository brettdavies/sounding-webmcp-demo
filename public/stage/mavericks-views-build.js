/**
 * Mavericks camera presets — no Three.js deps (verify script + terrain import).
 */
import { mhhwViewAnchors } from './mavericks-views-verify.js';

export const MAVERICKS_VIEWS_BASE = Object.freeze({
  aerial: {
    position: { x: -200, y: 520, z: 680 },
    lookAt: { x: -100, y: 10, z: -200 },
    fov: 48,
  },
  shore: {
    position: { x: -520, y: 55, z: 280 },
    lookAt: { x: -180, y: 25, z: -280 },
    fov: 42,
  },
  cliff: {
    position: { x: -380, y: 22, z: -40 },
    lookAt: { x: -180, y: 30, z: -300 },
    fov: 40,
  },
  reef: {
    position: { x: -620, y: 90, z: 120 },
    lookAt: { x: -280, y: 4.2, z: -200 },
    fov: 46,
  },
  fallaway: {
    position: { x: -900, y: 80, z: 200 },
    lookAt: { x: -440, y: 6.2, z: -20 },
    fov: 44,
  },
  station: {
    position: { x: -40, y: 95, z: -80 },
    lookAt: { x: -182, y: 43, z: 262 },
    fov: 40,
  },
  tip: {
    position: { x: -280, y: 35, z: 80 },
    lookAt: { x: -200, y: 20, z: -280 },
    fov: 38,
  },
  spectators: {
    position: { x: -100, y: 5.5, z: 100 },
    lookAt: { x: -440, y: 6.2, z: -20 },
    fov: 50,
  },
});

/**
 * @param {import('./mavericks-pins.js').MavericksPins} pins
 */
export function buildViewsForPins(pins) {
  const anchors = mhhwViewAnchors(pins);
  const spec = pins.spectators;
  const views = { ...MAVERICKS_VIEWS_BASE };

  views.fallaway = { ...views.fallaway, lookAt: { ...anchors.breakLookAt } };
  views.reef = { ...views.reef, lookAt: { ...anchors.reefLookAt } };
  views.shore = { ...views.shore, lookAt: { ...anchors.shoreLookAt } };
  views.station = {
    ...views.station,
    position: { ...anchors.stationPosition },
    lookAt: { ...anchors.stationLookAt },
  };

  if (spec) {
    views.spectators = {
      position: {
        x: spec.x,
        y: (spec.ground_y ?? 0) + (spec.eye_height_m ?? 2.5),
        z: spec.z,
      },
      lookAt: spec.look_at ?? { ...anchors.breakLookAt },
      fov: 50,
    };
  }

  return Object.freeze(views);
}
