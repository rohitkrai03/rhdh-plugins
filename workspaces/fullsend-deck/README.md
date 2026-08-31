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
yarn install
yarn start
```
