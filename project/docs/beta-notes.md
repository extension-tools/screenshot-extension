# Beta Notes

This file records known limitations, accepted tradeoffs, and deferred cases. Gate criteria live in `project/docs/beta-stability.md`.

## Scope

Historical beta scope was PNG full-page capture in Chrome. Decision update on 2026-05-20: current release scope also includes PDF export and clearer capture communication.

Included:

- Chrome MV3 extension;
- popup button capture flow;
- PNG download;
- full-page capture for normal long pages;
- multi-part PNG output when one giant PNG is unsafe;
- sticky/fixed normalization;
- lazy-load warmup and image-readiness diagnostics;
- one high-confidence internal scroll container;
- visible-width capture for horizontal app-shell/workspace content.

Not included:

- editor, crop, or annotation tools;
- accounts or cloud storage;
- Chrome Web Store distribution;
- deep iframe scrolling;
- complete infinite-scroll or virtualized-history reconstruction;
- expanding hidden horizontal canvases/boards/tables beyond visible width.

PDF export is no longer optional, but it should reuse the existing PNG/tiled capture pipeline and diagnostics rather than bypassing them.

## Known Limitations

### Internal Scroll Containers

The beta supports one main internal scroll container when the page looks like an app shell and window scroll is not meaningful.

It does not support perfect capture of every custom scroll area. If a page has several similar independent scroll containers, the extension may fall back to window capture or capture only the primary target.

For horizontal internal scrolling, the beta captures visible app shell and visible working area only. It does not promise to expand the entire canvas, board, table, editor, or workspace to the right.

### Iframes

Visible iframe pixels are captured as part of the rendered viewport when Chrome includes them in `captureVisibleTab`.

Deep iframe scrolling is not supported. The extension does not recursively scroll, warm, or normalize iframe content, especially cross-origin iframes.

### Login And Bot-Blocked Pages

Login-only, bot-protected, CAPTCHA, consent-blocked, or otherwise inaccessible pages may not capture correctly.

These are classified as blocked access rather than capture-engine failures unless a prepared logged-in browser profile is explicitly used.

### Infinite Scroll And Virtualized History

Lazy warmup is bounded. The extension does not intentionally expand infinite feeds forever.

Virtualized chat/message history is best effort: capture the currently rendered range, not hidden/unloaded history.

### Huge Pages

Very large pages may be saved as multiple PNG parts. This is intentional: split into valid files rather than risking a blank image or failed canvas export.

Extremely wide pages or pages requiring too many output parts may still return a controlled error.

## Deferred / Accepted Cases

| Case | URL | Current decision |
| --- | --- | --- |
| DJI Mini 4 Pro product-detail split layout | https://store.dji.com/product/dji-mini-4-pro?vid=148581 | Deferred out of beta. Window scroll advances right purchase/accessory column while left media stays pinned. GoFullPage and FireShot also do not close this case. |
| Samsung Galaxy S dimmed popup continuity | https://www.samsung.com/us/smartphones/galaxy-s/ | Deferred until diagnostics prove whether this is layout instability or overlay-state policy. Do not change fixed-header or overlay policy in the same diff. |
| Sony WH-1000XM5 rich-media/product layout | https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b | Later risk: duplicated hero/title, clipped media, missing lower backgrounds/text, height-clipped blocks. |
| Mermaid Live Editor blank startup | https://mermaid.live/ | Later app-shell readiness risk, not current Must. |
| Stripe cookie strip repeat | https://docs.stripe.com/ | Done/parked; keep as regression control only. |
| LEGO/Nike blocking popup state | https://www.lego.com/en-us/product/millennium-falcon-75192 / https://www.nike.com/t/air-force-1-07-mens-shoes-5QFp5Z/CW2288-111 | Backlog. Runtime scroll probe was tested on 2026-05-21 and did not close this class because programmatic scroll can move behind a visually blocking modal. Do not continue this feature in the current release slice. |
| Docs sidebar repetition | Next.js, Laravel, TypeScript Handbook, Prisma | Accepted for beta after sticky normalization; keep as regression controls, but broad repeated-sidebar hints alone should not force Look First. |
| Allbirds, Sonos, Diagrams.net, Figma Community, GoPro, JSFiddle, Nintendo Switch, TypeScript Handbook | Various | Current artifacts manually accepted unless a new visible defect appears. |

## Active Notes

- StrategyDesk status: blocking-overlay/user-scroll detection is parked in backlog. Current focus returns to split-boundary/card seams, tiled-output card boundaries, capture communication, and PDF export. Decision controls: Samsung Galaxy S, LEGO Millennium Falcon, Nike Air Force 1, Dyson Vacuums.
- Patagonia Jackets is a Must split-boundary/card-placement case and a Nice-to-have repeated popup/modal normalization case.
- REI Backpacks is a Must tiled-output product-card boundary case; repeated side chrome/filter panel is separate.
- FastAPI right Table of contents/sidebar clipping remains active split-boundary/sidebar text risk.
- Apple iPhone and Apple MacBook Air remain active split-boundary/missing-content examples.
- MDN Web API remains active split-boundary text clipping during multi-part slicing.
- Microsoft Surface Pro over-wide/right-gray output class is guarded by width clamp, but keep it as regression-watch.

## Current User-Facing Copy

- Image-readiness notification: `If some images didn’t load, try again in a few seconds.`

## Browser Verification Note

The 2026-05-17 overnight pass ran in separate automated Chromium, not the user's manual browser. For Diagrams.net, the automated artifact captured a loading screen, so manual verification of the loaded editor is the source of truth.
