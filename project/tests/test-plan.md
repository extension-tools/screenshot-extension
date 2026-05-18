# Test Plan

## Strategy

Testing is split into three layers:

- Static checks for extension files.
- Visual regression screenshots for real websites.
- Capture-flow automation for the extension itself.

## Static Checks

Run:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run check
```

This validates:

- `code/manifest.json`;
- locale JSON files;
- JavaScript syntax for worker, capture/content modules, and options script.

## Visual Regression

Run:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run visual:baseline
npm run visual:test
```

The site list lives in `project/tests/visual-sites.json`.

Visual regression answers:

> Did a code or environment change visibly alter the pages we use as reference cases?

It does not yet prove that the extension capture flow itself works.

## Capture Flow

Run:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run capture:test
```

`project/tests/capture-flow.mjs` launches headed Playwright Chromium with the unpacked extension and runs extension-level smoke cases:

- start a local fixture server;
- open each configured fixture case;
- trigger `Capture Entire Page` through the extension context;
- for `download` cases, wait for the downloaded PNG;
- verify downloaded PNGs are readable;
- verify configured PNG dimension assertions;
- verify marker-color assertions for sticky and scrollbar fixtures;
- verify lazy-load marker assertions for pre-capture warmup fixtures;
- verify image-readiness diagnostics for pending, ready, and broken image states;
- verify visible iframe marker assertions for iframe baseline fixtures;
- verify internal scroll-container bottom marker assertions for app-shell fixtures;
- verify the large-page split notification event for tiled-output captures;
- verify that unsafe single-file PNG export is recorded as parts instead of attempted as a giant canvas;
- verify CaptureDiagnostics v2 fields for large-page tiled output;
- verify CaptureDiagnostics v2 failure reason for an unsupported too-many-parts page;
- for `error` cases, verify a controlled failure and no PNG download.

Artifacts are written to:

```text
project/tests/capture-results/latest/
```

Each case also gets its own report and artifacts under:

```text
project/tests/capture-results/latest/cases/<case-name>/
```

For local debugging, set `CAPTURE_CASE_FILTER=<case-name-fragment>` to run one controlled case without rewriting the whole suite.

The current capture-flow suite is still a smoke layer. It does not yet replace manual QA or visual regression for real websites.

Active cases:

- `basic-long-page`: verifies basic full-page capture.
- `sticky-scrollbar-page`: verifies fixed/sticky markers do not repeat and internal scrollbar marker colors are hidden.
- `visible-overlay-first-frame-page`: verifies a visible fullscreen backdrop + modal/promo overlay is preserved in the first viewport and not repeated across later frames.
- `shipping-popup-sticky-repeat-page`: verifies a first-frame shipping/country popup is preserved once, and neither that popup nor the sticky header repeats later.
- `lazy-load-page`: verifies pre-capture warmup triggers a below-fold lazy marker before the first real tile.
- `lazy-preview-grid-page`: verifies visible lazy previews are pending before warmup, ready after warmup, and present in the final PNG.
- `late-lazy-grid-page`: verifies Figma-like delayed preview cards do not remain gray placeholders after warmup and per-frame readiness waits.
- `broken-image-diagnostics-page`: verifies broken visible images are reported in diagnostics while capture still completes.
- `huge-page-tiling`: verifies a page above the single-canvas height limit downloads multiple valid PNG parts, emits `capture.large-page-split`, records `singleFileExportAttempt.decision = parts`, and stores CaptureDiagnostics v2.
- `too-many-parts-page`: verifies a page beyond the configured output-part limit fails before download and records `failureReason = too_many_output_parts`.
- `iframe-baseline-page`: verifies visible iframe content is captured and iframe diagnostics are reported.
- `sticky-toc-repeat-page`: verifies FastAPI-like sticky docs header, left brand, right TOC, and root scrollbar markers do not repeat across frames.
- `product-sticky-zone-page`: verifies DJI-like product configurator behavior where a large sticky product media panel remains visible during the product-zone scroll while a small floating helper widget does not repeat.
- `internal-scroll-container-page`: verifies one high-confidence internal scroll container is captured.
- `empty-editor-side-palette-page`: verifies an empty editor app shell with a scrollable side palette captures the visible viewport only instead of expanding the palette/canvas.
- `scroll-settle-gap-page`: verifies 11ty-like scroll settle timing does not create large dark gaps and still captures final content.
- `short-chat-internal-scroll-page`: verifies app-shell chrome remains present when an internal container is captured.
- `dynamic-internal-scroll-page`: verifies bounded internal scroll-height growth is remeasured after warmup.
- `stuck-window-scroll-page`: verifies a page that reports long content but does not actually scroll fails with `scroll_target_stuck` instead of saving blank/black lower PNG areas.

Opt-in beta risk fixtures:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run capture:risk
```

