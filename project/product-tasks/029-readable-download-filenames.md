# 029: Readable Download Filenames

## Product Statement

Downloaded screenshots should have names users can recognize in Downloads without opening the file. Use `{SiteName} - {PageTitleShort} - {YYYY-MM-DD}.{ext}`, where `PageTitleShort` comes from the first meaningful `h1`; if `h1` is empty, generic, or missing, use the URL path.

## Acceptance Criteria

- Filename is safe for Windows, macOS, and Linux.
- `PageTitleShort` is capped at 50 characters.
- Final filename is capped at 120 characters including suffix and extension.
- PNG/JPEG/PDF extensions remain correct.
- Multi-part captures use `part 01 of N` suffixes.
