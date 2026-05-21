# Capture Risk Flags And Policies

This file is the source of truth for the engine-level `riskFlags` emitted by the capture pipeline and for the policy each flag activates. It intentionally separates runtime engine decisions from QA-only `deepQa.riskTags` and diagnostic-only page observations.

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
| `fixed_sticky` | A visible `position: fixed` or `position: sticky` candidate is found in the viewport. | Fixed chrome remains frame-aware: preserve frame 0, then convert repeated fixed chrome to absolute on frames 1+. Hide only overlays/widgets/side chrome that would repeat. Sticky chrome is handled by the full-page policy below, not by this first-viewport flag alone. | `visible-overlay-first-frame-page`, `cookie-strip-repeat-page`, `sticky-toc-repeat-page`, `rei-backpacks-product-grid-page`, `product-sticky-zone-page` |
| `blocking_modal` | `PageProbe.detectBlockingModal()` returns `captureAction: 'viewport-only'` for a modal/dialog candidate with technical scroll lock. Entry-gate text is diagnostic only and is not enough by itself. | Capture only the visible viewport. Do not hide the modal and scroll the background as if the user closed it. | Bootstrap Modal scroll-lock proof, LEGO/Nike blocking-popup regression controls |
| `inaccessible_iframe` | One or more iframes cannot be inspected from the extension context. | Record diagnostics and continue normal capture. Treat as a review risk when the iframe affects visible content; do not attempt deep iframe capture in the beta engine. | `iframe-baseline-page` and real-site diagnostics |

## Diagnostic-Only Overlay Candidates

`visible_overlay_candidate` is an observation, not a runtime capture-policy flag.

`PageProbe` records visible overlay candidates in diagnostics:

```text
capture.scrollTarget.diagnostics.visibleOverlayCandidateCount
capture.scrollTarget.diagnostics.visibleOverlayCandidates
```

The candidate signal helps QA explain open nav, drawer, mega-menu, or large overlay states, but it must not skip lazy warmup, change first-frame policy, or activate special runtime suppression by itself.

Product rule:

- a normal site header is `fixed_sticky` chrome, not an overlay;
- an open menu, drawer, mega-menu, or dialog can be recorded as `visible_overlay_candidate`;
- actual capture behavior should still be driven by stronger primitives: `fixed_sticky`, `blocking_modal`, split-boundary ranges, readiness checks, and normalizer geometry.

## Blocking Modal Policy

`PageProbe.detectBlockingModal()` is the product gate for popups that actually block normal page scrolling.

- `reason: 'scroll-lock'` -> `captureAction: 'viewport-only'`
- `reason: 'large-dialog-uncertain'` -> `captureAction: 'continue'`
- `reason: 'none'` -> `captureAction: 'continue'`

Product rule: if the page itself prevents normal scrolling while a modal/dialog is visible, the extension must capture the blocked first viewport only. It must not pretend the user closed the popup. Entry-gate wording such as country, continue, cookie, or age-gate text is retained in diagnostics as `hasEntryGate` and `entryGateBlocking`, but it does not force `viewport-only` without a technical scroll-lock source. If the popup is large but does not clearly block user scroll, the engine continues capture and QA can classify the artifact as review/unstable if it repeats or hides content.

`PageProbe` must also skip internal scroll-container selection when `captureAction` is `viewport-only`, so a blocked page cannot become a long background capture through an internal container.

### Runtime Scroll Probe Status

The engine may run a short runtime scroll probe when a large fixed/sticky overlay covers the first viewport, the page is long, and technical scroll lock is not proven. This probe is intentionally mechanical: it checks whether programmatic scroll moves before capture strategy/stitching is chosen.

2026-05-21 browser-backed result: this is not enough to close LEGO/Nike-style user-blocking overlays. Samsung correctly stayed full-page, but LEGO and Nike still continued full-page because programmatic scroll can move behind a visually blocking modal. Deeper user-scroll/pointer-blocking detection is backlog and should not be expanded in the current release slice.

Decision sites:

- Samsung Galaxy S: https://www.samsung.com/us/smartphones/galaxy-s/
- LEGO Millennium Falcon: https://www.lego.com/en-us/product/millennium-falcon-75192
- Nike Air Force 1: https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111
- Dyson Vacuums: https://www.dyson.com/vacuum-cleaners

## Fixed And Sticky Policy

The current policy is frame-aware for `fixed` elements and blanket-normalizes reachable `sticky` elements after warmup and final page measurement, before capture starts:

