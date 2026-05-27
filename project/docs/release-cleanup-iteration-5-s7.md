# Release Cleanup Iteration 5 S7 Pre-Implementation Spec

## Recommendation

Use an S7 pre-implementation spec only.

The architectural decision already exists in the broader release-cleanup documentation. Iteration 5 is a narrow follow-up to the read-only audit after iteration 4.

## Context

Iteration 4 gated QA-only image readiness, sticky, and repeated chrome summary packaging at the `CaptureController` level.

The follow-up read-only audit found one named QA-only packaging block that can be safely removed from the normal user path:

```text
CaptureStepper.analyzeRepeatedChrome(frames)
```

This method is called after frames are already captured. It summarizes repeated chrome diagnostics for QA reports and review workflows. It is not used to decide scroll targets, frame positions, fixed/sticky normalization, overlay policy, split/stitch behavior, export strategy, or save behavior.

## Problem

Production diagnostics storage already uses a whitelist, so repeated chrome details are not stored in production output. However, `CaptureStepper.run()` still constructs the repeated chrome summary before storage filtering:

```text
repeatedChrome: this.analyzeRepeatedChrome(frames)
```

That means normal user captures can still pay a small CPU and memory cost for QA-only packaging that will be discarded later.

## Decision

Gate only repeated chrome summary construction inside `CaptureStepper`.

Production mode:

```text
repeatedChrome: null
```

QA mode:

```text
repeatedChrome: this.analyzeRepeatedChrome(frames)
```

Do not change frame collection, frame timing, capture order, scroll behavior, readiness behavior, fixed/sticky behavior, overlay behavior, split/stitch behavior, tiling, export, or storage whitelist behavior.

## Root Cause

The beta diagnostics path added `analyzeRepeatedChrome(frames)` as a QA/report summary after frame capture. Release cleanup already controls what gets stored, but this particular summary is still constructed unconditionally.

## Allowed Touch Points

| File | Allowed change | Why this file owns the change |
| --- | --- | --- |
| `code/capture/CaptureController.js` | Pass the existing `includeQaDiagnostics` boolean into `new CaptureStepper(...)`. | It already owns normalized diagnostics mode and derives `includeQaDiagnostics`. |
| `code/capture/CaptureStepper.js` | Accept `includeQaDiagnostics = false` in the constructor and use it only to guard `analyzeRepeatedChrome(frames)`. | It owns frame capture results and currently constructs the repeated chrome summary. |
| `project/tests/validate-extension.mjs` | Add static release guards proving repeated chrome summary construction is QA-gated and no duplicate diagnostics-mode interpreter was added. | It owns release validation. |
| `project/docs/release-cleanup-review-log.md` | Record review loop, checks, and final status. | It owns release-cleanup review evidence. |

## Forbidden Touch Points

Do not change:

- `manifest.json`;
- browser permissions;
- `code/capture/PageProbe.js`;
- `code/content/FixedStickyNormalizer.js`;
- `code/capture/ContentAgentClient.js`;
- `code/capture/CanvasStitcher.js`;
- `code/capture/CanvasTiler.js`;
- `code/capture/CanvasSizeGuard.js`;
- `code/capture/PositionPlanner.js`;
- `code/capture/SplitBoundaryPlanner.js`;
- `code/capture/QuirksLayer.js`;
- scroll target selection;
- fixed/sticky normalization behavior;
- overlay/modal policy;
- split/stitch/tiling behavior;
- PDF/export behavior;
- save/download behavior;
- product UI.

If any forbidden touch point appears necessary, stop and request a separate spec.

## Existing Overlapping Logic To Reuse

Reuse:

- `CaptureDiagnostics.normalizeDiagnosticsMode()`;
- `CaptureController`'s existing `includeQaDiagnostics` boolean;
- existing `CaptureStepper.analyzeRepeatedChrome(frames)`;
- existing QA runner `diagnosticsMode: "qa"` plumbing;
- existing release validation in `validate-extension.mjs`.

Do not create:

- a new diagnostics-mode normalizer;
- a new feature flag;
- a new diagnostics helper;
- a new repeated chrome analyzer;
- a new serializer;
- a new report writer;
- any helper that independently reads `qaDiagnostics`;
- any helper that independently normalizes `diagnosticsMode`.

## Exact Proposed Logic

### 1. Pass the existing QA boolean into `CaptureStepper`

In `CaptureController`, locate the `new CaptureStepper(...)` call.

Add only:

```text
includeQaDiagnostics
```

to the constructor options object.

Do not pass raw `prefs`.

Do not pass `diagnosticsMode` unless a future spec needs more than a boolean.

### 2. Store the boolean in `CaptureStepper`

In `CaptureStepper.constructor(...)`, add:

```text
includeQaDiagnostics = false
```

Then store:

```text
this.includeQaDiagnostics = includeQaDiagnostics === true
```

This must be a boolean guard only.

### 3. Gate repeated chrome summary construction

In `CaptureStepper.run(...)`, replace the unconditional summary construction:

