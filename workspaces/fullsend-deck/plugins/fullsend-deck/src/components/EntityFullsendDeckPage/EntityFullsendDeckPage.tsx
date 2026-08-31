import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { FullsendDeckSurface } from '../FullsendDeckSurface';

export function EntityFullsendDeckPage() {
  const { entity } = useEntity();
  return (
    <FullsendDeckSurface
      entityRef={stringifyEntityRef(entity)}
      entityName={entity.metadata.title ?? entity.metadata.name}
    />
  );
}
