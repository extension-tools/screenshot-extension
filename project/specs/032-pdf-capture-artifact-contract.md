# 032: PDF Export v1 Runtime Contract

## Product Task

- `../product-tasks/032-pdf-capture-artifact-contract.md`

## Goal

Describe the actual shipped contract for `PDF export v1`.

The implementation adds PDF export without adding a second capture engine and without changing the existing PNG capture pipeline.

## Shipped Core Rule

```text
PDF export consumes the existing capture result.
PDF export must not re-probe, re-scroll, re-classify, or mutate the page.
```

## Shipped Architecture Position

Capture layers remain unchanged:

```text
PageProbe -> PositionPlanner -> CaptureStepper -> CanvasStitcher / CanvasTiler
```

PDF work starts only after capture output already exists:

```text
CaptureController.runCommand(...)
  -> captureEntire(tab)
  -> saveCaptureResult(result, tab, exportFormat)
      -> savePngResult(result, tab)
      -> exportPdfResult(result, tab)
          -> PdfExporter.export({result})
          -> CaptureStore.save(pdfBlob, tab)
```

## Ownership

- `code/worker.js`
  - normalizes `exportFormat`
  - loads `PdfExporter` through `importScripts(...)`
  - remains a thin command router
- `code/capture/CaptureController.js`
  - owns the export seam below the capture pipeline
  - preserves the existing PNG save path
  - routes PDF export to `PdfExporter`
- `code/capture/PdfExporter.js`
  - builds a final PDF from the existing capture result
  - does not touch capture-time modules or the DOM

## Runtime Input Contract

`PdfExporter` consumes the existing `captureEntire()` result shape, not a separate `CaptureArtifact` object.

Relevant fields:

```js
{
  mode: "single-canvas" | "tiled-output",
  blob: Blob | null,
  files: Array<{
    index: number,
    blob: Blob
  }> | null,
  diagnosticsV2: {
    export?: object
  }
}
```

Only these fields are required for `PDF v1` behavior:

| Field | Required | Why |
| --- | --- | --- |
| `result.mode` | yes | Select `single-canvas` vs `tiled-output` export behavior. |
| `result.blob` | yes when mode is `single-canvas` | Source bitmap for the one-page PDF path. |
| `result.files[]` | yes when mode is `tiled-output` | Source tile images for the multi-page PDF path. |
| `file.index` | yes for tiled output | Preserve page order when tiles are exported to PDF pages. |

## PDF v1 Behavior

`PDF v1` uses materialized capture output only.

Rules:

| Case | Shipped behavior |
| --- | --- |
| `single-canvas` | One capture bitmap becomes one PDF page. |
| `tiled-output` | One tile becomes one PDF page. |
| PNG export | Existing `save` / `saveMultiple` behavior remains unchanged. |
| PDF export | A single final PDF file is saved through `CaptureStore.save(...)`. |

## Explicit Non-Responsibilities

`PDF v1` does not:

- call `PageProbe.measure()`;
- call `PositionPlanner.createPlan()`;
- call `CaptureStepper.run()`;
- invoke `ContentAgent`;
- invoke `FixedStickyNormalizer`;
- read the DOM;
- scroll the page;
- build a second capture loop;
- build a new page-break planner;
- merge all tiles into one giant raster before export;
- create A4/Letter pagination.

## Page Strategy

The shipped `PDF v1` page strategy is:

```text
single-canvas -> one PDF page
tiled-output -> one tile = one PDF page
```

This is intentionally different from a paginated print-style PDF design.

`PDF v1` does not implement:

- A4 pagination
- Letter pagination
- locale-based page size policy
- user-selectable page size

Those remain future product decisions, not shipped behavior.

## Diagnostics Contract

PDF diagnostics live inside the existing runtime export summary on `diagnosticsV2.export`.

Shipped fields:

```text
export.status
export.files
export.errors
export.format = pdf
export.pdf.pageCount
export.pdf.source
export.pdf.pageMode
```

Meaning:

- `export.status/files/errors` describe the save lifecycle
- `export.format/pdf.*` describe the bounded PDF summary

No heavy artifacts are stored in diagnostics.

## Error Contract

`PdfExporter` returns controlled failures for invalid runtime inputs:

- unsupported capture result mode
- missing `result.blob` for `single-canvas`
- missing `result.files` for `tiled-output`
- missing `file.blob` for an individual tile

## Test Contract

The shipped implementation is protected by:

- targeted runtime tests in `project/tests/export-format-plumbing-smoke.mjs`
- browser-level PNG regression checks in `project/tests/capture-flow.mjs`
- browser-level PDF smoke checks for:
  - one `single-canvas` case
  - one `tiled-output` case

Key assertions:

- `exportFormat: 'pdf'` is preserved through worker routing
- invalid format falls back to `png`
- `captureEntire()` runs once
- PNG still uses the old save path
- PDF uses `PdfExporter.export({result})`
- PDF uses `CaptureStore.save(...)`
- PDF does not use `saveMultiple(...)`
- `single-canvas` yields one PDF page
- `tiled-output` yields one page per tile

## Post-Implementation Note

`code/worker.js` was touched only as a load point for `PdfExporter` registration in `importScripts(...)`.

That does not make `worker.js` an owner of PDF export behavior.

## Scope Boundary

This document describes the shipped `PDF export v1` contract.

It is not a pre-implementation artifact anymore.
