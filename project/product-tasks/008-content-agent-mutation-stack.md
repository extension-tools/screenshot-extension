# Product Task: Content Agent Mutation Stack

## Problem

The extension needs to change page DOM/CSS temporarily during capture to fix edge cases like duplicated fixed headers, cookie banners, city popups, lazy-loaded content, and future scroll-container handling.

Changing the page directly from scattered capture code is risky because cleanup can be missed after errors.

## User

End users capturing modern websites with sticky navigation, banners, popups, and dynamic layout. Engineering also benefits because page mutation becomes a controlled capability.

## Value

The product gains a safe page-side layer for temporary capture preparation and guaranteed cleanup.

## Desired Behavior

- The service worker injects a page-side content agent before capture.
- The content agent owns page-side capture preparation.
- Any temporary DOM/CSS change goes through a mutation stack.
- Cleanup restores all mutations even if capture fails.
- Current capture behavior remains unchanged until a normalizer uses the stack.

## Non-Goals

- No fixed/sticky duplicate fix in this task.
- No lazy-load warmup in this task.
- No custom scroll-container detection in this task.
- No permanent DOM changes.

## Success Criteria

- `ContentAgent` and `DomMutationStack` exist under `code/content/`.
- Service-worker code can call `prepareCapture()` and `cleanupCapture()`.
- Cleanup is wired through `CleanupManager`.
- Static validation and visual regression still pass.

## Related Spec

- `../specs/008-content-agent-mutation-stack.md`

