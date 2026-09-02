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

import { getAllCategories, getCategoryMeta } from './categoryMeta';

describe('categoryMeta', () => {
  it('provides canonical presentation metadata for every supported type', () => {
    expect(getAllCategories()).toEqual([
      { id: 'skill', label: 'Skills' },
      { id: 'rule', label: 'Rules' },
      { id: 'agent', label: 'Agents' },
      { id: 'skill-bundle', label: 'Skill Bundles' },
      { id: 'ai-model-server', label: 'Model Servers' },
      { id: 'mcp-server', label: 'MCP Servers' },
      { id: 'ai-model', label: 'Models' },
      { id: 'ai-tool', label: 'Tools' },
      { id: 'vector-store', label: 'Vector Stores' },
    ]);
  });

  it('normalizes stored type casing for presentation', () => {
    expect(getCategoryMeta('AI-MODEL').label).toBe('Models');
    expect(getCategoryMeta('Skill-Bundle').label).toBe('Skill Bundles');
  });
});
