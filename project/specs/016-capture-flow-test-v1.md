# 016: Capture Flow Test V1

## Product Task

- `../product-tasks/016-capture-flow-test-v1.md`

## Goal

Add the first automated extension-level smoke test for the full-page capture flow.

## Requirements

- Start a local HTTP server for deterministic test fixtures.
- Launch Playwright Chromium in headed mode with the unpacked MV3 extension loaded.
- Open `project/tests/fixtures/basic-long-page.html`.
- Trigger the extension capture flow from an extension context.
- Wait for the Chrome download artifact.
- Parse the downloaded file as PNG.
- Assert that the PNG width and height are positive.
- Assert that PNG height is greater than the configured viewport height.
- Save a Markdown report and the captured PNG under `project/tests/capture-results/latest/`.

## Test Entry Point

Run:

```bash
npm run capture:test
```

The script can also be run directly:

```bash
node project/tests/capture-flow.mjs
```

## Architecture

```text
capture-flow.mjs
  -> start local fixture server
  -> copy code/ extension to a temporary test directory
  -> add test-only host_permissions to temporary manifest copy
  -> launch headed Chromium with the unpacked extension
  -> open basic-long-page fixture
  -> open extension options context
  -> set deterministic download preferences
  -> send capture-active-tab-for-test message
  -> wait for downloaded PNG artifact
  -> validate dimensions
  -> write report and artifact copy
```

## Test-Only Permission Handling

The production manifest stays least-privilege and uses `activeTab` for normal toolbar-click capture.

The automated test triggers capture from an extension page rather than a real user toolbar click. Because that does not grant `activeTab`, the test copies `code/` into a temporary directory and adds:

```json
{
  "host_permissions": ["<all_urls>"]
}
```

This is only applied to the temporary extension copy used by the test runner.

## Internal Test Trigger

The background worker accepts an internal message:

```text
capture-active-tab-for-test
```

The message is sent from an extension page in the test profile. The extension does not declare `externally_connectable`, so normal web pages cannot call this entry point.

## Artifacts

Latest run output:

```text
project/tests/capture-results/latest/report.md
project/tests/capture-results/latest/basic-long-page.png
project/tests/capture-results/latest/downloads/
project/tests/capture-results/latest/profile/
```

`capture-results/` is ignored by git.

## Current Assertion

The first case is intentionally small:

```text
basic-long-page
```

It proves that full-page capture generally works by validating:

- extension loads in Chromium;
- fixture page opens;
- capture flow completes;
- PNG is downloaded;
- PNG height is greater than viewport height.

## Known Limits

- The test does not yet simulate a physical toolbar icon click; it triggers the same capture controller through an internal extension message.
- The test does not yet compare pixels against a golden output.
- The test does not yet cover fixed/sticky duplication, scrollbars, lazy loading, iframe behavior, or canvas tiling.
