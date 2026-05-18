# Screenshot Extension

Chrome-only MV3 prototype based on `schomery/easy-screenshot/v3`.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder: `/Users/dima/Projects/Screenshot Extension/code`.
5. Open any normal `https://` page and click the extension icon.

## Current Scope

- One command: Capture Entire Page.
- Toolbar icon opens a one-button popup.
- Saves the captured image with Chrome downloads.
- Uses the step-based visible-tab capture flow from the upstream project.
- Restores the original window scroll position after capture.
- Reduces repeated fixed/sticky elements after the first capture frame.
- Hides root page scrollbars and one dominant internal scroll-container scrollbar during capture.
- Captures one high-confidence internal scroll container on app-shell pages.
- Waits briefly for per-frame layout stabilization before capture.
- Saves very large pages as multiple safe PNG parts instead of allocating an unsafe single canvas.

## Project Structure

- `code/`: runnable Chrome extension. Use this folder for `Load unpacked`.
- `project/docs/current-context.md`: short context bootstrap for new Codex chats.
- `project/docs/product.md`: product direction, users, value, and constraints.
- `project/docs/architecture.md`: extension architecture and component boundaries.
- `project/docs/roadmap.md`: phased product plan.
- `project/docs/decisions.md`: architectural decisions and tradeoffs.
- `project/product-tasks/`: product task per meaningful change.
- `project/specs/`: one specification per major capability.
- `project/tests/test-plan.md`: overall test strategy.
- `project/tests/qa-runbook.md`: operational QA commands and artifact-publishing rules.
- `project/tests/manual-checklist.md`: release and manual QA checklist.
- `project/tests/visual-sites.json`: visual-regression site list.
- `project/tests/capture-flow.mjs`: headed extension-level smoke test.
- `project/tests/real-sites.json`: real-site QA site list.
- `Screenshots-for-Review/`: screenshots and QA artifacts for human review.
- `project/changelog.md`: versioned product changes.

## Regression Checks

Install test dependencies once:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm install
```

Create or refresh baseline screenshots:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run visual:baseline
```

Run the safety check after code changes:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm test
```

Edit `project/tests/visual-sites.json` to choose the sites that must be screenshotted. The latest report is written to `project/tests/visual-results/latest/report.md`.

Run the extension-level capture smoke test:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run capture:test
```

This launches headed Playwright Chromium, loads the unpacked extension, opens configured local fixture cases, triggers capture, and verifies the expected result for each case. The latest summary report is written to `project/tests/capture-results/latest/report.md`; per-case reports are written under `project/tests/capture-results/latest/cases/`.

Current capture-flow cases:

- `basic-long-page`
- `sticky-scrollbar-page`
- `visible-overlay-first-frame-page`
- `shipping-popup-sticky-repeat-page`
- `lazy-load-page`
- `lazy-preview-grid-page`
- `late-lazy-grid-page`
- `broken-image-diagnostics-page`
- `huge-page-tiling`
- `too-many-parts-page`
- `iframe-baseline-page`
- `sticky-toc-repeat-page`
- `internal-scroll-container-page`
- `empty-editor-side-palette-page`
- `scroll-settle-gap-page`
- `short-chat-internal-scroll-page`
- `dynamic-internal-scroll-page`
- `stuck-window-scroll-page`

Run real-site QA after adding sites to `project/tests/real-sites.json`:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
npm run real:qa
```

Run a targeted real-site QA subset:

```bash
cd "/Users/dima/Projects/Screenshot Extension"
REAL_SITE_FILTER="wikipedia,mdn" npm run real:qa
```

The latest real-site report is written to `project/tests/real-site-qa.md`. Artifacts that need review are written directly to `/Users/dima/Desktop/For-Dima-from-Codex/` as prioritized folders such as `01-LOOK-FIRST-engine-risk` and `02-Samples`. By default, all `SAMPLE REVIEW` captures are copied there; set `REVIEW_OPTIONAL_SAMPLE_LIMIT` only for an explicitly capped review subset. See `project/tests/qa-runbook.md` for the publishing contract.

## Known MVP Limits

- Fixed/sticky normalization is v1 and may still need real-site tuning.
- Scrollbar normalization covers root scrollbars and one dominant internal scroll container.
- Lazy-load warmup is bounded and does not intentionally expand infinite-scroll feeds.
- Post-warmup remeasure handles bounded scroll-height growth in app-like scroll panes.
- No iframe permission flow yet.
- Only one high-confidence internal scroll container is supported.
- Canvas tiling v1 supports very tall pages through multiple PNG parts; extremely wide or excessive-part pages still fail clearly.
- Visible iframe viewports are captured, but deep iframe scrolling is not supported yet.
- No editor, clipboard, Firefox, Edge, or debugger capture modes.

## License

The upstream project is MPL-2.0. Keep MPL-2.0 obligations when modifying covered files.
