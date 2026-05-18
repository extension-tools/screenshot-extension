# Product Task: Large Page Pre-Capture Notification

## Problem

Large pages may be saved as multiple PNG parts. Without a pre-capture notice, users can interpret multiple downloads as a bug or be surprised by the output.

## User

Users capturing long documentation, wiki, news, and app-shell pages that exceed the safe single-canvas limit.

## Value

The product sets expectations before expensive capture work starts. Users understand that multiple image parts are intentional and chosen for reliability.

## Desired Behavior

- Detect when the selected capture strategy is `tiled-output`.
- Emit one centralized notification event before real viewport capture starts.
- Keep the text replaceable by product copy later.
- Store the last notification event for QA and automated tests.
- Do not add analytics or external telemetry in this task.

## Non-Goals

- No telemetry provider.
- No final copywriting decision.
- No CTA buttons.
- No cancellation flow.

## Success Criteria

- Notification logic is centralized in `NotificationService`.
- Capture errors also use `NotificationService`.
- Huge-page capture-flow test verifies that the large-page split notification event is emitted.

## Related Spec

- `../specs/026-large-page-notification-service.md`
