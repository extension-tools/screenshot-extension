# Release Package Audit Checklist

This checklist records the release-package artifact boundary for the Screenshot Extension.

## Package Boundary

- Release package root: `code/`.
- Source-of-truth release cleanup spec: `project/docs/release-cleanup-s7.md`.
- Local QA and research assets stay outside the release package and outside Git unless explicitly promoted as small source fixtures.

## Red-Team Checklist

| Requirement | Status | Evidence |
| --- | --- | --- |
| Package excludes QA reports | PASS | `.gitignore` excludes `project/tests/real-site-qa-*.md`, broad/wide-card/targeted reports, and generated report files. |
| Package excludes golden baselines | PASS | `.gitignore` excludes `project/tests/golden-baselines/**/*.png`, `*.jpg`, `*.jpeg`, and `*.webp`; golden PNGs are local QA inputs only. |
| Package excludes saved HTML dumps | PASS | `.gitignore` excludes `project/tests/HTML Complicated Sites/`; saved real-site pages are investigation artifacts only. |
| Package excludes competitor research | PASS | `.gitignore` excludes `project/tests/competitor-*` files and folders. |
| Package excludes `node_modules` | PASS | `.gitignore` excludes `node_modules/`; dependencies are never packaged with the extension. |
| Package excludes macOS metadata | PASS | `.DS_Store` is ignored and removed from `code/` before packaging. |

## Audit Commands

Use these checks before preparing a release package:

```sh
git status --short
git ls-files | rg '(^|/)node_modules/|project/tests/golden-baselines/.*\.(png|jpg|jpeg|webp)$|project/tests/HTML Complicated Sites/|project/tests/competitor|project/tests/real-site-qa-.*\.md$|project/tests/(broad|wide-card|targeted)-.*\.md$|project/tests/.*research.*\.(md|mjs)$'
git check-ignore --no-index node_modules/.package-audit-placeholder project/tests/golden-baselines/real-sites/package-audit-placeholder.png 'project/tests/HTML Complicated Sites/package-audit-placeholder.html' project/tests/competitor-smoke/package-audit.png
find code -name .DS_Store -print
```

Expected result:

- `git ls-files | rg ...` prints nothing.
- `git check-ignore --no-index ...` prints every placeholder path.
- `find code -name .DS_Store -print` prints nothing.

## Notes

- `project/tests/fixtures/*.html` are small controlled test fixtures, not saved real-site dumps.
- `project/docs/agents-and-skills/` is local workflow documentation and is intentionally outside this release-package audit.
