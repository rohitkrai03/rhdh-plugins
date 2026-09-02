import type { TimeWindow } from '../../api';
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface FullsendDeckContextValue {
  entityRef?: string;
  invalidEntityRef: boolean;
  window: TimeWindow;
  setWindow: (window: TimeWindow) => void;
}

const FullsendDeckContext = createContext<FullsendDeckContextValue | undefined>(
  undefined,
);

const retainedScope: {
  entityQuery?: string;
  entityRef?: string;
  invalidEntityRef: boolean;
  window: TimeWindow;
} = { invalidEntityRef: false, window: '7d' };

export function useFullsendDeckContextValue(): FullsendDeckContextValue {
  const location = useLocation();
  const navigate = useNavigate();
  const atPluginRoot =
    location.pathname.replace(/\/$/, '') === '/fullsend-deck';

  retainScopeFromSearch(location.search, atPluginRoot);

  const value = retainedScope;

  useEffect(() => {
    if (atPluginRoot) return;
    const search = new URLSearchParams(location.search);
    let changed = false;
    if (value.entityQuery && !search.has('entity')) {
      search.set('entity', value.entityQuery);
      changed = true;
    }
    if (value.window !== '7d' && !search.has('window')) {
      search.set('window', value.window);
      changed = true;
    }
    if (changed) {
      navigate(
        { pathname: location.pathname, search: search.toString() },
        { replace: true },
      );
    }
  }, [atPluginRoot, location.pathname, location.search, navigate, value]);

  const setWindow = useCallback(
    (nextWindow: TimeWindow) => {
      retainedScope.window = nextWindow;
      const search = new URLSearchParams(location.search);
      if (nextWindow === '7d') search.delete('window');
      else search.set('window', nextWindow);
      navigate(
        { pathname: location.pathname, search: search.toString() },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );

  return { ...value, setWindow };
}

export function FullsendDeckRootScope({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (location.pathname.replace(/\/$/, '') === '/fullsend-deck') {
    retainScopeFromSearch(location.search, true);
  }
  return <Fragment>{children}</Fragment>;
}

export function FullsendDeckContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: FullsendDeckContextValue;
}) {
  return (
    <FullsendDeckContext.Provider value={value}>
      {children}
    </FullsendDeckContext.Provider>
  );
}

export function useFullsendDeckContext() {
  const value = useContext(FullsendDeckContext);
  if (!value) {
    throw new Error('Fullsend Deck page rendered without its plugin context');
  }
  return value;
}

export function readEntityScope(
  searchValue: string,
): string | null | undefined {
  const value = new URLSearchParams(searchValue).get('entity')?.trim();
  if (!value) return undefined;

  return /^[a-z0-9][a-z0-9_.-]*:[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/i.test(
    value,
  )
    ? value.toLocaleLowerCase('en-US')
    : null;
}

function readTimeWindow(searchValue: string): TimeWindow | undefined {
  const value = new URLSearchParams(searchValue).get('window');
  return value === '24h' || value === '7d' || value === '30d'
    ? value
    : undefined;
}

function retainScopeFromSearch(searchValue: string, reset: boolean) {
  const entityQuery = new URLSearchParams(searchValue).get('entity')?.trim();
  const parsedEntityRef = readEntityScope(searchValue);
  const parsedWindow = readTimeWindow(searchValue);

  if (reset) {
    retainedScope.entityQuery = entityQuery || undefined;
    retainedScope.entityRef =
      parsedEntityRef === null ? undefined : parsedEntityRef;
    retainedScope.invalidEntityRef = parsedEntityRef === null;
    retainedScope.window = parsedWindow ?? '7d';
    return;
  }

  if (parsedEntityRef !== undefined) {
    retainedScope.entityQuery = entityQuery || undefined;
    retainedScope.entityRef =
      parsedEntityRef === null ? undefined : parsedEntityRef;
    retainedScope.invalidEntityRef = parsedEntityRef === null;
  }
  if (parsedWindow) retainedScope.window = parsedWindow;
}
