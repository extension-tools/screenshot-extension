# Product Task: Fixed And Sticky Handling

## Problem

Sticky headers, floating buttons, banners, and fixed widgets can repeat many times in stitched screenshots.

## User

Users capturing modern websites with sticky navigation, cookie banners, chat widgets, and fixed UI.

## Value

The final screenshot should look like a continuous page instead of a set of repeated viewport captures.

## Desired Behavior

- The extension detects fixed and sticky elements.
- It prevents repeated UI from polluting the final screenshot.
- It restores the page after capture.

## Non-Goals

- No permanent page modification.
- No site-specific hardcoded selectors as the main strategy.
- No iframe-internal sticky cleanup for cross-origin frames in this task.

## Success Criteria

- Sticky headers are not repeated across every captured frame.
- Fixed overlays do not dominate the final screenshot.
- Page styles are restored after capture.

## Related Spec

- `../specs/004-fixed-sticky-handling.md`
- `../specs/009-fixed-sticky-normalizer-v1.md`
