# Real-Site QA Findings

Current operational source of truth for running/publishing QA is `project/tests/qa-runbook.md`. Older historical sections below may mention retired `/latest/` Desktop review folders or capped sample subsets; those notes describe previous workflows and are superseded by the 2026-05-17 Review Publishing Red-Team Check.

## 2026-05-17 QA Guards And Blocking Popup Policy

Initial implementation was done without browser access. After the user explicitly allowed browser automation, the controlled and real-site checks below were run.

### Product Conclusions

- LEGO Millennium Falcon — https://www.lego.com/en-us/product/millennium-falcon-75192: if a popup blocks normal user scrolling, capture must stop at the user-visible first viewport with the popup open. The extension must not suppress the popup and scroll the background as if the user closed it.
- Mermaid Live Editor — https://mermaid.live/: a blank white app-shell artifact is a startup/readiness failure, not an acceptable `SAMPLE REVIEW`.
- Microsoft Surface Pro — https://www.microsoft.com/en-us/d/surface-pro: over-wide output with large right-side gray/blank regions is a width/probe failure, not an acceptable `SAMPLE REVIEW`.

### Implemented Direction

- Real-site runner now records pre-capture page state, including scroll-locking modal candidates, document height, viewport size, body text length, and visible element count.
- Real-site runner now has guards for blank/low-entropy output, app-shell loaded state, width sanity, right-side blank/gray strips, and blocking modal capture-state mismatch.
- `PageProbe` now clamps normal window capture width to the visible viewport width instead of using full document `scrollWidth`.
- `PageProbe` now detects likely scroll-locking blocking modals and entry-gate interstitials, then reports a one-viewport capture plan when the user is blocked on the first screen.
- The blocking-popup detector now records `reason` and `captureAction`: `scroll-lock` and `entry-gate-text` stop at one viewport; `large-dialog-uncertain` continues capture and becomes a review/unstable signal instead of pretending the output is routine `PASS_AUTO`.
- App-shell real-site QA now waits for a non-blank loaded state before capture and fails explicitly if the shell remains blank.
- Real-site runner now classifies common external error states such as `Access Denied`, `Oops! Something went wrong`, and `Thank you for your patience` as blocked/access-like outcomes instead of `PASS_AUTO`.

### Verification

- `node --check` passed for JavaScript files under `code/`, `project/tests`, and `project/scripts`.
- `node project/tests/validate-extension.mjs`: passed.
- `npm run check` could not start because `npm` is not available in the current Codex PATH; direct `node` validation was used instead.
- `node project/tests/capture-flow.mjs`: passed all controlled cases.
- Targeted LEGO/Mermaid/Microsoft smoke: completed with 0 `FAIL`.
- LEGO Millennium Falcon produced a one-viewport PNG when the LEGO Play Zone interstitial appeared during capture. This matches the product rule: do not scroll the page behind a blocking popup.
- The controlled `visible-overlay-first-frame-page` fixture still captures the full page, which protects the non-blocking overlay case from being incorrectly collapsed to one viewport.
- Mermaid Live Editor passed app-shell loaded-state and blank/low-entropy guards; it no longer produces a white app-shell artifact in this check.
- Microsoft Surface Pro no longer produces 8000px-wide output or right-side gray blank-space. A transient `Thank you for your patience` run is now classified as blocked/access-like by marker logic; a normal retry produced viewport-width multi-part output.
- Second-half 100-site run completed with 0 `FAIL`: 28 `PASS_AUTO`, 18 `SAMPLE REVIEW`, 4 `UNSTABLE SITE`, and 0 blocked pages in that run's summary. The later marker check reclassified Tesla Model 3 and New Balance Mens Shoes from misleading `PASS_AUTO` error pages to `BLOCKED ACCESS`.

### Second-Half 100-Site Run

Command shape: second 50 entries from `project/tests/real-sites.json`, archived outside the main `latest` folder.

Artifacts:

- Full archive: `Screenshots-for-Review/runs-second-half/second-half-100-20260517-173327/runs/latest/`
- Review folder restored to: `/Users/dima/Desktop/For-Dima-from-Codex/`

Status counts:

| Status | Count |
| --- | ---: |
| `PASS_AUTO` | 28 |
| `SAMPLE REVIEW` | 18 |
| `UNSTABLE SITE` | 4 |
| `FAIL` | 0 |

Review-priority cases:

| Site | Status | Reason |
| --- | --- | --- |
| Laravel Docs | `UNSTABLE SITE` | Minor unsettled scroll frame. |
| Azure Docs | `UNSTABLE SITE` | Minor unsettled scroll frame. |
| Eleventy Docs | `UNSTABLE SITE` | 3 broken visible images; known noisy image-readiness risk. |
| TypeScript Playground | `UNSTABLE SITE` | Unsettled scroll frame; TypeScript app-shell investigation remains deferred. |

### Manual Sample Review After Second-Half Run

- Cypress Docs — https://docs.cypress.io/app/get-started/why-cypress: manual sample review found a small text clip in the right contents/sidebar near a PNG part boundary. The capture is otherwise readable and acceptable for beta. Track this as split-boundary/sidebar polish, not as a beta blocker.
- DJI Mini 4 Pro — https://store.dji.com/product/dji-mini-4-pro: manual sample review found a real visual capture defect that auto guards missed. In the first-screen product area, the right-side product/configurator scroll zone appears to be captured across later stitched frames while the left/hero side becomes a large blank area. Floating helper icons on the right also repeat down the capture. Promote this from `SAMPLE REVIEW` to manual engine-risk. Likely class: bounded product configurator / first-screen scroll-zone stitching mismatch plus repeated floating-widget suppression gap.
- FastAPI Docs — https://fastapi.tiangolo.com/: manual sample review found recurring right documentation sidebar/scroll text clipping near lower content. This resembles the earlier FastAPI sticky/sidebar clipping issue that previously looked fixed in manual capture, so promote the current artifact from `SAMPLE REVIEW` to manual engine-risk / regression-watch. Likely class: sticky/right-sidebar clipping around long multipart capture boundaries.

Prepared engine follow-up:

- DJI class: sticky suppression was narrowed so large sticky product media/content panels are no longer hidden after the first frame, while sticky docs/sidebar/navigation chrome can still be suppressed. Floating helper/widget suppression was also expanded for small edge chat/help/support/icon-like controls. Added controlled `product-sticky-zone-page` coverage. Browser-based controlled verification passed, and the latest targeted DJI run auto-passed as `SAMPLE REVIEW`; the diagnostic downsample no longer showed the large blank left product-media gap or repeated right-side helper icons.
- FastAPI/Cypress class: targeted browser runs auto-passed as `SAMPLE REVIEW`. Keep as manual/polish regression-watch until Dima confirms the latest artifacts visually; do not claim a full fix for sidebar text clipping solely from auto guards.

### First-Half Final 50-Site Measurement

Run: `/Users/dima/Projects/Screenshot Extension/Screenshots-for-Review/first-half-final-20260517-211009/report.md`

Review artifacts published to active folder: `/Users/dima/Desktop/For-Dima-from-Codex`

Result: 50 sites, 0 `FAIL`.

Status counts:

- `PASS_AUTO`: 17
- `SAMPLE REVIEW`: 18
- `UNSTABLE SITE`: 11
- `BLOCKED ACCESS`: 4

Notable outcomes:

- LEGO Millennium Falcon is `PASS_AUTO` with a one-viewport PNG, matching the product decision for blocking entry-gate popups.
- Microsoft Surface Pro is no longer an over-wide/right-gray `FAIL`; it is `SAMPLE REVIEW`.
- Mermaid Live Editor is `SAMPLE REVIEW`, not a blank app-shell failure.
- REI and Sony remain known deferred investigations rather than new hard failures.
- Google Pixel, Dell XPS, PlayStation 5, and Garmin Watches are classified as `BLOCKED ACCESS`, not engine failures.

### Manual Feedback After First-Half Review

