# Real-Site QA Findings

Current operational source of truth for running/publishing QA is `project/tests/qa-runbook.md`. Runtime policy lives in `project/docs/capture-risk-policy.md`. This file keeps durable real-site conclusions and compressed historical QA learnings; it is not the runbook.

## Current Product Table

Use this before older historical notes.

| User problem | Technical problem | Sites | Priority / status |
| --- | --- | --- | --- |
| Text and cards are cut inside a screenshot. | Split-boundary / seam placement through text, docs-card, product-card, or product-grid row. | FastAPI Docs, MongoDB Docs, Patagonia Jackets, Nordstrom Shoes, Samsung Galaxy S. | Must |
| Product cards are cut when output is split into two PNG pages. | Tiled-output boundary between part 01 and part 02 lands inside a product card or product-grid row. | REI Backpacks, Target Backpacks, Walmart Laptops. | Must |
| User does not understand what is happening during capture. | Capture progress, notification, and completion-feedback state. | Product UI. | Must |
| User needs PDF export. | PDF export pipeline, page sizing, and output fidelity. | Export. | Must |
| Popup duplicates in the capture. | Repeated popup / modal overlay normalization. | Patagonia Jackets. | Nice to have |
| Only the first screen scrolls, not the whole page. | Scroll target, page-height, and layout-stability diagnostics. | Samsung Galaxy S. | Nice to have |
| First screen is dark, later screens become light/white while a popup is active. | Dimmed backdrop continuity / modal overlay state mismatch. | Samsung Galaxy S. | Nice to have after release |
| White empty zones; rich-media sections do not load. | Image readiness + layout settle + rich-media sections. | Sony WH-1000XM5. | Later |
| App shell / SPA captures as blank. | Blank app-shell startup / readiness guard. | Mermaid Live Editor. | Later |
| Product page layout splits apart. | Product-detail split layout / sticky media / scroll-stitch mismatch. | DJI Mini 4 Pro. | Deferred / out of beta |
| Cookie strip repeats down the page. | Repeated fixed bottom overlay / cookie strip normalization. | Stripe Docs. | Done |
| PNG looks gray while downloading. | PNG download lifecycle / Finder in-progress state. | Local download. | Done |
| Black/top navigation repeats. | Repeated fixed top header / product nav chrome. | Dyson Vacuums, Samsung Galaxy S. | Done / parked |
| Popup blocks the user but capture continues behind it. | Blocking overlay state mismatch / viewport-only policy when no technical scroll lock exists. | LEGO Millennium Falcon, Nike. | Backlog / parked |

## Durable Site Conclusions

| Site | Current conclusion |
| --- | --- |
| LEGO Millennium Falcon | Backlog for deeper user-blocking overlay detection. Runtime scroll probe starts but does not force `viewport-only`, because programmatic scroll can move behind the modal. |
| Nike Air Force 1 | Same backlog class as LEGO: visually blocking overlay, but programmatic scroll can still move. Keep as control, not active Must work. |
| Samsung Galaxy S | The previous "only first screen" failure was tied to entry-gate semantics. Current policy: entry-gate text alone is diagnostic; only real scroll-lock forces `viewport-only`. Remaining Samsung issue is dimmed backdrop continuity: first screen dark, lower frames light. |
| Bootstrap Modal docs | Scroll-lock proof: `body.overflowY=hidden` plus modal candidate should produce `viewport-only`. |
| MDN CSS Overflow / Next.js Pages Router | Long-page controls: should continue full-page when there is no scroll lock, even if uncertain overlay/cookie candidates are present. |
| DJI Mini 4 Pro | Deferred out of beta. Product-detail split layout remains: window scroll advances the purchase/accessory column while media stays pinned. GoFullPage and FireShot also do not close this case. |
| Stripe Docs | Repeated fixed bottom cookie strip is done/parked. Keep as regression control only. |
| FastAPI Docs | Active right-sidebar/table-of-contents text clipping near lower edge; treat as split-boundary/sidebar text issue, not sticky policy failure. |
| MongoDB Docs | Active seam-band / missing-content risk in docs card sections. |
| Patagonia Jackets | Current Must class is split-boundary/card placement. Repeated popup/modal normalization is Nice to have. |
| REI Backpacks | Current Must class is tiled-output product-card boundaries. Repeated side chrome/filter panel is a separate risk class. |
| Sony WH-1000XM5 | Later rich-media/readiness risk: duplicated hero/title, clipped/shifted product media, missing lower backgrounds/text, height-clipped blocks. |
| Apple iPhone | Active split-boundary text clipping plus lower directory/missing-content risk. |
| Apple MacBook Air | Active missing-content/carousel-card-drop risk in values section plus split-boundary risk. |
| Dyson Vacuums | Repeated black/top navigation is done/parked. Keep as regression control only. |
| Next.js, Laravel, TypeScript Handbook, Prisma Docs | Repeated docs sidebar class is accepted for beta after sticky normalization; keep as regression controls, but broad repeated-sidebar hints alone should not force Look First. |
| Eleventy Docs | Current overlay behavior accepted; older broken-image/noisy-readiness signals are not current blockers without a new visible defect. |
| Allbirds, Sonos, Diagrams.net, Figma Community, GoPro HERO, JSFiddle, Nintendo Switch, TypeScript Handbook | Manual review accepted current artifacts unless a new visible defect appears. |

