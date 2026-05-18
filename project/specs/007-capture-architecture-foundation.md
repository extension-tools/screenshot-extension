# 007: Capture Architecture Foundation

## Product Task

- `../product-tasks/007-capture-architecture-foundation.md`

## Goal

Refactor the MVP capture flow into architecture modules without changing the main user-facing behavior.

## Requirements

- Keep Chrome MV3 and the current unpacked-extension flow.
- Keep `Capture Entire Page` as the only command.
- Keep visible-tab capture and canvas stitching.
- Keep original scroll restoration.
- Keep downloads as the output path.
- Avoid adding a bundler or build step.

## Architecture

The capture layer lives under `code/capture/`.

```text
worker.js
  -> CaptureController
      -> CapabilityGuard
      -> PageProbe
      -> PositionPlanner
      -> CaptureStepper
      -> ViewportCapture
      -> CanvasStitcher
      -> CaptureStore
      -> CleanupManager
```

## Module Responsibilities

- `CaptureController`: owns the high-level capture command flow.
- `CapabilityGuard`: blocks unsupported tabs and URLs before capture starts.
- `PageProbe`: measures page dimensions, viewport, DPR, and original scroll position.
- `PositionPlanner`: builds the list of scroll positions.
- `CaptureStepper`: scrolls through planned positions and captures each frame.
- `ViewportCapture`: wraps `chrome.tabs.captureVisibleTab`.
- `CanvasStitcher`: draws viewport frames into the output canvas.
- `CaptureStore`: saves the final blob through Chrome downloads.
- `CleanupManager`: clears transient capture state and restores scroll.

## Edge Cases

This task does not solve new page edge cases. It creates the boundaries needed for the next tasks:

- fixed/sticky duplicate handling;
- lazy-load warmup;
- custom scroll target detection;
- large-page canvas tiling;
- stronger cleanup after failure.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual Chrome load check: `project/tests/manual-checklist.md`.

