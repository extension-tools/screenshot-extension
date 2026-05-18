# Product Task: Restore Popup Capture Button

## Problem

Direct toolbar-click capture starts immediately. For the beta, the product needs an explicit button in the extension popup so users understand what action will happen before capture begins.

## User

Users launching capture from the Chrome toolbar.

## Value

The popup provides a clear one-command action surface while still keeping the product simple.

## Desired Behavior

- Clicking the toolbar icon opens the extension popup.
- The popup shows one button: `Capture entire page`.
- Clicking the button starts the existing `capture-entire` flow.
- The popup closes after a successful start.

## Non-Goals

- No multi-mode popup.
- No settings UI.
- No PDF or format selector in this task.

## Success Criteria

- `manifest.json` defines `action.default_popup`.
- Popup button text is `Capture entire page`.
- `chrome.action.onClicked` no longer starts capture directly.
- Static validation passes.

## Related Spec

- `../specs/023-popup-capture-button-restore.md`
