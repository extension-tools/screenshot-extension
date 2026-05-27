# Release Cleanup Iteration 6 S7 Pre-Implementation Spec

## Recommendation

Use an S7 pre-implementation spec only.

The broader release-cleanup architecture decision already exists in `project/docs/release-cleanup-s7.md`. Iteration 6 is a packaging and release-audit iteration. It must not change screenshot capture behavior.

## Context

Previous release-cleanup iterations introduced and hardened:

- canonical `diagnosticsMode`;
- production diagnostics whitelist;
- QA-mode verbose diagnostics;
- storage and artifact boundary checks;
- QA-only diagnostics summary gates.

The remaining release risk is not capture quality. The remaining risk is shipping development artifacts, research files, saved HTML dumps, golden baseline PNGs, generated screenshots, local configs, or secrets in the release package.

## Problem

The working tree and project structure contain useful QA and research artifacts. They are valuable locally, but they must not be included in the Chrome Web Store release package.

The extension needs a release-package audit that proves:

- production extension files are present;
- required Chrome extension source files are not accidentally ignored;
- QA/research/generated/local artifacts are excluded;
- no secrets or private local files are included;
- `manifest.json` and permissions are unchanged.

## Decision

Add a narrow release package audit layer.

The audit must be local-only and test-only. It must not run during normal user capture. It must not modify runtime capture code.

The audit should verify the package candidate using file paths and metadata, not browser automation.

## Root Cause

The beta stabilization process produced many useful local artifacts. The release process needs an explicit guard so those artifacts stay out of the release package while important extension source files remain included.

## Allowed Touch Points

| File | Allowed change | Why this file owns the change |
| --- | --- | --- |
| `.gitignore` | Add or refine ignores for generated screenshots, saved HTML dumps, local QA outputs, golden baseline PNGs, local archives, and temporary release/package output. | It owns local artifact exclusion. |
| `project/tests/validate-extension.mjs` | Add static release-package audit checks. | It already owns release validation. |
| `package.json` | Add a small script only if needed, such as `check:release-package`, that calls existing validation. | It owns developer commands. |
| `project/tests/qa-runbook.md` | Document how to run release package checks. | It owns QA workflow instructions. |
| `project/docs/release-cleanup-review-log.md` | Record review loop, checks, and final status. | It owns release-cleanup review evidence. |

## Forbidden Touch Points

Do not change:

- `manifest.json`;
- browser permissions;
- capture runtime code;
- `code/capture/PageProbe.js`;
- `code/capture/CaptureController.js`;
- `code/capture/CaptureStepper.js`;
- `code/content/FixedStickyNormalizer.js`;
- `code/capture/CanvasStitcher.js`;
- `code/capture/CanvasTiler.js`;
- `code/capture/CanvasSizeGuard.js`;
- `code/capture/PositionPlanner.js`;
- `code/capture/SplitBoundaryPlanner.js`;
- `code/capture/QuirksLayer.js`;
- screenshot output behavior;
- scroll target selection;
- fixed/sticky behavior;
- overlay/modal behavior;
- split/stitch behavior;
- PDF export behavior;
- save/download behavior.

If any forbidden touch point appears necessary, stop and request a separate spec.

## Existing Overlapping Logic To Reuse

Reuse:

- existing `validate-extension.mjs` release checks;
- existing `manifest.json` validation checks;
- existing diagnostics whitelist checks;
- existing `pnpm run check`;
- existing `.gitignore` patterns where they already exclude generated artifacts.

Do not create:

- a new packaging engine;
- a new manifest generator;
- a new extension build system;
- a second validation runner if `validate-extension.mjs` is enough;
- a browser-based release audit;
- a network-based audit;
- a script that deletes user files.

## Exact Proposed Logic

### 1. Define audit surfaces

Keep two surfaces separate:

```text
Chrome extension package candidate:
  code/**

Repository release-support files:
  project/docs/release-cleanup-*.md
  project/tests/validate-extension.mjs
  project/tests/qa-runbook.md
  package.json
  pnpm-lock.yaml
  README.md, if present
```

Only the Chrome extension package candidate may become the Chrome Web Store ZIP input.

Repository release-support files may be committed as source-of-truth documentation or validation tooling, but they must not be included in the Chrome Web Store extension package.

The exact package candidate may be narrower if the project already uses a specific extension package root. Do not invent a new release root if one already exists.

### 2. Define forbidden package paths

The audit must fail if a release candidate includes paths matching these classes:

```text
node_modules/**
project/tests/generated/**
project/tests/HTML Complicated Sites/**
project/tests/golden-baselines/**/*.png
project/tests/golden-baselines/**/*.jpg
project/tests/golden-baselines/**/*.jpeg
project/tests/golden-baselines/**/*.webp
project/tests/**/report.md
project/tests/real-site-qa*.md
project/tests/broad-*.md
project/tests/wide-card-*.md
project/tests/*research*.md
project/tests/*research*.mjs
*.zip
*.crx
*.pem
*.key
*.p12
*.env
.env*
*.cookies*
```

Golden baseline PNG files are local QA assets only. They must never be committed as release artifacts and must never be included in the release package.

