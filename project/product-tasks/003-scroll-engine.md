# Product Task: Scroll Engine

## Problem

Web pages are often larger than the visible viewport, so a single browser screenshot is not enough.

## User

Users who need a complete page record, especially for documentation, QA, research, and review.

## Value

The user receives one continuous screenshot of a long or wide page.

## Desired Behavior

- The extension measures the full page.
- The extension scrolls through the page automatically.
- It captures each viewport section.
- It stitches sections into a final image.
- It restores the original viewport position.

## Non-Goals

- No custom scroll-container handling in the first scroll engine.
- No canvas tiling in this task.
- No fixed/sticky cleanup in this task.

## Success Criteria

- Pages taller than the viewport are captured.
- High-DPI output is not scaled incorrectly.
- Scroll restoration works after success and failure.

## Related Spec

- `../specs/003-scroll-engine.md`

