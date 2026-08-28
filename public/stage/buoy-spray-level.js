/**
 * Buoy spray level — CPU pulse/decay for set-wave impact (no Three.js).
 */

export const SPRAY_DECAY = 3.8;

/**
 * @param {{ kind?: string, active?: number, face_m?: number }} setWave
 * @param {number} [eta]
 */
export function sprayPulse(setWave, eta = 0) {
  if (setWave.kind !== 'set' || (setWave.active ?? 0) < 0.15) return 0;
  const faceBoost = Math.min(1, (setWave.face_m ?? 0) / 13);
  const impact = Math.min(1, Math.abs(eta) * 0.08);
  return (setWave.active ?? 0) * faceBoost * (0.65 + impact * 0.35);
}

/**
 * @param {{ level: number }} state
 * @param {{ kind?: string, active?: number, face_m?: number }} setWave
 * @param {number} dt
 * @param {number} [eta]
 */
export function updateSprayLevel(state, setWave, dt, eta = 0) {
  const pulse = sprayPulse(setWave, eta);
  state.level = Math.max(pulse, state.level * Math.exp(-dt * SPRAY_DECAY));
  return state.level;
}

/**
 * @param {number} [eta]
 */
export function verifyBuoySpray(eta = 11) {
  /** @type {{ level: number }} */
  const state = { level: 0 };
  const bomb = { kind: 'set', active: 1, face_m: 18, label: 'main' };
  const lull = { kind: 'lull', active: 0, face_m: 7 };

  updateSprayLevel(state, bomb, 0, eta);
  const peak = state.level;
  const peakPulse = sprayPulse(bomb, eta);
  for (let i = 0; i < 35; i += 1) {
    updateSprayLevel(state, lull, 0.1, 0.4);
  }
  const lullLevel = state.level;
  const lullPulse = sprayPulse(lull, 0.4);

  const ok =
    peak > 0.45 &&
    lullLevel < 0.08 &&
    peakPulse > 0.45 &&
    lullPulse === 0;

  return {
    ok,
    peak: Number(peak.toFixed(4)),
    lullLevel: Number(lullLevel.toFixed(4)),
    peakPulse: Number(peakPulse.toFixed(4)),
    lullPulse,
  };
}
