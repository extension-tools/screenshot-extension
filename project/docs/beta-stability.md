# Beta Stability Criteria

## Goal

Define when the capture/export product is stable enough for the current release checklist.

## Current Mac Release Gate

The current release gate is for stable capture/export on macOS. PNG correctness is still the base layer, but PDF export and user communication are now part of the current release scope.

Gate is ready when:

- `node project/tests/validate-extension.mjs` passes;
- `node project/tests/capture-flow.mjs` passes;
- targeted beta gate covers at least 15 high-risk real sites and completes with 0 `FAIL`;
- 100-site stats run completes without runner-level crashes;
- routine successful captures are classified as `PASS_AUTO`;
- complex but readable captures are classified as `SAMPLE REVIEW`;
- known site/content/dynamic risks are documented instead of treated as surprise blockers;
- visible overlays present at capture start appear in the first viewport only and do not repeat down the page;
- blocking popups that technically prevent normal scrolling are captured as the first visible viewport only;
- entry-gate wording alone is diagnostic and does not force `viewport-only`;
- large non-blocking popups continue capture and route to review instead of automatic stop;
- user-blocking overlays without technical scroll lock are documented backlog, not a current release blocker;
- `minified-code/` is not updated unless explicitly requested.

## Current Must List

| User problem | Technical problem | Examples |
| --- | --- | --- |
| Text/cards are cut inside a screenshot. | Split-boundary / seam placement across text, docs-card, product-card, or product-grid row. | FastAPI, MongoDB, Patagonia, Nordstrom, Samsung. |
| Product cards are cut when output is split into PNG pages. | Tiled-output boundary lands inside product card/grid row. | REI, Target, Walmart. |
| User does not understand capture progress/result. | Capture progress, notification, completion-feedback state. | Product UI. |
| User needs PDF export. | PDF export pipeline, page sizing, output fidelity. | Export. |

## Real-Site Gate

Use a targeted real-world QA set of at least 15 high-risk sites before beta sign-off. The active set is generated from `deepQa.riskTags` in `project/tests/real-sites.json`; run `npm run risk:sites` to print URLs and `REAL_SITE_FILTER`.

Target:

- at least 90% successful captures on accessible sites;
- no broken or empty PNG outputs;
- no repeated sticky/fixed elements in primary cases;
- huge pages either produce successful multi-part output or a controlled error;
- original scroll position is restored after capture.

Login-only, bot-blocked, consent-blocked, or otherwise inaccessible pages should be `BLOCKED ACCESS`, not capture-engine failures.

Gray lazy previews on selected beta segments are failures unless the page is explicitly classified as unstable/blocked.

## Automated Review Statuses

- `PASS_AUTO`: PNG output and diagnostics pass automated checks; no human review required.
- `SAMPLE REVIEW`: automated checks passed, but the case is intentionally sampled because it is app-shell, multi-part, complex, or explicitly marked for review.
- `UNSTABLE SITE`: capture completed, but diagnostics found quality risks such as pending/broken visible images, placeholder-heavy output, export metadata failure, dimmed backdrop mismatch, or other visual-guard issues.
- `BLOCKED LOGIN` / `BLOCKED ACCESS`: inaccessible due to login, bot protection, consent/access wall, or similar external gate.
- `FAIL`: assertion failed or capture flow could not complete.

Hard failures, not samples:

- right-crop or bitmap-width mismatch;
- first-screen mismatch unless explicitly superseded by dynamic overlay policy;
- blank app-shell startup;
- over-wide output with blank/gray right-side strips;
- blocking-modal capture-state mismatch;
- unsafe canvas/export/download behavior.

The Desktop review folder should contain only `FAIL`, `SAMPLE REVIEW`, `UNSTABLE SITE`, and blocked cases. Routine `PASS_AUTO` artifacts stay in the full project archive.

## Target Segments

The first checks prioritize:

- docs, wiki, and blog pages;
- ecommerce and product pages;
- ChatGPT/Claude-style app-shell pages represented by public app-shell targets unless a logged-in profile is explicitly prepared.

## Failure Handling

When QA or automated test failure is caused by an obvious capture-engine bug, fix it immediately and rerun relevant checks.

Engine-bug examples:

- empty or unreadable PNG output;
- repeated sticky/fixed elements in primary cases;
- missing visible app-shell sidebar on a selected app-shell target;
- scroll position not restored;
- unsafe canvas/export/download behavior;
- gray lazy preview grids on beta target segments.

When a failure is caused by a product tradeoff, record it in `project/docs/beta-notes.md` instead of blocking the engineering loop.

Tradeoff examples:

- login-only page without prepared profile;
- bot protection or consent walls outside the capture engine;
- deep iframe scrolling;
- complete virtualized infinite history;
- hidden/collapsed sidebars;
- hidden horizontal workspace/canvas/board/table/editor content beyond visible width;
- multiple similar internal scroll containers when only one is supported.

## App-Shell Rules

If a site is selected as an app-shell target, capture must include:

- main scrollable content;
- visible sidebar or left navigation;
- visible top chrome/header.

Missing visible sidebar or left navigation on a selected app-shell target is a beta blocker unless the site is explicitly removed from the must-pass list.

Non-goals for beta:

- all nested scroll containers;
- deep iframe scrolling;
- complete virtualized infinite history;
- hidden/collapsed sidebars;
- hidden horizontal workspace/canvas/board/editor/table content beyond visible app-shell width.

## Known Limits Checklist

`project/docs/beta-notes.md` must mention:

- one high-confidence internal scroll container;
- horizontal internal scroll is visible-width only;
- deep iframe scrolling is not supported;
- infinite scroll and virtualized history are bounded/best-effort;
- huge pages may save as multiple PNG parts;
- login-only or bot-blocked pages may be unavailable;
- editor/crop/annotation, accounts, cloud storage, and Chrome Web Store distribution are out of current scope.
