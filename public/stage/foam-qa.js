/**
 * P1b foam QA — shore band and spray off in lulls; reef foam decays.
 */
import { verifyShoreWhitewash, shoreWashPulse, updateShoreWash } from './shore-whitewash.js';
import { verifyReefWhitewash, reefWashPulse, updateReefWash } from './reef-whitewash.js';
import {
  verifyBuoySpray,
  sprayPulse,
  updateSprayLevel,
} from './buoy-spray-level.js';
import { reefWhitewashComposite } from './reef-whitewash.js';

/**
 * @param {{
 *   spectators?: { x: number, z: number },
 *   breakPeak?: { x: number, z: number },
 * }} [pins]
 */
export function verifyFoamQa(pins = {}) {
  const spectators = pins.spectators ?? { x: -100, z: 100 };
  const breakPeak = pins.breakPeak ?? { x: -440, z: -20 };
  const shore = verifyShoreWhitewash(spectators);
  const reef = verifyReefWhitewash(breakPeak);
  const spray = verifyBuoySpray(11);

  const lull = { kind: 'lull', active: 0, face_m: 7 };
  /** @type {{ level: number }} */
  const shoreState = { level: 0 };
  /** @type {{ level: number }} */
  const reefState = { level: 0 };
  /** @type {{ level: number }} */
  const sprayState = { level: 0 };

  updateShoreWash(shoreState, { kind: 'set', active: 1, face_m: 15 }, 0);
  updateReefWash(reefState, { kind: 'set', active: 1, face_m: 16.5 }, 0);
  updateSprayLevel(sprayState, { kind: 'set', active: 1, face_m: 18 }, 0, 11);

  for (let i = 0; i < 45; i += 1) {
    updateShoreWash(shoreState, lull, 0.1);
    updateReefWash(reefState, lull, 0.1);
    updateSprayLevel(sprayState, lull, 0.1, 0.3);
  }

  const lullShorePulse = shoreWashPulse(lull);
  const lullReefPulse = reefWashPulse(lull);
  const lullSprayPulse = sprayPulse(lull, 0.3);
  const lullReefFoam = reefWhitewashComposite(
    0.5,
    0.08,
    reef.reefMask,
    reefState.level,
  );

  const ok =
    shore.ok &&
    reef.ok &&
    spray.ok &&
    shoreState.level < 0.12 &&
    reefState.level < 0.12 &&
    sprayState.level < 0.08 &&
    lullShorePulse === 0 &&
    lullReefPulse === 0 &&
    lullSprayPulse === 0 &&
    lullReefFoam.total < 0.06;

  return {
    ok,
    shore,
    reef,
    spray,
    lull: {
      shoreLevel: Number(shoreState.level.toFixed(4)),
      reefLevel: Number(reefState.level.toFixed(4)),
      sprayLevel: Number(sprayState.level.toFixed(4)),
      reefFoamTotal: lullReefFoam.total,
    },
  };
}
