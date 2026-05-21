# Current Context

Use this file first when restoring context for Screenshot Extension work. It is intentionally short. For details, follow the source-of-truth links at the bottom instead of expanding this file.

## Product Goal

Screenshot Extension is a Chrome MV3 extension for one-click full-page capture from real websites. Decision update on 2026-05-20: PDF export and user communication are Must product work on top of PNG correctness.

## Development Principle

- Prefer simple, mechanical, understandable capture logic over complex generalized systems.
- Keep screenshots fast on simple and medium pages.
- On difficult pages, prioritize quality and stability without adding combinatorial rules or site-mode complexity.

## Current Scope

- Chrome-only MV3 extension in `code/`.
- Main command: `Capture Entire Page`.
- PNG downloads through Chrome downloads; multi-part PNG output for very tall pages.
- Full-page capture by viewport stepping and canvas stitching.
- Lazy warmup, per-frame image readiness waits, original scroll restoration.
- Fixed/sticky policy: `fixed` remains frame-aware; reachable `position: sticky` nodes are moved to normal flow after warmup and final measure/plan.
- Explicit `capturePolicy` derives from engine `riskFlags`: `fixed_sticky`, `blocking_modal`, `inaccessible_iframe`.
- Runtime policy source of truth: `project/docs/capture-risk-policy.md`.
- One high-confidence internal scroll container only, and only when window scroll is not meaningful.
- Small `QuirksLayer` hooks exist only for narrow reversible exceptions: passive fixed design backgrounds and known `#lightbox-wrap` fullscreen lightbox roots.

## Product Rules

- Visible overlays present at capture start should appear in the first viewport only and must not repeat down the page.
- Blocking popups that technically prevent normal scrolling are captured as the user-visible first viewport only.
- Entry-gate text alone is diagnostic, not a hard stop. Without scroll lock, continue full-page and route uncertain large-dialog states to review.
- Large fixed/sticky overlays without proven scroll lock use a runtime scroll probe, but this does not close user-blocking overlays when programmatic scroll still moves the page. That deeper user-scroll/pointer-blocking class is backlog, not current release focus.
- Large popups that do not clearly block scrolling should not automatically stop capture.
- Routine successful real-site captures are `PASS_AUTO`; complex but readable captures are `SAMPLE REVIEW`; quality-risk captures are `UNSTABLE SITE`.
- Login, bot, consent, and access walls are `BLOCKED LOGIN` or `BLOCKED ACCESS`, not engine failures.
- Empty/blank output, right-side blank/gray strips, first-viewport mismatch, and over-wide output are `FAIL`.

## Current Product Priorities

| User problem | Technical problem | Example sites | Priority |
| --- | --- | --- | --- |
| Text/cards are cut inside a screenshot. | Split-boundary / seam placement across text, docs cards, product cards, or product-grid rows. | FastAPI, MongoDB, Patagonia, Nordstrom, Samsung, REI, Target, Walmart. | Must |
| Product cards are cut between PNG parts. | Tiled-output boundary lands inside product card/grid row. | REI, Target, Walmart. | Must |
| User does not understand capture progress/result. | Capture progress, notification, completion feedback. | Product/UI. | Must |
| User needs PDF export. | PDF export pipeline, page sizing, output fidelity. | Export. | Must |
| Popup duplicates in capture. | Repeated popup/modal overlay normalization. | Patagonia. | Nice to have |
| First viewport is dimmed, but later frames become light/white while a popup is active. | Dimmed backdrop continuity / modal overlay state mismatch. | Samsung. | Nice to have |
| Footer is missing from the final capture. | Bounded tail growth guard after stale scroll plan / page-height measurement: reread `scrollHeight/maxY` after the last planned frame and capture a limited tail if the page grew. | Patagonia, REI. | Nice to have |
| Beautiful page splitting. | Do not cut text lines; do not cut cards; do not cut tables through the middle of a row; do not duplicate sticky header; do not leave huge empty fields; do not make pages with different logic. | Product-wide. | Nice to have |
| White empty zones or rich-media sections do not load. | Image readiness, layout settle, rich-media section readiness. | Sony WH-1000XM5. | Could |
| App shell / SPA captures as blank. | App-shell loaded-state / readiness guard. | Mermaid Live Editor. | Could |
| Lazy shift during card cutting. | Page stability before planning and during capture; not split-boundary logic. | Patagonia, Samsung. | Could |
| Full site is captured even though only the first viewport should be captured. | LEGO/Nike remain backlog because programmatic scroll can move behind a visually blocking overlay; deeper user-scroll / pointer-blocking overlay detection is not current release work. | LEGO, Nike. | Could |
| Product detail page screen splits apart. | Недостаточность правило скролл-таргет. | DJI Mini 4 Pro. | Could |

