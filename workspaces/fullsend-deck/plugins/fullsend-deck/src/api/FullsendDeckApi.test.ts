import type { DiscoveryApi, FetchApi } from '@backstage/frontend-plugin-api';
import {
  fixtureAgentExecution,
  fixtureLink,
  fixtureWorkItem,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import {
  fixtureExecutionsResponse,
  fixtureOverviewResponse,
  fixtureSyncResponse,
  fixtureWorkItemsResponse,
} from '../testData';
import { FullsendDeckClient } from './FullsendDeckApi';

describe('FullsendDeckClient', () => {
  const discoveryApi = {
    getBaseUrl: jest
      .fn()
      .mockResolvedValue('https://backstage.test/api/fullsend-deck'),
  } as unknown as DiscoveryApi;
  const fetch = jest.fn();
  const client = new FullsendDeckClient(discoveryApi, {
    fetch,
  } as unknown as FetchApi);

  beforeEach(() => fetch.mockReset());

  it('runtime-validates all versioned responses and forwards entity scope', async () => {
    fetch
      .mockResolvedValueOnce(ok(fixtureOverviewResponse))
      .mockResolvedValueOnce(ok(fixtureWorkItemsResponse))
      .mockResolvedValueOnce(ok(fixtureExecutionsResponse))
      .mockResolvedValueOnce(ok(fixtureSyncResponse));

    await expect(
      client.getOverview({
        window: '24h',
        entityRef: 'component:default/fullsend',
      }),
    ).resolves.toMatchObject({ schemaVersion: '1' });
    await expect(client.getWorkItems()).resolves.toMatchObject({
      items: [fixtureWorkItem],
    });
    await expect(client.getExecutions()).resolves.toMatchObject({
      agentExecutions: [fixtureAgentExecution],
      links: [fixtureLink],
    });
    await expect(client.getSyncStatus()).resolves.toMatchObject({
      sync: { state: 'partial' },
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://backstage.test/api/fullsend-deck/v1/overview?window=24h&entityRef=component%3Adefault%2Ffullsend',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('encodes work item identities', async () => {
    fetch.mockResolvedValueOnce(
      ok({
        ...fixtureWorkItemsResponse,
        item: fixtureWorkItem,
        items: undefined,
        nextCursor: undefined,
        executions: [fixtureAgentExecution],
        links: [fixtureLink],
      }),
    );
    await client.getWorkItem(fixtureWorkItem.id);
    expect(fetch.mock.calls[0][0]).toContain(
      encodeURIComponent(fixtureWorkItem.id),
    );
  });

  it('rejects incompatible success payloads and uses safe API errors', async () => {
    fetch.mockResolvedValueOnce(ok({ schemaVersion: '0' }));
    await expect(client.getOverview()).rejects.toThrow('incompatible response');

    fetch.mockResolvedValueOnce(
      response(403, {
        error: { code: 'FORBIDDEN', message: 'Read permission is required' },
      }),
    );
    await expect(client.getOverview()).rejects.toThrow(
      'Read permission is required',
    );

    fetch.mockResolvedValueOnce(response(500, '<html>'));
    await expect(client.getOverview()).rejects.toThrow('request failed (500)');
  });
});

function ok(body: unknown) {
  return response(200, body);
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}
