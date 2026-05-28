# Release Cleanup S7 Pre-Implementation Spec

## Recommendation

Use an S7 implementation spec only. This work prepares the extension for release by gating heavy diagnostics and QA artifacts. It must not change capture behavior.

## Goal

Prepare the extension for release by:

- keeping the normal user capture path lightweight;
- moving heavy diagnostics behind a QA-only diagnostics mode;
- avoiding serialized detailed diagnostics when they are not needed;
- preventing QA-only analysis from running during normal user capture;
- excluding temporary beta/research artifacts from the release package;
- preserving current capture behavior.

## Non-Goals

Do not change:

- `manifest.json`;
- browser permissions;
- screenshot output;
- scroll target selection;
- fixed/sticky behavior;
- overlay/modal behavior;
- split/stitch behavior;
- saved file count;
- saved file dimensions;
- PDF export behavior;
- product UI.

## Feature Flags Inventory

| Flag | Status | Values | Default | Enabled by | Purpose | May change capture output? |
| --- | --- | --- | --- | --- | --- | --- |
| `diagnosticsMode` | Canonical | `"production"` / `"qa"` | `"production"` | Internal QA runner and tests only | Controls how much local diagnostics data is serialized or written as QA artifacts. | No |
| `qaDiagnostics` | Legacy alias | `true` / `false` | `false` | Older tests or older internal runners only | Backward-compatible alias. `true` maps to `diagnosticsMode: "qa"`. | No |

Rules:

- Do not add new feature flags in this release-cleanup task.
- `diagnosticsMode` is the only canonical diagnostics flag.
- `qaDiagnostics` must not become a second control path.
- If `diagnosticsMode` is missing or invalid, treat it as `"production"`.
- No diagnostics flag may change capture output, scroll target, fixed/sticky behavior, overlay/modal behavior, split/stitch behavior, saved files, or file dimensions.
- Any new flag requires a separate architecture review.

## Root Cause

The beta cycle added useful diagnostics, QA checks, and research artifacts while stabilizing capture behavior. Some of this data is useful for internal runs but too heavy or noisy for the release path.

The fix is not to remove runtime data used by the capture engine. The fix is to separate:

- runtime data required to produce the screenshot;
- serialized diagnostics and QA artifacts used only for debugging.

First iteration scope:

- This iteration shapes and gates serialized diagnostics and QA artifacts.
- This iteration is not required to speed up diagnostics object construction.
- Avoiding construction of expensive diagnostics objects is a phase 2 optimization and requires measurement that identifies a specific expensive diagnostics builder.

## Allowed Touch Points

| File | Allowed change |
| --- | --- |
| `code/capture/CaptureDiagnostics.js` | Owns diagnostics shaping and serialization. Add production whitelist and QA verbose shaping here. |
| `code/capture/CaptureController.js` | Normalize and pass `diagnosticsMode`. Do not change capture decisions. |
| `project/tests/real-site-runner.mjs` | Pass `diagnosticsMode: "qa"` for internal runs. |
| `project/tests/validate-extension.mjs` | Add production-vs-QA behavior equality checks and release package checks. |
| `project/docs/capture-risk-policy.md` | Reference this diagnostics policy. |
| `project/tests/qa-runbook.md` | Document how QA runs enable QA diagnostics. |

Conditional touch point only if diagnostics cannot be shaped before saving:

| File | Conditional change |
| --- | --- |
| `code/capture/CaptureStore.js` | Gate QA artifact writes or shape stored diagnostics only if QA artifacts or raw verbose diagnostics are actually written here. Do not change normal PNG/PDF screenshot saving. |

Phase 2 touch points only after measurement proves expensive diagnostics construction:

| File | Phase 2-only change |
| --- | --- |
| `code/capture/PageProbe.js` | Gate diagnostic packaging only if a measured diagnostics builder is expensive. Do not change detection thresholds, risk flags, geometry passes, scroll target signals, or capture policy inputs. |
| `code/capture/CaptureStepper.js` | Gate verbose frame diagnostics only if measured frame diagnostics construction is expensive. Do not change frame planning, waits, capture order, or readiness checks. |

