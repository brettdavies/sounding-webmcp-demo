/**
 * Overlay copy for sea/land stage — wave tag + authored view stay in sync.
 */

/**
 * @param {{ active: number, kind: string, label?: string }} setWave
 */
export function waveTagFor(setWave) {
  if (setWave.active <= 0.08) return 'swell';
  if (setWave.kind === 'tween') return 'between';
  return setWave.label || 'face';
}

/**
 * @param {{
 *   setWave: {
 *     active: number,
 *     face_m: number,
 *     kind: string,
 *     label?: string,
 *     breakStyle?: string,
 *     periodS: number,
 *     directionDeg: number,
 *   },
 *   viewName: string,
 *   eta?: number,
 *   reading?: { as_of_local?: string, as_of?: string },
 * }} state
 */
export function overlayReadout({ setWave, viewName, eta = 0, reading = {} }) {
  const view = viewName || 'fallaway';
  const faceM =
    setWave.active > 0.08
      ? setWave.face_m.toFixed(1)
      : Math.abs(eta).toFixed(1);
  const tag = waveTagFor(setWave);
  const styleTag =
    setWave.active > 0.08 && setWave.kind === 'set'
      ? ` · ${setWave.breakStyle}`
      : '';
  const wave = `${tag}${styleTag} ${faceM} m · ${setWave.periodS} s · ${setWave.directionDeg}° · ${view}`;

  let heat;
  if (setWave.active > 0.2 && setWave.kind === 'set') {
    heat = `heat · ${setWave.label} · ${setWave.breakStyle} · ${view}`;
  } else if (setWave.active > 0.2 && setWave.kind === 'tween') {
    heat = `heat · between · ${view}`;
  } else {
    heat = `${reading.as_of_local ?? reading.as_of ?? 'Mavericks heat — compressed'} · ${view}`;
  }

  return { wave, heat, view, tag };
}

/**
 * @param {{ waveEl?: HTMLElement | null, asOfEl?: HTMLElement | null }} elements
 * @param {Parameters<typeof overlayReadout>[0]} state
 */
export function applyOverlayReadout(elements, state) {
  const readout = overlayReadout(state);
  if (elements.waveEl) elements.waveEl.textContent = readout.wave;
  if (elements.asOfEl) elements.asOfEl.textContent = readout.heat;
  return readout;
}

/** @param {string} viewName */
export function landOverlayReadout(viewName) {
  const view = viewName || 'fallaway';
  return {
    wave: `land · ${view}`,
    heat: `USGS DS684 DEM · Pillar Point / Mavericks · ${view}`,
    view,
    tag: 'land',
  };
}
