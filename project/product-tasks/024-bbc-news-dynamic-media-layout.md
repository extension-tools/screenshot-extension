# Product Task: BBC News Dynamic Media/Layout Capture

## Problem

BBC News can still produce imperfect full-page captures:

- the page may shift horizontally or appear clipped during stitched capture;
- some preview images may remain broken or partially loaded;
- dynamic ad/media slots can resize while the capture is in progress.

## User

Users capturing news homepages and media-heavy editorial pages.

## Value

The product should keep news layouts readable and avoid obvious placeholder media when pages continue loading while capture runs.

## Current Status

The general lazy warmup was improved:

- current viewport is warmed before scrolling away;
- warmup waits longer for visible images;
- per-frame stabilization waits for more images.

BBC improved compared with the previous all-gray preview state, but it is not fully solved yet.

## Next Technical Options

- Add diagnostics for layout shift between planned positions and captured frames.
- Detect large dynamic ad slots and wait for height stabilization before planning.
- Add a stronger image-readiness pass for visible `picture/img` elements.
- Consider a site-agnostic "late remeasure and replan" when scroll height or major content positions shift after warmup.

## Non-Goals

- No BBC-specific selector hacks as the primary solution.
- No blocking capture indefinitely waiting for every network image.

## Related Areas

- `../specs/021-lazy-load-warmer-v1.md`
- `../specs/012-stabilization-wait-v1.md`