```text
measure 1:
  page geometry and initial capturePolicy

prepare basic:
  fixed chrome/content -> unchanged
  stability CSS, scrollbar normalization, transitions, fixed-background quirks

warmup:
  lazy content preparation unless capturePolicy skips it

measure 2 / plan:
  final page geometry and capture plan

sticky normalization:
  sticky chrome/content reachable through normal DOM or open Shadow DOM -> relative

frames 1+:
  dimmed backdrop state -> deferred/proposed; do not change until diagnostics exist
  fixed top header/nav chrome -> hide
  other fixed chrome/content -> absolute unless protected
  sticky no longer needs classifier decisions because it was already moved into normal flow
  cookie/chat/floating widgets -> hide
  open modal/dialog panels -> hide
  product/media content -> preserve
  footer navigation/content -> preserve
```

Sticky normalization is now the default full-page policy, not an opt-in flag. Full-page captures convert reachable `position: sticky` elements to normal flow after warmup and final measure/plan; `viewport-only` blocking-modal captures skip sticky normalization. This policy must not depend on `fixed_sticky` being visible in the first viewport, because sticky elements can appear lower on the page or inside open Shadow DOM. `late-sticky-below-first-viewport-page` is the controlled regression fixture for this rule. While this policy is active, frame 0 is no longer pixel-exact for sticky positioning; the product rule becomes content preservation with sticky chrome normalized. Sticky elements that appear only after scrolling to a later frame are outside the current step and should be handled by a future per-frame rescan only if needed.

Fixed top headers are a separate small path inside `FixedStickyNormalizer`: after frame 0, a `position: fixed` element near the top edge, wide enough to be site chrome, and short/compact enough not to be a fullscreen overlay is hidden instead of converted to absolute. The current geometry is intentionally narrow: `rect.top < 22`, `rect.width >= viewportWidth * 0.55`, `rect.height < viewportHeight - rect.top - 22`, and `rect.height <= min(220, viewportHeight * 0.32)`. This preserves the user-visible first frame while preventing repeated top navigation bars in the final PNG. The fallback `fixed-to-absolute` path remains for other fixed elements. Controlled fixtures: `fixed-top-header-page` and `fixed-top-small-button-page`.

Open Apple-style global menus and similar large navigation panels are protected by the same fixed/sticky policy: sticky parts are normalized after warmup/final measure, while fixed parts preserve frame 0 and normalize repeated chrome through geometry on frames 1+. The diagnostic `visible_overlay_candidate` can explain why the page is visually risky, but it does not disable lazy warmup or create a separate runtime mode.

Sticky normalization must also be auditable and reversible. Runtime diagnostics should expose only compact aggregate data: whether sticky normalization applied, how many sticky elements were normalized, how many frames contained normalized sticky nodes, how many open Shadow DOM roots were touched, and the reason bucket. Cleanup diagnostics should report temporary sticky markers and normalization style rules before and after restore. The no-browser smoke `project/tests/sticky-cleanup-smoke.mjs` is the acceptance check that `data-screenshot-extension-sticky-normalized`, injected CSS rules, and inline style overrides are removed or restored after `DomMutationStack.restoreAll()`.

### Runtime Repeated Chrome Diagnostics

`FixedStickyNormalizer` also emits passive per-frame `chromeCandidates` diagnostics for likely repeated page chrome:

```text
diagnostics.stepper.frames[].beforeFrame.chromeCandidates
diagnostics.stepper.repeatedChrome
diagnostics.repeatedChromeSummary
```

This is a detector layer, not a capture-policy layer. It records signatures for top headers, sidebars, filter panels, cookie strips, and floating widgets, then `CaptureStepper` reports signatures that appear in frame 0 and later frames, or across multiple frames after frame 0. The first implementation must not change DOM behavior or add retries; it exists so QA and real-site reports can explain bugs such as `repeated-sticky-chrome`, `repeated-sidebar`, `repeated-cookie-strip`, and `repeated-floating-widget` before we decide whether a normalizer rule is needed.

Important constraints:

- Do not hide all fixed/sticky nodes before the first frame. The sticky experiment converts sticky nodes to `relative`; it must not hide them.
- Do not treat a normal fixed/sticky header as an overlay.
- Do not use one global overlay rule for Apple-style nav panels, generic headers, and sticky sidebars.
- Do not suppress large product media blocks just because they are sticky.
- Dimmed backdrop continuity is deferred until diagnostics prove the cause. First add measured page height before capture, page height during/after capture, and planned `scrollY` vs actual `scrollY` per frame; if deviation exceeds threshold, mark the capture as `layout_unstable`. Do not change fixed header behavior. Do not change overlay policy in the same diff. Possible later rule: if the page truly scrolls while a popup is open, full-page capture is OK, but the dim backdrop should persist on every frame.
- Always restore DOM mutations through `DomMutationStack` after capture.

## QuirksLayer

`QuirksLayer` is a small exception layer above the general capture logic. It is not a product mode, not an industry mode, and not a replacement for `PageProbe`, `FixedStickyNormalizer`, or split-boundary planning.

Current hooks:

