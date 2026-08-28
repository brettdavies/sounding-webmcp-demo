/**
 * Set-wave lip Jacobian foam — surface folding at the breaking lip.
 * CPU mirror of ocean-material.js setWaveLipJacobian GLSL.
 */
import { crestXiAt } from './break-line-crest.js';

export const LIP_EPS_M = 3;

/**
 * Set-wave face displacement only (no ambient swell).
 * @param {ReturnType<typeof sampleSetWave>} setWave
 * @param {number} x
 * @param {number} z
 * @param {ReturnType<import('./set-wave.js').buildSetWaveSchedule>} [schedule]
 */
export function setWaveFaceDisplacementAt(setWave, x, z, schedule) {
  const out = { x: 0, y: 0, z: 0 };
  if (setWave.active < 0.01 || setWave.amplitude < 0.01) return out;

  const dir = setWave.dir;
  const xi = schedule?.polyline?.length
    ? crestXiAt(
        x,
        z,
        setWave.crestAlong,
        schedule.buoyAlong,
        dir,
        schedule.polyline,
      )
    : dir.x * x + dir.y * z - setWave.crestAlong;
  const env = Math.exp(-(xi * xi) / Math.max(setWave.width * setWave.width, 1));
  const mix = setWave.active * env;
  const phase = setWave.k * xi;
  const sinP = Math.sin(phase);
  const cosP = Math.cos(phase);
  const amp = setWave.amplitude * mix;
  const lip = setWave.lipSkew ?? 0;
  const phaseLip = phase + lip * sinP;
  const horiz = setWave.horizMul ?? 1;
  const tube = (setWave.tubeMix ?? 0) * mix * Math.sin(phaseLip * 2 + 1.4);
  out.x = -dir.x * setWave.steepness * amp * sinP * horiz;
  out.y = amp * cosP + tube;
  out.z = -dir.y * setWave.steepness * amp * sinP * horiz;
  return out;
}

/**
 * Horizontal-displacement Jacobian fold (1 - det J), clamped.
 * @param {ReturnType<typeof sampleSetWave>} setWave
 * @param {number} x
 * @param {number} z
 * @param {ReturnType<import('./set-wave.js').buildSetWaveSchedule>} [schedule]
 * @param {number} [eps]
 */
export function lipJacobianAt(setWave, x, z, schedule, eps = LIP_EPS_M) {
  const d0 = setWaveFaceDisplacementAt(setWave, x, z, schedule);
  const dx = setWaveFaceDisplacementAt(setWave, x + eps, z, schedule);
  const dz = setWaveFaceDisplacementAt(setWave, x, z + eps, schedule);
  const jxx = 1 + (dx.x - d0.x) / eps;
  const jzz = 1 + (dz.z - d0.z) / eps;
  const jxz = 0.5 * ((dx.z - d0.z) / eps + (dz.x - d0.x) / eps);
  const j = jxx * jzz - jxz * jxz;
  return Math.max(0, Math.min(1, 1.05 - j)) * setWave.active;
}

/**
 * Tube lip ring read (0..1) for bomb break style.
 * @param {ReturnType<typeof sampleSetWave>} setWave
 * @param {number} x
 * @param {number} z
 * @param {ReturnType<import('./set-wave.js').buildSetWaveSchedule>} [schedule]
 */
export function tubeLipRingAt(setWave, x, z, schedule) {
  if (setWave.breakStyle !== 'tube' || setWave.active < 0.01) return 0;
  const dir = setWave.dir;
  const xi = schedule?.polyline?.length
    ? crestXiAt(
        x,
        z,
        setWave.crestAlong,
        schedule.buoyAlong,
        dir,
        schedule.polyline,
      )
    : dir.x * x + dir.y * z - setWave.crestAlong;
  const ring = Math.abs(Math.sin(setWave.k * xi * 2 + 1.4));
  if (ring <= 0.25 || ring >= 0.65) return 0;
  return setWave.active * (setWave.tubeMix ?? 0);
}

/**
 * @param {ReturnType<typeof sampleSetWave>} setWave
 * @param {number} x
 * @param {number} z
 * @param {ReturnType<import('./set-wave.js').buildSetWaveSchedule>} [schedule]
 */
export function lipFoamCompositeAt(setWave, x, z, schedule) {
  const lipJ = lipJacobianAt(setWave, x, z, schedule);
  const tubeRing = tubeLipRingAt(setWave, x, z, schedule);
  const faceY = setWaveFaceDisplacementAt(setWave, x, z, schedule).y;
  const lipFoam = lipJ * Math.max(0, Math.min(1, (faceY - 2) / 9)) * 0.92;
  return {
    lipJ: Number(lipJ.toFixed(4)),
    tubeRing: Number(tubeRing.toFixed(4)),
    lipFoam: Number(lipFoam.toFixed(4)),
  };
}
