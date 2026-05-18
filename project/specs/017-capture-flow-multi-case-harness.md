# 017: Capture Flow Multi-Case Harness

## Product Task

- `../product-tasks/017-capture-flow-multi-case-harness.md`

## Goal

Refactor the capture-flow automation from a single hardcoded scenario into a small multi-case runner.

## Requirements

- Keep `project/tests/capture-flow.mjs` as the entry point.
- Define cases as data at the top of the runner.
- Run each case independently with its own temporary extension copy, Chrome profile, downloads folder, and report.
- Keep the production extension manifest unchanged.
- Keep the test-only `<all_urls>` host permission limited to the temporary extension copy.
- Preserve headed Chromium execution.
- Preserve the existing `basic-long-page` assertion that downloaded PNG height is greater than viewport height.

## Case Shape

Each case can define:

```js
{
  name: 'basic-long-page',
  path: '/basic-long-page.html',
  expected: 'download',
  assertions: {
    heightGreaterThanViewport: true
  }
}
```

Cases can also define pixel assertions:

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

Supported expectations:

- `download`: capture should complete and produce a readable PNG.
- `error`: capture should fail with a controlled error and should not download a PNG.

## Artifact Layout

Summary report:

```text
project/tests/capture-results/latest/report.md
```

Per-case artifacts:

```text
project/tests/capture-results/latest/cases/<case-name>/report.md
project/tests/capture-results/latest/cases/<case-name>/<case-name>.png
project/tests/capture-results/latest/cases/<case-name>/downloads/
project/tests/capture-results/latest/cases/<case-name>/profile/
```

For convenience, successful PNG cases also copy the image to:

```text
project/tests/capture-results/latest/<case-name>.png
```

## Active Cases

- `basic-long-page`: proves basic full-page capture produces a PNG taller than the viewport.
- `sticky-scrollbar-page`: checks fixed/sticky repetition and internal scrollbar hiding with marker-color assertions.
- `lazy-load-page`: checks pre-capture lazy warmup with a scroll-triggered marker.
- `huge-page-tiling`: checks vertical tiled output for pages above the single-canvas height limit.
- `iframe-baseline-page`: checks visible iframe viewport capture and iframe diagnostics.
- `internal-scroll-container-page`: checks one high-confidence internal scroll container capture.

## Next Cases

This harness is intended to keep adding focused fixtures as capture architecture grows.

## Known Limits

- `multi-download` cases are supported and currently covered by `huge-page-tiling`.
- Pixel-level assertions are marker-based, not full golden-image diffs.
- The test still triggers capture through the internal extension test message rather than a physical toolbar click.
