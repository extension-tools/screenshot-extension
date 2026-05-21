# Product Task: PDF CaptureArtifact Contract

## Problem

PDF export is a current product need, but adding it directly into the capture flow could create a second screenshot engine. That would duplicate page probing, scroll planning, fixed/sticky handling, split-boundary logic, diagnostics, and cleanup risk.

## User

Users who want to save a full-page capture as PDF with the same visual result and reliability as PNG.

## Value

The product can add PDF export without making capture slower, less stable, or harder to reason about. The engineering team gets a clean handoff between capture and export.

## Desired Behavior

The extension captures the page once, produces a shared `CaptureArtifact`, and then exports that artifact as PNG or PDF.

```text
PageProbe -> PositionPlanner -> CaptureStepper -> CaptureArtifact -> Export adapter
```

PDF export must not re-measure the page, re-scroll the page, re-classify page elements, mutate DOM/CSS, or run a second capture loop.

## Non-Goals

- No separate PDF capture pipeline.
- No PDF-specific `PageProbe`, `PositionPlanner`, `CaptureStepper`, `FixedStickyNormalizer`, or split-boundary planner.
- No print-CSS based PDF as the default screenshot export path.
- No redesign of the full output pipeline in this task.
- No UI work in this task.

## Success Criteria

- A documented `CaptureArtifact` contract exists.
- The contract supports both single bitmap and tiled captures.
- The contract contains enough metadata for PDF export: dimensions, DPR, title, source URL, output mode, tiles/bitmap, boundaries, and diagnostics summary.
- PDF export requirements explicitly forbid duplicate DOM/capture work.
- Future implementation can add `PdfExporter` as an output/export adapter.

## Related Spec

- `../specs/032-pdf-capture-artifact-contract.md`
- `../docs/pdf-export-architecture-decision.md`
