import { createPermission } from '@backstage/plugin-permission-common';

export const fullsendDeckReadPermission = createPermission({
  name: 'fullsend-deck.read',
  attributes: { action: 'read' },
});

export const fullsendDeckPermissions = [fullsendDeckReadPermission];
