# 020: Iframe Baseline V1

## Product Task

- `../product-tasks/020-iframe-baseline-v1.md`

## Goal

Add a baseline iframe guardrail without implementing deep iframe support.

## Requirements

- Add an iframe fixture to the capture-flow suite.
- Verify that a visible iframe marker is present in the final PNG.
- Add lightweight iframe diagnostics to page measurement.
- Do not scroll iframes.
- Do not inject the content agent recursively into iframes.
- Do not require new permissions.

## Fixture

The fixture lives at:

```text
project/tests/fixtures/iframe-baseline-page.html
```

It contains:

- normal content before and after the iframe;
- a visible same-origin `srcdoc` iframe;
- a bright green marker inside the visible iframe viewport.

## Case Definition

The case is registered in `project/tests/capture-flow.mjs`:

```js
{
  name: 'iframe-baseline-page',
  path: '/iframe-baseline-page.html',
  expected: 'download',
  assertions: {
    heightGreaterThanViewport: true,
    minColorPixels: [...],
    diagnostics: {
      iframeCountAtLeast: 1
    }
  }
}
```

## Diagnostics

`PageProbe.measure()` records:

```js
diagnostics: {
  iframeCount,
  inaccessibleIframeCount
}
```

These values are for reporting/debugging. They do not change capture behavior in v1.

## Current Behavior

Visible iframe pixels are captured because the extension uses `chrome.tabs.captureVisibleTab()` for each viewport frame. The v1 pipeline does not attempt to scroll or mutate iframe internals.

## Current Passing Signal

On the first passing run:

```text
PNG 1350x2326
iframeCount: 1
inaccessibleIframeCount: 0
visible iframe marker pixels: 658955
```

## Known Limits

- Cross-origin iframes are only captured as visible viewport pixels.
- Deep iframe scrolling is not supported.
- Fixed/sticky/lazy handling inside iframes is not supported.
- Sandboxed iframe behavior is best effort.