## Current Scroll-Container Conclusion

Dima reviewed the dedicated `Вертикальные scroll-контейнеры` folder from the latest 100-site run. Product beta conclusion: for the vertical scroll-container class, 7 of 8 reviewed sites are OK; DJI Mini 4 Pro is deferred out of beta because it is a product-detail split-layout case, not a basic scroll-container bug.

| Site | Vertical scroll-container beta status | Notes |
| --- | --- | --- |
| DJI Mini 4 Pro | Deferred out of beta | Product-detail split layout; GoFullPage and FireShot also do not close it. |
| Next.js Docs | OK | Accepted in this review. |
| Laravel Docs | OK | Accepted in this review. |
| FastAPI Docs | OK for scroll-container class | Existing right-sidebar clipping is separate. |
| TypeScript Handbook | OK | Accepted in this review. |
| REI Backpacks | OK for scroll-container class | Product-card seams / repeated side chrome remain separate classes. |
| Patagonia Jackets | OK for scroll-container class | Product-card seams / overlay/fixed issues remain separate classes. |
| Prisma Docs | OK | Accepted in this review. |

## Current Engine/QA Learnings

- Real-site runner records pre-capture page state: modal candidates, document height, viewport size, body text length, visible element count, fixed/sticky candidates, internal scroll candidates, and window scroll delta.
- Real-site runner guards cover blank/low-entropy output, app-shell loaded state, width/right-side sanity, first-viewport similarity, blocking modal state, unexpected short-page risk, dimmed backdrop continuity, and Deep QA detector hints.
- `PageProbe` clamps normal window capture width to visible viewport width to avoid over-wide/right-gray output.
- Blocking modal policy is now mechanical: `scroll-lock` is the hard `viewport-only` path; `entryGate` is diagnostic unless it coincides with scroll lock; `large-dialog-uncertain` continues capture and routes to review/unstable.
- `PageProbe` skips internal scroll-container selection when `captureAction` is `viewport-only`, so a truly blocked page cannot become a long background capture.
- Fixed/sticky policy: frame 0 preserves visible user state; later frames normalize repeated fixed chrome and blanket-normalize reachable sticky nodes through cleanup.
- Sticky cleanup is audited through diagnostics and `project/tests/sticky-cleanup-smoke.mjs`.
- Deep QA is detector-only: it can classify suspicious captures as `UNSTABLE SITE` or `SAMPLE REVIEW`, but it does not retry or recapture for the user.
- Offline PNG QA is report-only and reduces manual review load; it should not replace real-site runner diagnostics.
- Review publishing source of truth is `project/tests/qa-runbook.md`. The active review folder is `/Users/dima/Desktop/For-Dima-from-Codex`.

## Latest Verification Snapshots

- Full 100-site detector-only run: 0 `FAIL`; 41 `PASS_AUTO`, 26 `UNSTABLE SITE`, 28 `SAMPLE REVIEW`, 5 `BLOCKED ACCESS`.
- Latest full first-half plus second-half 100-site snapshot: 0 automated `FAIL`.
- Targeted entry-gate/scroll-lock checks after the Samsung fix:
  - Samsung Galaxy S: full-page output `2730x12842`; no longer collapsed to first viewport. Remaining failure is dimmed backdrop continuity.
  - Bootstrap Modal docs: real scroll-lock produced `viewport-only`, `reason=scroll-lock`.
  - MDN CSS Overflow: long-page control produced full-page multi-part output.
  - Next.js Pages Router: long-page control produced full-page output; uncertain overlay stayed review-only.
- Targeted runtime scroll-probe check on 2026-05-21:
  - Samsung Galaxy S, https://www.samsung.com/us/smartphones/galaxy-s/: probe triggered, capture stayed full-page, remaining failure is dimmed backdrop continuity.
  - LEGO Millennium Falcon, https://www.lego.com/en-us/product/millennium-falcon-75192: probe triggered, capture continued full-page; this does not close visually blocking overlay behavior.
  - Nike Air Force 1, https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111: probe triggered, capture continued full-page; same backlog class as LEGO.
  - Dyson Vacuums, https://www.dyson.com/vacuum-cleaners: no blocking-modal problem; full-page/tiled output completed as sample review.
  - Product decision: park deeper blocking-overlay/user-scroll detection in backlog and return focus to current Must work.
