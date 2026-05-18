# 025: Image Readiness Diagnostics

## Product Task

- `../product-tasks/025-image-readiness-diagnostics.md`

## Goal

Add diagnostics-only visibility into whether visible image previews are ready when capture runs.

## Architecture

```text
ContentAgent
  -> ImageReadinessProbe.collect()
  -> CaptureController diagnostics
  -> chrome.storage.local.lastCaptureDiagnostics
  -> real-site QA report
```

## Metrics

`ImageReadinessProbe` records:

- `visibleImages`
- `readyImages`
- `pendingImages`
- `brokenImages`
- `placeholderBlocks`
- `readinessRatio`

## Capture Points

- before warmup;
- after warmup;
- before each `captureVisibleTab` frame.

## E2E Coverage

`project/tests/capture-flow.mjs` includes deterministic fixture coverage for the diagnostics:

- `lazy-preview-grid-page`: visible preview images start pending, warmup loads them, and the final PNG must contain the loaded preview markers.
- `broken-image-diagnostics-page`: an intentionally broken visible image is reported in diagnostics while the capture still succeeds.

These checks make image readiness regressions visible without relying only on real-site QA screenshots.

## Important Constraint

This is diagnostics-only. It does not block capture and does not require all images to load. Future work may add adaptive waits based on these metrics.
