# 001: MVP Capture

## Product Task

- `../product-tasks/001-mvp-capture.md`

## Goal

Create a runnable Chrome MV3 extension that captures the entire active page and downloads the result as an image.

## User Value

The user can install the unpacked extension, click one command, and receive a full-page screenshot without needing a developer account or external editor.

## Requirements

- Extension loads through `chrome://extensions` with `Load unpacked`.
- Popup exposes one command: `Capture Entire Page`.
- Capture runs from the active tab.
- The final image is saved through Chrome downloads.
- Original scroll position is restored after capture.
- Unsupported pages should fail clearly.

## Current Implementation

- Popup sends a command to the MV3 service worker.
- The worker measures page size and viewport size.
- The worker scrolls through the page in viewport-sized steps.
- Each viewport is captured with `chrome.tabs.captureVisibleTab`.
- Frames are stitched into a single `OffscreenCanvas`.
- The stitched image is downloaded.

## Edge Cases In Scope For MVP

- Pages taller than the viewport.
- High-DPI displays through `devicePixelRatio`.
- Basic horizontal and vertical page dimensions.
- Capture failure cleanup.
- Scroll restoration.

## Not Yet Solved

- Fixed/sticky duplicate cleanup.
- Lazy-loaded content stabilization.
- Custom scroll containers.
- Canvas tiling for extremely large pages.
- Iframe-specific coordination.

## Test Coverage

- Static check: `../tests/validate-extension.mjs`.
- Manual check: `../tests/manual-checklist.md`.
- Visual baseline check: `../tests/visual-regression.mjs`.
- Future capture-flow check: `../tests/capture-flow.mjs`.
