# Current Context

Use this file first when restoring context for Screenshot Extension work. Read the larger docs only when the task needs their detail.

## Product Goal

Screenshot Extension is a Chrome MV3 extension for one-click full-page PNG capture from real websites. The current beta goal is stable PNG capture on macOS for normal pages, product/ecommerce pages, docs/blog/wiki pages, and selected app-shell pages.

## Current Scope

- Chrome-only MV3 extension in `code/`.
- One primary command: `Capture Entire Page`.
- PNG downloads through Chrome downloads.
- Full-page capture by viewport stepping and canvas stitching.
- Multi-part PNG output for very tall pages.
- Original scroll restoration after success or failure.
- Fixed/sticky normalization after frame 0.
- Explicit `capturePolicy` derived from engine `riskFlags`, including `visible_nav_overlay`: preserve frame 0, then suppress/normalize repeated nav overlay chrome on frames 1+.
- Runtime capture policy is documented in `project/docs/capture-risk-policy.md`: engine `riskFlags` are separate from QA-only `deepQa.riskTags`.
- Lazy-load warmup and per-frame image readiness waits.
- One high-confidence internal scroll container for app-shell pages.
- Visible-width behavior for horizontal app-shell/workspace content.

## Current Product Rules

- Visible overlays present at capture start must appear in the first viewport only and must not repeat down the page.
- Blocking popups that prevent normal user scrolling, and entry-gate interstitials that replace the user's capture state, must be captured as the user-visible blocked first viewport only. The extension must not hide the popup and scroll the background as if the user closed it.
- Large popups that appear during scroll but do not clearly block user scrolling should not automatically stop capture. Continue capture, suppress repeated overlay artifacts where possible, and classify uncertain cases for review instead of `PASS_AUTO`.
- Routine successful real-site captures should be `PASS_AUTO`.
- Complex but readable captures can be `SAMPLE REVIEW`.
- Quality-risk captures should be `UNSTABLE SITE`.
- Login, bot, consent, and access walls should be `BLOCKED LOGIN` or `BLOCKED ACCESS`, not engine failures.
- Empty/blank output, right-side blank/gray strips, first-viewport mismatch, and over-wide output are `FAIL`.

## Current Risk Cases

