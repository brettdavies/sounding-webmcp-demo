/**
 * Placeholder boot budget gate — Node-safe (no Three.js).
 */

/** Max sync placeholder path after renderer (ms). */
export const PLACEHOLDER_SYNC_BUDGET_MS = 100;

/** @deprecated use PLACEHOLDER_SYNC_BUDGET_MS — kept for docs grep */
export const PLACEHOLDER_FIRST_FRAME_BUDGET_MS = PLACEHOLDER_SYNC_BUDGET_MS;

/**
 * @param {ReturnType<ReturnType<typeof import('./boot-budget.js').createBootBudget>['snapshot']>} budget
 */
export function verifyPlaceholderBoot(budget) {
  const marks = budget.marks ?? {};
  const firstFrameMs = budget.firstFrameMs ?? marks.firstFrame ?? null;
  const rendererReadyMs = marks.rendererReady ?? 0;
  const placeholderSyncMs =
    firstFrameMs != null ? Number((firstFrameMs - rendererReadyMs).toFixed(1)) : null;
  const ok =
    marks.placeholderReady != null &&
    placeholderSyncMs != null &&
    placeholderSyncMs < PLACEHOLDER_SYNC_BUDGET_MS;
  return {
    ok,
    firstFrameMs,
    placeholderReadyMs: marks.placeholderReady ?? null,
    rendererReadyMs,
    placeholderSyncMs,
    budgetMs: PLACEHOLDER_SYNC_BUDGET_MS,
  };
}

/** Synthetic budget for Node verify scripts. */
export function samplePlaceholderBudget() {
  return {
    mode: 'sea',
    marks: {
      bootStart: 0,
      rendererReady: 18,
      firstFrame: 42,
      placeholderReady: 42,
    },
    firstFrameMs: 42,
    fullyReadyMs: null,
  };
}
