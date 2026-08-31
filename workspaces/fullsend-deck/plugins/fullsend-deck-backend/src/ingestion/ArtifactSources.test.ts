import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigReader } from '@backstage/config';
import { ScmIntegrations } from '@backstage/integration';
import { fixtureWorkItem } from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import JSZip from 'jszip';
import type { FullsendDeckConfig } from '../config';
import {
  FilesystemArtifactSource,
  GitHubArtifactSource,
} from './ArtifactSources';

describe('Artifact sources', () => {
  let temporaryDirectory: string | undefined;

  afterEach(async () => {
    if (temporaryDirectory) {
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
      temporaryDirectory = undefined;
    }
  });

  it('reads exported Fullsend artifacts without mutating the source', async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'fullsend-deck-'),
    );
    const runDirectory = path.join(temporaryDirectory, 'runs', '7001');
    await fs.mkdir(runDirectory, { recursive: true });
    await fs.writeFile(
      path.join(temporaryDirectory, 'work-items.json'),
      JSON.stringify([fixtureWorkItem]),
    );
    await fs.writeFile(
      path.join(runDirectory, 'run.json'),
      JSON.stringify({
        repository: 'fullsend-dev/fullsend',
        runId: '7001',
        branch: 'fullsend/issue-42',
        conclusion: 'success',
        createdAt: '2026-08-31T11:00:00.000Z',
      }),
    );
    await fs.writeFile(
      path.join(runDirectory, 'run-summary.json'),
      JSON.stringify({ agent: 'codex', model: 'gpt-5', exit_code: 0 }),
    );

    const result = await new FilesystemArtifactSource(
      temporaryDirectory,
    ).collect(new Date('2026-08-31T12:00:00.000Z'));

    expect(result.workItems).toEqual([fixtureWorkItem]);
    expect(result.runs).toEqual([
      expect.objectContaining({
        providerRunId: '7001',
        files: { 'run-summary.json': expect.any(String) },
      }),
    ]);
  });

  it('uses Backstage GitHub integration credentials for work and artifacts', async () => {
    const zip = new JSZip();
    zip.file('nested/run-telemetry.jsonl', '{"resourceSpans":[]}');
    const archive = await zip.generateAsync({ type: 'uint8array' });
    const request = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const headers = {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '4321',
      };
      if (url.includes('/pulls?')) {
        return new Response(
          JSON.stringify([
            {
              number: 42,
              title: 'Pull request',
              html_url: 'https://github.com/fullsend-dev/fullsend/pull/42',
              state: 'open',
              draft: false,
              merged_at: null,
              updated_at: '2026-08-31T11:30:00.000Z',
              head: { ref: 'fullsend/issue-42' },
              assignees: [{ login: 'octocat' }],
            },
          ]),
          { status: 200, headers },
        );
      }
      if (url.includes('/issues?')) {
        return new Response(
          JSON.stringify([
            {
              number: 43,
              title: 'Issue',
              html_url: 'https://github.com/fullsend-dev/fullsend/issues/43',
              state: 'open',
              updated_at: '2026-08-31T11:30:00.000Z',
              assignees: [],
              labels: [{ name: 'fullsend' }],
            },
          ]),
          { status: 200, headers },
        );
      }
      if (url.includes('/actions/artifacts?')) {
        return new Response(
          JSON.stringify({
            artifacts: [
              {
                id: 99,
                name: 'fullsend-run-7001',
                expired: false,
                archive_download_url: 'https://api.github.com/archive/99',
                workflow_run: { id: 7001 },
              },
            ],
          }),
          { status: 200, headers },
        );
      }
      if (url.endsWith('/archive/99')) {
        return new Response(archive, {
          status: 200,
          headers: { 'x-ratelimit-remaining': '4321' },
        });
      }
      if (url.endsWith('/actions/runs/7001')) {
        return new Response(
          JSON.stringify({
            id: 7001,
            html_url:
              'https://github.com/fullsend-dev/fullsend/actions/runs/7001',
            head_branch: 'fullsend/issue-42',
            conclusion: 'success',
            created_at: '2026-08-31T11:00:00.000Z',
          }),
          { status: 200, headers },
        );
      }
      return new Response('', { status: 404, headers });
    }) as typeof fetch;
    const config: FullsendDeckConfig = {
      enabled: true,
      filesystemDirectory: null,
      githubRepositories: [
        {
          repository: 'fullsend-dev/fullsend',
          host: 'github.com',
          entityRef: 'component:default/fullsend',
        },
      ],
      githubArtifactNamePrefix: 'fullsend',
      maxArtifactsPerRepository: 25,
      schedule: {
        frequencyMinutes: 5,
        timeoutMinutes: 4,
        initialDelaySeconds: 5,
      },
    };
    const integrations = ScmIntegrations.fromConfig(
      new ConfigReader({
        integrations: {
          github: [
            {
              host: 'github.com',
              apiBaseUrl: 'https://api.github.com',
              token: 'test-token',
            },
          ],
        },
      }),
    );

    const result = await new GitHubArtifactSource(
      config,
      integrations,
      request,
    ).collect(new Date('2026-08-31T12:00:00.000Z'));

    expect(result.workItems).toHaveLength(2);
    expect(result.workItems[0].entityRef).toBe('component:default/fullsend');
    expect(result.runs[0]).toMatchObject({
      providerRunId: '7001',
      files: { 'run-telemetry.jsonl': '{"resourceSpans":[]}' },
    });
    expect(result.rateLimitRemaining).toBe(4321);
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('test-token'),
        }),
      }),
    );
  });
});
