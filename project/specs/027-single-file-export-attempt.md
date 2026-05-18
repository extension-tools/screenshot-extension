# 027: Single File Export Attempt

## Product Task

- `../product-tasks/027-single-file-export-attempt.md`

## Goal

Create a safe export-planning layer that decides whether the captured result should be emitted as one file or as multiple parts.

## Product-Technical Description

The product should strive for one output file because it is easier to use and share. But reliability comes first: if a single PNG would require an unsafe canvas, the product should intentionally keep the multi-part result instead of risking a blank image, crash, or failed export.

This prepares the future PDF layer because PDF may have a safe single-file path that does not require creating one giant bitmap canvas.

## Architecture

```text
CanvasSizeGuard
  -> strategy: single-canvas | tiled-output
  -> SingleFileExportAttempt.evaluate()
  -> CaptureDiagnostics
  -> CaptureStore.save | CaptureStore.saveMultiple
```

## Current PNG Rules

- `single-canvas` means the bitmap is within configured safe limits, so single-file PNG export is allowed.
- `tiled-output` means the single output bitmap exceeds configured safe canvas limits, so single-file PNG export is not attempted.
- Multi-part PNG output is a successful result, not a failure.

## Diagnostic Shape

`singleFileExportAttempt` records:

- `format`
- `strategyMode`
- `bitmapWidth`
- `bitmapHeight`
- `tileCount`
- `decision`
- `safe`
- `attempted`
- `reason`
- `fallback`

## Current Decisions

```text
single-canvas -> decision: single-file, reason: single_canvas_within_limits
tiled-output  -> decision: parts, reason: single_canvas_exceeds_limits
```

## Future PDF Use

PDF export can reuse the same decision point with different rules:

- if a single PDF can be produced from pages/tiles without a giant canvas, `decision` can be `single-file`;
- if PDF pagination fails or becomes unsafe, the product can still fall back to parts or a controlled error.

## Test Coverage

`huge-page-tiling` in `../tests/capture-flow.mjs` verifies:

- multiple PNG parts are downloaded;
- the single-file export attempt is recorded;
- the decision is `parts`;
- the reason is `single_canvas_exceeds_limits`;
- unsafe single-file PNG export is not attempted.
