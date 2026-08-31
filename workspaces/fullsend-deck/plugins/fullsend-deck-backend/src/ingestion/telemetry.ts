import {
  TELEMETRY_PARSER_VERSION,
  type AgentExecution,
  type ExecutionWorkItemLink,
  type WorkItem,
  type WorkflowRun,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import type { ArtifactRun } from '../domain/types';

interface OtlpSpan {
  attributes?: Array<{ key?: unknown; value?: Record<string, unknown> }>;
  endTimeUnixNano?: unknown;
  name?: unknown;
  parentSpanId?: unknown;
  startTimeUnixNano?: unknown;
  traceId?: unknown;
}

interface ParsedTelemetry {
  source: AgentExecution['telemetrySource'];
  agent: string;
  model: string;
  traceId: string | null;
  workItemRef: string | null;
  exitCode: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completeness: 'complete' | 'partial';
  usage: AgentExecution['usage'];
}

export interface ParsedRun {
  workflowRun: WorkflowRun;
  agentExecution: AgentExecution;
  parseFailures: string[];
}

export function parseArtifactRun(run: ArtifactRun): ParsedRun {
  const failures: string[] = [];
  const attempts: Array<{
    name: AgentExecution['telemetrySource'];
    value: string | undefined;
    parse: (text: string) => ParsedTelemetry | null;
  }> = [
    {
      name: 'run-telemetry.jsonl',
      value: run.files['run-telemetry.jsonl'],
      parse: text => parseOtelJsonl(text),
    },
    {
      name: 'run-summary.json',
      value: run.files['run-summary.json'],
      parse: text => parseLegacyJson(text, 'run-summary.json'),
    },
    {
      name: 'metrics.json',
      value: run.files['metrics.json'],
      parse: text => parseLegacyJson(text, 'metrics.json'),
    },
    {
      name: 'output.jsonl',
      value: run.files['output.jsonl'],
      parse: text => parseOutputJsonl(text),
    },
  ];

  let parsed: ParsedTelemetry | null = null;
  for (const attempt of attempts) {
    if (!attempt.value) continue;
    try {
      parsed = attempt.parse(attempt.value);
      if (parsed) break;
      failures.push(`${attempt.name}: no supported telemetry record`);
    } catch (error) {
      failures.push(`${attempt.name}: ${safeMessage(error)}`);
    }
  }
  if (!parsed) {
    throw new Error(
      failures.length > 0
        ? failures.join('; ')
        : 'No supported Fullsend telemetry artifact was found',
    );
  }

  const workflowRunId = `github:${run.repository}:workflow:${run.providerRunId}`;
  const startedAt = parsed.startedAt ?? run.createdAt;
  const completedAt = parsed.completedAt ?? run.createdAt;
  const workflowRun: WorkflowRun = {
    id: workflowRunId,
    source: 'github',
    repository: run.repository,
    providerRunId: run.providerRunId,
    url: run.url,
    status: workflowStatus(run.conclusion),
    startedAt,
    completedAt,
    branch: run.branch,
  };
  const agentExecution: AgentExecution = {
    id: `${workflowRunId}:agent:${encodeURIComponent(parsed.agent)}:${
      parsed.traceId ?? parsed.source
    }`,
    workflowRunId,
    traceId: parsed.traceId,
    workItemRef: parsed.workItemRef,
    agent: parsed.agent,
    model: parsed.model,
    status: executionStatus(parsed.exitCode),
    exitCode: parsed.exitCode,
    startedAt,
    completedAt,
    usage: parsed.usage,
    telemetrySource: parsed.source,
    parserVersion: TELEMETRY_PARSER_VERSION,
    completeness: parsed.completeness,
  };
  return { workflowRun, agentExecution, parseFailures: failures };
}

export function correlateExecution(
  execution: AgentExecution,
  workItems: WorkItem[],
  branch: string | null,
): ExecutionWorkItemLink | null {
  if (execution.workItemRef) {
    const item = workItems.find(candidate =>
      canonicalRefs(candidate).includes(execution.workItemRef!),
    );
    if (item) {
      return {
        executionId: execution.id,
        workItemId: item.id,
        method: 'canonical',
        confidence: 1,
        evidence: [
          {
            type: 'span_attribute',
            source: execution.telemetrySource,
            label: 'fullsend.work_item_id',
            value: execution.workItemRef,
            observedAt: execution.completedAt ?? execution.startedAt,
          },
        ],
      };
    }
  }
  if (!branch) return null;
  const item = workItems.find(
    candidate =>
      candidate.source === 'github' &&
      candidate.repository &&
      candidate.evidence.some(
        entry => entry.type === 'branch' && entry.value === branch,
      ),
  );
  return item
    ? {
        executionId: execution.id,
        workItemId: item.id,
        method: 'heuristic',
        confidence: 0.6,
        evidence: [
          {
            type: 'branch',
            source: 'github',
            label: 'Matching workflow branch (heuristic)',
            value: branch,
            observedAt: execution.completedAt ?? execution.startedAt,
          },
        ],
      }
    : null;
}

function parseOtelJsonl(text: string): ParsedTelemetry | null {
  const spans: OtlpSpan[] = [];
  let malformed = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      collectSpans(JSON.parse(line), spans);
    } catch {
      malformed += 1;
    }
  }
  const root =
    spans.find(span => span.name === 'run') ??
    spans.find(span => attributes(span).has('fullsend.work_item_id')) ??
    spans.find(span => !span.parentSpanId);
  if (!root) return null;
  const attrs = attributes(root);
  const agent =
    stringValue(attrs.get('fullsend.agent')) ||
    stringValue(attrs.get('gen_ai.agent.name')) ||
    'unknown-agent';
  const workItem = stringValue(attrs.get('fullsend.work_item_id'));
  const workItemRef =
    workItem && workItem.toLowerCase() !== 'unknown' ? workItem : null;
  const model = stringValue(attrs.get('gen_ai.request.model'));
  const startedAt = nanosToIso(root.startTimeUnixNano);
  const completedAt = nanosToIso(root.endTimeUnixNano);
  const traceId = stringValue(root.traceId) || null;
  const exitCode = nullableNumber(attrs.get('exit_code'));
  return {
    source: 'run-telemetry.jsonl',
    agent,
    model,
    traceId,
    workItemRef,
    exitCode,
    startedAt,
    completedAt,
    completeness:
      malformed === 0 && model && workItemRef && startedAt && completedAt
        ? 'complete'
        : 'partial',
    usage: {
      costUsd: numberValue(attrs.get('fullsend.cost_usd')),
      inputTokens: integerValue(attrs.get('gen_ai.usage.input_tokens')),
      outputTokens: integerValue(attrs.get('gen_ai.usage.output_tokens')),
      cacheReadTokens: integerValue(
        attrs.get('gen_ai.usage.cache_read.input_tokens'),
      ),
      cacheCreationTokens: integerValue(
        attrs.get('gen_ai.usage.cache_creation.input_tokens'),
      ),
      turns: integerValue(attrs.get('fullsend.num_turns')),
      toolCalls: integerValue(attrs.get('fullsend.tool_calls')),
      iterations: integerValue(attrs.get('fullsend.iterations')),
    },
  };
}

