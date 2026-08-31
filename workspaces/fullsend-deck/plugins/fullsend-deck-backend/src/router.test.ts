import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  fixtureAgentExecution,
  fixtureLink,
  fixturePartial,
  fixtureSnapshotAt,
  fixtureSync,
  fixtureWorkItem,
  fixtureWorkflowRun,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import express from 'express';
import request from 'supertest';
import type { Snapshot } from './domain/types';
import { createRouter } from './router';

const snapshot: Snapshot = {
  id: 'snapshot-1',
  ingestionKey: 'ingestion-1',
  snapshotAt: fixtureSnapshotAt,
  workItems: [fixtureWorkItem],
  workflowRuns: [fixtureWorkflowRun],
  agentExecutions: [fixtureAgentExecution],
  links: [fixtureLink],
  sync: fixtureSync,
  partial: fixturePartial,
};

describe('Fullsend Deck router', () => {
  const createApp = async (options?: {
    value?: Snapshot | null;
    denied?: boolean;
  }) => {
    const permissions = mockServices.permissions.mock({
      authorize: jest.fn().mockResolvedValue([
        {
          result: options?.denied
            ? AuthorizeResult.DENY
            : AuthorizeResult.ALLOW,
        },
      ]),
    });
    const app = express();
    app.use(
      await createRouter({
        httpAuth: mockServices.httpAuth(),
        permissions,
        auditor: mockServices.auditor.mock(),
        store: {
          readLatestSnapshot: jest
            .fn()
            .mockResolvedValue(
              options?.value === undefined ? snapshot : options.value,
            ),
        },
        now: () => new Date(fixtureSnapshotAt),
      }),
    );
    app.use(mockErrorHandler());
    return { app, permissions };
  };

  it('returns runtime-versioned overview without conflating outcomes', async () => {
    const { app } = await createApp();
    const response = await request(app).get('/v1/overview?window=24h');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      schemaVersion: '1',
      snapshotId: 'snapshot-1',
      work: { byReadiness: { actionable: 1 } },
      executions: { workflows: 1, agentExecutions: 1, failed: 1 },
      cost: { totalUsd: 1.25 },
    });
    expect(response.body.sync.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: 'unsupported' }),
      ]),
    );
  });

  it('supports entity-scoped work and stable snapshot cursors', async () => {
    const { app } = await createApp();
    await request(app)
      .get('/v1/work-items?entityRef=component:default/fullsend')
      .expect(200)
      .expect(response => {
        expect(response.body.items).toHaveLength(1);
      });
    await request(app)
      .get('/v1/work-items?entityRef=component:default/other')
      .expect(200)
      .expect(response => {
        expect(response.body.items).toHaveLength(0);
      });
    await request(app)
      .get('/v1/work-items?cursor=not-a-cursor')
      .expect(400, {
        error: {
          code: 'INVALID_CURSOR',
          message: 'Cursor does not belong to the current snapshot',
        },
      });
  });

  it('returns linked execution evidence for encoded work item IDs', async () => {
    const { app } = await createApp();
    const response = await request(app).get(
      `/v1/work-items/${encodeURIComponent(fixtureWorkItem.id)}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.executions).toEqual([fixtureAgentExecution]);
    expect(response.body.links).toEqual([fixtureLink]);
  });

  it('fails closed without authentication or permission', async () => {
    const { app } = await createApp();
    const unauthenticated = await request(app)
      .get('/v1/overview')
      .set('Authorization', mockCredentials.none.header());
    expect(unauthenticated.status).toBe(401);

    const denied = await createApp({ denied: true });
    const forbidden = await request(denied.app).get('/v1/overview');
    expect(forbidden.status).toBe(403);
  });

  it('reports unavailable snapshots without triggering ingestion', async () => {
    const { app } = await createApp({ value: null });
    const response = await request(app).get('/v1/sync-status');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: 'SNAPSHOT_UNAVAILABLE',
        message: 'No completed ingestion snapshot is available',
      },
    });
  });

  it('leaves only health unauthenticated', async () => {
    const { app, permissions } = await createApp();
    await request(app)
      .get('/health')
      .set('Authorization', mockCredentials.none.header())
      .expect(200, { status: 'ok' });
    expect(permissions.authorize).not.toHaveBeenCalled();
  });
});
