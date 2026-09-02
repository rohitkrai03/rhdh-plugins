# 1505 Frontend Stories Analysis

## 2.1 scope

### 1. Graduated visibility (RHIDP-15273 / #4062)

**Usage tab gating is already done.** PR #3746 (Marek's issue #3734, implemented by fullsend) merged and is on upstream main. The `UsageTab` checks `aiCatalogAssetAccessUsageDocsPermission` via `usePermission` with `resourceRef`. Denied users see a "contact owner" message.

**What's left in #4062:**

- Task 3.3 (filtered list counts) — doesn't make sense as written, browse uses `catalogApi`
- Task 3.4 (admin links with `usePermission` for `ai-catalog.admin`) — depends on admin dashboard existing
- SkillBundle filtered-view messaging — deferred, no SkillBundle UI exists (see "Future work")

**For other extensions (entity cards, browse page):**

The 2.1 platform feature RHDHPLAN-843 ("RBAC Fine-Grained Visibility Control for Pages, Tabs, and Navigation Elements") adds NFS-level permission support via the `if` predicate ([backstage#34608](https://github.com/backstage/backstage/pull/34608)). Extensions can declare `if: { permissions: { $contains: 'permissionName#action' } }` and they simply won't render without the permission. No placeholder needed — RHDHPLAN-843 says hide, not replace.

Entity-level visibility (browse, search, entity pages) is handled by `catalog.entity.read` — see `1505-permissions-proposal.md` for the full analysis on why a separate `ai-catalog.asset.access` permission is not needed.

**Note:** Gabe has PR #4382 open — "adjust openspecs for removal of separate UI for RHDHPLAN-1508." May address remaining scope.

---

### 2. Health dashboard (RHIDP-15336 + 15339 / #4064)

**Not in 2.1 MVP.** Confirmed by Gabe — not part of current MVP or the RHDHPLAN-1510/1507 subset plan. Deferred to 2.2 or beyond.

**What it does:** An admin page showing health status cards for each ingestion connector — is it syncing, when did it last sync, what went wrong. This would be the first page of the Boost admin dashboard.

**What's ready:**

- Backend fully built: `HealthStatusService` (derives status from last 3 sync attempts), `SyncAttemptsStore` (persists sync history to DB), `ConnectorConfigReader` (discovers configured connectors), `ErrorClassifier` (categorizes auth/network/schema/rate-limit errors)
- `ConnectorHealthStatus` types exported from `boost-common` — well-defined API contract
- The health API route is live and already gated with `ai-catalog.admin`

**What's NOT ready:**

- Force Sync backend routes don't exist yet
- `ConnectorConfigReader` currently only discovers Jira, GitHub, GitLab (hardcoded `KNOWN_CONNECTOR_TYPES`). AI Catalog connectors (MCP, RHOAI, OCI) won't show up until the backend extends this.
- No UX designs

**When we pick this up, changes needed before fullsend:**

- Split #4064 into frontend-only issue — remove backend tasks (groups 6, 7)
- Remove Neo4j panel from spec and issue — backend doesn't exist
- Remove Force Sync from first pass
- Replace all PatternFly component references with BUI — boost uses `@backstage/ui`, not PatternFly
- Remove `react-time-ago` and `useSWR` prescriptions — use what's in the codebase
- Add setup context: "This is the first admin page — create the route and layout first"
- Add API contract: reference `ConnectorHealthStatus` type, `GET /api/boost/ingestion-health`
- Absorb RHIDP-15339 (disabled connector styling) into this issue as a rendering detail

---

### 3. Connector config form (RHIDP-15342 / #4066)

**Not in 2.1 MVP.** Confirmed by Gabe — not part of MVP or the adjusted plan.

**What it does:** Admin form to toggle connectors on/off, change endpoint URLs, adjust sync schedules — without editing YAML. Changes take effect within 30 seconds.

**What's ready:**

- Backend fully built: `AdminConfigService` (setOverride/removeOverride), `RuntimeConfigResolver` (YAML + DB merge, 30s TTL, immediate invalidation), Zod schemas for all connector fields
- Connector config fields in `boostConfigFields`: `enabled`, `endpoint`, `schedule.intervalMs`, `schedule.cron`, `batchSize`, `timeout.connectionMs` for Jira/GitHub/GitLab
- Field defaults via #4314: `intervalMs: 300000`, `batchSize: 100`, `timeout.connectionMs: 30000`
- `GET /config/status` returns all resolved config values
- `POST /api/boost/admin/config` accepts writes, validates with Zod, stores in DB

**What's NOT ready:**

- No frontend admin panel exists yet (depends on health dashboard creating the layout)
- Only Jira/GitHub/GitLab connector configs exist — MCP/RHOAI/OCI connectors aren't in the schema yet
- No UX designs

**When we pick this up, changes needed before fullsend:**

- Remove #4060 dependency — frontend just calls the existing POST endpoint
- Remove task 4.10 (read-only non-admin view) and 4.11 (change history) — over-scoped
- Remove backend tasks (group 6) — already done
- Simplify spec: list connectors, show fields, validate, save. No cron builder, no optimistic updates, no change history.
- Add API contract: `boostConfigFields` for field names, `POST /api/boost/admin/config` payload, `GET /config/status`

---

## Already resolved

| Story                            | Status            | Why                      |
| -------------------------------- | ----------------- | ------------------------ |
| RHIDP-15307 (Policy Dashboard)   | Closed — Won't Do | RBAC plugin handles this |
| RHIDP-15308 (Policy Editor)      | Closed — Won't Do | RBAC plugin handles this |
| RHIDP-15309 (Default Posture UI) | Closed — Won't Do | Config-level setting     |

---

## Future work (not 2.1)

### SkillBundle UI and RBAC filtering

**What it is:** SkillBundles are curated collections of skills (e.g. "security-toolkit"). The PM requirements (RHDHPLAN-1507, 1508) describe SkillBundle as a Neo4j graph feature — bundle nodes with `INCLUDES` relationships to skill nodes, read-time RBAC filtering of included skills, and "N of M skills visible" messaging.

**Why it's not 2.1:**

- RHDHPLAN-1509 (discovery UI, our scope) never mentions SkillBundles
- RHDHPLAN-1505 (parent outcome) never mentions SkillBundles
- Every PM reference to SkillBundles is framed around Neo4j, which isn't being built
- No OCI connector exists to emit `AiResource/ai-skill-bundle` entities
- No SkillBundle API endpoint exists in the backend
- No SkillBundle UI exists in the frontend
- `isAiAsset` in `boost-common` doesn't include `ai-skill-bundle` as a `spec.type`

**Where it's currently referenced (should be deferred):**

- RHIDP-15273 / #4062 — the SkillBundle messaging part (from consolidated RHIDP-15311)
- #4061 — tasks 9.4–9.6 (frontend "N of M" count display)
- `skillbundle-filtering/spec.md` — frontend UX scenarios

### Neo4j sync status panel (RHIDP-15338)

**Confirmed not 2.1** by Gabe. No Neo4j for 2.1.

### Analytics tab (Issue 29 / #4067)

**Why it's not 2.1:** Issue 29 of 29 (Tier 2), depends on issues 5 and 21, includes Neo4j status embedding which doesn't exist. The cross-feature docs say RHIDP-15167 depends on this API, but we should remove that dependency so entity page extensions aren't blocked.

### Version-level policy cascade (#4058 group 5)

**Why it's not 2.1:** The entity model treats version as an annotation, not a separate entity. No provider emits version entities. No `versionOf` relation exists. Already commented on #4058 about splitting this out.

---

## Indirect frontend impacts to track

These don't need action now but will need attention when they land.

1. **New entity types from connectors.** When OCI/MCP/RHOAI connectors start emitting entities, they'll appear in browse automatically. Verify they render correctly with existing cards and filters.

2. **Category coverage gaps.** SDK annotation enum has 7 categories. Frontend `isAiAsset` covers a different set (includes `ai-tool`, `vector-store`; doesn't include `skill-bundle`, `ai-model` as separate `spec.type` values). Reconcile when new connectors emit entities.

3. **Upstream kind changes.** If migration readiness work (#4042 task 8.3) changes kinds/types, update `isAiAsset` and `buildCatalogFilter` in `boost-common`.

---

## Summary

### 2.1: 1 story in scope

| Story                | GitHub issue | Status                                                                     | Next step                                               |
| -------------------- | ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Graduated visibility | #4062        | Usage tab done (#3746). Remaining scope depends on permissions discussion. | Review #4382, discuss permissions model with Christophe |

### Post-2.1 (confirmed by Gabe)

| What                                             | Why                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| Health dashboard (#4064)                         | Not in 2.1 MVP or adjusted plan                                    |
| Connector config form (#4066)                    | Not in 2.1 MVP or adjusted plan                                    |
| Disconnected-cluster styling (#4064/RHIDP-15339) | Post-2.1, part of health dashboard                                 |
| Neo4j admin panel (RHIDP-15338)                  | No Neo4j for 2.1                                                   |
| SkillBundle UI + RBAC filtering                  | Neo4j not built, no connector emits bundles, 1509 doesn't scope it |
| Analytics tab (#4067)                            | Tier 2, dependency chain not ready                                 |
| Version policy cascade (#4058 group 5)           | Version entities don't exist in the data model                     |
