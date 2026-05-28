# Release Cleanup Iteration 7 S7 Pre-Implementation Spec

## Recommendation

Use an S7 pre-implementation spec only.

The broader release-cleanup architecture decision already exists in `project/docs/release-cleanup-s7.md`. Iteration 7 is the final performance and diagnostics-tail cleanup before the separate icon/manifest cleanup. It must not change screenshot capture behavior.

## Context

Previous release-cleanup iterations already introduced and hardened:

- canonical `diagnosticsMode`;
- production diagnostics whitelist;
- QA-mode verbose diagnostics;
- storage shaping for production diagnostics;
- QA-only image readiness, sticky, and repeated chrome summary gates;
- repository package hygiene and release-audit checks.

The remaining release-cleanup question is whether normal user captures still construct heavy QA-only diagnostics that will later be discarded by production serialization.

## Problem

Production diagnostics storage is already shaped through a whitelist, but some detailed diagnostics objects may still be constructed before the final storage boundary.

That can keep the product correct, but it may waste CPU and memory during normal user capture.

The target is not a new capture behavior. The target is to avoid building or attaching QA-only diagnostic details when `diagnosticsMode` is `"production"`.

## Decision

Add a narrow performance cleanup for QA-only diagnostics construction.

Production mode must:

- keep all runtime data needed to produce the screenshot;
- keep the current production diagnostics whitelist;
- avoid constructing detailed QA-only summaries where a known QA-only boundary already exists;
- avoid attaching detailed QA-only diagnostics to stored capture results.

QA mode must:

- keep current verbose diagnostics behavior for fixtures and real-site QA;
- keep existing field names where tests depend on them;
- keep local-only QA artifacts.

No capture behavior may change.

## Root Cause

The beta cycle added diagnostics to explain hard capture bugs. Later iterations shaped what is stored in production, but shaping at the storage boundary does not automatically remove every cost of constructing QA-only objects earlier in the pipeline.

Iteration 7 closes only the clearly owned diagnostics-construction tail. It does not rewrite the capture pipeline.

## Allowed Touch Points

| File | Allowed change | Why this file owns the change |
| --- | --- | --- |
| `code/capture/CaptureController.js` | Pass the existing `includeQaDiagnostics` boolean only to owners that already accept or clearly need it for QA-only packaging. Do not change capture decisions. | It already normalizes diagnostics mode and owns orchestration. |
| `code/capture/CaptureDiagnostics.js` | Add small helpers only if needed to keep production/QA shaping centralized. | It owns diagnostics shaping and serialization. |
| `code/capture/CaptureStepper.js` | Gate construction of QA-only frame summaries only if they are not used for capture behavior and are already post-capture diagnostics. | It owns frame result diagnostics. |
| `project/tests/validate-extension.mjs` | Add static release guards proving production mode does not attach QA-only diagnostics and QA mode still does. | It owns release validation. |
| `project/tests/capture-flow.mjs` | Add fixture assertions only if existing fixtures can check production-vs-QA diagnostics without changing browser behavior. | It owns controlled capture-flow checks. |
| `project/docs/release-cleanup-review-log.md` | Record review loop, checks, and final status. | It owns release-cleanup review evidence. |

## Forbidden Touch Points

Do not change:

- `code/manifest.json`;
- browser permissions;
- `code/data/icons/*`;
- `code/capture/CanvasStitcher.js`;
- `code/capture/CanvasTiler.js`;
- `code/capture/CanvasSizeGuard.js`;
- `code/capture/PositionPlanner.js`;
- `code/capture/SplitBoundaryPlanner.js`;
- `code/capture/PageProbe.js`;
- `code/content/FixedStickyNormalizer.js`;
- `code/capture/QuirksLayer.js`;
- `code/capture/LazyLoadWarmer.js`;
- scroll target selection;
- fixed/sticky normalization behavior;
- overlay/modal policy;
- split/stitch/tiling behavior;
- PDF/export behavior;
- save/download behavior;
- product UI;
- user-facing timing, waits, retries, or capture order.

If any forbidden touch point appears necessary, stop and request a separate spec.

## Existing Overlapping Logic To Reuse

Reuse:

- `CaptureDiagnostics.normalizeDiagnosticsMode()`;
- `CaptureController`'s existing `includeQaDiagnostics` boolean;
- `CaptureDiagnostics.serializeForStorage()`;
- `CaptureDiagnostics.toProductionDiagnostics()`;
- existing QA runner `diagnosticsMode: "qa"` plumbing;
- existing validation assertions in `project/tests/validate-extension.mjs`;
- existing `capture:risk` and `capture:test` checks if a browser run is explicitly allowed later.

Do not create:

- a new diagnostics mode;
- a new feature flag;
- a second diagnostics normalizer;
- a second serializer;
- a new performance profiler;
- a new capture pipeline path;
- a new browser permission;
- telemetry, upload, sync, or remote logging.

## Runtime Data vs QA-Only Diagnostics

This iteration must preserve runtime data that affects capture output.

Always keep in runtime memory:

- page measurements used by capture;
- `capturePlan`;
- `capturePlan.avoidRanges`;
- scroll target data used by capture;
- capture policy used by capture;
- fixed/sticky/overlay decisions used by capture;
- split/stitch/tiling decisions used by output;
- image readiness checks used to wait before capture;
- output dimensions and file count.

May be gated in production only when not used by capture behavior:

- summarized QA-only repeated chrome diagnostics;
- QA-only image readiness summaries attached only for reports;
- QA-only sticky normalization summaries attached only for reports;
- large candidate lists that are only serialized for debugging;
- diagnostic-only elapsed timing details that are not part of the production whitelist.

Do not remove a computation merely because it appears under a `diagnostics` object. First prove whether it is runtime input or report-only output.

If the developer cannot prove that a computation is report-only, leave it unchanged in this iteration.

Before gating construction, prove that the object is report-only:

- search all reads of the object or field with `rg`;
- confirm that reads are limited to QA diagnostics, diagnostics serialization, tests, or reports;
- if the object is read by capture policy, readiness, split/stitch/tiling, scroll target selection, fixed/sticky handling, output planning, or save/download behavior, leave it unchanged.

## Exact Proposed Logic

### 1. Keep `diagnosticsMode` normalization unchanged

Use the existing rule:

```text
if options.diagnosticsMode === "qa":
  diagnosticsMode = "qa"
else if options.qaDiagnostics === true:
  diagnosticsMode = "qa"
else:
  diagnosticsMode = "production"
```

Then derive:

```text
includeQaDiagnostics = diagnosticsMode === "qa"
```

Do not pass raw `diagnosticsMode` into helpers that only need a boolean.

### 2. Do not alter production whitelist

Production diagnostics remain:

```text
captureId
status
failureReason
errorMessage
startedAt
completedAt
durationMs
platformOs
url
title
viewport
outputStrategy
outputFileCount
outputDimensions
```

Do not add fields in iteration 7.

### 3. Gate QA-only attachment, not capture behavior

Keep the three boundaries separate:

- construction: building the diagnostic object;
- attachment: adding the diagnostic object to an in-memory result object;
- serialization: writing the diagnostic object to stored diagnostics.

When `includeQaDiagnostics` is `false`:

```text
do not attach imageReadinessSummary
do not attach stickyNormalizationSummary
do not attach repeatedChromeSummary
do not attach frame-level repeated chrome summaries
do not include verbose candidate lists in stored diagnostics
do not construct a QA-only object only after proving it is report-only
```

When `includeQaDiagnostics` is `true`:

```text
keep current QA diagnostics behavior
keep field names unchanged
keep QA reports unchanged
```

### 4. Only gate proven QA-only construction

Allowed safe pattern:

```text
if includeQaDiagnostics:
  buildQaOnlySummary()
else:
  summary = null
```

Forbidden pattern:

```text
if not includeQaDiagnostics:
  skip page measurement
  skip warmup
  skip readiness checks
  skip geometry pass used by split/stitch
  skip capturePlan creation
  skip scroll target detection
```

### 5. PageProbe is out of scope

Do not edit `PageProbe.js` in iteration 7.

If an expensive report-only object is found in `PageProbe.js`, stop and request a separate iteration or spec. Do not include that optimization in this patch.

### 6. Keep local-only privacy and permissions guarantees

This iteration must not:

- add browser permissions;
- change `manifest.json`;
- add network requests;
- upload diagnostics;
- write telemetry;
- read cookies;
- scrape browser storage;
- collect form values;
- collect selectors, DOM text, or full ancestor chains in production mode.