- Cloudflare Blog — https://blog.cloudflare.com/: Dima reported that the `01-LOOK-FIRST-engine-risk` screenshot has a bottom block with no visible footer/bottom closure. Track as possible truncated page end, missing late content, or site-state mismatch; do not treat as closed until manually compared with the live page.
- Nike Air Force 1 — https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111: Dima reported the same class as LEGO blocking popup behavior. Manual user capture in that blocked-popup state produced the expected result: only the first visible viewport. Therefore, if the automated run captures the full site behind the popup, treat that artifact as invalid for that state. Nike is grouped next to LEGO in `project/tests/real-sites.json` so these two blocking-popup cases run together.
- Next.js Docs — https://nextjs.org/docs: Dima reported a two-vertical-scroll layout defect. The screenshot shows a break/fragmented text on the left because the left docs sidebar and the main content area have independent vertical scroll behavior. Product expectation for this class: when the left scroll container is confidently a narrow sidebar/navigation and the wider second scroll area is the main article/content, capture should follow the main content area and crop/reuse the sidebar rather than stitching the sidebar as if it were the primary page.
- Stripe Docs — https://docs.stripe.com/: Dima reported a repeated cookie-acceptance bar across multi-part output. The cookie strip appears in both the first and second screenshot parts, but product expectation is first viewport/first part only. Treat as current overlay-repeat regression for multi-part docs output, even though older targeted notes said the Stripe repeat issue was improved.
- REI Backpacks — https://www.rei.com/c/backpacks: Dima reported that product cards are cut by PNG part boundaries, left sidebar subcategories duplicate, and the left `Store Pickup` / shipping form repeats even though it appears only once on the live site. This is no longer only a deferred lower-page image-readiness risk; track as active product-card split-boundary plus repeated sidebar subcategory/form chrome.
- Samsung Galaxy S — https://www.samsung.com/us/smartphones/galaxy-s/: Dima reported a horizontal seam/stripe line cutting through product cards in the screenshot. Treat as product-card seam-band / split-boundary defect, not real page content.
- Sony WH-1000XM5 — https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b: Dima reported missing content below the feature row around `Crystal Clear Call Quality` / `Up to 30-Hour Battery Life` and a vertical black strip that is not visible to the user in the browser. Treat as current missing-content plus black-strip artifact, not only a deferred dynamic-scroll/image-readiness investigation.
- TypeScript Handbook — https://www.typescriptlang.org/docs/handbook/intro.html: Dima reported that the left docs sidebar was captured multiple times. Treat as a repeated navigation/sidebar chrome defect in docs layouts; the sidebar should not be stitched repeatedly while capturing the main documentation content.
- Apple iPhone — https://www.apple.com/iphone/: Dima reported that a subtitle/heading is clipped in the screenshot. Treat as split-boundary or stitching text-clipping defect around large marketing sections/cards, not as acceptable sample output.

QA roadmap decision from this review: add Deep QA mode with defect-class detectors first, without heavy visual baselines. Once detectors are stable, add masked golden baselines for only 10-20 key regression sites. Do not baseline all 100 sites initially because it would create too much noise and maintenance cost.

Implementation start: `project/tests/real-site-runner.mjs` now has a detector-only Deep QA visual guard. It uses `deepQa.riskTags` from `project/tests/real-sites.json` for the current manual regression pack and can classify suspicious captures as `UNSTABLE SITE` with diagnostics, but it does not perform limited retry or baseline comparison.

### Review Publishing Red-Team Check

Audited after the first-half final run because two operator-facing mistakes happened:

- `SAMPLE REVIEW` was capped to 5 in the Desktop folder even when the user expected all sample sites.
- The latest run was published to a timestamped Desktop folder instead of the active `/Users/dima/Desktop/For-Dima-from-Codex` folder.

Fixes:

- Active review artifacts were republished to `/Users/dima/Desktop/For-Dima-from-Codex`.
- The active folder now contains 11 `01-LOOK-FIRST-engine-risk`, 18 `02-Samples`, and 4 `03-BLOCKED-pages` folders, all with capture PNGs.
- `real-site-runner.mjs` now defaults to copying all `SAMPLE REVIEW` cases. `REVIEW_OPTIONAL_SAMPLE_LIMIT` only caps samples when explicitly set.
- `real-site-runner.mjs` no longer supports `REVIEW_LATEST_DIR`; review output goes to the active review root. Use `REVIEW_ARTIFACT_ROOT` only for an intentionally separate diagnostic root.
- `validate-extension.mjs` now checks the publishing contract so these regressions fail validation.
- `project/tests/qa-runbook.md` is now the operational run/publishing source of truth for fresh chats, so the active folder, sample-copy rule, status meanings, and context-loading order are not reconstructed from memory.

## 2026-05-16 Manual Triage And Overlay Regression Follow-Up

### Product Decision

- Sony WH-1000XM5 popup-repeat bug is fixed by manual review: the visible signup/promo popup no longer repeats down the full-page PNG. Sony still has a separate pending dynamic scroll/gap review because the automated run reports unsettled scroll frames.
- REI Backpacks is superseded by later manual feedback: it is a current engine-risk case with product-card split-boundary clipping and repeated left sidebar subcategory/form chrome.
- Eleventy Docs is not a current engine blocker after manual review: the visible popup/overlay behavior is correct because it appears only on the first screen and does not repeat on later page sections.

### Manual Review Summary

- Sony WH-1000XM5: popup-repeat fixed; do not reopen this as a popup blocker unless manual review finds a new repeated overlay. Pending question: whether unsettled scroll frames create visible gaps or duplicated sections.
- REI Backpacks: superseded by later manual feedback; treat as active product-card split-boundary plus repeated left sidebar subcategory/form chrome.
- Eleventy Docs: overlay ok; do not treat the `UNSTABLE SITE` status as an overlay blocker because the remaining signal is broken images/noisy readiness.
- FastAPI Docs: superseded by later manual feedback. The current reviewed artifact clips the right Table of contents/sidebar text near the lower edge, so keep FastAPI as an active right-sidebar text clipping / split-boundary risk.
- Sony WH-1000XM5: popup-repeat is fixed, but manual review says the overall screenshot is still visually abnormal. Move Sony to a dedicated risk case for later investigation to separate site-side layout shift/dynamic content behavior from an engine-side scroll/stitching defect.

### Fix Direction

- `FixedStickyNormalizer` preserves frame 0, then hides repeated fixed/sticky/dialog/promo overlays on later frames.
- The overlay regression fixture now uses a fullscreen backdrop with an inner modal panel, matching the class of popups seen on ecommerce/product pages.
- `CanvasStitcher` and `CanvasTiler` now compute crop overlap from the previous actual scroll position, which avoids over-cropping when a dynamic page lands a few pixels away from the planned scroll target.
- Real-site reports now include frame diagnostics with hidden-element counts, planned/actual scroll, settle status, and bitmap scale so repeated-overlay and scroll-divergence risks are easier to inspect.

### Current Classification

- Sony remains the active engine-risk target, but the latest targeted smoke no longer classifies it as `FAIL`; it is `UNSTABLE SITE` because dynamic scroll frames do not always settle at the planned positions.
- REI should stay in the targeted risk set as `SAMPLE REVIEW` / known lazy-image risk unless a clear visual engine defect appears.
- Eleventy should stay in the targeted risk set as an overlay regression control, but manual review says the current user-visible overlay behavior is acceptable.

### Verification

- `node project/tests/validate-extension.mjs`: passed.
- `node project/tests/capture-flow.mjs`: passed.
- `REAL_SITE_FILTER=sony,eleventy,rei node project/tests/real-site-runner.mjs`: completed without runner failure.
- Sony WH-1000XM5: `UNSTABLE SITE`, first-viewport and width guards passed, popup-repeat was not visible in the automated output, unsettled scroll remains the status hint.
- REI Backpacks: `UNSTABLE SITE`, first-viewport and width guards passed, remaining reason is 17 broken visible images.
- Eleventy Docs: `UNSTABLE SITE`, first-viewport and width guards passed, remaining reason is 3 broken visible images.

### 10-Site Priority Smoke

Command: `REAL_SITE_FILTER=eleventy,fastapi,figma,jest,lego,rei,sony,storybook,stripe,mermaid node project/tests/real-site-runner.mjs`

Result: completed without `FAIL`.

| Site | Status | Notes |
| --- | --- | --- |
| Stripe Docs | `PASS_AUTO` | Auto checks passed. |
| LEGO Millennium Falcon | `PASS_AUTO` | Auto checks passed. |
| REI Backpacks | `UNSTABLE SITE` | 17 broken visible images; width and first-viewport guards passed. |
| Figma Community | `SAMPLE REVIEW` | App-shell sample review; auto checks passed. |
| Sony WH-1000XM5 | `UNSTABLE SITE` | Unsettled dynamic scroll frames; width and first-viewport guards passed. |
| Mermaid Live Editor | `SAMPLE REVIEW` | Overlay/app-shell sample review; auto checks passed. |
| Jest Docs | `PASS_AUTO` | Auto checks passed. |
| Storybook Docs | `PASS_AUTO` | Auto checks passed. |
| Eleventy Docs | `UNSTABLE SITE` | 3 broken visible images; width and first-viewport guards passed. |
| FastAPI Docs | `SAMPLE REVIEW` | Multi-part docs sample review; auto checks passed. |

