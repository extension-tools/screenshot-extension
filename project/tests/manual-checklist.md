# Manual Checklist

## Install

- [ ] Open `chrome://extensions`.
- [ ] Enable Developer mode.
- [ ] Click `Load unpacked`.
- [ ] Select `/Users/dima/Projects/Screenshot Extension/code`.
- [ ] Confirm the extension appears as `Screenshot Extension`.
- [ ] Confirm the new extension icon appears in Chrome.

## Basic Capture

- [ ] Open a normal `https://` page.
- [ ] Click the extension icon.
- [ ] Confirm the toolbar icon opens a popup.
- [ ] Confirm the popup shows `Capture as PDF` and `Capture as PNG`.
- [ ] Confirm clicking `Capture as PNG` starts capture.
- [ ] Confirm a PNG image downloads.
- [ ] Confirm clicking `Capture as PDF` starts capture.
- [ ] Confirm a PDF file downloads.
- [ ] Confirm the image contains more than the visible viewport on a long page.
- [ ] Confirm the page returns to its original scroll position.

## Edge Cases

- [ ] Long page.
- [ ] High-DPI display.
- [ ] Sticky header appears once instead of repeating on every frame.
- [ ] Cookie banner appears once instead of repeating on every frame.
- [ ] City/location popup appears once instead of repeating on every frame.
- [ ] Browser scrollbar is not repeated in the final stitched image.
- [ ] Browser scrollbar returns after capture cleanup.
- [ ] Main internal scroll-pane scrollbar is not repeated when present.
- [ ] Short ChatGPT-like conversation captures content below the first visible viewport.
- [ ] App-shell capture includes visible sidebar/left navigation when the site is in the beta app-shell target list.
- [ ] App-shell capture includes visible top chrome/header when present.
- [ ] App-like chat/page with a growing internal scroll pane captures content loaded during warmup.
- [ ] Dynamic pages do not capture obvious mid-layout states after scrolling.
- [ ] Lazy-loaded image page.
- [ ] Horizontal-scroll page.
- [ ] Custom scroll-container page.
- [ ] Page with same-origin iframe.
- [ ] Page with cross-origin iframe.
- [ ] Very large page shows a clear error instead of producing a blank image.

## Restricted Pages

- [ ] `chrome://extensions` does not start capture.
- [ ] Chrome Web Store page does not start capture.
- [ ] Extension page does not start capture.
- [ ] `file://` behavior is understood and documented.

## Failure Behavior

- [ ] User sees a clear error when capture is blocked.
- [ ] Badge/progress state is cleared after failure.
- [ ] Original scroll position is restored after failure.
