# Cross-product semantic contract

The RHDH packages own their runtime types and validation. They may port stable
behavior from the standalone repository, but must not import unpublished code.

## Canonical domain records

- `WorkItem`: identity, source, repository/entity ownership, lifecycle,
  readiness, automation, checks, suggested actions, evidence, freshness,
  priority factors, and partial-data reason codes.
- `WorkflowRun`: provider run identity and conclusion independent of agent exit.
- `AgentExecution`: agent/model/status/timestamps, trace, usage, cost, tool and
  turn counts.
- `ExecutionWorkItemLink`: explicit or heuristic correlation plus confidence
  and evidence.
- `SyncStatus`: per-source health, freshness, coverage, rate limits, parser
  version, quarantine counts, and diagnostics for configured unsupported
  sources.

All HTTP responses carry `schemaVersion`, snapshot identity/time, partial-data
metadata, and runtime-validated data. Canonical telemetry is parsed before
legacy summary, metrics, and output compatibility inputs. Work-item correlation
using `fullsend.work_item_id` is explicit; branch-based correlation is always
labelled heuristic.

The RHDH route prefix is `/api/fullsend-deck/v1`. Required resources are
`overview`, `work-items`, `work-items/:id`, `executions`, and `sync-status`.
Entity scope is represented by a canonical Backstage entity ref filter.
