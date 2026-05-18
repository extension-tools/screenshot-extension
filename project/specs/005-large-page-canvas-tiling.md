# 005: Large Page Canvas Tiling

## Product Task

- `../product-tasks/005-large-page-canvas-tiling.md`

## Goal

Support pages whose final screenshot would exceed Chrome or canvas size limits.

## User Value

Long pages should either capture successfully or fail with a clear, actionable error instead of crashing or producing a blank image.

## Problem

The current MVP stitches into one `OffscreenCanvas`. Very large pages can exceed browser canvas dimensions, memory limits, or image encoding limits.

## Proposed Architecture

Add a capture planner before stitching:

1. Estimate final pixel width and height after `devicePixelRatio`.
2. Compare against known safe canvas limits.
3. Choose one of three paths:
   - single canvas for normal pages;
   - tiled canvases for large pages;
   - clear failure for pages beyond supported limits.
4. Encode tiles or combine them through a safe output strategy.

## Edge Cases

- Extremely tall pages.
- Extremely wide pages.
- High-DPI screens increasing output size.
- Memory pressure during image encoding.
- PNG and JPEG output differences.

## Requirements

- Guard before allocating huge canvases.
- Report page size and limit reason on failure.
- Keep the UI responsive enough to cancel in future versions.
- Avoid silent blank images.

## Current V1 Implementation

The first tiling implementation keeps `CanvasSizeGuard` as the decision point:

- `single-canvas`: normal pages still produce one PNG.
- `tiled-output`: very tall pages are split into multiple PNG parts.
- `controlled failure`: pages that are too wide or require too many parts still fail with a clear error.

`CanvasTiler` performs vertical output tiling only. It does not yet support horizontal tiling, ZIP packaging, or PDF export.

When `tiled-output` is selected, `NotificationService` emits a pre-capture `capture.large-page-split` event so the user can understand that multiple PNG downloads are intentional. The current text is placeholder product copy and can be replaced later.

`SingleFileExportAttempt` records whether one-file export is safe after the final post-warmup strategy is selected. For current PNG output, `tiled-output` means a single giant canvas would exceed safe limits, so the product keeps the successful multi-part output instead of trying to stitch the parts back into an unsafe bitmap.

## Test Coverage

- Manual very-long-page case in `../tests/manual-checklist.md`.
- `huge-page-tiling` in `../tests/capture-flow.mjs` verifies that a page above the single-canvas height limit produces multiple valid PNG parts, emits the large-page split notification event, and records that unsafe single-file PNG export was not attempted.
- Real-site QA should include Wikipedia and MDN because both previously exceeded the single-canvas height limit and now exercise multi-part output.

## Current Real-Site Signal

- Wikipedia Taylor Swift: 4 PNG parts at `1365x16384`, `1365x16384`, `1365x16384`, `1365x2811`.
- MDN Web API: 3 PNG parts at `1365x16384`, `1365x16384`, `1365x4951`.
