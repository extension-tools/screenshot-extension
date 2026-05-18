# Product

## What We Are Building

Screenshot Extension is a Chrome-only browser extension for capturing full-page screenshots from real websites.

The product starts with one reliable workflow: capture the entire current page and save the result as an image. Over time, it should become a dependable screenshot tool for long pages, high-DPI displays, sticky layouts, lazy-loaded content, custom scroll areas, iframes, and very large pages.

## Target Users

- People who need to archive full web pages.
- QA and product teams checking visual states of websites.
- Designers and researchers collecting page references.
- Operators who need quick screenshots without opening a separate editor.

## Product Value

- One-click full-page capture from Chrome.
- Predictable output on real, messy web pages.
- Readable download filenames that are recognizable in Downloads without opening the image.
- Small permission surface, so users can understand what the extension needs.
- Clear failure behavior when Chrome blocks capture or a page is unsupported.
- Regression checks that help us avoid breaking capture behavior as the product grows.

## Product Constraints

- Chrome MV3 only.
- No Firefox, Edge, or legacy extension branches in this product.
- No external editor dependency in the core workflow.
- Local development and testing must work without a Chrome Web Store developer account.
- Restricted browser pages such as `chrome://` and Chrome Web Store pages cannot be captured through normal extension APIs.

## Current MVP

- Popup with a single `Capture Entire Page` command.
- Service worker orchestration.
- Viewport-by-viewport capture through `chrome.tabs.captureVisibleTab`.
- Canvas stitching into one image.
- Download through Chrome downloads.
- Original scroll position restoration after capture finishes or fails.

## Product Task Flow

Each meaningful change starts with a product task written from the product point of view.

```text
product task -> spec -> implementation -> tests -> changelog
```

Product tasks live in `project/product-tasks/`. A product task defines the problem, user, value, desired behavior, non-goals, and success criteria. The matching spec in `project/specs/` turns that input into technical requirements, architecture, edge cases, and test coverage.
