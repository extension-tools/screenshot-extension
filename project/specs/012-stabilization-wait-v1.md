# 012: Stabilization Wait V1

## Product Task

- `../product-tasks/012-stabilization-wait-v1.md`

## Goal

Add a bounded wait between scroll/DOM normalization and viewport capture.

## Requirements

- Run stabilization from the content agent.
- Call stabilization after `beforeFrame()` and before `captureVisibleTab`.
- Wait at least two animation frames.
- Wait for `document.fonts.ready` only when fonts are loading and timeout allows.
- Wait for a small number of visible incomplete images with timeout.
- Keep a hard timeout per frame.

## Architecture

```text
CaptureStepper
  -> pageProbe.scrollTo()
  -> fixed delay
  -> ContentAgentClient.beforeFrame()
  -> ContentAgentClient.waitForStableLayout()
      -> ContentAgent.waitForStableLayout()
          -> requestAnimationFrame x2
          -> bounded document.fonts.ready
          -> bounded visible image decode/load
  -> captureVisibleTab
```

## Current Policy

- Default timeout: 500ms per frame.
- Animation frames: 2 plus a final frame after font/image waits.
- Visible loading image limit: 8 images per frame.

## Known Limits

- This is not a lazy-load warmup pass.
- It does not detect network idle.
- Some pages may still mutate after the timeout.
- Waiting per frame increases capture time on dynamic pages.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual browser check on pages with fonts/images/sticky UI.

