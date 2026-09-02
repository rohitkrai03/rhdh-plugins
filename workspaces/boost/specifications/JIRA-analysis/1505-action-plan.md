# AI Catalog Frontend — Release-Readiness Plan

**Reviewed:** 2026-09-01  
**UX source of truth:** https://agentic-524bde.pages.redhat.com/2.1.0/skill-marketplace/skills

## The simple version

The frontend has a sound foundation and does not need a rewrite. Release
readiness is three focused passes:

1. **Correctness:** fix the confirmed frontend bugs and tighten a few internal
   contracts.
2. **UX reconciliation:** make browse and entity pages match the accepted parts
   of the live 2.1 prototype.
3. **Release proof:** close the test, accessibility, responsive, and performance
   gaps.

Permissions, backend work, Jira, and OpenSpec are guardrails around these
passes. They are not separate cleanup projects and should change only when a
confirmed 2.1 requirement makes the change necessary.

## Current assessment

**Not release-ready yet, but suitable for a focused hardening pass.**

Keep:

- NFS plugin and lazy-loaded extensions.
- Standard Catalog API and catalog.entity.read visibility behavior.
- Shared AI asset taxonomy from boost-common.
- The data-driven filter Blueprint.
- URL-backed search, filters, pagination, and view selection.
- Client-side filtering for the current scale, subject to a 500-entity check.
- BUI components and semantic RHDH theme tokens.

The following are not defects:

- The clickable BUI Card and its internal type control are not invalid nested
  interactive HTML; BUI renders and handles them separately. Whether the type
  control belongs in the final UX is still a design question.
- API reports are not stale. They pass after the required full TypeScript build.
- The filter Blueprint is not unnecessary architecture and should not be
  rewritten.

Current validation is healthy: 109 unit tests, full TypeScript, lint, package
build, and API report validation all pass.

## Pass 1 — Correctness and code structure

Review these with the owner one by one, then add a failing test before each fix.

### Confirmed bugs

1. **Invalid view URL:** an unknown view query value can leave both grid and
   table unrendered. Validate it and fall back to card view.
2. **Invalid page URL:** an out-of-range page can show no items even when results
   exist. Clamp or reset to the last valid page.
3. **Leaky Type options:** Type choices come from the full taxonomy rather than
   the entities visible to the current user. Derive them from returned entities
   while preserving the canonical order.
4. **Invalid OCI command:** remove the oci:// prefix and show Docker pull by
   default with Podman as an alternative.
5. **Mislabelled downloads:** some actions say Download ZIP but only open source.
   Distinguish verified download, view source, copy command, and copy URL. Do not
   guess a branch or malformed GitLab URL.
6. **Silent copy failure:** replace console-only failure with visible and
   screen-reader-announced success/failure feedback; clear timers on unmount.
7. **Case-sensitive agent fields:** normalize spec.type before rendering
   agent-specific metadata.
8. **Untranslated UI:** externalize yes/no, card labels, tag labels, extension
   titles where supported, and new feedback strings.

### Small structural changes

- Centralize pure presentation selectors for title, type, provider, lifecycle,
  owner, version, and asset locations.
- Replace the generic adoption action shape with a discriminated action model.
- Move query parsing and validation into testable helpers.
- Correct stale code comments that claim the Usage extension is permission
  gated when no permission check exists.
- Keep domain data in Catalog entities; do not create a second frontend model.

### Required unit coverage

- Malformed view, page, and page-size URLs.
- Page recovery after filtering.
- User-visible Type choices and canonical ordering.
- Docker/Podman commands and repository/download URL variants.
- Copy success, failure, retry, and live-region behavior.
- Summary, table, version, and plugin-extension wiring.

## Pass 2 — Reconcile the live 2.1 prototype

The live prototype has now been inspected. The checked-in images are older
supporting references.

### Browse page target

Implement the prototype's information architecture:

- Header and subtitle explaining the five asset types.
- Filters in this order: **Type, Provider, Owner, Tag**.
- Persistent filters on desktop and a Filters drawer on compact layouts.
- Bordered results area containing count, search, card/list switch, results, and
  pagination.
