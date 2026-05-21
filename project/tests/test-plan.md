# Test Plan

This file explains what we test and why. Operational commands and artifact publishing rules live in `project/tests/qa-runbook.md`.

## Strategy

Testing is split into four layers:

- static checks for manifest/locales/JavaScript syntax;
- controlled extension capture-flow fixtures;
- offline PNG analysis of existing artifacts;
- targeted and broad real-site QA.

## Static Checks

Purpose: catch manifest, locale, and JavaScript syntax regressions before opening browsers.

Primary command:

```bash
npm run check
```

Direct fallback when `npm` is unavailable:

```bash
node project/tests/validate-extension.mjs
```

## Capture Flow Fixtures

Purpose: verify extension behavior end to end in controlled local pages.

Command:

```bash
npm run capture:test
```

`project/tests/capture-flow.mjs` launches headed Playwright Chromium with the unpacked extension, opens fixture pages, triggers `Capture Entire Page`, waits for downloads, validates PNGs, and checks diagnostics.

Core fixture coverage:

- basic full-page capture;
- fixed/sticky normalization and cleanup;
- visible first-frame overlay preservation;
- shipping/country popup repeat suppression;
- lazy warmup and image readiness;
- broken image diagnostics;
- iframe baseline visibility;
- one high-confidence internal scroll container;
- app-shell side-palette rejection;
- scroll-settle gap prevention;
- stuck window scroll controlled failure;
- huge-page tiled output and download lifecycle diagnostics;
- too-many-parts controlled failure;
- readable CaptureDiagnostics v2 fields.

Use `CAPTURE_CASE_FILTER=<case-name-fragment>` for one controlled case.

## Opt-In Risk Fixtures

Purpose: model active manual regression classes without destabilizing the ordinary smoke gate.

Command:

```bash
npm run capture:risk
```

Risk fixture classes:

- two-scroll docs/main-content layouts;
- repeated cookie strips and popup chrome;
- split-boundary text/subtitle clipping;
- right gray/blank strip risk;
- product-card seam/band and tiled-boundary cuts;
- missing middle/lower content;
- Apple carousel/directory missing-content cases;
- lazy footer links;
- Sony-style product hero duplication and media clipping;
- passive fixed-background quirks;
- known lightbox root capture;
- fullscreen menu must not become lightbox root.

## Offline PNG QA

Purpose: reduce manual review load without opening Chrome or recapturing pages.

Command:

```bash
npm run qa:png
```

`project/tests/offline-png-qa.mjs` reads existing artifacts, defaults to `Screenshots-for-Review/runs/latest/`, and writes `project/tests/offline-png-qa.md`.

It reports cheap visual signals:

- blank/low-entropy output;
- right-side blank/gray strips;
- vertical black strips;
- repeated sidebar/filter/overlay signatures;
- repeated sticky/header/sidebar chrome inside one tall PNG;
- narrow seam/band artifacts.

It is report-only by default. Use `PNG_QA_DISCOVERY=1` for broader/noisier scans and `PNG_QA_ARTIFACT_ROOT=/path/to/run` for non-latest artifacts.

## Real-Site QA

Purpose: verify behavior on public websites and classify outputs for review.

Source files:

- `project/tests/real-sites.json`: QA target DB;
- `project/tests/real-site-runner.mjs`: runner;
- `project/tests/qa-runbook.md`: commands and publishing;
- `project/docs/capture-risk-policy.md`: runtime policy source of truth.

Real-site reports include:

- CaptureDiagnostics v2;
- lazy warmup diagnostics;
- width and first-viewport guards;
- blank/app-shell and right-side guards;
- blocking-modal guard;
- unexpected short-page risk;
- dimmed backdrop continuity guard;
- planned vs actual scroll diagnostics;
- export/download lifecycle data;
- user-facing filenames.

QA-only observations such as `deepQa.riskTags`, `visible_overlay_candidate`, and `unexpectedShortPageRisk` must stay separate from runtime engine `riskFlags`.

Review publishing contract: all `SAMPLE REVIEW` cases are copied to the active Desktop review folder by default. Use `REVIEW_OPTIONAL_SAMPLE_LIMIT` only when an intentionally capped diagnostic review is requested; full artifacts remain archived.

## Small Change Verification Flow

For small capture-engine changes:

1. Run static validation.
2. Run controlled capture-flow fixtures.
3. Run 1-2 affected real-site smoke cases with `REAL_SITE_FILTER`.
4. Run broader targeted risk set only if the smoke is green or the change touches shared capture logic.

The targeted beta gate must include at least 15 high-risk real sites. Smaller smoke is useful during development but is not beta sign-off.

Real-site smoke is required after changes to:

- extension runtime code under `code/`;
- capture/content/worker/popup trigger flow;
- manifest permissions;
- download/export/canvas sizing/cleanup/filename behavior;
- lazy-load, image-readiness, sticky/fixed, scrollbar, scroll-settle, internal-scroll, iframe, or tiling logic;
- real-site runner assertions, QA status classification, artifact routing, browser launch behavior, or diagnostics that drive status.

Real-site smoke can be skipped for docs/specs/checklist-only edits, comments/formatting, fixture-only edits covered by `capture:test`, and report formatting that cannot change runtime or real-site classification. Say why when skipping.

## Nightly / Broad QA

Purpose: broad discovery, not polishing every site manually.

Run order:

1. Static validation.
2. Controlled capture-flow fixtures.
3. Full real-site QA against `project/tests/real-sites.json`.
4. Review summary and prioritized Desktop folder.
5. Fix obvious engine bugs with smallest affected rerun.
6. Move product tradeoffs and known non-beta limits to `project/docs/beta-notes.md`.

Success criteria:

- 100-site list runs without runner-level crash;
- at least 90% of accessible, non-blocked sites produce readable PNG;
- no accessible beta-target site has right-crop, empty PNG, or obvious first-viewport mismatch;
- selected docs/ecommerce/product pages do not show gray lazy preview grids in core content;
- selected app-shell targets include visible main content, sidebar/left nav when present, and top chrome/header when present;
- huge pages produce valid single image, valid parts, or clear controlled limitation;
- login/bot/access-denied pages are classified as blocked, not engine failures.

## Deep QA Roadmap

Current Deep QA is detector-only. It can move suspicious captures to `UNSTABLE SITE` or `SAMPLE REVIEW`, but it must not retry or recapture for the user.

Detector priorities:

- split-boundary/seam placement through text/cards/product-grid rows;
- tiled-output boundaries that cut product cards;
- repeated overlays/sidebars/chrome;
- missing content anchors;
- black/gray strips;
- wrong scroll-target signals;
- Samsung-style page-height / planned-vs-actual scroll diagnostics before dimmed overlay policy changes.

Golden baselines are intentionally limited to key regression sites in `project/tests/golden-baselines/real-sites.json`. Do not baseline all 100 sites by default.

## Release Gate

Before a release candidate:

- run static validation;
- run visual regression if baselines are relevant;
- run controlled capture-flow fixtures;
- run targeted beta real-site gate;
- complete `project/tests/manual-checklist.md`;
- apply beta stability criteria from `project/docs/beta-stability.md`.
