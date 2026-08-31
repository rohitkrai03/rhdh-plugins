import { fixtureWorkItem } from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import type { ArtifactRun } from '../domain/types';
import { correlateExecution, parseArtifactRun } from './telemetry';

const run = (files: ArtifactRun['files']): ArtifactRun => ({
  sourceKey: 'fixture:7001',
  repository: 'fullsend-dev/fullsend',
  entityRef: 'component:default/fullsend',
  providerRunId: '7001',
  url: 'https://github.com/fullsend-dev/fullsend/actions/runs/7001',
  branch: 'fullsend/issue-42',
  conclusion: 'success',
  createdAt: '2026-08-31T11:00:00.000Z',
  files,
});

const attribute = (key: string, value: string | number) => ({
  key,
  value:
    typeof value === 'number'
      ? { intValue: String(value) }
      : { stringValue: value },
});

describe('Fullsend telemetry ingestion', () => {
  it('prefers canonical telemetry and separates workflow from agent status', () => {
    const telemetry = JSON.stringify({
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  name: 'run',
                  traceId: 'trace-7001',
                  startTimeUnixNano: '1788174000000000000',
                  endTimeUnixNano: '1788174300000000000',
                  attributes: [
                    attribute('fullsend.agent', 'codex'),
                    attribute(
                      'fullsend.work_item_id',
                      'fullsend-dev/fullsend#42',
                    ),
                    attribute('gen_ai.request.model', 'gpt-5'),
                    attribute('exit_code', 1),
                    attribute('fullsend.cost_usd', '1.25'),
                    attribute('gen_ai.usage.input_tokens', 1200),
                    attribute('gen_ai.usage.output_tokens', 300),
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const parsed = parseArtifactRun(run({ 'run-telemetry.jsonl': telemetry }));

    expect(parsed.workflowRun.status).toBe('succeeded');
    expect(parsed.agentExecution.status).toBe('failed');
    expect(parsed.agentExecution.telemetrySource).toBe('run-telemetry.jsonl');
    expect(parsed.agentExecution.usage.costUsd).toBe(1.25);
    expect(
      correlateExecution(
        parsed.agentExecution,
        [fixtureWorkItem],
        run({}).branch,
      ),
    ).toMatchObject({ method: 'canonical', confidence: 1 });
  });

  it('falls back to legacy artifacts and labels branch matching heuristic', () => {
    const parsed = parseArtifactRun(
      run({
        'run-telemetry.jsonl': '{malformed',
        'run-summary.json': JSON.stringify({
          agent: 'claude',
          model: 'sonnet',
          exit_code: 0,
          usage: { cost: 0.5, input_tokens: 20 },
        }),
      }),
    );

    expect(parsed.agentExecution.telemetrySource).toBe('run-summary.json');
    expect(parsed.agentExecution.completeness).toBe('partial');
    expect(parsed.parseFailures[0]).toContain('run-telemetry.jsonl');
    expect(
      correlateExecution(
        parsed.agentExecution,
        [fixtureWorkItem],
        run({}).branch,
      ),
    ).toMatchObject({ method: 'heuristic', confidence: 0.6 });
  });

  it('rejects artifacts with no supported telemetry', () => {
    expect(() =>
      parseArtifactRun(run({ 'output.jsonl': 'human text' })),
    ).toThrow('no supported telemetry record');
  });
});
