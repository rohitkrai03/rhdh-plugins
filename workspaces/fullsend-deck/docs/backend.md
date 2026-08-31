# Backend configuration and API

The backend is read-only and does not call a standalone Deck service. It uses
the Backstage database and globally coordinated scheduler, so API reads never
perform provider work and multiple backend replicas do not multiply ingestion.

## Sources

GitHub repositories are configured under
`fullsendDeck.sources.github.repositories`. Each entry accepts `repository`
(`owner/name`), optional `host`, and optional canonical Backstage `entityRef`.
Credentials come from the matching Backstage GitHub integration, including
GitHub App credentials. The collector reads pull requests, issues, workflow
metadata, and artifact ZIPs whose names begin with `artifactNamePrefix`.

An optional read-only filesystem export may be configured at
`fullsendDeck.sources.filesystem.directory`. It contains `work-items.json` and
one or more run directories. Each run directory has `run.json` plus at least
one of the following, in parser priority order:

1. `run-telemetry.jsonl` (canonical OTLP JSONL);
2. `run-summary.json`;
3. `metrics.json`;
4. `output.jsonl`.

`run.json` requires `repository` and `providerRunId` (or `runId`); it may also
contain `entityRef`, `url`, `branch`, `conclusion`, and `createdAt`.

Malformed artifacts are quarantined by artifact key and parser version. They
are retried on every ingestion and after parser upgrades. A failed ingestion
never replaces the last completed snapshot. GitLab and Jira remain explicit
unsupported source-health entries.

## Configuration example

```yaml
fullsendDeck:
  enabled: true
  schedule:
    frequencyMinutes: 5
    timeoutMinutes: 4
    initialDelaySeconds: 5
  sources:
    github:
      artifactNamePrefix: fullsend
      maxArtifactsPerRepository: 25
      repositories:
        - repository: fullsend-dev/fullsend
          entityRef: component:default/fullsend
    # filesystem:
    #   directory: /var/lib/fullsend-deck/artifacts
```

## API

The plugin mount is `/api/fullsend-deck`; the versioned resources are:

- `GET /v1/overview`
- `GET /v1/work-items`
- `GET /v1/work-items/:id`
- `GET /v1/executions`
- `GET /v1/sync-status`

Responses contain schema version, immutable snapshot ID/time, and partial-data
diagnostics. Work-item and execution lists use cursors bound to the snapshot.
Global scope uses no entity filter; entity pages pass a canonical `entityRef`.

## Authorization and auditing

Register an RBAC policy that grants `fullsend-deck.read` to the intended users
and service principals. Every successful or failed versioned read emits a
Backstage audit event. Invalid input is rejected by runtime validation and
outward-facing errors never include provider credentials or parser internals.
