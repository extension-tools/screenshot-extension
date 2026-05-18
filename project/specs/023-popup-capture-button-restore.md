# 023: Popup Capture Button Restore

## Product Task

- `../product-tasks/023-popup-capture-button-restore.md`

## Goal

Restore a minimal popup with one capture button.

## Requirements

- Add `code/data/popup/index.html`.
- Add `code/data/popup/index.css`.
- Add `code/data/popup/index.js`.
- Set `action.default_popup` in `code/manifest.json`.
- Keep `action.default_title` as `Screenshot Extension`.
- Remove direct capture from `chrome.action.onClicked`.
- Start capture by sending an internal runtime message from popup to the service worker.
- Button text must be:

```text
Capture entire page
```

## Architecture

```text
toolbar icon
  -> popup
  -> Capture entire page button
  -> runtime message capture-active-tab
  -> service worker
  -> CaptureController.runCommand("capture-entire")
```

## Known Limits

- The popup has one command only.
- There is no settings or mode selection in the popup.
