# Release Cleanup Review Log

Created: 2026-05-27

Purpose: make the release-cleanup orchestration auditable. This log records which roles reviewed each stage and whether the stage satisfied the orchestrator requirement for at least two review roles before moving forward.

Evidence scope:

- This log is retrospective for the current release-cleanup work.
- Evidence comes from the active thread, the current working-tree diff, `project/docs/release-cleanup-s7.md`, and completed local checks.
- Future orchestrated work should update this file, or a task-specific review log, during the workflow instead of reconstructing it later.

## Orchestrator Requirement

Source of truth: `project/docs/agents-and-skills/orchestrator-agent.md`.

Required roles:

- Spec phase: Architect, Red Team, ScopeGuard.
- Patch phase: Developer, Architect, ScopeGuard.
- Developer must not commit without explicit user approval.
- After patch iteration 2, stop and report instead of starting a third iteration.

## Review Matrix

| Stage | Artifact / scope | Owner | Review role 1 | Review role 2 | Additional role | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S7 release-cleanup spec | `project/docs/release-cleanup-s7.md` | Architect | Red Team | ScopeGuard | Product/user review | PASS | Thread review and final S7 spec |
| Patch iteration 1 | Production diagnostics whitelist and `diagnosticsMode` plumbing | Developer | Architect | ScopeGuard | User review | PASS | Current diff in `CaptureDiagnostics.js`, `CaptureController.js`, `validate-extension.mjs` |
| Patch iteration 2 | QA runners explicitly use `diagnosticsMode: "qa"` | Developer | Architect | ScopeGuard | User review | PASS | Current diff in `capture-flow.mjs`, `real-site-runner.mjs`, validation checks |
| Final local checks | Syntax, validation, diff hygiene, forbidden-file guard | Developer | Architect | ScopeGuard | n/a | PASS | Completed local checks reported in thread |

## Detailed Stage Notes

### S7 release-cleanup spec

Result: PASS.

Confirmed:

- Release cleanup is diagnostic-shaping only.
- No capture behavior changes are allowed.
- `manifest.json` must not change.
- No new browser permissions.
- Diagnostics remain local-only.
- No telemetry, network upload, cookies, storage scraping, or form-value collection.
- Heavy diagnostics stay behind `diagnosticsMode: "qa"`.
- Production diagnostics use an explicit whitelist.

Deferred:

- Phase 2 optimization for expensive diagnostics construction in `PageProbe.js` or `CaptureStepper.js`, only after measurement proves a specific cost.

### Patch iteration 1

Result: PASS.

Confirmed:

- `diagnosticsMode` defaults to `"production"`.
- `qaDiagnostics: true` remains a legacy alias for QA mode.
- Production diagnostics are serialized through an explicit whitelist.
- QA mode preserves verbose diagnostics for internal runners.
- Coarse platform OS is included as `platformOs`.
- No screenshot output behavior is intended to change.

Review conclusion:

- Scope stayed inside allowed touch points.
- No new permission or manifest change.
- No telemetry or network path.

### Patch iteration 2

Result: PASS.

Confirmed:

- Fixture runner and real-site runner explicitly request QA diagnostics.
- Internal QA keeps the verbose diagnostics needed for regression work.
- Normal user capture remains production mode by default.

Review conclusion:

- Small follow-up patch.
- No runtime capture-policy change.
- No additional feature flag.

### Final local checks

Result: PASS.

Checks completed:

- JavaScript syntax checks for changed files.
- `project/tests/validate-extension.mjs`.
- Diff hygiene check.
- Forbidden release-cleanup touch points stayed unchanged.
- No commit was made.

## Current Known Gap

The review evidence for this iteration was originally held in the thread, not in a persistent review file. This log closes that gap for the current release-cleanup work, but future orchestrated changes should create or update the review log during each stage.

## Next Workflow Rule

For the next orchestrated patch:

1. Create or update a task-specific review log before implementation.
2. Add a row after each spec review loop.
3. Add a row after each patch review loop.
4. Add a row after final checks.
5. Do not mark a stage PASS unless at least two review roles are recorded.
