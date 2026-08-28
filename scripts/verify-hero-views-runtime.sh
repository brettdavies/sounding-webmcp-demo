#!/usr/bin/env bash
# Verify hero views (fallaway, reef, spectators) runtime audit contract.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'auditHeroViews|heroViewsAudit' public/stage/ocean-boot-sea.js
rg -q '"fallaway"' docs/qa-manifest.json
rg -q '"reef"' docs/qa-manifest.json
rg -q '"spectators"' docs/qa-manifest.json
rg -q 'heroViewsAudit' docs/qa-manifest.json

node --input-type=module -e "
import {
  verifyHeroViewSnapshot,
  verifyHeroViewsAudit,
  sampleHeroViewsAudit,
  HERO_VIEWS,
} from './public/stage/hero-views-runtime.js';

const sample = sampleHeroViewsAudit();
const opener = verifyHeroViewSnapshot('fallaway', {
  ready: true,
  view: 'fallaway',
  bootVerify: { ok: true },
  foamQa: { ok: true },
  viewVerify: { ok: true },
  cliffQa: { ok: true },
  placeholder: { ok: true, placeholderSyncMs: 3.7 },
  overlay: {
    view: 'fallaway',
    wave: 'opener · spill 12.5 m · 18 s · 285° · fallaway',
    heat: 'heat · opener · spill · fallaway',
  },
});

const bad = verifyHeroViewSnapshot('reef', {
  ready: true,
  view: 'reef',
  bootVerify: { ok: true },
  foamQa: { ok: true },
  viewVerify: { ok: true },
  cliffQa: { ok: true },
  overlay: { view: 'fallaway', wave: 'swell 1.0 m · 18 s · 285° · fallaway', heat: 'heat · reef' },
});

const report = { sample, opener, badOk: bad.ok === false, heroViews: HERO_VIEWS };
console.log('hero-views-runtime:', JSON.stringify(report, null, 2));
if (!sample.ok || !opener.ok || bad.ok) process.exit(1);
console.log('OK: hero views runtime audit', HERO_VIEWS.join(', '));
"
