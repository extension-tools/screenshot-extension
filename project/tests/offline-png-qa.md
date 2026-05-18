# Offline PNG QA

Generated: 2026-05-17T23:50:36.107Z
Artifacts: /Users/dima/Projects/Screenshot Extension/Screenshots-for-Review/runs/latest

This report analyzes existing PNG artifacts only. It does not open Chrome and does not recapture pages.

## Summary

- Cases scanned: 100
- Cases with offline visual signals: 15
- Mode: risk-aware
- Max decoded pixels per PNG: 60000000

## Issue Counts

- vertical-black-strip: 6
- repeated-left-sidebar-or-panel: 5
- repeated-horizontal-overlay-or-strip: 3
- horizontal-seam-band: 3
- blank-or-low-entropy: 1
- right-side-blank-strip: 1

## Cases With Signals

### apple-iphone

- Status: UNSTABLE SITE
- URL: https://www.apple.com/iphone/
- Risk tags: split-boundary-text, missing-content
- Runner reason: deep QA visual guard: split-boundary text risk: tagged site produced multi-part output and requires look-first until text-boundary detector is precise
- PNGs: Apple - iPhone - 2026-05-18 - part 01 of 02.png: 2730x16319; Apple - iPhone - 2026-05-18 - part 02 of 02.png: 2730x10343
- repeated-horizontal-overlay-or-strip: 1 later part(s) resemble the first part bottom strip

### codepen-pens

- Status: SAMPLE REVIEW
- URL: https://codepen.io/pens/public
- Risk tags: none
- Runner reason: Auto checks passed; sampled for human visual review because this target is complex or explicitly marked.
- PNGs: codepen.io - 404 - 2026-05-18.png: 2730x1626
- blank-or-low-entropy: full image looks blank-like (mean=24, std=25, buckets=4, white=1%, gray=0%, dark=99%)
- vertical-black-strip: edge strip is mostly black (left mean=21, std=0, buckets=1, white=0%, gray=0%, dark=100%, right mean=21, std=0, buckets=1, white=0%, gray=0%, dark=100%)

### dyson-vacuums

- Status: UNSTABLE SITE
- URL: https://www.dyson.com/vacuum-cleaners
- Risk tags: repeated-overlay
- Runner reason: uncertain large modal detected; capture continued for manual review
- PNGs: dyson.com - Vacuum Cleaners - 2026-05-18 - part 01 of 02.png: 2730x16384; dyson.com - Vacuum Cleaners - 2026-05-18 - part 02 of 02.png: 2730x196
- vertical-black-strip: edge strip is mostly black (left mean=0, std=0, buckets=1, white=0%, gray=0%, dark=100%, right mean=2, std=20, buckets=8, white=0%, gray=1%, dark=98%)

### fastapi-docs

- Status: UNSTABLE SITE
- URL: https://fastapi.tiangolo.com/
- Risk tags: split-boundary-text, docs-sidebar-main-scroll
- Runner reason: deep QA visual guard: split-boundary text risk: tagged site produced multi-part output and requires look-first until text-boundary detector is precise
- PNGs: fastapi.tiangolo.com - Page - 2026-05-18 - part 01 of 03.png: 2730x16346; fastapi.tiangolo.com - Page - 2026-05-18 - part 02 of 03.png: 2730x16384; fastapi.tiangolo.com - Page - 2026-05-18 - part 03 of 03.png: 2730x4680
- repeated-left-sidebar-or-panel: 2 later part(s) have a left-region signature close to part 1
- repeated-horizontal-overlay-or-strip: 2 later part(s) resemble the first part bottom strip

### gopro-hero

- Status: UNSTABLE SITE
- URL: https://gopro.com/en/us/shop/cameras
- Risk tags: none
- Runner reason: uncertain large modal detected; capture continued for manual review
- PNGs: gopro.com - cameras - 2026-05-18 - part 01 of 02.png: 2730x16384; gopro.com - cameras - 2026-05-18 - part 02 of 02.png: 2730x302
- vertical-black-strip: edge strip is mostly black (left mean=17, std=0, buckets=1, white=0%, gray=0%, dark=100%, right mean=17, std=0, buckets=1, white=0%, gray=0%, dark=100%)

### json-crack-editor

- Status: SAMPLE REVIEW
- URL: https://jsoncrack.com/editor
- Risk tags: none
- Runner reason: Auto checks passed; sampled for human visual review because this target is complex or explicitly marked.
- PNGs: jsoncrack.com - editor - 2026-05-18.png: 2730x1626
- vertical-black-strip: edge strip is mostly black (left mean=13, std=8, buckets=4, white=0%, gray=0%, dark=97%, right mean=13, std=9, buckets=8, white=0%, gray=1%, dark=98%)

### laravel-docs

- Status: UNSTABLE SITE
- URL: https://laravel.com/docs/12.x
- Risk tags: docs-sidebar-main-scroll, repeated-sidebar
- Runner reason: unsettled scroll frames: frame 16: planned 0,11774; actual 0,11758
- PNGs: Laravel - Installation - 2026-05-18 - part 01 of 02.png: 2730x16354; Laravel - Installation - 2026-05-18 - part 02 of 02.png: 2730x8820
- repeated-left-sidebar-or-panel: 1 later part(s) have a left-region signature close to part 1

### mdn-web-api

