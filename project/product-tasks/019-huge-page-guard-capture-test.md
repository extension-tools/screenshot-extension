# Product Task: Huge Page Guard Capture Test

## Problem

Very large pages can exceed the MVP single-canvas limits. Without a regression test, a future change could reintroduce blank images, crashes, or accidental downloads for pages that should fail clearly.

This task is now superseded for supported tall pages by `005-large-page-canvas-tiling.md`; the remaining guard behavior applies to unsupported dimensions such as extremely wide pages or pages requiring too many output parts.

## User

Users capturing very long articles, dashboards, timelines, and documents.

## Value

The product should fail predictably on oversized pages that cannot be tiled safely. A controlled error is better than a corrupted image or unstable browser behavior.

## Desired Behavior

- Add a deterministic oversized page fixture.
- Run it through the real extension capture flow.
- Expect tiled output for supported tall pages.
- Keep controlled `CanvasSizeGuard` errors for unsupported dimensions.

## Non-Goals

- No PDF export behavior in this task.
- No automatic zoom reduction in this task.

## Success Criteria

- `capture:test` now runs `huge-page-tiling` after the download cases.
- The case passes only when multiple PNG parts download and stay below the safe canvas height.
- Unsupported-width or excessive-part guard coverage should be added as a separate future fixture.

## Related Spec

- `../specs/019-huge-page-guard-capture-test.md`
