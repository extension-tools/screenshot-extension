# Release Cleanup Iteration 4 S7 Pre-Implementation Spec

## Recommendation

Use an S7 pre-implementation spec only.

The release-cleanup architecture decision already exists in `release-cleanup-s7.md`. Iteration 4 must reduce unnecessary diagnostics construction in production diagnostics mode without changing capture output or adding new diagnostics policy.

Production mode in this document means diagnostics serialization mode, not a separate release build target.

## Context

Iteration 1 introduced the production diagnostics whitelist and canonical `diagnosticsMode`.

Iteration 2 made internal QA runners request `diagnosticsMode: "qa"` explicitly.

Iteration 3 hardened diagnostics storage and QA artifact boundaries.

Iteration 4 should reduce production overhead by avoiding construction of QA-only verbose diagnostics when the capture is running in production mode.

## Problem

Production diagnostics are already serialized through a small whitelist, but some verbose QA-only diagnostic objects may still be built before serialization. This is not a privacy issue after iteration 3, but it can add unnecessary CPU and memory work during normal user capture.

The risk is over-narrowing runtime data. Some data structures are not "diagnostics only"; they are required by the capture engine to choose scroll targets, fixed/sticky normalization, split boundaries, export dimensions, or error handling.

## Decision

Keep runtime capture computations unchanged.

Gate only QA-only verbose diagnostics packaging.

Do not add a second diagnostics-mode helper or a second mode interpretation path. Normalize once through `CaptureDiagnostics.normalizeDiagnosticsMode()` and pass the already-normalized mode, or a derived `includeQaDiagnostics` boolean, downward.

## Root Cause

The beta cycle added detailed diagnostics near probing, stepper, and runner flows. Release cleanup has already limited what production stores, but not every QA-only detail needs to be constructed in production mode.

## Allowed Touch Points

| File | Allowed change | Why this file owns the change |
| --- | --- | --- |
| `code/capture/CaptureController.js` | Pass the already-normalized `diagnosticsMode` or `includeQaDiagnostics` to lower-level capture components if needed. | It owns capture-level options and already normalizes diagnostics mode. |
| `code/capture/CaptureDiagnostics.js` | Reuse the existing normalizer only. Do not add a second mode interpreter. | It is the single owner of diagnostics-mode normalization and storage shaping. |
| `code/capture/PageProbe.js` | Default budget is 0 changed lines. Gate QA-only verbose diagnostic packaging only if read-only audit identifies a named QA-only packaging block. Do not change detection, thresholds, risk flags, geometry passes, scroll target signals, or capture policy inputs. | It may construct verbose probe diagnostics. |
| `code/capture/CaptureStepper.js` | Default budget is 0 changed lines. Gate QA-only verbose frame diagnostics only if read-only audit identifies a named QA-only packaging block. Do not change frame planning, waits, capture order, readiness checks, or screenshot output. | It may construct verbose per-frame diagnostics. |
| `project/tests/validate-extension.mjs` | Add release guards that prevent duplicate mode helpers and verify production-vs-QA diagnostics behavior. | It owns release validation. |
| `project/tests/capture-flow.mjs` | Add a minimal production-vs-QA diagnostics equality check only if needed. | It owns fixture-level capture validation. |
| `project/docs/release-cleanup-review-log.md` | Record orchestration evidence and final checks. | It records release-cleanup review history. |

## Forbidden Touch Points

Do not change:

- `manifest.json`;
- browser permissions;
- `code/capture/CanvasStitcher.js`;
- `code/capture/CanvasTiler.js`;
- `code/capture/CanvasSizeGuard.js`;
- `code/capture/PositionPlanner.js`;
- `code/capture/SplitBoundaryPlanner.js`;
- `code/content/FixedStickyNormalizer.js`;
- `code/capture/QuirksLayer.js`;
- scroll target selection;
- fixed/sticky normalization;
- overlay/modal policy;
- split/stitch behavior;
- PDF export behavior;
- product UI.

If any forbidden touch point appears necessary, stop and request a separate spec.

## Existing Overlapping Logic To Reuse

Reuse:

- `CaptureDiagnostics.normalizeDiagnosticsMode()`;
- `CaptureDiagnostics.serializeForStorage()`;
- `CaptureDiagnostics.toProductionDiagnostics()`;
- existing QA runner `diagnosticsMode: "qa"` plumbing;
- existing release validation in `validate-extension.mjs`.

Do not create:

- a second diagnostics-mode normalizer;
- a second production whitelist;
- `PageProbe.isQaMode()`;
- `CaptureStepper.isProductionMode()`;
- any helper that independently reads `qaDiagnostics`;
- a new feature flag;
- a new diagnostics serializer;
- a new report writer.

## Exact Proposed Logic

### 1. Normalize once

The only allowed mode interpretation is:

```text
diagnosticsMode = CaptureDiagnostics.normalizeDiagnosticsMode(options)
includeQaDiagnostics = diagnosticsMode === "qa"
```

Downstream code may receive:

```text
diagnosticsMode
```

