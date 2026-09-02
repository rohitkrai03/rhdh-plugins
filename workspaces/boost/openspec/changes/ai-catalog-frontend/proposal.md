# Proposal: AI Catalog Frontend

## Why

Developers need a single place to discover the AI assets available in their organization. These assets may be registered by Boost connectors, manually, or by another Catalog provider, but the generic catalog table view is not optimized for marketplace-style discovery, contextual filtering, and adoption actions.

The existing catalog entity detail pages provide metadata, TechDocs, and relationships out of the box. Rather than rebuilding detail pages, the frontend extends them with AI-specific cards and tabs using NFS Blueprints.

## What Boost Builds

### AI Catalog Browse Page

A standalone page at `/ai-catalog` with a card grid for discovering AI assets:

- Responsive BUI card grid with Type, name, description, tags, owner, and provider
- Search bar with debounced keyword filtering
- Extensible Type, provider, owner, and tag filters, with an atomic compact-screen dialog
- Grid/table switching, pagination, sorting, and loading/empty/error states
- Card click navigates to the existing catalog entity detail page

### Entity Page Extensions

NFS Blueprint extensions that render on catalog entity pages for AI assets:

- Summary Card — rationale and available models not already owned by Catalog About or TechDocs
- Adoption Card — safe copy commands/URLs, verified downloads, and source fallbacks
- Asset Location Card — validated Git and OCI artifact sources
- Version Card — the current annotated version only

Standard Catalog About, Relations, and TechDocs remain the entity-page composition. Boost does not add a second documentation tab.

### Dev App Shell

`packages/app` and `packages/backend` for local development and testing, following the adoption-insights/orchestrator pattern.

## Impact

- `plugins/boost/` — new NFS frontend plugin
- `packages/app/` — new dev app shell
- `packages/backend/` — new dev backend

Git downloads are direct frontend links for verified sources; this change does not add a backend download proxy or a new catalog-card permission.
