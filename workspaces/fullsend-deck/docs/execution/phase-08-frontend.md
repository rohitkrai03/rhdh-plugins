# Phase 08 — RHDH frontend

Repository: `rhdh-plugins`. Expected base is the completed Phase 07 handoff
commit recorded in `state.md`.

Objective: implement global and entity-scoped Fullsend Deck NFS extensions.
Use `createFrontendPlugin`, `PageBlueprint`, `ApiBlueprint`, and lazy loading.
Use `@backstage/ui` primitives and tokens first. Direct `@mui/*` imports are
allowed only in an isolated fallback module whose missing capability and
removal condition are documented. PatternFly and legacy frontend APIs are
prohibited.

Implement Attention, Executions, Cost, and Data health with readiness-first
ordering, evidence/action detail, separate automation and work health,
consistent time ranges, explainable priority, explicit partial/heuristic data,
accessible chart alternatives, keyboard/focus correctness, and a work-first
mobile layout. Match standalone semantics, not its visual source code.

Tests: NFS exports/discovery, API client validation, global/entity filters,
loading/empty/error/partial states, keyboard and focus behavior, both themes,
responsive layout, lazy chunks, and the MUI import boundary.

Acceptance: both scopes load in the example app, every MUI exception is
reviewable, and product behavior is fixture-backed. Record handoff and leave
release conformance for Phase 09.
