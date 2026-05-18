# Decisions

## D001: Chrome MV3 Only

We keep only the Chrome MV3 path for the product.

Why:

- The first target is Chrome.
- It reduces branching and compatibility noise.
- It keeps testing focused on one extension runtime.

Tradeoff:

- Firefox and Edge-specific behavior is intentionally out of scope.

## D002: Start With One User Command

The MVP exposes only one capture command.

Why:

- Full-page capture is the core value.
- A single visible command reduces UX and QA complexity.
- Other modes can be added later if they support the main product direction.

Tradeoff:

- There is no mode picker in the initial product.
- Visible-area, selected-area, editor, and clipboard workflows are not part of the initial product.

## D003: Keep External Editor Out Of Core Flow

The core workflow saves the final image directly instead of sending it to an external editor.

Why:

- Reduces host permissions.
- Removes an external dependency from the capture path.
- Makes local testing and privacy review simpler.

Tradeoff:

- Annotation and editing are postponed.

## D004: Use Baseline Visual Regression Early

We keep visual checks in the project from the beginning.

Why:

- Screenshot products are easy to break visually.
- A small baseline suite catches obvious page rendering changes.
- The same test structure can later drive real extension capture-flow checks.

Tradeoff:

- Visual tests can be noisy on dynamic websites, so the site list must be curated.

## D005: Specs Per Major Capability

Each major capability gets its own spec file.

Why:

- Full-page capture has many edge cases.
- Separate specs keep each problem understandable.
- Architecture and product docs stay stable while feature specs evolve.

Tradeoff:

- We need to maintain links between specs, tests, and changelog entries.

## D006: Product Task Before Spec

Each meaningful change starts with a product task.

Why:

- Product intent should be written before technical solution details.
- Specs can stay grounded in user value and success criteria.
- It keeps product thinking and engineering planning connected without mixing their jobs.

Tradeoff:

- Small technical chores may not need a full product task, but they should still point to an existing product task or decision when possible.

## D007: Modular Capture Layer Before DOM Fixes

We split the MVP capture flow into `code/capture/` modules before implementing fixed/sticky handling.

Why:

- Fixed/sticky normalization will need new page mutation and cleanup behavior.
- Keeping all capture logic in `worker.js` would make the next edge-case fixes harder to reason about.
- A modular capture layer gives each future capability a clear integration point.

Tradeoff:

- The first refactor does not directly fix duplicated sticky elements yet.
- There are more files, but each file has a smaller responsibility.

## D008: Page Mutation Through Content Agent

Temporary DOM/CSS changes must go through `ContentAgent` and `DomMutationStack`.

Why:

- Fixed/sticky normalization needs to mutate page styles during capture.
- Cleanup must be centralized and run even when capture fails.
- Page-side concerns should not leak into the service-worker capture loop.

Tradeoff:

- Step 2 adds infrastructure before changing visible capture output.
- The service worker now injects content files before capture.

## D009: Hide Viewport-Attached Elements After First Frame

Fixed/sticky V1 keeps viewport-attached UI on the first frame and hides detected candidates on later frames.

Why:

- It directly addresses duplicated headers, cookie banners, and popups.
- It avoids site-specific selector lists.
- It uses the mutation stack, so cleanup remains centralized.

Tradeoff:

- This can hide some sticky content that is semantically part of the page.
- More precise classification can be added after the first real-world validation pass.

## D010: Hide Root Scrollbars Before Capture

Scrollbar V1 hides root `html/body` scrollbars before `captureVisibleTab`.

Why:

- Captured scrollbars are visual artifacts in the stitched output.
- Preventing scrollbar rendering is safer than cropping pixels after capture.
- Root scrollbar hiding is small and low-risk compared with internal scroll-container handling.

Tradeoff:

- Internal scroll containers and custom scrollbar libraries are not handled yet.
- V1 does not dispatch a resize event, so a few sites may need later tuning.

## D011: Normalize One Main Internal Scroll Container

Scrollbar V2 hides the scrollbar of one large internal scroll container without changing the capture scroll target.

Why:

- Many app-like pages put content in one large scrollable pane.
- Hiding every internal scrollbar could damage tables, lists, textareas, and controls.
- Choosing one dominant container is a small step toward full `ScrollTargetFinder`.

Tradeoff:

- This does not make internal-container pages fully capturable yet.
- Some pages with multiple equally important scroll panes may still show scrollbar artifacts.

## D012: Add Bounded Per-Frame Stabilization

Capture waits briefly after scroll and DOM normalization before taking each frame.

Why:

- Scroll and temporary CSS changes can leave the page between layout states.
- Fonts and visible images may finish shortly after scrolling.
- A bounded wait improves quality without creating unbounded capture hangs.

Tradeoff:

- Capture can be slower on dynamic pages.
- This is not a full lazy-load warmup or network-idle detector.

## D013: Toolbar Icon Starts Capture Directly

Superseded by D017.

Clicking the toolbar icon starts `capture-entire` directly.

Why:

- The product currently has one primary command.
- A popup with one button adds an unnecessary second click.
- Removing the popup makes the MVP feel faster and simpler.

Tradeoff:

- There is no toolbar menu for settings or mode selection yet.
- Future multi-mode workflows may need a different entry point.

## D014: Choose Canvas Output Strategy Before Allocation

The capture flow chooses a safe output strategy before allocating canvas memory.

Why:

