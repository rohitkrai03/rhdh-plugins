/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Entity } from '@backstage/catalog-model';
import { parseEntityRef } from '@backstage/catalog-model';

import type { FilterDefinition } from '../blueprints/AiCatalogFilterBlueprint';
import { getCategoryMeta } from './categoryMeta';

function catalogHref(kind: string, namespace: string, name: string): string {
  return `/catalog/${namespace}/${kind.toLowerCase()}/${name}`;
}

export function entityHref(entity: Entity): string {
  const namespace = entity.metadata.namespace ?? 'default';
  return catalogHref(entity.kind, namespace, entity.metadata.name);
}

/**
 * Builds a catalog entity page URL from an entity ref string (e.g. an
 * owner value from `spec.owner`), which may be a bare name, a
 * `kind:namespace/name` ref, or a `kind:name` ref. Bare names default to
 * kind `group` in the `default` namespace, matching common Backstage
 * conventions for `spec.owner`.
 *
 * Returns `undefined` when `ref` is not a valid entity ref, so callers can
 * render a non-link fallback instead of throwing.
 */
export function entityRefHref(ref: string): string | undefined {
  try {
    const { kind, namespace, name } = parseEntityRef(ref, {
      defaultKind: 'group',
      defaultNamespace: 'default',
    });
    return catalogHref(kind, namespace, name);
  } catch {
    return undefined;
  }
}

export function getSpecField(
  entity: Entity,
  field: string,
): string | undefined {
  return (entity.spec as Record<string, unknown> | undefined)?.[field] as
    | string
    | undefined;
}

/**
 * Apply search + registered filter definitions in AND logic.
 * Search is built-in (not a FilterDefinition). Each FilterDefinition
 * with active values must match for the entity to be included.
 */
export function applyEntityFilters(
  items: Entity[],
  search: string | undefined,
  filters: FilterDefinition[],
  filterValues: Map<string, string[]>,
): Entity[] {
  let results = items;

  if (search) {
    const term = search.toLowerCase();
    results = results.filter(
      e =>
        e.metadata.name.toLowerCase().includes(term) ||
        (e.metadata.title ?? '').toLowerCase().includes(term) ||
        (e.metadata.description ?? '').toLowerCase().includes(term) ||
        (e.metadata.tags ?? []).some(t => t.toLowerCase().includes(term)),
    );
  }

  for (const filter of filters) {
    const values = filterValues.get(filter.urlParam);
    if (values && values.length > 0) {
      results = results.filter(e => filter.matchEntity(e, values));
    }
  }

  return results;
}

/**
 * A command that can be copied from the Adoption card.
 */
export interface AdoptionCommand {
  runtime?: 'docker' | 'podman';
  value: string;
}

/**
 * Resolved adoption action for an AI asset entity.
 */
export type AdoptionAction =
  | { type: 'copy-command'; commands: AdoptionCommand[] }
  | { type: 'verified-download'; href: string }
  | { type: 'view-source'; href: string }
  | { type: 'copy-url'; value: string };

export type AssetLocation =
  | { type: 'git'; value: string; href: string }
  | { type: 'oci'; value: string };

/**
 * Parses a URL string and returns its hostname, or undefined if the URL is malformed.
 */