or:

```text
includeQaDiagnostics
```

Downstream code must not inspect `qaDiagnostics` or normalize the mode again.

Prefer passing `includeQaDiagnostics` when downstream code only needs a boolean. Pass `diagnosticsMode` only when the downstream code already stores or forwards the normalized mode as metadata.

### 2. Keep runtime-required data always on

Always compute data used by capture behavior:

```text
capturePlan
capturePlan.avoidRanges
split boundaries used by output
scroll target used by capture
capture policy
overlay/blocking decisions used by capture
fixed/sticky normalization decisions used by capture
output dimensions
output file count
status and failure reason
```

### 3. Gate only QA-only packaging

Production mode may skip only verbose diagnostic packaging, for example:

```text
if includeQaDiagnostics:
  diagnostics.verboseProbeDetails = buildVerboseProbeDetails()
  diagnostics.verboseFrameDetails = buildVerboseFrameDetails()
else:
  do not add verboseProbeDetails
  do not add verboseFrameDetails
```

Production mode must not skip:

```text
measure page
probe page
choose scroll target
build capture plan
normalize fixed/sticky
capture frames
stitch or tile output
save output
```

### 4. Prefer no-op if the diagnostic object is already cheap

If a diagnostic field is already derived from an existing runtime object with no extra scan, no extra layout reads, and no extra loop, do not add branching just to remove it.

Only gate construction that is clearly QA-only and non-trivial.

## Diagnostics Plan

No new production diagnostics fields.

No new QA diagnostics schema is required.

Do not rename existing QA diagnostics fields in this iteration.

Timing fields used by the production whitelist, including total duration, remain allowed and must not be gated out.

Control flag:

| Flag | Default | Production behavior | QA behavior |
| --- | --- | --- | --- |
| `diagnosticsMode` | `"production"` | Skip QA-only verbose diagnostics packaging and serialize the production whitelist only. | Build verbose diagnostics and QA reports. |

Legacy alias:

| Alias | Behavior |
| --- | --- |
| `qaDiagnostics: true` | Maps to QA mode only through `CaptureDiagnostics.normalizeDiagnosticsMode()`. |

## Tests

Required non-browser checks:

1. `pnpm run check`.
2. `node project/tests/targeted-risk-sites.mjs`.
3. `git diff --check`.
4. JavaScript syntax checks for changed JavaScript files if `pnpm run check` does not cover them.

Validation requirements:

```text
production mode:
  does not include QA-only verbose probe/frame diagnostics
  still includes the production whitelist

qa mode:
  still includes verbose diagnostics

behavior equality:
  production and qa mode have the same status
  same output strategy
  same output dimensions
  same output file count
  do not compare verbose diagnostics across modes
```

Static guards:

```text
no new helper independently reads qaDiagnostics
no new helper independently normalizes diagnosticsMode
no forbidden files changed
manifest.json unchanged
no new permissions
```

No browser run is required unless a runtime behavior change appears unexpectedly during implementation or tests.

## Expected Diff Budget

Target budget:

- `CaptureController.js`: 0-25 lines;
- `CaptureDiagnostics.js`: 0-15 lines;
- `PageProbe.js`: 0 lines by default; up to 80 lines only if audit identifies a named QA-only diagnostics packaging block;
- `CaptureStepper.js`: 0 lines by default; up to 60 lines only if audit identifies a named QA-only diagnostics packaging block;
- `validate-extension.mjs`: 30-120 lines;
- documentation/review log: 10-40 lines.

Hard stop:

- runtime diff exceeds 180 changed lines;
- a new feature flag is added;
- a new mode helper duplicates `normalizeDiagnosticsMode()`;
- a forbidden file changes;
- screenshot output changes;
- scroll, fixed/sticky, overlay, split/stitch, or PDF behavior changes.

## Scope Constraints

This iteration is only release cleanup for diagnostics construction overhead.

Review-log edits are documentation-only and cannot justify runtime scope expansion.

It must not:

- optimize all of `PageProbe`;
- redesign diagnostics;
- change capture behavior;
- remove QA tooling;
- delete reports;
- change release package contents;
- implement Chrome Web Store package build;
- run a 100-site browser gate by default.

## Stop Conditions

Stop and ask if:

- QA-only diagnostics cannot be separated from runtime-required data locally;
- a forbidden file appears necessary;
- a new helper or feature flag appears necessary;
- a reviewer asks for behavior changes;
- tests show production and QA capture behavior differ;
- browser validation becomes necessary.

## Rollback

Rollback is simple:

1. Revert the iteration 4 patch.
2. Iterations 1-3 remain valid.
3. Production diagnostics will still serialize through the production whitelist.
4. QA runners will still explicitly request QA mode.

## Recommended Developer Next Step

Start with a read-only audit:

```text
Find verbose diagnostics construction in:
  PageProbe.js
  CaptureStepper.js
  CaptureController.js

Classify each candidate as:
  runtime-required
  cheap production field
  QA-only verbose packaging
```

Patch only the `QA-only verbose packaging` class.
