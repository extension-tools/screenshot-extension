# Roadmap

## Phase 1: Runnable MVP

- Chrome MV3 only.
- One capture command.
- Remove non-Chrome branches.
- Remove external editor integration.
- Validate manifest and JavaScript syntax.
- Load unpacked in Chrome.
- Start capture from a toolbar popup with explicit PDF/PNG format choice.
- Capture and download full-page screenshots on basic websites.

## Phase 2: Capture Reliability

- Modular capture architecture.
- Content agent and mutation stack.
- Fixed/sticky normalizer v1.
- Root scrollbar normalizer v1.
- Main internal scroll-container scrollbar normalizer v1.
- One main internal scroll-container capture v1.
- Stabilization wait v1.
- Lazy-load warmup v1.
- Canvas size guard v1.
- Better restricted-page errors.
- Original scroll restoration on all failure paths.
- Fixed and sticky element normalization.
- Horizontal scroll coverage.

## Phase 3: Advanced Page Coverage

- Multiple/custom scroll-container support.
- Large-page canvas tiling.
- Cross-origin iframe behavior definition.
- File URL optional permission model.
- Better capture progress and cancellation.
- Seam placement that avoids cutting text, docs cards, product cards, and product-grid rows.
- Tiled-output boundaries that keep product cards intact across PNG part 01 / part 02.

## Phase 4: Test Automation

- Expand visual regression site list.
- Add extension capture-flow automation.
- Compare final downloaded screenshots.
- Add failure artifacts for each capture run.
- Add release checklist gates.
- Add diagnostics for page height before/during/after capture and planned-vs-actual `scrollY` per frame.

## Phase 5: Product Hardening

- Options cleanup.
- Filename templates.
- Format and quality settings.
- Clear user-facing errors.
- Clear capture progress, completion feedback, and user-facing status.
- PDF export built on the same capture tiles/bitmaps and diagnostics.
- Chrome Web Store packaging preparation.

## Speed Roadmap: 19s -> 14s Average

Goal: make Screenshot Extension finish PNG full-page capture in **14s average** on the existing competitor benchmark set while keeping excellent visual quality.

Benchmark status is already known and does not need a separate discovery phase:

| Extension | Current average | OK | Failed | Endpoint |
| --- | ---: | ---: | ---: | --- |
| Screenshot Extension | 19s | 87 | 13 | PNG download |
| GoFullPage | 17s | 93 | 7 | result page `capture.html` |
| FireShot | 19s | 97 | 3 | result page `fsCaptured.html` |
| Easy Screenshot | 15s | 87 | 13 | PNG download |

Target: **14s average** with quality staying closer to FireShot/GoFullPage than to a brittle fast path.

| Stage | Work | Expected speed gain | Expected average after stage | Quality rule |
| --- | --- | ---: | ---: | --- |
| 1 | Replace long lazy warmup default with fast warmup bounce: scroll to deepest planned position, immediately restore, wait briefly only after restore. Keep skip guards for viewport-only, short pages, blocking modals, and unstable pages. | 1.8-2.4s | 16.6-17.2s | Do not remove lazy protection; make the normal path faster and keep slow fallback for risky pages. |
| 2 | Make per-frame waits adaptive: reduce fixed `delay`, first-frame settle, stabilization, and image-readiness waits when the current viewport is already stable and images are ready. | 1.2-1.8s | 14.8-16.0s | Never skip waits when pending images, placeholder blocks, scroll mismatch, modal risk, or layout movement is detected. |
| 3 | Reduce duplicate pre-capture work: avoid redundant page probes / image-readiness collection when warmup was skipped or produced no page growth; reuse measured state where safe. | 0.5-0.8s | 14.0-15.5s | Re-probe remains mandatory after actual warmup, internal scroll target changes, or risk-policy changes. |
| 4 | Speed up output/export path: avoid unnecessary download-completion blocking in the user-visible success path, and keep completion lifecycle in diagnostics. | 0.3-0.6s | 13.7-15.2s | User must still get a real PNG download, not only an opened result page. |
| 5 | Tune thresholds against the existing benchmark and lock defaults: set production defaults for 14s target, keep quality fallback for hard pages, then update regression fixtures. | 0.2-0.5s | 13.2-14.8s | If a site needs more time to avoid a bad screenshot, quality wins over forcing 14s on that single case. |