## Forbidden Touch Points

Do not change:

- `manifest.json`;
- `code/capture/CanvasStitcher.js`;
- `code/capture/CanvasTiler.js`;
- `code/capture/CanvasSizeGuard.js`;
- `code/capture/PositionPlanner.js`;
- `code/capture/SplitBoundaryPlanner.js`;
- `code/content/FixedStickyNormalizer.js`;
- `code/capture/QuirksLayer.js`;
- scroll target selection logic;
- fixed/sticky normalization logic;
- overlay/modal policy;
- PDF export logic;
- user-facing product UI.

Stop if any of these files or behaviors appear necessary for this task.

Implementation note:

- Start with the actual diagnostics serialization boundary. Do not edit every allowed file by default.
- Prefer the smallest patch that proves `diagnosticsMode` normalization and production diagnostics shaping.
- First patch should normally touch only `CaptureDiagnostics.js`, `CaptureController.js`, and the smallest validation tests.
- Do not touch `CaptureStore.js` if production shaping can happen before diagnostics are saved.
- Touch `CaptureStore.js` only if QA artifacts are actually written there or raw verbose diagnostics are saved there and cannot be shaped earlier.
- Touch `PageProbe.js` or `CaptureStepper.js` only in phase 2 after a measurement shows specific expensive diagnostics construction in those files.

## Runtime Data vs Serialized Diagnostics

This task must not delete or weaken runtime data needed by the capture engine.

Always keep in runtime memory:

- `capturePlan`;
- `capturePlan.avoidRanges`;
- split boundaries used by output;
- scroll target used by capture;
- normalization decisions used by capture;
- overlay/blocking decisions used by capture;
- output dimensions;
- output file count.

Only serialized diagnostics and QA artifacts are reduced in production mode.

Do not skip runtime computations used by capture. This task may omit fields from serialized diagnostics or block QA artifact writes, but it must not stop detection, planning, measurement, normalization, or output computations that affect the screenshot result.

## Production Diagnostics Whitelist

When `diagnosticsMode` is `"production"`, serialized diagnostics may include only:

```js
{
  captureId,
  status,
  failureReason,
  errorMessage,
  startedAt,
  completedAt,
  durationMs,
  platformOs,
  url,
  title,
  viewport,
  outputStrategy,
  outputFileCount,
  outputDimensions
}
```

Rules:

- Do not add production diagnostics fields unless they are explicitly added to this whitelist.
- Do not run expensive computations only to populate whitelist fields. If a whitelist field is already available, include it. If it is not available cheaply, use `null` or omit the field according to the existing diagnostics shape.
- Do not serialize candidate lists, DOM ranges, frame-by-frame details, deep geometry output, or research fields in production mode.
- Do not serialize cookies, storage values, form values, DOM text, selectors, or full ancestor chains.
- `url` and `title` are local-only fields. They must not be uploaded, transmitted, or used for telemetry. Future sharing, telemetry, sync, or cloud export requires a separate privacy review.
- `platformOs` is allowed only as a coarse operating-system family: `"mac"`, `"win"`, `"linux"`, `"cros"`, `"android"`, `"openbsd"`, or `null`. Unknown values must be normalized to `null`. Do not collect exact operating-system version, device model, browser profile data, installed extensions, locale history, or user identifiers.
- `viewport` may include only viewport width, viewport height, and device pixel ratio. Do not include screen size, monitor information, browser window position, device model, or exact operating-system version.

## QA Diagnostics

When `diagnosticsMode` is `"qa"`, internal runs may include:

- geometry diagnostics;
- split boundary diagnostics;
- scroll target diagnostics;
- fixed/sticky diagnostics;
- overlay diagnostics;
- frame diagnostics;
- candidate summaries;
- QA reports;
- local debug artifacts.

QA mode must not:

- add retries;
- change waits;
- change scroll target selection;
- change capture policy;
- change split/stitch;
- change output files;
- upload data;
- read cookies;
- scrape browser storage;
- collect form values.

