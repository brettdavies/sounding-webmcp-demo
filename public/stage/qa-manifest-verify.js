/**
 * QA manifest validation — Node-safe (no Three.js).
 */

/**
 * @param {Record<string, unknown>} manifest
 */
export function verifyQaManifest(manifest) {
  const heroViews = /** @type {string[]} */ (manifest.heroViews ?? []);
  const captureViews = /** @type {string[]} */ (manifest.captureViews ?? []);
  const bootUrl = String(manifest.bootUrl ?? '');
  const seed = Number(manifest.seed);
  const stressSeed = Number(manifest.stressSeed);
  const loopTimes = /** @type {Record<string, number>} */ (manifest.loopTimes ?? {});
  const lowEnd = /** @type {Record<string, unknown>} */ (manifest.lowEndTier ?? {});
  const invariants = /** @type {Record<string, unknown>} */ (manifest.invariants ?? {});

  const ok =
    manifest.version === 1 &&
    manifest.defaultBoot === true &&
    !bootUrl.includes('focus=sea') &&
    !bootUrl.includes('focus=land') &&
    heroViews.includes('fallaway') &&
    heroViews.includes('reef') &&
    heroViews.includes('spectators') &&
    captureViews.length >= 4 &&
    seed === 46012 &&
    Number.isFinite(stressSeed) &&
    stressSeed !== seed &&
    loopTimes.opener === 4 &&
    loopTimes.tubeBomb === 73 &&
    invariants.bootMode === 'sea' &&
    invariants.terrainStride === 1 &&
    lowEnd.perfTier === 3;

  return {
    ok,
    defaultBoot: manifest.defaultBoot === true,
    heroViews,
    captureViews,
    seed,
    stressSeed,
    bootUrl,
    lowEndTier: lowEnd,
  };
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {{ view: string, seed?: number, loop_t?: number }} params
 */
export function buildQaUrl(manifest, params) {
  const seed = params.seed ?? Number(manifest.seed);
  const view = params.view;
  let url = `/?view=${encodeURIComponent(view)}&seed=${seed}`;
  if (params.loop_t != null) {
    url += `&loop_t=${params.loop_t}`;
  }
  return url;
}

/** @param {Record<string, unknown>} manifest */
export function sampleQaManifestUrls(manifest) {
  return {
    fallaway: buildQaUrl(manifest, { view: 'fallaway', loop_t: 4 }),
    reef: buildQaUrl(manifest, { view: 'reef', loop_t: 4 }),
    spectators: buildQaUrl(manifest, { view: 'spectators', loop_t: 4 }),
    stress: buildQaUrl(manifest, {
      view: 'reef',
      seed: Number(manifest.stressSeed),
      loop_t: 73,
    }),
    lowEnd: String(manifest.lowEndTier?.url ?? ''),
  };
}
