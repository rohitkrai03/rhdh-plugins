# Program state

## Baseline

- RHDH repository base: `f715573e5d1afc30443e1f25787b33312946535b`.
- Standalone stable source: `cb59073eab6e76822d16c82bf8b6a2fec418b482`
  (Phase 05 handoff; verify before every deliberate port).

## Phase status

| Phase             | Status      | Result commit                              | Verification                                                                             |
| ----------------- | ----------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 06 — CLI scaffold | Complete    | `9059a0966ed16762e6356a6a3e4467aa1424853f` | immutable install; Backstage info; typecheck; lint; 10 tests; build; live initialization |
| 07 — backend      | Not started | —                                          | —                                                                                        |
| 08 — frontend     | Not started | —                                          | —                                                                                        |
| 09 — release      | Not started | —                                          | —                                                                                        |

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

## Next prerequisite

Begin Phase 07 from the Phase 06 handoff commit. Re-read the backend phase and
contracts, verify the actual scaffold, and port only behavior from standalone
commit `cb59073eab6e76822d16c82bf8b6a2fec418b482` without adding a cross-repository
dependency.
