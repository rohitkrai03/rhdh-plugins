# Release and installation

## Compatibility

This source release is generated from Backstage 1.54.0 with Backstage CLI
0.36.5. Dynamic packages are exported with
`@red-hat-developer-hub/cli` 2.0.0 and its declared `ts-morph` 28.0.0 peer.
The release target is RHDH 2.1. Do not publish as RHDH 2.1-compatible until the
exact target passes the final gate in `docs/conformance.md`.

## Build and verify

From `workspaces/fullsend-deck`:

```sh
yarn install --immutable
yarn tsc:full
yarn lint:all
yarn test --watchAll=false
yarn build:all
yarn export-dynamic
yarn package-dynamic
yarn conformance:artifacts
yarn conformance:standalone
```

`package-dynamic` writes ignored, publishable directory artifacts beneath
`dist-dynamic-packages/{frontend,backend}`. Export embeds the common package in
the backend; consumers do not need an unpublished workspace dependency.

To build registry images, run from each plugin directory and replace the tag:

```sh
yarn rhdh-cli plugin package --tag REGISTRY/fullsend-deck-frontend:VERSION --container-tool podman --platform linux/amd64
yarn rhdh-cli plugin package --tag REGISTRY/fullsend-deck-backend:VERSION --container-tool podman --platform linux/amd64
```

Push immutable tags/digests, then replace `REGISTRY` and the version in
`examples/rhdh/dynamic-plugins.yaml`. Never install a mutable `latest` tag.

## Install

1. Back up the RHDH database and record the current dynamic-plugin
   configuration.
2. Add both OCI entries from `examples/rhdh/dynamic-plugins.yaml`.
3. Merge `examples/rhdh/app-config.fullsend-deck.yaml`, using an existing RHDH
   auth provider and GitHub integration credentials. Do not enable guest auth
   in production.
4. Grant `fullsend-deck.read` only to intended users and service principals in
   the RHDH permission policy.
5. Start one canary replica. Confirm both packages in the Dynamic Plugins page,
   a completed `fullsend-deck-ingestion` task, and a healthy source snapshot.
6. Visit `/fullsend-deck`; verify all four views. Verify a scoped deep link such
   as `/fullsend-deck?entity=component:default/fullsend`. No Catalog entity tab
   is installed.
7. Roll out remaining replicas only after authenticated API, theme, keyboard,
   mobile, PostgreSQL, and ingestion checks pass.

The backend requires PostgreSQL in production. API reads are side-effect free;
the Backstage global scheduler coordinates ingestion across replicas.

## Rollback

Disable both plugin entries together and redeploy the preceding immutable
digests. The plugin owns only `fullsend_deck_*` tables and does not perform
destructive down-migrations, so disabling it preserves rollback data. Restore
the database backup only if a separately reviewed schema rollback requires it.
Do not delete plugin tables as part of routine rollback.

After rollback, confirm `/fullsend-deck` is absent, the backend plugin is not in
the plugin inventory, and no `fullsend-deck-ingestion` task is scheduled.
