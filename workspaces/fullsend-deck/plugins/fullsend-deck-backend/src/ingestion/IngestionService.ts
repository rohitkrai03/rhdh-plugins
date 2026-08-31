import { createHash } from 'node:crypto';
import type {
  LoggerService,
  SchedulerService,
} from '@backstage/backend-plugin-api';
import {
  TELEMETRY_PARSER_VERSION,
  type AgentExecution,
  type ExecutionWorkItemLink,
  type PartialData,
  type SyncStatus,
  type WorkItem,
  type WorkflowRun,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import type { FullsendDeckConfig } from '../config';
import type { Snapshot, SourceCollection } from '../domain/types';
import { SnapshotStore } from '../persistence/SnapshotStore';
import type { ArtifactSource } from './ArtifactSources';
import { correlateExecution, parseArtifactRun } from './telemetry';

export class IngestionService {
  constructor(
    private readonly config: FullsendDeckConfig,
    private readonly store: Pick<
      SnapshotStore,
      | 'clearQuarantineForArtifact'
      | 'listQuarantine'
      | 'quarantine'
      | 'recordIngestionError'
      | 'writeSnapshot'
    >,
    private readonly sources: ArtifactSource[],
    private readonly logger: LoggerService,
  ) {}

  async schedule(scheduler: SchedulerService): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Fullsend Deck ingestion is disabled');
      return;
    }
    await scheduler.scheduleTask({
      id: 'fullsend-deck-ingestion',
      scope: 'global',
      frequency: { minutes: this.config.schedule.frequencyMinutes },
      timeout: { minutes: this.config.schedule.timeoutMinutes },
      initialDelay: { seconds: this.config.schedule.initialDelaySeconds },
      fn: async () => {
        await this.runOnce();
      },
    });
  }

  async runOnce(now = new Date()): Promise<Snapshot | null> {
    const snapshotAt = now.toISOString();
    try {
      const collections = await this.collectSources(now);
      const workItems = deterministicUnique(
        collections.flatMap(collection => collection.workItems),
        item => item.id,
      );
      const workflowRuns: WorkflowRun[] = [];
      const agentExecutions: AgentExecution[] = [];
      const links: ExecutionWorkItemLink[] = [];
      const parserDiagnostics: PartialData['diagnostics'] = [];

      const runs = collections
        .flatMap(collection => collection.runs)
        .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
      for (const run of runs) {
        try {
          const parsed = parseArtifactRun(run);
          workflowRuns.push(parsed.workflowRun);
          agentExecutions.push(parsed.agentExecution);
          const link = correlateExecution(
            parsed.agentExecution,
            workItems,
            run.branch,
          );
          if (link) links.push(link);
          if (parsed.parseFailures.length > 0) {
            parserDiagnostics.push({
              source: run.sourceKey,
              level: 'warning',
              message: `Canonical parsing fell back: ${parsed.parseFailures.join(
                '; ',
              )}`,
            });
          }
          await this.store.clearQuarantineForArtifact(
            run.sourceKey,
            TELEMETRY_PARSER_VERSION,
          );
        } catch (error) {
          const message = safeMessage(error);
          await this.store.quarantine(
            run.sourceKey,
            TELEMETRY_PARSER_VERSION,
            message,
            snapshotAt,
          );
          parserDiagnostics.push({
            source: run.sourceKey,
            level: 'error',
            message: `Artifact quarantined: ${message}`,
          });
        }
      }

      const normalizedWorkItems = applyExecutionState(
        workItems,
        agentExecutions,
        links,
        workflowRuns,
      );
      const quarantine = await this.store.listQuarantine();
      const sourceDiagnostics = collections.flatMap(
        collection => collection.diagnostics,
      );
      const unsupported: PartialData['diagnostics'] = [
        {
          source: 'gitlab',
          level: 'warning',
          message: 'GitLab ingestion is not implemented',
        },
        {
          source: 'jira',
          level: 'warning',
          message: 'Jira ingestion is not implemented',
        },
      ];
      const diagnostics = [
        ...sourceDiagnostics,
        ...parserDiagnostics,
        ...unsupported,
      ];
      const sync = buildSyncStatus(
        snapshotAt,
        collections,
        quarantine.length,
        diagnostics,
      );
      const partial: PartialData = {
        isPartial: diagnostics.length > 0,
        diagnostics,
      };
      const write = {
        snapshotAt,
        workItems: normalizedWorkItems,
        workflowRuns: deterministicUnique(workflowRuns, run => run.id),
        agentExecutions: deterministicUnique(
          agentExecutions,
          execution => execution.id,
        ),
        links: deterministicUnique(
          links,
          link => `${link.executionId}:${link.workItemId}`,
        ),
        sync,
        partial,
      };
      const snapshot = await this.store.writeSnapshot({
        ...write,
        ingestionKey: createHash('sha256')
          .update(stableStringify(write))
          .digest('hex'),
      });
      this.logger.info('Fullsend Deck ingestion completed', {
        snapshotId: snapshot.id,
        workItems: snapshot.workItems.length,
        executions: snapshot.agentExecutions.length,
        quarantinedArtifacts: quarantine.length,
      });
      return snapshot;
    } catch (error) {
      const retryAt = new Date(
        now.getTime() + this.config.schedule.frequencyMinutes * 60_000,
      );
      await this.store.recordIngestionError(
        'fullsend-deck-ingestion',
        error,
        now,
        retryAt,
      );
      this.logger.error(
        `Fullsend Deck ingestion failed; retaining previous snapshot: ${safeMessage(
          error,
        )}`,
      );
      return null;
    }
  }

  private async collectSources(now: Date): Promise<SourceCollection[]> {
    const results = await Promise.allSettled(
      this.sources.map(source => source.collect(now)),
    );
    return results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        source: `source-${index + 1}`,
        workItems: [],
        runs: [],
        attemptedAt: now.toISOString(),
        succeededAt: null,
        rateLimitRemaining: null,
        diagnostics: [
          {
            source: `source-${index + 1}`,
            level: 'error',
            message: safeMessage(result.reason),
          },
        ],
      };
    });
  }
}

