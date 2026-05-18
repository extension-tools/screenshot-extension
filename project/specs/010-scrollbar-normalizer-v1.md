# 010: Scrollbar Normalizer V1

## Product Task

- `../product-tasks/010-scrollbar-normalizer-v1.md`

## Goal

Hide root page scrollbars during full-page capture so they are not stitched into the final image.

## Requirements

- Implement the normalizer in `code/content/`.
- Run it from `ContentAgent.prepareCapture()`.
- Use `DomMutationStack` to append and remove temporary CSS.
- Target only root `html/body` scrollbars in v1.
- Do not dispatch a synthetic resize event in v1.
- Do not handle custom scrollbar libraries in v1.

## Architecture

```text
ContentAgent.prepareCapture()
  -> ScrollbarNormalizer.prepare()
      -> DomMutationStack.appendNode(document.documentElement, style)

ContentAgent.cleanupCapture()
  -> DomMutationStack.restoreAll()
      -> remove temporary style node
```

## CSS Policy

V1 injects temporary CSS for root scrollbars:

```css
html::-webkit-scrollbar,
body::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
}

html,
body {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
```

## Why This Approach

Hiding scrollbars before `chrome.tabs.captureVisibleTab` is safer than cropping pixels after capture. Scrollbars can appear on different sides, use overlay rendering, include horizontal bars, or vary by operating system.

## Known Limits

- One dominant internal scroll container is handled by `011-main-scroll-container-scrollbar-v1.md`.
- Custom scrollbar tracks are not handled yet.
- Some pages may require a controlled resize event after scrollbar hiding; v1 intentionally avoids this until a concrete site needs it.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual browser check on the site where duplicated scrollbars appeared.
