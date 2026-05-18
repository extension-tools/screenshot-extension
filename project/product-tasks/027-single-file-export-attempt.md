# Product Task: Single File Export Attempt

## Problem

Users prefer one output file, but one huge PNG can exceed browser canvas or export limits. If the product blindly tries to assemble an unsafe single image, capture can fail after successful frame collection.

## User

Users capturing long pages that may cross browser bitmap limits, especially on high-DPI displays.

## Value

The product can honestly say it tries for one file when reliable, while treating multi-part output as a successful fallback when one file would be unsafe.

## Desired Behavior

- Record a single-file export decision for each capture.
- For safe `single-canvas` captures, mark the decision as `single-file`.
- For unsafe `tiled-output` PNG captures, mark the decision as `parts` and do not attempt to create a huge canvas.
- Preserve this decision in diagnostics for QA and future PDF/export work.

## Non-Goals

- No PDF export in this task.
- No ZIP packaging.
- No unsafe best-effort giant canvas creation.
- No product copy changes.

## Success Criteria

- `SingleFileExportAttempt` exists as a separate capture-layer component.
- Huge-page capture-flow verifies that unsafe single-file PNG export is not attempted.
- Diagnostics include decision, reason, bitmap size, DPR-derived dimensions, and tile count.

## Related Spec

- `../specs/027-single-file-export-attempt.md`
