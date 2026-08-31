import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { ScmIntegrations } from '@backstage/integration';
import { fullsendDeckPermissions } from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import { readFullsendDeckConfig } from './config';
import {
  FilesystemArtifactSource,
  GitHubArtifactSource,
  type ArtifactSource,
} from './ingestion/ArtifactSources';
import { IngestionService } from './ingestion/IngestionService';
import { SnapshotStore } from './persistence/SnapshotStore';
import { createRouter } from './router';

/**
 * fullsendDeckPlugin backend plugin
 *
 * @public
 */
export const fullsendDeckPlugin = createBackendPlugin({
  pluginId: 'fullsend-deck',
  register(env) {
    env.registerInit({
      deps: {
        auditor: coreServices.auditor,
        config: coreServices.rootConfig,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
        scheduler: coreServices.scheduler,
      },
      async init({
        auditor,
        config,
        database,
        httpAuth,
        httpRouter,
        logger,
        permissions,
        permissionsRegistry,
        scheduler,
      }) {
        permissionsRegistry.addPermissions(fullsendDeckPermissions);
        const pluginConfig = readFullsendDeckConfig(config);
        const store = await SnapshotStore.create(database);
        const integrations = ScmIntegrations.fromConfig(config);
        const sources: ArtifactSource[] = [];
        if (pluginConfig.filesystemDirectory) {
          sources.push(
            new FilesystemArtifactSource(pluginConfig.filesystemDirectory),
          );
        }
        if (pluginConfig.githubRepositories.length > 0) {
          sources.push(new GitHubArtifactSource(pluginConfig, integrations));
        }
        const ingestion = new IngestionService(
          pluginConfig,
          store,
          sources,
          logger,
        );
        httpRouter.use(
          await createRouter({
            auditor,
            httpAuth,
            permissions,
            store,
          }),
        );
        httpRouter.addAuthPolicy({ path: '/health', allow: 'unauthenticated' });
        await ingestion.schedule(scheduler);
      },
    });
  },
});
