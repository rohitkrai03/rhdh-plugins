# Fullsend Deck backend

The backend is self-contained: it discovers read-only GitHub work and Fullsend
artifacts, persists normalized snapshots with Backstage's database service, and
serves the frontend without a standalone Deck deployment.

## Installation

It is a new-backend-system `createBackendPlugin` package. Install it with:

```bash
# From your root directory
yarn --cwd packages/backend add @red-hat-developer-hub/backstage-plugin-fullsend-deck-backend
```

Then add it to the backend:

```ts
const backend = createBackend();
// ...
backend.add(
  import('@red-hat-developer-hub/backstage-plugin-fullsend-deck-backend'),
);
```

All `/v1` routes require Backstage authentication and the
`fullsend-deck.read` permission. `/health` is the only unauthenticated route.
GitHub tokens or app credentials come from Backstage `integrations`.

See `../../docs/backend.md` for configuration, source layout, failure behavior,
and the API surface.
