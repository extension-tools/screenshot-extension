# Release Cleanup Iteration 3 S7 Pre-Implementation Spec

## Recommendation

Use an S7 pre-implementation spec only.

The release-cleanup architecture decision already exists in `release-cleanup-s7.md`. Iteration 3 should not introduce a new ADR. It should harden the remaining serialization and artifact boundaries so production capture stays lightweight while internal QA keeps verbose diagnostics.

## Context

Iteration 1 introduced the production diagnostics whitelist and `diagnosticsMode`.

Iteration 2 made internal QA runners request `diagnosticsMode: "qa"` explicitly.

Iteration 3 must verify and close any remaining path where verbose diagnostics, QA reports, or debug/research artifacts can be written during a normal production capture.

## Problem

Diagnostics are now shaped at the main storage serialization boundary, but the codebase still has multiple report and artifact paths:

- extension storage diagnostics;
- fixture runner reports;
- real-site runner reports;
- offline QA reports;
- visual regression reports;
- generated QA artifacts.

The risk is not screenshot behavior. The risk is that a production capture path could still persist verbose diagnostic data or QA-only artifacts by bypassing the existing diagnostics serializer.

## Decision

Iteration 3 will audit and harden diagnostics and artifact write boundaries.

Production mode must only persist the production diagnostics whitelist.

QA mode may keep verbose diagnostics and QA reports.

This iteration must not change capture behavior, page probing, scrolling, fixed/sticky handling, overlay handling, stitching, tiling, splitting, or export output.

Golden baseline PNG files, saved HTML dumps, generated screenshots, and broad research artifacts are not part of the production release-cleanup commit unless they are explicitly approved in a separate QA artifact change.

## Root Cause

The beta stabilization work added diagnostics in several places. The release-cleanup work already added a canonical mode flag and production serializer, but the codebase still needs one narrow pass to ensure all relevant write boundaries use the same mode contract.

## Allowed Touch Points

| File | Allowed change | Why this file owns the change |
| --- | --- | --- |
| `code/capture/CaptureStore.js` | Only if the grep audit proves that this file writes diagnostics or QA artifacts directly. Route through existing diagnostics shaping or skip QA artifacts in production. Do not modify screenshot download, filename, file saving, or download lifecycle behavior. | Storage is the only runtime write boundary that may need hardening, but it must not be edited speculatively. |
| `code/capture/CaptureDiagnostics.js` | Only small helper extraction or reuse if the existing serializer cannot be called cleanly. | This file already owns diagnostics mode normalization and production-vs-QA shaping. |
| `code/capture/CaptureController.js` | Only if an existing storage call needs `diagnosticsMode` passed explicitly. | This file already owns capture-level diagnostics mode plumbing. |
| `project/tests/validate-extension.mjs` | Add static and runtime validation for iteration 3 boundaries. | This file already owns release cleanup validation. |
| `project/tests/qa-runbook.md` | Document that QA artifacts require QA diagnostics mode. | This is the QA operator source of truth. |
| `project/docs/release-cleanup-review-log.md` | Update after reviews and checks are complete. | This records orchestration evidence. |

Do not assume `CaptureStore.js` is the only storage owner. The audit must cover runtime files under `code/**` for extension storage writes before deciding whether any runtime file needs an edit.

## Forbidden Touch Points

Do not change:

- `manifest.json`;
- `code/capture/PageProbe.js`;
- `code/capture/CaptureStepper.js`;
- `code/capture/CanvasStitcher.js`;
- `code/capture/CanvasTiler.js`;
- `code/capture/CanvasSizeGuard.js`;
- `code/capture/PositionPlanner.js`;
- `code/capture/SplitBoundaryPlanner.js`;
- `code/content/FixedStickyNormalizer.js`;
- `code/capture/QuirksLayer.js`;
- `code/worker.js`;
- product UI files;
- PDF export behavior;
- scroll target selection;
- fixed/sticky normalization;
- overlay or modal policy;
- split/stitch behavior.

