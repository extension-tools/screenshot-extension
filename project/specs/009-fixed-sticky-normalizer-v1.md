# 009: Fixed Sticky Normalizer V1

## Product Task

- `../product-tasks/009-fixed-sticky-normalizer-v1.md`

## Goal

Reduce repeated fixed and sticky UI in stitched full-page screenshots.

## Requirements

- Implement the normalizer in the page-side content layer.
- Use `DomMutationStack` for all temporary style changes.
- Keep fixed/sticky UI visible on the first frame.
- Hide visible fixed elements on subsequent frames.
- Hide visible sticky elements on subsequent frames only when they are pinned to a viewport edge.
- Restore all styles during cleanup.
- Avoid site-specific selectors.

## Architecture

```text
CaptureStepper
  -> ContentAgentClient.beforeFrame()
      -> ContentAgent.beforeFrame()
          -> FixedStickyNormalizer.beforeFrame()
              -> DomMutationStack.setStyle(element, "visibility", "hidden", "important")
```

## Detection Rules

For frames after the first frame:

- scan page elements under `document.body`;
- inspect `getComputedStyle(element).position`;
- consider `position: fixed`;
- consider `position: sticky` only when the element is currently pinned near a viewport edge;
- skip invisible or zero-size elements;
- skip elements larger than 95% of the viewport area.

## Behavior

V1 uses a simple policy:

```text
frame 0: capture normally
frame 1+: hide detected viewport-attached elements until cleanup
```

This is intentionally conservative in implementation complexity, not perfect in page semantics. It targets the most visible MVP bug: repeated viewport-attached UI.

## Edge Cases

- Sticky headings that become pinned only after scrolling.
- Fixed cookie banners at the bottom of the viewport.
- Floating city/location popups.
- Floating widgets.
- Very large fixed overlays.
- Pages that mutate DOM while capture runs.

## Known Limits

- A sticky element that is actual page content may be hidden after the first frame if it is pinned to a viewport edge.
- Cross-origin iframe internals are not normalized.
- The normalizer does not yet reserve space for removed sticky headers.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual browser check on pages with sticky headers, cookie banners, and popups: `project/tests/manual-checklist.md`.

