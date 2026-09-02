import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import {
  workItemSchema,
  type WorkItem,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import JSZip from 'jszip';
import type { FullsendDeckConfig, GitHubRepositoryConfig } from '../config';
import type { ArtifactRun, SourceCollection } from '../domain/types';

export interface ArtifactSource {
  readonly source: string;
  collect(now?: Date): Promise<SourceCollection>;
}

const GITHUB_ARTIFACT_CONCURRENCY = 4;

export class FilesystemArtifactSource implements ArtifactSource {
  readonly source = 'filesystem';

  constructor(private readonly directory: string) {}

  async collect(now = new Date()): Promise<SourceCollection> {
    const attemptedAt = now.toISOString();
    const workItems = await this.readWorkItems();
    const runDirectories = await findRunDirectories(this.directory);
    const runs: ArtifactRun[] = [];
    const diagnostics: SourceCollection['diagnostics'] = [];
    for (const directory of runDirectories) {
      try {
        const run = await readFilesystemRun(directory);
        if (run) runs.push(run);
      } catch (error) {
        diagnostics.push({
          source: 'filesystem',
          level: 'warning',
          message: `${path.relative(this.directory, directory)}: ${safeMessage(
            error,
          )}`,
        });
      }
    }
    return {
      source: 'filesystem',
      workItems,
      runs,
      attemptedAt,
      succeededAt: attemptedAt,
      rateLimitRemaining: null,
      diagnostics,
    };
  }

  private async readWorkItems(): Promise<WorkItem[]> {
    const file = path.join(this.directory, 'work-items.json');
    try {
      const values = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!Array.isArray(values)) throw new Error('expected a JSON array');
      return values.map(value => workItemSchema.parse(value));
    } catch (error) {
      if (isMissing(error)) return [];
      throw new Error(`Invalid work-items.json: ${safeMessage(error)}`);
    }
  }
}

export class GitHubArtifactSource implements ArtifactSource {
  readonly source = 'github';

  constructor(
    private readonly config: FullsendDeckConfig,
    private readonly integrations: ScmIntegrations,
    private readonly request: typeof fetch = fetch,
  ) {}

  async collect(now = new Date()): Promise<SourceCollection> {
    const attemptedAt = now.toISOString();
    const workItems: WorkItem[] = [];
    const runs: ArtifactRun[] = [];
    const diagnostics: SourceCollection['diagnostics'] = [];
    let rateLimitRemaining: number | null = null;
    let successes = 0;

    const repositoryResults = await Promise.allSettled(
      this.config.githubRepositories.map(repository =>
        this.collectRepository(repository, attemptedAt),
      ),
    );
    for (const [index, result] of repositoryResults.entries()) {
      const repository = this.config.githubRepositories[index];
      if (result.status === 'fulfilled') {
        workItems.push(...result.value.workItems);
        runs.push(...result.value.runs);
        rateLimitRemaining = minimumNullable(
          rateLimitRemaining,
          result.value.rateLimitRemaining,
        );
        successes += 1;
      } else {
        diagnostics.push({
          source: `github:${
            repository?.repository ?? `repository-${index + 1}`
          }`,
          level: 'error',
          message: safeMessage(result.reason),
        });
      }
    }

    return {
      source: 'github',
      workItems,
      runs,
      attemptedAt,
      succeededAt: successes > 0 ? attemptedAt : null,
      rateLimitRemaining,
      diagnostics,
    };
  }

