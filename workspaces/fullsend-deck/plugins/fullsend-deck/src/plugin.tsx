import {
  ApiBlueprint,
  coreExtensionData,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
  SubPageBlueprint,
} from '@backstage/frontend-plugin-api';
import { PluginWrapperBlueprint } from '@backstage/frontend-plugin-api/alpha';

import { FullsendDeckClient, fullsendDeckApiRef } from './api';
import { FullsendDeckRootScope } from './components/FullsendDeckContext';
import { rootRouteRef } from './routes';

export const api = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: fullsendDeckApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new FullsendDeckClient(discoveryApi, fetchApi),
    }),
});

export const page = PageBlueprint.makeWithOverrides({
  *factory(originalFactory) {
    const original = originalFactory({
      path: '/fullsend-deck',
      routeRef: rootRouteRef,
    });
    const routeRef = original.get(coreExtensionData.routeRef);

    yield coreExtensionData.routePath(
      original.get(coreExtensionData.routePath),
    );
    yield coreExtensionData.reactElement(
      <FullsendDeckRootScope>
        {original.get(coreExtensionData.reactElement)}
      </FullsendDeckRootScope>,
    );
    if (routeRef) yield coreExtensionData.routeRef(routeRef);
  },
});

export const scope = PluginWrapperBlueprint.make({
  params: defineParams =>
    defineParams({
      loader: () =>
        import('./components/FullsendDeckContext').then(m => ({
          useWrapperValue: m.useFullsendDeckContextValue,
          component: m.FullsendDeckContextProvider,
        })),
    }),
});

export const attentionPage = SubPageBlueprint.make({
  name: 'attention',
  params: {
    path: 'attention',
    title: 'Attention',
    loader: () =>
      import('./components/FullsendDeckPage').then(m => (
        <m.FullsendDeckPage view="attention" />
      )),
  },
});

export const executionsPage = SubPageBlueprint.make({
  name: 'executions',
  params: {
    path: 'executions',
    title: 'Executions',
    loader: () =>
      import('./components/FullsendDeckPage').then(m => (
        <m.FullsendDeckPage view="executions" />
      )),
  },
});

export const costPage = SubPageBlueprint.make({
  name: 'cost',
  params: {
    path: 'cost',
    title: 'Cost',
    loader: () =>
      import('./components/FullsendDeckPage').then(m => (
        <m.FullsendDeckPage view="cost" />
      )),
  },
});

export const dataHealthPage = SubPageBlueprint.make({
  name: 'data-health',
  params: {
    path: 'data-health',
    title: 'Data health',
    loader: () =>
      import('./components/FullsendDeckPage').then(m => (
        <m.FullsendDeckPage view="data-health" />
      )),
  },
});

export function FullsendDeckIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m4 5 7 7-7 7" />
      <path d="m11 5 7 7-7 7" />
    </svg>
  );
}

export const fullsendDeckPlugin = createFrontendPlugin({
  pluginId: 'fullsend-deck',
  title: 'Fullsend Deck',
  icon: <FullsendDeckIcon />,
  extensions: [
    api,
    scope,
    page,
    attentionPage,
    executionsPage,
    costPage,
    dataHealthPage,
  ],
  routes: {
    root: rootRouteRef,
  },
});
