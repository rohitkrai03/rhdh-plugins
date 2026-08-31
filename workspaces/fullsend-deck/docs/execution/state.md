# Program state

## Baseline

- RHDH repository base: `f715573e5d1afc30443e1f25787b33312946535b`.
- Standalone stable source: `cb59073eab6e76822d16c82bf8b6a2fec418b482`
  (Phase 05 handoff; verify before every deliberate port).

## Phase status

| Phase             | Status      | Result commit                              | Verification                                                                                   |
| ----------------- | ----------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 06 — CLI scaffold | Complete    | `9059a0966ed16762e6356a6a3e4467aa1424853f` | immutable install; Backstage info; typecheck; lint; 10 tests; build; live initialization       |
| 07 — backend      | Complete    | `d3b6ffda15b4b0e3ace9a2827efa61b9394618f3` | immutable install; config; typecheck; lint; 20 product tests; builds; authenticated live smoke |
| 08 — frontend     | Not started | —                                          | —                                                                                              |
| 09 — release      | Not started | —                                          | —                                                                                              |

## Phase 06 handoff

- Official generator and template versions, prompts, and adaptations are in
  `phase-06-scaffold.md`. Backstage reports release 1.54.0 and CLI 0.36.5.
- `yarn install --immutable`, `yarn tsc:full`, `yarn lint:all`,
  `yarn test --watch=false` (6 suites / 10 tests), and `yarn build:all` passed.
- A live backend run logged `fullsend-deck` in the initialized plugin set. An
  unauthenticated request reached the mounted plugin and correctly returned 401.
- CLI 0.36.5 no longer provides `versions:check`; `backstage-cli info` was used
  to verify one coherent generated Backstage 1.54.0 release line.

## Current deviations and defects

- The immutable install emits peer-range warnings from the current upstream
  generator, including its React testing-library and Material UI compatibility
  ranges. No generated dependency range was silently overridden.
- The generated NFS example app contains its upstream Material UI navigation
  implementation. The Fullsend frontend plugin package itself is NFS-only and
  directly depends on neither MUI nor PatternFly. Phase 08 must remove all
  generated placeholder UI and enforce the product import boundary.
- A live PostgreSQL instance and an RHDH 2.1 distribution are not part of this
  scaffold environment; Phase 09 owns those integration checks.

## Phase 07 handoff

- Stable behavior was ported deliberately from standalone commit
  `cb59073eab6e76822d16c82bf8b6a2fec418b482`; no cross-repository package or
  runtime dependency was introduced.
- The common package owns runtime schemas, fixture contracts, and the
  `fullsend-deck.read` permission. Every versioned response contains schema and
  immutable snapshot metadata plus partial-data diagnostics.
- The backend reads GitHub through Backstage integrations (token and GitHub App
  credentials) and optional filesystem exports. Canonical OTLP JSONL precedes
  three legacy fallbacks. Explicit and heuristic correlations remain labelled.
- Backstage database transactions provide idempotent completed snapshots,
  rollback, and parser-versioned quarantine. The global scheduler prevents
  overlapping ingestion across replicas. API reads have no provider side
  effects.
- `/api/fullsend-deck/v1` exposes overview, work items/detail, executions, and
  sync status. Both user and service credentials require permission; every
  allowed or rejected read is audited. `/health` alone is unauthenticated.
- Verification passed: immutable install, configuration schema check, full
  typecheck, lint, 2 common and 18 backend tests, 11 workspace suites / 25 tests,
  package builds, and full workspace build. A live example backend migrated,
  scheduled and completed an empty snapshot, then returned a validated 200
  overview through guest auth and the permission backend.
- GitHub HTTP/ZIP behavior is fixture-tested but was not pointed at a live
  repository. SQLite runs in tests and the example app; live PostgreSQL remains
  a Phase 09 conformance check.

## Next prerequisite

Begin Phase 08 from the Phase 07 handoff commit. Re-read the frontend phase and
contracts, inspect the actual API, delete all generated TODO UI, and keep the
frontend NFS-only. Use Backstage UI first, enforce direct MUI/PatternFly/legacy
import bans, and provide both global and entity-scoped lazy extensions.
