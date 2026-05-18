# 028: Capture Diagnostics V2

## Product Task

- `../product-tasks/028-capture-diagnostics-v2.md`

## Goal

Create a single structured capture diagnostics object that explains what happened during capture and export.

## Architecture

```text
CaptureController
  -> CaptureDiagnostics.create()
  -> PageProbe / CanvasSizeGuard / SingleFileExportAttempt
  -> CaptureStepper / CaptureStore
  -> chrome.storage.local.lastCaptureDiagnostics
  -> capture-flow and real-site QA reports
```

## Stored Shape

`lastCaptureDiagnostics` keeps backward-compatible fields:

- `version`
- `mode`
- `strategy`
- `diagnostics`
- `generatedAt`

It also includes a new `capture` object with:

- `version`
- `status`
- `command`
- `startedAt`
- `completedAt`
- `tab`
- `prefs`
- `initialPage`
- `page`
- `output`
- `scrollTarget`
- `singleFileExportAttempt`
- `imageReadinessSummary`
- `export`
- `failureReason`
- `errorMessage`

## Required Fields

### Page

- CSS page width and height.
- Viewport width and height.
- DPR.
- Bitmap width and height.
- Original scroll state.

### Output

- `strategy`: `single-canvas` or `tiled-output`.
- Bitmap width, height, and area.
- DPR.
- Tile count.
- Tile height when tiled.

### Scroll Target

- `window` or `element`.
- Compose mode when app-shell capture is used.
- Candidate count and capture area when available.

### Export

- `status`: `not_started`, `saved`, `partial_or_failed`, or `failed`.
- File records with part number, filename, size where available, download id, and error.
- Export/download errors.

### Failure

`failureReason` should use stable machine-readable values such as:

- `unsupported_url`
- `too_wide_for_vertical_tiling`
- `too_many_output_parts`
- `too_large_for_supported_output`
- `capture_visible_tab_failed`
- `download_failed`
- `content_script_failed`
- `unknown`

## Compatibility

Existing image readiness and single-file export diagnostics remain available under the legacy `diagnostics` object because current tests and reports already read that shape.

## Test Coverage

`huge-page-tiling` in `../tests/capture-flow.mjs` verifies:

- v2 diagnostics are stored;
- capture status is `success`;
- output strategy is `tiled-output`;
- export status is `saved`;
- scroll target is `window`;
- bitmap size is recorded.

`too-many-parts-page` verifies:

- capture status is `failed`;
- export status is `not_started`;
- failure reason is `too_many_output_parts`;
- bitmap size is still available from page diagnostics.
