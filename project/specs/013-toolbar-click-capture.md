# 013: Toolbar Click Capture

## Product Task

- `../product-tasks/013-toolbar-click-capture.md`

## Goal

Make the toolbar icon start full-page capture directly.

## Requirements

- Remove `action.default_popup` from `code/manifest.json`.
- Add `action.default_title` for toolbar hover text.
- Add `chrome.action.onClicked` in `code/worker.js`.
- Route toolbar clicks to the existing `capture-entire` command.
- Remove popup files from `code/data/popup/`.
- Keep context menu and command handling.

## Architecture

```text
toolbar icon click
  -> chrome.action.onClicked
  -> onCommand("capture-entire", tab)
  -> CaptureController.runCommand()
```

## Behavior

Before:

```text
toolbar icon -> popup -> Capture Entire Page button -> capture
```

After:

```text
toolbar icon -> capture
```

## Edge Cases

- Restricted pages still fail through `CapabilityGuard`.
- Service worker may be inactive before click; Chrome wakes it for the action click.
- If the extension was previously loaded with a popup, Chrome must reload the unpacked extension after this change.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual browser check: click toolbar icon directly and confirm capture starts without popup.

