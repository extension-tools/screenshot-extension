# 014: Canvas Size Guard V1

## Product Task

- `../product-tasks/014-canvas-size-guard-v1.md`

## Goal

Guard the single-canvas path before `OffscreenCanvas` allocation and hand supported tall pages to tiled output.

## Requirements

- Add a capture-layer guard before `CanvasStitcher` is created.
- Compute output width and height as `page.width * devicePixelRatio` and `page.height * devicePixelRatio`.
- Route pages that exceed configured single-canvas height or area limits to `CanvasTiler` when vertical tiling is safe.
- Reject pages that are too wide or require too many output parts.
- Use the existing notification path for the user-facing error.
- Keep controlled errors for unsupported dimensions.

## Architecture

```text
CaptureController
  -> PageProbe.measure()
  -> CanvasSizeGuard.createStrategy(page)
  -> ContentAgent.prepareCapture()
  -> CanvasStitcher | CanvasTiler
```

## Current Limits

- Maximum output width or height: `16384px`.
- Maximum output area: `100,000,000px`.

These are conservative MVP limits for the single-canvas path. Supported tall pages now use vertical output tiling.

## Error Behavior

When the page is unsupported by both single-canvas and tiled-output paths, capture stops before unsafe canvas allocation. The user receives an error notification.

```text
This page is too large to capture safely.
```

The notification also includes the estimated output size.

## Known Limits

- The guard only supports vertical tiling through `CanvasTiler`.
- Extremely wide pages still fail clearly.
- Some browsers/devices may support larger canvases, but the MVP uses conservative limits.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual check on an extremely long page.
- `huge-page-tiling` in `project/tests/capture-flow.mjs`.
