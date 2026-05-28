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
| Release-cleanup iteration 4 closure | `77f5143 chore: gate QA diagnostics summaries` | Architect | Developer | ScopeGuard | PASS | Iteration 4 is closed as committed. The commit contains only `CaptureController.js`, `validate-extension.mjs`, `release-cleanup-iteration-4-s7.md`, and this review log. PNG icons, `project/docs/agents-and-skills/`, and the general `release-cleanup-s7.md` were intentionally left out of the commit. |

### Iteration 4 Patch Notes

Confirmed:

- `CaptureController` derives `includeQaDiagnostics` from the already-normalized `diagnosticsMode`.
- QA-only image readiness / sticky / repeated chrome summary packaging is built only in QA diagnostics mode.
- Production capture still measures, probes, warms, plans, captures, stitches/tiles, exports, and stores production diagnostics as before.
- No forbidden runtime files changed.
- No browser permissions changed.
- `manifest.json` unchanged.

### Iteration 4 Closure

Status: closed.

Commit: `77f5143 chore: gate QA diagnostics summaries`.

Closed scope:

- QA-only image readiness / sticky / repeated chrome summary packaging is gated by QA diagnostics mode.
- Production capture behavior is unchanged.
- Release validation protects the guard.
- Main-thread-visible patch review was recorded.
- Non-browser checks passed.

Out of scope and intentionally not closed by this iteration:

- icon PNG changes;
- `project/docs/agents-and-skills/`;
- general release-cleanup spec staging / commit decision;
- further release-cleanup audits for other diagnostics construction costs.

## Release Cleanup Checkpoint After Iteration 4

Checkpoint status: iteration 4 is closed and committed.

Last closed runtime commit:

- `77f5143 chore: gate QA diagnostics summaries`

Closed release-cleanup layers:

- Production diagnostics mode and production diagnostics whitelist are established.
- Internal QA runners explicitly request QA diagnostics mode.
- Diagnostics storage and artifact boundaries are hardened.
- QA-only image readiness, sticky, and repeated chrome summary packaging is gated by QA diagnostics mode.

Current working-tree notes:

- No uncommitted release-cleanup runtime JavaScript changes are expected after iteration 4 closure.
- Icon PNG changes are intentionally outside release-cleanup.
- `project/docs/agents-and-skills/` is intentionally outside release-cleanup.
- `project/docs/release-cleanup-s7.md` is a general spec artifact and needs a separate staging / commit decision.
- This review log contains checkpoint documentation changes after the iteration 4 commit.

Release constraints still confirmed:

- `manifest.json` unchanged.
- No new browser permissions.
- No telemetry, upload, cookie scraping, storage scraping, or form-value collection.
- Diagnostics remain local-only.

Recommended next release-cleanup step:

- Start with a read-only audit for remaining QA-only diagnostics construction costs.
- Do not write code until the audit names a concrete QA-only packaging block.
- Keep `PageProbe.js` and `CaptureStepper.js` at default zero-line budget unless the audit finds a named candidate.

## Release Cleanup Read-Only Audit After Iteration 4

Audit date: 2026-05-27.

Audit mode: read-only. No runtime files were changed by this audit.

Audited files:

- `code/capture/CaptureController.js`
- `code/capture/CaptureDiagnostics.js`
- `code/capture/CaptureStepper.js`
- `code/capture/ContentAgentClient.js`
- `code/content/FixedStickyNormalizer.js`
- `code/capture/PageProbe.js`
- `project/tests/validate-extension.mjs`

Findings:

1. `CaptureController` already gates `attachImageReadinessSummary(...)` behind QA diagnostics mode.
2. Production diagnostics storage already uses the explicit whitelist in `CaptureDiagnostics.toProductionDiagnostics(...)`.
3. The strongest next candidate is `CaptureStepper.analyzeRepeatedChrome(frames)`.
   - It is built after capture frames are already collected.
   - It is QA/report packaging, not a capture decision.
   - It is not serialized into production diagnostics by the production whitelist.
   - It can be gated with a boolean without changing scroll, capture, fixed/sticky, overlay, split/stitch, or export behavior.
4. Deferred candidates:
   - `FixedStickyNormalizer.collectChromeDiagnostics(...)` and `ContentAgentClient` chrome candidate aggregation are likely heavier, but they require threading a QA flag through content-agent calls and should be handled in a separate spec.
   - `PageProbe` diagnostics are not a current patch target because capture plan and avoid ranges feed runtime decisions.

Recommended next S7:

- Gate repeated chrome summary construction at the `CaptureStepper` level.
- Pass `includeQaDiagnostics` from `CaptureController` into `CaptureStepper`.
- Return `repeatedChrome: null` in production mode.
- Keep `summarizeTiming(...)` unchanged in this iteration.

Allowed touch points for the next patch:

- `code/capture/CaptureController.js`: pass `includeQaDiagnostics` into `new CaptureStepper(...)`.
- `code/capture/CaptureStepper.js`: accept `includeQaDiagnostics = false` and guard only `analyzeRepeatedChrome(frames)`.
- `project/tests/validate-extension.mjs`: add static release guard for the new gate.
- `project/docs/release-cleanup-review-log.md`: record the patch review and checks.

Forbidden touch points for the next patch:

- `code/content/FixedStickyNormalizer.js`
- `code/capture/ContentAgentClient.js`
- `code/capture/PageProbe.js`
- `manifest.json`
- scroll target selection
- fixed/sticky normalization behavior
- overlay policy
- split/stitch/tiling behavior
- PDF/export behavior

