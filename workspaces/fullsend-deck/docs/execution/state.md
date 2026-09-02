# Program state

## Baseline

- RHDH repository base: `f715573e5d1afc30443e1f25787b33312946535b`.
- Standalone stable source: `c6222b2a007ffa5c79265f8b206360005ab6d15c`
  (Phase 05 handoff; verify before every deliberate port).

## Phase status

| Phase             | Status      | Result commit                              | Verification                                                                                    |
| ----------------- | ----------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 06 — CLI scaffold | Complete    | `04508b9b63286b31001902358327ef0e607a0091` | immutable install; Backstage info; typecheck; lint; 10 tests; build; live initialization        |
| 07 — backend      | Complete    | `b305d2f067673583b77fce334372931af5f4da81` | immutable install; config; typecheck; lint; 20 product tests; builds; authenticated live smoke  |
| 08 — frontend     | Complete    | `b2b6a07c88a7ec107c1183ba81a242004c2b4544` | immutable install; typecheck; lint; 11 frontend tests; 32 workspace tests; builds; browser QA   |
| 09 — release      | Implemented | `5f1e0c34cebd924bbddbdfb8d10f6ffd4f8d1c89` | immutable install; version audit; 34 tests; PostgreSQL; builds; dynamic/OCI and contract checks |
| Runtime audit     | Complete    | `54638d42b04be6062c8a87573c0ce747c8b474de` | 35 tests; strict typecheck; lint; builds; dynamic packages; contract checks                     |

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
  directly depends on neither MUI nor PatternFly. Its browser console therefore
  inherits `findDOMNode` warnings from the generated app shell, but no warning
  originates in a Fullsend component.
- The exact RHDH 2.1 distribution is not available in this environment. The
  public community `2.1` image tag returned `manifest unknown` on 2026-08-31;
  the cached `next` image reports RHDH 1.11.0 and lacks this workspace's
  Backstage UI/runtime versions. Exact 2.1 installation remains an explicit
  release gate in `docs/conformance.md`.

## Phase 07 handoff

- Stable behavior was ported deliberately from standalone commit
  `c6222b2a007ffa5c79265f8b206360005ab6d15c`; no cross-repository package or
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

## Phase 08 handoff

- The generated TODO implementation was deleted. `ApiBlueprint` installs a
  runtime-validating client and `PageBlueprint` lazily loads the owned
  `/fullsend-deck` route. Phase 09 removed the earlier Catalog entity tab after
  the product direction was clarified: entity context is an optional validated
  deep-link filter on the owned page.
- Attention, Executions, Cost, and Data health use one time-window control and
  keep readiness, automation, checks, workflow conclusion, agent exit,
  correlation confidence, cost, freshness, and source coverage independently
  visible.
- Every product primitive uses `@backstage/ui`. Custom CSS uses `--bui-*`
  tokens for responsive composition. There are zero MUI fallbacks; a test bans
  direct MUI, Material UI v4, PatternFly, core-components, and legacy plugin
  wiring in production source.
- Interaction tests cover runtime API validation, safe errors, global/entity
  scope, loading/empty/partial/error states, time-window reloads, search,
  separate execution outcomes, canonical correlation, evidence dialog Escape,
  explicit trigger-focus restoration, and fail-closed malformed entity refs.
- Verification passed: immutable install, formatting, full typecheck, lint, 4
  frontend suites / 11 tests, 12 workspace suites / 32 tests, frontend package
  build, and full workspace build. Before Phase 09 removed the entity
  extension, the global and entity lazy route chunks were each approximately
  17.3 kB uncompressed in the example production build.
- Live browser QA exercised global and entity-filtered page modes, guest
  authentication, permission-backed reads, all tabs, the time window, dark
  mode, and a 375 px work-first layout without horizontal overflow. The
  entity-filtered request issued `component:default/example-website` filters to
  the backend.
- The combined `backstage-cli repo start` development coordinator hit an
  upstream `DevDataStore.load` IPC timeout. Starting the generated frontend and
  backend packages independently worked and supplied the live acceptance run;
  production `build:all` also passed.

## Phase 09 handoff

- Phase commit `5f1e0c34cebd924bbddbdfb8d10f6ffd4f8d1c89`
  exports independent NFS frontend and backend dynamic packages. The backend
  embeds the common contract package, so installation requires no unpublished
  workspace or cross-repository dependency.
