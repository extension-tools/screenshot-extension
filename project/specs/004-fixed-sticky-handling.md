# 004: Fixed And Sticky Handling

## Product Task

- `../product-tasks/004-fixed-sticky-handling.md`

## Goal

Prevent fixed and sticky elements from appearing repeatedly in stitched screenshots.

## User Value

Full-page screenshots should look like one continuous page, not a stack of repeated headers, chat widgets, cookie banners, or floating buttons.

## Problem

Viewport capture records what is visible at each scroll position. Elements with `position: fixed` or `position: sticky` can stay visible during every frame and therefore appear multiple times in the final stitched image.

## Proposed Architecture

Add a page-agent phase before capture:

1. Discover fixed and sticky elements.
2. Decide which elements should be hidden, transformed, or captured once.
3. Apply temporary CSS changes during capture.
4. Restore all original inline styles and injected CSS after capture.

## Current V1 Implementation

The first implementation is documented in `009-fixed-sticky-normalizer-v1.md`.

V1 keeps fixed/sticky elements visible on the first frame and hides detected viewport-attached elements on later frames through `DomMutationStack`.

## Edge Cases

- Sticky headers that only stick after a scroll threshold.
- Fixed cookie banners.
- Floating support widgets.
- Fixed backgrounds.
- Elements inside transformed ancestors.
- Pages that mutate DOM while capture runs.

## Requirements

- Never permanently change page styles.
- Keep cleanup in a `finally` path.
- Avoid hiding normal content accidentally.
- Allow site-specific test pages in visual regression.

## Test Coverage

- Manual sticky-header page in `../tests/manual-checklist.md`.
- Visual site entry with sticky/fixed UI in `../tests/visual-sites.json`.
- Future capture-flow output comparison in `../tests/capture-flow.mjs`.
