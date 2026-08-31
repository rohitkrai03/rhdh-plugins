import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { FullsendDeckClient, fullsendDeckApiRef } from './api';
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

export const page = PageBlueprint.make({
  params: {
    path: '/fullsend-deck',
    title: 'Fullsend Deck',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/FullsendDeckPage').then(m => <m.FullsendDeckPage />),
  },
});

export const fullsendDeckPlugin = createFrontendPlugin({
  pluginId: 'fullsend-deck',
  extensions: [api, page],
  routes: {
    root: rootRouteRef,
  },
});
