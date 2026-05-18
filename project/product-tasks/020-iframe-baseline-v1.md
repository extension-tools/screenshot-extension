# Product Task: Iframe Baseline V1

## Problem

Many pages contain embedded iframe content. The beta does not need deep iframe capture yet, but pages with visible iframes should not break the core capture flow.

## User

Users capturing pages with embedded widgets, docs, videos, maps, previews, or other iframe-based content.

## Value

The product should preserve visible iframe content as part of the viewport screenshot and document that deep iframe scrolling is outside the current beta scope.

## Desired Behavior

- Capture pages with visible iframes without crashing.
- Preserve the iframe's visible viewport in the final PNG.
- Do not attempt to scroll iframe internals in v1.
- Record iframe diagnostics for reports/debugging.
- Document that cross-origin and deep iframe support are best-effort/limited.

## Non-Goals

- No recursive iframe capture in this task.
- No iframe internal scrolling.
- No iframe lazy-load warming.
- No cross-origin iframe permission flow.
- No sandboxed iframe special handling.

## Success Criteria

- `capture:test` includes `iframe-baseline-page`.
- The case downloads a readable PNG taller than the viewport.
- The case verifies a visible iframe marker is present in the PNG.
- The case report includes iframe diagnostics.

## Related Spec

- `../specs/020-iframe-baseline-v1.md`