`capture:risk` includes the normal capture-flow suite plus fixtures that intentionally model the latest manual regression classes. They are opt-in so the ordinary smoke gate stays stable while these classes are still being fixed.

- `docs-two-scroll-main-content-page`: models Next.js/TypeScript-style two vertical scroll containers where the narrow left docs sidebar must not become the primary capture target.
- `cookie-strip-repeat-page`: models Stripe-style cookie strips that must appear only in the first viewport.
- `split-boundary-text-page`: models Apple/FastAPI/Cypress-style large text and subtitle content near a split boundary.
- `right-gray-strip-page`: models Microsoft-style right-side gray/blank strip risk.
- `product-card-seam-band-page`: models Samsung-style horizontal seam/band artifacts across product cards.
- `rei-backpacks-product-grid-page`: models REI/Patagonia-style ecommerce listing pages using REI-like generated class names, narrow `li` product tiles, and a sticky internally scrollable left filter. Tall multi-part output must not cut product-card interiors, and left filter/sidebar forms or category blocks must not repeat.
- `missing-middle-content-page`: models Sony/Cloudflare-style missing middle/lower content or black strip substitution.
- `apple-values-three-card-carousel-page`: models Apple-style three-card values carousel where the middle Privacy card must not disappear while the left and right cards remain.
- `apple-iphone-incentive-boundary-page`: models Apple iPhone's "Why Apple is the best place to buy iPhone" incentive gallery where the heading/subcopy must not be clipped before the buying cards.
- `apple-iphone-directory-columns-page`: models Apple iPhone's lower directory section where Explore/Shop/More columns must be loaded instead of capturing only a mostly blank `iPhone` heading area.
- `lazy-footer-links-page`: models Allbirds-style ecommerce footer links that lazy-load near the bottom; Company/Information link columns must be present before moving to real sites.
- `product-hero-duplication-page`: models Sony-style duplicated product hero/title, clipped product media, missing background sections, and lower top-text clipping.

## Offline PNG QA

