/**
 * Sounding homepage stage entry.
 * Phased rebuild: see docs/spectral-stage-plan.md
 */
import { bootOceanStage } from './stage/ocean-boot.js';

const mount = document.getElementById('stage');
if (!mount) {
  console.error('[sounding] #stage missing');
} else {
  bootOceanStage(mount).catch((error) => {
    console.error('[sounding] ocean stage failed', error);
    mount.innerHTML =
      '<p class="fallback">WebGL ocean failed to start. Check console.</p>';
  });
}
