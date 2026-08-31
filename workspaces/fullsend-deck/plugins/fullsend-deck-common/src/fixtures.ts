import type {
  AgentExecution,
  ExecutionWorkItemLink,
  PartialData,
  SyncStatus,
  WorkItem,
  WorkflowRun,
} from './contracts';

export const fixtureSnapshotAt = '2026-08-31T12:00:00.000Z';

export const fixtureWorkItem: WorkItem = {
  id: 'github:fullsend-dev/fullsend:pull_request:42',
  entityRef: 'component:default/fullsend',
  source: 'github',
  kind: 'pull_request',
  repository: 'fullsend-dev/fullsend',
  number: 42,
  title: 'Keep workflow and agent outcomes distinct',
  url: 'https://github.com/fullsend-dev/fullsend/pull/42',
  lifecycle: 'open',
  readiness: 'actionable',
  automationState: 'failed',
  checksState: 'passed',
  nextAction: {
    kind: 'inspect_execution',
    label: 'Inspect failed agent execution',
    url: 'https://github.com/fullsend-dev/fullsend/actions/runs/7001',
  },
  reasonCodes: ['AGENT_EXECUTION_FAILED'],
  evidence: [
    {
      type: 'branch',
      source: 'github',
      label: 'Head branch',
      value: 'fullsend/issue-42',
      observedAt: fixtureSnapshotAt,
    },
  ],
  ownership: { assignees: ['octocat'], relation: 'assignee' },
  priority: {
    score: 80,
    summary: 'Failed automation is ready for inspection',
    factors: [
      { code: 'AUTOMATION_FAILED', label: 'Automation failed', points: 40 },
    ],
  },
  freshness: {
    observedAt: fixtureSnapshotAt,
    snapshotAt: fixtureSnapshotAt,
    state: 'current',
  },
};

export const fixtureWorkflowRun: WorkflowRun = {
  id: 'github:fullsend-dev/fullsend:workflow:7001',
  source: 'github',
  repository: 'fullsend-dev/fullsend',
  providerRunId: '7001',
  url: 'https://github.com/fullsend-dev/fullsend/actions/runs/7001',
  status: 'succeeded',
  startedAt: '2026-08-31T11:00:00.000Z',
  completedAt: '2026-08-31T11:05:00.000Z',
  branch: 'fullsend/issue-42',
};

export const fixtureAgentExecution: AgentExecution = {
  id: `${fixtureWorkflowRun.id}:agent:codex:trace-7001`,
  workflowRunId: fixtureWorkflowRun.id,
  traceId: 'trace-7001',
  workItemRef: 'fullsend-dev/fullsend#42',
  agent: 'codex',
  model: 'gpt-5',
  status: 'failed',
  exitCode: 1,
  startedAt: fixtureWorkflowRun.startedAt,
  completedAt: fixtureWorkflowRun.completedAt,
  usage: {
    costUsd: 1.25,
    inputTokens: 1200,
    outputTokens: 300,
    cacheReadTokens: 50,
    cacheCreationTokens: 20,
    turns: 3,
    toolCalls: 8,
    iterations: 2,
  },
  telemetrySource: 'run-telemetry.jsonl',
  parserVersion: 'otel-v1+legacy-v1',
  completeness: 'complete',
};

export const fixtureLink: ExecutionWorkItemLink = {
  executionId: fixtureAgentExecution.id,
  workItemId: fixtureWorkItem.id,
  method: 'canonical',
  confidence: 1,
  evidence: [
    {
      type: 'span_attribute',
      source: 'run-telemetry.jsonl',
      label: 'fullsend.work_item_id',
      value: 'fullsend-dev/fullsend#42',
      observedAt: fixtureWorkflowRun.completedAt!,
    },
  ],
};

export const fixtureSync: SyncStatus = {
  snapshotAt: fixtureSnapshotAt,
  state: 'partial',
  parserVersion: 'otel-v1+legacy-v1',
  quarantinedArtifacts: 0,
  sources: [
    {
      source: 'github',
      state: 'healthy',
      lastAttemptAt: fixtureSnapshotAt,
      lastSuccessAt: fixtureSnapshotAt,
      error: null,
      coverage: 1,
      rateLimitRemaining: 4999,
    },
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

export const fixturePartial: PartialData = {
  isPartial: true,
  diagnostics: [
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
  ],
};