function parseHttpUrl(url: string): URL | undefined {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isHost(url: URL | undefined, host: string): boolean {
  return url?.hostname === host || url?.hostname === `www.${host}`;
}

/**
 * Matches a well-formed `oci://` reference and rejects anything containing
 * shell metacharacters (`;`, `|`, `` ` ``, `$()`, spaces, etc.), since this
 * value is interpolated into container pull commands copied to the clipboard.
 */
const OCI_REFERENCE_PATTERN = /^oci:\/\/[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/;

export function isSafeOciReference(url: string): boolean {
  return OCI_REFERENCE_PATTERN.test(url);
}

/**
 * Returns true if `value` parses as an absolute `http:`/`https:` URL.
 */
function isHttpUrl(value: string): boolean {
  return parseHttpUrl(value) !== undefined;
}

function githubArchiveUrl(url: URL): string | undefined {
  if (!isHost(url, 'github.com') || url.search || url.hash) return undefined;
  const segments = url.pathname
    .replace(/^\/|\/$/g, '')
    .split('/')
    .filter(Boolean);
  if (segments.length !== 2) return undefined;
  const [owner, repoWithSuffix] = segments;
  const repo = repoWithSuffix.replace(/\.git$/, '');
  const safeSegment = /^[a-zA-Z0-9_.-]+$/;
  if (!safeSegment.test(owner) || !safeSegment.test(repo)) return undefined;
  return `https://api.github.com/repos/${owner}/${repo}/zipball`;
}

function isExplicitGitLabArchive(url: URL): boolean {
  return (
    isHost(url, 'gitlab.com') &&
    url.pathname.includes('/-/archive/') &&
    url.pathname.endsWith('.zip')
  );
}

function normalizeSourceLocation(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;
  return value.startsWith('url:') ? value.slice(4) : value;
}

/**
 * Resolves the adoption action for an entity based on its metadata.
 *
 * Priority order:
 * 1. Skills — `npx skills add <name>`
 * 2. OCI-sourced — Docker and Podman pull commands
 * 3. Git-sourced — verified download or source link
 * 4. MCP servers — remote URL copy
 * 5. Fallback — undefined (no action)
 */
export function getAdoptionAction(entity: Entity): AdoptionAction | undefined {
  const spec = entity.spec as Record<string, unknown> | undefined;
  const specType = getSpecField(entity, 'type')?.toLowerCase();

  // 1. Skills
  if (specType === 'skill') {
    return {
      type: 'copy-command',
      commands: [{ value: `npx skills add ${entity.metadata.name}` }],
    };
  }

  const remotes = (spec?.remotes ?? []) as Array<{
    url?: string;
    type?: string;
  }>;

  // 2. OCI-sourced
  // Checked before the mcp-server branch below: per #3735's priority order,
  // an oci:// remote takes precedence even for entities typed `mcp-server`.
  const ociRemote = remotes.find(r => r.url && isSafeOciReference(r.url));
  if (ociRemote?.url) {
    const reference = ociRemote.url.slice('oci://'.length);
    return {
      type: 'copy-command',
      commands: [
        { runtime: 'docker', value: `docker pull ${reference}` },
        { runtime: 'podman', value: `podman pull ${reference}` },
      ],
    };
  }

  // 3. Git-sourced
  const location = spec?.location as
    | { type?: string; target?: string }
    | undefined;
  if (location?.type === 'git' && location.target) {
    const target = location.target;
    const parsed = parseHttpUrl(target);
    if (parsed) {
      const archiveHref = githubArchiveUrl(parsed);
      if (archiveHref || isExplicitGitLabArchive(parsed)) {
        return {
          type: 'verified-download',
          href: archiveHref ?? target,
        };
      }
      return {
        type: 'view-source',
        href: target,
      };
    }
  }

  // 4. MCP servers
  if (specType === 'mcp-server') {
    const mcpRemote =
      remotes.find(
        r => r.type === 'streamable-http' && r.url && isHttpUrl(r.url),
      ) ?? remotes.find(r => r.url && isHttpUrl(r.url));
    if (mcpRemote?.url) {
      return {
        type: 'copy-url',
        value: mcpRemote.url,
      };
    }
  }

  // 5. Fallback
  return undefined;
}

/**
 * Returns every validated source location suitable for display on the entity
 * page. Runtime endpoints are deliberately excluded.
 */
export function getAssetLocations(entity: Entity): AssetLocation[] {
  const spec = entity.spec as Record<string, unknown> | undefined;
  const locations: AssetLocation[] = [];
  const seen = new Set<string>();

  const addGit = (value: string | undefined) => {
    const normalized = normalizeSourceLocation(value);
    if (!normalized || !isHttpUrl(normalized)) return;
    const key = `git:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push({ type: 'git', value: normalized, href: normalized });
  };

  const location = spec?.location as
    | { type?: string; target?: string }
    | undefined;
  if (location?.type?.toLowerCase() === 'git') addGit(location.target);
  addGit(entity.metadata.annotations?.['backstage.io/source-location']);

  const remotes = (spec?.remotes ?? []) as Array<{ url?: string }>;
  for (const remote of remotes) {
    if (!remote.url || !isSafeOciReference(remote.url)) continue;
    const value = remote.url.slice('oci://'.length);
    const key = `oci:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push({ type: 'oci', value });
  }

  return locations;
}

export function getSortValue(entity: Entity, columnId: string): string {
  switch (columnId) {
    case 'title':
      return entity.metadata.title ?? entity.metadata.name;
    case 'categoryLabel':
      return getCategoryMeta(getSpecField(entity, 'type')).label;
    case 'owner':
      return getSpecField(entity, 'owner') ?? '';
    case 'provider':
      return entity.metadata.annotations?.['rhdh.io/ai-asset-source'] ?? '';
    case 'description':
      return entity.metadata.description ?? '';
    default:
      return '';
  }
}
