# 015: Extension Icon Refresh

## Product Task

- `../product-tasks/015-extension-icon-refresh.md`

## Goal

Replace the inherited extension icon set with the provided product artwork.

## Requirements

- Generate PNG assets for all manifest icon sizes.
- Replace `code/data/icons/16.png`, `20.png`, `24.png`, `32.png`, `48.png`, `64.png`, `128.png`, `256.png`, and `512.png`.
- Replace `code/data/icons/entire.png` to avoid stale prototype art.
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

