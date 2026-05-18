# Product Task: Toolbar Click Capture

## Problem

The current MVP requires two user actions: click the extension icon, then click `Capture Entire Page` in the popup.

For a single-purpose screenshot extension, the popup adds friction and makes the primary workflow feel slower than necessary.

## User

Users who want to capture the current page quickly from the Chrome toolbar.

## Value

One click on the toolbar icon starts the entire-page capture immediately.

## Desired Behavior

- User clicks the `Screenshot Extension` icon in the Chrome toolbar.
- Capture starts immediately.
- No popup opens.
- Context menu and command entry points may still trigger the same capture command.
- Unsupported pages still fail clearly.

## Non-Goals

- No popup UI for the MVP.
- No mode picker.
- No settings shortcut in the action popup.
- No multi-command toolbar menu.

## Success Criteria

- `manifest.json` has no `action.default_popup`.
- `chrome.action.onClicked` starts `capture-entire`.
- Unused popup files are removed.
- Existing validation and visual regression pass.

## Related Spec

- `../specs/013-toolbar-click-capture.md`

