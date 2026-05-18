# 002: Permissions Model

## Product Task

- `../product-tasks/002-permissions-model.md`

## Goal

Keep permissions understandable while still allowing the extension to capture and save screenshots.

## User Value

Users should be able to trust why the extension asks for each permission.

## Current Permissions

- `activeTab`: temporary access to the current tab after user action.
- `scripting`: page probing and scroll control.
- `downloads`: saving the final screenshot.
- `notifications`: user-visible failure messages.
- `storage`: capture preferences inherited from the base project.
- `contextMenus`: right-click capture entry.

## Architecture

The MVP uses mandatory permissions for a simple first runnable version. Later versions should review which permissions can become optional without hurting the main workflow.

## Restricted Pages

The extension cannot normally capture:

- `chrome://` pages;
- extension pages;
- Chrome Web Store pages;
- some browser-controlled pages;
- pages where Chrome blocks script injection or visible-tab capture.

## Future Requirements

- Add service-worker level URL blocking before capture starts.
- Consider optional `file://` access for local pages.
- Consider optional host permissions only for advanced iframe or page-agent flows.
- Keep permission explanations in product and store-facing documentation.

## Test Coverage

- Manual restricted-page checks in `../tests/manual-checklist.md`.
- Future automated permission checks in `../tests/capture-flow.mjs`.
