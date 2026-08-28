/**
 * Steady-state perf gate — adaptive ocean/FX tiers targeting ≥120 fps after quality ramp.
 * Node-safe (no Three.js).
 */

export const STEADY_FPS_TARGET = 120;

export const MIN_STEADY_SAMPLES = 48;

/** Ocean/FX tiers — lower cost first; terrain stride stays full-res elsewhere. */
export const PERF_OCEAN_TIERS = Object.freeze([
  { id: 0, segments: 360, fftSkip: 1, fxMul: 1, spray: true },
  { id: 1, segments: 240, fftSkip: 1, fxMul: 0.85, spray: true },
  { id: 2, segments: 128, fftSkip: 2, fxMul: 0.7, spray: false },
  { id: 3, segments: 64, fftSkip: 2, fxMul: 0.55, spray: false },
]);

const LOW_FPS_THRESHOLD = 110;
const HIGH_FPS_THRESHOLD = 125;
const TIER_DOWN_STREAK = 18;
const TIER_UP_STREAK = 48;

/**
 * @param {{ targetFps?: number }} [options]
 */
export function createPerfGate(options = {}) {
  const targetFps = options.targetFps ?? STEADY_FPS_TARGET;
  let tier = 0;
  let lowStreak = 0;
  let highStreak = 0;
  let steadySamples = 0;

  /**
   * @param {{ fps: number, rampSettled: boolean, samples: number }} input
   */
  function tick(input) {
    if (!input.rampSettled) {
      return snapshot(input);
    }
    steadySamples = input.samples;
    if (input.fps < LOW_FPS_THRESHOLD) {
      lowStreak += 1;
      highStreak = 0;
      if (lowStreak >= TIER_DOWN_STREAK && tier < PERF_OCEAN_TIERS.length - 1) {
        tier += 1;
        lowStreak = 0;
      }
    } else if (input.fps > HIGH_FPS_THRESHOLD) {
      highStreak += 1;
      lowStreak = 0;
      if (highStreak >= TIER_UP_STREAK && tier > 0) {
        tier -= 1;
        highStreak = 0;
      }
    } else {
      lowStreak = 0;
      highStreak = 0;
    }
    return snapshot(input);
  }

  /** @param {{ fps?: number, rampSettled?: boolean, samples?: number }} [input] */
  function snapshot(input = {}) {
    const profile = PERF_OCEAN_TIERS[tier];
    const fps = input.fps ?? 0;
    const rampSettled = input.rampSettled ?? false;
    const samples = input.samples ?? steadySamples;
    const gateArmed = rampSettled && samples >= MIN_STEADY_SAMPLES;
    const ok = gateArmed && fps >= targetFps;
    return {
      ok,
      targetFps,
      tier,
      profile,
      fps,
      rampSettled,
      steadySamples: samples,
      gateArmed,
    };
  }

  return { tick, snapshot };
}

/**
 * @param {{ fps: number, tier: number, rampSettled: boolean, samples: number, targetFps?: number }} sample
 */
export function verifyPerfGate(sample) {
  const target = sample.targetFps ?? STEADY_FPS_TARGET;
  const profile = PERF_OCEAN_TIERS[sample.tier] ?? PERF_OCEAN_TIERS[0];
  const gateArmed =
    sample.rampSettled && sample.samples >= MIN_STEADY_SAMPLES;
  const ok = gateArmed && sample.fps >= target;
  return {
    ok,
    targetFps: target,
    fps: sample.fps,
    tier: sample.tier,
    segments: profile.segments,
    fftSkip: profile.fftSkip,
    gateArmed,
  };
}

/** Synthetic steady-state sample for Node verify. */
export function samplePerfGatePass() {
  return {
    fps: 122.4,
    tier: 0,
    rampSettled: true,
    samples: 64,
  };
}

/**
 * Effective ocean segments after quality ramp + perf tier (never coarsens terrain).
 * @param {{ settled: boolean, segments: number }} ramp
 * @param {number} perfTier
 */
export function effectiveOceanSegments(ramp, perfTier) {
  if (!ramp.settled) {
    return ramp.segments;
  }
  const cap = PERF_OCEAN_TIERS[perfTier]?.segments ?? ramp.segments;
  return Math.min(ramp.segments, cap);
}

/**
 * @param {number} frameIndex
 * @param {number} fftSkip
 */
export function shouldUpdateOceanFft(frameIndex, fftSkip) {
  return frameIndex % Math.max(1, fftSkip) === 0;
}