## Exact Proposed Logic

Normalize diagnostics mode once near capture start:

```text
inputDiagnosticsMode = captureOptions.diagnosticsMode
legacyQaDiagnostics = captureOptions.qaDiagnostics === true

if inputDiagnosticsMode is "qa":
  diagnosticsMode = "qa"
else if legacyQaDiagnostics:
  diagnosticsMode = "qa"
else:
  diagnosticsMode = "production"
```

Shape diagnostics at serialization boundaries:

```text
if diagnosticsMode is "production":
  return only production diagnostics whitelist

if diagnosticsMode is "qa":
  return existing verbose diagnostics
```

Gate artifact writes:

```text
if diagnosticsMode is not "qa":
  do not write QA reports
  do not write debug artifacts
  do not write research diagnostics
```

Release cleanup phases:

```text
phase 1:
  shape serialized diagnostics
  gate stored QA artifacts
  do not change diagnostic object construction unless it is already at the serialization boundary

phase 2:
  gate diagnostic object construction only after measurement proves that the construction itself is expensive
  require a concrete measured expensive diagnostics builder before editing PageProbe or CaptureStepper
  keep runtime computations required by capture unchanged
```

Collect coarse platform information without new permissions:

```text
platformOs = null

if chrome.runtime.getPlatformInfo is available:
  platformInfo = await chrome.runtime.getPlatformInfo()
  platformOs = platformInfo.os if it is in ["mac", "win", "linux", "cros", "android", "openbsd"]

if platformOs is unknown:
  platformOs = null

do not collect operating-system version
do not collect device model
do not request new permissions
```

## Privacy and Chrome Web Store Rules

Mandatory constraints:

- No new browser permissions.
- Do not change `manifest.json`.
- Diagnostics must remain local-only.
- Do not add telemetry.
- Do not upload screenshots to a remote server. Normal local screenshot save/download is allowed and must not change.
- Do not upload diagnostics to a remote server.
- Do not read cookies.
- Do not scrape `localStorage` or `sessionStorage`.
- Do not collect form values.
- Do not collect DOM text for analytics.
- Do not collect exact operating-system version or device model.
- Do not add remote hosted code.
- Do not add `eval`, `new Function`, or remote script loading.

Chrome Web Store readiness checks:

- The extension must keep a single clear purpose.
- Permissions must be minimal and justified.
- Privacy disclosures must match actual behavior.
- The release package must not contain QA reports, generated screenshots, golden baselines, saved HTML dumps, research artifacts, local configs, secrets, or `node_modules`.
- The developer account must satisfy Chrome Web Store publishing requirements such as two-step verification.

Reference policy pages:

- https://developer.chrome.com/docs/webstore/program-policies/policies
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/review-process
- https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions

## Repository Language Rule

Repository-facing text must remain English.

Do not add Russian text to:

- code comments;
- variable names;
- function names;
- diagnostics field names;
- error codes;
- test names;
- fixture names;
- documentation files;
- QA reports;
- changelog entries.

Russian is allowed in chat only unless a Russian-language repository artifact is explicitly requested.

## Tests

Keep diagnostics shape tests separate from behavior equality tests. Diagnostics shape tests prove that production output is small. Behavior equality tests prove that `diagnosticsMode` does not affect screenshots.

### Diagnostics Shape Tests

1. Production diagnostics shape:
   - missing `diagnosticsMode` behaves as `"production"`;
   - serialized diagnostics contain only the whitelist;
   - `platformOs` is absent, `null`, or one allowed coarse operating-system family value only;
   - production diagnostics do not contain exact operating-system version or device model;
   - no verbose candidate lists, frame details, geometry ranges, selectors, or research fields;
   - no `capturePlan.avoidRanges`, deep page diagnostics, selector-like fields, or frame-by-frame diagnostics.

2. QA diagnostics shape:
   - `diagnosticsMode: "qa"` includes verbose diagnostics;
   - `qaDiagnostics: true` maps to the same diagnostics mode as `diagnosticsMode: "qa"`.

