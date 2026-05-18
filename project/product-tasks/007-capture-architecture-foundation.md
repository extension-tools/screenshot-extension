# Product Task: Capture Architecture Foundation

## Problem

The MVP capture flow works, but too many responsibilities live in one service-worker file. This makes it risky to add DOM edge-case handling such as fixed and sticky normalization, lazy-load warmup, canvas tiling, and better cleanup.

## User

The product team and engineering work benefit first, because future capture fixes become easier to specify, implement, and test. End users benefit through faster, safer improvements to capture reliability.

## Value

The capture system should have clear component boundaries before we add more page-specific behavior.

## Desired Behavior

- The extension keeps the same MVP user behavior.
- The code separates command orchestration, capability checks, page probing, position planning, stepping, stitching, saving, and cleanup.
- The next fixed/sticky iteration can plug into the capture flow without turning `worker.js` into a larger mixed-responsibility file.

## Non-Goals

- No fixed/sticky duplicate fix in this task.
- No lazy-load warmup in this task.
- No canvas tiling in this task.
- No bundled build step.

## Success Criteria

- `worker.js` becomes a small command router.
- Capture modules live under `code/capture/`.
- Existing validation and visual regression checks pass.
- Architecture docs match the actual code structure.

## Related Spec

- `../specs/007-capture-architecture-foundation.md`

