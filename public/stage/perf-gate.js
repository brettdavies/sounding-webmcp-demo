/**
 * Steady-state perf gate — adaptive ocean/FX tiers targeting ≥120 fps after quality ramp.
 * Node-safe (no Three.js).
 */

export const STEADY_FPS_TARGET = 120;

export const MIN_STEADY_SAMPLES = 48;

/** Ocean/FX tiers — lower cost first; terrain stride stays full-res elsewhere. */
export const PERF_OCEAN_TIERS = Object.freeze([
  { id: 0, segments: 360, fftSkip: 1, fxMul: 1, spray: true, dpr: 2, renderScale: 1, fftResolution: 128 },
  { id: 1, segments: 240, fftSkip: 1, fxMul: 0.85, spray: true, dpr: 1.5, renderScale: 1, fftResolution: 128 },
  { id: 2, segments: 128, fftSkip: 2, fxMul: 0.7, spray: false, dpr: 1, renderScale: 1, fftResolution: 128 },
  { id: 3, segments: 64, fftSkip: 2, fxMul: 0.55, spray: false, dpr: 0.75, renderScale: 0.65, fftResolution: 64 },
  { id: 4, segments: 48, fftSkip: 4, fxMul: 0.4, spray: false, dpr: 0.5, renderScale: 0.45, fftResolution: 64 },
  { id: 5, segments: 32, fftSkip: 8, fxMul: 0.35, spray: false, dpr: 0.4, renderScale: 0.35, fftResolution: 64 },
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
  /** @type {number | null} */
  let forcedTier = null;

  /**
   * @param {number} value
   */
  function forceTier(value) {
    const clamped = Math.max(
      0,
      Math.min(PERF_OCEAN_TIERS.length - 1, Math.floor(value)),
    );
    forcedTier = clamped;
    tier = clamped;
    lowStreak = 0;
    highStreak = 0;
  }

  /**
   * @param {{ fps: number, workFps?: number, rampSettled: boolean, samples: number }} input
   */
  function tick(input) {
    if (forcedTier != null) {
      tier = forcedTier;
      steadySamples = input.samples;
      return snapshot(input);
    }
    if (!input.rampSettled) {
      return snapshot(input);
    }
    steadySamples = input.samples;
    const effectiveFps = Math.max(input.fps, input.workFps ?? 0);
    if (effectiveFps < LOW_FPS_THRESHOLD) {
      lowStreak += 1;
      highStreak = 0;
      if (lowStreak >= TIER_DOWN_STREAK && tier < PERF_OCEAN_TIERS.length - 1) {
        tier += 1;
        lowStreak = 0;
      }
    } else if (effectiveFps > HIGH_FPS_THRESHOLD) {
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

  /** @param {{ fps?: number, workFps?: number, rampSettled?: boolean, samples?: number }} [input] */
  function snapshot(input = {}) {
    const profile = PERF_OCEAN_TIERS[tier];
    const fps = input.fps ?? 0;
    const workFps = input.workFps ?? 0;
    const effectiveFps = Math.max(fps, workFps);
    const rampSettled = input.rampSettled ?? false;
    const samples = input.samples ?? steadySamples;
    const gateArmed = rampSettled && samples >= MIN_STEADY_SAMPLES;
    const ok = gateArmed && effectiveFps >= targetFps;
    return {
      ok,
      targetFps,
      tier,
      profile,
      fps,
      workFps,
      effectiveFps: Number(effectiveFps.toFixed(1)),
      rampSettled,
      steadySamples: samples,
      gateArmed,
    };
  }

  return { tick, snapshot, forceTier };
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

/**
 * Cap device pixel ratio for render cost at a perf tier.
 * @param {number} perfTier
 * @param {number} [deviceDpr]
 */
export function effectiveDpr(perfTier, deviceDpr = 1) {
  const cap = PERF_OCEAN_TIERS[perfTier]?.dpr ?? 2;
  return Math.min(deviceDpr || 1, cap);
}

/**
 * Internal render buffer scale at a perf tier (CSS layout unchanged).
 * @param {number} perfTier
 */
export function effectiveRenderScale(perfTier) {
  return PERF_OCEAN_TIERS[perfTier]?.renderScale ?? 1;
}

/**
 * Cap FFT resolution under perf pressure (ocean-only; terrain unchanged).
 * @param {number} rampFft
 * @param {number} perfTier
 */
export function effectiveFftResolution(rampFft, perfTier) {
  const cap = PERF_OCEAN_TIERS[perfTier]?.fftResolution ?? rampFft;
  return Math.min(rampFft, cap);
}