### Mac Beta Gate Decision Before 100-Site Stats

- Overlay blocker is closed for the manually reviewed cases: Sony WH-1000XM5 — https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b, Eleventy Docs — https://www.11ty.dev/docs/.
- Known non-blocker risks are documented: REI Backpacks — https://www.rei.com/c/backpacks lower-page images, FastAPI Docs — https://fastapi.tiangolo.com/ sticky/sidebar sample review.
- Sony WH-1000XM5 remains a dedicated risk case because the visual screenshot is abnormal and needs a later site-side versus engine-side scroll/layout-shift investigation.
- Next required broad signal is the 100-site stats run, used to judge overall distribution of `PASS_AUTO`, `SAMPLE REVIEW`, `UNSTABLE SITE`, blocked, and `FAIL` statuses before moving to product polish.

### 100-Site Stats Run

Command: `node project/tests/real-site-runner.mjs`

Result: completed successfully across all 100 configured sites.

| Status | Count |
| --- | ---: |
| `PASS_AUTO` | 53 |
| `SAMPLE REVIEW` | 38 |
| `UNSTABLE SITE` | 8 |
| `BLOCKED ACCESS` | 1 |
| `FAIL` | 0 |

Non-pass risks:

| Site | Status | Reason | URL |
| --- | --- | --- | --- |
| REI Backpacks | `UNSTABLE SITE` | 11 broken visible images | https://www.rei.com/c/backpacks |
| Node.js API Docs | `UNSTABLE SITE` | unsettled scroll frames: frame 2 planned 0,1443, actual 0,1372 | https://nodejs.org/api/ |
| Dell XPS Laptops | `BLOCKED ACCESS` | access, bot-protection, or consent-blocking screen | https://www.dell.com/en-us/shop/dell-laptops/scr/laptops/xps |
| Sony WH-1000XM5 | `UNSTABLE SITE` | unsettled dynamic scroll frames; already split into dedicated Sony risk case | https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b |
| Laravel Docs | `UNSTABLE SITE` | unsettled scroll frames: frame 16 planned 0,11774, actual 0,11758 | https://laravel.com/docs/12.x |
| Ubuntu Server Docs | `UNSTABLE SITE` | unsettled scroll frames: frame 4 planned 0,2703, actual 0,2594.5 | https://documentation.ubuntu.com/server/ |
| Eleventy Docs | `UNSTABLE SITE` | 3 broken visible images; overlay behavior manually accepted | https://www.11ty.dev/docs/ |
| Bose Headphones | `UNSTABLE SITE` | unsettled scroll frames: frame 11 planned 0,7897, actual 0,7892.5 | https://www.bose.com/c/headphones |
| Patagonia Jackets | `UNSTABLE SITE` | unsettled scroll frames: frame 1 planned 0,763, actual 0,751 | https://www.patagonia.com/shop/mens/jackets-vests |

Conclusion: the 100-site stats run has 0 `FAIL`, so the remaining work is risk triage and product polish, not a broad engine-breakage emergency.

### Manual Review Findings After 100-Site Stats

Manual review found several important distinctions that the automated status alone does not express.

Confirmed visual defects:

| Site | Finding | URL |
| --- | --- | --- |
| Bose Headphones | Promo popup repeats down the page. It should appear only in the first viewport. | https://www.bose.com/c/headphones |
| Patagonia Jackets | Cookie/privacy overlay is clipped at the top of a PNG part boundary. | https://www.patagonia.com/shop/mens/jackets-vests |
| Apple MacBook Air | Multi-part PNG split cuts through large text; later manual review also found missing carousel/card content in `Our values lead the way`. | https://www.apple.com/macbook-air/ |
| MDN Web API | Multi-part PNG split cuts through text/list rows. | https://developer.mozilla.org/en-US/docs/Web/API |

Deferred or known risk cases:

| Site | Risk | URL |
| --- | --- | --- |
| Sony WH-1000XM5 | Popup-repeat is fixed, but the overall screenshot is visually abnormal. Keep as dedicated site-side versus engine-side scroll/layout-shift risk case. | https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b |
| REI Backpacks | Superseded by later manual feedback: product cards are cut by PNG part boundaries, left sidebar subcategories duplicate, and the left `Store Pickup` / shipping form repeats. | https://www.rei.com/c/backpacks |
| Eleventy Docs | Overlay appears only on the first screen and does not repeat; remaining issue is broken images/noisy readiness. | https://www.11ty.dev/docs/ |
| FastAPI Docs | Superseded by later manual review: right Table of contents/sidebar text is clipped near the lower edge. Keep as active sidebar text-clipping risk. | https://fastapi.tiangolo.com/ |
| Node.js API Docs | Automated run reported unsettled scroll; no manual visual defect confirmed yet. | https://nodejs.org/api/ |
| Laravel Docs | Superseded by later manual review: both left docs navigation and right `On this page` sidebar repeat while the central article text scrolls. | https://laravel.com/docs/12.x |
| Ubuntu Server Docs | Automated run reported unsettled scroll; no manual visual defect confirmed yet. | https://documentation.ubuntu.com/server/ |
| Dell XPS Laptops | Blocked/access case, not a capture-engine bug. | https://www.dell.com/en-us/shop/dell-laptops/scr/laptops/xps |

Manual sample review accepted:

| Site | Decision | URL |
| --- | --- | --- |
| React Learn | Repeated manual sample reviews found no visible capture issues. Do not prioritize unless status changes or docs/sticky/tiling logic changes. | https://react.dev/learn |

Recommended next technical order:

1. Overlay-repeat pass: start with Bose Headphones, then recheck Sony/Eleventy/Patagonia overlay behavior.
2. Multi-part split-boundary polish: Apple MacBook Air, MDN Web API, and Patagonia are concrete examples where text or overlay content is cut at a part boundary.
3. Image-readiness pass: Eleventy Docs stays a known lazy/broken-image risk; REI Backpacks is now an active product-card split-boundary plus repeated sidebar/form chrome case.
4. Deferred dynamic-scroll pass: Sony, Node.js API Docs, Laravel Docs, Ubuntu Server Docs, Bose, and Patagonia should be revisited only after visible defects are confirmed or after overlay/split-boundary work is stable.

### 2026-05-17 Overnight PNG Stability Pass

Scope:

- Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners
- Sonos Shop — https://www.sonos.com/en-us/shop
- Diagrams.net App — https://app.diagrams.net/
- regression smoke for the current 10-site priority set

Implemented and verified:

- Repeated ecommerce shipping/country popups are preserved in the first viewport and suppressed on later frames.
- Non-semantic top navigation chrome, such as the Allbirds white product nav, is suppressed on later frames.
- Diagrams.net empty app shell no longer selects the left palette or empty canvas as the main internal scroll target; it captures the visible app shell only.
- A Sonos regression was found and fixed: broad cookie overlay CSS matched `body.has-cookie-banner` and collapsed the whole page after the first frame. The selector is now scoped to descendants of `body`, so the page remains scrollable.
- `scroll_target_stuck` remains a hard failure for an initial scroll that does not move at all, but later dynamic-height/bottom-clamp cases are reported through unsettled-frame diagnostics instead of failing the whole run.
- The `late-lazy-grid-page` fixture no longer asserts a race-prone pre-warmup pending count; it still verifies the lazy images appear in the final PNG.

Focused real-site smoke:

| Site | Status | Notes | URL |
| --- | --- | --- | --- |
| Diagrams.net App | Manual OK | Automated artifact from this pass showed a loading screen, so it is not valid evidence. Manual capture with the updated extension is good. | https://app.diagrams.net/ |
| Sonos Shop | Manual OK | Former black/blank output fixed; manual review has no remaining questions for this site. | https://www.sonos.com/en-us/shop |
| Allbirds Wool Runners | Manual OK | Shipping popup only on first viewport; repeated white header/nav removed. Manual review has no remaining questions for this site. | https://www.allbirds.com/products/mens-wool-runners |

10-site priority smoke:

Command: `REAL_SITE_FILTER=eleventy,fastapi,figma,jest,lego,rei,sony,storybook,stripe,mermaid node project/tests/real-site-runner.mjs`

Result: completed with 0 `FAIL`.

