# Product Task: Permissions Model

## Problem

Screenshot extensions can feel risky if they ask for broad permissions without a clear reason.

## User

Users who want to install a screenshot extension but care about privacy, trust, and browser permission prompts.

## Value

The extension should ask only for permissions that support the core capture workflow and should make those permissions easy to explain.

## Desired Behavior

- The default extension works with a narrow, understandable permission set.
- Restricted browser pages fail clearly.
- Future optional capabilities should request optional permissions only when needed.

## Non-Goals

- No broad host permissions by default.
- No cross-browser permission model.
- No advanced iframe host-permission flow in the MVP.

## Success Criteria

- Each manifest permission has a clear product reason.
- The extension can capture normal pages after a user action.
- Unsupported pages do not start a confusing capture flow.

## Related Spec

- `../specs/002-permissions-model.md`

