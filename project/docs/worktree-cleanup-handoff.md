# Worktree Cleanup Handoff

Last updated: 2026-05-22.

Use this note when the chat context is compacted or the main task changes. It records the current Git/worktree cleanup state only; product and engine policy still live in `project/docs/current-context.md` and `project/docs/capture-risk-policy.md`.

## Goal

Keep the repo reviewable while the Screenshot Extension beta work continues:

- small commits by topic;
- no generated screenshots, PDFs, HTML dumps, or broad run artifacts in Git;
- runtime changes committed together with the tests that prove them;
- no remote repository, no push.

## Already Committed Cleanup / Organization

Recent relevant commits:

- `80ade37 test: improve real-site runner diagnostics`
  - committed only `project/tests/real-site-runner.mjs`;
  - runner-only diagnostics: scroll metadata, dimmed backdrop guard, unexpected short-page risk, review/look-first classification.
- `b4e6be9 test: detect repeated chrome in offline png qa`
  - committed only `project/tests/offline-png-qa.mjs`;
  - offline PNG detector for repeated horizontal/side chrome.
- `6186c9a test: register selected golden baseline metadata`
  - committed only JSON metadata;
  - no golden baseline PNG files committed.
- `8e513c3 chore: ignore generated product task pdfs`
- `dc90b17 chore: ignore generated spec pdfs`
- `7003a4e docs: clarify pdf and split roadmap`
- `6348ff2 test: add fixed and split boundary fixtures`
- `ea4d002 chore: optimize extension icons`
- `e52b1d7 chore: untrack golden baseline images`
- `fef08e9 docs: add pdf capture artifact contract`
- `aa3c3b5 fix: wait for tiled download completion`
- `918a7eb chore: ignore golden baseline images`
- `877423f docs: consolidate beta QA context`
- `4cbbf8e chore: ignore transient QA reports`

## Artifact Policy Already Applied

Do not commit:

- `project/tests/golden-baselines/real-sites/*.png`
- `project/docs/*.pdf`
- `project/specs/*.pdf`
- `project/product-tasks/*.pdf`
- `project/tests/generated/`
- `project/tests/HTML Complicated Sites/`
- transient reports matching:
  - `project/tests/real-site-qa-*.md`
  - `project/tests/broad-*.md`
  - `project/tests/wide-card-*.md`
  - `project/tests/targeted-*.md`

Latest redteam check before this handoff found no tracked files matching those artifact patterns.

## Current Uncommitted Worktree Shape

Expected remaining dirty files after the cleanup commits:

```text
M code/capture/CaptureController.js
M code/capture/CaptureDiagnostics.js
M code/capture/CaptureStepper.js
M code/capture/CleanupManager.js
M code/capture/ContentAgentClient.js
M code/capture/PageProbe.js
M code/content/ContentAgent.js
M code/content/FixedStickyNormalizer.js
M package.json
M project/tests/capture-flow.mjs
M project/tests/validate-extension.mjs
?? project/tests/sticky-cleanup-smoke.mjs
?? project/tests/wide-card-headless-research.mjs
```

This remaining diff is intentionally not yet committed because it mixes runtime engine changes and the tests that depend on those changes.

## Suggested Next Commit Order

1. Runtime capture-policy / sticky / fixed / quirks commit
   - Likely files:
     - `code/capture/CaptureController.js`
     - `code/capture/CaptureDiagnostics.js`
     - `code/capture/CaptureStepper.js`
     - `code/capture/CleanupManager.js`
     - `code/capture/ContentAgentClient.js`
     - `code/capture/PageProbe.js`
     - `code/content/ContentAgent.js`
     - `code/content/FixedStickyNormalizer.js`
   - Review carefully before committing because this is the main remaining risk.

2. Tests/validation commit for that runtime behavior
   - Likely files:
     - `project/tests/capture-flow.mjs`
     - `project/tests/validate-extension.mjs`
     - `project/tests/sticky-cleanup-smoke.mjs`
     - `package.json`
   - Do not commit these before the runtime behavior they assert.

3. Decide what to do with research script
   - `project/tests/wide-card-headless-research.mjs`
   - Commit only if we want durable research tooling in the repo.
   - Otherwise move it to ignored/local research area or document it as intentionally untracked.

## Checks To Run Before Each Next Commit

Use no-browser checks first:

```bash
git status --short
git diff --cached --stat
git diff --check -- <files>
node --check <changed-js-file>
rg -n "(BEGIN (RSA|OPENSSH|PRIVATE) KEY|sk-[A-Za-z0-9]|xox[baprs]-|ghp_[A-Za-z0-9]|AIza[0-9A-Za-z_-]{20,}|password\\s*=|token\\s*=|secret\\s*=)" <files> || true
git ls-files | rg -n "(golden-baselines/real-sites/.*\\.png$|project/(docs|specs|product-tasks)/.*\\.pdf$|project/tests/generated/|HTML Complicated Sites|project/tests/real-site-qa-.*\\.md$|project/tests/wide-card-.*\\.md$|project/tests/broad-.*\\.md$|project/tests/targeted-.*\\.md$)" || true
```

Browser runs are not needed for pure cleanup commits. Browser targeted runs are needed only after committing or reviewing runtime behavior.

## Red Flags For The Next Context

- Do not stage all remaining files at once.
- Do not commit golden baseline PNG files.
- Do not commit generated PDF exports.
- Do not commit saved real-site HTML dumps.
- Do not commit `validate-extension.mjs` changes if the runtime code they assert is not staged in the same or earlier commit.
- Do not treat `wide-card-headless-research.mjs` as required production code; it is research tooling unless explicitly promoted.
