# Product Task: Format Choice Popup

## Status

Implemented on 2026-05-29.

## Source Of Truth

This document is the mini-spec / implementation checklist for the format choice popup.

Design input:

- Designer-provided HTML/CSS snippet from the product thread.

Implementation files:

- `code/data/popup/index.html`
- `code/data/popup/index.css`
- `code/data/popup/index.js`

Important implementation notes:

- `code/data/popup/index.js` remains the behavior owner and was not changed for this UI refresh.
- Existing popup hooks are preserved:
  - `#capture-pdf`
  - `#capture-png`
  - `data-export-format="pdf"`
  - `data-export-format="png"`
- The popup uses the existing extension icon at `../icons/48.png` instead of adding a new `mascot.png` asset.
- No `manifest.json`, permissions, capture pipeline, background scripts, content scripts, or dependencies changed for this task.

## Problem

The user needs a clear and fast way to choose the output format before capture starts.

The current product direction requires an explicit format choice in the extension popup:

- `Capture as PDF`
- `Capture as PNG`

The popup must follow the provided design mockup and keep the capture flow simple.

## User

Users who click the Chrome toolbar extension icon to capture the current page.

## Value

The user understands exactly what will happen before capture starts and gets the file in the selected format without extra steps.

This also protects the product from hidden mode behavior: the format is explicit before capture starts.

## Design Reference

Required visual structure:

- header with mascot/icon and `Full page` pill;
- first action row: `Capture as PDF`;
- second action row: `Capture as PNG`;
- file-format icon on the left of each row;
- chevron on the right of each row;
- large clickable rows;
- visible hover/focus/active state;
- white popup card, rounded corners, soft shadow, light blue active/hover treatment.

## Desired Behavior

1. The user clicks the extension icon in the Google Chrome toolbar.
2. Chrome opens the extension popup.
3. The popup shows two explicit actions:
   - `Capture as PDF`
   - `Capture as PNG`
4. When the user clicks `Capture as PDF`, the popup sends `exportFormat: 'pdf'`.
5. When the user clicks `Capture as PNG`, the popup sends `exportFormat: 'png'`.
6. The extension starts one full-page capture.
7. After the capture result is ready, the extension saves one file in the selected format.
8. After the click, the popup closes. This is the current standard behavior of the extension.

## Functional Requirements

- The popup opens from the Chrome toolbar extension icon.
- The popup contains exactly two primary action buttons:
  - `Capture as PDF`
  - `Capture as PNG`
- The entire action row is clickable, not only the text.
- `Capture as PDF` starts capture with `exportFormat: 'pdf'`.
- `Capture as PNG` starts capture with `exportFormat: 'png'`.
- Format is selected before capture starts.
- One user click starts exactly one capture run.
- Invalid or missing `exportFormat` falls back to `png`.
- The existing PNG path stays behaviorally unchanged.
- The PDF path uses the existing PDF export branch.
- The popup closes after the user clicks either action.

## Accessibility And Interaction

- Buttons must be reachable with keyboard focus.
- `Enter` and `Space` activate the focused action.
- Hover and focus states must be visible.
- Text must not overflow at real Chrome extension popup size.
- The visual hierarchy must make the two format actions obvious.

## Non-Goals

- Do not change the capture pipeline.
- Do not add a new capture mode.
- Do not change PDF pagination/export logic.
- Do not change fixed/sticky/scroll/page-planning logic.
- Do not add preview.
- Do not add an editor before saving.
- Do not add onboarding.
- Do not add settings or extra modes to this popup.

## Success Criteria

- The popup visually matches the designer-provided HTML/CSS structure, with the existing extension icon substituted for the mockup mascot asset.
- Clicking the extension icon opens the format choice popup.
- Clicking `Capture as PDF` starts capture and saves one `.pdf` file.
- Clicking `Capture as PNG` starts capture and saves `.png` output through the existing PNG path.
- `exportFormat` is passed through the command path correctly.
- The popup closes after either action is clicked.
- Capture starts only once per user action.
- Missing or invalid `exportFormat` still uses the PNG default.
- Existing PNG behavior is protected by a regression guard.

## Priority

Must before release.

## Related Spec

- This file is the source of truth for the popup UI implementation checklist.

## Verification

Passed on 2026-05-29:

- `node --check code/data/popup/index.js`
- `git diff --check -- code/data/popup/index.html code/data/popup/index.css code/data/popup/index.js`
- `pnpm run check`
