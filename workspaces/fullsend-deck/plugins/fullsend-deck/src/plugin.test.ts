import { api, fullsendDeckPlugin, page } from './plugin';

describe('fullsend-deck', () => {
  it('exports an NFS API and an owned global page', () => {
    expect(fullsendDeckPlugin).toBeDefined();
    expect(api).toBeDefined();
    expect(page).toBeDefined();
    expect(JSON.stringify(fullsendDeckPlugin)).not.toContain('createPlugin');
  });
});
