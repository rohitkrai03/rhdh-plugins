import { api, entityContent, fullsendDeckPlugin, page } from './plugin';

describe('fullsend-deck', () => {
  it('exports NFS API, global page, and entity-content features', () => {
    expect(fullsendDeckPlugin).toBeDefined();
    expect(api).toBeDefined();
    expect(page).toBeDefined();
    expect(entityContent).toBeDefined();
    expect(JSON.stringify(fullsendDeckPlugin)).not.toContain('createPlugin');
  });
});
