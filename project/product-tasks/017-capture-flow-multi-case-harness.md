# Product Task: Capture Flow Multi-Case Harness

## Problem

The capture-flow test proved the basic long-page case, but it was hardcoded for one scenario. Adding sticky, scrollbar, lazy-load, or huge-page cases would require rewriting the script each time.

## User

The product and engineering team developing capture stability.

## Value

The product needs a repeatable test harness where each new edge case is a small fixture plus a case definition. This makes future regressions easier to catch and keeps test artifacts organized.

## Desired Behavior

- Keep `basic-long-page` working as the first smoke case.
- Represent capture-flow checks as named cases.
- Support cases that expect a downloaded PNG.
- Support future cases that expect a controlled capture error.
- Write a summary report for the whole run.
- Write a separate report and artifacts folder for every case.

## Non-Goals

- No new sticky-scrollbar fixture in this task.
- No huge-page fixture in this task.
- No pixel-level assertions in this task.
- No headless mode in this task.

## Success Criteria

- `capture:test` still passes for `basic-long-page`.
- The runner can add new cases without rewriting the core flow.
- Each case has its own report under `project/tests/capture-results/latest/cases/`.
- The summary report shows all cases and statuses.

## Related Spec

- `../specs/017-capture-flow-multi-case-harness.md`