### Behavior Equality Tests

3. Behavior equality:
   - run the same fixture in production and QA mode;
   - assert same status, output file count, output dimensions, output strategy, and saved file dimensions;
   - do not require verbose split boundary summaries or scroll target summaries in production diagnostics.

4. Default mode equivalence:
   - omitted `diagnosticsMode`, invalid `diagnosticsMode`, and explicit `diagnosticsMode: "production"` produce the same production diagnostics shape.

5. Legacy alias normalization:
   - `qaDiagnostics: true` normalizes to the same internal diagnostics mode as `diagnosticsMode: "qa"`;
   - `qaDiagnostics` must not create a second independent branch.

6. No QA artifacts in production:
   - normal user capture does not write QA reports or debug artifacts.

7. Stored diagnostics shape:
   - `chrome.storage.local.lastCaptureDiagnostics` in production mode stores only shaped production diagnostics;
   - it does not contain legacy verbose `diagnostics`, `capturePlan.avoidRanges`, frame details, selector-like fields, or deep page diagnostics.

8. Manifest and permissions:
   - `manifest.json` is unchanged;
   - no new permissions or host permissions are added.

9. Forbidden file diff guard:
   - first-iteration implementation does not modify `PageProbe.js`, `CaptureStepper.js`, `CanvasStitcher.js`, `CanvasTiler.js`, `CanvasSizeGuard.js`, `PositionPlanner.js`, `SplitBoundaryPlanner.js`, `FixedStickyNormalizer.js`, or `QuirksLayer.js`.

10. Privacy regression search:
   - release check searches for telemetry endpoints, upload code, cookie access, storage scraping, form value collection, remote script loading, `eval`, and `new Function`.

11. Release package audit:
   - release ZIP excludes generated files, QA reports, golden baseline PNG files, saved HTML dumps, research files, local configs, secrets, and `node_modules`.

## Expected Diff Budget

Target budget:

- `CaptureDiagnostics.js`: 40-90 lines;
- `CaptureController.js`: 15-40 lines;
- tests and docs: 80-180 lines.

Conditional budget only if diagnostics cannot be shaped before saving:

- `CaptureStore.js`: 10-30 lines.

Phase 2 budget only after measurement proves expensive diagnostics construction:

- `PageProbe.js`: 20-60 lines;
- `CaptureStepper.js`: 10-40 lines.

Stop and re-review if the total diff exceeds 500 lines.

## Stop Conditions

Stop and ask for confirmation if:

- capture behavior must change;
- `diagnosticsMode` affects output;
- `manifest.json` must change;
- new permissions are needed;
- `Canvas*`, `PositionPlanner`, or `SplitBoundaryPlanner` must change;
- fixed/sticky, scroll, overlay, or modal policy must change;
- a new classifier or engine appears necessary;
- site-specific logic appears necessary;
- telemetry or network upload appears;
- cookie, storage, form value, or DOM text collection appears;
- QA tools would be deleted instead of gated;
- phase 2 requires changing detection, probe, stepper, wait, or capture behavior instead of only diagnostic packaging;
- Russian text would be added to repository-facing files.

## Recommended First Patch

Implement only:

1. diagnostics mode normalization;
2. production diagnostics whitelist;
3. QA-mode verbose diagnostics preservation;
4. QA artifact write gate;
5. behavior equality tests;
6. release package audit checks.

Do not touch capture behavior.

Patch order:

1. First patch: `CaptureDiagnostics.js`, `CaptureController.js`, and the smallest validation tests for default production shape and `qaDiagnostics` alias normalization.
2. Second patch only if needed: gate QA artifact writes in `CaptureStore.js` or runner code.
3. Third patch only if needed: gate verbose frame/page diagnostics at their actual serialization boundary.
4. Phase 2 patch only if measurement proves a specific diagnostics builder is expensive: gate construction in `PageProbe.js` or `CaptureStepper.js` without changing detection, frame planning, waits, or capture behavior.
