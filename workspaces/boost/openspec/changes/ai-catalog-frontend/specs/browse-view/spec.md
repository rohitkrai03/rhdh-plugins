# Browse View

> **Status: Implemented** — Reconciled with the 2.1 prototype using current BUI components.

The AI Catalog browse page provides marketplace-style discovery for AI assets visible through the Backstage Software Catalog.

## ADDED Requirements

### Requirement: BUI-First Card and Table Display

The page MUST use the prototype for information hierarchy and interactions while using `@backstage/ui` 0.16.0 for component implementation, semantics, and theming.

#### Scenario: Browse page loads with assets

- **WHEN** the developer navigates to `/ai-catalog`
- **THEN** the page displays a BUI card grid of AI asset entities returned by the Catalog API
- **AND** each card shows Type, name, description, tags, linked owner, and provider
- **AND** Type is a static BUI Badge with an icon/name and a color accent, so color is not the only distinction
- **AND** the generic translated subtitle does not enumerate a fixed set of types

#### Scenario: Table view

- **WHEN** the developer selects table view
- **THEN** columns appear in the order Name, Type, Provider, Owner, Description
- **AND** names and owners link to their Catalog entity pages

#### Scenario: Responsive layout

- **WHEN** available width changes
- **THEN** the BUI grid renders 1, 2, or 4 columns at its registered breakpoints
- **AND** it is not capped at two columns
- **AND** the page does not create horizontal page-level overflow at 200% zoom

### Requirement: Supported Taxonomy

The plugin MUST recognize every supported AI Catalog kind/type pair without changing stored Catalog data.

#### Scenario: Catalog query recognizes supported assets

- **WHEN** Catalog entities are loaded
- **THEN** these kind/type pairs are recognized case-insensitively:
  - `AiResource`: `skill`, `rule`, `agent`, `skill-bundle`
  - `AiModelServerAPI`: `ai-model-server`
  - `API`: `mcp-server`
  - `Resource`: `ai-model`, `ai-tool`, `vector-store`
- **AND** presentation casing is normalized without modifying stored Catalog data
- **AND** standalone `Resource/ai-model` entities are shown when supplied by any provider

### Requirement: URL-Backed Search, Filters, and Pagination

The page MUST persist valid discovery state in the URL and repair invalid state without adding history entries.

#### Scenario: Search filters assets

- **WHEN** the developer types a keyword
- **THEN** cards are filtered within the 300ms debounce using name, title, description, and tags
- **AND** the search term is persisted as `q` in the URL

#### Scenario: Desktop filters

- **WHEN** the viewport is wider than 768px
- **THEN** the registered filters render in a sticky filter column
- **AND** filters combine in AND logic
- **AND** Type options contain only types present in Catalog entities visible to the current user, in canonical order

#### Scenario: Compact filters apply atomically

- **WHEN** the viewport is 768px or narrower
- **THEN** a Filters button opens a BUI Dialog containing draft selections
- **AND** Apply updates every registered filter URL parameter atomically, resets page, and closes the dialog
- **AND** Cancel or dismiss discards the draft
- **AND** focus returns to the Filters button

#### Scenario: Invalid URL state is repaired

- **WHEN** `view` is not `grid` or `table`
- **THEN** grid renders and the invalid parameter is removed with history replacement
- **WHEN** `pageSize` is not 10, 20, or 50
- **THEN** 20 is used and the invalid parameter is removed with history replacement
- **WHEN** `page` is malformed, negative, or outside the current result range
- **THEN** page zero renders and the invalid parameter is removed with history replacement

### Requirement: Loading, Empty, and Error States

The page MUST provide responsive loading, empty, filtered-empty, and recoverable error states.

#### Scenario: Loading state

- **WHEN** the Catalog request is in progress
- **THEN** skeletons reflect the actual registered filter count
- **AND** card skeletons use the same responsive 1/2/4-column composition as loaded cards

#### Scenario: Empty and error states

- **WHEN** no assets match active filters
- **THEN** a translated filtered-empty state offers Clear filters
- **WHEN** no assets exist
- **THEN** a translated catalog-empty state is shown
- **WHEN** the Catalog request fails
- **THEN** a translated error state offers Retry without crashing the RHDH shell

### Requirement: Catalog Authorization

Browse results and derived filter choices MUST use only entities returned by the standard authorized Catalog query.

#### Scenario: Visible entities govern browse data

- **WHEN** the Catalog applies `catalog.entity.read`, including a conditional decision
- **THEN** the page, cards, counts, and Type options use only the returned entities
- **AND** no custom catalog-card permission is required
