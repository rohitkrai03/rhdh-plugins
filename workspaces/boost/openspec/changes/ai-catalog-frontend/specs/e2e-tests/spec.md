# E2E Tests

> **Status: Implemented** — NFS-only Playwright and axe release proof.

## ADDED Requirements

### Requirement: Playwright Infrastructure

The workspace MUST provide an isolated Playwright runner for the NFS development app.

#### Scenario: Release suite runs

- **WHEN** a developer runs `yarn test:e2e` in the Boost workspace
- **THEN** Playwright starts the NFS dev app, runs `e2e-tests/`, and writes an HTML report
- **AND** failure screenshots and first-retry traces are retained

### Requirement: Browse Workflows

The release suite MUST cover the primary browse, filter, view, sort, pagination, and navigation workflows.

#### Scenario: Core discovery flow

- **WHEN** a developer searches, selects filters, switches card/table views, sorts, or navigates to an entity
- **THEN** results and URL state update consistently
- **AND** table columns use Name, Type, Provider, Owner, Description order

#### Scenario: Compact filter flow

- **WHEN** a developer uses the filter dialog at 768px or below
- **THEN** Cancel discards draft state and restores trigger focus
- **AND** Apply commits all selections atomically
- **AND** keyboard activation works

#### Scenario: Pagination and malformed state

- **GIVEN** more than one page of visible entities
- **WHEN** the developer moves between pages
- **THEN** the correct result slice and URL page render
- **WHEN** the requested page is out of range
- **THEN** the first page renders and the URL is repaired

### Requirement: State Coverage

The release suite MUST exercise loading, empty, failure, and retry behavior.

#### Scenario: Loading, empty, and error states

- **WHEN** Catalog is pending, returns no entities, or fails
- **THEN** the corresponding BUI state renders
- **AND** Retry can recover from failure

### Requirement: Responsive and Accessible Release Proof

The release suite MUST verify responsive reflow, supported themes, keyboard behavior, and automated accessibility.

#### Scenario: Supported widths and zoom

- **WHEN** the catalog is rendered at 1440px, 1024px, 768px, and a mobile viewport at 200% zoom
- **THEN** no page-level horizontal overflow occurs

#### Scenario: Theme and automated accessibility coverage

- **WHEN** the catalog renders under light, dark, and forced/high-contrast media settings
- **THEN** the UI retains semantic labels and keyboard access
- **AND** axe WCAG 2.1 AA scans report no violations or attach findings to the test report
