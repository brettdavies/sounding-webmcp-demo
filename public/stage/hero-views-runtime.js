/**
 * Hero-view runtime audit for default boot (fallaway, reef, spectators).
 * Node-safe — browser calls auditHeroViews() via setView on __soundingBoot.
 */

export const HERO_VIEWS = Object.freeze(['fallaway', 'reef', 'spectators']);

/**
 * @param {string} view
 * @param {{
 *   view?: string,
 *   overlay?: { view?: string, wave?: string, heat?: string },
 *   cliffQa?: { ok?: boolean },
 *   viewVerify?: { ok?: boolean },
 *   foamQa?: { ok?: boolean },
 *   bootVerify?: { ok?: boolean },
 *   ready?: boolean,
 *   placeholder?: { ok?: boolean, placeholderSyncMs?: number },
 * }} boot
 */
export function verifyHeroViewSnapshot(view, boot) {
  const overlay = boot.overlay ?? {};
  const wave = overlay.wave ?? '';
  const heat = overlay.heat ?? '';
  const suffix = ` · ${view}`;
  return {
    view,
    ok:
      boot.ready === true &&
      boot.bootVerify?.ok === true &&
      boot.foamQa?.ok === true &&
      boot.viewVerify?.ok === true &&
      boot.cliffQa?.ok === true &&
      boot.view === view &&
      overlay.view === view &&
      wave.endsWith(suffix) &&
      heat.endsWith(suffix) &&
      (boot.placeholder?.ok !== false),
    bootView: boot.view,
    overlayView: overlay.view,
    waveEndsWithView: wave.endsWith(suffix),
    heatEndsWithView: heat.endsWith(suffix),
    placeholderSyncMs: boot.placeholder?.placeholderSyncMs ?? null,
  };
}

/**
 * @param {Record<string, ReturnType<typeof verifyHeroViewSnapshot>>} byView
 */
export function verifyHeroViewsAudit(byView) {
  const views = HERO_VIEWS.map((view) => {
    const snap = byView[view] ?? { view, ok: false };
    return snap;
  });
  const ok = views.every((v) => v.ok);
  return { ok, views, heroViews: HERO_VIEWS };
}

/**
 * Browser-side audit — call with boot.setView bound.
 * @param {(name: string) => void} setView
 * @param {() => Record<string, unknown>} getBoot
 */
export function auditHeroViews(setView, getBoot) {
  /** @type {Record<string, ReturnType<typeof verifyHeroViewSnapshot>>} */
  const byView = {};
  for (const view of HERO_VIEWS) {
    setView(view);
    byView[view] = verifyHeroViewSnapshot(view, /** @type {Parameters<typeof verifyHeroViewSnapshot>[1]} */ (getBoot()));
  }
  return verifyHeroViewsAudit(byView);
}

/** Synthetic browser audit for Node verify scripts. */
export function sampleHeroViewsAudit() {
  /** @type {Record<string, ReturnType<typeof verifyHeroViewSnapshot>>} */
  const byView = {};
  for (const view of HERO_VIEWS) {
    byView[view] = {
      view,
      ok: true,
      bootView: view,
      overlayView: view,
      waveEndsWithView: true,
      heatEndsWithView: true,
      placeholderSyncMs: 3.7,
    };
  }
  return verifyHeroViewsAudit(byView);
}
