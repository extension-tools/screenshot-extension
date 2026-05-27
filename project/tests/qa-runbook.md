# QA Runbook

Use this file as the operational source of truth for running Screenshot Extension QA and publishing artifacts.

## Active Review Folder

The active folder for Dima is:

```text
/Users/dima/Desktop/For-Dima-from-Codex
```

Normal real-site QA publishes review artifacts directly into that folder.

Expected top-level folders:

- `01-LOOK-FIRST-engine-risk`: `FAIL` and `UNSTABLE SITE`.
- `02-Samples`: all `SAMPLE REVIEW` cases by default.
- `03-BLOCKED-pages`: `BLOCKED LOGIN` and `BLOCKED ACCESS`.

Do not publish the current review set to a timestamped Desktop folder. Timestamped or temporary folders are only for full project archives or explicitly separate diagnostic roots.

## Real-Site QA Commands

Default full real-site run:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
node project/tests/real-site-runner.mjs
```

## Release Package Audit

Before preparing a Chrome Web Store package, run:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run check
```

The release package candidate is the extension source under:

```text
code/**
```

Repository support files such as QA documentation, validation scripts, and review logs may be committed, but they must not be included in the Chrome Web Store package.

`validate-extension.mjs` checks that local QA artifacts, saved HTML dumps, generated screenshots, golden baseline images, local archives, package files, and secret-like files are ignored. It also checks that required extension runtime files such as `code/manifest.json`, `code/worker.js`, icons referenced by the manifest, popup/options pages, and capture runtime files are not ignored.

If an actual package dry-run or file-list command exists, run it and verify that the package contains only extension files. If no package file-list command exists, do not claim final package readiness yet; record the limitation and keep package file-list inspection as a required follow-up before publishing.

## Diagnostics Mode

Normal user captures use `diagnosticsMode: "production"` and must store only the production diagnostics whitelist. Production diagnostics stay local, do not request new browser permissions, do not change `manifest.json`, and must not add telemetry, network upload, cookies, storage scraping, form-value collection, exact OS versions, or device identifiers.

Fixture and real-site QA runners explicitly set `diagnosticsMode: "qa"`. QA mode may keep verbose local diagnostics and write local `report.md` files under `project/tests` or the active review folder. Treat `report.md`, `summary.md`, and `fs.writeFile` outputs as QA artifacts only; they must not be used as evidence that production extension storage may keep verbose diagnostics.

Targeted real-site run:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
REAL_SITE_FILTER="lego,fastapi" node project/tests/real-site-runner.mjs
```

Diagnostic run that should not overwrite the project archive:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
REAL_SITE_ARCHIVE_ROOT="/tmp/screenshot-extension-qa" \
REAL_SITE_QA_REPORT_PATH="/tmp/screenshot-extension-qa/report.md" \
node project/tests/real-site-runner.mjs
```

If you intentionally need a separate review folder for diagnostics, set `REVIEW_ARTIFACT_ROOT` to that folder. Do not use a per-run `latest` folder as the default review target.

## Offline PNG QA

