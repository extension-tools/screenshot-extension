# Product Task: Large Page Canvas Tiling

## Problem

Very large pages can exceed Chrome canvas or memory limits and produce failed or blank screenshots.

## User

Users capturing long reports, product pages, documentation pages, feeds, or pages on high-DPI screens.

## Value

The product should handle large pages predictably: capture when possible and fail clearly when not possible.

## Desired Behavior

- The extension estimates final output size before allocating a huge canvas.
- Normal pages use the simple path.
- Large pages use a safer tiled path.
- Unsupported sizes produce a clear error.

## Non-Goals

- No PDF export in this task.
- No cloud processing.
- No infinite-page capture.

## Success Criteria

- Huge canvas allocation is guarded.
- User gets a clear error instead of a blank image.
- Large supported pages can be captured through tiling.
- Wikipedia and MDN no longer fail on the single-canvas height limit and produce valid PNG parts.

## Related Spec

- `../specs/005-large-page-canvas-tiling.md`
