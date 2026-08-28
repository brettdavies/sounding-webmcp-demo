/**
 * Reef whitewash — cascade Jacobian history + set-wave lip on the break zone.
 * Pulses with set waves; decays in lulls so reef foam is not always on.
 */

export const REEF_RADIUS_M = 210;
export const REEF_WASH_DECAY = 1.45;

/** @typedef {{ x: number, z: number }} Xz */

/**
 * @param {number} x
 * @param {number} z
 * @param {Xz} peak
 * @param {number} [radiusM]
 */
export function reefZoneMaskAt(x, z, peak, radiusM = REEF_RADIUS_M) {
  const dx = x - peak.x;
  const dz = z - peak.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist >= radiusM) return 0;
  const t = 1 - dist / radiusM;
  return t * t * (3 - 2 * t);
}

/**
 * @param {{ kind?: string, active?: number, face_m?: number }} setWave
 */
export function reefWashPulse(setWave) {
  if (setWave.kind !== 'set' || (setWave.active ?? 0) < 0.1) return 0;
  return (setWave.active ?? 0) * Math.min(1, (setWave.face_m ?? 0) / 14);
}

/**
 * @param {{ level: number }} state
 * @param {{ kind?: string, active?: number, face_m?: number }} setWave
 * @param {number} dt
 */
export function updateReefWash(state, setWave, dt) {
  const pulse = reefWashPulse(setWave);
  state.level = Math.max(pulse, state.level * Math.exp(-dt * REEF_WASH_DECAY));
  return state.level;
}

/**
 * @param {number} cascadeHistory 0..1 Jacobian history from FFT cascade
 * @param {number} lipJ set-wave lip Jacobian 0..1
 * @param {number} reefMask zone mask 0..1
 * @param {number} reefWash temporal envelope 0..1
 */
export function reefWhitewashComposite(
  cascadeHistory,
  lipJ,
  reefMask,
  reefWash,
) {
  const cascade =
    cascadeHistory * reefMask * reefWash * (0.35 + 0.65 * cascadeHistory);
  const lip = lipJ * reefMask * reefWash * 0.92;
  return {
    cascade: Number(cascade.toFixed(4)),
    lip: Number(lip.toFixed(4)),
    total: Number((cascade + lip).toFixed(4)),
  };
}

/**
 * @param {Xz} [peak]
 */
export function verifyReefWhitewash(peak = { x: -440, z: -20 }) {
  /** @type {{ level: number }} */
  const state = { level: 0 };
  const setWave = { kind: 'set', active: 1, face_m: 16.5, label: 'main' };
  const lullWave = { kind: 'lull', active: 0, face_m: 7 };

  updateReefWash(state, setWave, 0);
  const peakWash = state.level;
  const reefMask = reefZoneMaskAt(peak.x, peak.z, peak);
  const beachMask = reefZoneMaskAt(-100, 100, peak);
  const active = reefWhitewashComposite(0.55, 0.1, reefMask, peakWash);

  for (let i = 0; i < 40; i += 1) {
    updateReefWash(state, lullWave, 0.1);
  }
  const lullWash = state.level;
  const lull = reefWhitewashComposite(0.55, 0.1, reefMask, lullWash);

  const ok =
    peakWash > 0.4 &&
    lullWash < 0.12 &&
    reefMask > 0.95 &&
    beachMask < 0.08 &&
    active.total > 0.25 &&
    lull.total < 0.06;

  return {
    ok,
    peakWash: Number(peakWash.toFixed(4)),
    lullWash: Number(lullWash.toFixed(4)),
    reefMask: Number(reefMask.toFixed(4)),
    beachMask: Number(beachMask.toFixed(4)),
    active,
    lull,
  };
}
