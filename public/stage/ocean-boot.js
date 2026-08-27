/**
 * Stage boot — Mavericks land asset by default; ?focus=sea for ocean+buoy.
 */
import { bootLandAsset } from './land-asset-boot.js';

/**
 * @param {HTMLElement} mount
 * @returns {Promise<{ dispose: () => void }>}
 */
export async function bootOceanStage(mount) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('focus') === 'sea') {
    const mod = await import('./ocean-boot-sea.js');
    return mod.bootSeaStage(mount, params);
  }
  return bootLandAsset(mount, params);
}