Expected diff budget for the next patch:

- `CaptureController.js`: 1-5 lines.
- `CaptureStepper.js`: 5-15 lines.
- `validate-extension.mjs`: 10-40 lines.
- this review log: 10-30 lines.

Recommended non-browser checks for the next patch:

- `pnpm run check`
- `node --check code/capture/CaptureController.js`
- `node --check code/capture/CaptureStepper.js`
- `node --check project/tests/validate-extension.mjs`
- `git diff --check`
- `node project/tests/targeted-risk-sites.mjs`

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

## Iteration 5 Spec Review Visible Transcript Batch

This section mirrors the main-thread-visible orchestration batch for `project/docs/release-cleanup-iteration-5-s7.md`.

### Orchestrator -> Red Team

Review this spec.

Artifact:

- `project/docs/release-cleanup-iteration-5-s7.md`

### Red Team

Status: PASS with comments.

Full review:

The spec is narrow and matches the read-only audit result. It identifies one concrete QA-only packaging block, `CaptureStepper.analyzeRepeatedChrome(frames)`, and avoids using this small release-cleanup task as permission to touch broader capture behavior.

What looks correct:

- The spec gates one named post-capture summary, not runtime capture data.
- It reuses the existing normalized `includeQaDiagnostics` boolean instead of creating a second diagnostics-mode interpreter.
- It does not propose changes to `PageProbe`, `FixedStickyNormalizer`, `ContentAgentClient`, scroll target selection, fixed/sticky normalization, overlay policy, split/stitch, tiling, export, or storage whitelist.
- It keeps QA mode behavior intact.
- It makes browser testing unnecessary unless a behavior difference appears.
- The hard-stop rules are appropriately strict.

Non-blocking comments:

1. The static validation should verify the call site, not only the presence of strings. A simple source guard is enough: `analyzeRepeatedChrome(frames)` should appear only inside the `this.includeQaDiagnostics ? ... : null` return branch or an equivalent explicit `if`.
2. The spec should not ask the developer to compare production and QA visual output unless an existing non-browser test already does that. The current test list is fine because it focuses on release validation and syntax.
3. The spec correctly leaves `summarizeTiming(...)` alone. That is important because timing may still be useful and is not the named audit target.

Blocking issues:

- None.

Verdict:

PASS with comments. No spec change is required unless the Architect wants to make the static-validation wording more explicit.

### Orchestrator -> Architect

Look at the Red Team review above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect

Status: PASS, no spec change.

I agree with the Red Team review.

I am not changing the spec because the current S7 already includes the needed static-validation intent:

```text
CaptureStepper calls analyzeRepeatedChrome(frames) only behind this.includeQaDiagnostics.
```

The Red Team suggestion is useful for the developer implementing `validate-extension.mjs`, but it does not require rewriting the spec. The spec already forbids broad behavior comparison and already leaves `summarizeTiming(...)` untouched.

Result:

- No changes to `project/docs/release-cleanup-iteration-5-s7.md`.
- The developer should implement the static guard narrowly when writing the patch.

### Orchestrator -> ScopeGuard

Review this spec.

Artifact:

- `project/docs/release-cleanup-iteration-5-s7.md`

### ScopeGuard

Verdict: PASS

Scope assessment:

The spec is tightly scoped to one QA-only packaging block: `CaptureStepper.analyzeRepeatedChrome(frames)`. It does not expand into page probing, content-agent aggregation, fixed/sticky normalization, scroll selection, overlay policy, split/stitch, PDF/export, save/download, or product behavior. The allowed touch points are minimal and justified.

Architecture assessment:

The proposed change is small and mechanical. Passing `includeQaDiagnostics` from `CaptureController` to `CaptureStepper` keeps one diagnostics-mode source of truth and avoids a second mode helper. Returning `repeatedChrome: null` in production is simpler than adding a new diagnostics layer or serializer branch. Keeping `summarizeTiming(...)` unchanged is the right narrowing.

Competitor pattern observed:

Not inspected.

Better alternative, if any:

No better alternative for this iteration. The tempting broader optimization would be to gate `FixedStickyNormalizer.collectChromeDiagnostics(...)`, but that requires threading a flag through content-agent calls and should remain a separate task, as the spec says.

Required narrowing:

None.

### Orchestrator -> Architect

Look at the review above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect

Status: PASS, no spec change.

I agree with ScopeGuard.

No changes are needed because the spec already:

- limits the patch to one QA-only packaging block;
- forbids touching `FixedStickyNormalizer`, `ContentAgentClient`, and `PageProbe`;
- avoids new helpers and feature flags;
- preserves screenshot behavior;
- keeps the next heavier candidate as a separate future task.

Result:

- The iteration 5 S7 spec is approved for a developer patch.
- The next developer step is to implement only the `includeQaDiagnostics` guard around `CaptureStepper.analyzeRepeatedChrome(frames)`, then run the listed non-browser checks.

### Batch Status

Status: PASS.

The spec review loop is valid in main-thread-visible mode because:

- the Red Team request is recorded;
- the full Red Team review is recorded;
- the Architect response to Red Team is recorded;
- the ScopeGuard request is recorded;
- the full ScopeGuard review is recorded;
- the Architect response to ScopeGuard is recorded.

## Release Cleanup Iteration 5 Patch Review Loop

### Orchestrator -> Developer

Implement this approved spec.

Artifact:

- `project/docs/release-cleanup-iteration-5-s7.md`

