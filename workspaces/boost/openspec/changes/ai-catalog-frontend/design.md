# Design: AI Catalog Frontend

## Context

Boost has a backend with 30+ API routes and 9 plugin packages but no frontend. The AI Catalog is the first frontend feature. The plugin architecture must support future domains (chat, admin, agent gallery) without restructuring.

## Goals

- NFS-only frontend plugin using Backstage Blueprints
- Browse page for marketplace-style AI asset discovery
- Entity page extensions for asset details and adoption actions
- Dev app shell for local development
- BUI component library for new UI components

## Non-Goals

- Chat UI, admin panels, or agent gallery (future domains)
- Custom entity detail pages (use existing catalog pages)
- Custom search collator for global search (rely on default catalog indexing)

## Decisions

### Decision 1: NFS-only plugin, no legacy entry point

This is a new plugin with no existing consumers. The default export from `src/index.ts` is `createFrontendPlugin`. No `src/alpha.tsx`, no `createPlugin` from `@backstage/core-plugin-api`.

### Decision 2: Standalone browse page + entity extensions

Two surface types:

- `PageBlueprint` at `/ai-catalog` for the card grid browse view. The existing catalog table at `/catalog` does not support card layout, category grouping, or inline adoption actions — a dedicated page is needed.
- `EntityCardBlueprint` extensions on existing catalog entity pages for AI-specific cards. Standard Catalog About, Relations, and TechDocs supply the rest of the page; there is no custom detail page or Boost documentation tab.

### Decision 3: catalogApiRef for data and direct verified downloads

The browse page queries AI assets through the standard `catalogApiRef`. A verified GitHub repository root links directly to its branch-agnostic zipball URL. Other valid Git sources use View Source unless they already provide an explicit archive. No backend download proxy is introduced.

### Decision 4: Single isAiAsset filter, components handle kind differences

One `isAiAsset(entity)` condition filter for all entity page Blueprints. The filter checks entity kind and `spec.type` against the AI asset entity model (see below). Individual components handle kind-specific rendering differences internally — e.g., the download card checks `spec.location.type` and renders nothing when absent.

### Decision 5: Client-side pagination

`catalogApi.getEntities()` returns the full matching dataset. Client-side pagination is sufficient for the Dev Preview target of ~500 assets. If catalogs grow beyond this, the hook internals can switch to `queryEntities` (cursor-based) without changing components.

### Decision 6: BUI is authoritative; prototype supplies UX intent

BUI (`@backstage/ui` 0.16.0) is authoritative for components, semantics, responsive behavior, and theming. The UX prototype at `https://agentic-524bde.pages.redhat.com/2.1.0/skill-marketplace/skills` informs information hierarchy, content, and interactions only. Its component markup, borders, and pixel styling are not copied over current BUI primitives.

### Decision 7: Standard Catalog permissions govern browse visibility

The browse query relies on standard Catalog authorization and `catalog.entity.read`, including conditional decisions. Type choices are derived only from the entities returned to the current user. No custom catalog-card permission is introduced. Existing documentation permission constants and backend enforcement remain unchanged for separately scoped work.

### Decision 8: Extensible browse filters via data-driven FilterDefinition

The browse page filter sidebar becomes NFS-extensible using a **data-driven** approach. Filters are plain objects (`FilterDefinition`), not per-filter React components. The `FilterSidebar` renders a generic `<Select>` for each registered filter — the same pattern already used for all 4 current filters.

**Architecture:**

- A `FilterDefinition` interface defines each filter: `urlParam`, `label`, `getOptions(entities)`, `matchEntity(entity, values)`, `priority`
- `AiCatalogFilterBlueprint` wraps a `FilterDefinition` as an NFS extension (kind: `ai-catalog-filter`) with a single custom `createExtensionDataRef`
- Built-in filters are plain objects in `src/filters/builtInFilterDefinitions.ts`, registered as Blueprint extensions in `plugin.tsx`
- The `aiCatalogPage` PageBlueprint uses `makeWithOverrides` to declare a `filters` input, resolves `FilterDefinition[]`, sorts by priority, and passes to the page component
- `FilterSidebar` maps over the array and renders `<Select>` for each — no per-filter component files
- `useUrlFilters` reads/writes URL params dynamically from the definition array
- `applyEntityFilters` loops over active definitions calling `matchEntity` in AND logic

**Deployer customization (app-config.yaml):**

```yaml
app:
  extensions:
    # Disable a built-in filter
    - ai-catalog-filter:boost/owner: false
    # Custom filter from a third-party module (just enable it)
    - ai-catalog-filter:my-plugin/team-filter: {}
```

