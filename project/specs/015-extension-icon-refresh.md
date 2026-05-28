# 015: Extension Icon Refresh

## Product Task

- `../product-tasks/015-extension-icon-refresh.md`

## Goal

Replace the inherited extension icon set with the provided product artwork.

## Requirements

- Generate PNG assets for the manifest icon sizes used by the extension.
- Replace `code/data/icons/16.png`, `32.png`, `48.png`, `64.png`, and `128.png`.
- Remove stale non-manifest icon assets, including `20.png`, `24.png`, `256.png`, `512.png`, and `entire.png`.
- Add `action.default_icon` in `code/manifest.json`.
- Keep paths relative to the extension root.

## Source Asset

The source image is:

```text
/Users/dima/Desktop/Favicon.png
```

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Manifest parse check.
- Manual check after extension reload in `chrome://extensions`.
