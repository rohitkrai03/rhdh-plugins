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

import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from './accessibility';

const catalogEndpoint = '**/api/catalog/entities?**';

function fixtureEntity(index: number) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'AiResource',
    metadata: {
      name: `release-skill-${String(index).padStart(2, '0')}`,
      title: `Release Skill ${String(index).padStart(2, '0')}`,
      description: `Release test skill ${index}`,
      namespace: 'default',
      uid: `release-${index}`,
      tags: ['release-proof'],
      annotations: { 'rhdh.io/ai-asset-source': 'e2e' },
    },
    spec: { type: 'skill', owner: 'team-ai-platform' },
  };
}

async function openTypeSelect(page: Page) {
  const filterRegion = page.getByRole('complementary', { name: 'Filters' });
  await filterRegion.getByRole('button', { name: /Type/ }).click();
}

async function signIn(page: Page) {
  await page.goto('/');
  const catalogHeading = page.getByRole('heading', { name: 'AI Catalog' });
  const enter = page.getByRole('button', { name: /enter/i });
  await expect(catalogHeading.or(enter)).toBeVisible();
  if (await enter.isVisible()) {
    await enter.click();
  }
  await expect(catalogHeading).toBeVisible();
}

async function openCatalog(page: Page, path = '/ai-catalog') {
  await signIn(page);
  await page.goto(path);
}

test('searches, filters, switches views, sorts, and navigates', async ({
  page,
}, testInfo) => {
  await openCatalog(page);
  await expect(page.getByRole('heading', { name: 'AI Catalog' })).toBeVisible();
  await expect(page.getByText('Granite Code Model')).toBeVisible();
  const allCount = await page.getByText(/^All \(\d+\)$/).textContent();

  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('Granite Code Model');
  await expect(page.getByText('All (1)')).toBeVisible();
  await search.clear();
  await expect(page.getByText(allCount!)).toBeVisible();

  await openTypeSelect(page);
  await page.getByRole('option', { name: 'Models' }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/type=ai-model/);
  await expect(page.getByText('All (1)')).toBeVisible();

  await page.getByRole('radio', { name: 'Table view' }).click();
  await expect(page.getByRole('columnheader')).toHaveText([
    'Name',
    'Type',
    'Provider',
    'Owner',
    'Description',
  ]);
  await page.getByRole('columnheader', { name: 'Name' }).click();
  await expect(
    page.getByRole('link', { name: 'Granite Code Model' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo, 'desktop-table');

  await page.getByRole('radio', { name: 'Card view' }).click();
  await page
    .getByRole('article')
    .filter({ hasText: 'Granite Code Model' })
    .click();
  await expect(page).toHaveURL(
    /\/catalog\/default\/resource\/granite-code-model/,
  );

  await openCatalog(page);
  await expectNoAccessibilityViolations(page, testInfo, 'desktop-catalog');
});

test('compact filter dialog applies atomically and cancels drafts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openCatalog(page);
  const trigger = page.getByRole('button', { name: 'Filters' });
  await expect(trigger).toBeVisible();

  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  await dialog.getByRole('button', { name: /Type/ }).click();
  await page.locator('[role="option"]:visible').getByText('Skills').click();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/type=/);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Type/ }).click();
  await page.locator('[role="option"]:visible').getByText('Skills').click();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(page).toHaveURL(/type=skill/);
  await expect(page.getByText('All (1)')).toBeVisible();
});

test('paginates mocked catalogs and recovers from an out-of-range page', async ({
  page,
}) => {
  await signIn(page);
  await page.route(catalogEndpoint, route =>
    route.fulfill({
      json: Array.from({ length: 25 }, (_, i) => fixtureEntity(i)),
    }),
  );
  await page.goto('/ai-catalog?pageSize=10');
  await expect(page.getByText('All (25)')).toBeVisible();
  await expect(page.getByText('Release Skill 00')).toBeVisible();

  await page.getByRole('button', { name: /next/i }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByText('Release Skill 10')).toBeVisible();

  await page.goto('/ai-catalog?page=99&pageSize=10');
  await expect(page.getByText('Release Skill 00')).toBeVisible();
  await expect(page).not.toHaveURL(/page=99/);
});

test('renders loading, error recovery, and empty states', async ({ page }) => {
  await signIn(page);
  let attempts = 0;
  await page.route(catalogEndpoint, async route => {
    attempts += 1;
    if (attempts === 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ status: 500, body: 'Catalog unavailable' });
      return;
    }
    await route.fulfill({ json: [] });
  });

  const navigation = page.goto('/ai-catalog');
  await expect(page.getByTestId('loading-skeleton').first()).toBeVisible();
  await navigation;
  await expect(page.getByText('Failed to load AI assets')).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('No AI assets available')).toBeVisible();
});

for (const scenario of [
  {
    name: 'light',
    viewport: { width: 1440, height: 900 },
    media: { colorScheme: 'light' as const },
  },
  {
    name: 'dark',
    viewport: { width: 1024, height: 800 },
    media: { colorScheme: 'dark' as const },
  },
  {
    name: 'high contrast',
    viewport: { width: 768, height: 900 },
    media: { forcedColors: 'active' as const },
  },
  {
    name: 'compact dark',
    viewport: { width: 390, height: 844 },
    media: { colorScheme: 'dark' as const },
  },
]) {
  for (const zoom of [1, 2]) {
    test(`has no catalog overflow in ${scenario.name} at ${scenario.viewport.width}px and ${zoom * 100}% zoom`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: Math.floor(scenario.viewport.width / zoom),
        height: Math.floor(scenario.viewport.height / zoom),
      });
      await page.emulateMedia(scenario.media);
      await openCatalog(page);
      await expect(page.getByText(/^All \(\d+\)$/)).toBeVisible();
      const dimensions = await page
        .getByTestId('ai-catalog-page')
        .evaluate(element => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          offenders: [...element.querySelectorAll<HTMLElement>('*')]
            .filter(child => child.scrollWidth > element.clientWidth + 1)
            .slice(0, 10)
            .map(child => ({
              className: child.className,
              clientWidth: child.clientWidth,
              scrollWidth: child.scrollWidth,
              tag: child.tagName,
            })),
        }));
      expect(
        dimensions.scrollWidth,
        JSON.stringify(dimensions.offenders),
      ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      if (scenario.viewport.width === 390 && zoom === 2) {
        await expectNoAccessibilityViolations(page, testInfo, 'compact-dark');
      }
    });
  }
}
