import { z } from 'zod/v3';

export const API_SCHEMA_VERSION = '1' as const;
export const TELEMETRY_PARSER_VERSION = 'otel-v1+legacy-v1' as const;

const timestampSchema = z.string().datetime({ offset: true });
const urlSchema = z.string().url();

export const workSourceSchema = z.enum(['github', 'gitlab', 'jira']);
export const workKindSchema = z.enum([
  'pull_request',
  'issue',
  'external_ticket',
]);
export const lifecycleSchema = z.enum(['open', 'closed', 'merged']);
export const readinessSchema = z.enum([
  'actionable',
  'waiting',
  'blocked',
  'done',
]);
export const automationStateSchema = z.enum([
  'idle',
  'running',
  'succeeded',
  'failed',
  'unknown',
]);
export const checksStateSchema = z.enum([
  'pending',
  'passed',
  'failed',
  'unknown',
]);
export const timeWindowSchema = z.enum(['24h', '7d', '30d']);

export const evidenceSchema = z
  .object({
    type: z.string().min(1),
    source: z.string().min(1),
    label: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    url: urlSchema.optional(),
    observedAt: timestampSchema,
  })
  .passthrough();

export const workItemSchema = z
  .object({
    id: z.string().min(1),
    entityRef: z.string().min(1).nullable(),
    source: workSourceSchema,
    kind: workKindSchema,
    repository: z.string().min(1).nullable(),
    number: z.number().int().positive().nullable(),
    title: z.string().min(1),
    url: urlSchema,
    lifecycle: lifecycleSchema,
    readiness: readinessSchema,
    automationState: automationStateSchema,
    checksState: checksStateSchema,
    nextAction: z
      .object({
        kind: z.string().min(1),
        label: z.string().min(1),
        url: urlSchema,
      })
      .nullable(),
    reasonCodes: z.array(z.string().min(1)),
    evidence: z.array(evidenceSchema),
    ownership: z.object({
      assignees: z.array(z.string().min(1)),
      relation: z.enum(['owner', 'assignee', 'reviewer', 'none', 'unknown']),
    }),
    priority: z.object({
      score: z.number().int().min(0).max(100),
      summary: z.string().min(1),
      factors: z.array(
        z.object({
          code: z.string().min(1),
          label: z.string().min(1),
          points: z.number().int(),
        }),
      ),
    }),
    freshness: z.object({
      observedAt: timestampSchema.nullable(),
      snapshotAt: timestampSchema,
      state: z.enum(['current', 'stale', 'unknown']),
    }),
  })
  .passthrough();

export const workflowRunSchema = z
  .object({
    id: z.string().min(1),
    source: workSourceSchema,
    repository: z.string().min(1),
    providerRunId: z.string().min(1),
    url: urlSchema,
    status: z.enum([
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'unknown',
    ]),
    startedAt: timestampSchema,
    completedAt: timestampSchema.nullable(),
    branch: z.string().nullable(),
  })
  .passthrough();

export const usageSchema = z.object({
  costUsd: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative(),
  turns: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  iterations: z.number().int().nonnegative(),
});

export const agentExecutionSchema = z
  .object({
    id: z.string().min(1),
    workflowRunId: z.string().min(1),
    traceId: z.string().min(1).nullable(),
    workItemRef: z.string().min(1).nullable(),
    agent: z.string().min(1),
    model: z.string(),
    status: z.enum(['running', 'succeeded', 'failed', 'unknown']),
    exitCode: z.number().int().nullable(),
    startedAt: timestampSchema,
    completedAt: timestampSchema.nullable(),
    usage: usageSchema,
    telemetrySource: z.enum([
      'run-telemetry.jsonl',
      'run-summary.json',
      'metrics.json',
      'output.jsonl',
    ]),
    parserVersion: z.string().min(1),
    completeness: z.enum(['complete', 'partial']),
  })
  .passthrough();

