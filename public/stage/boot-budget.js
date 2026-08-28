/**
 * Boot timing marks and optional frame perf telemetry for evidence gate.
 */

/** @typedef {'sea' | 'land'} BootMode */

/**
 * @param {{ mode?: BootMode }} [options]
 */
export function createBootBudget(options = {}) {
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  /** @type {Record<string, number>} */
  const marks = { bootStart: 0 };

  /**
   * @param {string} name
   */
  function mark(name) {
    const elapsed =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
      t0;
    marks[name] = Number(elapsed.toFixed(1));
    return marks[name];
  }

  function snapshot() {
    return {
      mode: options.mode ?? 'sea',
      marks: { ...marks },
      firstFrameMs: marks.firstFrame ?? null,
      fullyReadyMs: marks.fullyReady ?? null,
      terrainReadyMs: marks.terrainReady ?? null,
      buoyReadyMs: marks.buoyReady ?? null,
    };
  }

  return { mark, snapshot, t0 };
}

export function createPerfMonitor() {
  let fpsEma = 0;
  let frameMsEma = 0;
  let workFpsEma = 0;
  let workMsEma = 0;
  let samples = 0;
  const alpha = 0.08;

  /**
   * @param {number} dt seconds (display / rAF interval)
   */
  function tick(dt) {
    if (dt <= 0) return;
    const fps = 1 / dt;
    const frameMs = dt * 1000;
    fpsEma = samples === 0 ? fps : fpsEma * (1 - alpha) + fps * alpha;
    frameMsEma =
      samples === 0 ? frameMs : frameMsEma * (1 - alpha) + frameMs * alpha;
    samples += 1;
  }

  /**
   * Per-frame work duration (sim + render) for uncapped throughput on vsync-limited displays.
   * @param {number} workMs
   */
  function tickWork(workMs) {
    if (workMs <= 0) return;
    const workFps = 1000 / workMs;
    workFpsEma =
      samples <= 1 ? workFps : workFpsEma * (1 - alpha) + workFps * alpha;
    workMsEma =
      samples <= 1 ? workMs : workMsEma * (1 - alpha) + workMs * alpha;
  }

  function snapshot() {
    return {
      fps: Number(fpsEma.toFixed(1)),
      frameMs: Number(frameMsEma.toFixed(2)),
      workFps: Number(workFpsEma.toFixed(1)),
      workMs: Number(workMsEma.toFixed(2)),
      samples,
    };
  }

  return { tick, tickWork, snapshot };
}

/**
 * @param {ReturnType<ReturnType<typeof createBootBudget>['snapshot']>} budget
 */
export function verifyBootBudget(budget) {
  const m = budget.marks ?? {};
  const ok =
    (budget.mode === 'sea' || budget.mode === 'land') &&
    m.bootStart === 0 &&
    m.firstFrame != null &&
    m.fullyReady != null &&
    m.firstFrame >= 0 &&
    m.fullyReady >= m.firstFrame;
  return {
    ok,
    mode: budget.mode,
    firstFrameMs: budget.firstFrameMs,
    fullyReadyMs: budget.fullyReadyMs,
    marks: m,
  };
}

/**
 * Synthetic marks for Node verify scripts.
 */
export function sampleBootBudgetSnapshot(mode = 'sea') {
  return {
    mode,
    marks: {
      bootStart: 0,
      firstFrame: 42,
      terrainReady: 820,
      buoyReady: 940,
      fullyReady: 980,
    },
    firstFrameMs: 42,
    fullyReadyMs: 980,
    terrainReadyMs: 820,
    buoyReadyMs: 940,
  };
}
