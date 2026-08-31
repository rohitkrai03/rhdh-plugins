import { mockServices, TestDatabases } from '@backstage/backend-test-utils';
import {
  fixtureAgentExecution,
  fixtureLink,
  fixturePartial,
  fixtureSnapshotAt,
  fixtureSync,
  fixtureWorkItem,
  fixtureWorkflowRun,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import { SnapshotStore } from './SnapshotStore';

const databases = TestDatabases.create({ ids: ['POSTGRES_16'] });
const describePostgres = databases.supports('POSTGRES_16')
  ? describe
  : describe.skip;

describePostgres('SnapshotStore PostgreSQL', () => {
  it('round-trips and serializes horizontally concurrent ingestion', async () => {
    const knex = await databases.init('POSTGRES_16');
    const database = mockServices.database.mock({
      getClient: async () => knex,
      migrations: { skip: false },
    });
    const firstStore = await SnapshotStore.create(database);
    const secondStore = await SnapshotStore.create(database);
    const input = {
      ingestionKey: 'postgres-concurrent-fixture',
      snapshotAt: fixtureSnapshotAt,
      workItems: [fixtureWorkItem],
      workflowRuns: [fixtureWorkflowRun],
      agentExecutions: [fixtureAgentExecution],
      links: [fixtureLink],
      sync: fixtureSync,
      partial: fixturePartial,
    };

    const [first, second] = await Promise.all([
      firstStore.writeSnapshot(input),
      secondStore.writeSnapshot(input),
    ]);

    expect(second.id).toBe(first.id);
    expect(await firstStore.readLatestSnapshot()).toEqual(first);
  });
});