If any forbidden touch point appears necessary, stop and ask for a separate spec.

`PageProbe.js` and `CaptureStepper.js` remain phase 2 performance-budget owners only. They must not receive "small" iteration 3 edits, even for diagnostics construction, without a separate measured performance spec.

## Existing Overlapping Logic To Reuse

Reuse:

- `CaptureDiagnostics.normalizeDiagnosticsMode()`;
- `CaptureDiagnostics.serializeForStorage()`;
- `CaptureDiagnostics.toProductionDiagnostics()`;
- existing `diagnosticsMode: "qa"` plumbing in internal runners;
- existing production diagnostics whitelist validation in `validate-extension.mjs`.

The production whitelist source of truth is `CaptureDiagnostics.toProductionDiagnostics()` together with the whitelist section in `release-cleanup-s7.md`. Do not duplicate the whitelist in a second runtime owner.

Do not create:

- a second diagnostics mode normalizer;
- a second production whitelist;
- a new diagnostics feature flag;
- a new artifact writer;
- a new report format.

## Exact Proposed Logic

### 1. Audit runtime storage boundary

Find any runtime write path that can persist diagnostics.

Audit all runtime files under `code/**`, not only `CaptureStore.js`.

Do not edit `CaptureStore.js` unless this audit proves that it writes diagnostics or QA artifacts directly.

If `CaptureStore.js` is edited, the change must be limited to proven diagnostics artifact writes. Do not modify screenshot/download saving methods.

Allowed production write:

```text
storedDiagnostics = CaptureDiagnostics.serializeForStorage({
  mode: diagnosticsMode,
  strategy,
  diagnostics,
  captureDiagnostics
})

chrome.storage.local.set({lastCaptureDiagnostics: storedDiagnostics})
```

Forbidden production write:

```text
chrome.storage.local.set({lastCaptureDiagnostics: rawVerboseDiagnostics})
chrome.storage.local.set({debugDiagnostics: rawVerboseDiagnostics})
chrome.storage.local.set({qaReport: report})
```

If a runtime write path is QA-only:

```text
if diagnosticsMode is not "qa":
  skip QA-only write
```

### 2. Audit runner/report boundaries

Internal test runners may write verbose reports only because they explicitly pass QA mode.

`report.md` checks in this iteration refer to QA runner reports only. They must not be treated as a reason to rewrite production extension storage or user-facing screenshot export.

`writeFile` findings under `project/tests/**` are documentation-only unless the audit proves that the same path is invoked by normal extension capture.

QA artifacts must remain local-only under project test outputs. QA mode must not add network upload, telemetry, extension package inclusion, user-facing export, cookies, storage scraping, form-value collection, DOM text collection, selectors, or exact operating-system version collection.

Required invariant:

```text
capture-flow runner:
  diagnosticsMode must be "qa"

real-site runner:
  diagnosticsMode must be "qa"

production/default capture:
  diagnosticsMode must be "production"
```

Do not remove internal QA reports.

Do not make QA reports available from normal user capture.

### 3. Add release validation

Add validation checks, not capture changes:

```text
assert production serialization excludes:
  diagnostics
  capturePlan
  avoidRanges
  frames
  selectors
  candidates
  geometry ranges
  QA reports
  research fields

assert QA serialization preserves verbose diagnostics

assert internal runners request diagnosticsMode: "qa"

assert no production extension diagnostics path writes raw verbose diagnostics without CaptureDiagnostics.serializeForStorage()

assert code/manifest.json has no diff in this iteration
```

### 4. Keep phase 2 out of this iteration

Do not gate diagnostics object construction in `PageProbe.js` or `CaptureStepper.js`.

That is a separate phase 2 optimization and requires measurement that proves a specific diagnostics builder is expensive.

## Diagnostics Plan

No new runtime diagnostics fields.

No new browser permissions.

No telemetry.

No network upload.

No cookies, storage scraping, form values, DOM text, selectors, or exact operating-system version.

