# Product Tasks

Product tasks are the product-side input for each meaningful change.

Flow:

```text
product task -> spec -> implementation -> tests -> changelog
```

The product task describes the user problem, value, expected behavior, non-goals, and success criteria. The corresponding spec translates that product input into technical requirements, architecture, edge cases, and test coverage.

## Template

```md
# Product Task: Feature Name

## Problem

What user problem are we solving?

## User

Who has this problem?

## Value

What benefit does the user get?

## Desired Behavior

How should the feature behave from the user's point of view?

## Non-Goals

What are we intentionally not solving now?

## Success Criteria

How do we know this worked?

## Related Spec

- `../specs/000-feature-name.md`
```

