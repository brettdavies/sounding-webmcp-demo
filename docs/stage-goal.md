# Sounding stage — autonomous goal contract

**Status:** Locked product contract. Implementation tracking: [`stage-backlog.md`](stage-backlog.md). Harness rules
(auto-applied): `.cursor/rules/stage-*.mdc`.

**Code baseline:** `d0f7805` (land default; full sea via `?focus=sea`). Target behavior gaps are backlog items, not
silent drift.

**Terminology:** [`stage-glossary.md`](stage-glossary.md)

---

## North star

Build the **best possible real-time Mavericks / Pillar Point demo**: USGS-grounded land, harbor-datum ocean, **set
waves** on a reef break during a compressed **heat**, moored buoy, and readable UI — at **120 fps**, **<100 ms first
frame**, **full stage ≤2 s**, **no shoreline leaks or melted cliffs**. Compressed heat **archetype** (not a dated
contest day); API is secondary to the viewport.

**Reality > performance** — [`stage-runtime-contract.md`](stage-runtime-contract.md#reality--performance).

---

## Progressive discovery

Read only what the current slice needs:

| When                           | Document                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Session start                  | `.context/handoffs/*-mavericks-stage.md` if present                                  |
| What to build next             | [`stage-backlog.md`](stage-backlog.md)                                               |
| Pins, datums, sources          | [`stage-ground-truth.md`](stage-ground-truth.md) · `public/land/mavericks/meta.json` |
| Boot, URL, perf, evidence gate | [`stage-runtime-contract.md`](stage-runtime-contract.md)                             |
| Break shape, work domains      | [`stage-product-spec.md`](stage-product-spec.md)                                     |
| FFT / set-wave mechanism       | [`spectral-stage-plan.md`](spectral-stage-plan.md)                                   |
| Vocabulary                     | [`stage-glossary.md`](stage-glossary.md)                                             |

**Commits, captures, micro-slices:** `.cursor/rules/stage-slices.mdc` · `.cursor/commit-template-stage.md`

---

## Document map (single source per topic)

| Topic                               | SoT                                                            |
| ----------------------------------- | -------------------------------------------------------------- |
| Phased work + definition of done    | [`stage-backlog.md`](stage-backlog.md)                         |
| Geospatial locks + provenance       | [`stage-ground-truth.md`](stage-ground-truth.md) · `meta.json` |
| Boot, URL, perf, evidence gate      | [`stage-runtime-contract.md`](stage-runtime-contract.md)       |
| Product morphology + module map     | [`stage-product-spec.md`](stage-product-spec.md)               |
| Ocean mechanism                     | [`spectral-stage-plan.md`](spectral-stage-plan.md)             |
| Terminology                         | [`stage-glossary.md`](stage-glossary.md)                       |
| Agent harness (commits, QA, skills) | `.cursor/rules/stage-*.mdc`                                    |

**Assets:** `public/land/ASSETS.md`

---

## Product principles (not duplicated elsewhere)

1. **Ground truth wins** — reconcile authoritative data before shaders
   ([`stage-ground-truth.md`](stage-ground-truth.md)).
2. **Glossary terms** in docs and UI copy.
3. **No regressions** — fix or revert before advancing phases.
4. **Async GLBs** never block — stand-ins per `ASSETS.md`; append missing assets to backlog.
5. **Stop only** for product forks, source conflicts, secrets, broken infra, explicit halt (see
   `.cursor/rules/stage-workflow.mdc`).

**Current priority:** P0 in [`stage-backlog.md`](stage-backlog.md).

---

## External references

- [Poly Haven](https://polyhaven.com) · [Sketchfab](https://sketchfab.com)
- `.cursor/skills/threejs-skill-router/SKILL.md`