**Third-party filter contribution:**

```typescript
createFrontendModule({
  pluginId: 'boost',
  extensions: [
    AiCatalogFilterBlueprint.make({
      name: 'team-filter',
      params: {
        urlParam: 'team',
        label: 'Team',
        getOptions: entities =>
          [...new Set(entities.map(e => e.spec?.team).filter(Boolean))]
            .sort()
            .map(t => ({ id: t, label: t })),
        matchEntity: (entity, values) =>
          values.some(v => v === entity.spec?.team),
        priority: 200,
      },
    }),
  ],
});
```

## Entity Model

Backstage v1.51.0 introduced `AiResource` kind and `API` with `spec.type: mcp-server` via `@backstage/plugin-catalog-backend-module-ai-model`. Boost uses upstream kinds where available:

| Category      | Entity Kind      | spec.type       | Notes                                           |
| ------------- | ---------------- | --------------- | ----------------------------------------------- |
| Skills        | AiResource       | skill           | Upstream                                        |
| Rules         | AiResource       | rule            | Upstream                                        |
| Agents        | AiResource       | agent           | Upstream                                        |
| Skill Bundles | AiResource       | skill-bundle    | Supported aggregate asset                       |
| Model Servers | AiModelServerAPI | ai-model-server | Upstream                                        |
| MCP Servers   | API              | mcp-server      | Upstream                                        |
| Models        | Resource         | ai-model        | May be supplied independently of a model server |
| Tools         | Resource         | ai-tool         | Provider-defined                                |
| Vector Stores | Resource         | vector-store    | Provider-defined                                |

## Components

### AiCatalogPage

Browse page with card grid, search, and filters. PluginHeader provided by the framework.

- Responsive 1/2/4-column card grid with a sticky desktop filter column
- At 768px and below, a BUI Dialog edits draft filters; Apply commits all URL filters atomically and Cancel discards the draft
- Debounced keyword search (300ms)
- Filter controls: Type, provider, owner, tags (AND logic, extensible through NFS)
- Filter/search state in URL query params
- Grid/table views, URL-backed pagination, and table sorting
- Loading skeletons, empty state with clear-filters, error state with retry

### AiAssetCard

Card displaying key metadata for one AI asset. Used in the browse grid.

- Static Type Badge with icon and color accent, name, truncated description, and tags
- Linked owner and provider attribution
- Click navigates to catalog entity detail page

### AiAssetSummaryCard

EntityCardBlueprint on entity overview. Shows AI-specific metadata.

- Rationale and `models.available` only; standard About owns description and TechDocs owns instructions and operating details

### DownloadAdoptCard

EntityCardBlueprint on entity overview. Conditional on spec.location.type.

- skill: copy `npx skills add <name>`
- OCI: Docker default and Podman alternative, with validated references and no `oci://` in commands
- verified GitHub repository root: direct Download ZIP
- other valid Git sources: View Source without branch or archive guessing
- MCP server: copy a validated HTTP(S) runtime URL
- Clipboard failure: translated inline danger Alert with Retry

### AssetLocationCard

EntityCardBlueprint showing all unique validated Git sources and OCI artifact references. Runtime MCP endpoints remain in Adoption and TechDocs.

### VersionListCard

EntityCardBlueprint on entity overview. Keeps the existing `entity-card:boost/version-list` extension identifier for compatibility, but shows only `rhdh.io/ai-asset-version` as the current version. It does not infer releases, commits, or `spec.versions` history.

## Design Reference

UX prototype: https://agentic-524bde.pages.redhat.com/2.1.0/skill-marketplace/skills (VPN required)

## Acceptance Criteria

### AiCatalogPage

- Developer sees a responsive BUI card grid at /ai-catalog
- Search filters cards within 300ms
- Multiple filters narrow results with AND logic
- Filter state in URL survives refresh and is shareable
- Empty state when no match; error state when catalog unreachable
- Keyboard navigable through all interactive elements

### AiAssetCard

- Card displays Type, name, description, tags, linked owner, and provider
- Click navigates to catalog entity detail page

### AiAssetSummaryCard

- Renders on AI asset entity pages only
- Shows rationale and available models only

### DownloadAdoptCard

- Verified sources download directly; other Git sources fall back to View Source
- Docker/Podman tabs expose safe copyable OCI commands
- Clipboard failure can be retried from an inline alert

### VersionListCard

- Shows the current annotated version only

### AssetLocationCard

- Shows validated, deduplicated Git and OCI artifact sources
- Does not show runtime MCP endpoints
