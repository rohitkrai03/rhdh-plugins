import { Alert, Container, Header } from '@backstage/ui';
import { FullsendDeckSurface } from '../FullsendDeckSurface';

export function FullsendDeckPage() {
  const entityRef = readEntityScope(window.location.search);
  if (entityRef === null) {
    return (
      <main>
        <Header
          title="Fullsend Deck"
          description="Know what needs a human, then verify what the agents actually did."
        />
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
      entityRef={entityRef}
      entityName={entityRef ?? undefined}
    />
  );
}

export function readEntityScope(search: string): string | null | undefined {
  const value = new URLSearchParams(search).get('entity')?.trim();
  if (!value) return undefined;

  return /^[a-z0-9][a-z0-9_.-]*:[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/i.test(
    value,
  )
    ? value.toLocaleLowerCase('en-US')
    : null;
}