```text
quirks.beforeMeasure(page)
quirks.afterWarmup(page)
quirks.cleanup(page)
```

Current quirks:

| quirk | Trigger | Runtime effect | Why it is a quirk |
| --- | --- | --- | --- |
| `preserve-fixed-background` | A viewport-fixed or `background-attachment: fixed` design background is visible and looks passive, non-interactive, and non-modal. | `QuirksLayer` marks only the matching elements with `data-screenshot-extension-quirk-fixed-background="preserve-fixed-background"` and sets `capturePolicy.quirks.preserveFixedBackground = true`; `ContentAgent` excludes only marked elements from `background-attachment: scroll`; `FixedStickyNormalizer` preserves only marked elements. | It changes one concrete thing on specific DOM nodes instead of making fixed-background preservation page-wide. |
| `known-lightbox-root` | The known selector `#lightbox-wrap` is visible, `position: fixed`, `z-index >= 1000`, and covers the viewport within 2px on every edge. | The marked lightbox becomes the capture root with `scrollTarget.composeMode = 'lightbox-root'`; the page underneath is not captured as the root; `FixedStickyNormalizer` must preserve the selected root on frames 1+. | It handles one concrete capture-root mismatch without guessing from broad fullscreen/menu/gallery semantics. |

Quirk rules:

- keep each quirk small and reversible;
- record applied quirks in diagnostics;
- clean marker attributes after capture;
- preserve only marked fixed-background candidates; do not make `preserveFixedBackground` a page-wide normalizer bypass;
- do not add Apple/ecommerce/docs modes here;
- do not infer `known-lightbox-root` from `[class*="fullscreen"]`, nav menus, drawers, cookies, sign-in, age gates, or generic modal semantics;
- do not let quirks rewrite the whole pipeline.

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
- window scroll height is less than or equal to `max(40px, viewportHeight * 0.05)`;
- a large central scrollable candidate exists:
  - `width >= viewportWidth * 0.65`;
  - `height >= viewportHeight * 0.55`;
  - `visibleArea >= viewportArea * 0.50`;
- there is no close second candidate;
- the candidate is not edge-anchored and narrow.

The runtime decision deliberately does not use sidebar/nav/menu descriptor semantics. If a regular page can scroll more than `max(40px, 5vh)`, use window scroll. Internal scroll is reserved for high-confidence app-shell style pages where the browser window barely scrolls and one obvious large scroll container dominates the viewport.

When selected, diagnostics report:

```text
scrollTarget.type = 'element'
scrollTarget.composeMode = 'app-shell'
scrollTarget.diagnostics.windowScrollHeight
scrollTarget.diagnostics.windowScrollThreshold
scrollTarget.diagnostics.selectedScrollCandidate
scrollTarget.diagnostics.internalScrollCandidates[]
```

Scroll candidate diagnostics must stay compact. Keep only the fields needed to explain vertical scroll-container choices: `descriptor`, `rect`, `position`, `scrollHeight`, `clientHeight`, `scrollableY`, `hasFixedAncestor`, and `hasStickyAncestor`. Do not record full selectors or full ancestor chains; those are noisy and too site-specific for the beta decision loop.

This policy is for app-shell/editor-style pages. Docs and product pages with normal window scroll should stay on the window target, even when sidebars, filters, or tables also expose internal scrollbars.

## Split Boundary Policy

`PageProbe` emits `splitCandidates` and `splitExclusionRanges` for text blocks, cards, product tiles, carousel modules, headings, and section-like containers. `PositionPlanner`, `CanvasStitcher`, `CanvasTiler`, and `CanvasSizeGuard` should avoid placing viewport seams or multi-part output boundaries inside these ranges when possible.

Key reasons:

- `split-sensitive-block`: cards, product tiles, list items, figures, articles, and similar blocks.
- `header-gallery-module`: Apple-style heading plus carousel/card/gallery sections.

This is the policy that protects Apple heading/subtitle sections, Samsung/Patagonia/REI product cards, MDN text rows, and MongoDB card modules from being cut by seams.

Diagnostics expose a compact `splitExclusionSummary`: total protected range count, counts by reason, max protected height, total protected height, and a small range sample. This is the 100-site measurement layer for choosing product-card and docs-card split-boundary fixes without logging DOM selectors or full element metadata.

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

Multi-part PNG export must observe the Chrome download lifecycle for each part. `CaptureStore` records `downloadId`, filename, `startedAt`, `acceptedAt`, `completedAt`, and `waitStatus`; for tiled output it waits for `chrome.downloads.onChanged` to report `complete` before starting the next part or reporting the export as `saved`. A gray-looking PNG in Finder during export should be treated as an incomplete in-progress download, not as a hidden file, quarantine flag, or capture-output defect. This keeps part ordering and Finder-visible state diagnosable without changing the capture pipeline.

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
