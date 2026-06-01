# Product

## What We Are Building

Screenshot Extension is a Chrome-only browser extension for capturing full-page screenshots from real websites.

The product starts with one reliable workflow: capture the entire current page and save the result as an image. Over time, it should become a dependable screenshot tool for long pages, high-DPI displays, sticky layouts, lazy-loaded content, custom scroll areas, iframes, and very large pages.

## Product Priorities

- Keep the capture engine simple, mechanical, and understandable. Simple and medium pages should screenshot quickly; difficult pages should prioritize readable, stable output without adding combinatorial rules, site modes, or broad special-case systems.
- Reduce product-owner cognitive load: keep current priorities short, obvious, and decision-ready. Prefer one current table over scattered historical notes.

## Current Release Priorities

| User problem | Product priority |
| --- | --- |
| Text/cards are cut inside screenshots. | Must |
| Product cards are cut between PNG parts. | Must |
| User does not understand what is happening during capture. | Must |
| PDF export is needed. | Must |
| Popup duplicates in capture. | Nice to have |
| Only the first screen scrolls, not the whole page. | Nice to have |

Done/parked below the line: DJI product-detail split layout, Stripe cookie strip repeat, gray-looking PNG during download, and repeated black/top navigation.

Backlog below the line: blocking-popup capture continuing behind LEGO/Nike-style popups. The 2026-05-21 runtime scroll probe reduced false `viewport-only` risk for Samsung-like pages, but it did not close visually blocking overlays when programmatic scroll still moves the page behind the modal.

## StrategyDesk Status: Blocking Overlay Scroll Probe

Decision on 2026-05-21: park the deeper blocking-overlay/user-scroll detection work in backlog and return focus to current Must priorities. The current mechanical probe is useful as a diagnostic and false-positive reducer, but it is not enough to decide that a user-visible modal truly blocks the page.

Sites used for the decision:

- Samsung Galaxy S: https://www.samsung.com/us/smartphones/galaxy-s/
- LEGO Millennium Falcon: https://www.lego.com/en-us/product/millennium-falcon-75192
- Nike Air Force 1: https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111
- Dyson Vacuums: https://www.dyson.com/vacuum-cleaners

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

- Popup with explicit `Capture as PDF` and `Capture as PNG` actions.
- Service worker orchestration.
- Viewport-by-viewport capture through `chrome.tabs.captureVisibleTab`.
- Canvas stitching into one image.
- PDF export and PNG download through Chrome downloads.
- Original scroll position restoration after capture finishes or fails.

## Product Task Flow

Each meaningful change starts with a product task written from the product point of view.

```text
product task -> spec -> implementation -> tests -> changelog
```

Product tasks live in `project/product-tasks/`. A product task defines the problem, user, value, desired behavior, non-goals, and success criteria. The matching spec in `project/specs/` turns that input into technical requirements, architecture, edge cases, and test coverage.
