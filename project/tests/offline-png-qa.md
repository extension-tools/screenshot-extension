# Offline PNG QA

Generated: 2026-05-20T23:42:30.614Z
Artifacts: /Users/dima/Projects/Screenshot Extension/Screenshots-for-Review/runs/latest

This report analyzes existing PNG artifacts only. It does not open Chrome and does not recapture pages.

## Summary

- Cases scanned: 5
- Cases with offline visual signals: 1
- Mode: risk-aware
- Max decoded pixels per PNG: 60000000

## Issue Counts

- blank-or-low-entropy: 1

## Cases With Signals

### macys-dresses

- Status: BLOCKED ACCESS
- URL: https://www.macys.com/shop/womens-clothing/womens-dresses?id=5449
- Risk tags: none
- Runner reason: Page appears to show an access, bot-protection, or consent-blocking screen.
- PNGs: macys.com - Access Denied - 2026-05-21.png: 2730x1626
- blank-or-low-entropy: full image looks blank-like (mean=253, std=20, buckets=3, white=99%, gray=0%, dark=1%)
