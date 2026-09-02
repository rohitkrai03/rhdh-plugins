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

import { boostPlugin } from './plugin';

function registeredExtensionIds(frontendPlugin: object): string[] {
  const extensions = (
    frontendPlugin as { extensions?: ReadonlyArray<{ id: string }> }
  ).extensions;
  if (!extensions) throw new Error('plugin.extensions is missing');
  return extensions.map(extension => extension.id);
}

describe('boostPlugin', () => {
  it('registers the release-ready entity cards without a Usage tab', () => {
    const extensionIds = registeredExtensionIds(boostPlugin);
    expect(extensionIds).toEqual(
      expect.arrayContaining([
        'entity-card:boost/summary',
        'entity-card:boost/adoption',
        'entity-card:boost/asset-location',
        'entity-card:boost/version-list',
      ]),
    );
    expect(extensionIds).not.toContain('entity-content:boost/usage');
  });
});
