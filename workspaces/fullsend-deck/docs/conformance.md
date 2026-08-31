# Release conformance

## Evidence at the Phase 09 source commit

| Concern                  | Evidence                                                                                                                                                        | Result            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Dynamic frontend         | RHDH CLI 2.0.0 export; `@backstage/FrontendPlugin` feature; Module Federation manifest; no Scalprum assets                                                      | Pass              |
| Dynamic backend          | RHDH CLI 2.0.0 export; default backend-plugin entry; common contract package embedded                                                                           | Pass              |
| Publishable packages     | `yarn package-dynamic`; staged frontend and backend package registries                                                                                          | Pass              |
| OCI packaging            | Local OCI images built with RHDH CLI and Podman; dynamic-package annotations present                                                                            | Pass              |
| Contract equivalence     | `yarn conformance:standalone` validates standalone canonical work, workflow, execution, and link fixtures through the RHDH runtime schemas                      | Pass              |
| PostgreSQL               | PostgreSQL 16 round-trip plus concurrent idempotent writer test                                                                                                 | Pass              |
| Full backend             | Example backend migrated PostgreSQL, registered and completed the global ingestion schedule, and retained a completed snapshot                                  | Pass              |
| Authentication           | Health returned 200 unauthenticated; `/v1` returned 401 without credentials and 200 with a guest user token                                                     | Pass              |
| Permission path          | Authenticated request traversed `fullsend-deck.read` authorization through the permission backend                                                               | Pass              |
| Entity scope             | Owned-page `entity` deep link validates and forwards a canonical `entityRef`; API smoke returned that scope                                                     | Pass              |
| Themes and accessibility | Phase 08 interaction and browser evidence covers light/dark themes, keyboard tabs/radios/dialog, focus return, text/table chart alternatives, and 375 px layout | Pass              |
| Exact RHDH 2.1 install   | No RHDH 2.1 distribution or public community image tag was available on 2026-08-31                                                                              | Release gate open |

The registry check for `quay.io/rhdh-community/rhdh:2.1` returned `manifest
unknown`. The locally cached `next` image identified itself as RHDH 1.11.0 and
contains Backstage backend-plugin-api 1.8.0, frontend-plugin-api 0.15.1, and no
`@backstage/ui`; it is not a valid substitute for artifacts generated against
Backstage 1.54.0. An exact RHDH 2.1 installation test must therefore run when
the target distribution is supplied. This is an environmental release gate,
not a unit-test substitute.

## Intentional product differences

- RHDH mounts the API at `/api/fullsend-deck/v1`; standalone uses `/api/v1`.
- RHDH adds nullable `entityRef`, immutable `snapshotId`, and `schemaVersion`
  metadata required for Backstage entity scope and dynamic API validation.
- Parser-version strings describe repository-local implementations and are not
  compared as product status.
- RHDH delegates identity, authorization, database, scheduling, logging, and
  audit behavior to Backstage services. Standalone owns those boundaries.
- The RHDH UI reproduces semantics, not standalone visual code. It is NFS-only,
  Backstage UI-first, and currently has no MUI fallback.

All common domain fields and the canonical `run-telemetry.jsonl` /
`fullsend.work_item_id` link round-trip without semantic loss.
