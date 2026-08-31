# Fullsend Deck RHDH execution program

This directory is the persistent handoff for phases 06–09 of Fullsend Deck.
Chat history is never an implementation dependency. The standalone source
commit used for a port must be recorded in `state.md`.

## Required reading order

1. repository `AGENTS.md` files;
2. this document;
3. `state.md`;
4. the assigned phase document; and
5. `contracts.md`.

## Locked decisions

- The source lives in `rhdh-plugins/workspaces/fullsend-deck` and deploys
  without a standalone Deck service.
- Runtime Fullsend behavior and current contracts override stale design docs.
- No unpublished cross-repository dependencies are allowed. Deliberate source
  duplication is acceptable until at least two meaningful releases exist.
- The product is read-only, artifact-first, and supports global and entity
  scopes.
- `run-telemetry.jsonl` and `fullsend.work_item_id` are canonical.
- Readiness and execution reliability are independent dimensions.
- Frontend code is NFS-only. It uses `@backstage/ui` first; MUI is allowed only
  inside a documented fallback module for a capability Backstage UI lacks.
- PatternFly, legacy frontend wiring, and copied plugin workspaces are banned.
- Generated Backstage dependency versions are the initial source of truth.

Every phase records verification, the result commit, deviations, defects, and
next-phase prerequisites in `state.md`.