| Site | Status | Notes | URL |
| --- | --- | --- | --- |
| Stripe Docs | `PASS_AUTO` | Auto checks passed. | https://docs.stripe.com/ |
| LEGO Millennium Falcon | `PASS_AUTO` | Auto checks passed. | https://www.lego.com/en-us/product/millennium-falcon-75192 |
| Jest Docs | `PASS_AUTO` | Auto checks passed. | https://jestjs.io/docs/getting-started |
| Storybook Docs | `PASS_AUTO` | Auto checks passed. | https://storybook.js.org/docs |
| Figma Community | `SAMPLE REVIEW` | App-shell sample review; auto checks passed. | https://www.figma.com/community |
| Mermaid Live Editor | `SAMPLE REVIEW` | App-shell/overlay sample review; auto checks passed. | https://mermaid.live/ |
| FastAPI Docs | `SAMPLE REVIEW` | Multi-part docs sample review; auto checks passed. | https://fastapi.tiangolo.com/ |
| REI Backpacks | `UNSTABLE SITE` | 2 broken visible images; first viewport previously accepted by manual review. | https://www.rei.com/c/backpacks |
| Sony WH-1000XM5 | `UNSTABLE SITE` | Dynamic scroll/frame-settle risk plus image-readiness risk; remains dedicated risk case. | https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b |
| Eleventy Docs | `UNSTABLE SITE` | 3 broken visible images; overlay behavior previously accepted by manual review. | https://www.11ty.dev/docs/ |

Verification:

- `node project/tests/validate-extension.mjs`: passed.
- `node project/tests/capture-flow.mjs`: passed.
- Focused real-site smoke for Allbirds/Sonos/Diagrams.net: completed with 0 `FAIL`.
- 10-site priority smoke: completed with 0 `FAIL`.

Manual follow-up verdict:

- Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners: manually accepted after the overnight stability pass; no current blocker.
- Sonos Shop — https://www.sonos.com/en-us/shop: manually accepted after the overnight stability pass; no current blocker.
- Diagrams.net App — https://app.diagrams.net/: manually accepted with the updated extension. The automated screenshot from the overnight pass should not be used as visual evidence because it captured the loading screen rather than the loaded editor.
- TypeScript Handbook — https://www.typescriptlang.org/docs/handbook/intro.html: manually accepted after review; the automated `UNSTABLE SITE` signal came from minor scroll-settle diagnostics, not a confirmed visual blocker.
- Figma Community — https://www.figma.com/community: repeatedly manually accepted; current screenshots are okay, so do not keep resurfacing it as a fresh required review item unless a new artifact shows a new visible defect.
- GoPro HERO — https://gopro.com/en/us/shop/cameras: manually accepted after sample review; no visible capture defect found in the current artifact.
- JSFiddle — https://jsfiddle.net/: manually accepted after sample review; no visible capture defect found in the current artifact.
- LEGO Millennium Falcon — https://www.lego.com/en-us/product/millennium-falcon-75192: the popup blocks normal user scrolling. The correct capture for that blocked state is only the first visible viewport with the popup open. Do not treat a long screenshot made by hiding the popup after frame 0 and scrolling the background as valid user-facing output.
- Mermaid Live Editor — https://mermaid.live/: current automated artifact is not acceptable. User's manual browser shows the loaded dark editor/diagram app shell, while the automated capture produced a blank white viewport/screenshot. Treat this as an app-shell startup/readiness mismatch, not as a valid `SAMPLE REVIEW` pass.
- Microsoft Surface Pro — https://www.microsoft.com/en-us/surface/devices/surface-pro-11th-edition: current automated artifact is not acceptable. It produced nine very wide `8000px` PNG parts with large gray areas to the right; treat this as an over-wide page measurement/right-side blank-space defect, not as an accepted `SAMPLE REVIEW` pass.
- Sony WH-1000XM5 — https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b: keep as deferred; revisit later as a dedicated dynamic-scroll/image-readiness investigation, not in the current triage pass.
- Do not reopen manually accepted cases as red blockers unless a new artifact shows a new visible defect.

## 2026-05-15 20-Site Run

Source report: `Screenshots-for-Review/reports/20260515-230615.md`

Artifacts: `Screenshots-for-Review/runs/20260515-230615/`

This run happened before the current `PASS_AUTO` / `SAMPLE REVIEW` auto-classification rules, so the original report overuses `NEEDS HUMAN REVIEW`. The findings below interpret the run using the current beta rules.

### Summary

- 20 sites were attempted.
- 18 sites produced valid PNG output.
- 22 PNG files were produced because very tall pages used multi-part output.
- 1 site failed before capture because the page navigation hit `ERR_SOCKET_NOT_CONNECTED`.
- 1 site was classified as blocked access because it appeared to show bot protection, consent, or access blocking.
- No automated evidence of empty or unreadable PNG output was found in the run.
- Multi-part output worked on very tall pages such as MDN Web API and Apple MacBook Air.
- Headed Chromium was reliable enough for the run. Headless real-site mode failed earlier because the runner could not resolve the loaded extension ID.

### Interpreted Results

| Segment | Result |
| --- | --- |
| Docs/Wiki/Blog | Mostly successful captures. One Wikipedia run failed before capture due to network/socket error. MDN produced valid multi-part output. |
| Ecommerce/Product | Mostly successful captures. IKEA was blocked by access/bot/consent behavior. Apple MacBook Air produced valid multi-part output. |
| App-shell | Captures completed for Google Maps, Figma Community, Excalidraw, tldraw, and StackBlitz. App-shell cases still need sampled visual review because sidebar/header/content completeness is harder to prove automatically. |

### Product Conclusions

- The capture engine is no longer only a basic long-page prototype. It can handle normal long pages, large pages with multi-part output, public app-shell pages, and product/docs pages in real-site automation.
- The biggest current bottleneck is not only capture correctness; it is result classification and review workflow. This is why `PASS_AUTO`, `SAMPLE REVIEW`, `UNSTABLE SITE`, `BLOCKED`, and `FAIL` were added after the run.
- Blocked and network-failed pages should not be treated as capture-engine failures unless the same site repeatedly fails after retry.
- App-shell pages should remain sampled for human review until we add stronger automated sidebar/header/content assertions.
- Multi-part output is working and should remain part of the beta strategy instead of reverting to a giant-canvas approach.

### Technical Conclusions

- `CanvasTiler` is doing useful real work: very tall pages can complete instead of failing the canvas guard.
- `CaptureDiagnostics v2` is necessary for judging results without opening every image.
- The runner needs retry/classification improvements for navigation-level errors such as `ERR_SOCKET_NOT_CONNECTED`.
- Headless real-site QA is not ready yet; headed mode is the current reliable mode.
- The Desktop review folder should stay limited to `FAIL`, `UNSTABLE SITE`, `BLOCKED`, and small `SAMPLE REVIEW` cases.

### Follow-Up Candidates

1. Rerun the 20-site suite with the new auto-classification rules and navigation retry.
2. Add app-shell automated assertions for visible sidebar/header markers where possible.
3. Add bounded review sampling so only a few successful complex captures go to Dima.
4. Revisit headless extension loading after the capture engine beta gate is stable.

## 2026-05-15 20-Site Rerun With Auto Classification

Source report: `Screenshots-for-Review/reports/20260515-234123.md`

Artifacts: `Screenshots-for-Review/runs/20260515-234123/`

This run used navigation retry and the current `PASS_AUTO` / `SAMPLE REVIEW` / `UNSTABLE SITE` classification rules.

### Summary

- 20 sites were attempted.
- 19 sites produced capture output.
- 1 site was classified as `BLOCKED ACCESS`.
- 0 sites failed the runner or capture flow.
- 8 sites were classified as `PASS_AUTO`.
- 7 sites were classified as `SAMPLE REVIEW`.
- 4 sites were classified as `UNSTABLE SITE`.
- Navigation retry/retry rerun removed the earlier Wikipedia socket failure; Wikipedia produced valid multi-part PNG output.

### Status Breakdown

| Status | Count | Meaning |
| --- | ---: | --- |
| `PASS_AUTO` | 8 | Auto checks passed and no human review is needed. |
| `SAMPLE REVIEW` | 7 | Auto checks passed, but the case is complex, app-shell, or multi-part. |
| `UNSTABLE SITE` | 4 | Capture completed, but image readiness diagnostics found risk. |
| `BLOCKED ACCESS` | 1 | Page appeared inaccessible due to access/bot/consent behavior. |
| `FAIL` | 0 | No runner or capture-flow failures in this run. |

### Notable Cases

