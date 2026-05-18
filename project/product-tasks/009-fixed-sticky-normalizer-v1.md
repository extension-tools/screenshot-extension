# Product Task: Fixed Sticky Normalizer V1

## Problem

During full-page capture, elements attached to the viewport are captured repeatedly. In the MVP this showed up as duplicated site headers, cookie banners, and city popups.

## User

Users capturing modern websites with sticky headers, fixed cookie banners, floating popups, chat widgets, city selectors, and other viewport-attached UI.

## Value

The final screenshot should look closer to one continuous page instead of a stack of repeated viewport states.

## Desired Behavior

- The first capture frame may include fixed/sticky elements.
- Subsequent capture frames should hide visible fixed elements.
- Subsequent capture frames should hide sticky elements that are currently pinned to a viewport edge.
- All hidden elements are restored after capture, including error cases.

## Non-Goals

- No perfect semantic classification of every overlay.
- No site-specific selector list.
- No cross-origin iframe internal cleanup.
- No removal of full-page modal content in this iteration.

## Success Criteria

- Site headers no longer repeat on every stitched frame.
- Cookie banners no longer repeat on every stitched frame.
- City/location popups no longer repeat on every stitched frame.
- Page DOM/CSS is restored after capture.
- Existing validation and visual regression still pass.

## Related Spec

- `../specs/009-fixed-sticky-normalizer-v1.md`