Do not commit. Keep the patch narrow.

### Developer

Status: PASS.

I implemented the approved iteration 5 patch narrowly.

Changed files:

- `code/capture/CaptureController.js`
- `code/capture/CaptureStepper.js`
- `project/tests/validate-extension.mjs`

What changed:

- `CaptureController` now passes the already-normalized `includeQaDiagnostics` boolean into `CaptureStepper`.
- `CaptureStepper` constructor now accepts `includeQaDiagnostics = false` and stores it as a strict boolean.
- `CaptureStepper.run()` now returns:
  - `repeatedChrome: this.analyzeRepeatedChrome(frames)` only when QA diagnostics are enabled;
  - `repeatedChrome: null` in production diagnostics mode.
- `validate-extension.mjs` now has static checks that this production/QA gate stays in place.

What did not change:

- no scroll logic;
- no fixed/sticky logic;
- no overlay logic;
- no split/stitch/tiling logic;
- no capture behavior;
- no manifest or permission changes;
- no browser run.

### Orchestrator -> Architect

Review this diff.

Artifacts:

- `code/capture/CaptureController.js`
- `code/capture/CaptureStepper.js`
- `project/tests/validate-extension.mjs`

### Architect

Status: PASS.

Diff review:

- The change matches the approved S7 scope.
- `CaptureController` remains the single owner of normalized diagnostics mode.
- `CaptureStepper` receives only a boolean; it does not re-normalize diagnostics mode and does not create a parallel policy path.
- The expensive repeated chrome summary is no longer built in production mode.
- Returning `null` keeps the diagnostics shape explicit without inventing a second production object.
- Screenshot behavior is unchanged because `frames`, `timing`, scrolling, drawing, stitching, and capture policy are untouched.
- The static checks in `validate-extension.mjs` are acceptable and remain release-guard style checks, not product runtime logic.

Non-blocking notes:

- The string-based validation is intentionally simple. It is enough for this release cleanup guard and does not need a parser.
- A future iteration may gate deeper content-agent diagnostics, but that is correctly out of scope here.

Verdict: PASS.

### Orchestrator -> Developer

Look at the review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer

Status: PASS, no code change.

I agree with the Architect review.

No patch changes are needed:

- the patch already follows the approved touch points;
- the note about future content-agent diagnostics belongs to a later iteration;
- the current string-based validation is deliberately small and enough for this guard.

### Orchestrator -> ScopeGuard

Review this diff.

Artifacts:

- `code/capture/CaptureController.js`
- `code/capture/CaptureStepper.js`
- `project/tests/validate-extension.mjs`

### ScopeGuard

Verdict: PASS

Scope assessment:

The patch stays inside the requested iteration 5 scope. It only gates `CaptureStepper.analyzeRepeatedChrome(frames)` behind the existing QA diagnostics boolean and adds static validation. It does not touch capture behavior, scroll target selection, fixed/sticky normalization, overlay handling, image readiness, split boundaries, canvas tiling, PDF/export, storage, manifest, or permissions.

Architecture assessment:

The architecture is still small and mechanical. `CaptureController` owns diagnostics-mode derivation, and `CaptureStepper` receives a boolean instead of creating a new mode system. The production path now avoids building the repeated chrome diagnostics object. The fallback value `null` is explicit and cheap. No new helper, classifier, policy branch, or diagnostics engine was introduced.

Competitor pattern observed:

Not inspected.

Better alternative, if any:

No better alternative for this specific iteration. A broader cleanup could gate more QA diagnostics in content-agent paths, but that would be a separate iteration and should not be mixed into this patch.

Required narrowing:

None.

### Orchestrator -> Developer

Look at the review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer

Status: PASS, no code change.

I agree with ScopeGuard.

No changes are needed:

- the patch remains narrow;
- no extra abstraction was added;
- no site-specific or semantic logic was added;
- no browser/capture behavior was touched.

### Orchestrator -> Developer

Run the required non-browser checks for this patch.

### Developer

Status: PASS.

Checks run:

- `node --check code/capture/CaptureController.js`
- `node --check code/capture/CaptureStepper.js`
- `node --check project/tests/validate-extension.mjs`
- `git diff --check`
- `pnpm run check`
- `node project/tests/targeted-risk-sites.mjs`

Results:

- JavaScript syntax checks passed.
- Diff whitespace check passed.
- `pnpm run check` passed:
  - `extension check ok`
  - `sticky-cleanup-smoke: ok`
- Targeted risk list check passed:
  - `Targeted risk sites: 21`
  - `Minimum required for beta gate: 15`

No browser run was needed or performed.

### Batch Status

Status: PASS.

The patch review loop is valid in main-thread-visible mode because:

- the Developer implementation response is recorded;
- the Architect review request is recorded;
- the full Architect review is recorded;
- the Developer response to Architect is recorded;
- the ScopeGuard review request is recorded;
- the full ScopeGuard review is recorded;
- the Developer response to ScopeGuard is recorded;
- the required non-browser checks and results are recorded.

## Release Cleanup Iteration 6 Spec Review Loop

### Orchestrator -> Red Team

Review this spec.

Artifact:

- `project/docs/release-cleanup-iteration-6-s7.md`

### Red Team

Status: BLOCKED until one clarification is added.

Full review:

