# Product Task: Lazy Load Warmer V1

## Problem

Many pages render images and content only after the user scrolls near them. Without warmup, the first capture frame can be taken before below-fold content has been triggered, producing placeholders or incomplete screenshots.

## User

Users capturing long articles, product pages, media pages, docs, and modern React/Vue pages with lazy-loaded content.

## Value

The product should favor complete screenshots over maximum speed. A short bounded warmup improves capture quality without attempting infinite-scroll expansion.

## Desired Behavior

- Run warmup after page measurement and capture-position planning.
- Use already planned capture positions.
- Include the current viewport before scrolling away, so initially visible lazy media can load.
- Scroll down through sampled positions before real capture starts.
- Stay within the already measured page height.
- Do not intentionally expand infinite-scroll feeds.
- Return to the original scroll position before the first real screenshot.
- Enforce a 3.5 second hard limit.
- Continue capture even if some lazy content does not finish loading.

## Non-Goals

- No infinite-scroll expansion in this task.
- No explicit preload of `img`, `srcset`, CSS backgrounds, or network resources.
- No site-specific lazy-load exceptions.
- No parallax/AOS/skrollr normalizer work in this task.

## Success Criteria

- `lazy-load-page` passes in `capture:test`.
- The below-fold-triggered marker appears in the final PNG.
- Existing capture-flow cases still pass.
- Static validation still passes.

## Related Spec

- `../specs/021-lazy-load-warmer-v1.md`
