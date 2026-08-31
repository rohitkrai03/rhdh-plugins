# Phase 06 — Backstage CLI scaffold

## Repository and base

- Repository: `rhdh-plugins`
- Expected base: `f715573e5d1afc30443e1f25787b33312946535b`

## Objective

Create a version-audited, CLI-generated, NFS-only workspace before product
implementation.

## Generator record

- Host: Node 24.5.0; repository Yarn 4.17.1; Python 3.13.5.
- `@backstage/create-app`: 0.9.1 (current on 2026-08-31).
- Generated Backstage release: 1.54.0.
- Generated `@backstage/cli`: `^0.36.5`; resolved CLI version is recorded by
  the lockfile.
- Command: `npx @backstage/create-app@0.9.1` from `workspaces`.
- Answer: app name `fullsend-deck`; npm confirmation `y`.
- Commands from the generated workspace:
  - `yarn backstage-cli new --select frontend-plugin` → ID `fullsend-deck`;
  - `yarn backstage-cli new --select backend-plugin` → ID `fullsend-deck`;
  - `yarn backstage-cli new --select plugin-common-library` → ID
    `fullsend-deck`.

The generated frontend template already used `createFrontendPlugin` and
`PageBlueprint`; no legacy replacement was necessary. Generated feature
discovery is enabled through `app.packages: all`.

## Deliberate post-generation adaptation

- Yarn was changed with `yarn set version 4.17.1` to match repository policy.
- Published package names use `@red-hat-developer-hub`, Apache-2.0 licensing,
  repository fields, package-family metadata, and NFS Scalprum exposure.
- Changesets configuration, catalog metadata, workspace labels, ownership, and
  durable execution documentation were added.
- No manifest, source tree, dependency version, or lockfile was copied from an
  existing RHDH workspace.

## Non-goals

No product domain logic, ingestion, custom page, or production deployment is
implemented in this phase.

## Verification and acceptance

An immutable install, Backstage version check, typecheck, build, tests, and a
load check for both generated plugins must pass. The adapted scaffold is
committed separately from Phase 07 product code.
