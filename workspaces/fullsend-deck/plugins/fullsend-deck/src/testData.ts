import {
  fixtureAgentExecution,
  fixtureLink,
  fixturePartial,
  fixtureSnapshotAt,
  fixtureSync,
  fixtureWorkItem,
  fixtureWorkflowRun,
  type ExecutionsResponse,
  type OverviewResponse,
  type SyncStatusResponse,
  type WorkItemsResponse,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';

const meta = {
  schemaVersion: '1' as const,
  snapshotId: 'snapshot-fixture',
  snapshotAt: fixtureSnapshotAt,
  partial: fixturePartial,
};

export const fixtureOverviewResponse: OverviewResponse = {
  ...meta,
  window: '7d',
  scope: null,
  work: {
    total: 1,
    byReadiness: { actionable: 1, waiting: 0, blocked: 0, done: 0 },
  },
  executions: {
    workflows: 1,
    agentExecutions: 1,
    succeeded: 0,
    failed: 1,
    successRate: 0,
  },
  cost: { totalUsd: 1.25 },
  sync: fixtureSync,
};

export const fixtureWorkItemsResponse: WorkItemsResponse = {
  ...meta,
  items: [fixtureWorkItem],
  nextCursor: null,
};

export const fixtureExecutionsResponse: ExecutionsResponse = {
  ...meta,
  workflowRuns: [fixtureWorkflowRun],
  agentExecutions: [fixtureAgentExecution],
  links: [fixtureLink],
  nextCursor: null,
};

export const fixtureSyncResponse: SyncStatusResponse = {
  ...meta,
  sync: fixtureSync,
};
