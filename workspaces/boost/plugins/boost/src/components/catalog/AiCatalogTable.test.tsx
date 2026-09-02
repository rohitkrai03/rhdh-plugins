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
import { renderInTestApp } from '@backstage/test-utils';

import { AiCatalogTable } from './AiCatalogTable';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: {
    name: 'granite-model',
    title: 'Granite Model',
    description: 'A standalone model.',
    annotations: { 'rhdh.io/ai-asset-source': 'model-registry' },
  },
  spec: { type: 'AI-Model', owner: 'group:ml/model-team' },
};

describe('AiCatalogTable', () => {
  it('uses the release column order and links owners', async () => {
    const rendered = await renderInTestApp(
      <AiCatalogTable
        entities={[entity]}
        sort={{ descriptor: null, onSortChange: jest.fn() }}
      />,
    );

    expect(
      rendered
        .getAllByRole('columnheader')
        .map(header => header.textContent?.trim()),
    ).toEqual(['Name', 'Type', 'Provider', 'Owner', 'Description']);
    expect(rendered.getByText('Models')).toBeInTheDocument();
    expect(
      rendered.getByRole('link', { name: 'group:ml/model-team' }),
    ).toHaveAttribute('href', '/catalog/ml/group/model-team');
  });
});
