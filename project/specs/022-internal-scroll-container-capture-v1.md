# 022: Internal Scroll Container Capture V1

## Product Task

- `../product-tasks/022-internal-scroll-container-capture-v1.md`

## Goal

Capture one high-confidence internal scroll container when the page behaves like an app shell and the browser window itself barely scrolls.

## Requirements

- `PageProbe.measure()` must detect whether the capture target is `window` or one internal element.
- `window` remains the default target.
- Internal target selection must require high confidence:
  - browser window has little or no scrollable height;
  - one candidate occupies a large portion of the viewport;
  - candidate has significant scrollable height;
  - no second candidate has a similar score.
- Mark the selected element with a temporary capture attribute.
- `PageProbe.scrollTo()` and `readScroll()` must operate on the selected element when present.
- `PageProbe.restore()` must restore both selected-element scroll and window scroll, then remove the temporary capture attribute.
- `CanvasStitcher` must compose app-shell captures by drawing the first viewport as page chrome, then stitching the selected element rectangle through its scroll range.
- After warmup, the capture flow must remeasure the selected target and rebuild positions before creating the canvas.
- Existing window capture behavior must continue to work.

## Pipeline Behavior

```text
PageProbe.measure()
  -> target: window | element
  -> PositionPlanner
  -> LazyLoadWarmer
  -> PageProbe.measure()
  -> PositionPlanner
  -> CaptureStepper
  -> CanvasStitcher crop/draw
  -> CleanupManager restore
```

## Fixture

The fixture lives at:

```text
project/tests/fixtures/internal-scroll-container-page.html
```

It contains:

- a non-scrolling app-shell window;
- a static sidebar;
- one large central internal scroll container;
- a bright bottom marker that is not visible in the first container viewport.

The dynamic-growth fixture lives at:

```text
project/tests/fixtures/dynamic-internal-scroll-page.html
```

It contains a central internal scroll container that appends a new tail section during warmup. The post-warmup remeasure must include that new scroll height so the tail is captured.

The short chat fixture lives at:

```text
project/tests/fixtures/short-chat-internal-scroll-page.html
```

It contains a ChatGPT-like app shell where the browser window does not scroll and the central conversation has only a short internal scroll range. The capture target finder must still choose the conversation pane.

## Case Definition

The case is registered in `project/tests/capture-flow.mjs`:

```js
{
  name: 'internal-scroll-container-page',
  path: '/internal-scroll-container-page.html',
  expected: 'download',
  assertions: {
    heightGreaterThanViewport: true
  }
}
```

```js
{
  name: 'dynamic-internal-scroll-page',
  path: '/dynamic-internal-scroll-page.html',
  expected: 'download',
  assertions: {
    heightGreaterThanViewport: true,
    minColorPixels: [...]
  }
}
```

```js
{
  name: 'short-chat-internal-scroll-page',
  path: '/short-chat-internal-scroll-page.html',
  expected: 'download',
  assertions: {
    heightGreaterThanViewport: true,
    minColorPixels: [...]
  }
}
```

## Current Passing Signal

On the first passing run:

```text
PNG 1105x2650
internal scroll bottom marker pixels: 70029
```

The output keeps the browser viewport width so app chrome such as sidebars is included. The selected scroll container is still the only area stitched through its internal scroll range.

For the dynamic-growth case, the expected passing signal is a downloaded PNG that contains the blue dynamic tail marker appended during warmup.

For the short chat case, the expected passing signal is a downloaded PNG taller than the viewport that also contains the sidebar marker. This confirms that a short internal scroll target was selected and app-shell chrome was included.

## Beta App-Shell Requirement

For sites selected as beta app-shell targets, the capture must include:

- the main scrollable content;
- the visible sidebar or left navigation;
- the top chrome/header when it is visible.

The beta does not require all nested scroll containers, deep iframe scrolling, complete virtualized infinite history, or hidden/collapsed sidebars.

## Known Limits

- Only one high-confidence internal container is supported.
- Pages with multiple similar scroll containers fall back to `window` capture.
- Virtualized chat/message lists may still need additional handling.
- Post-warmup remeasure handles bounded scroll-height growth, but not endless history expansion.
- Surrounding app chrome is included from the first viewport only; it is not repeated down the full stitched height.
