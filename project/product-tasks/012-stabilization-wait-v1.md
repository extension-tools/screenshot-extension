# Product Task: Stabilization Wait V1

## Problem

After scrolling and temporary DOM/CSS changes, the page can still be between layout states when `captureVisibleTab` runs.

This can create partial renders, shifted sticky elements, late font swaps, or visible images that are still loading.

## User

Users capturing dynamic pages with web fonts, lazy images, sticky elements, and layout scripts.

## Value

The capture should wait briefly for the current viewport to settle before each frame is captured.

## Desired Behavior

- After each scroll and frame-specific normalization, wait for a short stabilization window.
- Let animation frames complete.
- Wait for loading fonts when possible.
- Give visible loading images a bounded chance to decode.
- Never hang capture indefinitely.

## Non-Goals

- No full lazy-load warmup pass.
- No network-idle tracking.
- No infinite wait for images.
- No synthetic resize event.

## Success Criteria

- Capture still completes on normal pages.
- The wait has a bounded timeout.
- Existing validation and visual regression pass.
- The architecture has a clear hook for future stabilization improvements.

## Related Spec

- `../specs/012-stabilization-wait-v1.md`

