# Product Task: Internal Scroll Container Capture V1

## Problem

Modern app-shell pages often do not scroll the browser window. Their primary content lives inside one large internal scroll container. Window-only capture misses content below the visible container viewport.

## User

Users capturing ChatGPT, Claude, Gmail-like, Notion-like, Linear-like, and other web apps with a central scrollable content pane.

## Value

The beta should capture the main content pane on high-confidence app-shell pages instead of producing a single visible viewport or incomplete screenshot.

## Desired Behavior

- Keep `window` capture as the default.
- Select one internal scroll container only when confidence is high.
- Use conservative heuristics and fall back to `window` when uncertain.
- Scroll the selected container through planned positions.
- Crop the selected container area from each viewport capture.
- Stitch the container content into the final PNG.
- Restore the container scroll and window scroll after capture.

## Research Guardrails

- Detect when a supposed full-page/site capture would only produce the first visible viewport.
- Treat first-viewport-only output as a risk or failure when the page or selected target has measurable content below the fold.
- Measure this with planned capture height versus viewport height during probe runs, and with final PNG height versus viewport height during real capture runs.
- Record the reason when the policy intentionally preserves only the current viewport state because no high-confidence scroll target exists.

## Non-Goals

- No multiple-container capture.
- No user-select-container mode.
- No iframe internal scrolling.
- No virtualized-list reconstruction.
- No perfect support for every custom scroll implementation.

## Success Criteria

- `internal-scroll-container-page` passes in `capture:test`.
- The output PNG includes the bottom marker inside the internal scroll container.
- Research/probe output flags cases where the policy would capture only the first viewport while the site has measurable below-fold content.
- Normal window capture cases continue to pass.
- Static validation still passes.

## Related Spec

- `../specs/022-internal-scroll-container-capture-v1.md`
