# Product Task: MVP Capture

## Problem

Users need a simple way to capture an entire webpage, not only the visible viewport.

## User

People who archive pages, QA teams, designers, researchers, and operators who need quick page evidence.

## Value

The user can install the extension locally, click one command, and get a full-page screenshot saved as an image.

## Desired Behavior

- User loads the unpacked extension in Chrome.
- User opens a normal website.
- User clicks `Capture Entire Page`.
- The extension captures the full page.
- The final screenshot is downloaded.
- The page returns to the original scroll position.

## Non-Goals

- No editor or annotation workflow.
- No Firefox or Edge support.
- No selected-area capture.
- No clipboard workflow.

## Success Criteria

- The extension can be loaded without a Chrome Web Store developer account.
- A basic long page is captured successfully.
- The output image is downloaded.
- Scroll position is restored after capture.

## Related Spec

- `../specs/001-mvp-capture.md`

