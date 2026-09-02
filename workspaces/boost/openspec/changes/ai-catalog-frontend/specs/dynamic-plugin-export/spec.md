# Dynamic Plugin Export

> **Status: Draft** — Pre-implementation specification. Subject to change during implementation.

Package the AI Catalog frontend plugin for RHDH dynamic plugin deployment and register it in the overlays repo for OCI image builds. Boost is NFS-only (`createFrontendPlugin` as default export) — no Scalprum, no `./alpha`, no legacy entry point.

## ADDED Requirements

### Requirement: Plugin Export Configuration

The plugin MUST be configured for `rhdh-cli plugin export`.

#### Scenario: export-dynamic script exists

- **GIVEN** the `plugins/boost/package.json`
- **WHEN** a developer runs `yarn export-dynamic`
- **THEN** `rhdh-cli plugin export` runs and produces output in `dist-dynamic/`

#### Scenario: dist-dynamic included in package files

- **GIVEN** the plugin's `package.json` `files` array
- **THEN** it includes `dist-dynamic/*.*` and `dist-dynamic/dist/**`
- **AND** the published package contains the dynamic plugin bundle

### Requirement: Default Extension Configuration

A default `app-config.dynamic.yaml` MUST provide sensible extension defaults for deployers.

#### Scenario: Page route configured

- **GIVEN** the `app-config.dynamic.yaml` in `plugins/boost/`
- **THEN** it configures `page:boost/ai-catalog` with the `/ai-catalog` path

#### Scenario: Entity cards configured

- **GIVEN** the `app-config.dynamic.yaml`
- **THEN** it lists `entity-card:boost/summary`, `entity-card:boost/adoption`, `entity-card:boost/asset-location`, and `entity-card:boost/version-list` under `app.extensions`
- **AND** each card has a default entity filter matching AI asset kinds
- **AND** it does not configure the removed `entity-content:boost/usage` extension

### Requirement: Overlay Registration

The plugin MUST be registered in the overlays repo for automated OCI image builds.

#### Scenario: Plugin added to rhdh-plugin-export-overlays

- **GIVEN** the `redhat-developer/rhdh-plugin-export-overlays` repository
- **WHEN** a PR adds the boost frontend plugin entry
- **THEN** the CI pipeline builds an OCI image for the plugin
- **AND** the image is published to the configured registry

#### Scenario: Image reference updated in workspace

- **GIVEN** the OCI image is published
- **WHEN** the workspace `dynamic-plugins-image-reference.yaml` is updated
- **THEN** it contains the OCI image reference for the boost frontend plugin
- **AND** the reference follows the same format as existing backend plugin entries

### Requirement: Plugin Loads in RHDH

The OCI-packaged plugin MUST load correctly in an RHDH deployment.

#### Scenario: Plugin loads with Module Federation

- **GIVEN** an RHDH deployment with `ENABLE_STANDARD_MODULE_FEDERATION=true`
- **AND** the boost frontend dynamic plugin is installed via `dynamic-plugins.yaml` with `enabled: true`
- **WHEN** a user navigates to the RHDH instance
- **THEN** the "AI Catalog" nav item appears in the sidebar
- **AND** navigating to `/ai-catalog` renders the browse page

#### Scenario: Entity page extensions mount

- **GIVEN** the boost frontend dynamic plugin is installed
- **WHEN** a user navigates to a catalog entity page for an AI asset
- **THEN** the Summary, Adoption, Asset Location, and current Version cards render when their required entity data exists
- **AND** standard TechDocs remains the only documentation tab

#### Scenario: Extensions absent on non-AI entities

- **GIVEN** the boost frontend dynamic plugin is installed
- **WHEN** a user navigates to a catalog entity page for a non-AI entity (e.g., a regular Component)
- **THEN** no boost entity cards or tabs are rendered

### Requirement: Adopter Overrides

Deployers MUST be able to customize the plugin via `app.extensions` in `app-config.yaml`.

#### Scenario: Disable an entity card

- **GIVEN** the deployer sets `entity-card:boost/adoption: false` in `app.extensions`
- **WHEN** a user views an AI asset entity page
- **THEN** the Download/Adopt Card is not rendered
- **AND** other boost cards still render

#### Scenario: Change entity filter on a card

- **GIVEN** the deployer sets `entity-card:boost/summary` with a `config.filter` that excludes AI asset kinds
- **WHEN** a user views an AiResource entity page
- **THEN** the summary card is not rendered (filter excludes AiResource)

#### Scenario: Disable the page

- **GIVEN** the deployer sets `page:boost/ai-catalog: false` in `app.extensions`
- **WHEN** a user views the RHDH sidebar
- **THEN** the "AI Catalog" nav item is not present
- **AND** navigating to `/ai-catalog` shows a 404 or redirects
