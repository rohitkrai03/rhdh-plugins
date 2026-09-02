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
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { renderInTestApp } from '@backstage/test-utils';
import { screen } from '@testing-library/react';

import { AssetLocationCard } from './AssetLocationCard';

function renderCard(entity: Entity) {
  return renderInTestApp(
    <EntityProvider entity={entity}>
      <AssetLocationCard />
    </EntityProvider>,
  );
}

describe('AssetLocationCard', () => {
  it('shows validated, deduplicated Git and OCI artifact sources', async () => {
    await renderCard({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: {
        name: 'model',
        annotations: {
          'backstage.io/source-location':
            'url:https://github.com/example/model',
        },
      },
      spec: {
        type: 'ai-model',
        location: { type: 'git', target: 'https://github.com/example/model' },
        remotes: [
          { url: 'oci://quay.io/example/model:1', type: 'oci' },
          { url: 'oci://quay.io/example/model:1', type: 'oci' },
          { url: 'https://runtime.example.com/mcp', type: 'streamable-http' },
        ],
      },
    });

    expect(
      screen.getByRole('link', { name: 'https://github.com/example/model' }),
    ).toHaveAttribute('href', 'https://github.com/example/model');
    expect(
      screen.getAllByText('https://github.com/example/model'),
    ).toHaveLength(1);
    expect(screen.getByText('quay.io/example/model:1')).toBeInTheDocument();
    expect(screen.queryByText('https://runtime.example.com/mcp')).toBeNull();
  });

  it('renders nothing when the entity has no validated source', async () => {
    const { container } = await renderCard({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: 'mcp' },
      spec: {
        type: 'mcp-server',
        remotes: [{ url: 'https://runtime.example.com/mcp' }],
      },
    });
    expect(container).toBeEmptyDOMElement();
  });
});
