/**
 * Shore whitewash — pulsed foam near spectator beach with temporal decay.
 * CPU state drives shader mask; no permanent white band at dry sand.
 */

export const SHORE_RADIUS_M = 130;
export const SHORE_WASH_DECAY = 1.65;

/** @typedef {{ x: number, z: number }} Xz */

/**
 * @param {number} x
 * @param {number} z
 * @param {Xz} center
 * @param {number} [radiusM]
 */
export function shoreWashMaskAt(x, z, center, radiusM = SHORE_RADIUS_M) {
  const dx = x - center.x;
  const dz = z - center.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist >= radiusM) return 0;
  const t = 1 - dist / radiusM;
  return t * t * (3 - 2 * t);
}

/**
 * @param {{ kind?: string, active?: number, face_m?: number }} setWave
 */
export function shoreWashPulse(setWave) {
  if (setWave.kind !== 'set' || (setWave.active ?? 0) < 0.12) return 0;
  return (setWave.active ?? 0) * Math.min(1, (setWave.face_m ?? 0) / 12);
}

/**
 * @param {{ level: number }} state
 * @param {{ kind?: string, active?: number, face_m?: number }} setWave
 * @param {number} dt
 */
export function updateShoreWash(state, setWave, dt) {
  const pulse = shoreWashPulse(setWave);
  state.level = Math.max(pulse, state.level * Math.exp(-dt * SHORE_WASH_DECAY));
  return state.level;
}

/**
 * @param {Xz} [center]
 */
export function verifyShoreWhitewash(center = { x: -100, z: 100 }) {
  /** @type {{ level: number }} */
  const state = { level: 0 };
  const setWave = { kind: 'set', active: 1, face_m: 15, label: 'main' };
  const lullWave = { kind: 'lull', active: 0, face_m: 7 };

  updateShoreWash(state, setWave, 0);
  const peak = state.level;
  for (let i = 0; i < 40; i += 1) {
    updateShoreWash(state, lullWave, 0.1);
  }
  const afterDecay = state.level;
  const beachMask = shoreWashMaskAt(center.x, center.z, center);
  const reefMask = shoreWashMaskAt(-440, -20, center);

  const ok =
    peak > 0.35 &&
    afterDecay < 0.12 &&
    beachMask > 0.95 &&
    reefMask < 0.05;

  return {
    ok,
    peak: Number(peak.toFixed(4)),
    afterDecay: Number(afterDecay.toFixed(4)),
    beachMask: Number(beachMask.toFixed(4)),
    reefMask: Number(reefMask.toFixed(4)),
  };
}
