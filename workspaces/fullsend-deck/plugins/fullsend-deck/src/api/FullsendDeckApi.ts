import {
  createApiRef,
  type DiscoveryApi,
  type FetchApi,
} from '@backstage/frontend-plugin-api';
import {
  apiErrorSchema,
  executionsResponseSchema,
  overviewResponseSchema,
  syncStatusResponseSchema,
  workItemDetailResponseSchema,
  workItemsResponseSchema,
  type ExecutionsResponse,
  type OverviewResponse,
  type SyncStatusResponse,
  type WorkItemDetailResponse,
  type WorkItemsResponse,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';

export type TimeWindow = '24h' | '7d' | '30d';

export interface DeckQuery {
  window?: TimeWindow;
  entityRef?: string;
  cursor?: string;
  limit?: number;
}

export interface FullsendDeckApi {
  getOverview(query?: DeckQuery): Promise<OverviewResponse>;
  getWorkItems(query?: DeckQuery): Promise<WorkItemsResponse>;
  getWorkItem(id: string): Promise<WorkItemDetailResponse>;
  getExecutions(query?: DeckQuery): Promise<ExecutionsResponse>;
  getSyncStatus(): Promise<SyncStatusResponse>;
}

export const fullsendDeckApiRef = createApiRef<FullsendDeckApi>({
  id: 'plugin.fullsend-deck.service',
});

export class FullsendDeckClient implements FullsendDeckApi {
  public constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  public getOverview(query: DeckQuery = {}) {
    return this.get('/v1/overview', overviewResponseSchema, queryValues(query));
  }

  public getWorkItems(query: DeckQuery = {}) {
    const { window: _window, ...workQuery } = query;
    return this.get('/v1/work-items', workItemsResponseSchema, workQuery);
  }

  public getWorkItem(id: string) {
    return this.get(
      `/v1/work-items/${encodeURIComponent(id)}`,
      workItemDetailResponseSchema,
    );
  }

  public getExecutions(query: DeckQuery = {}) {
    return this.get(
      '/v1/executions',
      executionsResponseSchema,
      queryValues(query),
    );
  }

  public getSyncStatus() {
    return this.get('/v1/sync-status', syncStatusResponseSchema);
  }

  private async get<T>(
    path: string,
    schema: RuntimeSchema<T>,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('fullsend-deck');
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) search.set(name, String(value));
    }
    const response = await this.fetchApi.fetch(
      `${baseUrl}${path}${search.size > 0 ? `?${search}` : ''}`,
      { headers: { Accept: 'application/json' } },
    );
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsedError = apiErrorSchema.safeParse(body);
      throw new Error(
        parsedError.success
          ? parsedError.data.error.message
          : `Fullsend Deck request failed (${response.status})`,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new Error('Fullsend Deck returned an incompatible response');
    }
    return parsed.data;
  }
}

interface RuntimeSchema<T> {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: unknown };
}

function queryValues(query: DeckQuery) {
  return {
    window: query.window,
    entityRef: query.entityRef,
    cursor: query.cursor,
    limit: query.limit,
  };
}
