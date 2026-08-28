/**
 * Map definition-of-done checklist items to programmatic verify gates.
 * Visual / hardware-dependent items stay pending until capture or browser QA.
 */

/** @typedef {'programmatic' | 'visual' | 'hardware' | 'manual'} GateKind */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   kind: GateKind,
 *   scripts: string[],
 *   programmaticOk?: boolean,
 *   note?: string,
 * }} DodItem
 */

/** @type {DodItem[]} */
export const DEFINITION_OF_DONE_ITEMS = [
  {
    id: 'views-mhhw',
    label: 'fallaway, reef, spectators pass visual QA at MHHW on default boot',
    kind: 'visual',
    scripts: ['verify-mavericks-views', 'verify-default-boot', 'verify-hero-views-runtime'],
    note: 'MHHW camera + runtime audit verified; hero captures pending',
  },
  {
    id: 'cliffs-steep',
    label: 'Cliffs read near-vertical in hero views',
    kind: 'programmatic',
    scripts: ['verify-cliff-qa'],
  },
  {
    id: 'set-wave',
    label: 'Set wave every 5–7 s; curved crest; occasional tube on bombs',
    kind: 'programmatic',
    scripts: ['verify-curved-crest', 'verify-break-style'],
  },
  {
    id: 'buoy-tracks',
    label: 'Buoy tracks wave surface; never airborne',
    kind: 'programmatic',
    scripts: ['verify-buoy-dynamics'],
  },
  {
    id: 'whitewash',
    label: 'Shore whitewash pulses; reef foam cycles with sets',
    kind: 'programmatic',
    scripts: ['verify-foam-qa', 'verify-shore-whitewash', 'verify-reef-whitewash'],
  },
  {
    id: 'fps-120',
    label: '≥120 fps after quality settle',
    kind: 'hardware',
    scripts: ['verify-perf-gate', 'verify-fps-settle'],
    note: 'Adaptive tier + DPR; fpsSettleAudit on __soundingBoot',
  },
  {
    id: 'boot-timing',
    label: '<100 ms first frame; full stage ≤2 s',
    kind: 'programmatic',
    scripts: ['verify-boot-budget', 'verify-placeholder-boot'],
    note: 'Shape gate + sync placeholder budget; browser marks on __soundingBoot',
  },
  {
    id: 'quality-ramp',
    label: 'Progressive ramp by 2 s without pop-in',
    kind: 'programmatic',
    scripts: ['verify-quality-ramp'],
  },
  {
    id: 'reading-api',
    label: '/api/reading reflects buoy-sampled stats',
    kind: 'programmatic',
    scripts: ['verify-reading-alignment'],
    note: 'Heat JSON drives schedule; meters/overlay use live buoy η',
  },
  {
    id: 'qa-manifest',
    label: 'QA manifest with epoch-prefixed shots',
    kind: 'visual',
    scripts: ['verify-qa-manifest', 'verify-capture-qa-manifest'],
    note: 'Manifest + capture plan verified; epoch shots pending policy',
  },
  {
    id: 'ground-truth',
    label: 'All stage locks traceable to cited ground truth',
    kind: 'programmatic',
    scripts: ['verify-ground-truth-locks'],
  },
  {
    id: 'pr-ready',
    label: 'PR-ready branch',
    kind: 'manual',
    scripts: [],
    note: 'Branch feat/kinetic-buoy-homepage; open PR when visual QA complete',
  },
];

/**
 * @param {Record<string, boolean>} scriptResults
 */
export function summarizeDefinitionOfDone(scriptResults) {
  /** @type {Array<DodItem & { status: 'pass' | 'partial' | 'pending' }>} */
  const items = DEFINITION_OF_DONE_ITEMS.map((item) => {
    const scriptOk =
      item.scripts.length === 0
        ? null
        : item.scripts.every((s) => scriptResults[s] === true);

    let status = /** @type {'pass' | 'partial' | 'pending'} */ ('pending');
    if (item.kind === 'programmatic' && scriptOk === true) {
      status = 'pass';
    } else if (item.kind === 'visual' && scriptOk === true) {
      status = 'partial';
    } else if (item.kind === 'hardware' && scriptOk === true) {
      status = 'partial';
    } else if (item.kind === 'manual') {
      status = 'pending';
    } else if (scriptOk === false) {
      status = 'pending';
    }

    return { ...item, status };
  });

  const programmaticPass = items.filter(
    (i) => i.kind === 'programmatic' && i.status === 'pass',
  ).length;
  const programmaticTotal = items.filter((i) => i.kind === 'programmatic').length;

  return {
    items,
    programmaticPass,
    programmaticTotal,
    allProgrammaticOk: programmaticPass === programmaticTotal,
  };
}
