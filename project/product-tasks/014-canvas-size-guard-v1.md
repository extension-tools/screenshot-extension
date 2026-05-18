# Product Task: Canvas Size Guard V1

## Problem

Very large pages can exceed browser canvas limits and cause failed captures, blank images, or unstable extension behavior.

## User

Users capturing very long pages, wide pages, or pages on high-DPI screens.

## Value

The product should fail clearly before allocating an unsafe canvas instead of crashing or producing a broken image.

## Desired Behavior

- Estimate final output size before creating an `OffscreenCanvas`.
- Allow normal pages to capture as before.
- Stop capture when the output image is too large for the MVP single-canvas path.
- Show a clear user-facing error.

## Non-Goals

- No canvas tiling in this task.
- No multi-image export.
- No PDF export.
- No attempt to reduce zoom automatically.

## Success Criteria

- Large output size is detected before canvas allocation.
- The user sees a clear error instead of a blank image or crash.
- Existing checks still pass.

## Related Spec

- `../specs/014-canvas-size-guard-v1.md`

