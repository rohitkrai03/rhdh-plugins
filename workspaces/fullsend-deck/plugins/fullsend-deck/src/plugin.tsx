import {
  ApiBlueprint,
  createFrontendPlugin,
  createRouteRef,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';

import { FullsendDeckClient, fullsendDeckApiRef } from './api';
import { rootRouteRef } from './routes';

export const entityRouteRef = createRouteRef();

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

export const entityContent = EntityContentBlueprint.make({
  name: 'entity-page',
  params: {
    path: '/fullsend-deck',
    title: 'Fullsend Deck',
    group: 'observability',
    routeRef: entityRouteRef,
    loader: () =>
      import('./components/EntityFullsendDeckPage').then(m => (
        <m.EntityFullsendDeckPage />
      )),
  },
});

export const fullsendDeckPlugin = createFrontendPlugin({
  pluginId: 'fullsend-deck',
  extensions: [api, page, entityContent],
  routes: {
    root: rootRouteRef,
    entity: entityRouteRef,
  },
});
