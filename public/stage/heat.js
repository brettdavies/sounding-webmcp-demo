/**
 * Hybrid Mavericks heat: solitary rolling faces on a calm long-swell cascade.
 * Set structure: groups of big faces, smaller in-set waves, real lulls between sets.
 */
import * as THREE from 'three';
import { BUOY_XZ } from './sea-state.js';

const G = 9.81;

/** @typedef {{ tPeak: number, face_m: number, label: string, kind: 'set' | 'lull' | 'tween' }} HeatEvent */

/**
 * @param {{
 *   sets?: Array<{ label: string, faces_m: number[] }>,
 *   wave_gap_sec?: [number, number],
 *   loop_sec?: number,
 *   swell?: { direction_deg: number, period_s: number },
 *   wave?: { direction_deg: number, period_s: number, face_m?: number },
 * }} reading
 * @param {{ x: number, z: number }} [mooring]
 */
export function buildHeatSchedule(reading, mooring = BUOY_XZ) {
  const sets = reading.sets ?? [];
  const gapRange = reading.wave_gap_sec ?? [5, 7];
  const withinSetGap = (gapRange[0] + gapRange[1]) * 0.5;
  const directionDeg =
    reading.swell?.direction_deg ?? reading.wave?.direction_deg ?? 285;
  const periodS = reading.swell?.period_s ?? reading.wave?.period_s ?? 18;

  /** @type {HeatEvent[]} */
  const events = [];
  let t = 4;

  for (const set of sets) {
    const isLull = set.label === 'lull';
    const faces = set.faces_m;

    for (let i = 0; i < faces.length; i += 1) {
      const face = faces[i];
      const kind = isLull ? 'lull' : 'set';
      // Lull entries stay small; set faces are the bombs.
      const face_m = isLull ? Math.min(face, 8.5) : face;
      events.push({ tPeak: t, face_m, label: set.label, kind });
      t += withinSetGap;

      // Smaller intervening wave inside a set (not during lull labels).
      if (!isLull && i < faces.length - 1) {
        const tweenFace = THREE.MathUtils.clamp(face * 0.42, 5.5, 8.5);
        events.push({
          tPeak: t - withinSetGap * 0.48,
          face_m: tweenFace,
          label: 'between',
          kind: 'tween',
        });
      }
    }

    // Real breath between sets — empty sea, cascade only.
    t += isLull ? withinSetGap * 1.1 : withinSetGap * 2.4;
  }

  const rad = THREE.MathUtils.degToRad(directionDeg);
  const dir = new THREE.Vector2(Math.cos(rad), Math.sin(rad)).normalize();
  const buoyAlong = dir.x * mooring.x + dir.y * mooring.z;

  return {
    events,
    loopSec: Math.max(reading.loop_sec ?? 120, t + 6),
    directionDeg,
    periodS,
    dir,
    buoyAlong,
  };
}

/**
 * @param {ReturnType<typeof buildHeatSchedule>} schedule
 * @param {number} elapsed
 */
export function sampleHeat(schedule, elapsed) {
  const t = ((elapsed % schedule.loopSec) + schedule.loopSec) % schedule.loopSec;
  let best = null;
  let bestDist = Infinity;
  for (const event of schedule.events) {
    const dist = Math.abs(t - event.tPeak);
    if (dist < bestDist) {
      bestDist = dist;
      best = event;
    }
  }
  if (!best) {
    return idleHeat(schedule);
  }

  // Longer window so the face rolls through, not a spike.
  const halfWindow = best.kind === 'set' ? 4.2 : best.kind === 'tween' ? 2.8 : 3.2;
  const temporal = smoothPulse(bestDist, halfWindow);
  if (temporal < 0.01) {
    return idleHeat(schedule, best);
  }

  const wavelength =
    best.kind === 'set'
      ? THREE.MathUtils.clamp(120 + best.face_m * 4.5, 160, 240)
      : THREE.MathUtils.clamp(95 + best.face_m * 3.5, 110, 170);
  const k = (Math.PI * 2) / wavelength;
  const omega = Math.sqrt(G * k);
  const phaseSpeed = omega / k;
  const ampScale = best.kind === 'set' ? 1.05 : best.kind === 'tween' ? 0.58 : 0.48;
  const amplitude = best.face_m * ampScale;
  const steepness = Math.min(
    best.kind === 'set' ? 0.92 : 0.62,
    1.1 / Math.max(k * amplitude, 1e-4),
  );
  const width = wavelength * (best.kind === 'set' ? 0.24 : 0.36);
  const crestAlong = schedule.buoyAlong + (t - best.tPeak) * phaseSpeed;

  return {
    active: temporal,
    face_m: best.face_m,
    label: best.label,
    kind: best.kind,
    tPeak: best.tPeak,
    loopT: t,
    directionDeg: schedule.directionDeg,
    periodS: schedule.periodS,
    dir: schedule.dir,
    k,
    omega,
    amplitude,
    steepness,
    width,
    crestAlong,
  };
}

