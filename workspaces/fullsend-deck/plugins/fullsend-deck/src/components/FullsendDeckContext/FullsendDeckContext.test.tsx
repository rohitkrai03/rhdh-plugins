import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Link,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  FullsendDeckRootScope,
  readEntityScope,
  useFullsendDeckContextValue,
} from './FullsendDeckContext';

describe('FullsendDeckContext', () => {
  it('retains entity and window scope when Backstage tab links change routes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[
          '/fullsend-deck/attention?entity=component%3Adefault%2Fpayments&window=24h',
        ]}
      >
        <RoutedHarness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('scope')).toHaveTextContent(
      'component:default/payments|24h',
    );
    await user.click(screen.getByRole('link', { name: 'Cost' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        'entity=component%3Adefault%2Fpayments',
      );
      expect(screen.getByTestId('location')).toHaveTextContent('window=24h');
    });
    expect(screen.getByTestId('scope')).toHaveTextContent(
      'component:default/payments|24h',
    );
  });

  it('resets retained scope when the owned page root is opened globally', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[
          '/fullsend-deck/attention?entity=component%3Adefault%2Fpayments&window=30d',
        ]}
      >
        <RoutedHarness />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: 'Plugin root' }));
    await waitFor(() => {
      expect(screen.getByTestId('scope')).toHaveTextContent('global|7d');
    });
  });

  it('captures root scope before the default Backstage index redirect', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[
          '/fullsend-deck?entity=component%3Adefault%2Fpayments&window=24h',
        ]}
      >
        <Routes>
          <Route
            path="/fullsend-deck/*"
            element={
              <FullsendDeckRootScope>
                <DefaultPageHarness />
              </FullsendDeckRootScope>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/fullsend-deck/attention',
      );
      expect(screen.getByTestId('location')).toHaveTextContent(
        'entity=component%3Adefault%2Fpayments',
      );
      expect(screen.getByTestId('location')).toHaveTextContent('window=24h');
    });
  });

  it('normalizes canonical entity refs and rejects malformed scope', () => {
    expect(readEntityScope('?entity=Component%3ADefault%2FPayments')).toBe(
      'component:default/payments',
    );
    expect(readEntityScope('?entity=not-an-entity')).toBeNull();
    expect(readEntityScope('')).toBeUndefined();
  });
});

function DefaultPageHarness() {
  const location = useLocation();
  if (location.pathname.replace(/\/$/, '') === '/fullsend-deck') {
    return <Navigate to="attention" replace />;
  }
  return <RoutedHarness />;
}

function RoutedHarness() {
  const location = useLocation();
  return <ContextHarness key={location.pathname} />;
}

function ContextHarness() {
  const context = useFullsendDeckContextValue();
  const location = useLocation();
  return (
    <>
      <Link to="/fullsend-deck/cost">Cost</Link>
      <Link to="/fullsend-deck">Plugin root</Link>
      <output data-testid="scope">
        {context.entityRef ?? 'global'}|{context.window}
      </output>
      <output data-testid="location">
        {location.pathname}
        {location.search}
      </output>
    </>
  );
}
