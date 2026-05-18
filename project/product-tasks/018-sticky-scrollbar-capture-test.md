# Product Task: Sticky Scrollbar Capture Test

## Problem

The extension previously had real-site regressions where fixed headers, cookie banners, and scrollbars appeared more than once in a stitched full-page capture.

## User

People using the extension on content-heavy websites with sticky navigation, cookie banners, and scrollable panels.

## Value

The product needs an automated signal that the current fixed/sticky and scrollbar normalizers are still protecting capture quality after code changes.

## Desired Behavior

- Add a deterministic `sticky-scrollbar-page` fixture.
- Include fixed header, fixed cookie banner, sticky nav, and a large internal scroll container with colored scrollbar markers.
- Capture the fixture through the real extension capture flow.
- Verify that the downloaded PNG is taller than the viewport.
- Verify that fixed/sticky marker colors appear within bounded row counts rather than repeating at every tile.
- Verify that internal scrollbar marker colors are hidden.

## Non-Goals

- No real-site sticky assertion in this task.
- No lazy-load assertion in this task.
- No huge-page guard assertion in this task.
- No visual golden-image diff in this task.

## Success Criteria

- `capture:test` runs `sticky-scrollbar-page` after `basic-long-page`.
- The case fails if marker rows indicate repeated fixed/sticky elements.
- The case fails if internal scrollbar marker colors remain visible.
- The case writes its own report and PNG artifacts.

## Related Spec

- `../specs/018-sticky-scrollbar-capture-test.md`