function idleHeat(schedule, event = null) {
  return {
    active: 0,
    face_m: event?.face_m ?? 0,
    label: event?.label ?? '',
    kind: event?.kind ?? 'set',
    tPeak: event?.tPeak ?? 0,
    loopT: 0,
    directionDeg: schedule.directionDeg,
    periodS: schedule.periodS,
    dir: schedule.dir,
    k: 0.02,
    omega: 0,
    amplitude: 0,
    steepness: 0,
    width: 200,
    crestAlong: schedule.buoyAlong,
  };
}

function smoothPulse(dist, halfWindow) {
  if (dist >= halfWindow) return 0;
  const x = 1 - dist / halfWindow;
  return x * x * (3 - 2 * x);
}

/**
 * @param {ReturnType<typeof sampleHeat>} heat
 * @param {number} x
 * @param {number} z
 * @returns {THREE.Vector3}
 */
export function heatDisplacementAt(heat, x, z) {
  const out = new THREE.Vector3();
  if (heat.active < 0.01 || heat.amplitude < 0.01) return out;

  const along = heat.dir.x * x + heat.dir.y * z;
  const xi = along - heat.crestAlong;
  const env = Math.exp(-(xi * xi) / Math.max(heat.width * heat.width, 1));
  const mix = heat.active * env;
  const phase = heat.k * xi;
  const sinP = Math.sin(phase);
  const cosP = Math.cos(phase);
  const amp = heat.amplitude * mix;
  out.x = -heat.dir.x * heat.steepness * amp * sinP;
  out.y = amp * cosP;
  out.z = -heat.dir.y * heat.steepness * amp * sinP;
  return out;
}

/**
 * @param {THREE.ShaderMaterial} material
 * @param {ReturnType<typeof sampleHeat>} heat
 */
/**
 * Ambient long-swell Gerstner (CPU) — matches ocean-material always-on swell.
 * @param {ReturnType<typeof buildHeatSchedule>} schedule
 * @param {number} time
 * @param {number} x
 * @param {number} z
 */
export function ambientSwellAt(schedule, time, x, z) {
  const dir = schedule.dir;
  const dir2 = new THREE.Vector2(dir.x, dir.y)
    .clone()
    .add(new THREE.Vector2(-dir.y, dir.x).multiplyScalar(0.2))
    .normalize();
  const waves = [
    { amp: 1.4, steep: 0.22, length: 380, dir },
    { amp: 0.55, steep: 0.16, length: 190, dir: dir2 },
  ];
  const out = new THREE.Vector3();
  for (const w of waves) {
    const k = (Math.PI * 2) / w.length;
    const omega = Math.sqrt(G * k);
    const phase = k * (w.dir.x * x + w.dir.y * z) - omega * time;
    const sinP = Math.sin(phase);
    const cosP = Math.cos(phase);
    out.x += -w.dir.x * w.steep * w.amp * sinP;
    out.y += w.amp * cosP;
    out.z += -w.dir.y * w.steep * w.amp * sinP;
  }
  return out;
}

export function applyHeatUniforms(material, heat, schedule) {
  const u = material.uniforms;
  u.heatActive.value = heat.active;
  u.heatAmplitude.value = heat.amplitude;
  u.heatSteepness.value = heat.steepness;
  u.heatK.value = heat.k;
  u.heatWidth.value = heat.width;
  u.heatCrestAlong.value = heat.crestAlong;
  u.heatDirection.value.set(heat.dir.x, heat.dir.y);
  // Duck residual FFT while a face owns the frame.
  const duck =
    heat.kind === 'set'
      ? THREE.MathUtils.lerp(1, 0.15, heat.active)
      : heat.kind === 'tween'
        ? THREE.MathUtils.lerp(1, 0.35, heat.active)
        : THREE.MathUtils.lerp(1, 0.45, heat.active);
  u.cascadeScale.value = duck;

  if (schedule) {
    const dir = schedule.dir;
    u.swellDirection.value.set(dir.x, dir.y);
    const side = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(0.2);
    u.swell2Direction.value.set(dir.x + side.x, dir.y + side.y).normalize();
  }
}

export function fallbackReading() {
  return {
    loop_sec: 120,
    wave_gap_sec: /** @type {[number, number]} */ ([5, 7]),
    swell: { direction_deg: 285, period_s: 18 },
    wave: { direction_deg: 285, period_s: 18, face_m: 15 },
    sets: [
      { label: 'opener', faces_m: [12.5, 13.8, 14.2, 15.5] },
      { label: 'lull', faces_m: [7.5, 6.8] },
      { label: 'main', faces_m: [14.0, 16.5, 18.0, 17.2, 15.8] },
      { label: 'lull', faces_m: [7.0, 6.5] },
      { label: 'closing', faces_m: [13.5, 15.0, 16.8, 14.5, 13.0] },
    ],
  };
}