## Parked / Deferred

| Case | Status |
| --- | --- |
| Stripe cookie strip repeat | Done; keep as regression control. |
| Dyson/Samsung repeated fixed top nav | Done/parked; keep as regression control. |

## Current Risk Pack

- Must split-boundary: FastAPI, MongoDB, Patagonia, Nordstrom, Samsung, REI, Target, Walmart.
- Must tiled-output product-card boundaries: REI, Target, Walmart.
- Regression controls: Stripe, Dyson, LEGO, Nike, Next.js, Laravel, TypeScript Handbook, Prisma.
- Could product split layout: DJI Mini 4 Pro.
- Could rich-media/readiness: Sony WH-1000XM5, Apple iPhone, Apple MacBook Air.

## Current Engineering State

- QA runner guards: blank/low-entropy, app-shell loaded state, width/right-side sanity, first-viewport similarity, blocking-modal state, unexpected short page risk, dimmed backdrop continuity, Deep QA detector hints.
- Blocking modal policy: `scroll-lock` is the hard `viewport-only` path; `entryGate` remains diagnostic unless it coincides with scroll lock.
- Sticky simplification: blanket `sticky -> relative` after warmup/final measure/plan, restored through `DomMutationStack`; fixed elements still use frame-aware handling.
- `runtime repeated-chrome diagnostics` exist in `CaptureStepper`/`FixedStickyNormalizer`; detector-only unless an explicit normalizer rule handles the class.
- Offline PNG QA includes repeated sticky/header/sidebar chrome inside a single tall PNG.
- Internal scroll target policy is window-first: if `windowScrollableY > max(40px, 5vh)`, use window. Internal target only when window barely scrolls and one large central target passes strict geometry with no close second candidate.
- Multi-part PNG export records Chrome download lifecycle per part: `downloadId`, filename, timestamps, and `waitStatus`.

## Latest Verification Snapshot

- StrategyDesk status on 2026-05-21: runtime scroll probe is parked in backlog. It correctly avoids a false `viewport-only` on Samsung-like pages, but it does not close LEGO/Nike blocking overlays because programmatic scroll can move the page behind the modal. Focus shifts back to current Must work: split-boundary/card seams, tiled-output card boundaries, capture communication, and PDF export.
  - Samsung Galaxy S: https://www.samsung.com/us/smartphones/galaxy-s/
  - LEGO Millennium Falcon: https://www.lego.com/en-us/product/millennium-falcon-75192
  - Nike Air Force 1: https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111
  - Dyson Vacuums: https://www.dyson.com/vacuum-cleaners
- Latest 100-site detector-only run: 0 `FAIL`; 41 `PASS_AUTO`, 26 `UNSTABLE SITE`, 28 `SAMPLE REVIEW`, 5 `BLOCKED ACCESS`.
- Entry-gate/scroll-lock fix:
  - Samsung now captures full-page; remaining issue is dimmed backdrop continuity.
  - Bootstrap Modal proves real scroll-lock still produces `viewport-only`.
  - MDN/Next.js prove long pages continue full-page when there is no scroll lock.
- Controlled fixtures for basic long page, visible overlay, shipping popup repeat, dimmed popup scroll state, and fullscreen menu non-lightbox passed after the entry-gate change.

## Source Of Truth Files

- `project/docs/capture-risk-policy.md`: runtime engine policies and `riskFlags`.
- `project/tests/qa-runbook.md`: QA commands, publishing, statuses.
- `project/tests/real-site-findings.md`: durable real-site conclusions and compressed historical QA log.
- `project/docs/beta-stability.md`: release gate criteria.
- `project/docs/beta-notes.md`: known limitations, deferred cases, accepted tradeoffs.
- `project/tests/test-plan.md`: verification strategy and coverage intent.
- `project/tests/real-sites.json`: real-site QA target DB. Do not compress.
- `project/docs/product.md`: product direction and constraints.

## Token Budget Rule

For a fresh chat, read this file plus `project/tests/qa-runbook.md` for QA/run/publishing work. If the task touches capture decisions, read `project/docs/capture-risk-policy.md` next. Then open only the file related to the current task. Avoid loading all specs, all product tasks, or the full historical QA log unless the user asks for history.
