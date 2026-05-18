# 026: Large Page Notification Service

## Product Task

- `../product-tasks/026-large-page-notification-service.md`

## Goal

Add a minimal centralized notification architecture and use it for large-page tiled-output capture.

## Product-Technical Description

When a page is too large for one safe canvas, the extension should explain the intentional split before the expensive capture frames begin. This reduces surprise, makes multi-part output feel deliberate, and creates a single future place for product copy, CTAs, and analytics.

## Architecture

```text
CaptureController
  -> CanvasSizeGuard.createStrategy(page)
  -> NotificationService.emit(event)
  -> chrome.notifications
  -> chrome.storage.local.lastNotificationEvent
```

## Event Shape

`NotificationService` normalizes events into:

- `event`
- `reason`
- `severity`
- `title`
- `message`
- `cta`
- `fallback`
- `data`
- `createdAt`

The service stores the normalized event as `lastNotificationEvent` for QA and tests.

## Current Event

```text
event: capture.large-page-split
reason: canvas_tiling_required
severity: info
```

Temporary copy:

```text
This page is very large. Screenshot Extension will save it in multiple image parts for reliability.
```

Product copy may replace this later without changing the capture architecture.

## Non-Goals

- No analytics provider yet.
- No network telemetry.
- No CTA buttons yet.
- No user preference controls yet.

## Test Coverage

`huge-page-tiling` in `../tests/capture-flow.mjs` verifies:

- multiple PNG parts are downloaded;
- a `capture.large-page-split` notification event is stored;
- the notification reason is `canvas_tiling_required`.
