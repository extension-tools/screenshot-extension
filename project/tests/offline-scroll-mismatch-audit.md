# Offline scroll mismatch audit

Date: 2026-05-20

No browser was launched. This audit only reads existing markdown reports and archived run artifacts.

## Sources

- `project/tests/real-site-qa-broad-300.md`
- `project/tests/real-site-qa-targeted-nordstrom-scroll*.md`
- `project/tests/real-site-qa-targeted-primereact-scroll-v4.md`
- archived `Screenshots-for-Review/**/runs/latest/*/report.md`

## Result

After deduping by URL, there are 21 unique scroll-related cases.

| Class | Count | Meaning |
| --- | ---: | --- |
| `small-near-boundary-delta` | 11 | Browser lands slightly above planned Y, usually near a boundary or page end. Most are not core scroll-target failures. |
| `actual-capped-or-restored-unknown` | 4 | Actual scroll is lower than planned, but old reports do not have enough diagnostics to tell whether this is max-scroll cap, restoration, or dynamic layout. |
| `dynamic-jump-forward` | 2 | Actual scroll jumps far below planned position. Usually dynamic layout/lazy content/anchor restoration. |
| `planned-beyond-current-maxY` | 2 | Proven by enriched diagnostics: plan asks below the current scroll end. |
| `post-scroll-reset-before-capture` | 1 | Scroll command succeeds, then something resets scroll before capture. |
| `needs-enriched-rerun` | 1 | Old report is too thin to classify safely. |

## Cases

| Class | Site | URL | Signal |
| --- | --- | --- | --- |
| `planned-beyond-current-maxY` | GOV.UK Design System | `https://design-system.service.gov.uk/components/cookie-banner/` | frame 8: planned `5918`, actual `5318`, maxY `5318`, atMaxY `yes` |
| `planned-beyond-current-maxY` | PlayStation | `https://www.playstation.com/en-us/accessories/dualsense-wireless-controller/` | frame 16: planned `11054`, actual `10942`, maxY `10942`, atMaxY `yes` |
| `post-scroll-reset-before-capture` | PrimeReact Dialog | `https://primereact.org/dialog/` | frame 1: planned `634`, afterScroll `634`, final actual `197`, maxY `5861`, atMaxY `no` |
| `actual-capped-or-restored-unknown` | OpenAI Platform | `https://platform.openai.com/docs` | frame 1: planned `733`, actual `0`, maxY `1038`, atMaxY `no` |
| `actual-capped-or-restored-unknown` | Sony WH-1000XM5 | `https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b` | frame 1: planned `763`, actual `820.5` |
| `actual-capped-or-restored-unknown` | Trek bikes listing | `https://www.trekbikes.com/us/en_US/bikes/c/B100/` | frame 10: planned `5587`, actual `5297` |
| `actual-capped-or-restored-unknown` | Trek Madone PDP | `https://www.trekbikes.com/us/en_US/bikes/road-bikes/performance-road-bikes/madone/` | frame 2: planned `1215`, actual `925.5` |
| `dynamic-jump-forward` | Arc'teryx shell jackets | `https://arcteryx.com/us/en/c/mens/shell-jackets` | frame 2: planned `1458`, actual `5416.5` |
| `dynamic-jump-forward` | Cypress docs | `https://docs.cypress.io/app/get-started/why-cypress` | frame 4: planned `3052`, actual `3845` |
| `needs-enriched-rerun` | TypeScript Playground | `https://www.typescriptlang.org/play/` | frame 1: planned `665`, actual `584.5`, old diagnostics only |
| `small-near-boundary-delta` | Express docs | `https://expressjs.com/en/guide/routing.html` | frame 13: planned `9073`, actual `8881.5` |
| `small-near-boundary-delta` | Grafana docs | `https://grafana.com/docs/grafana/latest/` | frame 6: planned `3479`, actual `3446` |
| `small-near-boundary-delta` | Laravel docs | `https://laravel.com/docs/12.x` | frame 16: planned `11774`, actual `11758` |
| `small-near-boundary-delta` | Azure docs | `https://learn.microsoft.com/en-us/azure/?product=popular` | frame 3: planned `1870`, actual `1790.5` |
| `small-near-boundary-delta` | Node.js API docs | `https://nodejs.org/api/` | frame 2: planned `1443`, actual `1372` |
| `small-near-boundary-delta` | React Bootstrap modal docs | `https://react-bootstrap.netlify.app/docs/components/modal/` | frame 23: planned `17233`, actual `17171` |
| `small-near-boundary-delta` | BBC News | `https://www.bbc.com/news` | frame 9: planned `5550`, actual `5534.5` |
| `small-near-boundary-delta` | eBay camera search | `https://www.ebay.com/sch/i.html?_nkw=mirrorless+camera` | frame 27: planned `18669`, actual `18546.5` |
| `small-near-boundary-delta` | Samsung watch PDP | `https://www.samsung.com/us/watches/galaxy-watch-ultra/` | frame 42: planned `31489`, actual `31416.5` |
| `small-near-boundary-delta` | TypeScript handbook | `https://www.typescriptlang.org/docs/handbook/intro.html` | frame 3: planned `2289`, actual `2269` |
| `small-near-boundary-delta` | H&M jackets | `https://www2.hm.com/en_us/men/products/jackets-coats.html` | frame 11: planned `6928`, actual `6880.5` |

## Product interpretation

The biggest group is not a catastrophic scroll failure. It is small boundary drift: the browser is close to the requested position, often near a page boundary, dynamic content boundary, or last frame. This should not drive a broad rewrite.

The two most actionable classes are:

1. `planned-beyond-current-maxY`
   The plan is stale relative to the browser's current max scroll. This should be fixed in planning/replanning, not by pretending the frame is settled.

2. `post-scroll-reset-before-capture`
   PrimeReact proves the scroll command worked, then something reset the page before capture. This points to `beforeFrame` stages, sticky normalization, or page-side scroll anchoring/restoration.

OpenAI is still separate: it looks like a true initial stuck case where window has maxY, overflow is normal, but actual scroll stays at 0.

## Best next step without browser

No more broad offline parsing is likely to add much value. The useful next step is to turn this into a short targeted test matrix:

- maxY stale-plan: GOV.UK, PlayStation
- post-scroll reset: PrimeReact
- true stuck at top: OpenAI Platform
- dynamic jump: Arc'teryx, Cypress
- old/thin diagnostics: TypeScript Playground, Trek PDP/listing

## Recommended next code direction

1. Keep diagnostics.
   `maxY`, `atMaxY`, and `afterScroll` are high-value and cheap enough for research.

2. Do not loosen global scroll tolerance yet.
   Most small deltas are near-boundary, but a global tolerance could hide real layout bugs.

3. For `planned-beyond-current-maxY`, fix the plan.
   Re-measure or clamp planned positions against current max scroll before capture output decisions. Do not make `isCloseToPosition` treat this as settled by itself.

4. For `post-scroll-reset-before-capture`, isolate the stage.
   Add or use existing reads after each `beforeFrame` stage to know whether scroll resets after `before-scroll`, `beforeFrame`, stabilization, readiness, or `before-capture`.

5. For OpenAI, investigate scroll command mechanics separately.
   It is not an at-max case and not a small tolerance issue.