Control flag:

| Flag | Default | Production behavior | QA behavior |
| --- | --- | --- | --- |
| `diagnosticsMode` | `"production"` | Serialize only production whitelist and skip QA-only artifacts. | Keep verbose diagnostics and internal QA reports. |

Legacy alias:

| Alias | Behavior |
| --- | --- |
| `qaDiagnostics: true` | Maps to `diagnosticsMode: "qa"` only through the existing normalizer. |

If `diagnosticsMode` is missing, invalid, or unknown, treat it as `"production"`.

## Tests

Required non-browser checks:

1. `validate-extension.mjs` verifies production diagnostics do not include verbose fields.
2. `validate-extension.mjs` verifies QA diagnostics still include verbose fields.
3. `validate-extension.mjs` verifies fixture and real-site runners pass `diagnosticsMode: "qa"`.
4. `validate-extension.mjs` verifies production extension diagnostics are written through `CaptureDiagnostics.serializeForStorage()`.
5. `validate-extension.mjs` verifies `report.md` checks apply only to QA runner reports, not to production extension storage.
6. `validate-extension.mjs` verifies `code/manifest.json` has no diff in this iteration.
7. Syntax checks for any changed JavaScript files.
8. `git diff --check`.

Browser checks:

None required for this iteration unless a runtime storage boundary change is made in a way that cannot be validated without extension execution.

If browser validation becomes necessary, stop and ask before running it.

## Expected Diff Budget

Target:

- `CaptureStore.js`: 0-30 lines, only if needed.
- `CaptureDiagnostics.js`: 0-20 lines, only if needed.
- `CaptureController.js`: 0-15 lines, only if needed.
- `validate-extension.mjs`: 20-80 lines.
- `qa-runbook.md`: 5-20 lines.
- `release-cleanup-review-log.md`: update after reviews only.

Hard stop:

- more than 160 runtime changed lines for this iteration;
- any change to forbidden touch points;
- any new module;
- any new feature flag;
- any behavior change in capture output.

If validation-only changes in `validate-extension.mjs` exceed the target range, keep runtime changes inside the budget and record the test-only overage in the review log. If validation-only changes exceed 250 changed lines, stop and create a separate validation cleanup task instead of continuing to grow the file. Do not use validation growth as permission to expand runtime scope.

## Scope Constraints

This iteration is only about diagnostics and artifact write boundaries.

It must not:

- speed-optimize page probing;
- change capture planning;
- change image readiness;
- change retries;
- change scroll behavior;
- change fixed/sticky behavior;
- change split boundary behavior;
- change PDF export;
- remove QA tooling;
- delete useful local QA reports.

## Stop Conditions

Stop and ask if:

- a production write path cannot be gated without touching forbidden files;
- a new feature flag seems necessary;
- a new serializer or report writer seems necessary;
- diagnostics construction optimization is requested before measurement;
- browser permissions or `manifest.json` would need to change;
- production diagnostics would need fields outside the whitelist;
- the patch would change screenshot output, file count, file dimensions, or capture timing behavior.

## Rollback

Rollback is simple:

1. Revert the iteration 3 patch.
2. Keep iteration 1 and 2 intact.
3. Production diagnostics will still be shaped at the main serializer.
4. Internal QA mode will still work.

## Recommended Developer Next Step

Start with a read-only grep audit:

```text
Search for:
  chrome.storage.local.set
  lastCaptureDiagnostics
  diagnostics
  qaReport
  debug
  research
  report.md
  writeFile
  writeFileSync
  appendFile
  createWriteStream
  mkdir
  copyFile
```

Also inspect file-copy usage in test scripts or shell wrappers, but do not run a literal broad grep for the short token `cp`; it is too noisy and should be reviewed only in file-operation context.

Treat file writer findings in `project/tests/**` as QA-only evidence unless the audit proves they are invoked by normal extension capture.

Then change only the smallest owner file needed to ensure production writes use the existing diagnostics mode contract.
