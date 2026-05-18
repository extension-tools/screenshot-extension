# 019: Huge Page Guard Capture Test

## Product Task

- `../product-tasks/019-huge-page-guard-capture-test.md`

## Status

Superseded for supported tall pages by `005-large-page-canvas-tiling.md`.

## Goal

Add capture-flow coverage for the MVP large-page safety guard.

## Fixture

The fixture lives at:

```text
project/tests/fixtures/huge-page-guard.html
```

It creates a page tall enough to exceed the current single-canvas dimension limit:

```text
Output would be about 1365x19170px at DPR 1.
```

## Case Definition

The case is registered in `project/tests/capture-flow.mjs`:

```js
{
  name: 'huge-page-tiling',
  path: '/huge-page-guard.html',
  expected: 'multi-download'
}
```

## Assertions

The current tall-page test passes only when:

- capture returns success;
- multiple PNG parts are downloaded;
- every PNG part stays within the safe canvas height.

## Artifact Layout

```text
project/tests/capture-results/latest/cases/huge-page-tiling/report.md
```

This case produces multiple PNG artifacts.

## Current Passing Signal

On the first passing run:

```text
Status: passed
Expected: multi-download
PNG parts: 1365x16384, 1365x2786
```

## Known Limits

- This validates supported tall-page tiling, not unsupported wide-page rejection.
- Future guard tests should target unsupported width or excessive output-part counts.
