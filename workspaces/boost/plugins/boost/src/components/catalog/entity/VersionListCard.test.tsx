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

import { VersionListCard } from './VersionListCard';

describe('VersionListCard', () => {
  it('shows only the current annotated version with a singular title', async () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'AiResource',
      metadata: {
        name: 'skill',
        annotations: { 'rhdh.io/ai-asset-version': '2.1.0' },
      },
      spec: { type: 'skill', versions: ['1.0.0', '2.0.0'] },
    };
    await renderInTestApp(
      <EntityProvider entity={entity}>
        <VersionListCard />
      </EntityProvider>,
    );

    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('2.1.0')).toBeInTheDocument();
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    expect(screen.queryByText('2.0.0')).not.toBeInTheDocument();
  });
});
