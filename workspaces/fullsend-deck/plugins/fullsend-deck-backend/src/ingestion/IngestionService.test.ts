import { mockServices } from '@backstage/backend-test-utils';
import { fixtureWorkItem } from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import type { FullsendDeckConfig } from '../config';
import type { ArtifactRun, Snapshot } from '../domain/types';
import type { ArtifactSource } from './ArtifactSources';
import { IngestionService } from './IngestionService';

const config: FullsendDeckConfig = {
  enabled: true,
  filesystemDirectory: null,
  githubRepositories: [],
  githubArtifactNamePrefix: 'fullsend',
  maxArtifactsPerRepository: 25,
  schedule: {
    frequencyMinutes: 5,
    timeoutMinutes: 4,
    initialDelaySeconds: 5,
  },
};

const artifact: ArtifactRun = {
  sourceKey: 'fixture:7001',
  repository: 'fullsend-dev/fullsend',
  entityRef: 'component:default/fullsend',
  providerRunId: '7001',
  url: 'https://github.com/fullsend-dev/fullsend/actions/runs/7001',
  branch: 'fullsend/issue-42',
  conclusion: 'success',
  createdAt: '2026-08-31T11:00:00.000Z',
  files: {
    'run-telemetry.jsonl': JSON.stringify({
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
                    { key: 'fullsend.agent', value: { stringValue: 'codex' } },
                    {
                      key: 'fullsend.work_item_id',
                      value: { stringValue: 'fullsend-dev/fullsend#42' },
                    },
                    {
                      key: 'gen_ai.request.model',
                      value: { stringValue: 'gpt-5' },
                    },
                    { key: 'exit_code', value: { intValue: '1' } },
                    {
                      key: 'fullsend.cost_usd',
                      value: { stringValue: '1.25' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  },
};

describe('IngestionService', () => {
  const createStore = () => {
    let persisted: Snapshot | null = null;
    return {
      store: {
        clearQuarantineForArtifact: jest.fn().mockResolvedValue(undefined),
        listQuarantine: jest.fn().mockResolvedValue([]),
        quarantine: jest.fn().mockResolvedValue(undefined),
        recordIngestionError: jest.fn().mockResolvedValue(undefined),
        writeSnapshot: jest.fn().mockImplementation(async input => {
          persisted = { id: 'snapshot-1', ...input };
          return persisted;
        }),
      },
      persisted: () => persisted,
    };
  };

  it('normalizes a healthy source into a deterministic snapshot', async () => {
    const source: ArtifactSource = {
      source: 'github',
      collect: jest.fn().mockResolvedValue({
        source: 'github',
        workItems: [fixtureWorkItem],
        runs: [artifact],
        attemptedAt: '2026-08-31T12:00:00.000Z',
        succeededAt: '2026-08-31T12:00:00.000Z',
        rateLimitRemaining: 4999,
        diagnostics: [],
      }),
    };
    const { store, persisted } = createStore();
    const service = new IngestionService(
      config,
      store,
      [source],
      mockServices.logger.mock(),
    );

    const result = await service.runOnce(new Date('2026-08-31T12:00:00.000Z'));

    expect(result?.agentExecutions[0].status).toBe('failed');
    expect(result?.workflowRuns[0].status).toBe('succeeded');
    expect(result?.links[0]).toMatchObject({
      method: 'canonical',
      confidence: 1,
    });
    expect(result?.workItems[0]).toMatchObject({
      readiness: 'actionable',
      automationState: 'failed',
    });
    expect(result?.sync.state).toBe('healthy');
    expect(result?.sync.sources).toEqual([
      expect.objectContaining({ source: 'github', state: 'healthy' }),
    ]);
    expect(result?.partial).toEqual({ isPartial: false, diagnostics: [] });
    expect(store.clearQuarantineForArtifact).toHaveBeenCalledWith(
      artifact.sourceKey,
    );
    expect(persisted()?.ingestionKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it('quarantines malformed runs without discarding usable source data', async () => {
    const source: ArtifactSource = {
      source: 'filesystem',
      collect: jest.fn().mockResolvedValue({
        source: 'filesystem',
        workItems: [fixtureWorkItem],
        runs: [{ ...artifact, files: { 'output.jsonl': 'not telemetry' } }],
        attemptedAt: '2026-08-31T12:00:00.000Z',
        succeededAt: '2026-08-31T12:00:00.000Z',
        rateLimitRemaining: null,
        diagnostics: [],
      }),
    };
    const { store } = createStore();
    const service = new IngestionService(
      config,
      store,
      [source],
      mockServices.logger.mock(),
    );

    const result = await service.runOnce(new Date('2026-08-31T12:00:00.000Z'));

    expect(store.quarantine).toHaveBeenCalledWith(
      artifact.sourceKey,
      'otel-v1+legacy-v1',
      expect.any(String),
      '2026-08-31T12:00:00.000Z',
    );
    expect(result?.workItems).toHaveLength(1);
    expect(result?.partial.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: artifact.sourceKey, level: 'error' }),
      ]),
    );
  });

  it('reports a configured source failure by its stable identity', async () => {
    const source: ArtifactSource = {
      source: 'github',
      collect: jest.fn().mockRejectedValue(new Error('GitHub unavailable')),
    };
    const { store } = createStore();
    const service = new IngestionService(
      config,
      store,
      [source],
      mockServices.logger.mock(),
    );

    const result = await service.runOnce(new Date('2026-08-31T12:00:00.000Z'));

    expect(result?.sync.state).toBe('failed');
    expect(result?.sync.sources).toEqual([
      expect.objectContaining({
        source: 'github',
        state: 'failed',
        error: 'GitHub unavailable',
      }),
    ]);
    expect(result?.partial.diagnostics).toEqual([
      expect.objectContaining({
        source: 'github',
        level: 'error',
        message: 'GitHub unavailable',
      }),
    ]);
  });

  it('reports partial health when one configured source still succeeds', async () => {
    const filesystem: ArtifactSource = {
      source: 'filesystem',
      collect: jest.fn().mockResolvedValue({
        source: 'filesystem',
        workItems: [fixtureWorkItem],
        runs: [],
        attemptedAt: '2026-08-31T12:00:00.000Z',
        succeededAt: '2026-08-31T12:00:00.000Z',
        rateLimitRemaining: null,
        diagnostics: [],
      }),
    };
    const github: ArtifactSource = {
      source: 'github',
      collect: jest.fn().mockRejectedValue(new Error('GitHub unavailable')),
    };
    const { store } = createStore();
    const service = new IngestionService(
      config,
      store,
      [filesystem, github],
      mockServices.logger.mock(),
    );

    const result = await service.runOnce(new Date('2026-08-31T12:00:00.000Z'));

    expect(result?.sync.state).toBe('partial');
    expect(result?.sync.sources).toEqual([
      expect.objectContaining({ source: 'filesystem', state: 'healthy' }),
      expect.objectContaining({ source: 'github', state: 'failed' }),
    ]);
  });

  it('registers globally coordinated Backstage scheduling', async () => {
    const { store } = createStore();
    const scheduler = mockServices.scheduler.mock();
    const service = new IngestionService(
      config,
      store,
      [],
      mockServices.logger.mock(),
    );

    await service.schedule(scheduler);

    expect(scheduler.scheduleTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fullsend-deck-ingestion',
        scope: 'global',
        frequency: { minutes: 5 },
        timeout: { minutes: 4 },
        initialDelay: { seconds: 5 },
      }),
    );
  });
});
