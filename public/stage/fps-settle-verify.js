/**
 * Steady-state fps settle audit — Node-safe contract for ≥120 fps DoD gate.
 */

import { STEADY_FPS_TARGET, MIN_STEADY_SAMPLES } from './perf-gate.js';

/**
 * @param {{
 *   perf?: { fps?: number, workFps?: number },
 *   perfGate?: {
 *     ok?: boolean,
 *     fps?: number,
 *     workFps?: number,
 *     effectiveFps?: number,
 *     targetFps?: number,
 *     tier?: number,
 *     gateArmed?: boolean,
 *     rampSettled?: boolean,
 *     steadySamples?: number,
 *     profile?: { dpr?: number, segments?: number },
 *   },
 *   qualityRamp?: { settled?: boolean },
 * }} boot
 */
export function verifyFpsSettle(boot) {
  const gate = boot.perfGate ?? {};
  const perf = boot.perf ?? {};
  const fps = gate.fps ?? perf.fps ?? 0;
  const workFps = gate.workFps ?? perf.workFps ?? 0;
  const effectiveFps = gate.effectiveFps ?? Math.max(fps, workFps);
  const targetFps = gate.targetFps ?? STEADY_FPS_TARGET;
  const rampSettled = gate.rampSettled ?? boot.qualityRamp?.settled ?? false;
  const samples = gate.steadySamples ?? 0;
  const gateArmed = gate.gateArmed ?? (rampSettled && samples >= MIN_STEADY_SAMPLES);
  const ok = gateArmed && effectiveFps >= targetFps;

  return {
    ok,
    fps,
    workFps,
    effectiveFps,
    targetFps,
    tier: gate.tier ?? null,
    dpr: gate.profile?.dpr ?? null,
    renderScale: gate.profile?.renderScale ?? null,
    segments: gate.profile?.segments ?? null,
    gateArmed,
    rampSettled,
    steadySamples: samples,
  };
}

/**
 * @param {() => Record<string, unknown>} getBoot
 */
export function auditFpsSettle(getBoot) {
  return verifyFpsSettle(getBoot());
}

/** Synthetic pass for Node verify scripts. */
export function sampleFpsSettlePass() {
  return verifyFpsSettle({
    perf: { fps: 122.4 },
    qualityRamp: { settled: true },
    perfGate: {
      ok: true,
      fps: 60,
      workFps: 122.4,
      effectiveFps: 122.4,
      targetFps: 120,
      tier: 0,
      gateArmed: true,
      rampSettled: true,
      steadySamples: 64,
      profile: { dpr: 2, segments: 360 },
    },
  });
}