### 3. Define required extension files

The audit must fail if required extension files are absent from the candidate:

```text
code/manifest.json
code/background.js or equivalent worker entry
code/content scripts referenced by manifest
code/capture runtime files referenced by worker or extension entry points
code/data/icons/*.png if referenced by manifest
```

The audit must not ignore `manifest.json`, `src`-like source folders, or runtime capture modules.

### 4. Add static repository artifact checks

Add checks to `validate-extension.mjs`:

```text
read .gitignore
assert generated screenshots are ignored
assert saved HTML dumps are ignored
assert golden baseline image files are ignored
assert local QA/research outputs are ignored
assert node_modules is ignored
assert secrets/key/certificate patterns are ignored
assert manifest.json is not ignored
assert code/ runtime source is not ignored
```

These checks guard repository hygiene and staging mistakes. They are not a substitute for checking the actual Chrome Web Store package file list.

### 5. Add package-list audit when an existing package command is available

If the repository already has a packaging command or file-list command, add a test that checks its output.

If no packaging command exists:

```text
do not create a new packaging system in this iteration
record "no package file-list command available" in the review log
keep the actual package dry-run as a required follow-up before release
```

Do not claim full Chrome Web Store package readiness without an actual package file-list audit.

### 6. Keep release audit local-only

The audit must not:

- upload files;
- contact external services;
- call Chrome Web Store APIs;
- create a real `.crx`;
- sign packages;
- use private keys;
- read cookies;
- scrape browser storage;
- collect form values.

## Pseudocode

```text
ignored = readFile(".gitignore")

requiredIgnorePatterns = [
  "node_modules",
  "project/tests/generated",
  "project/tests/HTML Complicated Sites",
  "project/tests/golden-baselines/**/*.png",
  "*.zip",
  "*.crx",
  "*.pem",
  "*.key",
  ".env"
]

for pattern in requiredIgnorePatterns:
  assert ignored contains an equivalent ignore rule

assert ignored does not ignore "code/manifest.json"
assert ignored does not ignore "code/"
```

```text
manifest = readJson("code/manifest.json")

assert manifest permissions unchanged from current committed baseline
assert referenced icon files exist
assert referenced background/content entries exist
```

```text
if package file list is available:
  files = getPackageFileList()
  assert no forbidden package path is included
  assert required extension files are included
else:
  skip package file list audit with reason "no package command"
  record follow-up "actual package file-list audit required before release"
```

## Diagnostics Plan

No runtime diagnostics.

No QA diagnostics schema changes.

No production diagnostics schema changes.

This iteration may print local validation output only when a developer runs checks.

## Feature Flags

No new feature flags.

Existing flags remain unchanged:

| Flag | Default | Iteration 6 behavior |
| --- | --- | --- |
| `diagnosticsMode` | `"production"` | No change. |
| `qaDiagnostics` | `false` | No change. |

## Tests

Run:

```text
pnpm run check
node --check project/tests/validate-extension.mjs
git diff --check
```

If a package dry-run command already exists, run it and validate the file list.

If no package dry-run command exists, record that limitation in the review log and do not mark final package readiness as complete.

Do not run browser tests for this iteration by default.

## Expected Diff Budget

Target budget:

- `.gitignore`: 5-25 lines;
- `project/tests/validate-extension.mjs`: 40-120 lines;
- `package.json`: 0-5 lines, only if adding a small script is useful;
- `project/tests/qa-runbook.md`: 5-30 lines;
- `project/docs/release-cleanup-review-log.md`: review transcript only.

Stop and re-review if total non-log diff exceeds 250 lines.

## Scope Constraints

This iteration is only about release package hygiene and local validation.

It must not:

- optimize capture runtime;
- change screenshot behavior;
- change diagnostics runtime shape;
- change QA mode behavior;
- add package signing;
- add Chrome Web Store publishing automation;
- delete local user artifacts;
- commit golden baseline PNGs.

This iteration may improve repository artifact hygiene even when no package command exists. However, final release readiness still requires a real package file-list audit before publishing.

## Stop Conditions

Stop and ask for confirmation if:

- a package command must be invented;
- manifest permissions would change;
- `manifest.json` must be edited;
- runtime capture files must be edited;
- release ZIP signing or `.crx` generation appears necessary;
- private keys are needed;
- network upload or Chrome Web Store API access appears necessary;
- golden baseline PNGs appear in staging;
- saved HTML dumps appear in staging;
- local QA generated files appear in staging;
- `.gitignore` changes would hide required extension source files.

Stop and do not claim final package readiness if:

- no actual package file-list command exists;
- the package file-list cannot be inspected;
- the release ZIP contents cannot be verified.

## Rollback

Rollback is simple:

1. Revert `.gitignore` changes.
2. Revert validation additions.
3. Revert QA runbook notes.

No runtime behavior should need rollback because this iteration must not touch runtime capture code.

## Recommended Developer Next Step

1. Inspect `.gitignore`.
2. Add only missing artifact ignore patterns.
3. Add validation checks to `validate-extension.mjs`.
4. Run non-browser checks.
5. Ask for Architect and ScopeGuard diff review before commit.