Recommended implementation order:

1. Ship Stage 1 first because it removes the largest obvious fixed cost.
2. Ship Stage 2 next because current capture cost scales with every frame.
3. Ship Stages 3-4 only after timing diagnostics confirm where the remaining seconds are.
4. Use Stage 5 to freeze defaults and prevent future quality regressions.

Success bar:

| Metric | Required result |
| --- | --- |
| Average time | 14s target on the existing benchmark set |
| Endpoint | PNG download stays the product endpoint |
| OK / Failed | Must not get worse than current 87 / 13; preferred target is 93+ OK |
| Quality | No new obvious blank areas, repeated sticky chrome, missing footer, or broken first viewport |

## Current Prioritized Capture Backlog

| Priority | User-visible problem | Technical area | Control sites / examples |
| --- | --- | --- | --- |
| Must after release | Screenshot Extension is slower than the product target. | [Speed roadmap](../product-tasks/034-speed-to-14s.md): fast warmup bounce, adaptive per-frame waits, reduced duplicate probes, and faster export completion. Target average: 19s -> 14s. | Existing competitor benchmark set |
| Must | Text, docs cards, product cards, or product-grid rows are cut inside the screenshot. | Split-boundary / seam placement; protect text blocks, docs-card blocks, product-card blocks, and product-grid rows. | FastAPI Docs, MongoDB Docs, Patagonia Jackets, Nordstrom Shoes, Samsung Galaxy S, REI Backpacks, Target Backpacks, Walmart Laptops |
| Must | Product cards are cut between multi-part PNG files. | Tiled-output boundary; part 01 / part 02 boundary must avoid product card and product-grid row interiors. | REI Backpacks, Target Backpacks, Walmart Laptops |
| Must | User does not understand whether capture is running, done, or saved. | Capture progress, user notification, completion feedback state. | Product-wide |
| Must | User needs PDF export. | PDF export pipeline, page sizing, output fidelity; reuse captured tiles/bitmaps and diagnostics. | Product-wide |
| Nice to have | Popup/modal repeats down the stitched page. | Repeated popup / modal overlay normalization. | Patagonia Jackets |
| Nice to have | First viewport is dimmed, but later frames become light/white while a popup state is still visually active. | Dimmed backdrop continuity / modal overlay state mismatch. | Samsung Galaxy S |
| Nice to have | Footer is missing from the final capture. | Scroll plan / page-height measurement became stale after lazy/dynamic loading. This is not split/tiling and not card cutting. Add a bounded tail growth guard: after the last planned frame, reread `scrollHeight/maxY`; if the page grew meaningfully, capture the tail with a small frame limit. | Patagonia Jackets, REI Backpacks |
| Nice to have | Beautiful page splitting. | Do not cut text lines; do not cut cards; do not cut tables through the middle of a row; do not duplicate sticky header; do not leave huge empty fields; do not make pages with different logic. | Product-wide |
| Could | White empty zones or rich-media sections do not load. | Image readiness, layout settle, rich-media section readiness. | Sony WH-1000XM5 |
| Could | App shell / SPA captures as blank or white startup state. | App-shell loaded-state / readiness guard. | Mermaid Live Editor |
| Could | Lazy shift during card cutting. | Lazy shifts that look like card cutting are treated as page stability before planning and during capture, not as split-boundary logic. | Patagonia Jackets, Samsung Galaxy S |
| Could | Full site is captured even though the user-visible state should only be the first viewport. | This does not close LEGO/Nike because programmatic scroll can move the page behind a visually blocking overlay. Further user-scroll / pointer-blocking overlay detection stays in backlog. | LEGO Millennium Falcon, Nike Air Force 1 |
| Could | Lazy warmup causes a visible page jump on some sites. | Fast warmup bounce: quick below-fold scroll and immediate restore, with explicit skip guards. | GoFullPage behavior reference; general long pages |
| Could | Product detail page screen splits apart. | Недостаточность правило скролл-таргет. | DJI Mini 4 Pro |

## Backlog: Parked Complex Capture Classes

- User-blocking overlay detection when no technical scroll lock is present. The 2026-05-21 runtime scroll probe is not enough for LEGO/Nike-style overlays because programmatic scroll can move behind a modal even when the user-visible page is blocked. Keep Samsung, LEGO, Nike, and Dyson as decision controls, but do not continue this feature before current Must work.
