# Product Task: Extension Icon Refresh

## Problem

The extension still used the inherited placeholder icon set from the source prototype.

## User

Users seeing the extension in Chrome toolbar, extension management pages, and browser UI.

## Value

The product should have a recognizable visual identity in the browser.

## Desired Behavior

- Use the new provided icon artwork for all extension icon sizes.
- Use the same artwork for the toolbar action icon.
- Keep Chrome manifest icon references valid.

## Non-Goals

- No name or positioning change.
- No store listing asset generation.
- No UI redesign.

## Success Criteria

- Manifest icons point to regenerated image assets.
- Toolbar action uses the new icon.
- Static validation passes.

## Related Spec

- `../specs/015-extension-icon-refresh.md`

