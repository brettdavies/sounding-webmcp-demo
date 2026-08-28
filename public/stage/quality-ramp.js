/**
 * Progressive quality ramp — ocean segments, FFT tier, FX scale over 0–2 s.
 * Node-safe (no Three.js).
 */

export const QUALITY_RAMP_SEC = 2;

/** Segment tiers ramp low → full (terrain stays full-res elsewhere). */
export const SEGMENT_TIERS = Object.freeze([64, 128, 240, 360]);

export const FFT_TIERS = Object.freeze([64, 128]);

/**
 * @param {number} elapsedSec seconds since main tick loop started
 * @param {number} [durationSec]
 */
export function sampleQualityRamp(elapsedSec, durationSec = QUALITY_RAMP_SEC) {
  const t = Math.min(Math.max(elapsedSec / durationSec, 0), 1);
  const ease = t * t * (3 - 2 * t);
  const tierIndex = Math.min(
    SEGMENT_TIERS.length - 1,
    Math.floor(ease * SEGMENT_TIERS.length),
  );
  const segments = SEGMENT_TIERS[tierIndex];
  const fftResolution = ease >= 0.5 ? FFT_TIERS[1] : FFT_TIERS[0];
  return {
    t: Number(t.toFixed(4)),
    ease: Number(ease.toFixed(4)),
    segments,
    fftResolution,
    fxScale: Number(ease.toFixed(4)),
    settled: t >= 1,
  };
}

/** Node-safe gate for verify script. */
export function verifyQualityRamp() {
  const start = sampleQualityRamp(0);
  const mid = sampleQualityRamp(1);
  const end = sampleQualityRamp(2.5);
  const ok =
    start.segments === 64 &&
    start.fftResolution === 64 &&
    start.fxScale === 0 &&
    !start.settled &&
    mid.segments >= 64 &&
    mid.fftResolution === 128 &&
    end.settled &&
    end.segments === 360 &&
    end.fftResolution === 128 &&
    end.fxScale === 1;
  return { ok, start, mid, end, rampSec: QUALITY_RAMP_SEC };
}