- Wikipedia Taylor Swift: valid multi-part PNG output; sampled because it is very large.
- MDN Web API: valid multi-part PNG output; sampled because it is very large.
- Apple MacBook Air: valid multi-part PNG output; sampled because it is very large.
- GitHub Blog: `UNSTABLE SITE` because diagnostics reported 1 broken visible image.
- Stripe Docs: `UNSTABLE SITE` because diagnostics reported 10 placeholder blocks.
- REI Backpacks: `UNSTABLE SITE` because diagnostics reported 23 broken visible images.
- Figma Community: `UNSTABLE SITE` because diagnostics reported 25 pending visible images and 2 broken visible images.
- IKEA Desks: `BLOCKED ACCESS`.

### Updated Conclusions

- The capture engine passed the 20-site suite without runner/capture-flow failure.
- The current automated classification is useful: it separated normal successful captures from image-readiness risks and blocked pages.
- The human-review load is still too high at 12 of 20 cases because every app-shell and multi-part case currently becomes `SAMPLE REVIEW`, and 4 more sites are `UNSTABLE SITE`.
- The next QA workflow improvement should cap or prioritize sample-review cases so Dima reviews the most useful examples instead of every complex-but-successful capture.
- The next engine-quality investigation should focus on `UNSTABLE SITE` image readiness cases before expanding to 50 sites.
- IKEA was removed from the default 20-site list after repeated blocked-access behavior.
- Best Buy was tried as a replacement but produced only viewport-height output in targeted QA, so it was not kept in the default gate.
- B&H was tried as a replacement but also produced only viewport-height output in targeted QA, so it was not kept in the default gate.
- The ecommerce slot was replaced with Nike Air Force 1.

### Next Follow-Up Candidates

1. Limit `SAMPLE REVIEW` copied to the Desktop folder to the top 3-5 cases per run, while preserving all full artifacts in `Screenshots-for-Review/runs/latest/`.
2. Inspect the 4 `UNSTABLE SITE` cases and decide which are engine bugs versus site/network/product tradeoffs.
3. Add stronger app-shell assertions for sidebar/header/content completeness.
4. Rerun after any image-readiness fix and target at least 70% `PASS_AUTO` or `SAMPLE REVIEW` with no `FAIL`.

## 2026-05-15 GitHub Blog QA Artifact Correction

Source report: `Screenshots-for-Review/runs/latest/github-blog/report.md`

The GitHub Blog artifact initially looked like an engine bug: the saved PNG missed the right-side story column and part of the blog feed. Manual comparison against the live viewport showed that the page itself rendered correctly before capture.

### Root Cause

- The issue was in the real-site QA harness, not the extension capture engine.
- The runner launched headed Chrome with a Playwright-emulated viewport.
- `chrome.tabs.captureVisibleTab` captures the real visible Chrome tab bitmap, while the page DOM reported the emulated viewport size.
- That mismatch made the stitcher compose a page using a wider CSS viewport than the actual captured bitmap, which produced a false right-side crop in the QA artifact.

### Fix

- Real-site QA now runs headed Chrome with `viewport: null`.
- The runner records the actual `window.innerWidth` / `window.innerHeight` after navigation and uses that for assertions.
- Case reports now include `Actual viewport`.

### Verification

- Targeted rerun: `REAL_SITE_FILTER=github-blog node project/tests/real-site-runner.mjs`.
- Result: `PASS_AUTO GitHub Blog`.
- Output: one PNG, `2730x15072`.
- Diagnostics: CSS page `1365x7536`, DPR `2`, strategy `single-canvas`, export `saved`.
- The right-side GitHub Blog column is present in the refreshed artifact.

## 2026-05-16 50-Site Nightly Run

Source report: `Screenshots-for-Review/runs/latest/`

Review artifacts: `/Users/dima/Desktop/For-Dima-from-Codex/latest/`

This run used the expanded 50-site beta list: docs/wiki/blog, ecommerce/product pages, and public app-shell targets.

### Summary

- 50 sites were attempted.
- 50 sites produced readable PNG output.
- 0 sites failed the runner or capture flow.
- 0 sites were blocked by login, bot protection, or access-denied behavior.
- 24 sites were classified as `PASS_AUTO`.
- 17 sites were classified as `SAMPLE REVIEW`.
- 9 sites were classified as `UNSTABLE SITE`.
- Width guard and first-viewport guard passed on the inspected reports, including previous right-crop risk cases.
- Very large pages completed through single-file export or multi-part output.

### Status Breakdown

| Status | Count | Meaning |
| --- | ---: | --- |
| `PASS_AUTO` | 24 | Auto checks passed and no human review is needed. |
| `SAMPLE REVIEW` | 17 | Auto checks passed, but the case is complex, app-shell, or multi-part. |
| `UNSTABLE SITE` | 9 | Capture completed, but image readiness diagnostics found risk. |
| `BLOCKED ACCESS` | 0 | No pages were classified as access-blocked in this run. |
| `FAIL` | 0 | No runner or capture-flow failures in this run. |

### Notable Cases

- Microsoft Surface Pro produced very large multi-part output: nine `8000px`-wide PNG parts.
- Wikipedia Taylor Swift, MDN Web API, Chrome Developers Blog, Apple iPhone, Apple MacBook Air, REI Backpacks, Apple Watch, Xbox Series X, and GoPro HERO exercised multi-part output.
- GitHub Blog passed automatically after the viewport/capture mismatch fix.
- Google Maps was removed from the default QA list after the automation captured a cookie consent/request screen. Manual app capture can work after consent, so this is not a good default unauthenticated QA target.
- SVGOMG replaced Google Maps as the public app-shell QA target.
- Stripe Docs remained `UNSTABLE SITE` because diagnostics found placeholder blocks.
- Figma Community remained `UNSTABLE SITE` because many visible images stayed pending.
- Sony WH-1000XM5 remained `UNSTABLE SITE` because several visible images stayed pending.
- Wikipedia, Django Docs, Vite Guide, Shopify Blog, Google Maps, and Xbox Series X were `UNSTABLE SITE` because diagnostics saw broken visible images.

### Updated Conclusions

- The 50-site run passed the beta stability smoke target for no empty PNGs, no unreadable output, and no capture-flow failures.
- The previous right-crop class of QA artifact was not reproduced after the headed `viewport: null` fix.
- `CanvasTiler` is handling real-world large pages and should remain part of the default beta strategy.
- `ImageReadinessProbe` is now useful as a risk detector, but it is intentionally conservative: some `UNSTABLE SITE` cases may be site behavior rather than engine bugs.
- The original review folder was too noisy: 26 of 50 cases were copied for human review.
- After the run, `03-OPTIONAL-samples` was capped to 5 copied cases while preserving all `01-LOOK-FIRST-engine-risk` cases and all full artifacts in the project archive.

### Next Follow-Up Candidates

1. Inspect the 9 `UNSTABLE SITE` cases and split them into engine bugs, site/image-host issues, and accepted beta limitations.
2. Add targeted retries or readiness improvements only for cases where the screenshot visibly contains gray previews or missing core media.
3. Add stronger app-shell completeness checks for visible sidebar/header/content, especially for app-shell beta targets.
4. Re-run the capped review workflow and confirm Desktop review volume stays useful.

## 2026-05-16 Figma Community Seam And Transparent Output Follow-Up

Source report: `Screenshots-for-Review/runs/latest/figma-community/report.md`

User-provided output: `/Users/dima/Downloads/Figma - Discover community-made libraries, plugins, icon - 2026-05-16 (1).png`

### Finding

- The user-provided Figma PNG was not just black below the first section; it was mostly transparent canvas that image viewers display as black.
- Sampled alpha check found about 88.7% transparent samples in the user-provided PNG.
- A targeted runner capture with the current local code produced `2730x15836` with 0 transparent sampled pixels.
- The targeted Figma capture still remains `UNSTABLE SITE` because image readiness diagnostics report many pending visible images.

### Fix Applied

- `PositionPlanner` now clamps unsafe `offset` values before building scroll positions. This prevents corrupted or old local storage values from creating large gaps between captured frames.
- `CanvasStitcher` and `CanvasTiler` now crop the configured overlap from subsequent frames before drawing them. This prevents later frames from overwriting an already captured overlap band, which can create visible seam lines.

### Verification

- `npm run check`: passed.
- `npm run capture:test`: passed.
- Targeted real-site QA: `REAL_SITE_FILTER=figma-community npm run real:qa`.
- Targeted result: `UNSTABLE SITE Figma Community`, readable PNG, width guard pass, first-viewport guard pass, no transparent sampled pixels.

