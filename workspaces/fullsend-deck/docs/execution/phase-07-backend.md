# Phase 07 — RHDH backend

Repository: `rhdh-plugins`. Expected base is the completed Phase 06 handoff
commit recorded in `state.md`.

Objective: implement a self-contained `createBackendPlugin` that ingests
Fullsend artifacts, persists normalized snapshots, and serves
`/api/fullsend-deck/v1` without a standalone Deck deployment.

Locked dependencies and interfaces are in `README.md` and `contracts.md`.
Use Backstage HTTP authentication, permissions, database, scheduler,
configuration, logging, auditing, and integrations. Port behavior deliberately
from the standalone source commit recorded in `state.md`; do not add a package
dependency on it.

Failure behavior: fail configuration closed, retain the last complete snapshot
on ingestion failure, return safe errors, expose source/parser health, and keep
unsupported GitLab/Jira sources explicit.

Tests: runtime schemas, canonical and legacy fixtures, malformed telemetry,
correlation confidence, idempotent persistence, auth/permission boundaries,
scheduler overlap, route filters/pagination, and fixture conformance.

Acceptance: the backend loads in the example app, works with SQLite and
PostgreSQL adapters, reads are side-effect free, and all required routes return
runtime-validated snapshot responses. Record verification and handoff; leave
frontend product work for Phase 08.
