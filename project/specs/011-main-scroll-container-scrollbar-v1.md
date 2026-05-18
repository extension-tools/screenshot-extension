# 011: Main Scroll Container Scrollbar V1

## Product Task

- `../product-tasks/011-main-scroll-container-scrollbar-v1.md`

## Goal

Extend scrollbar normalization to one dominant internal scroll container.

## Requirements

- Add `ScrollTargetFinder` to the content layer.
- Detect only one main internal scroll container.
- Hide that container's scrollbar through temporary CSS.
- Mark the selected container with a temporary data attribute through `DomMutationStack`.
- Restore the attribute and CSS during cleanup.
- Do not change the capture scroll target.
- Do not touch small scrollable controls.

## Architecture

```text
ContentAgent.prepareCapture()
  -> ScrollbarNormalizer.prepare()
      -> ScrollTargetFinder.findMainInternalScrollContainer()
      -> DomMutationStack.setAttribute(container, data-screenshot-extension-scroll-container, "main")
      -> DomMutationStack.appendNode(document.documentElement, style)
```

## Detection Rules

The finder scans body descendants and chooses the visible scrollable element with the largest viewport area.

Candidates must:

- have `overflow-x` or `overflow-y` set to `auto`, `scroll`, or `overlay`;
- have actual overflow: `scrollHeight > clientHeight` or `scrollWidth > clientWidth`;
- cover at least 25% of the viewport area;
- be visible in the viewport.

Candidates are skipped when they are:

- `html` or `body`;
- `textarea`, `input`, `select`, or `iframe`;
- contenteditable.

## Behavior

V1 only hides the scrollbar of the selected main internal container. It does not scroll that container or use it for frame planning.

## Known Limits

- Pages whose true capture target is an internal container still need a future scroll-target implementation.
- Custom scrollbar libraries are not covered.
- Some layouts may need controlled resize later.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual browser check on app-like pages with large internal scroll panes.

