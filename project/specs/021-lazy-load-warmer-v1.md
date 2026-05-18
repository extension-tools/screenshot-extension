# 021: Lazy Load Warmer V1

## Product Task

- `../product-tasks/021-lazy-load-warmer-v1.md`

## Goal

Add a bounded pre-capture scroll warmup stage to trigger lazy and scroll-driven content before the first real screenshot frame.

## Requirements

- Add `code/capture/LazyLoadWarmer.js`.
- Load it from `code/worker.js`.
- Wire it into `CaptureController` after `PositionPlanner.createPlan(page)` and before `CanvasStitcher`/`CaptureStepper`.
- Run only when the capture plan has more than one position.
- Use planned positions as the warmup route.
- Include the current viewport in the warmup route before scrolling away.
- Keep warmup inside measured page bounds.
- Restore original page scroll before real capture.
- Remeasure the page or internal scroll target after warmup.
- Rebuild the capture plan from post-warmup dimensions before creating the output canvas.
- Use a 3.5 second hard limit.
- Use short per-step waits and bounded layout stabilization.
- Do not intentionally expand infinite-scroll feeds.

## Runtime Defaults

```js
{
  lazyWarmupEnabled: true,
  lazyWarmupTimeout: 3500,
  lazyWarmupStepDelay: 100,
  lazyWarmupStabilizationTimeout: 500
}
```

## Pipeline Position

```text
CaptureController
  -> CapabilityGuard
  -> PageProbe.measure()
  -> CanvasSizeGuard
  -> ContentAgent.prepare()
  -> PositionPlanner.createPlan()
  -> LazyLoadWarmer.warm()
  -> PageProbe.measure()
  -> PositionPlanner.createPlan()
  -> CanvasStitcher
  -> CaptureStepper
  -> CaptureStore
```

## Fixture

The fixture lives at:

```text
project/tests/fixtures/lazy-load-page.html
```

It contains a marker near the top that stays gray until the page has been scrolled below the first viewport. Without warmup, the first captured tile would see the gray placeholder. With warmup, the marker turns green before real capture begins.

## Case Definition

The case is registered in `project/tests/capture-flow.mjs`:

```js
{
  name: 'lazy-load-page',
  path: '/lazy-load-page.html',
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
PNG 1365x2474
below-fold triggered lazy marker pixels: 120976
```

## Known Limits

- Warmup does not intentionally expand infinite scroll.
- Post-warmup remeasure includes bounded lazy/layout growth triggered during warmup.
- Warmup does not guarantee every lazy network resource is fully loaded.
- There is no separate user-facing warmup UI beyond the toolbar badge.
