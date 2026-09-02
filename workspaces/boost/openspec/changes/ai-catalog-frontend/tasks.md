# Tasks: AI Catalog Frontend

## 1. Plugin Scaffold and Dev App (RHIDP-15165)

- [ ] 1.1 Scaffold `plugins/boost` via `backstage-cli new` (NFS frontend-plugin template). Do not create plugin files manually — if the CLI fails, report the error.
- [ ] 1.2 Configure `createFrontendPlugin` with `PageBlueprint` at `/ai-catalog` as default export
- [ ] 1.3 Add `EntityCardBlueprint` extensions (summary, adoption, asset location, version) with `isAiAsset` filter
- [ ] 1.4 Use standard Catalog TechDocs as the only documentation tab; do not register a Boost Usage extension
- [ ] 1.5 Implement `isAiAsset(entity)` condition filter checking kind + `spec.type`
- [ ] 1.6 Implement `useAiAssets(filters)` hook wrapping `catalogApiRef`
- [ ] 1.7 Create placeholder `AiCatalogPage` component
- [ ] 1.8 Scaffold dev app and backend: run `npx @backstage/create-app` in a temp directory, copy `packages/app` and `packages/backend` into the boost workspace, then adapt. Do not create these packages manually — if the CLI fails, report the error.
- [ ] 1.9 Adapt dev app to NFS pattern (createApp from frontend-defaults, nav module, sign-in module) and dev backend (app-backend, catalog-backend, auth + guest provider, boost-backend)
- [ ] 1.10 Create sample fixtures covering every supported kind/type pair, including standalone `Resource/ai-model` and `AiResource/skill-bundle`
- [ ] 1.11 Add `app-config.yaml` with catalog fixture locations
- [ ] 1.12 Set up i18n scaffold: translation resource file, TranslationBlueprint module
- [ ] 1.13 Add first unit test using `TestApiProvider` + `renderInTestApp`
- [ ] 1.14 Verify `yarn start` launches dev app with AI Catalog in sidebar
- [ ] 1.15 Verify `yarn test` passes

## 2. Browse Page with Search and Filters (RHIDP-15166)

- [ ] 2.1 Implement `AiCatalogPage` with the responsive BUI grid (1, 2, or 4 columns) and compact filter Dialog at 768px and below
- [ ] 2.2 Implement `AiAssetCard` with a static Type Badge, name, description, tags, linked owner, and provider
- [ ] 2.3 Derive Type choices from visible entities in canonical taxonomy order
- [ ] 2.4 Implement debounced search bar (BUI SearchField, 300ms, filters by name/description/tags)
- [ ] 2.5 Render the enabled Type, provider, owner, and tag definitions through shared BUI multi-select controls
- [ ] 2.6 Filters combine as AND; URL query param sync for all filter + search state
- [ ] 2.7 Add client-side pagination (BUI TablePagination) and sort control (name, last updated)
- [ ] 2.8 Implement loading state (BUI Skeleton cards), empty state ("No AI assets match" + clear-filters), error state (BUI Alert + Retry)
- [ ] 2.9 Add error boundary so catalog-unreachable does not crash RHDH shell
- [ ] 2.10 Card click navigates to catalog entity detail page (`/catalog/:namespace/:kind/:name`)
- [ ] 2.11 i18n: all user-facing strings via translation resources
- [ ] 2.12 WCAG 2.1 AA: keyboard nav, screen reader labels, focus management on filter changes
- [ ] 2.13 Unit tests for card rendering, filter logic, search, pagination, empty/error states

## 3. Entity Page Extensions and Adoption Actions (RHIDP-15167)

- [ ] 3.1 Implement `SummaryCard` with `rationale` and `models.available` only
- [ ] 3.2 Implement `AdoptionCard` with safe skill/OCI/MCP copy actions, verified GitHub downloads, View Source fallback, and copy failure Retry
- [ ] 3.3 Keep `entity-card:boost/version-list` compatibility while showing only the current annotated version
- [ ] 3.4 Implement `AssetLocationCard` with validated, deduplicated Git and OCI artifact sources
- [ ] 3.5 Wire all four cards through EntityCardBlueprint and remove `entity-content:boost/usage`
- [ ] 3.6 Use direct frontend links for verified downloads; do not add a backend proxy in this change
- [ ] 3.7 Leave existing documentation permission constants/backend enforcement unchanged for separately scoped work
- [ ] 3.8 i18n: all user-facing strings via translation resources
- [ ] 3.9 WCAG 2.1 AA for all interactive elements
- [ ] 3.10 Unit tests for Summary exclusions, Adoption safety/retry, Asset Location validation, current Version behavior, and extension wiring