## Pseudocode

```text
// CaptureController
diagnosticsMode = CaptureDiagnostics.normalizeDiagnosticsMode(prefs)
includeQaDiagnostics = diagnosticsMode === "qa"

// Pass includeQaDiagnostics only to existing QA diagnostics owners.
```

```text
// QA-only summary attachment
if includeQaDiagnostics:
  CaptureDiagnostics.attachImageReadinessSummary(diagnosticsV2, legacyDiagnostics)
else:
  do not attach QA-only summaries
```

```text
// CaptureStepper or other post-capture diagnostics owner
return {
  frames,
  repeatedChrome: includeQaDiagnostics
    ? analyzeRepeatedChrome(frames)
    : null
}
```

```text
// Proven report-only construction
if includeQaDiagnostics:
  buildAndAttachQaOnlySummary()
else:
  do not build or attach the QA-only summary
```

## Diagnostics Plan

No new runtime diagnostics.

No new production diagnostics fields.

No new feature flags.

QA-only diagnostics remain controlled by:

```text
diagnosticsMode === "qa"
```

When diagnostics mode is `"production"`:

- production diagnostics must stay within the whitelist;
- QA-only summaries must be `null`, absent, or not constructed;
- screenshot output must remain unchanged.

When diagnostics mode is `"qa"`:

- existing QA diagnostics must remain available for tests and internal QA.

## Tests

Non-browser checks:

```text
node --check code/capture/CaptureController.js
node --check code/capture/CaptureDiagnostics.js
node --check code/capture/CaptureStepper.js
node --check project/tests/validate-extension.mjs
git diff --check
```

Validation checks in `project/tests/validate-extension.mjs`:

- production diagnostics whitelist remains exact;
- `diagnosticsMode: "production"` does not store QA-only summaries;
- `diagnosticsMode: "qa"` still stores QA-only summaries;
- no duplicate diagnostics-mode interpreter is added;
- `qaDiagnostics` remains a legacy alias only;
- no production whitelist field is added without explicit validation update.

If browser is allowed later:

```text
run the existing capture fixture command
run the existing targeted risk command
```

Browser is not required by default because this iteration must not change capture behavior.

## Expected Diff Budget

Target budget:

- `code/capture/CaptureController.js`: 0-20 lines;
- `code/capture/CaptureDiagnostics.js`: 0-30 lines;
- `code/capture/CaptureStepper.js`: 0-30 lines;
- `code/capture/PageProbe.js`: 0 lines;
- `project/tests/validate-extension.mjs`: 20-80 lines;
- `project/docs/release-cleanup-review-log.md`: review transcript only.

Stop and re-review if:

- more than three runtime files need edits;
- total non-log diff exceeds 150 lines;
- any `PageProbe.js` change appears;
- any forbidden touch point changes.

## Scope Constraints

This iteration is only about reducing QA-only diagnostics construction and attachment in production mode.

It must not:

- improve screenshot quality;
- change capture timing;
- change capture waits;
- change capture retries;
- change scroll/fixed/sticky/split/export behavior;
- introduce a new diagnostics system;
- add a package builder;
- touch icon/manifest cleanup;
- claim final release readiness.

The separate icon/manifest cleanup remains at the end of release preparation.

## Stop Conditions

Stop and ask for confirmation if:

- a screenshot changes;
- a wait/retry changes;
- a capture policy changes;
- `manifest.json` must be edited;
- browser permissions would change;
- PageProbe needs broad restructuring;
- a new feature flag appears necessary;
- a new diagnostics schema appears necessary;
- production diagnostics need a new field;
- browser tests become necessary to validate behavior.

## Rollback

Rollback is simple:

1. Revert iteration 7 code changes.
2. Revert iteration 7 validation assertions.
3. Revert review-log additions.

No user-facing screenshot behavior should require rollback because this iteration must not change capture behavior.

## Recommended Developer Next Step

1. Inspect current QA-only diagnostics construction sites.
2. Identify only proven report-only construction that still runs in production.
3. Patch the smallest owner.
4. Add validation assertions.
5. Run non-browser checks.
6. Request Architect and ScopeGuard diff review before commit.