function buildSyncStatus(
  snapshotAt: string,
  collections: SourceCollection[],
  quarantinedArtifacts: number,
  diagnostics: PartialData['diagnostics'],
): SyncStatus {
  const configured = collections.map(collection => ({
    source: collection.source,
    state: collectionState(collection),
    lastAttemptAt: collection.attemptedAt,
    lastSuccessAt: collection.succeededAt,
    error:
      collection.diagnostics.map(diagnostic => diagnostic.message).join('; ') ||
      null,
    coverage: collectionCoverage(collection),
    rateLimitRemaining: collection.rateLimitRemaining,
  }));
  return {
    snapshotAt,
    state: overallSyncState(collections, diagnostics),
    parserVersion: TELEMETRY_PARSER_VERSION,
    quarantinedArtifacts,
    sources: [
      ...configured,
      {
        source: 'gitlab',
        state: 'unsupported',
        lastAttemptAt: null,
        lastSuccessAt: null,
        error: 'GitLab ingestion is not implemented',
        coverage: null,
        rateLimitRemaining: null,
      },
      {
        source: 'jira',
        state: 'unsupported',
        lastAttemptAt: null,
        lastSuccessAt: null,
        error: 'Jira ingestion is not implemented',
        coverage: null,
        rateLimitRemaining: null,
      },
    ],
  };
}

function collectionState(
  collection: SourceCollection,
): 'healthy' | 'partial' | 'failed' {
  if (!collection.succeededAt) return 'failed';
  return collection.diagnostics.length === 0 ? 'healthy' : 'partial';
}

function collectionCoverage(collection: SourceCollection): number {
  if (collection.runs.length + collection.workItems.length === 0) return 0;
  return collection.diagnostics.length === 0 ? 1 : 0.5;
}

function overallSyncState(
  collections: SourceCollection[],
  diagnostics: PartialData['diagnostics'],
): SyncStatus['state'] {
  if (collections.length === 0) return 'empty';
  return diagnostics.length > 0 ? 'partial' : 'healthy';
}

function applyExecutionState(
  workItems: WorkItem[],
  executions: AgentExecution[],
  links: ExecutionWorkItemLink[],
  workflows: WorkflowRun[],
): WorkItem[] {
  const executionsById = new Map(
    executions.map(execution => [execution.id, execution]),
  );
  const workflowsById = new Map(workflows.map(run => [run.id, run]));
  return workItems.map(item => {
    const linked = links
      .filter(link => link.workItemId === item.id)
      .map(link => executionsById.get(link.executionId))
      .filter((execution): execution is AgentExecution => Boolean(execution))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    const latest = linked[0];
    if (!latest) return item;
    const workflow = workflowsById.get(latest.workflowRunId);
    const automationState = latest.status;
    const failed = latest.status === 'failed';
    return {
      ...item,
      automationState,
      reasonCodes: deterministicUnique(
        [
          ...item.reasonCodes,
          ...(failed ? ['AGENT_EXECUTION_FAILED'] : []),
          ...(workflow?.status === 'failed' ? ['WORKFLOW_FAILED'] : []),
        ],
        value => value,
      ),
      nextAction: failed
        ? {
            kind: 'inspect_execution',
            label: 'Inspect failed agent execution',
            url: workflow?.url ?? item.url,
          }
        : item.nextAction,
      priority: failed
        ? {
            score: Math.min(100, item.priority.score + 40),
            summary: 'Failed automation is ready for inspection',
            factors: deterministicUnique(
              [
                ...item.priority.factors,
                {
                  code: 'AUTOMATION_FAILED',
                  label: 'Automation failed',
                  points: 40,
                },
              ],
              factor => factor.code,
            ),
          }
        : item.priority,
    };
  });
}

function deterministicUnique<T>(values: T[], key: (value: T) => string): T[] {
  const unique = new Map<string, T>();
  for (const value of values) unique.set(key(value), value);
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function safeMessage(error: unknown): string {
  const value =
    error instanceof Error ? error.message : 'Unknown ingestion error';
  return value.replace(
    /(token|authorization|password)=?[^\s,]*/gi,
    '$1=[redacted]',
  );
}
