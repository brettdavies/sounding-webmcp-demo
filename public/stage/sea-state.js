/**
 * Client sea-state for the spectral cascade.
 * Mavericks: long-period Pacific swell — organized, not North-Atlantic chop.
 * Giant faces are the hybrid heat overlay; cascade is a quiet in-between sea.
 */

/** @typedef {{
 *   directionDegrees: number,
 *   fetchMeters: number,
 *   windSpeed: number,
 *   scale: number,
 *   peakEnhancement: number,
 *   swell: number,
 *   directionality: number,
 *   shortWaveFade: number,
 * }} SpectrumLobe */

export const MAVERICKS_SEA = {
  seed: 46012,
  resolution: 128,
  patchLengths: [1100, 320, 110],
  boundaryFactor: 2,
  gravity: 9.81,
  /** Outer ramp depth proxy (m) — reef crest is shallower; FFT uses one depth. */
  depth: 30,
  choppiness: 0.28,
  foamRecovery: 0.45,
  /** Near-flat FFT — organized swell/faces are Gerstner (hybrid). */
  amplitude: 0.08,
  local: {
    directionDegrees: 285,
    fetchMeters: 1.5e4,
    windSpeed: 4,
    scale: 0.03,
    peakEnhancement: 1.5,
    swell: 0.01,
    directionality: 0.4,
    shortWaveFade: 0.25,
  },
  swell: {
    directionDegrees: 282,
    fetchMeters: 1.5e6,
    windSpeed: 10,
    scale: 0.2,
    peakEnhancement: 7.5,
    swell: 1.0,
    directionality: 0.98,
    shortWaveFade: 0.2,
  },
};

export const SUN_DIRECTION = Object.freeze({
  x: 0.38,
  y: 0.62,
  z: 0.32,
});

/**
 * Still-water plane in DEM local meters (NAVD88).
 * Harbor datum lock: MLLW≈0.01, MSL≈0.92, MHHW≈1.72 (NOAA 9414131).
 * Stage seats at MHHW so Gerstner troughs don’t drain the cliff-toe shelf;
 * true MSL left a wide dry band at the west face.
 */
export const MSL_Y = 1.72;

/**
 * Break focus from `meta.json` break_line (Pillar Point diagram + DEM −5…−6 m).
 * Faces crest through here; buoy moors on the reef peak.
 */
export const BREAK_PEAK = Object.freeze({ x: -440, z: -20 });
export const BREAK_ROCKS = Object.freeze({ x: -338, z: 197 });

/**
 * Default sea camera: fallaway offshore, looking at the break peak.
 * Override with ?view=spectators|reef|shore|… (MAVERICKS_VIEWS).
 */
export const DESIGN_CAMERA = Object.freeze({
  position: { x: -900, y: 80, z: 200 },
  lookAt: { x: -440, y: 5, z: -20 },
  fov: 44,
  near: 0.5,
  far: 8000,
});

export const OCEAN_SIZE = 2400;
export const OCEAN_SEGMENTS = 360;

/** Mooring on the locked break peak (local XZ). */
export const BUOY_XZ = Object.freeze({
  x: BREAK_PEAK.x,
  z: BREAK_PEAK.z,
});
