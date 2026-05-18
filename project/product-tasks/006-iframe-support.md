# Product Task: Iframe Support

## Problem

Many pages contain embedded frames, and users expect visible embedded content to appear in screenshots.

## User

Users capturing dashboards, docs, embeds, marketing pages, payment flows, maps, videos, and third-party widgets.

## Value

The extension should preserve visible iframe pixels when browser APIs allow it and clearly define what cannot be controlled.

## Desired Behavior

- Visible iframe content appears in viewport captures where Chrome renders it.
- Same-origin frames may be coordinated when scripting is allowed.
- Cross-origin limitations are explained instead of hidden.

## Non-Goals

- No broad host permissions by default.
- No promise of full control over cross-origin iframe DOM.
- No bypassing browser security boundaries.

## Success Criteria

- Basic iframe content is preserved through viewport capture.
- Same-origin and cross-origin behavior is documented.
- Unsupported iframe cases fail gracefully or are clearly listed as limitations.

## Related Spec

- `../specs/006-iframe-support.md`

