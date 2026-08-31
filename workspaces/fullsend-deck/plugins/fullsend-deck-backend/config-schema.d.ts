export interface Config {
  fullsendDeck?: {
    /** @visibility frontend */
    enabled?: boolean;
    sources?: {
      filesystem?: {
        /** Absolute, read-only directory containing exported Fullsend artifacts. */
        directory?: string;
      };
      github?: {
        artifactNamePrefix?: string;
        maxArtifactsPerRepository?: number;
        repositories?: Array<{
          repository: string;
          host?: string;
          entityRef?: string;
        }>;
      };
    };
    schedule?: {
      frequencyMinutes?: number;
      timeoutMinutes?: number;
      initialDelaySeconds?: number;
    };
  };
}
