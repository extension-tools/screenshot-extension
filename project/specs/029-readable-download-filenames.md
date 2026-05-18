# 029: Readable Download Filenames

## Product Task

- `../product-tasks/029-readable-download-filenames.md`

## Goal

Generate user-readable download filenames that make saved screenshots easy to identify and sort.

## Filename Pattern

```text
{SiteName} - {PageTitleShort} - {YYYY-MM-DD}.{ext}
```

For multi-part output:

```text
{SiteName} - {PageTitleShort} - {YYYY-MM-DD} - part 01 of N.{ext}
```

## Title Source

- `SiteName`: `og:site_name`, falling back to the hostname without `www`.
- `PageTitleShort`: first meaningful rendered `h1`.
- If `h1` is missing, empty, hidden, or too generic, use the URL path.
- Do not use `document.title` as the page-title source for this behavior.

## Constraints

- Replace filename-unsafe characters: `< > : " / \ | ? *` and control characters.
- Trim leading dots and trailing dots/spaces.
- Avoid Windows reserved names such as `CON`, `PRN`, `AUX`, `NUL`, `COM1`, and `LPT1`.
- Cap `PageTitleShort` at 50 characters on word or phrase boundaries when possible.
- Cap the final filename at 120 characters including part suffix and extension.
- Preserve the actual output extension: PNG, JPEG, or future PDF.

## Implementation

- `CaptureStore.buildFilename` collects page metadata from the active tab.
- `CaptureStore` sanitizes filename parts before download.
- Multi-part downloads append `part 01 of N` before the extension.

## Test Coverage

Manual verification is enough for this change because it affects download naming only. Future automated coverage should assert filename patterns in capture-flow once download-name checks are added.
