import { Alert, Container } from '@backstage/ui';
import {
  useFullsendDeckContext,
  readEntityScope,
} from '../FullsendDeckContext';
import { FullsendDeckSurface, type DeckView } from '../FullsendDeckSurface';

export interface FullsendDeckPageProps {
  view: DeckView;
}

export function FullsendDeckPage({ view }: FullsendDeckPageProps) {
  const context = useFullsendDeckContext();
  if (context.invalidEntityRef) {
    return (
      <main>
        <Container py="5">
          <Alert
            status="danger"
            icon
            title="Invalid entity scope"
            description="Use a canonical Backstage entity reference such as component:default/payments."
          />
        </Container>
      </main>
    );
  }

  return (
    <FullsendDeckSurface
      view={view}
      window={context.window}
      onWindowChange={context.setWindow}
      entityRef={context.entityRef}
      entityName={context.entityRef}
    />
  );
}

export { readEntityScope };
