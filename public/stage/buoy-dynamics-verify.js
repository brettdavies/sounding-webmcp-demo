/**
 * Node-safe buoy heave integrator smoke test — never airborne contract.
 * Mirrors clamp logic from buoy.js without THREE.
 */

const MAX_DRAFT_SINK_M = 0.65;
const MAX_FREEBOARD_M = 0.02;
const HEAVE_RAO = 0.94;
const HEAVE_FOLLOW = 14;
const DRAFT_SINK = 0.28;

/**
 * @param {number} heave
 * @param {number} eta
 * @param {number} dt
 */
function stepHeave(heave, eta, dt) {
  const ride = eta * HEAVE_RAO;
  let targetY = ride - DRAFT_SINK;
  const ceiling = eta + MAX_FREEBOARD_M;
  const floor = eta - MAX_DRAFT_SINK_M;
  targetY = Math.min(Math.max(targetY, floor), ceiling);

  const hAlpha = 1 - Math.exp(-HEAVE_FOLLOW * dt);
  let next = heave + (targetY - heave) * hAlpha;
  next = Math.min(Math.max(next, floor), ceiling);
  return next;
}

/**
 * Sweep synthetic η(t) and assert waterline never exceeds free surface + freeboard.
 */
export function verifyBuoyNeverAirborne() {
  let heave = 0;
  let airborne = 0;
  let maxFreeboard = 0;
  const dt = 1 / 120;

  for (let frame = 0; frame < 2400; frame += 1) {
    const t = frame * dt;
    const eta =
      8 * Math.sin(t * 0.7) +
      4 * Math.sin(t * 1.9 + 0.3) +
      12 * Math.max(0, Math.sin(t * 0.25 - 1.2));
    heave = stepHeave(heave, eta, dt);
    const freeboard = heave - eta;
    maxFreeboard = Math.max(maxFreeboard, freeboard);
    if (freeboard > MAX_FREEBOARD_M + 1e-6) {
      airborne += 1;
    }
  }

  return {
    ok: airborne === 0 && maxFreeboard <= MAX_FREEBOARD_M + 1e-4,
    airborneFrames: airborne,
    maxFreeboard: Number(maxFreeboard.toFixed(4)),
    maxAllowed: MAX_FREEBOARD_M,
  };
}
