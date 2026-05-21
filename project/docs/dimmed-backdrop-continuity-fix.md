# Dimmed Backdrop Continuity Fix

## Problem

During full-page capture, a page can be in an overlay state: the first viewport has an open popup, cookie/country dialog, or entry gate, and the page behind it is dimmed.

The broken output looks like this:

- the first frame is dark because the backdrop is visible;
- later frames are light/white because the backdrop disappeared or was hidden with the popup;
- the stitched screenshot looks like a mix of two different page states.

Expected behavior: if frame 0 had a dimmed backdrop, later frames should keep the dimming, while the popup/dialog panel should not repeat down the stitched page.

## Scope

This is a narrow fix:

- only `frame 0`;
- only `full-page`;
- only `position: fixed`;
- only fullscreen or near-fullscreen host;
- dark paint only on the host itself or a direct child;
- no pseudo-elements;
- no `filter` / `backdrop-filter`;
- no `absolute` / `sticky` backdrop;
- no deep child scan;
- no `promo` semantics.

## Code

### `FixedStickyNormalizer.js`

In `beforeFrame()`, replace:

```js
this.recordDimmedBackdropState();
```

with:

```js
const dimmedBackdropRecorded = isFirstFrame && afterFirstFramePolicy.preserveDimmedBackdrop !== false ?
  this.recordDimmedBackdropState({frameIndex, capturePolicy: policy}) :
  false;
```

Add these fields to the returned diagnostics:

```js
dimmedBackdropRecorded,
dimmedBackdropSnapshot: Boolean(this.dimmedBackdropSnapshot),
dimmedBackdropSource: this.dimmedBackdropSnapshot?.source || null,
```

Replace `recordDimmedBackdropState()` with:

```js
recordDimmedBackdropState({frameIndex = 0, capturePolicy = null} = {}) {
  if (!document.body || this.dimmedBackdropSnapshot || Number(frameIndex) !== 0) {
    return false;
  }

  const policy = this.normalizeCapturePolicy(capturePolicy);
  if (policy.mode !== 'full-page') {
    return false;
  }

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  for (const element of this.collectElements(document.body)) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    if (style.position !== 'fixed') {
      continue;
    }

    if (!this.isNearViewportCover(rect, viewportWidth, viewportHeight, 0.85, 24)) {
      continue;
    }

    if (!this.hasModalBackdropContext(element, viewportWidth, viewportHeight)) {
      continue;
    }

    if (this.hasDimmedBackdropPaint(style)) {
      this.dimmedBackdropSnapshot = {
        backgroundColor: this.createSyntheticBackdropColor(style),
        zIndex: this.createSyntheticBackdropZIndex(style),
        source: 'fixed-backdrop'
      };
      return true;
    }

    for (const child of Array.from(element.children || [])) {
      const childStyle = getComputedStyle(child);
      const childRect = child.getBoundingClientRect();

      if (!this.isNearViewportCover(childRect, viewportWidth, viewportHeight, 0.75, 32)) {
        continue;
      }

      if (!this.hasDimmedBackdropPaint(childStyle)) {
        continue;
      }

      this.dimmedBackdropSnapshot = {
        backgroundColor: this.createSyntheticBackdropColor(childStyle),
        zIndex: this.createSyntheticBackdropZIndex(style),
        source: 'direct-child-backdrop'
      };
      return true;
    }
  }

  return false;
}

isNearViewportCover(rect, viewportWidth, viewportHeight, minAreaRatio, insetTolerance) {
  const viewportArea = viewportWidth * viewportHeight;

  return rect.width * rect.height >= viewportArea * minAreaRatio &&
    rect.top <= insetTolerance &&
    rect.left <= insetTolerance &&
    rect.bottom >= viewportHeight - insetTolerance &&
    rect.right >= viewportWidth - insetTolerance;
}

hasModalBackdropContext(element, viewportWidth, viewportHeight) {
  const descriptor = [
    element.tagName,
    element.id,
    element.className,
    element.getAttribute('role'),
    element.getAttribute('aria-modal')
  ].join(' ').toLowerCase();

  return /dialog|modal|popover|popup|overlay|backdrop|consent|cookie/.test(descriptor) ||
    element.matches('dialog[open], [aria-modal="true"], [role="dialog"], [popover]') ||
    this.findLikelyModalPanels(element, viewportWidth, viewportHeight).length > 0;
}
```

### `ContentAgentClient.js`

Add these fields to the initial `aggregate` object:

```js
dimmedBackdropRecorded: false,
dimmedBackdropSnapshot: false,
dimmedBackdropSource: null,
```

Add this inside the loop over frame results:

```js
aggregate.dimmedBackdropRecorded =
  aggregate.dimmedBackdropRecorded || Boolean(result.dimmedBackdropRecorded);
aggregate.dimmedBackdropSnapshot =
  aggregate.dimmedBackdropSnapshot || Boolean(result.dimmedBackdropSnapshot);
aggregate.dimmedBackdropSource =
  aggregate.dimmedBackdropSource || result.dimmedBackdropSource || null;
```

### `CaptureStepper.js`

Add these fields to `mergeBeforeFrameResults()`:

```js
dimmedBackdropRecorded: normalized.some(result => Boolean(result.dimmedBackdropRecorded)),
dimmedBackdropSnapshot: normalized.some(result => Boolean(result.dimmedBackdropSnapshot)),
dimmedBackdropSource: normalized.map(result => result.dimmedBackdropSource).find(Boolean) || null,
```

## Checks Without Browser

```bash
node --check code/content/FixedStickyNormalizer.js
node --check code/capture/ContentAgentClient.js
node --check code/capture/CaptureStepper.js
node project/tests/validate-extension.mjs
git diff --check
```