function parseLegacyJson(
  text: string,
  source: 'run-summary.json' | 'metrics.json',
): ParsedTelemetry | null {
  const document = JSON.parse(text) as Record<string, unknown>;
  const usage = recordValue(document.usage) ?? document;
  const result = recordValue(document.result) ?? document;
  const agent = stringValue(document.agent) || 'unknown-agent';
  const model = stringValue(usage.model ?? document.model);
  const workItem = stringValue(
    document.work_item_id ?? document.workItemId ?? document.work_item,
  );
  const exitCode = nullableNumber(result.exit_code ?? document.exit_code);
  if (!model && !workItem && exitCode === null) return null;
  return {
    source,
    agent,
    model,
    traceId: stringValue(document.trace_id ?? document.traceId) || null,
    workItemRef: workItem || null,
    exitCode,
    startedAt: isoValue(document.started_at ?? document.startedAt),
    completedAt: isoValue(document.completed_at ?? document.completedAt),
    completeness: 'partial',
    usage: {
      costUsd: numberValue(usage.cost_usd ?? usage.cost),
      inputTokens: integerValue(usage.input_tokens ?? usage.inputTokens),
      outputTokens: integerValue(usage.output_tokens ?? usage.outputTokens),
      cacheReadTokens: integerValue(
        usage.cache_read_tokens ?? usage.cacheReadTokens,
      ),
      cacheCreationTokens: integerValue(
        usage.cache_creation_tokens ?? usage.cacheCreationTokens,
      ),
      turns: integerValue(usage.turns),
      toolCalls: integerValue(usage.tool_calls ?? usage.toolCalls),
      iterations: integerValue(usage.iterations),
    },
  };
}

function parseOutputJsonl(text: string): ParsedTelemetry | null {
  const documents: Record<string, unknown>[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (recordValue(parsed)) documents.push(parsed);
    } catch {
      // Compatibility input may contain human-readable lines.
    }
  }
  for (const document of documents.reverse()) {
    const parsed = parseLegacyJson(JSON.stringify(document), 'metrics.json');
    if (parsed) return { ...parsed, source: 'output.jsonl' };
  }
  return null;
}

function canonicalRefs(item: WorkItem): string[] {
  const refs = [item.id, item.url];
  if (item.repository && item.number) {
    refs.push(`${item.repository}#${item.number}`);
  }
  return refs;
}

function collectSpans(document: unknown, output: OtlpSpan[]): void {
  const root = recordValue(document);
  if (!root || !Array.isArray(root.resourceSpans)) return;
  for (const resource of root.resourceSpans) {
    const resourceRecord = recordValue(resource);
    if (!resourceRecord || !Array.isArray(resourceRecord.scopeSpans)) continue;
    for (const scope of resourceRecord.scopeSpans) {
      const scopeRecord = recordValue(scope);
      if (!scopeRecord || !Array.isArray(scopeRecord.spans)) continue;
      for (const span of scopeRecord.spans) {
        if (recordValue(span)) output.push(span as OtlpSpan);
      }
    }
  }
}

function attributes(span: OtlpSpan): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const attribute of span.attributes ?? []) {
    if (typeof attribute.key !== 'string') continue;
    const value = recordValue(attribute.value);
    if (!value) continue;
    result.set(
      attribute.key,
      value.stringValue ??
        value.intValue ??
        value.doubleValue ??
        value.boolValue,
    );
  }
  return result;
}

function workflowStatus(conclusion: string | null): WorkflowRun['status'] {
  if (conclusion === 'success') return 'succeeded';
  if (conclusion === 'cancelled') return 'cancelled';
  if (conclusion) return 'failed';
  return 'unknown';
}

function executionStatus(exitCode: number | null): AgentExecution['status'] {
  if (exitCode === null) return 'unknown';
  return exitCode === 0 ? 'succeeded' : 'failed';
}

function nanosToIso(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  try {
    return new Date(Number(BigInt(value) / 1_000_000n)).toISOString();
  } catch {
    return null;
  }
}

function isoValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function integerValue(value: unknown): number {
  return Math.max(0, Math.trunc(numberValue(value)));
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Invalid artifact';
}