- LEGO Millennium Falcon: blocking popup / capture-state mismatch. Current fix captures one visible viewport when the LEGO Play Zone or similar entry-gate interstitial appears.
- Nike Air Force 1: same blocking-popup product rule as LEGO. Manual user capture in the blocked-popup state produces only the first visible viewport, which is the expected result. If automation captures the full site behind the popup, that artifact is invalid for that state. Nike is grouped immediately after LEGO in `real-sites.json`.
- Mermaid Live Editor: blank app-shell startup/readiness risk. Current runner guard waits for non-blank app-shell state; the latest targeted smoke was not white.
- Microsoft Surface Pro: over-wide output / right-side gray blank-space risk. Current `PageProbe` width clamp fixes the 8000px/right-gray output; transient patience/error pages should be classified as blocked/access-like.
- REI Backpacks: latest manual review found three active defects: product cards are cut by PNG part boundaries, left sidebar subcategories duplicate, and the left `Store Pickup` / shipping form repeats even though it appears only once on the live site. The saved REI HTML shows the root cause pattern: real product tiles are narrow `li` grid items with generated class names, and the left filter is a narrow `position: sticky` panel with its own vertical scroll and generated class names. Treat as product-card split-boundary plus repeated sticky filter/sidebar chrome, not only deferred image-readiness. Controlled coverage exists in `rei-backpacks-product-grid-page`, which uses REI-like generated classes, forces tiled output, and checks that PNG part boundaries avoid product-card interiors while sidebar form/category markers appear once and do not duplicate.
- Patagonia Jackets: latest manual review found two active defects: the left product filter sidebar (`In-Store Pickup`, categories, size/color filters) repeats down the product grid, and product cards are cut by PNG part boundaries. Multi-part slicing should respect product-card boundaries so a card fits fully inside a generated screenshot part instead of being clipped.
- Sony WH-1000XM5: current manual review found multiple active defects: the product title/hero section is duplicated, the first-screen headphone image is clipped and a headphone fragment is shifted below the duplicated title, a lower block is missing its background image/left-side text and renders mostly white, and another block is height-clipped so image/text are cut near the top. Treat as active product-hero duplication, missing-content/image-readiness, seam/split-boundary, and black-strip/layout-shift risk, not a deferred-only investigation.
- TypeScript Handbook: manual first-half review found the left docs sidebar captured multiple times. Treat as repeated navigation/sidebar chrome defect while capturing main documentation content.
- JSFiddle, Figma Community, and GoPro HERO are manually accepted unless a new artifact shows a new defect.
- Cypress Docs second-half sample is acceptable for beta, but has minor right contents/sidebar text clipping near a PNG part boundary. The latest targeted run still auto-passes as `SAMPLE REVIEW`; treat as split-boundary/sidebar polish unless manual review finds a worse artifact.
- DJI Mini 4 Pro: manual review found a real product-page stitching defect missed by auto guards. The engine now preserves large sticky product media/content panels after the first frame and suppresses repeated floating helper widgets more aggressively. Controlled `product-sticky-zone-page` passes and the latest targeted DJI run auto-passes as `SAMPLE REVIEW`; manual visual confirmation is still useful before closing completely.
- FastAPI Docs: latest manual review found the right Table of contents/sidebar text clipped near the lower edge. This is an active right-sidebar text clipping / split-boundary defect and should stay in Look-first risk until fixed or explicitly accepted for beta.
- Cloudflare Blog: manual first-half review found that the bottom block in the look-first artifact has no visible footer/bottom closure. Needs live-page comparison later; possible truncated page end, missing late content, or site-state mismatch.
- MDN Web API: latest manual review found text/list rows clipped at the bottom of a PNG part boundary near the lower page. Treat as active split-boundary text clipping during multi-part slicing.
- Next.js Docs: latest manual review confirms the earlier two-vertical-scroll defect still reproduces. The right `On this page` sidebar is copied multiple times, and the left docs sidebar contributes text fragments/stray pieces while the central article text scrolls. If a narrow left scroll container is confidently docs navigation/sidebar and the wider second scroll area is the main content, capture should follow the main content and crop/reuse the sidebar rather than stitching sidebar scroll fragments.
- MongoDB Docs: manual review found horizontal seam/split bands cutting card sections so some cards show only the large heading while the smaller body text/rectangle content is missing or not fully rendered. Treat as seam-band plus missing-content defect in docs card sections.
- Laravel Docs: manual review found both the left docs navigation and the right `On this page` sidebar repeated while the central article text continues scrolling. Treat as repeated left/right sidebar chrome in a docs main-content scroll layout, not just unsettled scroll noise.
- Prisma Docs: manual review found the left sidebar promo card/image `Prisma Next` duplicated in the capture, while the live site shows it only once. Treat as repeated sidebar promo/image in a docs navigation container; root cause still needs investigation.
- Stripe Docs: manual first-half review found the cookie-acceptance strip repeated in both first and second multi-part screenshots. Expected behavior is first viewport/first part only; treat as current overlay-repeat regression despite older notes that Stripe repeat was improved.
- Samsung Galaxy S: latest manual review found a horizontal seam/stripe line cutting through product cards. Treat as product-card seam-band / split-boundary defect; the line is not real page content and should not cut cards.
- Apple iPhone: manual review found two active defects: the `Why Apple is the best` heading/subtitle is clipped at a PNG part boundary, and a lower `iPhone` section captured as mostly blank even though the live site shows navigation columns there. Treat as split-boundary text clipping plus missing-content/incomplete-section risk.
- Apple MacBook Air: manual review found the `Our values lead the way` carousel/cards section missing the middle `Privacy. That's Apple.` card in the captured output, while the live site shows three cards. Treat as missing-content/carousel-card-drop risk in addition to split-boundary risk.
- Dyson Vacuums: manual review found the black product navigation/search menu bar repeated multiple times down the screenshot. Treat as repeated sticky-nav / repeated-overlay defect.