export const executionWorkItemLinkSchema = z.object({
  executionId: z.string().min(1),
  workItemId: z.string().min(1),
  method: z.enum(['canonical', 'heuristic']),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
});

export const sourceSyncStatusSchema = z.object({
  source: z.string().min(1),
  state: z.enum(['healthy', 'partial', 'failed', 'unsupported']),
  lastAttemptAt: timestampSchema.nullable(),
  lastSuccessAt: timestampSchema.nullable(),
  error: z.string().nullable(),
  coverage: z.number().min(0).max(1).nullable(),
  rateLimitRemaining: z.number().int().nonnegative().nullable(),
});

export const syncStatusSchema = z.object({
  snapshotAt: timestampSchema.nullable(),
  state: z.enum(['healthy', 'partial', 'failed', 'empty']),
  parserVersion: z.string().min(1),
  quarantinedArtifacts: z.number().int().nonnegative(),
  sources: z.array(sourceSyncStatusSchema),
});

export const partialDataSchema = z.object({
  isPartial: z.boolean(),
  diagnostics: z.array(
    z.object({
      source: z.string().min(1),
      level: z.enum(['warning', 'error']),
      message: z.string().min(1),
    }),
  ),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    fields: z.record(z.array(z.string())).optional(),
  }),
});

const responseMeta = {
  schemaVersion: z.literal(API_SCHEMA_VERSION),
  snapshotId: z.string().min(1),
  snapshotAt: timestampSchema,
  partial: partialDataSchema,
};

export const workItemsResponseSchema = z.object({
  ...responseMeta,
  items: z.array(workItemSchema),
  nextCursor: z.string().nullable(),
});

export const workItemDetailResponseSchema = z.object({
  ...responseMeta,
  item: workItemSchema,
  executions: z.array(agentExecutionSchema),
  links: z.array(executionWorkItemLinkSchema),
});

export const executionsResponseSchema = z.object({
  ...responseMeta,
  workflowRuns: z.array(workflowRunSchema),
  agentExecutions: z.array(agentExecutionSchema),
  links: z.array(executionWorkItemLinkSchema),
  nextCursor: z.string().nullable(),
});

export const overviewResponseSchema = z.object({
  ...responseMeta,
  window: timeWindowSchema,
  scope: z.string().nullable(),
  work: z.object({
    total: z.number().int().nonnegative(),
    byReadiness: z.record(readinessSchema, z.number().int().nonnegative()),
  }),
  executions: z.object({
    workflows: z.number().int().nonnegative(),
    agentExecutions: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    successRate: z.number().min(0).max(100),
  }),
  cost: z.object({ totalUsd: z.number().nonnegative() }),
  sync: syncStatusSchema,
});

export const syncStatusResponseSchema = z.object({
  ...responseMeta,
  sync: syncStatusSchema,
});

export const workItemsQuerySchema = z.object({
  entityRef: z.string().trim().min(1).max(500).optional(),
  source: workSourceSchema.optional(),
  repository: z.string().trim().min(1).max(300).optional(),
  readiness: readinessSchema.optional(),
  ownership: z.enum(['mine', 'unassigned', 'all']).default('all'),
  search: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const windowedQuerySchema = z.object({
  entityRef: z.string().trim().min(1).max(500).optional(),
  scope: z.string().trim().min(1).max(300).optional(),
  window: timeWindowSchema.default('7d'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type WorkItem = z.infer<typeof workItemSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type AgentExecution = z.infer<typeof agentExecutionSchema>;
export type ExecutionWorkItemLink = z.infer<typeof executionWorkItemLinkSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type PartialData = z.infer<typeof partialDataSchema>;
export type WorkItemsResponse = z.infer<typeof workItemsResponseSchema>;
export type WorkItemDetailResponse = z.infer<
  typeof workItemDetailResponseSchema
>;
export type ExecutionsResponse = z.infer<typeof executionsResponseSchema>;
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
export type SyncStatusResponse = z.infer<typeof syncStatusResponseSchema>;