- Status: UNSTABLE SITE
- URL: https://developer.mozilla.org/en-US/docs/Web/API
- Risk tags: split-boundary-text, docs-sidebar-main-scroll
- Runner reason: deep QA visual guard: split-boundary text risk: tagged site produced multi-part output and requires look-first until text-boundary detector is precise
- PNGs: developer.mozilla.org - Web APIs - 2026-05-18 - part 01 of 05.png: 2730x16382; developer.mozilla.org - Web APIs - 2026-05-18 - part 02 of 05.png: 2730x16360; developer.mozilla.org - Web APIs - 2026-05-18 - part 03 of 05.png: 2730x16384; developer.mozilla.org - Web APIs - 2026-05-18 - part 04 of 05.png: 2730x15912; developer.mozilla.org - Web APIs - 2026-05-18 - part 05 of 05.png: 2730x10400
- repeated-left-sidebar-or-panel: 4 later part(s) have a left-region signature close to part 1
- repeated-horizontal-overlay-or-strip: 4 later part(s) resemble the first part bottom strip

### microsoft-surface-pro

- Status: SAMPLE REVIEW
- URL: https://www.microsoft.com/en-us/surface/devices/surface-pro-11th-edition
- Risk tags: wide-output, right-blank-strip
- Runner reason: Auto checks passed; sampled for human visual review because this target is complex or explicitly marked.
- PNGs: microsoft.com - Get tablet-to-laptop flexibility in one powerful - 2026-05-18 - part 01 of 07.png: 2730x16355; microsoft.com - Get tablet-to-laptop flexibility in one powerful - 2026-05-18 - part 02 of 07.png: 2730x15533; microsoft.com - Get tablet-to-laptop flexibility in one powerful - 2026-05-18 - part 03 of 07.png: 2730x14180; microsoft.com - Get tablet-to-laptop flexibility in one powerful - 2026-05-18 - part 04 of 07.png: 2730x15655; microsoft.com - Get tablet-to-laptop flexibility in one powerful - 2026-05-18 - part 05 of 07.png: 2730x16384; microsoft.com - Get tablet-to-laptop flexibility in one powerful - 2026-05-18 - part 06 of 07.png: 2730x16328; microsoft.com - Get tablet-to-laptop flexibility in one powerful - 2026-05-18 - part 07 of 07.png: 2730x9985
- right-side-blank-strip: right strip differs from center (mean=255, std=3, buckets=2, white=100%, gray=0%, dark=0% vs center mean=218, std=78, buckets=51, white=78%, gray=2%, dark=7%)

### mongodb-docs

- Status: UNSTABLE SITE
- URL: https://www.mongodb.com/docs/
- Risk tags: seam-band, missing-content, split-boundary-text
- Runner reason: uncertain large modal detected; capture continued for manual review
- PNGs: mongodb.com - Welcome to the MongoDB Docs - 2026-05-18.png: 2730x6214
- horizontal-seam-band: 4 narrow low-detail horizontal bands detected; first at y=84, height=48

### patagonia-jackets

- Status: UNSTABLE SITE
- URL: https://www.patagonia.com/shop/mens/jackets-vests
- Risk tags: repeated-sidebar, product-filter-panel, repeated-overlay, split-boundary-text, seam-band
- Runner reason: uncertain large modal detected; capture continued for manual review
- PNGs: patagonia.com - Men's Jackets & Vests - 2026-05-18 - part 01 of 04.png: 2730x16384; patagonia.com - Men's Jackets & Vests - 2026-05-18 - part 02 of 04.png: 2730x16384; patagonia.com - Men's Jackets & Vests - 2026-05-18 - part 03 of 04.png: 2730x16384; patagonia.com - Men's Jackets & Vests - 2026-05-18 - part 04 of 04.png: 2730x2058
- repeated-left-sidebar-or-panel: 3 later part(s) have a left-region signature close to part 1

### photopea

- Status: SAMPLE REVIEW
- URL: https://www.photopea.com/
- Risk tags: none
- Runner reason: Auto checks passed; sampled for human visual review because this target is complex or explicitly marked.
- PNGs: photopea.com - Free Online Photo Editor - 2026-05-18.png: 2730x5510
- vertical-black-strip: edge strip is mostly black (left mean=16, std=3, buckets=2, white=0%, gray=0%, dark=100%, right mean=17, std=3, buckets=2, white=0%, gray=0%, dark=100%)

### redis-docs

- Status: PASS_AUTO
- URL: https://redis.io/docs/latest/
- Risk tags: none
- Runner reason: Auto checks passed.
- PNGs: Docs - Welcome to Redis Docs - 2026-05-18.png: 2730x6538
- vertical-black-strip: edge strip is mostly black (left mean=24, std=9, buckets=7, white=0%, gray=0%, dark=99%, right mean=27, std=16, buckets=10, white=0%, gray=0%, dark=74%)

### rei-backpacks

- Status: UNSTABLE SITE
- URL: https://www.rei.com/c/backpacks
- Risk tags: repeated-overlay, seam-band, product-filter-panel, repeated-sidebar, split-boundary-text
- Runner reason: deep QA visual guard: possible repeated filter-panel candidate across output parts
- PNGs: REI - Backpacks - 2026-05-18 - part 01 of 02.png: 2730x16384; REI - Backpacks - 2026-05-18 - part 02 of 02.png: 2730x5548
- horizontal-seam-band: 2 narrow low-detail horizontal bands detected; first at y=0, height=36
- repeated-left-sidebar-or-panel: 1 later part(s) have a left-region signature close to part 1

### samsung-galaxy-s

- Status: UNSTABLE SITE
- URL: https://www.samsung.com/us/smartphones/galaxy-s/
- Risk tags: seam-band, split-boundary-text
- Runner reason: uncertain large modal detected; capture continued for manual review
- PNGs: Samsung Electronics America - Galaxy S - 2026-05-18.png: 2730x14562
- horizontal-seam-band: 9 narrow low-detail horizontal bands detected; first at y=0, height=32
