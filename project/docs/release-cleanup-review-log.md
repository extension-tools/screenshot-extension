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

## Iteration 4 Spec Review

| Stage | Artifact / scope | Owner | Review role 1 | Review role 2 | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| S7 release-cleanup iteration 4 spec, loop 1 | `project/docs/release-cleanup-iteration-4-s7.md` | Architect | Red Team | ScopeGuard | PASS with comments | Red Team requested stricter default budgets, no `undefined` diagnostic fields, and no verbose diagnostics comparison across modes. Architect accepted and updated the spec. ScopeGuard requested preferring `includeQaDiagnostics` over passing string mode when downstream only needs a boolean. Architect accepted and updated the spec. |
| S7 release-cleanup iteration 4 spec, loop 2 | `project/docs/release-cleanup-iteration-4-s7.md` | Architect | Red Team | ScopeGuard | PASS | Red Team returned PASS with no comments. Architect accepted with no changes. ScopeGuard returned PASS with no required narrowing. |

### Iteration 4 Spec Notes

Confirmed:

- One diagnostics-mode source of truth remains `CaptureDiagnostics.normalizeDiagnosticsMode()`.
- Downstream code may receive only normalized `diagnosticsMode` or `includeQaDiagnostics`.
- Downstream code should prefer `includeQaDiagnostics` when it only needs a boolean.
- No local helper may independently read `qaDiagnostics` or normalize diagnostics mode.
- The iteration may gate only QA-only verbose diagnostics packaging.
- Runtime data required for capture behavior must stay always on.
- No capture behavior, split/stitch behavior, scroll behavior, fixed/sticky behavior, PDF behavior, permissions, or `manifest.json` changes are allowed.
- `PageProbe.js` and `CaptureStepper.js` have a default budget of 0 changed lines unless read-only audit identifies a named QA-only packaging block.

## Iteration 4 Patch Review

| Stage | Artifact / scope | Owner | Review role 1 | Review role 2 | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Release-cleanup iteration 4 patch | `code/capture/CaptureController.js`, `project/tests/validate-extension.mjs` | Developer | Architect | ScopeGuard | PASS | Architect reviewed the diff and confirmed it gates only QA-only `attachImageReadinessSummary(...)` packaging. Developer accepted with no changes. ScopeGuard reviewed the diff and confirmed no capture behavior, scroll, fixed/sticky, overlay, split/stitch, PDF, permissions, or `manifest.json` changes. Developer accepted with no changes. |
| Release-cleanup iteration 4 checks | Non-browser release checks | Developer | Architect | ScopeGuard | PASS | `pnpm run check`, JavaScript syntax checks for changed JS files, `git diff --check`, and `node project/tests/targeted-risk-sites.mjs` passed. |

### Iteration 4 Patch Notes

Confirmed:

- `CaptureController` derives `includeQaDiagnostics` from the already-normalized `diagnosticsMode`.
- QA-only image readiness / sticky / repeated chrome summary packaging is built only in QA diagnostics mode.
- Production capture still measures, probes, warms, plans, captures, stitches/tiles, exports, and stores production diagnostics as before.
- No forbidden runtime files changed.
- No browser permissions changed.
- `manifest.json` unchanged.

## Iteration 4 Patch Review Visible Transcript Batch

This section mirrors the main-thread-visible orchestration batch. It is intentionally more verbose than the summary tables above so the review can be audited after context compaction.

### Orchestrator -> Developer

Make a minimal patch strictly according to the approved spec: `project/docs/release-cleanup-iteration-4-s7.md`.

Do not commit.

### Developer

Status: PASS

I reviewed the approved iteration 4 spec and the current diff.

What the code showed:

- `code/capture/CaptureController.js` builds the detailed diagnostic summary through `attachImageReadinessSummary(...)`.
- That summary is useful for QA mode, but normal user captures should not build it unless needed.
- The controller already has the single normalized diagnostics mode from `CaptureDiagnostics.normalizeDiagnosticsMode(...)`.
- The smallest patch is to derive `includeQaDiagnostics = diagnosticsMode === 'qa'` and call `attachImageReadinessSummary(...)` only when that flag is true.

Changed files:

1. `code/capture/CaptureController.js`

Added:

```js
const includeQaDiagnostics = diagnosticsMode === 'qa';
```

Wrapped both calls to:

```js
this.captureDiagnostics.attachImageReadinessSummary(diagnosticsV2, diagnostics);
```

with:

```js
if (includeQaDiagnostics) {
  this.captureDiagnostics.attachImageReadinessSummary(diagnosticsV2, diagnostics);
}
```

One call is in the successful path after `capture_stepper`; the other is in the `catch` path so the error path follows the same rule.

2. `project/tests/validate-extension.mjs`

Added static checks that:

- `includeQaDiagnostics` is derived from the already-normalized `diagnosticsMode`;
- `attachImageReadinessSummary(...)` is called only behind `if (includeQaDiagnostics)`.

Not changed:

- `manifest.json`;
- browser permissions;
- screenshot behavior;
- scroll behavior;
- fixed/sticky behavior;
- overlay/modal behavior;
- split/stitch behavior;
- PDF behavior;
- `PageProbe.js`;
- `CaptureStepper.js`.

Why the patch is minimal:

- no new mode;
- no new helper;
- no new feature flag;
- no second diagnostics normalization path;
- only the top-level capture owner and release guard were touched.

Result: the patch follows the spec and should not change screenshot output.

### Orchestrator -> Architect

Review this diff.

Artifacts:

- `code/capture/CaptureController.js`
- `project/tests/validate-extension.mjs`
- `project/docs/release-cleanup-review-log.md`
- `project/docs/release-cleanup-iteration-4-s7.md`