## 4. Extensible Browse Filters via NFS (RHIDP-15449)

- [ ] 4.1 Define `FilterDefinition` interface in `src/blueprints/AiCatalogFilterBlueprint.ts` — fields: `urlParam` (string), `label` (string), `getOptions(entities) => {id, label}[]`, `matchEntity(entity, values) => boolean`, `priority` (number)
- [ ] 4.2 Create single `filterDefinitionDataRef` via `createExtensionDataRef<FilterDefinition>` in same file
- [ ] 4.3 Create `AiCatalogFilterBlueprint` via `createExtensionBlueprint` — kind `ai-catalog-filter`, attaches to `page:boost/ai-catalog` input `filters`, params are `FilterDefinition` fields, no config schema. Factory outputs the `FilterDefinition` via the single data ref.
- [ ] 4.4 Create `src/filters/builtInFilterDefinitions.ts` with 4 plain `FilterDefinition` objects:
  - `categoryFilter` — urlParam `type`, getOptions from supported types present in visible entities while preserving canonical order, matchEntity checks `spec.type`, priority 100
  - `providerFilter` — urlParam `provider`, getOptions from `rhdh.io/ai-asset-source` annotation, priority 200
  - `ownerFilter` — urlParam `owner`, getOptions from `spec.owner`, priority 300
  - `tagsFilter` — urlParam `tag`, getOptions from `metadata.tags`, priority 400
- [ ] 4.5 Register 4 built-in filters as `AiCatalogFilterBlueprint.make(...)` extensions in `plugin.tsx`, add to `createFrontendPlugin({ extensions: [...] })`
- [ ] 4.6 Upgrade `aiCatalogPage` to `PageBlueprint.makeWithOverrides` with `name: 'ai-catalog'` — declare `filters` input via `createExtensionInput` accepting `ai-catalog-filter` extensions. Factory resolves `FilterDefinition[]`, sorts by priority, passes to page component as prop.
- [ ] 4.7 Refactor `FilterSidebar` — receive `FilterDefinition[]` + URL values. Map over definitions, render `<Select>` for each using `getOptions(allEntities)`. Return `null` when array is empty.
- [ ] 4.8 Refactor `useUrlFilters` — accept `urlParam[]`, expose generic single and atomic filter actions, validate view/page/pageSize, and repair invalid URL state with history replacement. `clearFilters` resets registered filter params + search only (preserves view/pageSize).
- [ ] 4.9 Refactor `applyEntityFilters` in `entityHelpers.ts` — replace 5 hardcoded `if` blocks with one loop: for each `FilterDefinition` with active values, call `matchEntity(entity, values)`. AND logic. Search filter stays built-in. Remove old `EntityFilters` interface.
- [ ] 4.10 Update `AiCatalogPage.tsx` — receive `FilterDefinition[]` from page factory, pass to `FilterSidebar` and `useUrlFilters`. `hasActiveFilters` checks all registered urlParams dynamically.
- [ ] 4.11 Export `AiCatalogFilterBlueprint` and `FilterDefinition` from `src/index.ts`
- [ ] 4.12 Add dev app example: `packages/app/src/modules/sampleFilter/` — a lifecycle filter via `createFrontendModule({ pluginId: 'boost' })` demonstrating third-party contribution (lifecycle is not built-in, shown as custom filter example)
- [ ] 4.13 Add app-config example showing filter disable (`ai-catalog-filter:boost/owner: false`)
- [ ] 4.14 Add lifecycle filter label to `ref.ts` translation keys
- [ ] 4.15 WCAG 2.1 AA: keyboard navigation through dynamically rendered filters, aria-labels on each `<Select>`
- [ ] 4.16 Unit tests: `builtinFilters` (getOptions returns correct options, matchEntity matches correctly), `FilterSidebar` (renders N selects from definitions, returns null when empty), `useUrlFilters` (dynamic param read/write, setFilter, clearFilters preserves view/pageSize), `applyEntityFilters` (AND loop with matchEntity, search + filters combined), priority ordering

## 5. Add Translations for Supported Languages (RHIDP-15479)