- `@red-hat-developer-hub/cli` 2.0.0 with `ts-morph` 28.0.0 generated the
  exports. Frontend metadata declares `@backstage/FrontendPlugin`, contains the
  Module Federation manifest and no Scalprum assets. Both artifacts declare
  Backstage 1.54.0 support.
- The current CLI has no `versions:check` command. A
  `versions:bump --release 1.54.0 --skip-install` audit traversed the generated
  dependency set; the generator-selected package ranges remain the source of
  truth. Immutable install passed with the previously recorded upstream peer
  warnings.
- Verification passed: full typecheck, lint, formatting, 13 suites / 34 tests,
  full build, publishable-directory packaging, dynamic-artifact validation, and
  standalone fixture equivalence for work, workflow, execution, and canonical
  link records.
- PostgreSQL 16 passed schema migration, round-trip persistence, and concurrent
  idempotent snapshot writes. A full example backend registered and completed
  global ingestion; unauthenticated API returned 401 while a guest-authenticated
  permission-backed entity request returned schema-valid 200 data.
- Final local OCI validation images are
  `localhost/fullsend-deck-frontend:0.1.0` at
  `98912152469569aa40a8908b085daae8df4c6622667cef1d693aca13db3bffa8`
  (7,205,118 bytes) and `localhost/fullsend-deck-backend:0.1.0` at
  `bf2aa2182eef41a20333c68006cc94c789fe525422501298bc403b3dde135e21`
  (10,577,088 bytes). Production publishing must use reviewed immutable
  registry tags or digests.
- Release configuration, install, canary, permissions, and rollback procedures
  are in `docs/release.md`; intentional differences and exact evidence are in
  `docs/conformance.md`.

## Post-program runtime audit

- **Implementation commit:** `54638d42b04be6062c8a87573c0ce747c8b474de`.
- **Correctness fixes:** successful reprocessing now clears every historical
  quarantine record for the artifact. Collection failures retain the configured
  source identity. Overall sync health is `failed` only when every configured
  source fails and `partial` when another source remains usable.
- **Source scope:** GitLab and Jira are not configurable RHDH sources yet. They
  no longer appear as synthetic warnings that permanently degrade a healthy
  GitHub- or filesystem-only installation.
- **Test reliability:** the full coverage suite is serialized because native
  SQLite workers were occasionally force-terminated during parallel teardown.
  Open-handle detection found no retained handle in the serial run.
- **Verification:** formatting, strict typecheck, lint, 12 suites / 35 tests,
  full builds, standalone fixture equivalence, frontend/backend dynamic export
  and packaging, and dynamic artifact validation passed.
- **Deviation:** the PostgreSQL test remains opt-in and was not repeated in this
  audit; its Phase 09 PostgreSQL 16 evidence remains current. Exact RHDH 2.1
  installation remains the external release gate.

## Next prerequisite

Supply the exact RHDH 2.1 distribution or supported image, publish the two OCI
artifacts to a test registry, and execute the documented canary checklist. Do
not declare RHDH 2.1 compatibility until that external gate passes. After two
meaningful standalone and plugin releases, reconsider shared-package
extraction using actual contract churn; do not introduce it earlier.

## Pending local-test configuration update

- **Status:** Implemented on `codex/fullsend-deck-rhdh-review`; awaiting review.
- **Change:** The example app now configures the same GitHub repositories as
  standalone `dashboard.yaml`: `redhat-developer/rhdh-agentic` and
  `redhat-developer/rhdh-plugins`.
- **Verification:** The Backstage config check passed with a placeholder token,
  and a YAML comparison confirmed exact repository-list parity with the
  standalone app.
- **Runtime prerequisite:** Restart the example backend with a real
  `GITHUB_TOKEN`. The isolated backend used for the earlier empty-state
  diagnosis was started with a placeholder token and cannot ingest GitHub.

## Pending navigation and standalone-parity review

- **Status:** Implemented on `codex/fullsend-deck-rhdh-review`; awaiting visual
  review.
- **Native page chrome:** Plugin metadata supplies the Fullsend title and 24 px
  icon. The owned `PageBlueprint` inherits those values, and four
  `SubPageBlueprint` extensions let Backstage render the standard page header
  and route-backed Attention, Executions, Cost, and Data health tabs. The
  earlier custom product header and in-surface tabs were removed; no custom
  example-app navigation implementation was added.
