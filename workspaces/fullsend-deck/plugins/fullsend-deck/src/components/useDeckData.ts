import { useApi } from '@backstage/frontend-plugin-api';
import type {
  ExecutionsResponse,
  OverviewResponse,
  SyncStatusResponse,
  WorkItemsResponse,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import { useCallback, useEffect, useState } from 'react';
import {
  FullsendDeckRequestError,
  fullsendDeckApiRef,
  type TimeWindow,
} from '../api';

const INITIAL_SNAPSHOT_RETRY_MS = 5_000;

export interface DeckData {
  overview: OverviewResponse;
  work: WorkItemsResponse;
  executions: ExecutionsResponse;
  sync: SyncStatusResponse;
}

export function useDeckData(window: TimeWindow, entityRef?: string) {
  const api = useApi(fullsendDeckApiRef);
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    data?: DeckData;
    error?: Error;
  }>({ loading: true });

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setState(previous => ({ ...previous, loading: true, error: undefined }));
    Promise.all([
      api.getOverview({ window, entityRef }),
      api.getWorkItems({ entityRef, limit: 100 }),
      api.getExecutions({ window, entityRef, limit: 100 }),
      api.getSyncStatus(),
    ])
      .then(([overview, work, executions, sync]) => {
        if (active) {
          setState({
            loading: false,
            data: { overview, work, executions, sync },
          });
        }
      })
      .catch(error => {
        if (active) {
          const normalized =
            error instanceof Error
              ? error
              : new Error('Fullsend Deck could not load');
          setState({
            loading: false,
            error: normalized,
          });
          if (isInitialSnapshotUnavailable(normalized)) {
            retryTimer = setTimeout(() => {
              if (active) setRequest(value => value + 1);
            }, INITIAL_SNAPSHOT_RETRY_MS);
          }
        }
      });
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [api, entityRef, request, window]);

  const reload = useCallback(() => setRequest(value => value + 1), []);
  return { ...state, reload };
}

export function isInitialSnapshotUnavailable(error?: Error) {
  return (
    error instanceof FullsendDeckRequestError &&
    error.code === 'SNAPSHOT_UNAVAILABLE'
  );
}