1. The spec originally blurred repository release-support files and the actual Chrome Web Store package candidate. Documentation and validation tooling may live in the repository, but they must not be treated as extension package roots.
2. `.gitignore` checks are useful, but they are not enough to prove package readiness. If no package file-list command exists, the spec must explicitly record that limitation and keep actual package file-list audit as a required follow-up before release.
3. The spec correctly forbids runtime capture changes, manifest changes, permission changes, browser automation, network upload, signing, and deletion of local user artifacts.
4. The scope is otherwise narrow and appropriate for release cleanup.

Required change:

- Split the spec into two audit surfaces:
  - Chrome extension package candidate: `code/**`;
  - repository release-support files: docs/tests/package metadata that may be committed but must not enter the Chrome Web Store ZIP.
- Add a stop condition: do not claim final package readiness if the actual package file list cannot be inspected.

### Orchestrator -> Architect

Look at the review above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect

Status: PASS after spec update.

I agree with Red Team and updated `project/docs/release-cleanup-iteration-6-s7.md`.

Changes made:

- Replaced "release package candidate roots" with "audit surfaces".
- Clarified that only `code/**` may be treated as the Chrome Web Store package candidate.
- Clarified that docs/tests/package metadata are repository release-support files, not extension package contents.
- Clarified that static `.gitignore` checks guard repository hygiene and staging mistakes, but are not a substitute for checking the actual package file list.
- Added a limitation: if no package file-list command exists, record that limitation and keep actual package file-list audit as a required follow-up before release.
- Added stop conditions preventing final package readiness claims without inspectable package contents.

### Orchestrator -> ScopeGuard

Review this spec.

Artifact:

- `project/docs/release-cleanup-iteration-6-s7.md`

### ScopeGuard

Verdict: PASS

Scope assessment:

The spec is now narrow and release-package focused. It does not expand into capture runtime, scroll logic, fixed/sticky normalization, overlay policy, split/stitch, PDF/export, save/download, manifest, or permissions. It allows only `.gitignore`, validation, optional package script wiring, QA runbook notes, and review log updates.

Architecture assessment:

The updated "audit surfaces" split is the right architectural boundary. It prevents the developer from confusing repository documentation/testing files with Chrome Web Store package contents. The package-list audit remains conditional on an existing packaging command, so the spec does not accidentally create a new packaging engine. The stop condition for missing package file-list inspection is important and should remain.

Competitor pattern observed:

Not inspected.

Better alternative, if any:

No better alternative for this iteration. Creating a package builder would be broader than the requested release cleanup audit and should remain out of scope.

Required narrowing:

None.

### Orchestrator -> Architect

Look at the review above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect

Status: PASS, no further spec change.

I agree with ScopeGuard. No additional changes are needed.

The spec now:

- separates repository validation from actual extension package contents;
- avoids creating a package engine;
- keeps runtime capture untouched;
- preserves the Chrome Web Store readiness constraints;
- explicitly refuses final package-readiness claims without package file-list inspection.

### Batch Status

Status: PASS.

The iteration 6 spec review loop is valid in main-thread-visible mode because:

- the Red Team request is recorded;
- the full Red Team review is recorded;
- the Architect response and spec update are recorded;
- the ScopeGuard request is recorded;
- the full ScopeGuard review is recorded;
- the Architect final response is recorded.

## Release Cleanup Iteration 6 Patch Loop

### Orchestrator -> Developer

Implement the approved spec.

Artifact:

- `project/docs/release-cleanup-iteration-6-s7.md`

### Developer

Status: PATCH PREPARED.

Implementation summary:

- Refined `.gitignore` so local QA/generated/research/package/secrets-like artifacts stay out of Git and release package staging.
- Added static release package hygiene checks to `project/tests/validate-extension.mjs`.
- Added manifest-referenced file existence checks for the extension package candidate.
- Added checks that required extension runtime files are not ignored.
- Added release package audit instructions to `project/tests/qa-runbook.md`.

Scope statement:

- No runtime capture files were changed.
- `code/manifest.json` was not changed.
- Browser permissions were not changed.
- Screenshot behavior was not changed.
- No package builder, signer, uploader, or Chrome Web Store integration was added.

### Orchestrator -> Architect

Review this diff.

Artifacts:

- `.gitignore`
- `project/tests/validate-extension.mjs`
- `project/tests/qa-runbook.md`
- `project/docs/release-cleanup-review-log.md`
- `project/docs/release-cleanup-iteration-6-s7.md`

### Architect

Status: PASS.

Full review:

1. The patch matches the approved iteration 6 scope: release package hygiene, local validation, and QA runbook documentation.
2. The diff does not change screenshot capture behavior. No capture runtime modules were modified in this iteration.
3. `code/manifest.json` and browser permissions were not changed.
4. The validation added to `project/tests/validate-extension.mjs` is static and local-only. It checks repository/package hygiene and manifest-referenced files; it does not open pages, capture screenshots, upload data, or inspect user content.
5. The `.gitignore` changes correctly keep generated QA artifacts, saved HTML dumps, golden baseline images, local archives, package artifacts, private keys, environment files, and cookies-like files out of Git.
6. The QA runbook correctly distinguishes `code/**` as the Chrome Web Store package candidate from repository release-support files.
7. The limitation is explicit: without an actual package file-list command, the project must not claim final package readiness.

Minor comments:

- The new validation helpers are acceptable here because they are test tooling, not product runtime.
- No package builder should be added in this iteration.

Final status: PASS.

### Orchestrator -> Developer

Look at the review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer

Status: PASS, no code changes needed.

I agree with the Architect review. No patch changes are needed:

