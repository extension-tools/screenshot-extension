# PDF Export Architecture Decision

Date: 2026-05-22

## Context

The product needs PDF export, but the capture engine is already complex. We also want to simplify the architecture later by removing repeated work, reducing deep diagnostics in the hot path, and keeping clear module boundaries.

Related contract:

- `../product-tasks/032-pdf-capture-artifact-contract.md`
- `../specs/032-pdf-capture-artifact-contract.md`

The key architectural constraint:

```text
PDF export must consume capture output.
PDF export must not capture the page again.
```

## Decision

PDF export should live in the output/export layer, not inside the page capture layer.

Correct direction:

```text
PageProbe -> PositionPlanner -> CaptureStepper -> CaptureArtifact -> ExportController -> PdfExporter
```

Wrong direction:

```text
PNG capture pipeline
PDF capture pipeline
```

PDF must not introduce a second `PageProbe`, `PositionPlanner`, `CaptureStepper`, fixed/sticky normalizer, or split-boundary planner.

## Target Module Placement

Recommended structure:

```text
code/capture/export/
  CaptureArtifact.js
  ExportController.js
  PngExporter.js
  PdfExporter.js
  FilenameBuilder.js
```

Minimal first step, if we want a smaller change:

```text
code/capture/PdfExporter.js
```

But even in the minimal version, `PdfExporter` must behave as an export adapter over an existing capture result.

## Component Responsibilities

| Component | Responsibility |
| --- | --- |
| `PageProbe` | Measure the page and produce compact signals: size, scroll target, capture policy, avoid-range candidates. |
| `PositionPlanner` | Build scroll positions using the page measurement and protected ranges. |
| `CaptureStepper` | Execute the scroll/capture loop and produce viewport frames. |
| `CanvasStitcher` | Compose frames into one bitmap when safe. |
| `CanvasTiler` | Compose very large captures into safe tiles/parts. |
| `CaptureArtifact` | Represent the capture result in a format that PNG and PDF exporters can consume. |
| `ExportController` | Select the export adapter: PNG or PDF. |
| `PdfExporter` | Convert a `CaptureArtifact` into PDF pages. |
| `CaptureStore` or `ExportStore` | Save the final file and track download lifecycle. |
| `CaptureDiagnostics` | Store export status and summary, not a second capture diagnostic tree. |

## CaptureArtifact Contract

`CaptureArtifact` is the handoff between capture and export.

It should contain:

```text
CaptureArtifact
  sourceUrl
  title
  width
  height
  dpr
  outputMode: single | tiled
  bitmap
  tiles
  frames
  capturePolicy
  avoidRanges
  diagnosticsSummary
```

PDF should consume this object only. It should not read the DOM, scroll the page, mutate page styles, or classify page elements.

## PDF Export Behavior

MVP behavior:

1. Run the normal capture pipeline once.
2. Produce a `CaptureArtifact`.
3. If the artifact is a single bitmap, create PDF pages from that bitmap.
4. If the artifact is tiled, create PDF pages from tiles.
5. Use the same filenames rules as PNG.
6. Store PDF export status under the existing diagnostics/export section.

PDF diagnostics should look like an export summary:

```text
export.format = pdf
export.pdf.pageCount
export.pdf.source = singleBitmap | tiles
export.pdf.status
export.pdf.errors
```

## What PDF Must Not Do

| Do not add | Why |
| --- | --- |
| `PdfPageProbe` | Would duplicate DOM measurement and classification. |
| `PdfPositionPlanner` | Would create a second scroll plan that can diverge from PNG. |
| `PdfCaptureStepper` | Would create a second screenshot engine. |
| PDF-specific fixed/sticky handling | PNG and PDF would disagree visually. |
| PDF-specific split-boundary planner | Cards/text could be cut differently in PDF. |
| PDF-specific image readiness logic | Would duplicate readiness and timing behavior. |
| PDF based on print CSS as the default path | That is document printing, not screenshot export. |

## Redteam Check

Verdict: PASS with conditions.

This design satisfies the principle:

```text
Collapse repeated work, but preserve architectural boundaries.
```

Checklist:

| Criterion | Status | Explanation |
| --- | --- | --- |
| No repeated DOM probe | PASS | PDF consumes `CaptureArtifact`; it does not inspect the page. |
| No second scroll planner | PASS | PDF uses existing frames/tiles. |
| No second capture loop | PASS | `CaptureStepper` remains the only capture loop. |
| No duplicate fixed/sticky classification | PASS | PDF uses already-normalized capture output. |
| No duplicate split-boundary logic | PASS | PDF consumes existing artifact boundaries/tiles. |
| PageProbe -> PositionPlanner -> CaptureStepper -> Output remains intact | PASS | PDF starts after Output/CaptureArtifact. |
| Less per-frame diagnostics | PASS if implemented via export summary only | PDF must not add per-frame PDF diagnostics. |

Main risk:

```text
PDF can easily become a second screenshot engine.
```

The implementation must reject any design that re-probes, re-scrolls, re-classifies, or re-mutates the page specifically for PDF.

## Relationship To Future Simplification

This architecture helps future simplification because it creates a single capture-output contract.

Later we can consolidate:

| Current pieces | Future consolidation |
| --- | --- |
| `CanvasStitcher` + `CanvasTiler` | `RasterComposer` or unified output composer |
| `CanvasSizeGuard` + `SingleFileExportAttempt` | `OutputStrategyPlanner` |
| PNG/PDF save paths | `ExportController` + `ExportStore` |
| PNG/PDF filenames | `FilenameBuilder` |
| Export status/progress | shared export progress model |

But we should not do all of this in the first PDF change.

## Recommended Implementation Order

1. Add `CaptureArtifact` as a lightweight adapter around current stitcher/tiler output.
2. Add `PdfExporter` that consumes `CaptureArtifact`.
3. Add `ExportController` only if it reduces branching in `CaptureController`.
4. Store PDF status under existing `CaptureDiagnostics.export`.
5. Reuse `CaptureStore` download lifecycle.
6. Keep PNG behavior unchanged.
7. Add regression tests proving PDF does not call page probe, page scroll, or DOM mutation paths.

## Acceptance Criteria

- PDF export uses the same capture result as PNG.
- PDF export does not call `PageProbe.measure()`.
- PDF export does not call `PositionPlanner.createPlan()`.
- PDF export does not call `CaptureStepper.run()`.
- PDF export does not invoke `FixedStickyNormalizer`.
- PDF export records only export-level diagnostics.
- Large captures can create PDF from tiles without requiring one giant bitmap.
- PNG export behavior remains unchanged.

## Final Rule For Developers

```text
PDF must consume the existing CaptureArtifact.
PDF must not re-probe, re-scroll, re-classify, or mutate the page.
```
