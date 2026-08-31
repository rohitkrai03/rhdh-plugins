# Frontend architecture and design-system boundary

## Product model

Fullsend Deck is a work decision surface, not a generic infrastructure
dashboard. Attention is therefore first and ordered by explainable work-item
priority. Executions, cost, and ingestion health remain adjacent evidence
views. Workflow status never substitutes for agent status, and execution
reliability never substitutes for work readiness.

One `24h`, `7d`, or `30d` selection controls overview, execution, and cost data.
Work items are snapshot-current rather than windowed. Fullsend Deck owns the
`/fullsend-deck` page because it is a cross-entity operations dashboard. Entity
scope is expressed as a deep-link filter such as
`/fullsend-deck?entity=component:default/payments`; the validated canonical ref
is supplied to every scoped backend request. The plugin does not add a tab to
every Catalog entity.

## NFS composition

- `ApiBlueprint` installs the runtime-validating HTTP client.
- `PageBlueprint` lazily loads the global route.
- `app.packages: all` in the example app enables feature discovery.

No legacy plugin or compatibility wrapper is exported.

## Backstage UI policy

All visible primitives come from `@backstage/ui`: header, layout, cards, tabs,
tables, fields, buttons, dialogs, alerts, badges, text, and loading skeletons.
Custom CSS composes those primitives using only `--bui-*` theme tokens. It adds
responsive information layout and data bars; it does not replace the design
foundation.

There are **no MUI fallbacks**. A future fallback requires all of the following:

1. the missing capability is verified against the installed Backstage UI
   version;
2. the import is confined to `src/fallbacks/<capability>/`;
3. the module documents the UX need, accessibility behavior, and removal
   condition; and
4. the import-boundary test is narrowed only for that exact module.

PatternFly, Material UI v4, direct `@mui/*` outside an approved fallback,
`@backstage/core-components`, `createPlugin`, and
`createRoutableExtension` remain prohibited.

## Accessibility and responsive behavior

Backstage UI supplies keyboard semantics for tabs, time-window radio buttons,
tables, and the evidence dialog. Deck explicitly returns focus to the evidence
trigger after Escape or close. The cost graphic has an accessible textual
summary and a full table alternative. Status is always written as text and
does not depend on color. Mobile layouts collapse the attention metrics and
work facts before secondary evidence, keeping the human queue first.
