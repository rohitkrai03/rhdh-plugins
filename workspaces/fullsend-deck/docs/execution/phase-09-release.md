# Phase 09 — Release and conformance

Repository: `rhdh-plugins`; compare `fullsend-deck` read-only at the standalone
commit recorded in `state.md`.

Objective: produce independently installable dynamic frontend and backend
artifacts and establish repeatable RHDH 2.1 release/conformance procedures.

Validate package builds and exports, RHDH 2.1 configuration, PostgreSQL,
authentication, permissions, scheduling, entity resolution, themes,
accessibility, and canonical fixture equivalence. Document intentional semantic
differences and generated-tool/package compatibility. Do not hide a missing
environmental integration check behind a unit test; record it explicitly.

Acceptance: publishable artifacts are generated, automated conformance passes,
installation and rollback instructions exist, and every semantic difference is
eliminated or documented. Update `state.md` with the final commits, tests,
deviations, defects, and release prerequisites.
