import { createBackend } from '@backstage/backend-defaults';
import { mockServices } from '@backstage/backend-test-utils';

// Run `yarn start` in this package for a minimal backend. The health route is
// unauthenticated; versioned routes use the test utility's mock credentials.
// Configure a filesystem export in app-config.local.yaml to ingest real data.

const backend = createBackend();

// TEMPLATE NOTE:
// Mocking the auth and httpAuth service allows you to call your plugin API without
// having to authenticate.
//
// If you want to use real auth, you can install the following instead:
//   backend.add(import('@backstage/plugin-auth-backend'));
//   backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(mockServices.auth.factory());
backend.add(mockServices.httpAuth.factory());
backend.add(mockServices.permissions.factory());

backend.add(import('../src'));

backend.start();