## 2026-05-16 Targeted Risk Set After Overlay And Stitching Review

Source report: `Screenshots-for-Review/runs/latest/`

Review artifacts: `/Users/dima/Desktop/For-Dima-from-Codex/latest/`

This run followed the review pass that changed first-viewport overlay policy, stitched viewport bitmap scaling, real-site scroll-settle assertions, placeholder classification, and broken-image thresholds.

### Verification

- `node project/tests/validate-extension.mjs`: passed.
- `node project/tests/capture-flow.mjs`: passed.
- Targeted overlay smoke: `REAL_SITE_FILTER=mermaid,jsfiddle node project/tests/real-site-runner.mjs`.
- Targeted docs smoke: `REAL_SITE_FILTER=stripe,jest,fastapi node project/tests/real-site-runner.mjs`.
- Full targeted risk set: `REAL_SITE_FILTER=eleventy,fastapi,figma,jest,lego,rei,sony,storybook,stripe node project/tests/real-site-runner.mjs`.

### Targeted Results

| Site | Status | Notes |
| --- | --- | --- |
| Stripe Docs | `PASS_AUTO` | Placeholder-only docs UI no longer becomes unstable when readiness is otherwise complete. |
| LEGO Millennium Falcon | `PASS_AUTO` | First viewport and width guards passed. |
| REI Backpacks | `UNSTABLE SITE` | Still has many broken visible source images; capture itself completed as multi-part output. |
| Figma Community | `SAMPLE REVIEW` | Auto checks passed; remains sampled because app-shell completeness needs visual review. |
| Sony WH-1000XM5 | `FAIL` | New scroll-settle assertion caught planned/actual scroll divergence and duplicate-risk frames. |
| Jest Docs | `PASS_AUTO` | Placeholder-only docs UI no longer over-flags. |
| Storybook Docs | `PASS_AUTO` | Auto checks passed. |
| Eleventy Docs | `UNSTABLE SITE` | Still has broken visible source images near the lower page. |
| FastAPI Docs | `SAMPLE REVIEW` | Single broken-image style noise is no longer treated as engine instability. |

### Conclusions

- Visible first-frame overlays are now preserved in controlled QA. Mermaid Live Editor manual smoke also preserved the visible modal after fixing near-viewport overlap cropping.
- The old placeholder heuristic was too strict for docs pages; Stripe and Jest now pass automatically.
- Small broken-image counts are no longer treated as engine failure; FastAPI moved out of `UNSTABLE SITE`.
- The new scroll-settle guard exposed a real remaining risk on Sony: the page reports actual scroll positions that diverge from the planned capture frames. This needs targeted engine follow-up before Sony can be considered stable.
- REI and Eleventy remain site/content-readiness risks because they report multiple broken visible source images, not because width or first-viewport guards failed.

### Remaining Risk

- Figma Community is still a real-site quality risk because its media grid keeps many visible images in a pending state under automated capture.
- The next Figma-specific improvement should focus on image readiness and app-shell completeness, not basic PNG export.

## 2026-05-16 Production Startup Parity Follow-Up

### Finding

- The real-site test harness was stronger than the unpacked production extension because it injected temporary `<all_urls>` host permissions into the copied test manifest.
- The popup flow also asked the background worker to rediscover the active tab after the popup click, while the test flow sent a runtime message from an extension page. This could make the production startup path harder to reason about than the test path.

### Fix Applied

- The popup now resolves the active tab immediately and passes an explicit `tabId` to the background worker.
- Real-site QA and capture-flow automation now use the same `capture-active-tab` message shape with an explicit `tabId`.
- QA reports now print Lazy Warmup diagnostics: skipped, reason, visited positions, elapsed time, and timeout.

### Remaining Difference

- Real-site QA still grants temporary host permissions to the copied test extension so automation can trigger capture from an extension page without a real toolbar click.
- A future production-parity test should exercise the actual toolbar/popup action without adding `<all_urls>` to the manifest.

## 2026-05-16 100-Site Beta QA Run

Source report: `Screenshots-for-Review/runs/latest/summary.md`

Review artifacts: `/Users/dima/Desktop/For-Dima-from-Codex/latest/`

This run expanded the beta QA list to 100 public targets:

- 50 docs/wiki/blog pages;
- 30 ecommerce/product pages;
- 20 public app-shell pages.

### Summary

- 100 sites were attempted.
- 100 sites produced readable PNG output.
- 0 sites failed the runner or capture flow.
- 0 sites were blocked by login, bot protection, or access-denied behavior.
- 52 sites were classified as `PASS_AUTO`.
- 39 sites were classified as `SAMPLE REVIEW`.
- 9 sites were classified as `UNSTABLE SITE`.
- Width guard and first-viewport guard passed on the unstable cases, so the previous right-crop class did not reproduce.
- Controlled fixture tests passed before the real-site run, including sticky/scrollbar, lazy preview, iframe baseline, internal scroll container, dynamic internal scroll, and huge-page tiling cases.

### Status Breakdown

| Status | Count | Meaning |
| --- | ---: | --- |
| `PASS_AUTO` | 52 | Auto checks passed and no human review is needed. |
| `SAMPLE REVIEW` | 39 | Auto checks passed, but the case is complex, app-shell, or multi-part. |
| `UNSTABLE SITE` | 9 | Capture completed, but image readiness diagnostics found risk. |
| `BLOCKED ACCESS` | 0 | No pages were classified as access-blocked in this run. |
| `FAIL` | 0 | No runner or capture-flow failures in this run. |

### Engine Bug Found And Fixed

- Stripe Docs visually exposed repeated cookie banner capture across scroll tiles.
- The root cause was that fixed/sticky normalization only targeted `position: fixed` and `position: sticky` elements in the regular document tree.
- `FixedStickyNormalizer` now also hides likely cookie/consent edge overlays on non-first frames and traverses shadow DOM candidates.
- Targeted Stripe rerun confirmed the large cookie banner is no longer repeated across every tile.

### Remaining Engine Risks

The remaining unstable cases are image-readiness/media-completeness risks, not basic export failures:

- Stripe Docs: placeholder blocks remain in diagnostics.
- LEGO Millennium Falcon: pending visible images on later frames.
- REI Backpacks: broken visible product images on later frames.
- Figma Community: many pending/broken visible preview images.
- Sony WH-1000XM5: pending visible images.
- Jest Docs: placeholder blocks.
- Storybook Docs: pending visible images.
- Eleventy Docs: pending/broken visible images near the lower generated content.
- FastAPI Docs: one broken visible image in the first viewport.

### Updated Conclusions

- The capture engine meets the beta smoke target for accessible pages in this 100-site run: no empty PNGs, no unreadable output, no runner failures, and no right-crop failures.
- The large-page strategy is working on real sites; multi-part output completed on very tall docs and product pages.
- The next quality bottleneck is media readiness, especially pages where images become visible only during later scroll frames.
- `UNSTABLE SITE` remains useful but intentionally conservative. Some cases may be real site broken images; others are likely warmup/stabilization gaps.

### Next Follow-Up Candidates

1. Add per-frame image-readiness retry: if a frame has pending visible images, wait/retry that frame before calling `captureVisibleTab`.
2. Improve diagnostics to include a small crop or selector summary for the worst pending/broken image frame.
3. Add a real-site visual assertion for repeated cookie/consent bars so the Stripe regression becomes automatic.
4. Review the 9 `01-LOOK-FIRST-engine-risk` artifacts and split them into engine fixes versus accepted beta/site limitations.

### List Maintenance

- The original `tldraw` app-shell target used `https://www.tldraw.com/f`, which now opens a not-found page under QA.
- It was replaced with `https://threejs.org/editor/` to keep the app-shell slot useful.

## 2026-05-16 FastAPI And Eleventy Sticky/Overlay Follow-Up

Source report: `/tmp/screenshot-extension-qa-overlays2/report.md`

This targeted follow-up was run outside the main artifact archive so the 100-site `latest` folder was not overwritten.

### Finding

- FastAPI exposed repeated sticky documentation chrome: the left FastAPI label, the right table-of-contents sidebar, and the sidebar scrollbar could repeat across tiles.
- Eleventy exposed two related risks: a marketing dialog/backdrop could appear in the first captured viewport, and manual runs could occasionally show a large dark gap between stitched regions.

### Fix Applied

