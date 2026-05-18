# Beta Stability Criteria

## Goal

Define when the capture engine is stable enough for a first PNG-only beta.

## Current Mac PNG Beta Gate

The current beta gate is for stable PNG capture on macOS before moving to product polish.

The gate can be considered ready when:

- `node project/tests/validate-extension.mjs` passes;
- `node project/tests/capture-flow.mjs` passes;
- the targeted beta gate covers at least 15 high-risk real sites and completes with 0 `FAIL`;
- the 100-site stats run completes without runner-level crashes;
- routine successful captures are classified as `PASS_AUTO`;
- complex but readable captures are classified as `SAMPLE REVIEW`;
- known site/content/dynamic risks are documented instead of being treated as surprise blockers;
- visible overlays present at capture start appear in the first viewport only and do not repeat down the page;
- blocking popups that prevent normal user scrolling, or entry-gate interstitials that replace the user's capture state, are captured as the user-visible blocked first viewport only;
- large popups that appear during scroll but do not clearly block user scrolling should not automatically stop capture; continue capture, prevent repeated overlay artifacts where possible, and classify uncertain cases for review instead of `PASS_AUTO`;
- `minified-code/` is not updated unless explicitly requested.

Current accepted/deferred Mac beta risks:

- Sony WH-1000XM5 — https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b: popup-repeat is fixed, but the overall screenshot remains an active risk case: latest manual review found duplicated product hero/title content, clipped/shifted headphone imagery, missing background/text in a lower block, and height-clipped image/text content.
- REI Backpacks — https://www.rei.com/c/backpacks: first viewport is ok; lower-page product image misses remain a lazy-image/content-readiness risk.
- Eleventy Docs — https://www.11ty.dev/docs/: overlay behavior is ok; remaining instability is broken-image/noisy-readiness related.
- FastAPI Docs — https://fastapi.tiangolo.com/: latest manual review found right Table of contents/sidebar text clipped near the lower edge. Keep as active right-sidebar text clipping / split-boundary risk until fixed or explicitly accepted.

## Real-Site Gate

Use a targeted real-world QA set of at least 15 high-risk sites before beta sign-off. The current set is generated from `deepQa.riskTags` in `project/tests/real-sites.json`; run `npm run risk:sites` to print the active URLs and `REAL_SITE_FILTER`. A smaller targeted smoke can be useful during development, but it does not count as the beta gate.

Target:

- at least 90% successful captures on accessible sites;
- no broken or empty PNG outputs;
- no repeated sticky or fixed elements in primary cases;
- huge pages either produce successful multi-part output or a clear controlled error;
- the original scroll position is restored after capture.

Login-only, bot-blocked, or otherwise inaccessible pages should be classified as `BLOCKED ACCESS`, not as capture-engine failures.

Login-only pages are excluded from the automated 20-site beta gate unless we explicitly run with a prepared logged-in browser profile. If a selected site unexpectedly presents a login wall, classify it as `BLOCKED ACCESS` and replace it in the automated list.

Gray lazy previews on news, media, ecommerce, product, docs, wiki, or blog pages are a beta failure. The capture should either show loaded preview media or clearly classify the page as unstable/blocked; gray placeholder grids should not be counted as successful captures.

## Automated Review Statuses

Real-site QA should auto-classify routine successful captures instead of sending every screenshot to human review:

- `PASS_AUTO`: PNG output and diagnostics pass automated checks; no human review required.
- `SAMPLE REVIEW`: automated checks passed, but the case is intentionally sampled because it is app-shell, multi-part output, or explicitly marked for review.
- `UNSTABLE SITE`: capture completed, but diagnostics found quality risks such as pending/broken visible images, placeholder-heavy output, failed export status, or capture failure metadata.
- `BLOCKED LOGIN` / `BLOCKED ACCESS`: the page is inaccessible because of login, bot protection, consent, or similar external gates.
- `FAIL`: an assertion failed or the capture flow could not complete.

Right-crop, first-screen mismatch, or bitmap-width mismatches are `FAIL`, not `SAMPLE REVIEW`. The real-site runner should compare expected bitmap width, actual PNG width, per-part widths, viewport screenshot width, and sampled first-viewport similarity so QA artifacts do not hide missing right-side content.

Blank app-shell startup captures, over-wide output with blank/gray right-side strips, and blocking-modal capture-state mismatches are also `FAIL`, not `SAMPLE REVIEW`.

The Desktop review folder should contain only `FAIL`, `SAMPLE REVIEW`, `UNSTABLE SITE`, and blocked cases. Routine `PASS_AUTO` artifacts stay in the full project archive.

## First User Target Segments

The first beta checks prioritize:

- docs, wiki, and blog pages;
- ecommerce and product pages;
- ChatGPT/Claude-style app-shell pages.

For automated real-site QA, login-only ChatGPT/Claude-style targets are represented by publicly accessible app-shell sites. Logged-in ChatGPT/Claude checks remain manual or require a prepared test profile.

## Failure Handling Rule

When a QA or automated test failure is caused by an obvious capture-engine bug, fix it immediately and rerun the relevant checks.

Examples of engine bugs:

- empty or unreadable PNG output;
- repeated sticky or fixed elements in primary cases;
- missing visible app-shell sidebar on a selected app-shell target;
- scroll position not restored;
- unsafe canvas/export/download behavior;
- gray lazy preview grids on beta target segments.

