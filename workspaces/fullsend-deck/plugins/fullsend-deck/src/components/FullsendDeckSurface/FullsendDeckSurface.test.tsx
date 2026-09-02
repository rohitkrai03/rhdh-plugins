import {
  renderInTestApp,
  type TestApiPair,
} from '@backstage/frontend-test-utils';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  fixtureExecutionsResponse,
  fixtureOverviewResponse,
  fixtureSyncResponse,
  fixtureWorkItemsResponse,
} from '../../testData';
import {
  FullsendDeckRequestError,
  fullsendDeckApiRef,
  type FullsendDeckApi,
  type TimeWindow,
} from '../../api';
import { FullsendDeckContextProvider } from '../FullsendDeckContext';
import { FullsendDeckPage } from '../FullsendDeckPage';
import { FullsendDeckSurface, type DeckView } from './FullsendDeckSurface';

describe('FullsendDeckSurface', () => {
  it('renders readiness first and keeps workflow and agent outcomes distinct', async () => {
    const api = createApi();
    const attention = render(<TestSurface />, api);

    expect(
      await screen.findByRole('heading', { name: 'Attention' }),
    ).toBeVisible();
    expect(
      screen.getByText('Keep workflow and agent outcomes distinct'),
    ).toBeVisible();
    expect(screen.getAllByText('Actionable')).toHaveLength(2);

    attention.unmount();
    render(<TestSurface view="executions" />, api);
    expect(
      await screen.findByRole('heading', { name: 'Executions' }),
    ).toBeVisible();
    const table = await screen.findByRole('grid');
    expect(within(table).getByText('Failed')).toBeVisible();
    expect(within(table).getByText('Succeeded')).toBeVisible();
    expect(within(table).getByText('Canonical')).toBeVisible();
  });

  it('uses accessible evidence dialog focus and search states', async () => {
    const user = userEvent.setup();
    render(<TestSurface />, createApi());
    const trigger = await screen.findByRole('button', { name: 'Evidence' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(screen.getByText('Why it is ranked here')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    const search = screen.getByRole('searchbox', { name: 'Find work' });
    await user.type(search, 'does not exist');
    expect(screen.getByText('No matching work')).toBeVisible();
  });

  it('reloads all data when the time window changes', async () => {
    const api = createApi();
    render(<TestSurface />, api);
    await screen.findByRole('heading', { name: 'Attention' });
    fireEvent.click(screen.getByRole('radio', { name: '24h' }));
    await screen.findByText(/24 hours/);
    expect(api.getOverview).toHaveBeenLastCalledWith({
      window: '24h',
      entityRef: undefined,
    });
    expect(api.getExecutions).toHaveBeenLastCalledWith({
      window: '24h',
      entityRef: undefined,
      limit: 100,
    });
  });

  it('forwards canonical entity scope from the owned page deep link', async () => {
    const api = createApi();
    render(
      <FullsendDeckContextProvider
        value={{
          entityRef: 'component:default/payments',
          invalidEntityRef: false,
          window: '7d',
          setWindow: jest.fn(),
        }}
      >
        <FullsendDeckPage view="attention" />
      </FullsendDeckContextProvider>,
      api,
    );
    expect(
      await screen.findByText('Entity · component:default/payments'),
    ).toBeVisible();
    expect(api.getWorkItems).toHaveBeenCalledWith({
      entityRef: 'component:default/payments',
      limit: 100,
    });
  });

  it('fails closed for a malformed entity deep link', async () => {
    const api = createApi();
    render(
      <FullsendDeckContextProvider
        value={{
          invalidEntityRef: true,
          window: '7d',
          setWindow: jest.fn(),
        }}
      >
        <FullsendDeckPage view="attention" />
      </FullsendDeckContextProvider>,
      api,
    );
    expect(await screen.findByText('Invalid entity scope')).toBeVisible();
    expect(api.getOverview).not.toHaveBeenCalled();
  });

  it('shows explicit empty, partial, and safe error states', async () => {
    const empty = createApi({
      getWorkItems: jest.fn().mockResolvedValue({
        ...fixtureWorkItemsResponse,
        items: [],
      }),
    });
    const first = render(<TestSurface />, empty);
    expect(await screen.findByText('No work in this snapshot')).toBeVisible();
    expect(screen.getByText('Partial data')).toBeVisible();
    first.unmount();

    const failed = createApi({
      getOverview: jest.fn().mockRejectedValue(new Error('Permission denied')),
    });
    render(<TestSurface />, failed);
    expect(await screen.findByText('Deck data is unavailable')).toBeVisible();
    expect(screen.getByText('Permission denied')).toBeVisible();
  });

  it('does not present missing source data as healthy zero activity', async () => {
    const api = createApi({
      getWorkItems: jest.fn().mockResolvedValue({
        ...fixtureWorkItemsResponse,
        items: [],
      }),
      getSyncStatus: jest.fn().mockResolvedValue({
        ...fixtureSyncResponse,
        sync: {
          ...fixtureSyncResponse.sync,
          state: 'empty',
          sources: [],
        },
      }),
    });
    const attention = render(<TestSurface />, api);

    expect(
      await screen.findByText('No data sources are reporting'),
    ).toBeVisible();
    expect(screen.getByText('No work has been ingested')).toBeVisible();

    attention.unmount();
    render(<TestSurface view="data-health" />, api);
    expect(await screen.findByText('No configured sources')).toBeVisible();
  });

  it('presents the initial ingestion as a retrying preparation state', async () => {
    const api = createApi({
      getOverview: jest
        .fn()
        .mockRejectedValue(
          new FullsendDeckRequestError(
            'No completed ingestion snapshot is available',
            503,
            'SNAPSHOT_UNAVAILABLE',
          ),
        ),
    });
    render(<TestSurface />, api);

    expect(await screen.findByText('Preparing Deck data')).toBeVisible();
    expect(screen.getByText(/retry automatically/)).toBeVisible();
    expect(
      screen.queryByText('Deck data is unavailable'),
    ).not.toBeInTheDocument();
  });
});

function TestSurface({
  view = 'attention',
  entityRef,
}: {
  view?: DeckView;
  entityRef?: string;
}) {
  const [window, setWindow] = useState<TimeWindow>('7d');
  return (
    <FullsendDeckSurface
      view={view}
      window={window}
      onWindowChange={setWindow}
      entityRef={entityRef}
      entityName={entityRef}
    />
  );
}

function createApi(overrides: Partial<jest.Mocked<FullsendDeckApi>> = {}) {
  return {
    getOverview: jest.fn().mockResolvedValue(fixtureOverviewResponse),
    getWorkItems: jest.fn().mockResolvedValue(fixtureWorkItemsResponse),
    getWorkItem: jest.fn(),
    getExecutions: jest.fn().mockResolvedValue(fixtureExecutionsResponse),
    getSyncStatus: jest.fn().mockResolvedValue(fixtureSyncResponse),
    ...overrides,
  } as jest.Mocked<FullsendDeckApi>;
}

function render(element: JSX.Element, api: jest.Mocked<FullsendDeckApi>) {
  return renderInTestApp(element, {
    apis: [[fullsendDeckApiRef, api] as TestApiPair<FullsendDeckApi>],
  });
}