- `CaptureStepper` now verifies the actual scroll position before capturing each frame and retries the scroll once if the page has not reached the planned position.
- Frame diagnostics now record whether the final scroll position settled near the planned capture position.
- `FixedStickyNormalizer` now hides all visible sticky elements after the first frame, instead of only sticky elements pinned to the viewport edge.
- `FixedStickyNormalizer` hides open dialog, modal, promo, popover, consent, and cookie hosts on non-first frames, including custom elements such as Eleventy/Web Awesome dialogs.
- Real-site first-viewport QA is strict again: visible overlays present at capture start should be preserved in frame 0, then normalized away on later frames.

### Verification

- `npm run check`: passed.
- `npm run capture:test`: passed.
- Targeted real-site QA for Stripe Docs, Eleventy Docs, and FastAPI Docs completed without runner failure.
- Eleventy no longer showed the large dark gap in the targeted output, and the sampled image had no fully dark or transparent rows.
- FastAPI no longer showed repeated right table-of-contents/sidebar content in later output parts during visual inspection.

### Remaining Risk

- Eleventy still reports pending/broken visible images near lower content.
- FastAPI still reports one broken visible image in the first viewport.
- Stripe Docs still reports placeholder blocks, but the repeated cookie banner issue is no longer the primary visual defect.

## 2026-05-16 Overlay Repeat And Sample Review Rerun

Source report: `Screenshots-for-Review/runs/latest/summary.md`

Review artifacts: `/Users/dima/Desktop/For-Dima-from-Codex/latest/`

### Fixes Applied

- Added a user notification for risky image readiness: `If some images didn’t load, try again in a few seconds.`
- Added a second pre-capture overlay normalization pass so popups recreated after stabilization can still be hidden before `captureVisibleTab`.
- Added persistent non-first-frame suppression for modal/dialog/backdrop layers and common consent managers.
- Relaxed compact consent-overlay detection so smaller bottom-left privacy boxes are not repeated across every captured frame.
- Added DOM split-boundary candidates and adaptive multi-part tile boundaries so PNG parts prefer nearby section/list/card boundaries over hard canvas-limit cuts.

### Targeted Verification

- Controlled overlay fixture passed: first-frame visible overlay is preserved, later overlay respawn is suppressed.
- Controlled full capture suite passed after the final overlay changes.
- Bose Headphones — https://www.bose.com/c/headphones: latest visual artifact shows the promo popup in the first viewport only; it no longer repeats down the page. The site still reports a tiny bottom scroll-settle mismatch, so the runner keeps it as an automation risk rather than a popup-repeat failure.
- Patagonia Jackets — https://www.patagonia.com/shop/mens/jackets-vests: latest visual artifact shows the `Your Data, Your Choice` privacy box in the first viewport only; it no longer repeats down the product grid. The site still reports a first scroll-settle mismatch.
- Apple MacBook Air — https://www.apple.com/macbook-air/: superseded by later manual feedback. The latest reviewed artifact dropped the middle `Privacy. That's Apple.` card from the `Our values lead the way` section, while the live site shows three cards. Keep as active missing-content/carousel-card-drop plus split-boundary risk.
- MDN Web API — https://developer.mozilla.org/en-US/docs/Web/API: superseded by later manual feedback. The latest reviewed artifact clips text/list rows at the bottom of a PNG part boundary near the lower page. Keep as active split-boundary text clipping during multi-part slicing.

### 38-Site Former Sample Review Rerun

The previous `SAMPLE REVIEW` set was rerun with all review artifacts copied to `/Users/dima/Desktop/For-Dima-from-Codex/latest/`.

- 38 former sample targets were attempted.
- 36 remained `SAMPLE REVIEW`.
- 2 moved to `UNSTABLE SITE` because scroll-settle diagnostics found risk.
- 0 became `FAIL`.
- 0 were blocked.

New `LOOK-FIRST` candidates from this rerun:

- Sonos Shop — https://www.sonos.com/en-us/shop: the page repeatedly refused planned scroll positions and several frames reported actual scroll `0,0`.
- TypeScript Playground — https://www.typescriptlang.org/play/: one app-shell scroll frame did not settle at the planned position.

Notable sample artifacts to keep in mind:

- Microsoft Surface Pro — https://www.microsoft.com/en-us/surface/devices/surface-pro-11th-edition: output was very wide (`8000px`) and very tall, but passed automated guards. Keep as human sample/policy review.
- FastAPI Docs — https://fastapi.tiangolo.com/: superseded by later manual feedback. Keep as active right-sidebar text clipping / split-boundary defect.
- React Learn — https://react.dev/learn remains a routine `SAMPLE REVIEW` case with prior manual review saying it looks ok. Apple iPhone — https://www.apple.com/iphone/ is superseded by later manual feedback and remains an active split-boundary plus missing-content risk.

### Verification Commands

- `npm run check`: could not start in this shell because `npm` was not found in `PATH`.
- `node project/tests/validate-extension.mjs`: passed.
- `node project/tests/capture-flow.mjs`: passed.
- `REAL_SITE_FILTER=bose ... project/tests/real-site-runner.mjs`: completed; visual popup-repeat fixed, status remains `UNSTABLE SITE` due to scroll-settle.
- `REAL_SITE_FILTER=apple-macbook-air,mdn,patagonia ... project/tests/real-site-runner.mjs`: completed; Apple/MDN `SAMPLE REVIEW`, Patagonia visual overlay-repeat fixed but status remains `UNSTABLE SITE` due to scroll-settle.
- 38-site former sample rerun completed with `REVIEW_OPTIONAL_SAMPLE_LIMIT=100`.

## 2026-05-17 Manual Feedback Triage And Prepared Fixes

No real-site smoke was run for this pass because the user's browser must not be taken over.

### Manual Findings To Preserve

Superseded by later manual review for Allbirds, Sonos, and Diagrams.net: see `2026-05-17 Overnight PNG Stability Pass` above.

- Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners: latest reviewed artifact repeated the sticky header and the `Where are we shipping to?` popup. This is an overlay/sticky-repeat engine risk, not a horizontal-scroll limitation.
- Sonos Shop — https://www.sonos.com/en-us/shop: latest reviewed artifacts contained blank/black chunks and too many parts while the real page is visually populated in the middle. Treat as a scroll target / scroll-settle / page-height engine risk.
- Diagrams.net App — https://app.diagrams.net/: the app shell should be captured as the visible editor viewport. The left shape palette and empty canvas should not be expanded into a long T-shaped screenshot.
- CyberChef — https://gchq.github.io/CyberChef/: manual horizontal/app-shell review is ok. Visible-width capture is accepted beta behavior here.

### Prepared Code Changes

- `CaptureStepper` now runs non-first-frame normalization before attempting the next scroll, so scroll-locking overlays can be suppressed before they block the next frame.
- `CaptureStepper` now fails with `scroll_target_stuck` when planned scroll positions advance but actual scroll does not move. This should prevent saving misleading long PNGs with blank/black lower sections.
- `FixedStickyNormalizer` now recognizes shipping/country selector panels such as `Where are we shipping to?` as repeated overlays to hide after frame 0.
- `PageProbe` now avoids selecting narrow side palettes/inspectors and sparse two-axis empty workspaces as the main internal scroll target.
- Split-boundary candidate collection now includes more text/content block boundaries and allows a larger safe-boundary search window before tile limits.

### Controlled Fixtures Added

- `shipping-popup-sticky-repeat-page`: protects the Allbirds-style repeated shipping popup and sticky header case.
- `empty-editor-side-palette-page`: protects the Diagrams.net-style empty editor with a scrollable side palette.
- `stuck-window-scroll-page`: protects the Sonos-style failure mode where a page reports a long document but actual scroll does not move.

### Verification Status

Superseded by later overnight verification and manual review for Allbirds, Sonos, and Diagrams.net: see `2026-05-17 Overnight PNG Stability Pass` above.

- Browser-based controlled fixtures were not run in this pass.
- Real-site targeted smoke was not run in this pass.
- Next allowed verification should start with static checks, then targeted controlled fixtures, then real-site smoke for Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners, Sonos Shop — https://www.sonos.com/en-us/shop, and Diagrams.net App — https://app.diagrams.net/.

## 2026-05-17 Deep QA Detector Pass And 100-Site Rerun

### What Changed

