# Fullsend Deck for RHDH

This workspace contains independently deployable Fullsend Deck frontend,
backend, and common packages plus a generated Backstage NFS example app.
The plugin is read-only and reads Fullsend artifacts directly; it does not
require the standalone Fullsend Deck deployment.

Read `docs/execution/README.md` before making changes.
Release packaging, installation, conformance evidence, and rollback are in
`docs/release.md` and `docs/conformance.md`.

To start the example app:

```sh
nvm use 24
yarn install
yarn start
```

`yarn start` launches the generated frontend and backend package processes
independently. This avoids the Backstage CLI repository coordinator leaving a
half-started backend: when that happens, the liveness endpoint responds but
Catalog and Fullsend Deck routes both return 404 while readiness remains 503.
Node 22 and 24 are supported by the package and CI. Use the same Node major for
dependency installation and startup; the local command above selects Node 24.

Native dependencies must be rebuilt after changing Node major versions. If
startup reports a `NODE_MODULE_VERSION` mismatch, run the following under the
Node version you intend to use:

```sh
yarn rebuild better-sqlite3
```

Set `GITHUB_TOKEN` in the environment to ingest the repositories configured in
`app-config.yaml`. A healthy local startup reports 200 from both:

```sh
curl http://localhost:7007/.backstage/health/v1/readiness
curl http://localhost:7007/api/fullsend-deck/health
```

For isolated debugging, the processes can also be run in separate terminals:

```sh
yarn start:backend
yarn start:frontend
```