  private async collectRepository(
    repository: GitHubRepositoryConfig,
    snapshotAt: string,
  ): Promise<{
    workItems: WorkItem[];
    runs: ArtifactRun[];
    rateLimitRemaining: number | null;
  }> {
    const integration = this.integrations.github.byHost(repository.host);
    if (!integration) {
      throw new Error(`No Backstage GitHub integration for ${repository.host}`);
    }
    const credentials = await DefaultGithubCredentialsProvider.fromIntegrations(
      this.integrations,
    ).getCredentials({
      url: `https://${repository.host}/${repository.repository}`,
    });
    const apiBaseUrl =
      integration.config.apiBaseUrl ??
      (repository.host === 'github.com'
        ? 'https://api.github.com'
        : `https://${repository.host}/api/v3`);
    // Kept below the source for readability; it is an internal transport detail.
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const client = new GitHubClient(
      apiBaseUrl,
      credentials.headers ??
        (credentials.token
          ? { Authorization: `Bearer ${credentials.token}` }
          : {}),
      this.request,
    );
    const [pulls, issues, artifacts] = await Promise.all([
      client.json<GitHubPull[]>(
        `/repos/${repository.repository}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
      ),
      client.json<GitHubIssue[]>(
        `/repos/${repository.repository}/issues?state=all&per_page=100&sort=updated&direction=desc`,
      ),
      client.json<{ artifacts: GitHubArtifact[] }>(
        `/repos/${repository.repository}/actions/artifacts?per_page=100`,
      ),
    ]);
    const workItems = [
      ...pulls.map(pull => githubPullToWorkItem(repository, pull, snapshotAt)),
      ...issues
        .filter(issue => !issue.pull_request)
        .map(issue => githubIssueToWorkItem(repository, issue, snapshotAt)),
    ];
    const candidates = artifacts.artifacts
      .filter(
        artifact =>
          !artifact.expired &&
          artifact.name.startsWith(this.config.githubArtifactNamePrefix),
      )
      .slice(0, this.config.maxArtifactsPerRepository);
    const runs = (
      await mapConcurrent(
        candidates,
        GITHUB_ARTIFACT_CONCURRENCY,
        async artifact => {
          const files = await client.zip(artifact.archive_download_url);
          if (Object.keys(files).length === 0) return null;
          const workflow = await client.json<GitHubWorkflowRun>(
            `/repos/${repository.repository}/actions/runs/${artifact.workflow_run.id}`,
          );
          return {
            sourceKey: `github:${repository.repository}:artifact:${artifact.id}`,
            repository: repository.repository,
            entityRef: repository.entityRef,
            providerRunId: String(workflow.id),
            url: workflow.html_url,
            branch: workflow.head_branch,
            conclusion: workflow.conclusion,
            createdAt: new Date(workflow.created_at).toISOString(),
            files,
          } satisfies ArtifactRun;
        },
      )
    ).filter((run): run is ArtifactRun => run !== null);
    return { workItems, runs, rateLimitRemaining: client.rateLimitRemaining };
  }
}

class GitHubClient {
  rateLimitRemaining: number | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly authHeaders: Record<string, string>,
    private readonly request: typeof fetch,
  ) {}

  async json<T>(pathOrUrl: string): Promise<T> {
    const response = await this.fetch(pathOrUrl);
    return (await response.json()) as T;
  }

  async zip(url: string): Promise<ArtifactRun['files']> {
    const response = await this.fetch(url);
    const archive = await JSZip.loadAsync(await response.arrayBuffer());
    const result: ArtifactRun['files'] = {};
    const supported = new Set([
      'run-telemetry.jsonl',
      'run-summary.json',
      'metrics.json',
      'output.jsonl',
    ]);
    for (const entry of Object.values(archive.files)) {
      const name = path.posix.basename(
        entry.name,
      ) as keyof ArtifactRun['files'];
      if (!entry.dir && supported.has(name)) {
        result[name] = await entry.async('string');
      }
    }
    return result;
  }

  private async fetch(pathOrUrl: string): Promise<Response> {
    const response = await this.request(
      pathOrUrl.startsWith('http') ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          ...this.authHeaders,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const rateLimit = response.headers.get('x-ratelimit-remaining');
    if (rateLimit && Number.isInteger(Number(rateLimit))) {
      this.rateLimitRemaining = minimumNullable(
        this.rateLimitRemaining,
        Number(rateLimit),
      );
    }
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }
    return response;
  }
}

async function mapConcurrent<T, Result>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(values[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () =>
      worker(),
    ),
  );
  return results;
}

async function findRunDirectories(root: string): Promise<string[]> {
  const result = new Set<string>();
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 5) return;
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    if (
      entries.some(entry =>
        [
          'run-telemetry.jsonl',
          'run-summary.json',
          'metrics.json',
          'output.jsonl',
        ].includes(entry.name),
      )
    ) {
      result.add(directory);
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory())
        await visit(path.join(directory, entry.name), depth + 1);
    }
  };
  await visit(root, 0);
  return [...result].sort();
}

async function readFilesystemRun(
  directory: string,
): Promise<ArtifactRun | null> {
  const metadata = JSON.parse(
    await fs.readFile(path.join(directory, 'run.json'), 'utf8'),
  ) as Record<string, unknown>;
  const repository = requiredString(metadata.repository, 'repository');
  const providerRunId = requiredString(
    metadata.providerRunId ?? metadata.runId,
    'providerRunId',
  );
  const files: ArtifactRun['files'] = {};
  for (const name of [
    'run-telemetry.jsonl',
    'run-summary.json',
    'metrics.json',
    'output.jsonl',
  ] as const) {
    try {
      files[name] = await fs.readFile(path.join(directory, name), 'utf8');
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  if (Object.keys(files).length === 0) return null;
  return {
    sourceKey: `filesystem:${path.resolve(directory)}`,
    repository,
    entityRef: optionalString(metadata.entityRef),
    providerRunId,
    url:
      optionalString(metadata.url) ??
      `https://github.com/${repository}/actions/runs/${providerRunId}`,
    branch: optionalString(metadata.branch),
    conclusion: optionalString(metadata.conclusion),
    createdAt:
      optionalIso(metadata.createdAt) ??
      new Date((await fs.stat(directory)).mtimeMs).toISOString(),
    files,
  };
}

function githubPullToWorkItem(
  config: GitHubRepositoryConfig,
  pull: GitHubPull,
  snapshotAt: string,
): WorkItem {
  const lifecycle = pullLifecycle(pull);
  const readiness = pullReadiness(lifecycle, pull.draft);
  return workItemSchema.parse({
    id: `github:${config.repository}:pull_request:${pull.number}`,
    entityRef: config.entityRef,
    source: 'github',
    kind: 'pull_request',
    repository: config.repository,
    number: pull.number,
    title: pull.title,
    url: pull.html_url,
    lifecycle,
    readiness,
    automationState: 'unknown',
    checksState: 'unknown',
    nextAction:
      readiness === 'actionable'
        ? { kind: 'review', label: 'Review pull request', url: pull.html_url }
        : null,
    reasonCodes: pull.draft ? ['DRAFT_PULL_REQUEST'] : [],
    evidence: [
      {
        type: 'branch',
        source: 'github',
        label: 'Head branch',
        value: pull.head.ref,
        observedAt: new Date(pull.updated_at).toISOString(),
      },
    ],
    ownership: {
      assignees: pull.assignees.map(user => user.login),
      relation: pull.assignees.length > 0 ? 'assignee' : 'none',
    },
    priority: priorityFor(readiness, pull.draft),
    freshness: freshnessFor(pull.updated_at, snapshotAt),
  });
}

function githubIssueToWorkItem(
  config: GitHubRepositoryConfig,
  issue: GitHubIssue,
  snapshotAt: string,
): WorkItem {
  const lifecycle = issue.state === 'closed' ? 'closed' : 'open';
  const readiness = lifecycle === 'open' ? 'actionable' : 'done';
  return workItemSchema.parse({
    id: `github:${config.repository}:issue:${issue.number}`,
    entityRef: config.entityRef,
    source: 'github',
    kind: 'issue',
    repository: config.repository,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    lifecycle,
    readiness,
    automationState: 'idle',
    checksState: 'unknown',
    nextAction:
      readiness === 'actionable'
        ? { kind: 'triage', label: 'Triage issue', url: issue.html_url }
        : null,
    reasonCodes: [],
    evidence: issue.labels.map(label => ({
      type: 'label',
      source: 'github',
      label: 'Issue label',
      value: typeof label === 'string' ? label : label.name ?? '',
      observedAt: new Date(issue.updated_at).toISOString(),
    })),
    ownership: {
      assignees: issue.assignees.map(user => user.login),
      relation: issue.assignees.length > 0 ? 'assignee' : 'none',
    },
    priority: priorityFor(readiness, false),
    freshness: freshnessFor(issue.updated_at, snapshotAt),
  });
}

function priorityFor(
  readiness: WorkItem['readiness'],
  draft: boolean,
): WorkItem['priority'] {
  if (readiness === 'done') {
    return { score: 0, summary: 'Work is complete', factors: [] };
  }
  if (draft) {
    return {
      score: 20,
      summary: 'Draft work is waiting',
      factors: [{ code: 'DRAFT', label: 'Draft', points: 20 }],
    };
  }
  return {
    score: 50,
    summary: 'Open work is ready for attention',
    factors: [{ code: 'ACTIONABLE', label: 'Actionable', points: 50 }],
  };
}

function pullLifecycle(pull: GitHubPull): WorkItem['lifecycle'] {
  if (pull.merged_at) return 'merged';
  if (pull.state === 'closed') return 'closed';
  return 'open';
}

function pullReadiness(
  lifecycle: WorkItem['lifecycle'],
  draft: boolean,
): WorkItem['readiness'] {
  if (lifecycle !== 'open') return 'done';
  return draft ? 'waiting' : 'actionable';
}

function freshnessFor(
  observedAt: string,
  snapshotAt: string,
): WorkItem['freshness'] {
  const observed = new Date(observedAt).toISOString();
  const age = Date.parse(snapshotAt) - Date.parse(observed);
  return {
    observedAt: observed,
    snapshotAt,
    state: age > 24 * 60 * 60 * 1000 ? 'stale' : 'current',
  };
}

interface GitHubUser {
  login: string;
}
interface GitHubPull {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  merged_at: string | null;
  updated_at: string;
  head: { ref: string };
  assignees: GitHubUser[];
}
interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  updated_at: string;
  assignees: GitHubUser[];
  labels: Array<string | { name?: string }>;
  pull_request?: unknown;
}
interface GitHubArtifact {
  id: number;
  name: string;
  expired: boolean;
  archive_download_url: string;
  workflow_run: { id: number };
}
interface GitHubWorkflowRun {
  id: number;
  html_url: string;
  head_branch: string | null;
  conclusion: string | null;
  created_at: string;
}

function requiredString(value: unknown, name: string): string {
  const result = optionalString(value);
  if (!result) throw new Error(`run.json is missing ${name}`);
  return result;
}
function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function optionalIso(value: unknown): string | null {
  const text = optionalString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function safeMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/(token|authorization)=?[^\s,]*/gi, '$1=[redacted]')
    : 'Source collection failed';
}
function isMissing(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT',
  );
}
function minimumNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}