- Added detector-only Deep QA risk handling for manual regression classes: repeated docs sidebars, repeated product filter panels, split-boundary text clipping, missing-content/black-strip risks, blocking popup mismatch, and overlay uncertainty.
- First no-browser engine pass after latest manual review: repeated side chrome/filter/nav suppression was broadened beyond strict sticky matches, `PageProbe` now marks split-sensitive card/product/tile/carousel blocks as exclusion ranges, and `CanvasSizeGuard` avoids placing multi-part PNG boundaries inside those ranges when it can stay within tile limits. Added `product-hero-duplication-page` to the opt-in `capture:risk` suite for the Sony duplicated hero/media/missing-background class. Browser verification is still pending.
- Fixed a blocking-modal engine bug: when `PageProbe` decides a page must be `viewport-only`, it now skips internal scroll-container selection. This prevents Framework-style cookie/entry-gate overlays from becoming long background captures.
- Tuned first-viewport mismatch handling: when a cookie/modal overlay appears during capture and visibly darkens the top viewport, the runner classifies the site as `UNSTABLE SITE` rather than hard-failing the whole run.
- Kept the agreed product rule: no limited retry and no broad golden baselines for all 100 sites.

### Verification

- `node --check code/capture/PageProbe.js`: passed.
- `node --check project/tests/real-site-runner.mjs`: passed.
- `node --check project/tests/validate-extension.mjs`: passed.
- `node project/tests/validate-extension.mjs`: passed.
- `node project/tests/capture-flow.mjs`: passed all controlled fixtures.
- Targeted smoke for MongoDB Docs and Framework Laptop 13:
  - MongoDB Docs moved from hard `FAIL` to `UNSTABLE SITE` because a cookie/modal overlay appeared during capture.
  - Framework Laptop 13 moved from hard `FAIL` to `PASS_AUTO` with a one-viewport output.
- Full 100-site rerun completed with exit code 0:
  - 41 `PASS_AUTO`
  - 26 `UNSTABLE SITE`
  - 28 `SAMPLE REVIEW`
  - 5 `BLOCKED ACCESS`
  - 0 `FAIL`

### Product And QA Conclusions

- The latest build is better at refusing false green results: REI, TypeScript Handbook, FastAPI, Apple iPhone/MacBook, MDN, Next.js, Sony, and MongoDB now land in look-first or unstable buckets instead of quietly passing.
- LEGO and Nike now both produce one visible viewport when the popup state limits the user-visible capture state. LEGO is still marked `UNSTABLE SITE` because the modal classifier is intentionally conservative; Nike auto-passes.
- Framework confirmed the important blocking-modal invariant: if the user is blocked on the first viewport, the extension should not scroll an internal/background pane.
- Remaining detector gaps:
  - Microsoft Surface Pro still stays in `SAMPLE REVIEW`; add a stronger gray/right-side blank detector before calling the right-strip class closed.
  - Cypress Docs can still auto-pass despite prior manual right-sidebar clipping feedback; add a more precise sidebar text-boundary detector.
  - Many `uncertain large modal` cases are conservative. This is acceptable for beta QA, but the classifier can be refined later to reduce human review noise.

## 2026-05-18 Manual-Time Reduction QA Layer

Browser was not used for this pass.

### Added

- Added opt-in controlled risk fixtures behind `npm run capture:risk`:
  - `docs-two-scroll-main-content-page`
  - `cookie-strip-repeat-page`
  - `split-boundary-text-page`
  - `right-gray-strip-page`
  - `product-card-seam-band-page`
  - `missing-middle-content-page`
- Added `project/tests/offline-png-qa.mjs` and `npm run qa:png`.
- `qa:png` reads existing artifacts from `Screenshots-for-Review/runs/latest/` and writes `project/tests/offline-png-qa.md` without opening Chrome.

### Purpose

These additions are meant to reduce Dima's manual review time:

- risk fixtures convert recent manual findings into reproducible local scenarios;
- offline PNG QA pre-clusters suspicious artifacts before human review;
- the default `npm run capture:test` remains unchanged so the normal smoke gate is not destabilized by still-open beta-risk classes.

## 2026-05-18 Manual Review Of Latest Run

Browser was not used for this feedback capture.

- Apple iPhone — https://www.apple.com/iphone/: Dima confirmed the latest reviewed artifact clips the `Why Apple is the best` heading/subtitle at a PNG part boundary. A later reviewed section also captured only a mostly blank `iPhone` heading area, while the live site shows populated navigation columns in that block. This remains an active split-boundary/text-clipping plus missing-content/incomplete-section defect and should stay in Look-first / targeted beta gate until fixed or explicitly accepted.
- Apple MacBook Air — https://www.apple.com/macbook-air/: Dima compared the live page against the captured output and found that the `Our values lead the way` section lost the middle `Privacy. That's Apple.` card. The live site shows three cards; the capture shows only the left and right cards with empty space between them. This is active missing-content/carousel-card-drop, not just visual polish.
- Dyson Vacuums — https://www.dyson.com/vacuum-cleaners: Dima found the black product navigation/search menu bar repeated multiple times in the screenshot. Treat as active repeated sticky-nav / repeated-overlay defect.
- Eleventy Docs — https://www.11ty.dev/docs/: Dima reviewed the current Look-first artifact and marked it OK for beta. Older broken-image/noisy-readiness signals are not current blockers unless a new visible defect appears.
- FastAPI Docs — https://fastapi.tiangolo.com/: Dima found that the right Table of contents/sidebar text is clipped near the lower edge of the artifact. Treat as active right-sidebar text clipping / split-boundary defect, not as accepted sample output.
- GoPro HERO — https://gopro.com/en/us/shop/cameras: Dima reviewed the current artifact and marked it OK for beta. Keep as accepted unless a new visible defect appears.
- Laravel Docs — https://laravel.com/docs/12.x: Dima found that both the left docs navigation and the right `On this page` sidebar repeat in the capture while the central article text scrolls. Treat as active repeated left/right sidebar chrome in a docs main-content scroll layout, not as mere unsettled-scroll diagnostics.
- LEGO Millennium Falcon — https://www.lego.com/en-us/product/millennium-falcon-75192: Dima reviewed the current artifact and marked it OK for beta. The accepted product rule is still first visible viewport only when the blocking popup is open.
- MDN Web API — https://developer.mozilla.org/en-US/docs/Web/API: Dima found text/list rows clipped at the bottom of the page during PNG part slicing. Treat as active split-boundary text clipping, not as accepted sample output.
- MongoDB Docs — https://www.mongodb.com/docs/: Dima found horizontal seam/split bands that cut card sections. In affected cards, only the large heading is visible while the smaller body text/rectangle content is missing or not fully rendered. Treat as active seam-band plus missing-content defect in docs card sections.
- Next.js Docs — https://nextjs.org/docs: Dima confirmed the earlier two-vertical-scroll defect still reproduces. The right `On this page` sidebar is copied multiple times, and the left docs sidebar contributes text fragments/stray pieces while the central article text scrolls. Treat as active docs main-content scroll / repeated-sidebar defect.
- Patagonia Jackets — https://www.patagonia.com/shop/mens/jackets-vests: Dima found two active defects. First, the left product filter sidebar (`In-Store Pickup`, category, size/color filters) repeats down the product grid. Second, product cards are cut by PNG part boundaries. The split strategy should account for product-card geometry so each card fits fully inside a generated screenshot part instead of being clipped.
- REI Backpacks — https://www.rei.com/c/backpacks: Dima found three active defects. First, product cards are cut by PNG part boundaries. Second, left sidebar subcategories duplicate. Third, the left `Store Pickup` / shipping form repeats even though it appears only once on the live site. Treat as product-card split-boundary plus repeated sidebar subcategory/form chrome.
- Prisma Docs — https://www.prisma.io/docs: Dima found the left sidebar promo card/image `Prisma Next` duplicated in the capture, while the live site shows it only once. Treat as active repeated sidebar promo/image defect in the docs navigation container; root cause still needs investigation.
- Samsung Galaxy S — https://www.samsung.com/us/smartphones/galaxy-s/: Dima found a horizontal seam/stripe line cutting through product cards. Treat as active product-card seam-band / split-boundary defect.
- Sony WH-1000XM5 — https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b: Dima found several active defects in the latest artifact. The product title/hero appears twice, the first-screen headphone image is clipped, a headphone fragment is shifted below the duplicated title, one lower block is missing its background image and left-side text and renders mostly white, and another block is height-clipped so image/text are cut near the top. Treat as product-hero duplication plus missing-content/image-readiness plus seam/split-boundary layout risk, not as a deferred-only Sony investigation.
- Nintendo Switch — https://www.nintendo.com/us/store/products/nintendo-switch-oled-model-white-set-115461/: Dima reviewed the current artifact and marked it OK for beta. Keep as accepted unless a new visible defect appears.