- the implementation stays inside release cleanup tooling and documentation;
- runtime capture behavior is untouched;
- the package file-list limitation is already documented;
- adding a package builder would exceed the iteration scope.

### Orchestrator -> ScopeGuard

Review this diff.

Artifacts:

- `.gitignore`
- `project/tests/validate-extension.mjs`
- `project/tests/qa-runbook.md`
- `project/docs/release-cleanup-review-log.md`
- `project/docs/release-cleanup-iteration-6-s7.md`

### ScopeGuard

Verdict: PASS

Scope assessment:

The patch stays within release-cleanup iteration 6. It touches repository hygiene, validation tooling, the QA runbook, and the review log. It does not touch screenshot capture behavior, scroll/fixed/sticky/overlay/split/PDF/save logic, `code/manifest.json`, or permissions.

Architecture assessment:

The architecture remains simple. The validation is a local static gate, not a new packaging engine. The helper functions in `validate-extension.mjs` are small and scoped to file existence and `.gitignore` checks. The patch correctly separates the Chrome Web Store package candidate (`code/**`) from repository release-support files.

Competitor pattern observed:

Not inspected.

Better alternative, if any:

No better alternative for this iteration. A real package file-list audit is still needed before final publishing, but adding a package builder or publishing flow now would be out of scope.

Required narrowing:

None.

### Orchestrator -> Developer

Look at the review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer

Status: PASS, no code changes needed.

I agree with ScopeGuard. No further narrowing is needed:

- no new runtime path was added;
- no browser permission was added;
- no package builder was added;
- no capture code was changed;
- final package-readiness remains explicitly blocked until the actual package file list can be inspected.

### Tests

Status: BLOCKED by unrelated dirty manifest/icon state.

Commands run:

```bash
node --check project/tests/validate-extension.mjs
git diff --check
pnpm run check
```

Results:

- `node --check project/tests/validate-extension.mjs`: passed.
- `git diff --check`: passed.
- `pnpm run check`: blocked.
  - `validate-extension.mjs` failed because `code/manifest.json` is dirty.
  - The dirty manifest change is outside this iteration patch and is tied to the local icon set state.
  - The release guard is working as intended: it refuses to pass while `code/manifest.json` is changed.

Browser status:

- Browser was not run for this iteration.

### Patch Loop Status

Status: PATCH REVIEW PASS, TEST GATE BLOCKED BY UNRELATED MANIFEST DIFF.

The iteration 6 patch review loop is valid in main-thread-visible mode because:

- the Developer patch response is recorded;
- the Architect request is recorded;
- the full Architect review is recorded;
- the Developer response to Architect is recorded;
- the ScopeGuard request is recorded;
- the full ScopeGuard review is recorded;
- the Developer response to ScopeGuard is recorded;
- the required non-browser checks and current blocker are recorded.

### Iteration 6 Scoped Closure Boundary

Status: READY FOR SCOPED STAGING, FULL CHECK DEFERRED BY EXTERNAL ICON/MANIFEST CLEANUP.

Iteration 6 release-cleanup files:

- `.gitignore`
- `project/tests/validate-extension.mjs`
- `project/tests/qa-runbook.md`
- `project/docs/release-cleanup-review-log.md`
- `project/docs/release-cleanup-iteration-6-s7.md`

Explicitly outside iteration 6:

- `code/manifest.json`
- `code/data/icons/*.png`
- `project/docs/agents-and-skills/`
- golden baseline PNGs
- generated QA artifacts

Reason:

- `code/manifest.json` and icon file changes belong to a separate icon cleanup requested by the project owner.
- Icon cleanup is intentionally left for the end of release preparation.
- Iteration 6 must not stage or commit manifest/icon changes.

Checks required to close iteration 6 without browser:

```bash
node --check project/tests/validate-extension.mjs
git diff --check
```

Full `pnpm run check` status:

- Deferred until the separate icon/manifest cleanup is resolved.
- Current blocker is expected and external to iteration 6 because the release guard refuses dirty `code/manifest.json`.

### Iteration 6 Closure Note

Status: CLOSED WITH SCOPED CHECKS.

Committed scope:

- `.gitignore`
- `project/tests/validate-extension.mjs`
- `project/tests/qa-runbook.md`
- `project/docs/release-cleanup-review-log.md`
- `project/docs/release-cleanup-iteration-6-s7.md`

Excluded from the iteration 6 commit:

- `code/manifest.json`
- `code/data/icons/*`
- PNG and golden baseline files
- `project/docs/agents-and-skills/`
- temporary QA/generated artifacts

Validation:

- `node --check project/tests/validate-extension.mjs`: passed.
- `git diff --check`: passed.

Full `pnpm run check`:

- Deferred until icon cleanup is closed.
- Reason: unrelated dirty `code/manifest.json` and icon file changes.

Browser:

- Not used.

## Release Cleanup Iteration 7 Spec Review

### Orchestrator -> ScopeGuard

Review this S7 spec: `project/docs/release-cleanup-iteration-7-s7.md`.

### ScopeGuard -> Orchestrator

Verdict: PASS

Scope assessment:
The spec remains within the requested release-cleanup scope: diagnostics performance cleanup without screenshot behavior changes. It explicitly forbids changes to `manifest.json`, browser permissions, icons, and scroll/fixed/sticky/split/export behavior. `PageProbe.js` is correctly treated as phase 2-only and proof-gated.

