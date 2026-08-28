/**
 * Verify /api/reading heat JSON drives set-wave schedule + overlay contract.
 * Node-safe — no THREE dependency.
 */

/**
 * @param {Record<string, unknown>} reading
 */
export function verifyReadingShape(reading) {
  const gap = reading.wave_gap_sec ?? [5, 7];
  const gapOk =
    Array.isArray(gap) &&
    gap.length === 2 &&
    gap[0] >= 5 &&
    gap[1] <= 7 &&
    gap[0] <= gap[1];
  const withinSetGap = gapOk ? (gap[0] + gap[1]) * 0.5 : 0;
  const withinSetOk = withinSetGap >= 5 && withinSetGap <= 7;

  const sets = reading.sets ?? [];
  const labels = sets.map((s) => s.label);
  const setsOk =
    sets.length >= 3 &&
    labels.includes('opener') &&
    labels.includes('main') &&
    labels.some((l) => l === 'lull');

  const swellDeg =
    reading.swell?.direction_deg ?? reading.wave?.direction_deg ?? null;
  const periodS =
    reading.swell?.period_s ?? reading.wave?.period_s ?? null;
  const swellOk = swellDeg === 285;
  const periodOk = periodS === 18;

  const metersOk =
    typeof reading.meters === 'number' && reading.meters > 0;
  const history =
    reading.history ??
    (setsOk
      ? sets.flatMap((s) => s.faces_m).map((face) => ({ face_m: face }))
      : []);
  const historyOk = Array.isArray(history) && history.length > 0;

  return {
    ok:
      gapOk &&
      withinSetOk &&
      setsOk &&
      swellOk &&
      periodOk &&
      metersOk &&
      historyOk,
    gap,
    withinSetGap,
    setLabels: labels,
    swellDeg,
    periodS,
  };
}

/**
 * Confirm overlay + meters display contract wired in ocean boot.
 * @param {string} [bootSource]
 */
export function verifyReadingBootWiring(bootSource) {
  const src = bootSource ?? '';
  const fetchOk = src.includes('/api/reading');
  const scheduleOk = src.includes('buildSetWaveSchedule(');
  const overlayOk = src.includes('overlayReadout(');
  const metersOk =
    src.includes('metersEl') && src.includes('eta') && src.includes('setWave.active');
  return {
    ok: fetchOk && scheduleOk && overlayOk && metersOk,
    fetchOk,
    scheduleOk,
    overlayOk,
    metersOk,
  };
}

/**
 * @param {Record<string, unknown>} reading
 */
export function verifyReadingAlignment(reading) {
  const shape = verifyReadingShape(reading);
  return {
    ok: shape.ok,
    shape,
    note: 'Static /api/reading JSON drives set-wave schedule; overlay face uses live buoy η at runtime.',
  };
}
