# Capture Risk Flags And Policies

This file is the source of truth for the engine-level `riskFlags` emitted by the capture pipeline and for the policy each flag activates. It intentionally separates runtime engine decisions from QA-only `deepQa.riskTags`.

## Why This Exists

The capture engine should be predictable: when a page has a popup, sticky chrome, an app shell, multiple scroll regions, or split-sensitive cards, we need to know which policy is active and where to inspect the diagnostics. New fixes should add or refine a reusable policy, fixture, or QA tag instead of becoming a hidden site-specific workaround.

## Engine Risk Flags

Engine `riskFlags` are cheap page-probe signals emitted by `code/capture/PageProbe.js` into CaptureDiagnostics v2 at:

```text
capture.scrollTarget.diagnostics.riskFlags
```

`PageProbe` also converts those flags into an explicit runtime `capturePolicy`, reported at:

```text
capture.page.capturePolicy
capture.scrollTarget.capturePolicy
capture.scrollTarget.diagnostics.capturePolicy
```

The policy is the contract consumed by `CaptureController`, `CaptureStepper`, `ContentAgent`, and `FixedStickyNormalizer`. A flag should not rely on hidden normalizer side effects; it should state whether frame 0 is preserved, whether lazy warmup is skipped before frame 0, and what changes are allowed on frames 1+.

Current flags:

| riskFlag | Trigger | Runtime policy | Primary coverage |
| --- | --- | --- | --- |
| `fixed_sticky` | A visible `position: fixed` or `position: sticky` candidate is found in the viewport. | Preserve frame 0 exactly. On frames 1+, normalize repeated chrome through `FixedStickyNormalizer`: convert fixed chrome to absolute, convert sticky chrome to relative, hide only overlays/widgets/side chrome that would repeat. | `visible-overlay-first-frame-page`, `cookie-strip-repeat-page`, `sticky-toc-repeat-page`, `rei-backpacks-product-grid-page`, `product-sticky-zone-page` |
| `visible_nav_overlay` | A visible nav, mega-menu, drawer, or large top navigation overlay is present at capture start. | Preserve first frame; do not aggressively suppress before frame 0. After frame 0, suppress or transform the overlay/nav chrome so it does not repeat in later stitched frames. | `apple-global-menu-first-frame-page`, `product-hero-duplication-page` |
| `blocking_modal` | `PageProbe.detectBlockingModal()` returns `captureAction: 'viewport-only'`, currently for high-confidence `scroll-lock` or `entry-gate-text` states. | Capture only the visible viewport. Do not hide the modal and scroll the background as if the user closed it. | LEGO/Nike real-site cases, blocking-popup Deep QA tags |
| `inaccessible_iframe` | One or more iframes cannot be inspected from the extension context. | Record diagnostics and continue normal capture. Treat as a review risk when the iframe affects visible content; do not attempt deep iframe capture in the beta engine. | `iframe-baseline-page` and real-site diagnostics |

## Blocking Modal Policy

`PageProbe.detectBlockingModal()` is the product gate for scroll-locking popups and entry gates.

- `reason: 'entry-gate-text'` -> `captureAction: 'viewport-only'`
- `reason: 'scroll-lock'` -> `captureAction: 'viewport-only'`
- `reason: 'large-dialog-uncertain'` -> `captureAction: 'continue'`
- `reason: 'none'` -> `captureAction: 'continue'`

Product rule: if the user is blocked on the first viewport, the extension must capture the blocked first viewport only. It must not pretend the user closed the popup. If the popup is large but does not clearly block user scroll, the engine continues capture and QA can classify the artifact as review/unstable if it repeats or hides content.

`PageProbe` must also skip internal scroll-container selection when `captureAction` is `viewport-only`, so a blocked page cannot become a long background capture through an internal container.

## Fixed And Sticky Policy

The current policy is frame-aware:

```text
frame 0:
  preserve user-visible state

frames 1+:
  dimmed backdrop state -> preserve
  fixed header/nav chrome -> absolute
  sticky header/nav/sidebar chrome -> relative
  cookie/chat/floating widgets -> hide
  open modal/dialog panels -> hide
  product/media content -> preserve
  footer navigation/content -> preserve
```

For `visible_nav_overlay`, the explicit policy is:

```text
preserveFirstFrame: true
skipLazyWarmupBeforeFirstFrame: true

firstFrame:
  preserveUserState: true
  normalizeFixedSticky: false
  suppressVisibleNavOverlay: false

afterFirstFrame:
  normalizeFixedSticky: true
  suppressVisibleNavOverlay: true
  suppressRepeatedOverlays: true
```

This protects Apple-style open global menus and similar large navigation overlays: the first captured viewport matches the user-visible state, but the menu/nav is not duplicated down the stitched output.

Important constraints:

