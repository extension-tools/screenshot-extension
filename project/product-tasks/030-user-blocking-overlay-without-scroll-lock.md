# 030: User-Blocking Overlay Without Scroll Lock

## Product Statement

Some sites show a large first-viewport overlay that blocks what the user can reasonably interact with, but the page still allows programmatic scrolling behind the overlay. The current runtime scroll probe does not close this class: it can prove that background scroll moves, but not that the user-visible state is unblocked.

This work is parked in backlog. It should not interrupt the current release focus on split-boundary/card seams, tiled-output card boundaries, capture communication, and PDF export.

## Decision Sites

- Samsung Galaxy S: https://www.samsung.com/us/smartphones/galaxy-s/
- LEGO Millennium Falcon: https://www.lego.com/en-us/product/millennium-falcon-75192
- Nike Air Force 1: https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111
- Dyson Vacuums: https://www.dyson.com/vacuum-cleaners

## Current Finding

- Samsung should not be forced to `viewport-only` just because a large overlay is visible; the remaining Samsung issue is dimmed backdrop continuity.
- LEGO and Nike still continue full-page with the runtime scroll probe because programmatic scroll can move behind the modal.
- Dyson is a control for complex product/rich-media capture and should continue full-page/tiled output when no blocking modal exists.

## Desired Future Behavior

When this backlog item is resumed, the engine should distinguish:

- technical scroll lock, which already means `viewport-only`;
- visually/user-blocking overlays where user scroll or pointer interaction is blocked even though programmatic scroll works;
- large but non-blocking overlays that should continue full-page and route to review.

## Non-Goals

- Do not revive text/brand/site-specific entry-gate rules as a hard stop.
- Do not add broad modal semantics as a capture mode.
- Do not change fixed/sticky normalization, dimmed backdrop continuity, or split-boundary planning in the same change.

## Success Criteria

- Samsung-like pages avoid false `viewport-only`.
- LEGO/Nike-like visibly blocking overlays stop at the first user-visible viewport.
- Dyson-like complex pages continue full-page/tiled output.
- Diagnostics explain whether the decision came from technical scroll lock, user-scroll/pointer blocking, or a non-blocking large overlay.
