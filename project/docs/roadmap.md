# Roadmap

## Phase 1: Runnable MVP

- Chrome MV3 only.
- One capture command.
- Remove non-Chrome branches.
- Remove external editor integration.
- Validate manifest and JavaScript syntax.
- Load unpacked in Chrome.
- Start capture from a one-button toolbar popup.
- Capture and download full-page screenshots on basic websites.

## Phase 2: Capture Reliability

- Modular capture architecture.
- Content agent and mutation stack.
- Fixed/sticky normalizer v1.
- Root scrollbar normalizer v1.
- Main internal scroll-container scrollbar normalizer v1.
- One main internal scroll-container capture v1.
- Stabilization wait v1.
- Lazy-load warmup v1.
- Canvas size guard v1.
- Better restricted-page errors.
- Original scroll restoration on all failure paths.
- Fixed and sticky element normalization.
- Horizontal scroll coverage.

## Phase 3: Advanced Page Coverage

- Multiple/custom scroll-container support.
- Large-page canvas tiling.
- Cross-origin iframe behavior definition.
- File URL optional permission model.
- Better capture progress and cancellation.

## Phase 4: Test Automation

- Expand visual regression site list.
- Add extension capture-flow automation.
- Compare final downloaded screenshots.
- Add failure artifacts for each capture run.
- Add release checklist gates.

## Phase 5: Product Hardening

- Options cleanup.
- Filename templates.
- Format and quality settings.
- Clear user-facing errors.
- Chrome Web Store packaging preparation.
