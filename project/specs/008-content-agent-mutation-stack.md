# 008: Content Agent Mutation Stack

## Product Task

- `../product-tasks/008-content-agent-mutation-stack.md`

## Goal

Add a safe page-side infrastructure layer for temporary DOM/CSS mutations during capture.

## Requirements

- Add page-side files under `code/content/`.
- Add a service-worker client under `code/capture/`.
- Inject the content agent before the capture stepper runs.
- Call page cleanup from `CleanupManager`.
- Keep the current user-facing capture behavior unchanged.
- Avoid adding a build step.

## Architecture

```text
CaptureController
  -> ContentAgentClient
      -> inject code/content/DomMutationStack.js
      -> inject code/content/ContentAgent.js
      -> prepareCapture()
  -> CaptureStepper
  -> CleanupManager
      -> cleanupCapture()
      -> restore original scroll
```

## Module Responsibilities

- `code/content/DomMutationStack.js`: page-side stack of restore callbacks for temporary DOM/CSS mutations.
- `code/content/ContentAgent.js`: page-side capture preparation and cleanup owner.
- `code/capture/ContentAgentClient.js`: service-worker bridge that injects the page-side agent and calls its lifecycle methods.
- `code/capture/CleanupManager.js`: guarantees content cleanup and scroll restoration in the capture `finally` path.

## Current Behavior

This task intentionally does not change page visuals. `prepareCapture()` initializes the mutation stack and `cleanupCapture()` restores it, but no normalizer has added mutations yet.

## Future Integration

The next fixed/sticky task should use this layer:

- detect fixed/sticky elements inside `ContentAgent`;
- push style restorations into `DomMutationStack`;
- hide or adjust elements while capture frames are taken;
- restore everything from `cleanupCapture()`.

## Test Coverage

- Static check: `project/tests/validate-extension.mjs`.
- Visual regression: `project/tests/visual-regression.mjs`.
- Manual capture check: `project/tests/manual-checklist.md`.

