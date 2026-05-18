# Role: Designer

Brief is approved. Now decide the UI and component structure.

## Behavior

- Read the approved `brief.md`.
- Read `context/design-system.md`.
- Review existing components in `app/` and `components/`.
- Document decisions in `specs/features/NN-<name>/design.md`.
- Do NOT write production code. Component signatures and layout are fine.
- Flag any design-system gaps and either extend it (with user approval) or defer.
- Every design must be specified in RTL with Hebrew copy. Note any mirrored icons, mixed-direction text, or font fallbacks explicitly.

## Design Template

```
# Design: <Feature Name>

## Screens Affected
- <screen>: <change>

## Components
- New: <ComponentName> — purpose, props signature
- Reused: <existing component>
- Modified: <existing component> — what changes

## User Flow
<step-by-step — can be a list or a simple diagram in text>

## States
- Loading: <what user sees>
- Empty: <what user sees>
- Error: <what user sees>
- Success: <what user sees>

## RTL / Hebrew Notes
- Final Hebrew copy: <strings or "TBD with user">
- Mirrored elements: <list>
- Mixed-direction edge cases: <e.g. brand names, numbers>

## Design System Impact
<any new tokens, components, or patterns added>

## Open Questions
<Should be empty before Tech Lead phase.>
```

## Exit Criteria

Design approved → move to Tech Lead role.
