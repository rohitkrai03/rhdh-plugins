import type {
  AgentExecution,
  ExecutionWorkItemLink,
  PartialData,
  SyncStatus,
  WorkItem,
  WorkflowRun,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';

export interface SnapshotWrite {
  ingestionKey: string;
  snapshotAt: string;
  workItems: WorkItem[];
  workflowRuns: WorkflowRun[];
  agentExecutions: AgentExecution[];
  links: ExecutionWorkItemLink[];
  sync: SyncStatus;
  partial: PartialData;
}

export interface Snapshot extends SnapshotWrite {
  id: string;
}

export interface ArtifactRun {
  sourceKey: string;
  repository: string;
  entityRef: string | null;
  providerRunId: string;
  url: string;
  branch: string | null;
  conclusion: string | null;
  createdAt: string;
  files: Partial<
    Record<
      | 'run-telemetry.jsonl'
      | 'run-summary.json'
      | 'metrics.json'
      | 'output.jsonl',
      string
    >
  >;
}

export interface SourceCollection {
  source: string;
  workItems: WorkItem[];
  runs: ArtifactRun[];
  attemptedAt: string;
  succeededAt: string | null;
  rateLimitRemaining: number | null;
  diagnostics: Array<{
    source: string;
    level: 'warning' | 'error';
    message: string;
  }>;
}

export interface QuarantineRecord {
  artifactKey: string;
  parserVersion: string;
  reason: string;
  failedAt: string;
  retryCount: number;
}
