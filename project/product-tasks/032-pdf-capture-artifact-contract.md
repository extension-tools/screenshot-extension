# Product Task: PDF Export v1

## Problem

Users need PDF export for full-page capture, but adding it directly into the capture flow would risk a second screenshot engine and duplicate page logic.

## User

Users who want to save a full-page screenshot as PDF with the same capture reliability as PNG.

## Value

The product gains PDF export without making capture slower, less stable, or harder to maintain.

## Shipped Behavior

The extension captures the page once and then exports the existing capture result as either PNG or PDF.

```text
PageProbe -> PositionPlanner -> CaptureStepper -> CanvasStitcher / CanvasTiler -> export seam
```

`PDF v1` behavior:

- `single-canvas` -> one PDF page
- `tiled-output` -> one tile = one PDF page
- PNG export remains unchanged
- PDF export saves one final PDF file

## Non-Goals

- No separate PDF capture pipeline
- No PDF-specific `PageProbe`, `PositionPlanner`, or `CaptureStepper`
- No DOM re-measure or second capture loop for PDF
- No print-CSS export path
- No A4/Letter pagination in `v1`
- No new UI for PDF settings

## Success Criteria

- PDF export works off the existing capture result
- PNG behavior remains unchanged
- `single-canvas` PDF works end-to-end
- `tiled-output` PDF works end-to-end
- The implementation does not introduce a second capture engine
- Runtime and browser-level tests cover both PNG regression and PDF smoke

## Related Spec

- `../specs/032-pdf-capture-artifact-contract.md`
