import {
  mockCredentials,
  mockServices,
  startTestBackend,
} from '@backstage/backend-test-utils';
import request from 'supertest';
import { fullsendDeckPlugin } from './plugin';

describe('Fullsend Deck backend plugin', () => {
  it('loads migrations, auth policy, permission, and routes', async () => {
    const { server } = await startTestBackend({
      features: [
        fullsendDeckPlugin,
        mockServices.rootConfig.factory({
          data: { fullsendDeck: { enabled: false } },
        }),
      ],
    });

    const health = await request(server).get('/api/fullsend-deck/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    const overview = await request(server)
      .get('/api/fullsend-deck/v1/overview')
      .set('Authorization', mockCredentials.user.header());
    expect(overview.status).toBe(503);
    expect(overview.body).toEqual({
      error: {
        code: 'SNAPSHOT_UNAVAILABLE',
        message: 'No completed ingestion snapshot is available',
      },
    });
  });
});
