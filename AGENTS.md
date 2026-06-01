# AGENTS.md

## Project

Screenshot Extension is a Chrome MV3 extension for full-page screenshots.

## Read First

For every task, read:

- `project/docs/current-context.md`
- `project/docs/roadmap.md`
- `project/tests/qa-runbook.md`

If the task touches capture behavior, risk decisions, page measurement, scroll planning, fixed/sticky handling, modal handling, or QA classification, also read:

- `project/docs/capture-risk-policy.md`

## Working Rules

- Keep changes small, reviewable, and reversible.
- Prefer existing architecture, modules, helpers, and diagnostics.
- Do not change the capture pipeline unless the task explicitly allows it.
- Do not add site-specific logic unless explicitly requested.
- Do not modify unrelated files.
- Do not add new dependencies unless the task explicitly requires them.
- Do not commit generated QA artifacts, real-site run output, screenshots, downloads, archives, or temporary browser profiles unless explicitly requested.
- One task should produce one small pull request.
- If a task appears to require broad capture-policy changes, stop and ask for confirmation.

## Tests

Default validation:

```bash
npm run check
```

For capture runtime changes, run when browser support is available:

```bash
npm run capture:test
```

For fixed/sticky/modal/seam/page-boundary changes, run when browser support is available:

```bash
npm run capture:risk
```

Do not run broad 100-site or 300-site real-site QA unless explicitly requested.

## Pull Request Output

Every pull request should include:

- What changed.
- Files changed.
- Tests run.
- Tests not run and why.
- Risk assessment.
- Any follow-up needed.
