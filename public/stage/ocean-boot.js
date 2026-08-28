/**
 * Stage boot — full Mavericks stage by default; ?focus=land for terrain-only QA.
 */
import { bootLandAsset } from './land-asset-boot.js';
import { resolveBootMode } from './boot-mode.js';

export { resolveBootMode } from './boot-mode.js';

/**
 * @param {HTMLElement} mount
 * @returns {Promise<{ dispose: () => void }>}
 */
export async function bootOceanStage(mount) {
  const params = new URLSearchParams(window.location.search);
  const focus = params.get('focus');
  if (focus === 'land') {
    return bootLandAsset(mount, params);
  }
  const mod = await import('./ocean-boot-sea.js');
  return mod.bootSeaStage(mount, params);
}
