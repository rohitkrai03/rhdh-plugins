# Fullsend Deck frontend

An NFS-only, read-only operations dashboard for Fullsend agent work. It exposes:

- a global `/fullsend-deck` page;
- an entity-scoped **Fullsend Deck** catalog tab;
- a runtime-validating API registered through `ApiBlueprint`; and
- lazy Attention, Executions, Cost, and Data health experiences.

The frontend consumes the self-contained backend at
`/api/fullsend-deck/v1`. Readiness, automation state, workflow conclusion, and
agent exit status are intentionally separate concepts.

## Frontend system and design system

The package exports only New Frontend System features created with
`createFrontendPlugin`, `PageBlueprint`, `EntityContentBlueprint`, and
`ApiBlueprint`. The example app discovers them through NFS package discovery.

Product components use `@backstage/ui` and its theme tokens. Direct MUI,
Material UI v4, PatternFly, `@backstage/core-components`, and legacy plugin
wiring are prohibited by a source-boundary test. There are no MUI fallback
modules in this release; see `docs/frontend.md` for the review policy.

## Getting started

Your plugin has been added to the app in this repository, meaning you'll be able
to access it by running `yarn start` in the root directory, and then navigating
to [/fullsend-deck](http://localhost:3000/fullsend-deck).

This plugin is built with Backstage's [frontend
system](https://backstage.io/docs/frontend-system/architecture/index), and you
can find more information about building plugins in the [plugin builder
documentation](https://backstage.io/docs/frontend-system/building-plugins/index).

You can also serve the plugin in isolation by running `yarn start` in the plugin directory.
This method of serving the plugin provides quicker iteration speed and a faster startup and hot reloads.
It is only meant for local development, and the setup for it can be found inside the [/dev](./dev) directory.

The backend needs at least one completed ingestion snapshot. With no configured
sources, its first scheduled ingestion produces a valid empty snapshot and the
frontend displays truthful empty and unsupported-source states.
