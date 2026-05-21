# Roadmap

## Phase 1: Runnable MVP

- Chrome MV3 only.
- One capture command.
- Remove non-Chrome branches.
- Remove external editor integration.
- Validate manifest and JavaScript syntax.
- Load unpacked in Chrome.
- Start capture from a one-button toolbar popup.
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

## Current Prioritized Capture Backlog

| Priority | User-visible problem | Technical area | Control sites / examples |
| --- | --- | --- | --- |
| Must | Text, docs cards, product cards, or product-grid rows are cut inside the screenshot. | Split-boundary / seam placement; protect text blocks, docs-card blocks, product-card blocks, and product-grid rows. | FastAPI Docs, MongoDB Docs, Patagonia Jackets, Nordstrom Shoes, Samsung Galaxy S, REI Backpacks, Target Backpacks, Walmart Laptops |
| Must | Product cards are cut between multi-part PNG files. | Tiled-output boundary; part 01 / part 02 boundary must avoid product card and product-grid row interiors. | REI Backpacks, Target Backpacks, Walmart Laptops |
| Must | User does not understand whether capture is running, done, or saved. | Capture progress, user notification, completion feedback state. | Product-wide |
| Must | User needs PDF export. | PDF export pipeline, page sizing, output fidelity; reuse captured tiles/bitmaps and diagnostics. | Product-wide |
| Nice to have | Popup/modal repeats down the stitched page. | Repeated popup / modal overlay normalization. | Patagonia Jackets |
| Nice to have | First viewport is dimmed, but later frames become light/white while a popup state is still visually active. | Dimmed backdrop continuity / modal overlay state mismatch. | Samsung Galaxy S |
| Nice to have | Footer is missing from the final capture. | Scroll plan / page-height measurement became stale after lazy/dynamic loading. This is not split/tiling and not card cutting. Add a bounded tail growth guard: after the last planned frame, reread `scrollHeight/maxY`; if the page grew meaningfully, capture the tail with a small frame limit. | Patagonia Jackets, REI Backpacks |
| Could | White empty zones or rich-media sections do not load. | Image readiness, layout settle, rich-media section readiness. | Sony WH-1000XM5 |
| Could | App shell / SPA captures as blank or white startup state. | App-shell loaded-state / readiness guard. | Mermaid Live Editor |
| Could | Lazy shift during card cutting. | Lazy shifts that look like card cutting are treated as page stability before planning and during capture, not as split-boundary logic. | Patagonia Jackets, Samsung Galaxy S |
| Could | Full site is captured even though the user-visible state should only be the first viewport. | This does not close LEGO/Nike because programmatic scroll can move the page behind a visually blocking overlay. Further user-scroll / pointer-blocking overlay detection stays in backlog. | LEGO Millennium Falcon, Nike Air Force 1 |
| Could | Lazy warmup causes a visible page jump on some sites. | Fast warmup bounce: quick below-fold scroll and immediate restore, with explicit skip guards. | GoFullPage behavior reference; general long pages |
| Could | Product detail page screen splits apart. | Недостаточность правило скролл-таргет. | DJI Mini 4 Pro |

## Backlog: Parked Complex Capture Classes

- User-blocking overlay detection when no technical scroll lock is present. The 2026-05-21 runtime scroll probe is not enough for LEGO/Nike-style overlays because programmatic scroll can move behind a modal even when the user-visible page is blocked. Keep Samsung, LEGO, Nike, and Dyson as decision controls, but do not continue this feature before current Must work.
