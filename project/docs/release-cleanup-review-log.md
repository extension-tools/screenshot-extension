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