Architecture assessment:
The approach is narrow and correct. It reuses existing `diagnosticsMode`, `includeQaDiagnostics`, `CaptureDiagnostics.serializeForStorage()`, and `toProductionDiagnostics()` instead of creating a new diagnostics path, serializer, feature flag, or profiler. The spec correctly separates runtime data that affects capture from report-only diagnostics.

Competitor pattern observed:
Not inspected

Better alternative, if any:
No better alternative for this iteration. A broader `PageProbe` or content-agent rewrite would be riskier and unnecessary for the final release-cleanup tail.

Required narrowing:
No additional narrowing required. Implementation caution: if the developer cannot prove a computation is report-only, leave it unchanged in this iteration.

Status: PASS with one non-blocking implementation caution.

### Orchestrator -> Architect

Review the ScopeGuard feedback above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect -> Orchestrator

Accepted the ScopeGuard caution and updated `project/docs/release-cleanup-iteration-7-s7.md` to state:

> If the developer cannot prove that a computation is report-only, leave it unchanged in this iteration.

Resulting status: PASS with clarification applied.

### Orchestrator -> Red Team

Review `project/docs/release-cleanup-iteration-7-s7.md`.

Context: this is the S7 spec for release-cleanup iteration 7. It should keep screenshot behavior unchanged, keep manifest and browser permissions untouched, and avoid adding a new diagnostics architecture.

### Red Team -> Orchestrator

Verdict: WARN

Findings:

1. The spec relies on proving that a computation is report-only, but it did not define the proof procedure.
2. `PageProbe.js` was still allowed as a phase-2/proof-gated touch point, which is too risky for this final cleanup iteration.
3. Tests checked storage/whitelist behavior but did not clearly require proof that selected QA-only construction is not called in production.
4. The spec mixed construction, attachment, and serialization language.
5. Production and QA checks should validate the same QA-only object path where possible.
6. `capture-flow.mjs` should be avoided unless existing non-behavior checks are not enough.
7. New timing measurements in production should not be added.
8. QA reports and QA field names must remain stable.
9. Browser command names should not hardcode possibly wrong package-manager commands.
10. The existing diagnostics mode should not be called a new feature flag.

Required changes:

1. Remove `PageProbe.js` from iteration 7 allowed touch points.
2. Add a proof procedure for report-only computations.
3. Separate construction, attachment, and serialization in the spec.
4. Require a check that production does not build a selected QA-only object where feasible.
5. Replace flag wording with diagnostics-mode wording.
6. Avoid hardcoded browser command names.

Final recommendation:

WARN, close to PASS. Apply the required changes before handing the spec to the developer.

### Orchestrator -> Architect

Look at the Red Team review above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect -> Orchestrator

Accepted the Red Team review and updated `project/docs/release-cleanup-iteration-7-s7.md`.

Applied changes:

- removed `PageProbe.js` from allowed touch points;
- added `PageProbe.js` to forbidden touch points;
- changed the PageProbe section to "out of scope";
- added a proof procedure before gating report-only construction;
- explicitly separated construction, attachment, and serialization;
- added a rule that QA-only construction may be skipped only after report-only proof;
- changed "flag on/off" wording to diagnostics mode production/qa wording;
- replaced hardcoded browser commands with neutral existing-command wording;
- kept no new feature flags, no new production fields, and no capture behavior changes.

Resulting status: PASS after accepted Red Team changes.

## Release Cleanup Iteration 7 Re-Review After Owner Changes

### Orchestrator -> ScopeGuard

Review the updated S7 spec after the Architect changes: `project/docs/release-cleanup-iteration-7-s7.md`.

### ScopeGuard -> Orchestrator

Verdict: PASS

Scope assessment:
The updated spec stays within the release-cleanup iteration 7 scope. It still targets only QA-only diagnostics construction and attachment in production mode. The added proof procedure narrows the task rather than expanding it. The spec explicitly keeps screenshot behavior, scroll target selection, fixed/sticky handling, overlay/modal policy, split/stitch/tiling, export behavior, browser permissions, `manifest.json`, and icons out of scope.

Architecture assessment:
The updated spec is cleaner than the previous version. Removing `PageProbe.js` from allowed touch points is the right narrowing because it avoids turning this final cleanup into a broader probe/performance refactor. The construction/attachment/serialization split is useful and does not create a new diagnostics architecture. Reusing `diagnosticsMode`, `includeQaDiagnostics`, and existing `CaptureDiagnostics` boundaries remains the simplest path.

Competitor pattern observed:
Not inspected

Better alternative, if any:
No better alternative for this iteration. The only caution is implementation-level: if a candidate object has any read path into capture behavior, leave it unchanged and do not optimize it in iteration 7.

Required narrowing:
No further narrowing required.

Status: PASS.

### Orchestrator -> Architect

Look at the ScopeGuard re-review above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect -> Orchestrator

I agree with the ScopeGuard re-review.

No spec change is needed:

- ScopeGuard confirmed the update narrowed the task.
- ScopeGuard confirmed `PageProbe.js` is now correctly out of scope.
- ScopeGuard confirmed the proof procedure is useful and does not create a new diagnostics architecture.
- ScopeGuard's remaining caution is already covered by the spec rule: if a computation cannot be proven report-only, leave it unchanged.

Resulting status: PASS with no additional spec changes.

### Orchestrator -> Red Team

Review the updated S7 spec after the Architect changes: `project/docs/release-cleanup-iteration-7-s7.md`.

### Red Team -> Orchestrator

Verdict: PASS

Findings:

1. The previous missing proof procedure is now covered. The spec requires searching all reads with `rg` and leaving the computation unchanged if it feeds capture policy, readiness, split/stitch/tiling, scroll target selection, fixed/sticky handling, output planning, or save/download behavior.
2. `PageProbe.js` is now forbidden for iteration 7. This removes the biggest over-expansion risk from the previous draft.
3. The spec now separates construction, attachment, and serialization. That makes it harder for the developer to claim storage shaping is enough when construction still happens in production.
4. The spec no longer treats diagnostics mode as a new feature flag. It correctly reuses existing `diagnosticsMode === "qa"`.
5. The test section no longer hardcodes possibly wrong browser run commands and keeps browser checks optional because capture behavior must not change.
6. The diff budget now makes `PageProbe.js` zero lines and requires re-review if any forbidden touch point changes.

Residual risks:

- The implementation can still accidentally change behavior if the developer misclassifies a runtime object as report-only. The proof procedure and stop condition are the right mitigation.
- The spec allows `capture-flow.mjs` only if existing fixtures can check diagnostics without behavior changes. That is acceptable but should be watched during implementation.

Required changes:

No required changes.

Final recommendation:

PASS. The spec is ready for developer implementation, with the important constraint that any uncertain computation must be left unchanged.

### Orchestrator -> Architect

Look at the Red Team re-review above. If you agree that anything should be added or changed, update the spec. If not, explain why.

### Architect -> Orchestrator

I agree with the Red Team re-review.

No additional spec change is needed:

- Red Team confirmed the missing proof procedure is now covered.
- Red Team confirmed `PageProbe.js` is now correctly forbidden.
- Red Team confirmed construction, attachment, and serialization are separated.
- Red Team confirmed diagnostics mode wording is corrected.
- Red Team's residual risk is already covered by the spec stop condition and the rule to leave uncertain computations unchanged.

Resulting status: PASS.

### Iteration 7 Spec Re-Review Closure

Status: PASS.

The re-review loop is valid because:

- the updated spec was sent back to ScopeGuard after Architect changes;
- the full ScopeGuard re-review is recorded;
- Architect responded to the ScopeGuard re-review;
- the updated spec was sent back to Red Team after Architect changes;
- the full Red Team re-review is recorded;
- Architect responded to the Red Team re-review.

Next owner: Developer.

Next step: implement the approved iteration 7 spec without changing screenshot behavior and without touching forbidden files.

## Release Cleanup Iteration 7 Developer Step

### Orchestrator -> Developer

Implement the approved release-cleanup iteration 7 S7 spec in `project/docs/release-cleanup-iteration-7-s7.md`.

Constraints:

- Do not change screenshot behavior.
- Do not use the browser.
- Do not touch `code/manifest.json`, `code/data/icons/*`, `PageProbe.js`, Canvas modules, PositionPlanner, SplitBoundaryPlanner, FixedStickyNormalizer, QuirksLayer, LazyLoadWarmer, scroll logic, fixed/sticky logic, split/export logic, or browser permissions.
- Use only the existing diagnostics mode: `diagnosticsMode === "qa"`.
- If a computation cannot be proven report-only, leave it unchanged.
- Keep repository text in English.
- Report exactly what changed, what was inspected, and what checks were run.

### Developer -> Orchestrator

Implementation review result: no additional runtime patch is needed in this step.

What I inspected:

- `code/capture/CaptureController.js`
- `code/capture/CaptureDiagnostics.js`
- `code/capture/CaptureStepper.js`
- `project/tests/validate-extension.mjs`

Findings:

1. Heavy image-readiness summary construction is already gated by `includeQaDiagnostics`, derived from normalized `diagnosticsMode === "qa"` in `CaptureController.js`.
2. Repeated chrome analysis is already gated in `CaptureStepper.js` through `this.includeQaDiagnostics ? this.analyzeRepeatedChrome(frames) : null`.
3. Production storage already goes through `CaptureDiagnostics.toProductionDiagnostics()` and the production whitelist includes only the allowed compact fields, including coarse `platformOs`.
4. `validate-extension.mjs` already contains release guards for diagnostics mode, QA-only summaries, repeated chrome gating, coarse `platformOs`, and production stored diagnostics.
5. Remaining per-frame fields in `CaptureStepper.js` cannot be safely proven report-only from this narrow pass without risking capture behavior, so per the S7 stop condition they were left unchanged.

Files changed by this developer step:

- No runtime files changed.
- This review-log entry was added to preserve the visible orchestration trail.

Checks run:

- `node --check code/capture/CaptureController.js` — PASS.
- `node --check code/capture/CaptureDiagnostics.js` — PASS.
- `node --check code/capture/CaptureStepper.js` — PASS.
- `node --check project/tests/validate-extension.mjs` — PASS.
- `git diff --check` — PASS.

Result:

PASS with no runtime changes. Iteration 7 implementation is already satisfied by the current code shape and validation guards. The next useful step is a scoped review of this no-runtime-change conclusion, then decide whether to close iteration 7 or run broader existing checks.

## Release Cleanup Iteration 7 Patch Review Loop

### Orchestrator -> Architect

Review this iteration 7 developer result and current diff.

Artifact:

