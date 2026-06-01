# Codex Cloud Queue

## Product Approval

Approved first cloud queue on 2026-06-01:

1. Read-only roadmap orientation.
2. Speed timing report.
3. Capture progress product/tech spec.
4. Product-card seam fixture spec.
5. AGENTS/queue hygiene.

PDF export QA is intentionally not included in this first five-task queue.

## Global Rule

Do tasks one by one unless explicitly told to parallelize.

Do not start the next task until the previous pull request is reviewed, merged, or explicitly abandoned.

Keep every pull request small. If a task wants to expand into capture-policy changes, stop and ask.

## Task 1: Read-Only Roadmap Orientation

Status: ready

Goal:
Read the project context and summarize the top current implementation tasks. Do not change files.

Read:

- `AGENTS.md`
- `project/docs/current-context.md`
- `project/docs/roadmap.md`
- `project/docs/product.md`
- `project/tests/qa-runbook.md`

Allowed files:

- none

Forbidden:

- any code or documentation edits
- any commits
- any pull request

Output:

- short summary of the top current tasks
- recommended first implementation PR
- questions or blockers

Tests:

- none required

## Task 2: Speed Timing Report

Status: ready after Task 1 review

Goal:
Create a small docs-only report that maps existing timing diagnostics to the speed roadmap stages. Do not change runtime code.

Allowed files:

- `project/docs/*`
- `project/tests/*` only for a report or checklist update

Forbidden files:

- `code/**`
- generated QA artifacts
- real-site output folders

Tests:

```bash
npm run check
```

Stop condition:
If timing data is missing and runtime diagnostics would be needed, stop and propose a separate diagnostics task instead of editing runtime code.

Expected output:

- one small pull request
- report with top phases to optimize first
- tests run

## Task 3: Capture Progress Product/Tech Spec

Status: ready after Task 1 review

Goal:
Prepare a narrow product and technical spec for user-visible capture progress and completion feedback.

Allowed files:

- `project/product-tasks/*`
- `project/docs/*`

Forbidden files:

- `code/**`
- generated QA artifacts

Tests:

```bash
npm run check
```

Stop condition:
Do not implement UI or worker changes in this task.

Expected output:

- one docs-only pull request
- clear allowed/forbidden implementation touch points
- minimal first implementation proposal

## Task 4: Product-Card Seam Fixture Spec

Status: ready after Task 1 review

Goal:
Prepare a fixture-only implementation plan for detecting product-card cuts inside screenshots and between PNG parts.

Allowed files:

- `project/product-tasks/*`
- `project/docs/*`
- `project/tests/*` only if explicitly implementing fixture metadata in a later task

Forbidden files:

- `code/capture/**`
- `code/content/**`
- runtime capture behavior

Tests:

```bash
npm run check
```

Stop condition:
Do not change seam placement runtime logic in this task.

Expected output:

- one small pull request
- fixture acceptance criteria
- target pages and controlled fixture proposal

## Task 5: AGENTS/Queue Hygiene

Status: optional

Goal:
Improve `AGENTS.md` or this queue if Codex Cloud discovers missing setup instructions.

Allowed files:

- `AGENTS.md`
- `project/codex-cloud-queue.md`

Forbidden files:

- `code/**`
- unrelated docs

Tests:

```bash
npm run check
```

Stop condition:
Do not use this task to change product priorities.
