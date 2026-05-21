# Product Task: Fast Warmup Bounce V1

## User Question

Is this present in GoFullPage?

When not to do visible warmup:

| Condition | Behavior |
|---|---|
| There is a blocking modal / overlay | Do not aggressively scroll the page underneath it |
| Capture is viewport-only | Warmup is not needed |
| Page is short | Warmup is not needed |
| User is already not at the top | Return to the user's original position |
| There is layout-shift risk | Use only a quick bounce, not long visible warmup |

## Answer About GoFullPage

GoFullPage has this only partially, not as an explicit product rule table.

The observed implementation is simpler: it builds planned capture positions, scrolls to the deepest planned position, immediately scrolls back to the top, waits briefly, and then starts the real capture.

In practical terms:

| Condition | GoFullPage behavior |
|---|---|
| Blocking modal / overlay | Partial. There is a special known lightbox-root path, but not a broad generic modal policy. |
| Capture is viewport-only | Yes by consequence. If there are no planned below-fold positions, there is no meaningful warmup movement. |
| Page is short | Yes by consequence. If max scroll position is near zero, the bounce is visually irrelevant. |
| User is already not at the top | Partial. Original scroll is remembered and restored at cleanup, but full-page capture itself starts from the top. |
| Layout-shift risk | Partial. It does not skip warmup up front; it checks height changes during capture and can add extra capture work. |

The important detail: GoFullPage does not appear to have separate "visible warmup" and "invisible warmup" modes. It uses one fast mechanical bounce. Sometimes the user sees it, sometimes the browser/site returns to the top before the intermediate scroll is painted.

## Goal

Add a fast lazy warmup path that wakes below-fold lazy content without making the page visibly jump in normal cases.

The beta goal is not perfect lazy loading. The goal is a simple, fast default that improves page readiness with low user-visible disruption.

## Proposed Behavior

Use `fastWarmupBounce` before capture when the page has meaningful below-fold planned positions.

Flow:

1. Store the original scroll position of the selected scroll target.
2. Temporarily force immediate scrolling:
   - `scroll-behavior: auto`
   - transitions/animations disabled only if already done by the normal prepare step.
3. Select the deepest planned capture position.
4. Scroll to that deepest position.
5. Immediately scroll back to the original position or to the capture start position.
6. Wait briefly after returning, not while at the bottom.
7. Start capture.
8. Restore any temporary styles during normal cleanup.

Core principle:

```text
Do not wait at maxScrollY.
Wait only after returning.
```

This gives the site a scroll signal for lazy content, but reduces the chance that the user sees the intermediate position.

## When To Skip

Skip `fastWarmupBounce` when:

- capture policy is viewport-only;
- there are no planned below-fold positions;
- max planned `scrollY` is too small to matter;
- a blocking first-viewport modal/overlay is being preserved as the honest capture state;
- the selected target is not scrollable;
- the page is already in an unstable/fallback mode where scrolling should be minimized.

## Minimal Technical Rule

```text
if capturePolicy is viewport-only:
  skip

if no planned positions below viewport:
  skip

maxScrollY = max(plannedPositions.scrollY)

if maxScrollY <= viewportHeight * 0.5:
  skip

force scroll-behavior: auto on scroll target
scroll target to maxScrollY
immediately scroll target back to original/start scroll
wait 60-150ms
continue capture
```

## Non-Goals

- No heavy DOM classifier for warmup.
- No per-industry modes.
- No long visible warmup in the first version.
- No new UI state unless later research shows users need it.
- No attempt to guarantee every lazy image is loaded before capture.

## Risks

| Risk | Mitigation |
|---|---|
| User still sees a jump on heavy sites | Keep the bounce immediate and show progress only if a slower fallback is later introduced. |
| Site changes layout after bounce | Reuse post-warmup measurement / diagnostics and mark unstable if height changes materially. |
| Modal state changes after scroll | Skip or limit warmup when a blocking first-viewport overlay is detected. |
| Internal scroll target behaves differently from window | Apply the same bounce only to the selected high-confidence target. |

## Success Criteria

- On normal long pages, below-fold lazy content has a better chance to be ready before capture.
- On fast/simple pages, the user usually does not see a visible jump.
- Short pages and viewport-only captures skip warmup.
- The implementation stays mechanical and fast.
- No new broad semantic classifier is introduced for this feature.

## Product Summary

GoFullPage's useful idea is not a complex lazy detector. It is a quick scroll bounce: touch the bottom, return immediately, then capture from the top. We should copy the simplicity, but make the guardrails explicit so the beta behavior is predictable.