- [ ] 5.1 Create `src/translations/de.ts` — German translations using `createTranslationMessages` referencing `boostTranslationRef`, flattened dot-notation keys
- [ ] 5.2 Create `src/translations/es.ts` — Spanish translations
- [ ] 5.3 Create `src/translations/fr.ts` — French translations
- [ ] 5.4 Create `src/translations/it.ts` — Italian translations
- [ ] 5.5 Create `src/translations/ja.ts` — Japanese translations
- [ ] 5.6 Update `src/translations/index.ts` — register all 5 locales in `createTranslationResource` with lazy imports (`de: () => import('./de')`, etc.)
- [ ] 5.7 Audit all user-facing strings in browse page, filter sidebar, entity cards, entity tabs, empty/error/loading states — ensure every string uses `useTranslationRef` with a key in `ref.ts`
- [ ] 5.8 Add missing keys to `ref.ts` if any strings are found not externalized
- [ ] 5.9 Ensure interpolation placeholders (e.g., `{{count}}`) are preserved in all locale files
- [ ] 5.10 Add separate entry point for translation module auto-discovery — re-export `boostTranslationsModule` as default from a dedicated file, add entry to `package.json` `exports`
- [ ] 5.11 Verify locale switching in dev app — switch locale via Settings, confirm all AI Catalog strings update without page reload
- [ ] 5.12 Verify English fallback — if a key is missing from a locale file, English is shown (not a raw key or empty string)

## 6. E2E Tests with Playwright (RHIDP-15480)

- [ ] 6.1 Install `@playwright/test` and `@backstage/e2e-test-utils` as devDependencies
- [ ] 6.2 Create `playwright.config.ts` at workspace root — `webServer` starts `yarn start`, `testDir: 'e2e-tests'`, NFS-only (no `APP_MODE`)
- [ ] 6.3 Validate 1440px, 1024px, 768px, and mobile widths, including 200% zoom and theme media settings
- [ ] 6.4 Cover compact BUI Dialog Apply/Cancel and focus restoration
- [ ] 6.5 Add `package.json` scripts: `test:e2e` → `playwright test`, `playwright` → forwarding script
- [ ] 6.6 Use the plugin translation source for stable UI labels
- [ ] 6.7 Create `e2e-tests/utils/accessibility.ts` — axe-core audit helper with WCAG 2.1 AA tags, attaches results to `TestInfo`
- [ ] 6.8 Test: browse page renders card grid with fixture data — verify cards visible using translation keys
- [ ] 6.9 Test: search filters cards by keyword — type in search, verify URL updates, cards filtered
- [ ] 6.10 Test: sidebar filter narrows results — select category, verify only matching cards shown
- [ ] 6.11 Test: multiple filters combine as AND — select category + tag, verify intersection
- [ ] 6.12 Test: clear filters resets view — click clear, verify URL params removed, full grid restored
- [ ] 6.13 Test: card click navigates to entity detail — click card, verify URL changes to catalog entity page
- [ ] 6.14 Test: empty state when no matches — apply impossible filter combination, verify empty state message
- [ ] 6.15 Test: pagination controls — navigate pages, verify card grid updates
- [ ] 6.16 Test: sort control — change sort order, verify card reordering
- [ ] 6.17 Accessibility: axe-core audit on browse page (unfiltered)
- [ ] 6.18 Accessibility: axe-core audit on browse page (with active filters)
- [ ] 6.19 Verify light, dark, and forced/high-contrast media settings without page-level horizontal overflow

## 7. Dynamic Plugin Export and Overlay Registration (RHIDP-15481)

- [ ] 7.1 Add `"export-dynamic": "rhdh-cli plugin export"` script to `plugins/boost/package.json`
- [ ] 7.2 Add `"dist-dynamic/*.*"` and `"dist-dynamic/dist/**"` to `files` array in `plugins/boost/package.json`
- [ ] 7.3 Run `yarn export-dynamic` and verify `dist-dynamic/` is produced without errors
- [ ] 7.4 Create `plugins/boost/app-config.dynamic.yaml` with default `app.extensions` config:
  - `page:boost/ai-catalog` at `/ai-catalog`
  - `entity-card:boost/summary`, `entity-card:boost/adoption`, `entity-card:boost/asset-location`, `entity-card:boost/version-list` with AI asset filter
  - no Boost entity-content extension; standard TechDocs is authoritative
- [ ] 7.5 Add boost frontend plugin entry to `redhat-developer/rhdh-plugin-export-overlays` — PR with overlay config for OCI image build
- [ ] 7.6 Update workspace `dynamic-plugins-image-reference.yaml` with the published OCI image ref for the frontend plugin
- [ ] 7.7 Verify plugin loads in RHDH with `ENABLE_STANDARD_MODULE_FEDERATION=true` — AI Catalog nav item appears, browse page renders
- [ ] 7.8 Verify entity page extensions mount on AI asset entities and are absent on non-AI entities
- [ ] 7.9 Verify adopter overrides via `app.extensions` — disable a card or change an entity filter
- [ ] 7.10 Verify `page:boost/ai-catalog: false` removes the nav item and page
