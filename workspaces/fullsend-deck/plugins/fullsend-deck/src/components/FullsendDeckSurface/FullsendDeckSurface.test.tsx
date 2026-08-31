import {
  renderInTestApp,
  type TestApiPair,
} from '@backstage/frontend-test-utils';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  fixtureExecutionsResponse,
  fixtureOverviewResponse,
  fixtureSyncResponse,
  fixtureWorkItemsResponse,
} from '../../testData';
import { fullsendDeckApiRef, type FullsendDeckApi } from '../../api';
import { FullsendDeckPage } from '../FullsendDeckPage';
import { FullsendDeckSurface } from './FullsendDeckSurface';

describe('FullsendDeckSurface', () => {
  it('renders readiness first and keeps workflow and agent outcomes distinct', async () => {
    const user = userEvent.setup();
    const api = createApi();
    render(<FullsendDeckSurface />, api);

    expect(
      await screen.findByRole('heading', { name: 'Attention' }),
    ).toBeVisible();
    expect(
      screen.getByText('Keep workflow and agent outcomes distinct'),
    ).toBeVisible();
    expect(screen.getAllByText('Actionable')).toHaveLength(2);

    await user.click(screen.getByRole('tab', { name: 'Executions' }));
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
    render(<FullsendDeckSurface />, createApi());
    const trigger = await screen.findByRole('button', { name: 'Evidence' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(screen.getByText('Why it is ranked here')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    const search = screen.getByRole('searchbox', { name: 'Search work items' });
    await user.type(search, 'does not exist');
    expect(screen.getByText('No matching work')).toBeVisible();
  });

  it('reloads all data when the time window changes', async () => {
    const api = createApi();
    render(<FullsendDeckSurface />, api);
    await screen.findByRole('heading', { name: 'Attention' });
    fireEvent.click(screen.getByRole('radio', { name: '24h' }));
    await screen.findByText('24 hours');
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
    window.history.replaceState(
      {},
      '',
      '/fullsend-deck?entity=component:default/payments',
    );
    render(<FullsendDeckPage />, api);
    expect(
      await screen.findByText('Entity · component:default/payments'),
    ).toBeVisible();
    expect(api.getWorkItems).toHaveBeenCalledWith({
      entityRef: 'component:default/payments',
      limit: 100,
    });
    window.history.replaceState({}, '', '/fullsend-deck');
  });

  it('fails closed for a malformed entity deep link', async () => {
    const api = createApi();
    window.history.replaceState({}, '', '/fullsend-deck?entity=not-an-entity');
    render(<FullsendDeckPage />, api);
    expect(await screen.findByText('Invalid entity scope')).toBeVisible();
    expect(api.getOverview).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '/fullsend-deck');
  });

  it('shows explicit empty, partial, and safe error states', async () => {
    const empty = createApi({
      getWorkItems: jest.fn().mockResolvedValue({
        ...fixtureWorkItemsResponse,
        items: [],
      }),
    });
    const first = render(<FullsendDeckSurface />, empty);
    expect(await screen.findByText('Nothing needs attention')).toBeVisible();
    expect(screen.getByText('Partial data')).toBeVisible();
    first.unmount();

    const failed = createApi({
      getOverview: jest.fn().mockRejectedValue(new Error('Permission denied')),
    });
    render(<FullsendDeckSurface />, failed);
    expect(await screen.findByText('Deck data is unavailable')).toBeVisible();
    expect(screen.getByText('Permission denied')).toBeVisible();
  });
});

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
