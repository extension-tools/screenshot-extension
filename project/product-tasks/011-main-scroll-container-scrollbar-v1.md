# Product Task: Main Scroll Container Scrollbar V1

## Problem

Some pages render their main content inside an internal scroll container instead of scrolling the root `window`. Root scrollbar hiding does not cover scrollbar artifacts from that container.

## User

Users capturing web apps, dashboards, documentation shells, and pages where the main content scrolls inside a large internal pane.

## Value

The product should reduce scrollbar artifacts on pages with a dominant internal scroll container without changing the actual capture scroll target yet.

## Desired Behavior

- Detect one large visible internal scroll container.
- Hide its scrollbar during capture.
- Restore its attributes/styles after capture.
- Avoid touching small lists, textareas, inputs, selects, iframes, or editable regions.

## Non-Goals

- Do not change the actual scroll target in this task.
- Do not hide every internal scrollbar on the page.
- Do not handle custom scrollbar libraries yet.
- Do not dispatch a resize event.

## Success Criteria

- The main internal scroll container can be identified on common app-like pages.
- Its scrollbar is hidden during capture.
- Cleanup restores the container after capture.
- Existing checks still pass.

## Related Spec

- `../specs/011-main-scroll-container-scrollbar-v1.md`

