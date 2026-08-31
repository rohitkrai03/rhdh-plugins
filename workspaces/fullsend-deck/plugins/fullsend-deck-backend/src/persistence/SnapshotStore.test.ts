import { mockServices, TestDatabases } from '@backstage/backend-test-utils';
import {
  fixtureAgentExecution,
  fixtureLink,
  fixturePartial,
  fixtureSnapshotAt,
  fixtureSync,
  fixtureWorkItem,
  fixtureWorkflowRun,
  TELEMETRY_PARSER_VERSION,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import { randomUUID } from 'node:crypto';
import { SnapshotStore } from './SnapshotStore';

const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

describe('SnapshotStore', () => {
  it('migrates, round-trips, and idempotently replays a snapshot', async () => {
    const knex = await databases.init('SQLITE_3');
    const store = await SnapshotStore.create(
      mockServices.database.mock({
        getClient: async () => knex,
        migrations: { skip: false },
      }),
    );
    const input = {
      ingestionKey: 'fixture-key',
      snapshotAt: fixtureSnapshotAt,
      workItems: [fixtureWorkItem],
      workflowRuns: [fixtureWorkflowRun],
      agentExecutions: [fixtureAgentExecution],
      links: [fixtureLink],
      sync: fixtureSync,
      partial: fixturePartial,
    };

    const first = await store.writeSnapshot(input);
    const replay = await store.writeSnapshot(input);
    expect(replay.id).toBe(first.id);
    expect(await store.readLatestSnapshot()).toEqual(first);
  });

  it('rolls back incomplete writes and keeps the prior completed snapshot', async () => {
    const knex = await databases.init('SQLITE_3');
    const store = await SnapshotStore.create(
      mockServices.database.mock({
        getClient: async () => knex,
        migrations: { skip: false },
      }),
    );
    const stable = await store.writeSnapshot({
      ingestionKey: 'stable-key',
      snapshotAt: fixtureSnapshotAt,
      workItems: [fixtureWorkItem],
      workflowRuns: [fixtureWorkflowRun],
      agentExecutions: [fixtureAgentExecution],
      links: [fixtureLink],
      sync: fixtureSync,
      partial: fixturePartial,
    });
    const circularWorkItem = {
      ...fixtureWorkItem,
    } as typeof fixtureWorkItem & {
      self?: unknown;
    };
    circularWorkItem.self = circularWorkItem;

    await expect(
      store.writeSnapshot({
        ingestionKey: `broken-${randomUUID()}`,
        snapshotAt: '2026-08-31T13:00:00.000Z',
        workItems: [circularWorkItem],
        workflowRuns: [fixtureWorkflowRun],
        agentExecutions: [fixtureAgentExecution],
        links: [fixtureLink],
        sync: fixtureSync,
        partial: fixturePartial,
      }),
    ).rejects.toThrow();
    expect((await store.readLatestSnapshot())?.id).toBe(stable.id);
  });

  it('clears every parser-version failure after an artifact recovers', async () => {
    const knex = await databases.init('SQLITE_3');
    const store = await SnapshotStore.create(
      mockServices.database.mock({
        getClient: async () => knex,
        migrations: { skip: false },
      }),
    );
    await store.quarantine(
      'artifact-1',
      'otel-v0',
      'old parser failure',
      fixtureSnapshotAt,
    );
    await store.quarantine(
      'artifact-1',
      TELEMETRY_PARSER_VERSION,
      'new parser failure',
      fixtureSnapshotAt,
    );
    await store.clearQuarantineForArtifact('artifact-1');

    expect(await store.listQuarantine()).toEqual([]);
  });
});