### Architect

Status: PASS

Git diff architecture review.

Context:

Iteration 4 must reduce unnecessary heavy diagnostics construction in normal user mode without changing screenshot behavior. The core architectural rule is that diagnostics mode must be normalized in one place, and downstream code must not independently read `qaDiagnostics` or create a second mode interpreter.

Boundary review:

- The allowed touch point `CaptureController.js` is used correctly.
- `CaptureController` already owns capture-level options and already has the normalized `diagnosticsMode`.
- Adding `includeQaDiagnostics` next to `diagnosticsMode` is architecturally appropriate.
- `validate-extension.mjs` is the right owner for release guards.
- Documentation/review-log changes do not expand runtime scope.

Forbidden-zone review:

- `manifest.json` was not changed.
- Browser permissions were not changed.
- `PageProbe.js` was not changed.
- `CaptureStepper.js` was not changed.
- `Canvas*`, `PositionPlanner`, `SplitBoundaryPlanner`, `FixedStickyNormalizer`, and `QuirksLayer` were not changed.
- No scroll/fixed/sticky/overlay/split/PDF behavior changed.

Solution review:

- `includeQaDiagnostics` is derived from the already-normalized `diagnosticsMode`.
- This is not a second normalization path.
- This is not a new feature flag.
- This is a local boolean guard for a downstream consumer.
- `attachImageReadinessSummary(...)` is an appropriate QA-only packaging candidate because it is a diagnostic summary over already-existing runtime diagnostics.
- Runtime-required data stays enabled: capture plan, scroll target, fixed/sticky decisions, split boundaries, and output metadata continue to be built as before.

Comments:

- Gating both the success path and the error path is correct. Otherwise production-mode failures could still build the QA-only summary.
- The static guard in `validate-extension.mjs` is narrow enough. It does not simulate full capture and does not expand the QA framework.
- No additional architectural changes are required.

Risks:

- Screenshot behavior risk is low because the patch only touches diagnostic summary packaging.
- Risk of losing useful production data is low because the production whitelist and required status/output fields remain.
- QA regression risk is low because the call remains enabled in `qa` mode.

Verdict: PASS

No change needed. The current patch already chooses the smallest safe path.

### Orchestrator -> Developer

Look at the review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer

Status: PASS

I agree with the Architect review.

No changes are needed.

Reasons:

- The Architect confirmed that the patch stays inside the allowed boundary.
- The Architect confirmed that capture behavior does not change.
- The Architect confirmed that `includeQaDiagnostics` does not create a second diagnostics-mode path.
- The Architect did not provide blocking or minor comments that require a patch.

Result: leaving the code unchanged.

### Orchestrator -> ScopeGuard

Review this diff.

Artifacts:

- `code/capture/CaptureController.js`
- `project/tests/validate-extension.mjs`
- `project/docs/release-cleanup-review-log.md`
- `project/docs/release-cleanup-iteration-4-s7.md`

### ScopeGuard

Verdict: PASS

Scope assessment:
The patch stays within release-cleanup diagnostics. It changes only the top-level capture controller, release validation, and documentation artifacts. There are no changes to `manifest.json`, permissions, scroll target selection, fixed/sticky normalization, overlay policy, split/stitch, PDF, product behavior, or runner behavior. Scope did not expand.

Architecture assessment:
The solution is small and mechanical. `includeQaDiagnostics` is derived from the already-normalized `diagnosticsMode`, so there is no second diagnostics-mode interpreter. `attachImageReadinessSummary(...)` now builds only in QA mode. This matches the goal: remove QA-only diagnostic packaging from the production path without changing runtime capture data.

Positive note: the patch does not touch `PageProbe.js` or `CaptureStepper.js`, where the risk of accidental capture behavior changes would be higher.

Extra-scope check:

- No new helper.
- No new classifier.
- No new feature flag.
- No site-specific logic.
- No second DOM scan.
- No screenshot output change.
- No storage whitelist change.
- No telemetry/network/cookies/form scraping.
- No new browser permissions.

Competitor pattern observed:
Not inspected.

Better alternative, if any:
No change needed. The current patch is already smaller than adding a diagnostics helper or mode wrapper.

Required narrowing:
None.

### Orchestrator -> Developer

Look at the review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer

Status: PASS

I agree with the ScopeGuard review.

No changes are needed.

Reasons:

- ScopeGuard confirmed that the patch does not expand the task.
- ScopeGuard confirmed that there is no new helper/classifier/feature flag/site-specific logic.
- ScopeGuard confirmed that screenshot output and capture behavior do not change.
- No required narrowing was requested.

Result: leaving the code unchanged.

### Orchestrator -> Developer

Run the tests required by the approved spec. Do not use browser. Do not commit.

### Developer

Status: PASS

Ran the required non-browser checks.

Commands:

```bash
pnpm run check
node --check code/capture/CaptureController.js
node --check project/tests/validate-extension.mjs
git diff --check
node project/tests/targeted-risk-sites.mjs
```

Results:

```text
extension check ok
sticky-cleanup-smoke: ok
Targeted risk sites: 21
Minimum required for beta gate: 15
```

Confirmed:

- changed JavaScript syntax is valid;
- release validation passes;
- sticky cleanup smoke passes;
- diff whitespace check passes;
- targeted risk list is valid: 21 sites, minimum required 15;
- browser was not launched;
- no commit was made.

### Batch Status

Status: PASS

The patch review loop is valid in main-thread-visible mode because:

- the Developer patch response is recorded;
- the Architect review is recorded;
- the Developer response to Architect is recorded;
- the ScopeGuard review is recorded;
- the Developer response to ScopeGuard is recorded;
- the test result is recorded.