- Do not hide all fixed/sticky nodes before the first frame.
- Do not use one global rule for Apple-style nav overlays and generic sticky sidebars.
- Do not suppress large product media blocks just because they are sticky.
- Do not remove a dimmed backdrop when the user can scroll the page while a popup is open; hide the popup panel after frame 0, but keep the page-darkening state across later frames. If the backdrop lives inside a vendor consent root such as OneTrust, preserve that root container too, otherwise broad cookie suppression can hide the backdrop by hiding its parent. If the site removes the original backdrop during scripted scroll, synthesize an equivalent fixed dim layer for frames 1+ so the stitched output still matches the user-visible open-popup state.
- Always restore DOM mutations through `DomMutationStack` after capture.

## Width Policy

For normal window captures, `PageProbe` clamps capture width to the visible viewport:

```text
rawPageWidth = max(body.scrollWidth, documentElement.scrollWidth)
pageWidth = viewportWidth
widthClampedToViewport = rawPageWidth > viewportWidth + 2
```

This avoids Microsoft-style over-wide/right-side blank output. If a page is truly an app shell with horizontal workspace content, that should be handled through the app-shell/internal-scroll policy, not by widening every normal page.

## Scroll Target Policy

The engine captures the window by default. It selects one internal scroll container only when all of these are true:

- no `viewport-only` blocking modal;
- window scroll height is less than `viewportHeight * 0.75`;
- a large central scrollable candidate exists;
- there is no close second candidate;
- the candidate is not likely a side panel or sparse editor/canvas workspace.

When selected, diagnostics report:

```text
scrollTarget.type = 'element'
scrollTarget.composeMode = 'app-shell'
```

This policy is for app-shell/editor-style pages. Docs pages with sidebars should usually keep the main article as the content target and avoid repeating/capturing sidebar scroll fragments.

## Split Boundary Policy

`PageProbe` emits `splitCandidates` and `splitExclusionRanges` for text blocks, cards, product tiles, carousel modules, headings, and section-like containers. `PositionPlanner`, `CanvasStitcher`, `CanvasTiler`, and `CanvasSizeGuard` should avoid placing viewport seams or multi-part output boundaries inside these ranges when possible.

Key reasons:

- `split-sensitive-block`: cards, product tiles, list items, figures, articles, and similar blocks.
- `header-gallery-module`: Apple-style heading plus carousel/card/gallery sections.

This is the policy that protects Apple heading/subtitle sections, Samsung/Patagonia/REI product cards, MDN text rows, and MongoDB card modules from being cut by seams.

## Readiness And Lazy Media Policy

The engine uses `ContentAgent`, `ImageReadinessProbe`, and `LazyLoadWarmer` to reduce missing images and blank lazy sections without adding user-visible retries:

- collect readiness before warmup;
- warm planned scroll positions;
- re-measure page after warmup;
- collect readiness after warmup and per frame;
- report `imageReadinessSummary` in CaptureDiagnostics v2.

Current beta direction: no automatic limited retry for the user by default. Missing-content cases should first be covered by fixtures, cheap readiness checks, and Deep QA detectors.

## Output Strategy Policy

`CanvasSizeGuard` chooses output strategy:

- `single-canvas` when browser canvas limits are safe;
- `tiled-output` when the page is too tall for one safe canvas but can be split;
- hard failure when output is too wide, too large, or would require too many image parts.

When `tiled-output` is used, tile boundaries must consult `splitExclusionRanges`. The user may receive multiple PNG files, but each part should avoid cutting cards/text/modules when safe boundaries exist.

## QA Risk Tags Are Different

`deepQa.riskTags` live in `project/tests/real-sites.json`. They are not runtime engine flags. They guide the real-site runner and offline PNG QA to apply detector-only checks to known manual regression classes.

Current QA tags include:

```text
app-shell-readiness
black-strip
blocking-popup
docs-sidebar-main-scroll
missing-content
product-filter-panel
product-sticky
product-sticky-anti-regression
repeated-overlay
repeated-sidebar
right-blank-strip
seam-band
split-boundary-text
wide-output
```

Use `deepQa.riskTags` when the issue is a QA classification or visual detector concern. Add or change an engine `riskFlag` only when the extension runtime itself needs to choose a different capture policy.

## When To Add Something New

Add a new engine `riskFlag` when:

- the page probe can detect the condition cheaply before capture;
- the capture pipeline needs a different behavior, not only a different QA label;
- diagnostics must explain why the engine chose that behavior.

Add a new `deepQa.riskTag` when:

- a known real-site class needs detector-only review;
- no runtime behavior should change yet;
- the goal is to reduce manual review noise or gate beta risk.

Add a fixture when:

- a manual bug should never regress silently;
- the bug class can be reproduced without the live site;
- the fix touches shared capture behavior.

Add a golden baseline when:

- the site is one of the 10-20 highest-risk regression controls;
- the bug is too visual or site-specific for a small fixture alone;
- the baseline is used for Look-first/Unstable review or closing a manual regression, not for every user capture.
