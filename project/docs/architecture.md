# Architecture

## System Overview

The extension is a Chrome MV3 application with a small command surface.

```text
toolbar icon -> popup -> service worker -> capture controller -> content agent -> page probe -> capture stepper -> canvas stitcher -> cleanup -> download
```

## Components

### Manifest

`code/manifest.json` defines the Chrome MV3 shell, extension permissions, toolbar action, background service worker, icons, options page, and commands.

### Toolbar Action

`code/manifest.json` defines a toolbar action with a minimal popup. Clicking the extension icon opens `code/data/popup/index.html`, and the popup button sends a runtime message that `code/worker.js` routes to `capture-entire`.

### Service Worker

`code/worker.js` is the command router:

- receives popup, command, context-menu, or test requests;
- delegates supported capture commands to `CaptureController`;
- reports errors through Chrome notifications.
- routes user-facing notification events through `NotificationService`.

### Capture Layer

The capture layer lives in `code/capture/`:

- `CaptureController.js`: high-level capture command flow.
- `CapabilityGuard.js`: unsupported tab and URL checks.
- `CaptureDiagnostics.js`: structured v2 capture diagnostics for QA, failures, output strategy, and export status.
- `ContentAgentClient.js`: injects and calls the page-side content agent.
- `CanvasSizeGuard.js`: chooses single-canvas, tiled-output, or controlled-failure strategy before allocation.
- `SingleFileExportAttempt.js`: records whether one-file export is safe or the result should stay as parts.
- `PageProbe.js`: target selection, page/container dimensions, viewport, DPR, scroll state, and lightweight diagnostics.
- `PositionPlanner.js`: scroll-position plan.
- `LazyLoadWarmer.js`: bounded pre-capture scroll warmup for lazy/scroll-triggered content.
- `CaptureStepper.js`: scroll and frame capture loop.
- `ViewportCapture.js`: `chrome.tabs.captureVisibleTab` wrapper.
- `CanvasStitcher.js`: single-output canvas drawing, internal-target cropping, and encoding.
- `CanvasTiler.js`: tiled-output canvas drawing and multi-part PNG encoding for very tall pages.
- `CaptureStore.js`: download saving and readable filename generation.
- `NotificationService.js`: centralized notification event normalization, Chrome notification display, and QA storage.
- `CleanupManager.js`: badge cleanup and scroll restoration.

### Content Layer

The content layer lives in `code/content/` and runs inside the captured page:

- `DomMutationStack.js`: stores temporary page mutations and restores them in reverse order.
- `ScrollTargetFinder.js`: finds one dominant internal scroll container for normalization.
- `ScrollbarNormalizer.js`: hides root page scrollbars during capture.
- `FixedStickyNormalizer.js`: hides repeated viewport-attached elements after the first frame.
- `ImageReadinessProbe.js`: records visible image, broken image, and placeholder readiness diagnostics.
- `ContentAgent.js`: owns page-side `prepareCapture()`, frame stabilization, and `cleanupCapture()`.

This layer owns temporary page changes for capture. All style changes must go through `DomMutationStack` so cleanup can restore the page after success or failure.

### Page Probe

The current probe is injected directly through `chrome.scripting.executeScript`. It reads page dimensions, viewport size, device pixel ratio, original scroll position, and chooses `window` or one high-confidence internal scroll container.

Future versions should move more DOM-specific capture logic into the dedicated content-agent layer:

- fixed/sticky element normalization;
- multiple-container selection;
- iframe-aware measurements where possible;
- cleanup after capture.

### Test Layer

The test layer lives in `project/tests/`:

- `validate-extension.mjs` validates static extension files.
- `visual-regression.mjs` screenshots configured websites and compares them against baselines.
- `capture-flow.mjs` loads the unpacked extension in headed Chromium and runs fixture-based capture-flow checks.

## Data Flow

1. User clicks the toolbar icon.
2. Chrome opens the extension popup.
3. User clicks `Capture entire page`.
4. Popup sends a runtime message to the service worker.
5. Service worker measures the active tab and chooses `window` or one high-confidence internal scroll target.
6. Capture layer chooses single-canvas, tiled-output, or controlled-failure strategy.
7. If the selected strategy requires tiled output, `NotificationService` emits a large-page split notice before real frame capture.
8. Service worker injects and prepares the content agent.
9. Service worker warms lazy/scroll-triggered content within the measured page bounds.
10. Service worker remeasures the page or internal scroll target after warmup and rebuilds the capture plan if scrollable size changed.
11. Service worker scrolls through the selected target.
12. Content agent normalizes frame-specific DOM/CSS state.
13. Content agent waits briefly for current viewport layout stabilization.
14. Each visible viewport is captured.
15. Frames are stitched into one canvas or tiled output canvases using `devicePixelRatio`; internal targets are cropped from the viewport bitmap.
16. `SingleFileExportAttempt` records whether one-file export is safe. For current PNG output, unsafe tiled captures stay as multiple PNG parts.
17. `CaptureDiagnostics` records CSS page size, bitmap size, DPR, strategy, scroll target, image readiness summary, and export intent.
18. Content mutations and original target/window scroll positions are restored.
19. Final image or image parts are downloaded.
20. `CaptureDiagnostics` records export/download status or failure reason.

## Architecture Boundaries

- User command routing should stay in `code/worker.js`.
- Browser API orchestration should stay in `code/capture`.
- `code/worker.js` should stay a thin command router.
- DOM/CSS page mutation should stay in `code/content`.
- Visual and capture-flow tests should stay in `project/tests`.
- Product and engineering reasoning should stay in `project/docs` and `project/specs`, not in code comments.
