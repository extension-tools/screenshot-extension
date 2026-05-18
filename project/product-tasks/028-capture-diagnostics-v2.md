# Product Task: Capture Diagnostics V2

## Problem

When real-site capture fails or produces questionable output, the team needs to know whether the cause is page size, DPR, selected strategy, scroll target selection, image readiness, export, download, or a product limitation.

## User

Product, QA, and engineering reviewers validating the PNG beta on real websites.

## Value

Diagnostics reduce guessing. They make it faster to decide whether a failure should be fixed immediately as a capture-engine bug or documented as a beta limitation.

## Desired Behavior

- Store a structured v2 diagnostics object for each capture.
- Include CSS page size, bitmap size, DPR, strategy, tile count, scroll target, single-file export decision, export/download status, failure reason, and image readiness summary.
- Preserve existing diagnostics fields used by current tests and reports.
- Write diagnostics for both successful captures and controlled failures whenever possible.

## Non-Goals

- No external telemetry.
- No analytics provider.
- No user-visible debug UI.

## Success Criteria

- `lastCaptureDiagnostics.version` is `2`.
- Capture-flow reports include `Capture Diagnostics v2`.
- `huge-page-tiling` verifies v2 status, output strategy, export status, scroll target, and bitmap size.
- Real-site QA reports include v2 diagnostics.

## Related Spec

- `../specs/028-capture-diagnostics-v2.md`