```text
repeatedChrome: this.analyzeRepeatedChrome(frames)
```

with:

```text
repeatedChrome: this.includeQaDiagnostics
  ? this.analyzeRepeatedChrome(frames)
  : null
```

Do not change:

```text
frames
timing
summarizeTiming(...)
captureVisibleTabMs
readiness
beforeFrame calls
```

### 4. Keep QA output unchanged

When `diagnosticsMode: "qa"` is used by QA runners, `repeatedChrome` must still be built exactly as before.

No repeated chrome field names should be renamed in QA mode.

### 5. Keep production behavior unchanged

Production capture must still:

```text
measure page
warm up lazy content
build capture plan
capture all frames
stitch or tile output
save output
serialize production diagnostics whitelist
```

Only the repeated chrome QA summary packaging is skipped.

## Pseudocode

```text
// CaptureController
diagnosticsMode = captureDiagnostics.normalizeDiagnosticsMode(prefs)
includeQaDiagnostics = diagnosticsMode === "qa"

stepper = new CaptureStepper({
  chrome,
  pageProbe,
  contentAgent,
  viewportCapture,
  stitcher,
  prefs,
  capturePolicy,
  includeQaDiagnostics
})
```

```text
// CaptureStepper
constructor(options):
  this.includeQaDiagnostics = options.includeQaDiagnostics === true

run(...):
  frames = captureFrames(...)

  return {
    frames,
    repeatedChrome: this.includeQaDiagnostics
      ? analyzeRepeatedChrome(frames)
      : null,
    timing: summarizeTiming(frames, totalMs)
  }
```

## Diagnostics Plan

No new diagnostics fields.

No production diagnostics schema change.

No QA diagnostics schema change.

Control flag:

| Flag | Default | Production behavior | QA behavior |
| --- | --- | --- | --- |
| `diagnosticsMode` | `"production"` | `CaptureStepper` returns `repeatedChrome: null`. | `CaptureStepper` builds repeated chrome summary as before. |

Legacy alias:

| Alias | Behavior |
| --- | --- |
| `qaDiagnostics: true` | Still maps to QA mode only through `CaptureDiagnostics.normalizeDiagnosticsMode()`. |

When the flag is off:

- no repeated chrome summary is constructed in `CaptureStepper`;
- production serialization remains the same whitelist;
- screenshot behavior is unchanged.

## Tests

Required non-browser checks:

1. `pnpm run check`.
2. `node --check code/capture/CaptureController.js`.
3. `node --check code/capture/CaptureStepper.js`.
4. `node --check project/tests/validate-extension.mjs`.
5. `git diff --check`.
6. `node project/tests/targeted-risk-sites.mjs`.

Static validation must prove:

```text
CaptureController passes includeQaDiagnostics into CaptureStepper.
CaptureStepper constructor accepts includeQaDiagnostics = false.
CaptureStepper stores this.includeQaDiagnostics as a boolean.
CaptureStepper calls analyzeRepeatedChrome(frames) only behind this.includeQaDiagnostics.
No helper independently reads qaDiagnostics.
No helper independently normalizes diagnosticsMode.
manifest.json unchanged.
No forbidden files changed.
```

No browser run is required because screenshot behavior must not change.

If any test shows capture output or status differs between production and QA mode, stop.

## Expected Diff Budget

Target budget:

- `CaptureController.js`: 1-5 lines.
- `CaptureStepper.js`: 5-15 lines.
- `validate-extension.mjs`: 10-40 lines.
- `release-cleanup-review-log.md`: 10-30 lines.

Hard stop:

- runtime diff exceeds 40 changed lines;
- any forbidden runtime file changes;
- a new feature flag is added;
- a new helper is added;
- `analyzeRepeatedChrome(...)` is modified internally;
- `summarizeTiming(...)` is changed;
- screenshot output changes;
- browser permissions change;
- `manifest.json` changes.

## Scope Constraints

This iteration is only about repeated chrome QA summary packaging.

It must not:

- optimize all frame diagnostics;
- gate `collectChromeDiagnostics(...)`;
- change `ContentAgentClient` aggregation;
- change `FixedStickyNormalizer`;
- change `PageProbe`;
- remove QA diagnostics from QA mode;
- change production whitelist fields;
- change capture behavior.

## Stop Conditions

Stop and ask if:

- `repeatedChrome` is found to affect capture behavior;
- QA mode cannot keep the same repeated chrome summary;
- a forbidden file appears necessary;
- a new helper appears necessary;
- tests require a browser run;
- production and QA capture behavior differ.

## Rollback

Rollback is simple:

1. Revert the iteration 5 patch.
2. Iterations 1-4 remain valid.
3. Production diagnostics still serialize through the whitelist.
4. QA runners still explicitly request QA mode.

## Recommended Developer Next Step

Make the minimal patch:

```text
CaptureController -> pass includeQaDiagnostics into CaptureStepper.
CaptureStepper -> guard analyzeRepeatedChrome(frames).
validate-extension -> add static guard.
review log -> record review and checks.
```

Do not touch any other runtime behavior.