After a real-site run, run this before asking Dima to review screenshots:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run qa:png
```

This reads the existing PNGs in `Screenshots-for-Review/runs/latest/` and writes:

```text
project/tests/offline-png-qa.md
```

It does not open Chrome. Use it to pre-cluster visual risks such as repeated sidebars, repeated horizontal overlays, seam bands, black strips, and right-side gray/blank areas. By default it is risk-aware and uses `deepQa.riskTags`; set `PNG_QA_DISCOVERY=1` only for a broader, noisier discovery scan. Treat the report as a triage aid: it should reduce what Dima has to inspect, not replace confirmed product review.

## Capture Risk Policy

Before changing capture behavior, read `project/docs/capture-risk-policy.md`. It is the source of truth for actual engine `riskFlags`, frame 0 vs frames 1+ fixed/sticky handling, blocking-modal `viewport-only` behavior, width clamping, internal scroll target selection, split-boundary policy, and the boundary between engine flags and QA-only `deepQa.riskTags`.

`unexpectedShortPageRisk` is QA-only. Use it when a configured real-site case expects a multi-screen page, but the pre-capture DOM is near one viewport and no high-confidence internal scroll target exists. Treat it as an invalid/short render signal to rerun or review, not as a production capture mode.

## Controlled Risk Fixtures

The standard smoke suite is:

```bash
npm run capture:test
```

The opt-in beta-risk fixture suite is:

```bash
npm run capture:risk
```

`capture:risk` includes additional fixtures for the latest manual regression classes: two-scroll docs layouts, repeated cookie strips, scrollable dimmed-popup backdrop state, split-boundary text, right gray strips, product-card seam bands, missing middle content, Apple-style three-card carousel missing-center cases, Apple iPhone incentive heading/subcopy clipping, Apple iPhone lower directory columns missing, lazy-loaded footer links, and duplicated product hero/media sections. Use it while fixing those classes; do not treat failures there as surprising until the corresponding engine fix is being worked.

Current product Must classes to keep in mind during QA:

- split-boundary / seam placement through text, docs cards, product cards, or product-grid rows;
- tiled-output boundaries cutting product cards between PNG part 01 and part 02;
- capture progress / notification / completion feedback;
- PDF export fidelity built on the same capture output.

## Publishing Rules

- By default, copy every `SAMPLE REVIEW` case to `02-Samples`.
- Use `REVIEW_OPTIONAL_SAMPLE_LIMIT` only when the user explicitly asks for a capped subset.
- Always copy every `FAIL`, `UNSTABLE SITE`, `BLOCKED LOGIN`, and `BLOCKED ACCESS` case.
- Every copied case folder must contain `README-FIRST.md`, `report.md`, `viewport-before-capture.png`, and at least one capture PNG.
- After publishing a run, send Markdown links for every site copied to `01-LOOK-FIRST-engine-risk` into the thread. Use the original site URL from the case `report.md` or run metadata, not just the folder name, so Dima can open each Look-first case directly from the chat.
- The runner prints a `LOOK-FIRST Markdown URLs for thread:` block at the end of every real-site run and writes the same links into `/Users/dima/Desktop/For-Dima-from-Codex/README-FIRST.md`. Treat that block as a mandatory handoff item, not optional report detail.
- Before a targeted beta gate, run `npm run risk:sites`. The command prints the current high-risk URLs and a ready `REAL_SITE_FILTER`; the gate must contain at least 15 high-risk sites from `deepQa.riskTags`, not a stale hand-written list.

## Golden Baselines

- Real-site golden baselines live in `project/tests/golden-baselines/real-sites.json` with PNG files under `project/tests/golden-baselines/real-sites/`.
- Use a golden baseline when a listed site lands in `01-LOOK-FIRST-engine-risk` or `UNSTABLE SITE` after an engine or QA change.
- Use a golden baseline before closing a manual regression on that site, especially repeated sidebars/overlays, split-boundary clipping, missing content, and footer completeness.
- Do not use golden baselines for every user capture or every 100-site run by default; keep broad runs detector-first so they stay fast and low-noise.
- Do not baseline all 100 sites initially. Keep the set to the highest-risk 10-20 sites, and prefer controlled fixtures for reusable bug classes.

## Browser Permission and Interrupt Rules

- `Браузер нет` means no command that opens Chrome/Playwright/Chrome for Testing. This includes `capture:test`, `capture:risk`, `real:qa`, targeted real-site runs, and any local fixture run that drives the extension through a browser.
- After the user changes browser permission to `Браузер нет`, do not run browser-backed fixtures "just to verify" unless the user explicitly switches back to `Браузер да`.
- Long browser-backed runs must be started as interruptible work. If the user interrupts the turn or asks to stop, immediately check for `capture-flow`, `real-site-runner`, Playwright, and Chrome for Testing processes and stop them before doing anything else.
- Any artifact folder produced by an interrupted or unauthorized browser-backed run must be treated as invalid and must not be used as beta evidence.

## Status Meaning

- `PASS_AUTO`: auto checks passed; not copied to the active review folder.
- `SAMPLE REVIEW`: auto checks passed, but the site is complex enough to warrant human review.
- `UNSTABLE SITE`: capture completed, but diagnostics found a strong quality risk that Dima should look at first.
- `BLOCKED LOGIN` / `BLOCKED ACCESS`: the site showed login, bot protection, consent wall, access denied, or equivalent blocked content. This is not an engine failure.
- `FAIL`: capture engine or QA assertion failed.

## Look-First Classification

Use `01-LOOK-FIRST-engine-risk` for strong signals only:

- runtime `FAIL`;
- dynamic modal/overlay appearing during capture;
- blocking popup state mismatch;
- dimmed backdrop continuity mismatch;
- blank, missing-content, image-readiness, width, right-side blank/gray, or export/save failures;
- Deep QA issues that are specific enough to indicate a likely bad screenshot.

Do not send a site to Look First only because a broad risk heuristic fired. These cases should be `SAMPLE REVIEW` unless paired with a stronger failure:

- possible repeated sidebar/nav/filter candidate across output parts;
- possible repeated left docs/sidebar chrome below the first viewport;
- split-boundary text risk from tags alone;
- small unsettled scroll-frame drift;
- uncertain large modal where capture continued and other guards passed.

This keeps Look First focused on likely product defects. Broad detector hints still appear in the per-site report so they can guide manual review without making stable sites look broken.

## Guardrails

`node project/tests/validate-extension.mjs` must fail if:

- the active review folder is no longer `/Users/<user>/Desktop/For-Dima-from-Codex`;
- `SAMPLE REVIEW` defaults back to a cap such as 5;
- review publishing can be redirected through a separate `REVIEW_LATEST_DIR`;
- README or test-plan stop documenting that all sample review cases are copied by default;
- capture risk policy docs stop listing the actual engine `riskFlags` and their policies.

Run this check before and after changing QA publishing code.

## Context Hygiene

For a fresh Codex chat, read:

1. `project/docs/current-context.md`;
2. this file;
3. `project/docs/capture-risk-policy.md` when the task touches capture decisions or risk classification;
4. only the specific report or finding file needed for the current task.

Avoid loading the full historical `real-site-findings.md` unless historical triage detail is required.
