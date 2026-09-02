# Entity Page Extensions

> **Status: Implemented** — Uses standard Catalog composition plus focused BUI cards.

Boost entity cards use the shared `isAiAsset` filter and supplement standard Catalog About, Relations, and TechDocs. TechDocs is the only documentation tab.

## ADDED Requirements

### Requirement: Summary Card

The Summary card MUST render only AI-specific rationale and available-model data.

#### Scenario: AI-specific summary data exists

- **WHEN** an AI asset has `spec.rationale` or `spec.models.available`
- **THEN** the Summary card renders those fields
- **AND** it does not repeat the Catalog About description
- **AND** it does not render instructions, handoff details, or RAG configuration owned by TechDocs

#### Scenario: No AI-specific summary data exists

- **WHEN** neither rationale nor available models exists
- **THEN** the Summary card does not render

### Requirement: Adoption Card

The Adoption card MUST expose validated, type-specific actions without guessing unsafe commands or download URLs.

#### Scenario: Skill command

- **WHEN** the entity type is `skill`
- **THEN** the card copies `npx skills add <metadata.name>`

#### Scenario: OCI artifact commands

- **WHEN** a validated `oci://` remote exists
- **THEN** Docker is selected by default and Podman is available as an alternative BUI tab
- **AND** copied commands do not contain the `oci://` prefix
- **AND** unsafe references containing shell metacharacters are rejected

#### Scenario: Verified GitHub repository root

- **WHEN** a valid Git source is an unambiguous GitHub repository root
- **THEN** Download ZIP links directly to the branch-agnostic GitHub zipball URL

#### Scenario: Source cannot be downloaded without guessing

- **WHEN** a Git source is a subpath, a GitLab source without an explicit archive, or another supported HTTP(S) host
- **THEN** the action is View Source
- **AND** the frontend does not guess a branch or archive path

#### Scenario: MCP runtime endpoint

- **WHEN** an MCP server provides a validated HTTP(S) remote, preferring `streamable-http`
- **THEN** the card copies that URL

#### Scenario: Clipboard result

- **WHEN** copying succeeds
- **THEN** success is announced to assistive technology and cleared after a managed timer
- **WHEN** copying fails
- **THEN** a translated inline BUI danger Alert offers Retry
- **AND** timers are cleaned up when the card unmounts

### Requirement: Asset Location Card

The Asset Location card MUST show deduplicated, validated Git and OCI asset sources.

#### Scenario: Validated sources exist

- **WHEN** an entity has Git source locations or OCI artifact remotes
- **THEN** `entity-card:boost/asset-location` shows every unique validated source
- **AND** OCI references are presented without the transport prefix
- **AND** runtime MCP endpoints are excluded

### Requirement: Current Version Card

The existing version-list extension MUST present only the entity's current annotated version.

#### Scenario: Current version annotation exists

- **WHEN** `rhdh.io/ai-asset-version` is present
- **THEN** `entity-card:boost/version-list` renders a singular Version title and that current version
- **AND** it does not fabricate releases, commits, or `spec.versions` history

### Requirement: Standard Documentation Composition

Boost MUST supplement the standard Catalog About, Relations, and TechDocs composition without registering a separate Usage tab.

#### Scenario: AI asset entity page is composed

- **WHEN** a developer views an AI asset entity page
- **THEN** standard Catalog About, Relations, and TechDocs provide general metadata, relationships, and documentation
- **AND** Boost does not register `entity-content:boost/usage`
- **AND** existing documentation permission constants and backend enforcement remain unchanged for separately scoped work
