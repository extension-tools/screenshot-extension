# 018: Sticky Scrollbar Capture Test

## Product Task

- `../product-tasks/018-sticky-scrollbar-capture-test.md`

## Goal

Add the first capture-flow edge-case test for fixed/sticky duplication and scrollbar hiding.

## Fixture

The fixture lives at:

```text
project/tests/fixtures/sticky-scrollbar-page.html
```

It contains:

- a magenta fixed header;
- a cyan fixed cookie banner;
- a yellow sticky nav;
- a large internal scroll panel with red scrollbar track and blue scrollbar thumb markers;
- enough page height to require multi-frame stitching.

## Case Definition

The case is registered in `project/tests/capture-flow.mjs`:

```js
{
  name: 'sticky-scrollbar-page',
  path: '/sticky-scrollbar-page.html',
  expected: 'download',
  assertions: {
    heightGreaterThanViewport: true,
    colorBands: [...],
    maxColorPixels: [...]
  }
}
```

## Assertions

The test parses the downloaded PNG and checks:

- PNG height is greater than the viewport height.
- Magenta fixed-header rows stay within the single-appearance range.
- Cyan cookie-banner rows do not exceed the repeat threshold.
- Yellow sticky-nav rows stay within the single-appearance range.
- Red internal-scrollbar track pixels stay below the visibility threshold.
- Blue internal-scrollbar thumb pixels stay below the visibility threshold.

## Artifact Layout

```text
project/tests/capture-results/latest/sticky-scrollbar-page.png
project/tests/capture-results/latest/cases/sticky-scrollbar-page/report.md
project/tests/capture-results/latest/cases/sticky-scrollbar-page/sticky-scrollbar-page.png
```

## Current Passing Signal

On the first passing run:

```text
PNG 1365x2609
fixed header rows: 144
fixed cookie rows: 0
sticky nav rows: 80
red scrollbar pixels: 0
blue scrollbar pixels: 0
```

The cyan cookie banner can be partially or fully overwritten by later overlapped tiles. That is acceptable for this case because the purpose is to catch repeated banners, not guarantee that the first-frame banner is preserved.

## Known Limits

- The assertion uses marker colors instead of full image diffing.
- It validates one synthetic fixture, not all real-world sticky implementations.
- The fixture checks one dominant internal scroll container.
