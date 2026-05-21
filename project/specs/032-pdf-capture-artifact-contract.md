# 032: PDF CaptureArtifact Contract

## Product Task

- `../product-tasks/032-pdf-capture-artifact-contract.md`

## Goal

Define the contract between the existing capture pipeline and future PNG/PDF export adapters.

The goal is to add PDF export without adding a second capture engine.

## Core Rule

```text
PDF must consume the existing CaptureArtifact.
PDF must not re-probe, re-scroll, re-classify, or mutate the page.
```

## Architecture Position

Current capture layers should remain intact:

```text
PageProbe -> PositionPlanner -> CaptureStepper -> Output
```

The PDF work starts after capture output exists:

```text
CanvasStitcher / CanvasTiler
  -> CaptureArtifact
  -> ExportController
      -> PngExporter
      -> PdfExporter
  -> CaptureStore
```

## CaptureArtifact Shape

`CaptureArtifact` is a plain data object produced by the output layer and consumed by export adapters.

```js
{
  version: 1,
  format: "capture-artifact",

  source: {
    url: string,
    title: string,
    capturedAt: string
  },

  page: {
    cssWidth: number,
    cssHeight: number,
    viewportWidth: number,
    viewportHeight: number,
    dpr: number
  },

  output: {
    mode: "single-bitmap" | "tiled",
    bitmapWidth: number,
    bitmapHeight: number,
    tileCount: number
  },

  singleBitmap: {
    blob: Blob,
    mimeType: "image/png",
    width: number,
    height: number
  } | null,

  tiles: [
    {
      index: number,
      partNumber: number,
      blob: Blob,
      mimeType: "image/png",
      x: number,
      y: number,
      width: number,
      height: number
    }
  ],

  capture: {
    policy: object,
    scrollTarget: object,
    avoidRanges: array,
    strategy: object
  },

  diagnosticsSummary: {
    status: string,
    failureReason: string | null,
    imageReadiness: object | null,
    output: object | null,
    export: object | null
  }
}
```

## Required Fields

| Field | Required | Why |
| --- | --- | --- |
| `source.url` | yes | PDF metadata and filename context. |
| `source.title` | yes | Human-readable filename/title. |
| `page.cssWidth/cssHeight` | yes | PDF page sizing and scaling. |
| `page.dpr` | yes | Correct bitmap-to-CSS scale conversion. |
| `output.mode` | yes | Decide single-bitmap vs tile-based PDF generation. |
| `output.bitmapWidth/bitmapHeight` | yes | PDF image placement. |
| `singleBitmap.blob` | yes when mode is `single-bitmap` | Source image for PDF pages. |
| `tiles[]` | yes when mode is `tiled` | Source images for PDF pages without a giant canvas. |
| `capture.policy` | yes | Traceability; PDF must not recompute it. |
| `capture.avoidRanges` | yes | Traceability and future PDF pagination safety. |
| `diagnosticsSummary` | yes | Export can report status without deep capture diagnostics. |

## Explicit Non-Responsibilities

`CaptureArtifact` must not:

- read the DOM;
- scroll the page;
- call `PageProbe.measure()`;
- call `PositionPlanner.createPlan()`;
- call `CaptureStepper.run()`;
- invoke `ContentAgent`;
- invoke `FixedStickyNormalizer`;
- create new split-boundary decisions;
- create new image-readiness decisions.

## Export Adapter Contract

An exporter receives a `CaptureArtifact` and returns an export result.

```js
async function exportArtifact({artifact, prefs}) {
  return {
    ok: boolean,
    format: "png" | "pdf",
    filename: string,
    blob: Blob | null,
    files: array,
    diagnostics: {
      source: "singleBitmap" | "tiles",
      pageCount: number | null,
      status: "saved" | "failed",
      errors: array
    }
  };
}
```

## PDF MVP Rules

| Case | Expected behavior |
| --- | --- |
| Single bitmap capture | `PdfExporter` creates PDF pages from the bitmap. |
| Tiled capture | `PdfExporter` creates PDF pages from tiles. It must not request a giant canvas. |
| Export failure | Return controlled export error and preserve capture diagnostics. |
| PNG export | Existing PNG behavior remains unchanged. |

## PDF Page Strategy

MVP should use page-based PDF output from existing bitmap/tiles.

Default recommendation:

```text
PDF pages from existing capture bitmap/tiles.
No new page capture logic.
```

Open product decision before implementation:

| Option | Product effect |
| --- | --- |
| One long PDF page | Closest to a full-page screenshot, less print-friendly. |
| A4/Letter pages | More document-like, needs pagination and scaling decisions. |
| Pages from existing tiles | Best starting point for large pages, reuses current output boundaries. |

Recommended MVP:

```text
Use existing output boundaries.
For single bitmap, paginate by chosen PDF page height.
For tiled output, use tiles as page/image sources without recomposing a giant bitmap.
```

## Diagnostics Contract

PDF diagnostics are export diagnostics, not capture diagnostics.

Add under existing export diagnostics:

```text
export.format = pdf
export.pdf.source = singleBitmap | tiles
export.pdf.pageCount
export.pdf.status
export.pdf.errors
```

Always-on:

- export format;
- source mode;
- page count;
- download lifecycle;
- export status/errors.

Debug/research only:

- detailed pagination decisions;
- per-page image placement details;
- tile-to-page mapping samples.

## Tests Before Implementation Is Done

Add tests or assertions that prove:

- PDF export does not call `PageProbe.measure()`;
- PDF export does not call `PositionPlanner.createPlan()`;
- PDF export does not call `CaptureStepper.run()`;
- PDF export does not invoke `ContentAgent`;
- PDF export does not invoke `FixedStickyNormalizer`;
- single-bitmap artifact can produce a PDF export result;
- tiled artifact can produce a PDF export result without allocating one giant canvas;
- PNG export behavior stays unchanged.

## Redteam Notes

Risk: PDF becomes a second screenshot engine.

Reject any implementation that adds:

- PDF-specific DOM probing;
- PDF-specific scroll planning;
- PDF-specific fixed/sticky logic;
- PDF-specific split-boundary classification;
- PDF-specific image-readiness logic.

Allowed:

- PDF-specific page sizing;
- PDF-specific image scaling;
- PDF-specific metadata;
- PDF-specific export diagnostics.

## Implementation Boundary

This spec is a pre-code contract.

Do not implement PDF export until these are decided:

1. PDF library choice.
2. PDF page size policy.
3. `CaptureArtifact` producer location.
4. Whether to introduce `ExportController` immediately or keep a minimal `PdfExporter` first.
5. Test strategy for "no second capture pipeline".
