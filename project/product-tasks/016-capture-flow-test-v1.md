# Product Task: Capture Flow Test V1

## Problem

Manual checks show whether the extension works on real pages, but they do not give a repeatable signal after each code change.

## User

The product and engineering team building the extension.

## Value

The product needs a fast smoke test that proves the core promise still works: load the Chrome extension, open a long page, start capture, download a PNG, and verify that the result is taller than the viewport.

## Desired Behavior

- Launch a headed Chromium session with the unpacked extension.
- Open a deterministic local `basic-long-page` fixture.
- Trigger the extension capture flow.
- Wait for the downloaded PNG.
- Verify that the PNG exists, is readable, and has height greater than the viewport.
- Write a per-run report and copy the resulting PNG into the test artifacts folder.

## Non-Goals

- No full visual diff of the extension output in this task.
- No multi-site regression suite in this task.
- No iframe, sticky, scrollbar, or lazy-load assertions in this task.
- No Chrome Web Store packaging flow.

## Success Criteria

- `capture:test` runs the basic long-page smoke test.
- The test fails if no PNG is downloaded.
- The test fails if the PNG height is not greater than the viewport.
- Artifacts are written to `project/tests/capture-results/latest/`.

## Related Spec

- `../specs/016-capture-flow-test-v1.md`