## Current Engineering Direction

1. Completed code layer:
   - QA-runner guards for blank/low-entropy, app-shell loaded state, width/right-side sanity, and blocking modal state;
   - engine policy for `scroll-lock` and `entry-gate-text` popups: capture one visible viewport only;
   - uncertain large popups continue capture and become review signals instead of automatic stops;
   - `PageProbe` width clamp for normal window pages;
   - narrowed sticky suppression so large sticky product media/content panels are not hidden after the first frame, while sticky docs/sidebar/navigation chrome and floating widgets can still be suppressed;
   - expanded floating helper/widget suppression for small right/left-edge chat/help/support/icon-like controls.
   - Deep QA detector-only risk tags are active for known manual regressions, including repeated docs sidebars, product filter panels, split-boundary text clipping, missing-content/black-strip risks, and blocking popup mismatch.
   - `PageProbe` now respects `viewport-only` blocking modal decisions before selecting an internal scroll container, so entry-gate/cookie modals cannot accidentally turn into a long internal-scroll capture.
   - First-viewport mismatch caused by a dynamic cookie/modal overlay appearing during capture is classified as `UNSTABLE SITE` instead of a hard `FAIL`, while true blocking-modal mismatch remains guarded.
   - First technical pass after the latest manual review: `FixedStickyNormalizer` now suppresses repeated side chrome/filter/nav panels after the first frame even when the repeated visual container is not a simple `position: sticky` match; `PageProbe` emits split exclusion ranges for card/product/tile/carousel-like blocks; `CanvasSizeGuard` avoids placing multi-part output boundaries inside those ranges when possible.
2. Completed verification:
   - static extension validation passed;
   - controlled `capture-flow` passed;
   - targeted LEGO/Mermaid/Microsoft smoke completed with 0 `FAIL`;
   - second-half 100-site run completed with 0 `FAIL`;
   - first-half 50-site run on the current sticky/widget build completed with 0 `FAIL`: 17 `PASS_AUTO`, 18 `SAMPLE REVIEW`, 11 `UNSTABLE SITE`, 4 `BLOCKED ACCESS`;
   - current 100-site measurement snapshot has 0 automated `FAIL` across the latest full first-half run plus the latest full second-half run; second-half sites affected by the latest sticky/widget work were also targeted again.
   - review publishing red-team check completed: `/Users/dima/Desktop/For-Dima-from-Codex` is the active folder, all 18 first-half `SAMPLE REVIEW` cases are copied there, and `validate-extension` now guards against default sample caps and timestamp-folder publishing.
   - latest full 100-site run on the current build completed with exit code 0: 41 `PASS_AUTO`, 26 `UNSTABLE SITE`, 28 `SAMPLE REVIEW`, 5 `BLOCKED ACCESS`, 0 `FAIL`.
   - latest review folder `/Users/dima/Desktop/For-Dima-from-Codex` contains the expected buckets: `01-LOOK-FIRST-engine-risk`, `02-Samples`, and `03-BLOCKED-pages`; all 28 `SAMPLE REVIEW` cases are included.
   - targeted beta gate must include at least 15 high-risk real sites from the dynamic `deepQa.riskTags` set; smaller targeted smoke is allowed during development but does not count as beta sign-off.