- Approved spec: `project/docs/release-cleanup-iteration-7-s7.md`
- Developer result: no runtime code patch was needed because the approved release-cleanup gating already exists in current code.
- Current implementation evidence:
  - `CaptureController.js` derives `includeQaDiagnostics` from normalized `diagnosticsMode === "qa"`.
  - `CaptureController.js` calls `attachImageReadinessSummary()` only when `includeQaDiagnostics` is true.
  - `CaptureStepper.js` gates `analyzeRepeatedChrome(frames)` behind `this.includeQaDiagnostics`.
  - `CaptureDiagnostics.js` serializes production diagnostics through `toProductionDiagnostics()`.
  - `validate-extension.mjs` contains guards for production whitelist, QA diagnostics mode, repeated chrome gating, coarse `platformOs`, and legacy QA alias.
- No runtime files were changed in this step.
- Checks run:
  - `node --check code/capture/CaptureController.js`
  - `node --check code/capture/CaptureDiagnostics.js`
  - `node --check code/capture/CaptureStepper.js`
  - `node --check project/tests/validate-extension.mjs`
  - `git diff --check`

### Architect -> Orchestrator

Verdict: PASS

Review:

1. The developer result matches the approved iteration 7 spec. The spec explicitly says to leave uncertain computations unchanged, and the developer did that for per-frame fields that cannot be proven report-only without risking capture behavior.
2. No forbidden runtime touch point was changed. The developer did not modify `PageProbe.js`, Canvas modules, split planning, scroll behavior, fixed/sticky behavior, export behavior, `manifest.json`, icons, or browser permissions.
3. The current code shape is architecturally acceptable for this iteration: existing `diagnosticsMode === "qa"` remains the single switch for verbose diagnostics, while production serialization stays whitelisted.
4. It is valid that this iteration produces no runtime patch if the desired state was already reached by prior iterations. Adding a cosmetic patch only to make a diff would increase risk and violate the small-change principle.
5. The review-log update is acceptable as orchestration documentation, but it should not be confused with a product/runtime patch.

Required changes:

No required changes.

Status: PASS.

### Orchestrator -> Developer

Look at the Architect review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer -> Orchestrator

I agree with the Architect review.

No code change is needed:

- The reviewer confirmed the no-runtime-patch result is valid for this iteration.
- The reviewer confirmed forbidden runtime areas were not touched.
- The reviewer confirmed that adding a cosmetic diff would be worse than leaving already-correct code unchanged.

Status: PASS with no patch changes.

### Orchestrator -> ScopeGuard

Review this iteration 7 developer result and current diff.

Artifact:

- Approved spec: `project/docs/release-cleanup-iteration-7-s7.md`
- Developer result: no runtime code patch was needed because the approved release-cleanup gating already exists in current code.
- Current implementation evidence:
  - `CaptureController.js` derives `includeQaDiagnostics` from normalized `diagnosticsMode === "qa"`.
  - `CaptureController.js` calls `attachImageReadinessSummary()` only when `includeQaDiagnostics` is true.
  - `CaptureStepper.js` gates `analyzeRepeatedChrome(frames)` behind `this.includeQaDiagnostics`.
  - `CaptureDiagnostics.js` serializes production diagnostics through `toProductionDiagnostics()`.
  - `validate-extension.mjs` contains guards for production whitelist, QA diagnostics mode, repeated chrome gating, coarse `platformOs`, and legacy QA alias.
- No runtime files were changed in this step.
- Checks run:
  - `node --check code/capture/CaptureController.js`
  - `node --check code/capture/CaptureDiagnostics.js`
  - `node --check code/capture/CaptureStepper.js`
  - `node --check project/tests/validate-extension.mjs`
  - `git diff --check`

### ScopeGuard -> Orchestrator

Verdict: PASS

Scope assessment:

The developer result stays inside the approved release-cleanup iteration 7 scope. No runtime capture behavior was changed, and no forbidden product areas were touched. The decision not to patch uncertain per-frame fields is correct because the spec explicitly says to leave computations unchanged unless they can be proven report-only.

Architecture assessment:

The current code uses the existing diagnostics path instead of creating a new flag, serializer, profiler, or parallel diagnostics engine. That is the simplest acceptable architecture. The production whitelist remains the owner of stored production diagnostics. QA-only repeated chrome analysis and image-readiness summaries are already behind QA diagnostics mode.

Competitor pattern observed:

Not inspected.

Better alternative, if any:

No better alternative for this iteration. A broader cleanup in `CaptureStepper.js` could be useful later, but it would need its own spec because it risks changing capture/runtime behavior.

Required narrowing:

No further narrowing required.

Status: PASS.

### Orchestrator -> Developer

Look at the ScopeGuard review above. If you agree that anything should be changed, update the patch. If not, explain why.

### Developer -> Orchestrator

I agree with the ScopeGuard review.

No code change is needed:

- The review confirms the step stayed inside scope.
- The review confirms no new diagnostics architecture was introduced.
- The review confirms broader `CaptureStepper.js` cleanup should remain a future separately specified iteration.

Status: PASS with no patch changes.

### Iteration 7 Patch Review Closure

Status: PASS.

The patch review loop is valid because:

- the developer result was shown;
- Architect reviewed the result and current diff;
- Developer responded to Architect;
- ScopeGuard reviewed the result and current diff;
- Developer responded to ScopeGuard;
- no accepted review comment required code changes.

Runtime code changed in iteration 7 implementation step: no.

Documentation changed:

- `project/docs/release-cleanup-review-log.md`

Checks run:

- `node --check code/capture/CaptureController.js` — PASS.
- `node --check code/capture/CaptureDiagnostics.js` — PASS.
- `node --check code/capture/CaptureStepper.js` — PASS.
- `node --check project/tests/validate-extension.mjs` — PASS.
- `git diff --check` — PASS.
