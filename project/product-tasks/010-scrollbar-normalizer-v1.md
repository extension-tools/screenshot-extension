# Product Task: Scrollbar Normalizer V1

## Problem

Some full-page captures include duplicated or visible browser scrollbars in stitched output.

## User

Users capturing long pages where browser-rendered scrollbars become visible artifacts in the final image.

## Value

The screenshot should focus on page content and avoid repeated scrollbar strips.

## Desired Behavior

- Hide root `html/body` scrollbars while capture is running.
- Restore normal scrollbar behavior after capture.
- Avoid cropping pixels after capture.
- Avoid touching internal scroll containers in v1.

## Non-Goals

- No internal scroll-container scrollbar hiding in v1.
- No custom scrollbar library handling in v1.
- No artificial resize event in v1.
- No change to the active scroll target.

## Success Criteria

- Root page scrollbars are not rendered into capture frames.
- Scrollbars return after capture cleanup.
- Existing capture behavior and validations continue to work.

## Related Spec

- `../specs/010-scrollbar-normalizer-v1.md`

