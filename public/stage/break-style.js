/**
 * Per-wave break style (spill / plunge / tube) from deterministic seed.
 * Product: ~15% tube on bombs (face ≥ 16.5 m); plunge on steep set faces.
 */

/** @typedef {'spill' | 'plunge' | 'tube'} BreakStyle */

export const BREAK_STYLES = Object.freeze(['spill', 'plunge', 'tube']);

/** Default QA seed — docs/stage-runtime-contract.md */
export const STAGE_BREAK_SEED = 46012;

/** @type {Record<BreakStyle, number>} */
export const BREAK_STYLE_INDEX = Object.freeze({
  spill: 0,
  plunge: 1,
  tube: 2,
});

/**
 * @param {number} a
 * @param {number} b
 * @param {number} c
 */
export function hash01(a, b, c) {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * @param {{ kind: string, face_m: number, label: string }} event
 * @param {number} eventIndex
 * @param {number} [seed]
 * @returns {BreakStyle}
 */
export function assignBreakStyle(event, eventIndex, seed = STAGE_BREAK_SEED) {
  if (event.kind === 'lull' || event.kind === 'tween') {
    return 'spill';
  }
  const h = hash01(seed, eventIndex + 1, Math.round(event.face_m * 100));
  const isBomb = event.face_m >= 16.5;
  if (isBomb && h < 0.15) {
    return 'tube';
  }
  if (event.face_m >= 14.5 || h > 0.55) {
    return 'plunge';
  }
  return 'spill';
}

/**
 * Shader + displacement tuning per break style.
 * @param {BreakStyle} style
 */
export function breakStyleParams(style) {
  switch (style) {
    case 'tube':
      return {
        steepMul: 1.18,
        widthMul: 0.76,
        lipSkew: 0.52,
        tubeMix: 0.24,
        horizMul: 1.28,
      };
    case 'plunge':
      return {
        steepMul: 1.1,
        widthMul: 0.9,
        lipSkew: 0.38,
        tubeMix: 0,
        horizMul: 1.22,
      };
    default:
      return {
        steepMul: 0.76,
        widthMul: 1.12,
        lipSkew: 0.08,
        tubeMix: 0,
        horizMul: 0.92,
      };
  }
}

/**
 * @param {Array<{ kind: string, face_m: number, label: string, breakStyle?: BreakStyle }>} events
 * @param {number} [seed]
 */
export function verifyBreakStyleDistribution(events, seed = STAGE_BREAK_SEED) {
  /** @type {Record<BreakStyle, number>} */
  const counts = { spill: 0, plunge: 0, tube: 0 };
  const setEvents = events.filter((e) => e.kind === 'set');
  const bombs = setEvents.filter((e) => e.face_m >= 16.5);
  let tubeOnBombs = 0;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const style = e.breakStyle ?? assignBreakStyle(e, i, seed);
    counts[style]++;
    if (style === 'tube' && e.kind === 'set' && e.face_m >= 16.5) {
      tubeOnBombs++;
    }
  }

  const tubeRate = bombs.length ? tubeOnBombs / bombs.length : 0;
  const hasVariety = counts.plunge > 0 && counts.spill > 0;
  const tubeOk = bombs.length === 0 || (tubeOnBombs >= 1 && tubeRate <= 0.35);

  return {
    ok: hasVariety && tubeOk && counts.tube >= 1,
    counts,
    setCount: setEvents.length,
    bombCount: bombs.length,
    tubeOnBombs,
    tubeRate: Number(tubeRate.toFixed(3)),
    seed,
  };
}

/**
 * @param {BreakStyle} style
 */
export function breakStyleLabel(style) {
  return style;
}
