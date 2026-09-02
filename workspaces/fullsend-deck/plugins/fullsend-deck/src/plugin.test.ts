import { coreExtensionData } from '@backstage/frontend-plugin-api';
import { createExtensionTester } from '@backstage/frontend-test-utils';
import { api, fullsendDeckPlugin, page, scope } from './plugin';

describe('fullsend-deck', () => {
  it('exports an NFS API, plugin wrapper, and owned global page', () => {
    expect(fullsendDeckPlugin).toBeDefined();
    expect(fullsendDeckPlugin.title).toBe('Fullsend Deck');
    expect(fullsendDeckPlugin.icon).toBeDefined();
    expect(api).toBeDefined();
    expect(scope).toBeDefined();
    expect(page).toBeDefined();
    expect(JSON.stringify(fullsendDeckPlugin)).not.toContain('createPlugin');
  });

  it('lets the app supply the default plugin header and route-backed tabs', () => {
    const pluginPage = fullsendDeckPlugin.getExtension('page:fullsend-deck');
    const pluginAttentionPage = fullsendDeckPlugin.getExtension(
      'sub-page:fullsend-deck/attention',
    );
    const pluginExecutionsPage = fullsendDeckPlugin.getExtension(
      'sub-page:fullsend-deck/executions',
    );
    const pluginCostPage = fullsendDeckPlugin.getExtension(
      'sub-page:fullsend-deck/cost',
    );
    const pluginDataHealthPage = fullsendDeckPlugin.getExtension(
      'sub-page:fullsend-deck/data-health',
    );
    const tester = createExtensionTester(pluginPage)
      .add(pluginAttentionPage)
      .add(pluginExecutionsPage)
      .add(pluginCostPage)
      .add(pluginDataHealthPage);

    expect(tester.get(coreExtensionData.title)).toBeUndefined();
    expect(tester.get(coreExtensionData.icon)).toBeUndefined();
    expect(tester.get(coreExtensionData.routeRef)).toBeDefined();
    expect(tester.snapshot().children?.pages).toHaveLength(4);
    expect(tester.query(pluginAttentionPage).get(coreExtensionData.title)).toBe(
      'Attention',
    );
    expect(
      tester.query(pluginExecutionsPage).get(coreExtensionData.title),
    ).toBe('Executions');
    expect(tester.query(pluginCostPage).get(coreExtensionData.title)).toBe(
      'Cost',
    );
    expect(
      tester.query(pluginDataHealthPage).get(coreExtensionData.title),
    ).toBe('Data health');
  });
});
