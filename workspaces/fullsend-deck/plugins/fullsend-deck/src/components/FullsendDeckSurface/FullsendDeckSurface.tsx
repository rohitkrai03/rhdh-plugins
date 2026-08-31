import {
  Alert,
  Button,
  Container,
  Flex,
  Header,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  ToggleButton,
  ToggleButtonGroup,
} from '@backstage/ui';
import { useState, type Key } from 'react';
import type { TimeWindow } from '../../api';
import { useDeckData } from '../useDeckData';
import {
  AttentionView,
  CostView,
  DataHealthView,
  ExecutionsView,
} from './views';
import styles from './styles.module.css';

type View = 'attention' | 'executions' | 'cost' | 'data-health';

const windowLabels: Record<TimeWindow, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

export interface FullsendDeckSurfaceProps {
  entityRef?: string;
  entityName?: string;
}

export function FullsendDeckSurface({
  entityRef,
  entityName,
}: FullsendDeckSurfaceProps) {
  const [window, setWindow] = useState<TimeWindow>('7d');
  const [view, setView] = useState<View>('attention');
  const result = useDeckData(window, entityRef);
  const scope = entityRef
    ? `Entity · ${entityName ?? entityRef}`
    : 'All entities';

  return (
    <main className={styles.surface}>
      <Header
        title="Fullsend Deck"
        description="Know what needs a human, then verify what the agents actually did."
        tags={[{ label: scope }]}
        metadata={[
          { label: 'Mode', value: 'Read-only' },
          { label: 'Window', value: windowLabels[window] },
        ]}
        customActions={
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
                if (isTimeWindow(next)) setWindow(next);
              }}
            >
              <ToggleButton id="24h">24h</ToggleButton>
              <ToggleButton id="7d">7d</ToggleButton>
              <ToggleButton id="30d">30d</ToggleButton>
            </ToggleButtonGroup>
          </Flex>
        }
      />
      <Container py="5">
        {result.error ? (
          <Alert
            status="danger"
            icon
            title="Deck data is unavailable"
            description={result.error.message}
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
            <Tabs
              selectedKey={view}
              onSelectionChange={key => {
                if (isView(key)) setView(key);
              }}
            >
              <TabList aria-label="Fullsend Deck views">
                <Tab id="attention">Attention</Tab>
                <Tab id="executions">Executions</Tab>
                <Tab id="cost">Cost</Tab>
                <Tab id="data-health">Data health</Tab>
              </TabList>
              <TabPanel id="attention">
                <AttentionView data={result.data} entityRef={entityRef} />
              </TabPanel>
              <TabPanel id="executions">
                <ExecutionsView data={result.data} />
              </TabPanel>
              <TabPanel id="cost">
                <CostView data={result.data} />
              </TabPanel>
              <TabPanel id="data-health">
                <DataHealthView data={result.data} />
              </TabPanel>
            </Tabs>
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

function isView(value: Key): value is View {
  return (
    value === 'attention' ||
    value === 'executions' ||
    value === 'cost' ||
    value === 'data-health'
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
