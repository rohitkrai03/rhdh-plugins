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

import { type Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { renderInTestApp } from '@backstage/test-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { AdoptionCard } from './AdoptionCard';

const skillEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'AiResource',
  metadata: {
    name: 'code-review-skill',
    namespace: 'default',
    uid: 'uid-skill',
  },
  spec: {
    type: 'skill',
    lifecycle: 'production',
    owner: 'team-ai-platform',
    location: {
      type: 'git',
      target: 'https://github.com/example/code-review-skill',
    },
  },
};

const ociEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: {
    name: 'custom-ai-tool',
    namespace: 'default',
    uid: 'uid-oci',
    annotations: {
      'rhdh.io/ai-asset-source': 'registry',
    },
  },
  spec: {
    type: 'ai-tool',
    lifecycle: 'production',
    owner: 'team-integrations',
    remotes: [
      {
        url: 'oci://registry.example.com/tools/custom-ai-tool:latest',
        type: 'oci',
      },
    ],
  },
};

const gitEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'AiResource',
  metadata: {
    name: 'no-hardcoded-secrets-rule',
    namespace: 'default',
    uid: 'uid-git',
  },
  spec: {
    type: 'rule',
    lifecycle: 'production',
    owner: 'team-security',
    location: {
      type: 'git',
      target: 'https://github.com/example/no-hardcoded-secrets-rule',
    },
  },
};

const mcpEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'github-mcp-server',
    namespace: 'default',
    uid: 'uid-mcp',
  },
  spec: {
    type: 'mcp-server',
    lifecycle: 'experimental',
    owner: 'team-integrations',
    remotes: [
      { url: 'https://mcp.example.com/github', type: 'streamable-http' },
    ],
  },
};

const noActionEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: {
    name: 'web-search-tool',
    namespace: 'default',
    uid: 'uid-no-action',
  },
  spec: {
    type: 'ai-tool',
    lifecycle: 'experimental',
    owner: 'team-integrations',
  },
};

function renderWithEntity(entity: Entity) {
  return renderInTestApp(
    <EntityProvider entity={entity}>
      <AdoptionCard />
    </EntityProvider>,
  );
}

describe('AdoptionCard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders npx command for skill entities', async () => {
    await renderWithEntity(skillEntity);

    expect(
      screen.getByText('npx skills add code-review-skill'),
    ).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('renders Docker by default and a Podman alternative without oci://', async () => {
    await renderWithEntity(ociEntity);

    expect(
      screen.getByText(
        'docker pull registry.example.com/tools/custom-ai-tool:latest',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/oci:\/\//)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Podman' }));
    expect(
      screen.getByText(
        'podman pull registry.example.com/tools/custom-ai-tool:latest',
      ),
    ).toBeInTheDocument();
  });

  it('renders Download ZIP button for git-sourced entities', async () => {
    await renderWithEntity(gitEntity);

    expect(screen.getByText('Download ZIP')).toBeInTheDocument();
  });

  it('renders remote URL for MCP server entities', async () => {
    await renderWithEntity(mcpEntity);

    expect(
      screen.getByText('https://mcp.example.com/github'),
    ).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy URL to clipboard' }),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://mcp.example.com/github',
    );
  });

  it('renders nothing for entities with no actionable metadata', async () => {
    const { container } = await renderWithEntity(noActionEntity);

    expect(container.querySelector('.command')).toBeNull();
    expect(screen.queryByText('Copy')).toBeNull();
    expect(screen.queryByText('Download ZIP')).toBeNull();
  });

  it('copies command to clipboard when copy button is clicked', async () => {
    await renderWithEntity(skillEntity);

    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'npx skills add code-review-skill',
    );

    await waitFor(() => {
      expect(copyButton).toHaveTextContent('Copied');
    });
  });

  it('renders the verified git archive as a safe external link', async () => {
    await renderWithEntity(gitEntity);
    expect(screen.getByRole('link', { name: 'Download ZIP' })).toHaveAttribute(
      'href',
      'https://api.github.com/repos/example/no-hardcoded-secrets-rule/zipball',
    );
    expect(screen.getByRole('link', { name: 'Download ZIP' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('uses View Source for Git subpaths instead of guessing an archive', async () => {
    await renderWithEntity({
      ...gitEntity,
      spec: {
        ...gitEntity.spec,
        location: {
          type: 'git',
          target: 'https://github.com/example/repo/tree/main/rules',
        },
      },
    });

    expect(screen.getByRole('link', { name: 'View Source' })).toHaveAttribute(
      'href',
      'https://github.com/example/repo/tree/main/rules',
    );
    expect(screen.queryByText('Download ZIP')).not.toBeInTheDocument();
  });

  it('shows a translated inline error and retries a failed copy', async () => {
    const writeText = jest
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await renderWithEntity(skillEntity);

    fireEvent.click(
      screen.getByRole('button', { name: 'Copy command to clipboard' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Copy failed');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Copy command to clipboard' }),
      ).toHaveTextContent('Copied'),
    );
  });

  it('cleans up the success timer when unmounted', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const rendered = await renderWithEntity(skillEntity);

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Copy command to clipboard' }),
      );
    });
    const timerIndex = setTimeoutSpy.mock.calls.findIndex(
      call => call[1] === 2000,
    );
    expect(timerIndex).toBeGreaterThanOrEqual(0);
    const timerHandle = setTimeoutSpy.mock.results[timerIndex].value;

    rendered.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timerHandle);
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