3. Next work:
   - QA roadmap: Deep QA mode has started in the real-site runner as detector-only checks using `deepQa.riskTags`; it flags repeated overlays/sidebars, seam/band risks, split-boundary text risks, missing-content/black-strip risks, and blocking-popup mismatches as `UNSTABLE SITE` diagnostics without limited retry or baselines;
   - browser permission is now an explicit process gate: `Браузер нет` means no Chrome/Playwright-backed command at all, including local `capture:risk` fixtures; interrupted browser-backed artifacts must be marked invalid and not used as beta evidence;
   - offline PNG QA has started as a no-browser report-only layer: `npm run qa:png` analyzes existing `Screenshots-for-Review/runs/latest/` artifacts for repeated sidebars/overlays, seam bands, black strips, and right-side gray/blank areas;
   - opt-in controlled beta-risk fixtures are available through `npm run capture:risk`; they model two-scroll docs layouts, repeated cookie strips, scrollable dimmed-popup backdrop state, split-boundary text, right gray strips, product-card seam bands, missing middle content, and lazy-loaded footer links without adding them to the default smoke gate;
   - `lazy-footer-links-page` was added to `capture:risk` for the Allbirds-style case where right-side footer Company/Information links do not load or disappear near the bottom of a long ecommerce capture;
   - `apple-values-three-card-carousel-page` was added to `capture:risk` for the Apple MacBook Air-style values section where the middle Privacy card disappears while the left and right cards remain;
   - `apple-iphone-incentive-boundary-page` was added to `capture:risk` for the Apple iPhone-style `Why Apple is the best place to buy iPhone` section where the heading/subcopy can be clipped just before the buying cards;
   - `apple-iphone-directory-columns-page` was added to `capture:risk` for the Apple iPhone lower directory section where Explore/Shop/More columns should load instead of leaving a mostly blank `iPhone` heading area;
   - `dimmed-popup-scroll-state-page` was added to `capture:risk` for scrollable popup states where the dialog panel should appear only in frame 0 but the dimmed-page backdrop must remain across later frames; it now models vendor consent roots like OneTrust, removes the original backdrop during scripted scroll, and verifies that the engine synthesizes an equivalent dim layer instead of letting later frames become undimmed;
   - engine `riskFlags` now materialize as an explicit `capturePolicy` in diagnostics; `visible_nav_overlay` skips pre-frame-0 lazy warmup, preserves the user-visible first frame, then suppresses visible nav overlays after frame 0 so Apple-style global menus do not repeat.
   - `product-hero-duplication-page` was added to `capture:risk` for the Sony-style duplicated hero/title, clipped product media, missing background section, and lower top-text clipping class;
   - golden baselines have started for key regression sites in `project/tests/golden-baselines/real-sites.json` (`Cloudflare Blog`, `Dyson Vacuums`, `Next.js Docs`); use them for Look-first/Unstable review or before closing those site-specific manual regressions, not as always-on comparison for every 100-site run;
   - later add masked golden baselines for only 10-20 key regression sites; do not baseline all 100 sites initially;
   - review first-half and second-half prioritized artifacts if needed;
   - keep Sony as an active targeted risk case until product-hero duplication, missing content, and split/seam clipping are fixed or explicitly accepted;
   - ask for manual visual review of the latest targeted DJI/Cypress artifacts;
   - keep FastAPI right sidebar text clipping as an active defect; keep Cypress-style right sidebar text clipping as polish/regression-watch unless manual review finds it unacceptable;
   - consider making blocked/error-page classification stricter for short one-viewport ecommerce pages.
   - strengthen detectors for Microsoft-style right-side gray output and Cypress-style right sidebar text clipping; the latest run still leaves those as sample/polish review rather than confident engine-risk classification.

## Source Of Truth Files

- `README.md`: project structure and runnable extension entry points.
- `project/docs/product.md`: product direction and constraints.
- `project/docs/beta-stability.md`: beta gate and product rules.
- `project/docs/capture-risk-policy.md`: source of truth for engine `riskFlags`, capture policies, and their separation from QA `deepQa.riskTags`.
- `project/docs/beta-notes.md`: accepted beta limits and known tradeoffs.
- `project/tests/test-plan.md`: verification strategy and real-site QA rules.
- `project/tests/qa-runbook.md`: operational QA commands and artifact-publishing rules.
- `project/tests/real-site-findings.md`: durable real-site triage conclusions.
- `project/tests/real-sites.json`: real-site QA target list.
- `project/specs/`: detailed capability specs.
- `project/product-tasks/`: product task history.

## Token Budget Rule

For a fresh chat, read this file plus `project/tests/qa-runbook.md` for QA/run/publishing work. If the task touches capture decision-making, read `project/docs/capture-risk-policy.md` next. Then open only the specific source-of-truth file related to the current task. Avoid loading all specs, all product tasks, and the full `real-site-findings.md` unless the user asks for historical detail.
