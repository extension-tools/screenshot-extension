# Beta Notes

## Scope

This beta is focused on PNG full-page capture in Chrome.

Included:

- Chrome MV3 extension;
- popup button capture flow;
- PNG download;
- normal long pages;
- sticky/fixed normalization v1;
- scrollbar hiding v1;
- lazy-load warmup v1;
- one high-confidence internal scroll container;
- large-page multi-PNG output when one giant PNG would be unsafe.

Not included:

- PDF export;
- editor, crop, or annotation tools;
- accounts or cloud storage;
- Chrome Web Store distribution.

## Known Limitations

### Internal Scroll Containers

The beta supports one main internal scroll container when the page looks like an app shell.

It does not support perfect capture of every custom scroll area on the page. If a page has several similar independent scroll containers, the extension may fall back to normal window capture or capture only the primary target.

For pages with horizontal internal scrolling, the beta captures the visible app shell and visible working area. It does not promise to expand the entire canvas, board, table, editor, or workspace to the right.

### Iframes

Visible iframe pixels are captured as part of the rendered viewport when Chrome includes them in `captureVisibleTab`.

Deep iframe scrolling is not supported in this beta. The extension does not recursively scroll, warm, or normalize content inside iframes, especially cross-origin iframes.

### Login And Bot-Blocked Pages

Login-only, bot-protected, CAPTCHA, consent-blocked, or otherwise inaccessible pages may not capture correctly.

These are classified as blocked access rather than capture-engine failures unless a prepared logged-in browser profile is explicitly used for testing.

### Infinite Scroll And Virtualized History

The beta performs bounded lazy-load warmup, but it does not intentionally expand infinite feeds forever.

Virtualized chat/message history is best effort. The extension may capture the currently available rendered range, but it does not reconstruct hidden or unloaded history.

### Huge Pages

Very large pages may be saved as multiple PNG parts.

This is intentional. The extension tries to save one image when it is safe. When browser canvas limits make one giant PNG unreliable, the result is split into multiple valid PNG files instead of risking a blank image or failed capture.

Extremely wide pages or pages requiring too many output parts may still return a controlled error.

### Beta Quality Rules

For selected app-shell beta targets, capture should include:

- the main scrollable content;
- the visible sidebar or left navigation;
- the top chrome/header when visible.

For app-shell targets with horizontal workspaces, hidden content beyond the visible width is a known beta limitation, not a beta blocker.

Gray lazy preview grids on beta target segments are treated as failures, not successful captures.

## Current Priority Site Types

The first beta checks prioritize:

- docs, wiki, and blog pages;
- ecommerce and product pages;
- ChatGPT/Claude-style app-shell pages.

## Current Deferred Risk Cases

These are known from manual review and should not be rediscovered from scratch on every run:

- LEGO Millennium Falcon — https://www.lego.com/en-us/product/millennium-falcon-75192: latest manual review marked the current artifact OK for beta. Product rule remains: if the first-run popup blocks normal user scrolling, the correct capture is only the first visible viewport with the popup open; the extension should not hide the popup after frame 0 and programmatically scroll the background as if the user had closed it.
- Bose Headphones — https://www.bose.com/c/headphones: promo popup-repeat is fixed in the latest targeted visual artifact; the site still has a tiny bottom scroll-settle automation risk.
- Patagonia Jackets — https://www.patagonia.com/shop/mens/jackets-vests: latest manual review found two active defects. The left product filter sidebar repeats down the product grid, and product cards are cut by PNG part boundaries. Treat as active repeated product filter/sidebar chrome plus product-card split-boundary clipping; slicing should keep product cards whole within each generated screenshot part.
- Apple MacBook Air — https://www.apple.com/macbook-air/: latest manual review found that the `Our values lead the way` section dropped the middle `Privacy. That's Apple.` card in the captured output, while the live site shows three cards. Treat as active missing-content/carousel-card-drop plus split-boundary risk, not as passed sample output.
- MDN Web API — https://developer.mozilla.org/en-US/docs/Web/API: latest manual review found text/list rows clipped at the bottom of a PNG part boundary near the lower page. Treat as active split-boundary text clipping during multi-part slicing, not as passed sample output.
- Sony WH-1000XM5 — https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b: popup-repeat is fixed, but latest manual review found active visual defects: duplicated product title/hero section, clipped first-screen headphone image with a shifted headphone fragment under the duplicated title, a lower mostly-white block missing its background image and left text, and another block clipped by height so image/text are cut near the top. Treat Sony as an active product-hero duplication plus missing-content/seam/split-boundary risk.
- REI Backpacks — https://www.rei.com/c/backpacks: latest manual review found three active defects. Product cards are cut by PNG part boundaries, left sidebar subcategories duplicate, and the left `Store Pickup` / shipping form repeats even though it appears only once on the live site. Treat as active product-card split-boundary plus repeated sidebar subcategory/form chrome, not as a deferred image-readiness-only risk.
- Eleventy Docs — https://www.11ty.dev/docs/: latest manual review says the current Look-first artifact is OK for beta. Do not treat older broken-image/noisy-readiness signals as a current blocker unless a new visible defect appears.
- FastAPI Docs — https://fastapi.tiangolo.com/: latest manual review found the right Table of contents/sidebar text clipped near the lower edge. Treat as active right-sidebar text clipping / split-boundary defect, not as passed sample output.
- Sonos Shop — https://www.sonos.com/en-us/shop: former black/blank multi-part output was traced to repeat-overlay CSS hiding `body.has-cookie-banner` and is fixed. Manual review after the overnight stability pass has no remaining questions; do not treat as a current blocker.
- TypeScript Playground — https://www.typescriptlang.org/play/: former sample target moved to `UNSTABLE SITE`; one app-shell scroll frame did not settle.
- TypeScript Handbook — https://www.typescriptlang.org/docs/handbook/intro.html: manual review passed; do not treat the current scroll-settle-only automated signal as a beta blocker unless a new visible defect appears.
- Figma Community — https://www.figma.com/community: repeated manual review found current screenshots acceptable; do not keep sending as a fresh required review item unless a new artifact shows a new defect.
- GoPro HERO — https://gopro.com/en/us/shop/cameras: manual sample review passed; no visible capture defect found in the current artifact.
- JSFiddle — https://jsfiddle.net/: manual sample review passed; no visible capture defect found in the current artifact.
- Nintendo Switch — https://www.nintendo.com/us/store/products/nintendo-switch-oled-model-white-set-115461/: latest manual review marked the current artifact OK for beta. Do not treat conservative modal/uncertain signals as a current blocker unless a new visible defect appears.
- Mermaid Live Editor — https://mermaid.live/: automated artifact captured a blank white page while manual browser review shows a loaded dark editor/diagram app shell. This is a current app-shell startup/readiness bug to investigate, not an accepted sample.
- Microsoft Surface Pro — https://www.microsoft.com/en-us/surface/devices/surface-pro-11th-edition: automated artifact captured very wide multi-part output with large gray right-side areas. This is a current over-wide measurement/right-side blank-space bug to investigate, not an accepted sample.
- Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners: repeated sticky header and repeated shipping/country popup are fixed. Manual review after the overnight stability pass has no remaining questions; do not treat as a current blocker.
- Diagrams.net App — https://app.diagrams.net/: manual capture with the updated extension is good. The overnight automated artifact captured a loading screen, so it should not be used as visual evidence for the loaded editor. Do not treat as a current blocker.

Current user-facing image-readiness copy:

- `If some images didn’t load, try again in a few seconds.`

Current browser verification note:

- The 2026-05-17 overnight pass was run in a separate automated Chromium, not the user's manual browser.
- Allbirds Wool Runners — https://www.allbirds.com/products/mens-wool-runners, Sonos Shop — https://www.sonos.com/en-us/shop, and Diagrams.net App — https://app.diagrams.net/ are manually accepted after user review. Diagrams.net's automated screenshot from that run captured a loading screen, so manual verification is the source of truth for that site.

Accepted sample-review cases:

- Apple iPhone — https://www.apple.com/iphone/: latest manual review found two defects. The `Why Apple is the best` heading/subtitle is clipped at a PNG part boundary, and a lower `iPhone` section captured as mostly blank even though the live site shows navigation columns there. Treat as active split-boundary/text-clipping plus missing-content/incomplete-section risk, not as passed sample output.
- Figma Community — https://www.figma.com/community: repeated manual sample reviews found no current visible capture issues.
- GoPro HERO — https://gopro.com/en/us/shop/cameras: manual sample review passed.
- JSFiddle — https://jsfiddle.net/: manual sample review passed.
- React Learn — https://react.dev/learn: repeated manual sample reviews found no visible capture issues.