- Creating huge canvases can fail or produce blank output.
- Normal pages should keep the simpler one-PNG path.
- Very tall pages should use `CanvasTiler` and download multiple PNG parts.
- Unsupported dimensions should still fail clearly instead of crashing.

Tradeoff:

- Output tiling v1 is vertical only.
- Multiple PNG parts are less convenient than ZIP/PDF, but safer for the MVP.

## D015: Warm Lazy Content Before Real Capture

The capture flow performs a bounded pre-capture scroll warmup after position planning and before the first real frame capture.

Why:

- Many pages load or render content only after scroll.
- A short warmup improves completeness for long pages.
- Using planned positions keeps warmup bounded instead of intentionally expanding infinite feeds.
- Remeasuring after warmup lets the capture plan include normal lazy/layout growth caused by that bounded scroll.

Tradeoff:

- Capture can take longer.
- Warmup is best effort and does not guarantee every lazy resource is loaded.
- The post-warmup remeasure is not full infinite-scroll or virtualized-list support.

## D016: Capture One High-Confidence Internal Scroll Container

The capture flow can switch from `window` to one dominant internal scroll container when the page looks like an app shell.

Why:

- Chat and productivity apps often keep the browser window fixed while the central content pane scrolls.
- Capturing the window alone misses content below the visible pane.
- A conservative one-container rule improves app-shell coverage without guessing across complex multi-pane layouts.

Tradeoff:

- Pages with multiple similar scroll containers fall back to window capture.
- Surrounding app chrome is included from the first viewport, while the selected content pane is stitched through its scroll range.
- Virtualized lists may still need later handling.

## D017: Restore One-Button Popup

Clicking the toolbar icon opens a minimal popup. The popup contains one button: `Capture entire page`.

Why:

- Users get an explicit final action before the page starts scrolling during capture.
- The product still keeps a single-command surface.
- The popup gives us a natural place for future lightweight status or permission messaging without adding capture modes now.

Tradeoff:

- Capture takes one extra click compared with direct toolbar capture.
- The popup must stay intentionally small so it does not become a settings or mode surface too early.

## D018: Keep PDF As A Later Layer

PDF export is deferred until the PNG capture engine is beta-stable.

Why:

- PDF should reuse the same capture engine rather than force a rewrite.
- If PNG capture is unstable, PDF inherits bad stitching, missing lazy content, iframe limits, and app-shell issues.
- PDF adds pagination, scaling, file-size, and print-layout decisions that are separate from capture correctness.

Tradeoff:

- The beta remains PNG-only.
- Future PDF work should build on captured tiles/bitmaps and preserve diagnostics.

## D019: Keep Deep Iframe Scrolling Out Of Beta

The beta captures visible iframe pixels as part of the rendered viewport, but it does not recursively scroll iframe contents.

Why:

- Cross-origin iframe scrolling is constrained by browser security and permissions.
- Recursive iframe capture would complicate planning, page mutation, cleanup, and stitching.
- First beta users benefit more from stable main-page capture.

Tradeoff:

- Long content inside iframes is best effort only.
- Iframe limitations must stay documented in beta notes and diagnostics.

## D020: Capture One Main Scroll Container Before Many

The beta supports one high-confidence internal scroll container, not every custom scroll area on a page.

Why:

- Multiple scroll containers can be tables, filters, chat panes, editors, code panes, maps, or independent widgets.
- Capturing all of them requires product choices about which content matters.
- A conservative one-container rule is easier to test and less likely to damage ordinary pages.

Tradeoff:

- Pages with several equally important scroll containers may fall back to window capture.
- Perfect custom-scroll-container support is a later advanced capability.

## D021: Do Not Copy Competitor Output Strategy Blindly

The current output strategy decides whether split output is needed before allocating unsafe canvases.

Why:

- Normal pages should keep the simple one-PNG path.
- Huge pages should avoid unsafe giant-canvas allocation early.
- `CanvasSizeGuard`, `CanvasTiler`, `SingleFileExportAttempt`, and `CaptureDiagnostics` explain why output is single-file, multi-part, or rejected.

Tradeoff:

- Competitor-style "capture parts, then try to stitch everything back" can be added later only if it respects the same canvas guardrails.
- Multi-part PNG is less convenient, but safer than blank output or crashes for the beta.

## D022: Keep Broad Product Scope Out Of Beta

Editor, crop, annotation, accounts, cloud storage, Chrome Web Store distribution, Firefox, and Edge are deferred.

Why:

- The beta goal is reliable Chrome PNG capture.
- Extra product surfaces add permissions, UI state, packaging, privacy, support, and QA cost.
- Faster capture-engine iteration is more valuable than broader distribution before the engine is stable.

Tradeoff:

- Early users install through Load unpacked or zip beta.
- Product polish and distribution work comes after core capture quality.

## D023: Name Downloads For Human Recall

Saved screenshots use a readable filename pattern: `{SiteName} - {PageTitleShort} - {YYYY-MM-DD}`.

Why:

- Users should recognize a screenshot in Downloads without opening it.
- The first meaningful `h1` usually describes the page better than SEO-heavy browser titles.
- URL path fallback is deterministic when `h1` is missing, empty, or generic.
- Multi-part captures need stable suffixes so parts sort together.

Tradeoff:

- The browser cannot understand semantic titles; `h1` selection and word-boundary truncation are best-effort heuristics.
- App-shell pages may fall back to URL path more often than article/product pages.