- **Deep-link continuity:** A narrow `PageBlueprint.makeWithOverrides` wrapper
  delegates to the original Backstage page factory, capturing only root query
  scope before Backstage's default index redirect. A plugin wrapper then keeps
  validated entity and time-window scope across subpage links. The frontend
  declares the generator-selected `react-router-dom` `^6.30.2` range as a peer
  dependency, as required for a Backstage frontend plugin; no other dependency
  version was introduced.
- **Empty ingestion fix:** A source-less snapshot now displays a prominent
  warning that zero values are not healthy activity. Attention says that no
  work has been ingested, while Data health provides the source-configuration
  empty state. Tests cover all three messages.
- **Standalone comparison:** The read-only visual and structural reference was
  standalone commit `8aa5cdb8ac4953cc8b6ec83d69d4285c92442516`.
  Attention now uses the standalone readiness groups, repository/readiness
  filters, compact work rows, and readiness rail. Executions use the same
  outcome separation and agent distribution. Cost restores the ledger hero
  and repository/agent/model breakdowns. Data health again separates work
  health from automation reliability and uses a compact source-coverage list.
- **Design-system boundary:** Product source still uses NFS and `@backstage/ui`
  only. There are no MUI, Material UI v4, PatternFly, core-components, legacy
  frontend, `.bui-*`, or `.pf-*` production imports/selectors. The authored CSS
  module is 7,509 bytes and is limited to product layout, readiness rails, the
  cost-ledger signature, density, and responsive behavior; color and spacing
  come from Backstage UI semantic tokens.
- **Verification:** Immutable install, formatting, strict typecheck, full lint,
  13 suites / 45 tests (plus one opt-in PostgreSQL test skipped), and the full
  workspace build passed. The 5 frontend suites / 21 tests cover inherited page
  chrome, four attached subpages, root redirects, remounted tab routes,
  entity/window continuity, and existing behavior. A guest-authenticated
  browser run against the generated app on 3000/7007 confirmed one Fullsend
  title, the four standard tabs, and preserved
  `component:default/example-website` plus `24h` scope through Cost and Data
  health. The only console warning came from the generated app's existing
  Material UI sign-in shell, not Fullsend source.
- **Intentional difference:** The plugin keeps the Backstage application shell
  and an owned page composed from Backstage's default page and subpage
  blueprints. It does not copy the standalone sidebar, typography, route shell,
  or visual component source.
- **Runtime prerequisite:** Restart the example backend after supplying a real
  `GITHUB_TOKEN`; the committed repository list is now non-empty, but local
  credentials remain deliberately external to source control.

## Pending local startup reliability fix

- **Status:** Implemented on `codex/fullsend-deck-rhdh-review`; awaiting review.
- **Observed failure:** `backstage-cli repo start` spawned a backend listener on
  port 7007 but never reached readiness. Both Catalog and Fullsend Deck routes
  returned 404 while `/.backstage/health/v1/readiness` returned 503 with
  `Backend has not started yet`; the frontend process also exited.
- **Change:** The root `yarn start` now launches the CLI-generated `app` and
  `backend` package start commands independently through Yarn workspaces. The
  individual scripts remain available as `yarn start:frontend` and
  `yarn start:backend`.
- **Native runtime guard:** The root start command validates `better-sqlite3`
  before launching either process. This prevents a Node 22/24 ABI mismatch from
  producing a half-started backend and tells the operator to rebuild the native
  package after switching Node majors. The declared and CI-tested support range
  remains Node 22 or 24; final local verification used Node 24.20.0.
- **Failure clarity:** Unstructured 404 and 503 Fullsend API responses now
  explain that the backend plugin is unavailable or still starting instead of
  reporting only a status number. Structured backend errors remain unchanged.
- **Initial ingestion:** GitHub repositories and each repository's discovery
  requests are collected concurrently. Artifact ZIP downloads use a bounded
  concurrency of four and retain API order, reducing the first snapshot from a
  potentially serial four-minute run without making output nondeterministic.
  While that first snapshot is pending, the NFS page presents an informational
  preparation state and retries automatically every five seconds.
- **Verification:** Node 24.20.0 loaded the native SQLite dependency, strict
  typecheck and lint passed, and the full workspace build completed. The test
  suite passed 12 suites / 41 tests with one opt-in PostgreSQL test skipped. A
  live default-config run reached readiness, loaded 9 Catalog entities, and
  returned a schema-valid Fullsend snapshot containing 241 work items and 36
  agent executions; sync health was truthfully `partial`. No commit or push was
  created.
