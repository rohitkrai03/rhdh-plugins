import type { Config } from '@backstage/config';

export interface GitHubRepositoryConfig {
  repository: string;
  host: string;
  entityRef: string | null;
}

export interface FullsendDeckConfig {
  enabled: boolean;
  filesystemDirectory: string | null;
  githubRepositories: GitHubRepositoryConfig[];
  githubArtifactNamePrefix: string;
  maxArtifactsPerRepository: number;
  schedule: {
    frequencyMinutes: number;
    timeoutMinutes: number;
    initialDelaySeconds: number;
  };
}

export function readFullsendDeckConfig(root: Config): FullsendDeckConfig {
  const config = root.getOptionalConfig('fullsendDeck');
  const repositories =
    config
      ?.getOptionalConfigArray('sources.github.repositories')
      ?.map(entry => {
        const repository = entry.getString('repository').trim();
        if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
          throw new Error(
            `fullsendDeck.sources.github.repositories repository must be owner/name: ${repository}`,
          );
        }
        return {
          repository,
          host: entry.getOptionalString('host')?.trim() || 'github.com',
          entityRef: entry.getOptionalString('entityRef')?.trim() || null,
        };
      }) ?? [];

  return {
    enabled: config?.getOptionalBoolean('enabled') ?? true,
    filesystemDirectory:
      config?.getOptionalString('sources.filesystem.directory')?.trim() || null,
    githubRepositories: repositories,
    githubArtifactNamePrefix:
      config?.getOptionalString('sources.github.artifactNamePrefix')?.trim() ||
      'fullsend',
    maxArtifactsPerRepository: boundedInteger(
      config?.getOptionalNumber('sources.github.maxArtifactsPerRepository'),
      25,
      1,
      100,
      'maxArtifactsPerRepository',
    ),
    schedule: {
      frequencyMinutes: boundedInteger(
        config?.getOptionalNumber('schedule.frequencyMinutes'),
        5,
        1,
        1440,
        'schedule.frequencyMinutes',
      ),
      timeoutMinutes: boundedInteger(
        config?.getOptionalNumber('schedule.timeoutMinutes'),
        4,
        1,
        1440,
        'schedule.timeoutMinutes',
      ),
      initialDelaySeconds: boundedInteger(
        config?.getOptionalNumber('schedule.initialDelaySeconds'),
        5,
        0,
        3600,
        'schedule.initialDelaySeconds',
      ),
    },
  };
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  field: string,
): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < minimum || result > maximum) {
    throw new Error(
      `fullsendDeck.${field} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}