When a failure is caused by a product tradeoff, record it in beta notes instead of blocking the engineering loop.

Examples of product tradeoffs:

- a login-only page without a prepared logged-in profile;
- bot protection or consent walls outside the capture engine;
- deep iframe scrolling;
- complete virtualized infinite history;
- hidden or collapsed sidebars;
- hidden horizontal workspace/canvas/board content that requires scrolling sideways;
- multiple similar internal scroll containers when only one is supported for beta.

## App-Shell Sidebar Rule

If a site is selected as an app-shell target, the capture must include:

- the main scrollable content;
- the visible sidebar or left navigation;
- the top chrome/header when it is visible.

Missing visible sidebar or left navigation on an app-shell target is a beta blocker unless that site is explicitly removed from the beta must-pass list.

## App-Shell Non-Goals For Beta

The beta does not require:

- all nested scroll containers;
- deep iframe scrolling;
- complete virtualized infinite history;
- hidden or collapsed sidebars;
- hidden horizontal workspace, canvas, board, editor, or table content beyond the visible app-shell width.

For sites with horizontal internal scroll, the beta expectation is: capture the visible app shell and visible working area, but do not promise to expand the entire canvas, board, table, or workspace to the right.

## Known Limits Must Be Documented

`project/docs/beta-notes.md` must clearly mention:

- only one high-confidence internal scroll container is supported;
- horizontal internal scroll is visible-width only for beta;
- deep iframe scrolling is not supported;
- infinite scroll and virtualized history are bounded/best-effort;
- huge pages may save as multiple PNG parts;
- login-only or bot-blocked pages may be unavailable;
- PDF, editor, crop, cloud, and account features are out of scope for the PNG beta.

## 2026-05-16 Current Mac PNG Beta Gate

Latest technical pass status:

- Image-readiness notification is implemented with the copy: `If some images didn’t load, try again in a few seconds.`
- Visible overlays should be preserved in the first viewport and suppressed on later frames when they are modal/dialog/backdrop/consent layers.
- Bose Headphones — https://www.bose.com/c/headphones and Patagonia Jackets — https://www.patagonia.com/shop/mens/jackets-vests visually passed the overlay-repeat objective in latest targeted artifacts, though both still carry scroll-settle automation risk.
- Multi-part PNG output now prefers nearby DOM section/list/card boundaries when splitting large captures.
- The former 38-site `SAMPLE REVIEW` set was rerun; 36 remained `SAMPLE REVIEW`, while Sonos Shop — https://www.sonos.com/en-us/shop and TypeScript Playground — https://www.typescriptlang.org/play/ moved to `UNSTABLE SITE` due to scroll-settle diagnostics.

Verification note:

- In the current shell, `npm` was not available in `PATH`, so `npm run check` could not start.
- Direct validation via `node project/tests/validate-extension.mjs` passed.
- Controlled capture validation via `node project/tests/capture-flow.mjs` passed.

## 2026-05-17 Overnight Stability Verification

This pass was verified with controlled fixtures and real-site smoke in a separate automated Chromium, not the user's manual browser.

Verified changes:

- Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners: shipping/country popup remains visible in the first viewport, while repeated popup/header/nav chrome is suppressed on later frames.
- Sonos Shop — https://www.sonos.com/en-us/shop: fixed the regression where repeat-overlay CSS matched `body.has-cookie-banner`, collapsed the page height, and produced black/blank output. Latest targeted smoke produces readable multi-part product-grid PNG output.
- Diagrams.net App — https://app.diagrams.net/: manual capture with the updated extension is good. The automated artifact from this pass captured the loading screen, so it should not be used as visual evidence for the loaded editor.
- Multi-part output: split-boundary candidates and search window remain expanded so part cuts prefer safer content edges.
- Scroll-stuck guard: initial no-move scroll remains a controlled failure; late dynamic-height or bottom-clamp mismatch becomes `UNSTABLE SITE` diagnostics instead of runner `FAIL`.

Verification completed:

- `node project/tests/validate-extension.mjs`: passed.
- `node project/tests/capture-flow.mjs`: passed.
- Focused real-site smoke for Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners, Sonos Shop — https://www.sonos.com/en-us/shop, and Diagrams.net App — https://app.diagrams.net/: completed with 0 `FAIL`; Diagrams.net visual evidence from that automated run is superseded by manual verification because the automated screenshot captured loading state.
- Historical 10-site priority smoke completed with 0 `FAIL`, but the current targeted beta gate requirement is now at least 15 sites.

Remaining Mac beta risks:

- Sony WH-1000XM5 — https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b remains a dedicated dynamic-scroll/image-readiness risk case.
- REI Backpacks — https://www.rei.com/c/backpacks remains an image-readiness/content risk case.
- Eleventy Docs — https://www.11ty.dev/docs/ remains a broken-image/noisy-readiness risk case; overlay behavior is accepted.

Manual accepted after this pass:

- Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners: no current blocker.
- Sonos Shop — https://www.sonos.com/en-us/shop: no current blocker.
- Diagrams.net App — https://app.diagrams.net/: no current blocker; rely on manual verification of the loaded editor, not the automated loading-screen artifact.
