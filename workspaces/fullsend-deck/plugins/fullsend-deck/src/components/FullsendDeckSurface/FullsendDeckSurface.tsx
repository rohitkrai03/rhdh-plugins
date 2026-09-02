import {
  Alert,
  Button,
  Container,
  Flex,
  Skeleton,
  Text,
  ToggleButton,
  ToggleButtonGroup,
} from '@backstage/ui';
import type { Key } from 'react';
import type { TimeWindow } from '../../api';
import { isInitialSnapshotUnavailable, useDeckData } from '../useDeckData';
import {
  AttentionView,
  CostView,
  DataHealthView,
  ExecutionsView,
} from './views';
import styles from './styles.module.css';

export type DeckView = 'attention' | 'executions' | 'cost' | 'data-health';

const windowLabels: Record<TimeWindow, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

export interface FullsendDeckSurfaceProps {
  view: DeckView;
  window: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
  entityRef?: string;
  entityName?: string;
}

export function FullsendDeckSurface({
  view,
  window,
  onWindowChange,
  entityRef,
  entityName,
}: FullsendDeckSurfaceProps) {
  const result = useDeckData(window, entityRef);
  const scope = entityRef
    ? `Entity · ${entityName ?? entityRef}`
    : 'All entities';
  const preparingInitialSnapshot = isInitialSnapshotUnavailable(result.error);

  return (
    <main className={styles.surface}>
      <Container py="5" className={styles.content}>
        <Flex
          align="end"
          gap="4"
          justify="between"
          className={styles.contextBar}
        >
          <Flex gap="1" direction="column">
            <Text variant="body-medium" weight="bold">
              {scope}
            </Text>
            <Text variant="body-small" color="secondary">
              Read-only · {windowLabels[window]}
            </Text>
          </Flex>
          <Flex align="end" gap="2" direction="column">
            <Text as="span" variant="body-x-small" color="secondary">
              Execution window
            </Text>
            <ToggleButtonGroup
              aria-label="Execution window"
              selectionMode="single"
              selectedKeys={new Set([window])}
              onSelectionChange={keys => {
                const next = Array.from(keys)[0];
                if (isTimeWindow(next)) onWindowChange(next);
              }}
            >
              <ToggleButton id="24h">24h</ToggleButton>
              <ToggleButton id="7d">7d</ToggleButton>
              <ToggleButton id="30d">30d</ToggleButton>
            </ToggleButtonGroup>
          </Flex>
        </Flex>
        {result.error ? (
          <Alert
            status={preparingInitialSnapshot ? 'info' : 'danger'}
            icon
            title={
              preparingInitialSnapshot
                ? 'Preparing Deck data'
                : 'Deck data is unavailable'
            }
            description={
              preparingInitialSnapshot
                ? 'The first artifact ingestion is still running. Deck will retry automatically; check the backend log if this persists beyond four minutes.'
                : result.error.message
            }
            customActions={<Button onPress={result.reload}>Try again</Button>}
          />
        ) : null}
        {result.loading && !result.data ? <LoadingDeck /> : null}
        {result.data ? (
          <>
            <FreshnessLine
              snapshotAt={result.data.overview.snapshotAt}
              partial={result.data.overview.partial}
              refreshing={result.loading}
            />
            {result.data.sync.sync.sources.length === 0 ? (
              <Alert
                status="warning"
                icon
                title="No data sources are reporting"
                description="Configure at least one GitHub repository or a read-only filesystem export, then wait for the first completed sync. Until then, zero values do not represent healthy activity."
              />
            ) : null}
            {view === 'attention' ? (
              <AttentionView data={result.data} entityRef={entityRef} />
            ) : null}
            {view === 'executions' ? (
              <ExecutionsView data={result.data} />
            ) : null}
            {view === 'cost' ? <CostView data={result.data} /> : null}
            {view === 'data-health' ? (
              <DataHealthView data={result.data} />
            ) : null}
          </>
        ) : null}
      </Container>
    </main>
  );
}

function FreshnessLine({
  snapshotAt,
  partial,
  refreshing,
}: {
  snapshotAt: string;
  partial: { isPartial: boolean; diagnostics: Array<{ message: string }> };
  refreshing: boolean;
}) {
  return (
    <div className={styles.freshness} aria-live="polite">
      <Text variant="body-small" color="secondary">
        Snapshot {formatDate(snapshotAt)}
        {refreshing ? ' · Refreshing…' : ''}
      </Text>
      {partial.isPartial ? (
        <Alert
          status="warning"
          icon
          title="Partial data"
          description={partial.diagnostics
            .map(item => item.message)
            .join(' · ')}
        />
      ) : null}
    </div>
  );
}

function LoadingDeck() {
  return (
    <div aria-label="Loading Fullsend Deck" className={styles.loading}>
      <Skeleton height={44} rounded />
      <div className={styles.metrics}>
        <Skeleton height={128} rounded />
        <Skeleton height={128} rounded />
        <Skeleton height={128} rounded />
        <Skeleton height={128} rounded />
      </div>
      <Skeleton height={320} rounded />
    </div>
  );
}

function isTimeWindow(value: Key | undefined): value is TimeWindow {
  return value === '24h' || value === '7d' || value === '30d';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
