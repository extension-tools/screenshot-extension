# 003: Scroll Engine

## Product Task

- `../product-tasks/003-scroll-engine.md`

## Goal

Capture pages larger than the viewport by scrolling the page, capturing visible frames, and stitching those frames into the final image.

## User Value

The user gets a full-page screenshot instead of only the visible viewport.

## Current Behavior

- Measure document width and height.
- Measure viewport width and height.
- Store original scroll position.
- Loop over x and y positions.
- Scroll to each position.
- Wait briefly for the page to settle.
- Capture the visible tab.
- Draw the captured frame into the output canvas.
- Restore the original scroll position.

## Edge Cases

- Long vertical pages.
- Wide horizontal pages.
- High-DPI screens.
- Pages that do not scroll exactly to requested coordinates.
- Capture interruption or failure.

## Future Requirements

- Detect the true scroll target, not only `window`.
- Avoid repeated fixed/sticky elements.
- Stabilize lazy-loaded content.
- Handle pages with scroll snapping or smooth-scroll behavior.
- Add cancellation support.
- Avoid creating canvases that exceed Chrome limits.

## Test Coverage

- Manual long-page and horizontal-scroll cases in `../tests/manual-checklist.md`.
- Visual sites listed in `../tests/visual-sites.json`.
- Future downloaded-output comparison in `../tests/capture-flow.mjs`.
