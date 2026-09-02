# AI Catalog Permissions: Do we need `ai-catalog.asset.access`?

## The question

We have three AI Catalog permissions. Do we need all three, or can we drop one?

| Permission                           | What it does                                              | Keep?            |
| ------------------------------------ | --------------------------------------------------------- | ---------------- |
| `ai-catalog.asset.access`            | Entity-level visibility — can the user see this AI asset? | **Probably not** |
| `ai-catalog.asset.access.usage-docs` | Tier 2 — can the user see the usage docs?                 | Yes              |
| `ai-catalog.admin`                   | Admin actions                                             | Yes              |

## Why `ai-catalog.asset.access` may not be needed

The browse page and entity pages go through `catalogApi`, which checks `catalog.entity.read`. That's what actually controls what users see. `ai-catalog.asset.access` only gates the `GET /ai-catalog/assets` routes, which nothing in the frontend calls.

So today, if an admin creates an `ai-catalog.asset.access` DENY policy, users still see the AI assets in browse because the frontend uses a different path.

No other RHDH plugin defines a separate entity-level read permission. Scorecard, orchestrator, homepage, extensions — they all use `catalog.entity.read` for entity visibility.

## How `catalog.entity.read` covers the PM requirements

The catalog ships built-in conditional rules. Here's how each PM requirement maps:

**"Hide AI models from junior developers"**

```
ALLOW catalog.entity.read for role junior-dev
WHERE not HAS_ANNOTATION(rhdh.io/ai-asset-category, ai-model)
```

Junior-dev sees all catalog entities except AI models.

**"Skills default-deny, MCP servers default-allow"**

```
ALLOW catalog.entity.read for role business-user
WHERE not HAS_ANNOTATION(rhdh.io/ai-asset-category, skill)
```

Business-user can see everything except skill entities.

**"Hide assets from a specific connector"**

```
ALLOW catalog.entity.read for role team-a
WHERE not HAS_ANNOTATION(rhdh.io/ai-asset-source, kagenti/default)
```

Team-a can't see entities from the kagenti connector.

**"Different teams see different AI assets (multi-tenant)"**

```
ALLOW catalog.entity.read for role team-alpha
WHERE anyOf:
  - HAS_METADATA(namespace, team-alpha)
  - not HAS_ANNOTATION(rhdh.io/ai-asset-category)
```

Team-alpha sees all non-AI entities plus only AI entities in their namespace.

**"User sees the entity but not the usage docs"**
`catalog.entity.read` can't do this — it's all-or-nothing for entity presence.
That's why we keep `ai-catalog.asset.access.usage-docs`. Already implemented in #3746.

## Available catalog rules

| Rule              | What it filters                 | Example                                |
| ----------------- | ------------------------------- | -------------------------------------- |
| `HAS_ANNOTATION`  | Annotation key + optional value | `rhdh.io/ai-asset-category = ai-model` |
| `HAS_SPEC`        | Any `spec.*` field              | `spec.type = skill`                    |
| `IS_ENTITY_KIND`  | Entity kind                     | `AiResource`, `API`                    |
| `HAS_METADATA`    | Any `metadata.*` field          | `namespace = team-alpha`               |
| `IS_ENTITY_OWNER` | Ownership relations             | `group:default/my-team`                |
| `HAS_LABEL`       | Labels                          | key + optional value                   |

These compose with `allOf`, `anyOf`, `not`.

## What we'd keep

| Permission                           | Purpose                                 | Status                             |
| ------------------------------------ | --------------------------------------- | ---------------------------------- |
| `catalog.entity.read`                | Entity visibility (platform handles it) | Already working, no changes needed |
| `ai-catalog.asset.access.usage-docs` | Usage tab gating                        | Already implemented (#3746)        |
| `ai-catalog.admin`                   | Admin actions                           | Already working                    |

## What we'd drop

| What                                             | Why                                                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-catalog.asset.access`                        | Doesn't protect the frontend path. `catalog.entity.read` already does this.                                                                                 |
| `GET /ai-catalog/assets` routes                  | No consumer. Frontend uses `catalogApi`.                                                                                                                    |
| Custom rules on `ai-catalog-asset` resource type | Catalog built-in rules (`HAS_ANNOTATION`, etc.) cover the same filtering. Could optionally keep as convenience aliases registered against `catalog-entity`. |

## Tradeoffs to discuss

**Default-deny for AI assets only:**
With `ai-catalog.asset.access`, it's a simple config toggle. With `catalog.entity.read`, you write a conditional policy: "allow everything except entities with AI asset annotations." Works but requires the admin to understand the inverted pattern.

**RBAC admin UX:**
Custom rules show as `isAiAssetCategory` in the admin UI. Catalog rules show as `HAS_ANNOTATION`. The catalog rules are more generic but less friendly for AI Catalog admins. We could register the custom rules against `catalog-entity` resource type to keep the friendly names.

**One conditional per role:**
RBAC plugin allows only one conditional policy per role + resource type + action. If a role already has a conditional on `catalog.entity.read` for something else (e.g. ownership filtering), adding AI asset filtering to the same role requires combining them into one condition tree.

## The main argument

`ai-catalog.asset.access` creates a dual-gate problem: an entity can be visible in the default catalog (`/catalog`) but hidden in the AI Catalog (`/ai-catalog`), or vice versa. That's confusing. With `catalog.entity.read`, the entity is either visible or not, everywhere, consistently.