- Two-column desktop card grid with a one-column compact fallback.
- Card content: Type, name, description, tags, owner, and Provider.
- No lifecycle or version on browse cards unless UX explicitly adds it later.
- Table columns in prototype order: **Name, Type, Provider, Owner, Description**.
- Sortable table headers and intentional horizontal-overflow behavior.
- Rows-per-page default of 20, subject to product confirmation.
- Loading skeleton shaped like the final filters and two-column results.
- Initial empty, filtered-empty, loading, error, and recovery states.

Polish requirements:

- Use a non-interactive Type pill unless card-to-filter behavior is approved.
- Bound long descriptions, tags, owners, and Provider values without hiding
  their accessible names.
- Replace navigation semantics on the filter region with form/aside semantics.
- Preserve light, dark, high-contrast, keyboard, and white-label behavior; do
  not copy prototype colors as hard-coded values.

### Entity page target and decisions

The prototype uses the standard Catalog entity page:

- Tabs: **Overview, Relations, TechDocs**.
- Standard **About** card with source, description, owner, tags, Kind, Provider,
  Type, and Lifecycle.
- **Asset Location** and type-specific **Metadata** cards.
- **Releases** and **Commits** cards with download actions.

This conflicts with the current frontend registration of custom Summary,
Adoption, Version, and Usage extensions. Resolve these before implementation:

1. **Summary:** prefer the standard About card. Keep a custom card only for
   metadata that About cannot present; do not duplicate description or owner.
2. **Adoption:** the prototype has no Adoption card. Confirm whether install and
   pull actions move into Asset Location/Releases or whether this extension is
   removed from the 2.1 composition.
3. **Usage:** the prototype uses TechDocs, not a separate Usage tab. Do not ship
   a duplicate tab without an explicit UX/product decision.
4. **Releases and Commits:** the prototype shows history, but the current Catalog
   contract does not provide it. Do not invent spec.versions or fake data.
   Define a real data source before implementing these cards; otherwise record
   them as intentionally deferred.
5. **Asset Location:** render only validated Catalog metadata and clearly
   distinguish source links from downloadable artifacts.

Operational configuration, RAG setup, handoff instructions, and usage guidance
belong in Docs rather than a duplicate Summary card.

### UX acceptance matrix

For each prototype element, record one result: **match**, **intentional
difference**, or **deferred with owner**. UX signs off the matrix before the
release-ready label is applied.

## Pass 3 — Release proof

Automate the important paths:

- Unit tests for the fixes and presently uncovered entity cards/table wiring.
- Playwright coverage for search, filters, view switch, sort, pagination,
  navigation, actions, and loading/empty/error recovery.
- axe WCAG 2.1 AA checks for browse and entity states.
- Supported translations and a check that no user-facing English leaks remain.
- Responsive checks at 1440, 1024, and 768 pixels, plus 200% text zoom.
- Keyboard-only navigation, visible focus, announcements, and no color-only
  meaning.
- A 500-entity fixture and agreed render/filter performance target.
- Dynamic-plugin build and extension-override verification.

Final commands: targeted tests, full TypeScript, lint, build, Prettier, API
reports, and changeset validation.

## Guardrails

- Continue using catalog.entity.read for catalog-card and entity visibility.
- Docs permission work remains the separately scoped 2.2 work unless release
  ownership explicitly changes it.
- Do not add a backend ZIP proxy unless direct browser download cannot meet a
  confirmed requirement safely.
- Do not broadly rewrite RHDHPLAN-1505, RHDHPLAN-1509, their children, or the
  OpenSpecs. Update one only when an accepted implementation would otherwise
  contradict its binding contract.
- Never fabricate Releases, Commits, versions, or permissions to make the UI
  resemble the prototype.

## Execution order

1. Classify each Pass 1 item with the owner: accept, reject, or defer.
2. Resolve the four entity-page decisions with UX/product.
3. Implement and test the accepted correctness fixes.
4. Reconcile the browse page and accepted entity composition.
5. Add release-proof automation and run the full validation suite.
6. Obtain UX sign-off on the acceptance matrix.

Release-ready means the accepted prototype behavior is present, no known
release-blocking correctness/accessibility defect remains, all checks pass, and
deferred 2.2 permission work has not been pulled into 2.1 accidentally.