- Controlled fixtures after entry-gate change: `basic-long-page`, `visible-overlay-first-frame-page`, `shipping-popup-sticky-repeat-page`, `dimmed-popup-scroll-state-page`, and `fullscreen-menu-not-lightbox-page` passed.

## Historical QA Log

This section compresses the older detailed run notes from 2026-05-15 through 2026-05-18. Keep only durable conclusions here; use archived run reports for raw per-site details.

### 2026-05-15

- Initial 20-site real-site run proved the engine could capture normal long pages, large multi-part pages, public app-shell pages, and product/docs pages. Main bottleneck shifted from basic capture to classification and review workflow.
- Rerun with auto-classification produced 0 capture-flow failures and introduced the current status vocabulary: `PASS_AUTO`, `SAMPLE REVIEW`, `UNSTABLE SITE`, `BLOCKED ACCESS`, `FAIL`.
- GitHub Blog right-crop artifact was a QA harness bug, not an engine bug: headed Chrome used a Playwright-emulated viewport while `captureVisibleTab` captured the real tab bitmap. Fix: headed real-site QA uses `viewport: null` and records actual viewport.

### 2026-05-16

- 50-site nightly run completed with readable output and 0 capture-flow failures. Human review volume was too high, so review publishing and sample selection needed stronger rules.
- 100-site beta QA run completed with 0 `FAIL`, but manual review found real classes hidden by aggregate status: overlay repeats, split-boundary text/card cuts, repeated sidebars, and image-readiness/media gaps.
- Stripe exposed repeated cookie banner capture; fixed by extending fixed/sticky normalization to consent edge overlays and shadow DOM candidates.
- FastAPI/Eleventy follow-up added stronger scroll-settle checks, frame diagnostics, sticky/dialog/modal suppression, and stricter first-viewport overlay preservation.
- Overlay repeat and sample rerun fixed visible popup repetition for Bose/Patagonia-style cases and added adaptive split-boundary candidates for multi-part output. Apple/MDN remained active split-boundary examples.
- Production startup parity improved: popup and QA capture paths both pass explicit `tabId`; real-site QA still grants temporary `<all_urls>` to copied test extension for automation.

### 2026-05-17

- Blocking popup policy was validated on LEGO/Mermaid/Microsoft class cases: blocked modal state captures one visible viewport; blank app-shell and over-wide/right-gray output are failures, not samples.
- Review publishing red-team check fixed two operator-facing mistakes: sample-review folders were capped unexpectedly, and output could go to timestamped Desktop folders instead of active `/Users/dima/Desktop/For-Dima-from-Codex`.
- Overnight stability pass accepted Allbirds, Sonos, Diagrams.net, TypeScript Handbook, Figma Community, GoPro HERO, JSFiddle, and Nintendo Switch current artifacts unless new defects appear.
- Prepared/fixed risk classes included repeated shipping/country overlays, side-palette app-shell selection, stuck window scroll detection, split-boundary candidates, and non-first-frame normalization before scroll.
- Deep QA detector pass added manual-regression tags and class-specific guards. Full 100-site rerun had 0 `FAIL` and better refusal of false green results.

### 2026-05-18

- Added opt-in controlled risk fixtures behind `npm run capture:risk` for two-scroll docs, repeated cookie strips, split-boundary text, right gray strips, product-card seam bands, missing middle content, lazy footer links, Apple carousel/directory sections, Sony product hero duplication, fixed-background quirks, lightbox root quirks, and fullscreen menu non-lightbox behavior.
- Added offline PNG QA (`npm run qa:png`) as a no-browser report-only layer for existing artifacts.
- Manual review identified active product classes: Apple iPhone clipping/missing lower directory, Apple MacBook Air missing carousel card, FastAPI sidebar clipping, MongoDB seam bands, Patagonia product-card boundaries, REI product-card boundaries plus side chrome, Sony rich-media/hero defects, and Samsung dimmed popup continuity.

### 2026-05-19

- Product/QA classes were consolidated: split-boundary and tiled-output product-card boundaries are current Must work; repeated cookie strip, repeated fixed top nav, and blocked-popup viewport-only policy are done/parked; DJI split product layout is deferred out of beta.
- Sticky approach was simplified: sticky normalization is blanket mechanical `sticky -> relative` after warmup/final measure/plan, not a sidebar/filter/header classifier path. Fixed elements remain frame-aware.
- Internal scroll target policy became window-first and mechanical: if window scroll is meaningful, use window; internal scroll target only when window barely scrolls and one large central container passes strict geometry with no close second candidate.
