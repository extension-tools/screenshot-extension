# 006: Iframe Support

## Product Task

- `../product-tasks/006-iframe-support.md`

## Goal

Define and improve iframe behavior during full-page capture.

## User Value

Screenshots should preserve visible iframe content when Chrome allows it, and clearly explain limitations when it does not.

## Current Behavior

The MVP uses actual viewport capture. That means visible iframe pixels can appear in captured frames because Chrome captures the rendered tab viewport.

## Limits

- Cross-origin iframe DOM cannot be inspected or manipulated without host permissions.
- Nested iframe scroll positions may not be controllable.
- Sticky or lazy-loaded content inside cross-origin iframes may not be fixable by the extension.
- Some embedded content may block rendering, delay loading, or display differently under automation.

## Proposed Architecture

Use a tiered model:

1. Base support through actual viewport capture.
2. Same-origin iframe probing where scripting is allowed.
3. Optional host permissions only for advanced iframe coordination.
4. Clear fallback behavior for cross-origin content.

## Requirements

- Do not overpromise full control of cross-origin iframes.
- Preserve rendered pixels whenever viewport capture can see them.
- Avoid broad host permissions in the default MVP.
- Document iframe limitations in user-facing language.

## Test Coverage

- Manual iframe page in `../tests/manual-checklist.md`.
- Future same-origin and cross-origin fixtures in `../tests/capture-flow.mjs`.
