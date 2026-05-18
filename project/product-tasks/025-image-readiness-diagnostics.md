# Product Task: Image Readiness Diagnostics

## Problem

On media-heavy pages, the final screenshot can contain gray placeholders or broken preview images. Without diagnostics, it is unclear whether capture was too early, the site returned broken images, or layout shifted during capture.

## User

Users capturing news, media, documentation, and app-shell pages with lazy-loaded images.

## Value

The product team can distinguish between capture-engine issues and site-loading issues using concrete image-readiness metrics instead of visual guessing.

## Desired Behavior

- Collect image readiness before warmup.
- Collect image readiness after warmup.
- Collect image readiness before each viewport capture frame.
- Write diagnostics into real-site QA reports.
- Do not block capture on perfect image readiness.

## Non-Goals

- No hard wait for every image.
- No BBC-specific selector hacks.
- No automatic retry policy in this task.

## Success Criteria

- Real-site QA reports include visible, ready, pending, broken, placeholder, and readiness ratio metrics.
- Capture-flow has deterministic coverage for lazy preview readiness improving after warmup.
- Capture-flow has deterministic coverage for broken image diagnostics without failing the screenshot.
- Existing capture-flow tests still pass.

## Related Spec

- `../specs/025-image-readiness-diagnostics.md`
