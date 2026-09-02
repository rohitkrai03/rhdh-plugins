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

import { SummaryCard } from './SummaryCard';

function renderSummary(entity: Entity) {
  return renderInTestApp(
    <EntityProvider entity={entity}>
      <SummaryCard />
    </EntityProvider>,
  );
}

const agent: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'AiResource',
  metadata: {
    name: 'assistant',
    description: 'Standard About owns this description.',
  },
  spec: {
    type: 'agent',
    rationale: 'Reduces repetitive support work.',
    instructions: 'TechDocs owns these instructions.',
    handoffDescription: 'TechDocs owns handoff details.',
    enableRAG: true,
    models: { available: ['granite-3', 'llama-4'] },
  },
};

describe('SummaryCard', () => {
  it('shows only rationale and available models', async () => {
    await renderSummary(agent);

    expect(
      screen.getByText('Reduces repetitive support work.'),
    ).toBeInTheDocument();
    expect(screen.getByText('granite-3')).toBeInTheDocument();
    expect(screen.getByText('llama-4')).toBeInTheDocument();
    expect(
      screen.queryByText('Standard About owns this description.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('TechDocs owns these instructions.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('TechDocs owns handoff details.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Yes')).not.toBeInTheDocument();
  });

  it('renders nothing when only About or TechDocs fields exist', async () => {
    const { container } = await renderSummary({
      ...agent,
      metadata: { name: 'plain', description: 'Description only' },
      spec: { type: 'agent', instructions: 'Instructions only' },
    });
    expect(container).toBeEmptyDOMElement();
  });
});