Run:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run qa:png
```

`project/tests/offline-png-qa.mjs` analyzes existing PNG artifacts only. It does not open Chrome and does not recapture pages. By default it reads `Screenshots-for-Review/runs/latest/` and writes:

```text
project/tests/offline-png-qa.md
```

By default it runs in risk-aware mode: site-specific checks are guided by `deepQa.riskTags` from `project/tests/real-sites.json`, while severe generic signals such as blank output and black strips are still reported. This keeps the report small enough to review. Use `PNG_QA_DISCOVERY=1 npm run qa:png` for a broader, noisier discovery scan.

It looks for cheap visual signals that reduce manual review load:

- blank or low-entropy output;
- right-side blank or gray strips;
- vertical black strips;
- repeated left sidebar or filter-panel-like regions across PNG parts;
- repeated horizontal overlay/strip signatures across PNG parts;
- narrow horizontal seam/band artifacts.

Use `PNG_QA_ARTIFACT_ROOT=/path/to/run npm run qa:png` to analyze a non-latest run. Use `PNG_QA_FAIL_ON_ISSUES=1 npm run qa:png` only in stricter CI-style experiments; for beta triage the default is report-only.

## Real-Site QA Notes

- Operational commands and artifact-publishing rules live in `project/tests/qa-runbook.md`.
- Runtime capture policy lives in `project/docs/capture-risk-policy.md`. Use it as the source of truth for actual engine `riskFlags` (`fixed_sticky`, `visible_nav_overlay`, `blocking_modal`, `inaccessible_iframe`) and keep those separate from QA-only `deepQa.riskTags`.
- `project/tests/real-site-runner.mjs` supports single PNG and multi-part PNG outputs.
- The automated beta list excludes login-only pages unless a prepared logged-in profile is explicitly used.
- Use `REAL_SITE_FILTER="wikipedia,mdn" npm run real:qa` for targeted CanvasTiler checks.
- Full generated real-site artifacts are written to `Screenshots-for-Review/runs/latest/`.
- Use `REAL_SITE_ARCHIVE_ROOT="/tmp/screenshot-extension-qa" REAL_SITE_QA_REPORT_PATH="/tmp/screenshot-extension-qa/report.md"` when a targeted diagnostic run should not overwrite the main `Screenshots-for-Review/runs/latest/` archive or `project/tests/real-site-qa.md`.
- Disputed cases, blocked pages, and all `SAMPLE REVIEW` cases are copied to `/Users/dima/Desktop/For-Dima-from-Codex/` as top-level prioritized folders.
- Set `REVIEW_OPTIONAL_SAMPLE_LIMIT` only when you explicitly want to cap copied `SAMPLE REVIEW` cases; full artifacts always remain archived in the project.
- Real-site QA uses `PASS_AUTO`, `SAMPLE REVIEW`, `UNSTABLE SITE`, `BLOCKED LOGIN`, `BLOCKED ACCESS`, and `FAIL` to avoid sending every successful capture to human review.
- Gray lazy preview grids on beta target segments count as a failure, not a pass.
- Obvious capture-engine bugs should be fixed immediately and rerun; product tradeoffs should be moved to beta notes.
- Real-site case reports include CaptureDiagnostics v2 for page size, bitmap size, DPR, strategy, scroll target, export status, and failure reason.
- Real-site and capture-flow reports include Lazy Warmup diagnostics so production/test differences are visible: skipped, reason, visited positions, elapsed time, and timeout.
- Real-site case reports include width and first-viewport guards that compare output PNG width, per-part widths, viewport screenshot width, DPR, expected bitmap width, and sampled first-screen similarity to catch right-crop or viewport/capture mismatches.
- Real-site case reports include blank/app-shell, width/right-side, and blocking-modal guards. These detect low-entropy blank output, app-shell startup screens, over-wide output, right-side blank/gray strips, and scroll-locking modals whose capture should stop at the first visible viewport.
- Real-site QA records unsettled scroll frames with planned/actual positions. Unsettled frames are treated as `UNSTABLE SITE` risk hints because they can create duplicated bands or missed content, but they are not automatic runner failures when the capture still completes.
- First-viewport guard is strict about visible overlays: the first captured viewport should preserve visible modal, paywall, promo, ad, and cookie UI that the user saw before capture.
- Real-site and capture-flow PNG artifacts preserve the user-facing filename generated by the extension instead of being renamed to technical test names.
- Real-site image-readiness diagnostics include pending images with/without source; automated stability status is driven by pending images with a source, broken images, and placeholder blocks.
- Interpreted real-site conclusions are tracked in `project/tests/real-site-findings.md` so one-off run reports do not become the only source of QA learning.

## Small Change Verification Flow

For small capture-engine changes, do not run the full 100-site list by default.
The default mandatory path for behavior changes is:

1. Run `npm run check`.
2. Run `npm run capture:test`.
3. Run 1-2 affected real-site smoke cases with `REAL_SITE_FILTER`.
4. Run the full targeted list only if smoke is green or the change touches shared capture logic.

The targeted beta gate must include at least 15 high-risk real sites. A shorter targeted smoke is acceptable for local development, but it is not enough for beta sign-off.

Do not treat the targeted risk set as a fixed hand-written list. The current set is generated from `deepQa.riskTags` in `project/tests/real-sites.json` and should change as manual review opens, closes, or reclassifies risk. Accepted/neutral sites should be removed from the risk set unless they are intentionally kept as explicit regression controls.

Use this command to print the current targeted risk set, site URLs, risk tags, and a ready-to-run `REAL_SITE_FILTER` command:

```bash
npm run risk:sites
```

For the current Mac beta gate, Sony remains a dedicated dynamic-scroll/layout-shift risk case; REI and Patagonia remain product-grid/sidebar/seam risk cases; LEGO and Nike remain blocking-popup regression controls; docs sites with sidebars remain split-boundary/repeated-sidebar controls.
Real-site QA records unsettled scroll frames as an `UNSTABLE SITE` status hint with planned/actual positions, not as an automatic runner failure, because dynamic pages can still produce a visually usable PNG after drawing at the actual scroll position.
Mermaid Live Editor and JSFiddle are targeted overlay-preservation smoke candidates when fixed/sticky/overlay handling changes.

### When Real-Site Smoke Is Required

Run at least one targeted real-site smoke after changes that can affect production capture behavior or real-site classification:

- extension runtime code under `code/`, including capture, content, worker, popup trigger flow, manifest permissions, download/export, canvas sizing, cleanup, or filename behavior;
- lazy-load, image-readiness, sticky/fixed, scrollbar, scroll-settle, internal-scroll, iframe, or tiling logic;
- real-site runner assertions, QA status classification, review artifact routing, browser launch behavior, or diagnostics that drive `PASS_AUTO`, `SAMPLE REVIEW`, `UNSTABLE SITE`, `BLOCKED`, or `FAIL`;
- dependency, browser, or environment changes that can affect headed Chrome capture.

Choose the smallest smoke that matches the risk. Examples:

- `REAL_SITE_FILTER=stripe-docs npm run real:qa` for placeholder/readiness classification;
- `REAL_SITE_FILTER=fastapi-docs npm run real:qa` for docs sticky/sidebar or broken-image rules;
- `REAL_SITE_FILTER=figma-community npm run real:qa` for app-shell or delayed media readiness;
- `REAL_SITE_FILTER=lego-millennium-falcon npm run real:qa` for first-viewport and ecommerce lazy media risks.

### When Real-Site Smoke Can Be Skipped

Skipping real-site smoke is acceptable when the change cannot alter the unpacked extension's runtime behavior or real-site QA interpretation. Examples:

- docs, specs, beta notes, findings, or checklist-only edits;
- comments, formatting, or naming-only edits that do not change executable code;
- fixture-only changes where `npm run capture:test` directly covers the affected behavior;
- visual-regression baseline or report formatting changes that do not affect extension code or real-site status rules;
- artifact organization changes outside `code/`, `project/tests/real-site-runner.mjs`, and real-site config.

When skipping real-site smoke, say why in the final handoff. If there is doubt, run one targeted smoke instead of guessing.

## Nightly 100-Site QA Plan

The nightly run is for broad beta-stability discovery, not for polishing every site manually.

Run order:

1. Run `npm run check` to catch manifest, locale, and syntax regressions before opening browsers.
2. Run `npm run capture:test` to verify controlled fixtures for sticky/fixed, lazy previews, iframe baseline, internal scroll container, huge-page tiling, diagnostics, and readable filenames.
3. Run `npm run real:qa` against all sites in `project/tests/real-sites.json`.
4. Read the generated run summary in `Screenshots-for-Review/runs/latest/`.
5. Open `/Users/dima/Desktop/For-Dima-from-Codex/README-FIRST.md` and inspect only the prioritized cases first.
6. Fix obvious engine bugs immediately and rerun the smallest affected subset with `REAL_SITE_FILTER`.
7. Move product tradeoffs and known non-beta limits to beta notes instead of treating them as surprise regressions.

Success criteria for the nightly pass:

- the 100-site list parses and runs without runner-level crashes;
- at least 90% of accessible, non-blocked sites produce readable PNG output;
- no accessible beta-target site has right-crop, empty PNG, or obvious first-viewport mismatch;
- docs/wiki/blog and ecommerce/product pages do not show gray lazy preview grids in core content;
- selected app-shell targets include visible main content, visible sidebar or left navigation when present, and visible top chrome/header when present;
- selected app-shell targets with horizontal workspaces are judged on the visible shell and visible working area; hidden content to the right is not required for beta;
- huge pages either save a valid single image, valid parts, or a clear controlled limitation;
- blocked login, bot protection, and access-denied pages are classified as blocked, not engine failures.

Morning triage:

- Start with `01-LOOK-FIRST-engine-risk`.
- Use `02-Samples` for all complex captures that passed auto checks but were selected for human sample review.
- Then skim `03-BLOCKED-pages` only to confirm classification.
- Update `project/tests/real-site-findings.md` with only durable conclusions: fixed engine bug, new engine risk, accepted beta limitation, or removed/flaky site.

## QA Roadmap

The next QA quality step is a staged deep-check strategy, not a baseline for all 100 sites at once:

1. Add Deep QA mode without heavy baselines first. It should use defect-class detectors for repeated overlays/sidebars, seam or band artifacts, split-boundary text clipping, missing content anchors, black/gray strips, and wrong scroll target signals.
2. After the detectors are useful, add golden baselines with masks for only the 10-20 most important regression sites.
3. Do not create visual-regression baselines for all 100 sites initially; that would add noise and maintenance cost before the detectors are stable.

Current real-site golden baselines are tracked in `project/tests/golden-baselines/real-sites.json`. Use them only for listed regression-critical sites when a run lands in Look-first/Unstable or before closing a manual regression on that site; do not make them always-on for every 100-site run.

Current Deep QA implementation is intentionally detector-only: it can move suspicious captures to `UNSTABLE SITE` and add report diagnostics, but it does not retry or recapture for the user. Sites with known manual regressions carry `deepQa.riskTags` in `project/tests/real-sites.json`; the runner uses those tags to enable class-specific checks without adding site-specific fixes.

Latest full 100-site measurement on the detector-only build completed with 0 `FAIL`: 41 `PASS_AUTO`, 26 `UNSTABLE SITE`, 28 `SAMPLE REVIEW`, and 5 `BLOCKED ACCESS`. The next detector priorities are Microsoft-style right-side gray/blank output and Cypress/FastAPI-style sidebar text clipping near split boundaries.

## Release Gate

Before a release candidate:

- run `npm run check`;
- run `npm run visual:test`;
- run `npm run capture:test`;
- complete `project/tests/manual-checklist.md`;
- apply the app-shell sidebar rule in `project/docs/beta-stability.md` for real-site QA.
