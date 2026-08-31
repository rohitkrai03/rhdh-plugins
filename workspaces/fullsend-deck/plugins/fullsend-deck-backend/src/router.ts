import {
  type AuditorServiceEvent,
  type AuditorService,
  type HttpAuthService,
  type PermissionsService,
} from '@backstage/backend-plugin-api';
import { InputError, NotAllowedError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  API_SCHEMA_VERSION,
  apiErrorSchema,
  executionsResponseSchema,
  fullsendDeckReadPermission,
  overviewResponseSchema,
  syncStatusResponseSchema,
  windowedQuerySchema,
  workItemDetailResponseSchema,
  workItemsQuerySchema,
  workItemsResponseSchema,
  type WorkItem,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import express, { type Request, type Response } from 'express';
import Router from 'express-promise-router';
import type { z } from 'zod/v3';
import type { Snapshot } from './domain/types';
import { SnapshotStore } from './persistence/SnapshotStore';

export interface RouterOptions {
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  auditor: AuditorService;
  store: Pick<SnapshotStore, 'readLatestSnapshot'>;
  now?: () => Date;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const router = Router();
  router.use(express.json({ limit: '16kb' }));

  router.get('/health', (_req, response) => {
    response.json({ status: 'ok' });
  });

  router.use('/v1', async (request, _response, next) => {
    const event = await options.auditor.createEvent({
      eventId: 'read',
      request,
      meta: { resource: request.path },
    });
    try {
      const credentials = await options.httpAuth.credentials(request, {
        allow: ['user', 'service'],
      });
      const [decision] = await options.permissions.authorize(
        [{ permission: fullsendDeckReadPermission }],
        { credentials },
      );
      if (decision.result === AuthorizeResult.DENY) {
        throw new NotAllowedError('Fullsend Deck read permission is required');
      }
      setPrincipal(request, credentials.principal);
      setAuditEvent(request, event);
      next();
    } catch (error) {
      await event.fail({
        error:
          error instanceof Error ? error : new Error('Authorization failed'),
      });
      throw error;
    }
  });

  router.get(
    '/v1/overview',
    audited(async (request, response) => {
      const query = parseQuery(windowedQuerySchema, request.query);
      const snapshot = await requireSnapshot(options.store, response);
      if (!snapshot) return;
      const cutoff = windowCutoff(query.window, options.now?.() ?? new Date());
      const workItems = filterScope(
        snapshot.workItems,
        query.scope,
        query.entityRef,
      );
      const workflowRuns = snapshot.workflowRuns.filter(
        run =>
          run.startedAt >= cutoff &&
          (!query.scope || run.repository === query.scope),
      );
      const workflowIds = new Set(workflowRuns.map(run => run.id));
      const agentExecutions = snapshot.agentExecutions.filter(execution =>
        workflowIds.has(execution.workflowRunId),
      );
      const succeeded = agentExecutions.filter(
        execution => execution.status === 'succeeded',
      ).length;
      const failed = agentExecutions.filter(
        execution => execution.status === 'failed',
      ).length;
      sendValidated(response, overviewResponseSchema, {
        ...responseMeta(snapshot),
        window: query.window,
        scope: query.entityRef ?? query.scope ?? null,
        work: {
          total: workItems.length,
          byReadiness: {
            actionable: count(workItems, 'actionable'),
            waiting: count(workItems, 'waiting'),
            blocked: count(workItems, 'blocked'),
            done: count(workItems, 'done'),
          },
        },
        executions: {
          workflows: workflowRuns.length,
          agentExecutions: agentExecutions.length,
          succeeded,
          failed,
          successRate:
            agentExecutions.length > 0
              ? Math.round((succeeded / agentExecutions.length) * 100)
              : 0,
        },
        cost: {
          totalUsd: roundCost(
            agentExecutions.reduce(
              (total, execution) => total + execution.usage.costUsd,
              0,
            ),
          ),
        },
        sync: snapshot.sync,
      });
    }),
  );

  router.get(
    '/v1/work-items',
    audited(async (request, response) => {
      const query = parseQuery(workItemsQuerySchema, request.query);
      const snapshot = await requireSnapshot(options.store, response);
      if (!snapshot) return;
      const principal = principalFor(request);
      const values = snapshot.workItems.filter(
        item =>
          (!query.entityRef || item.entityRef === query.entityRef) &&
          (!query.source || item.source === query.source) &&
          (!query.repository || item.repository === query.repository) &&
          (!query.readiness || item.readiness === query.readiness) &&
          ownershipMatches(item, query.ownership, principal) &&
          (!query.search ||
            `${item.title} ${item.repository ?? ''} ${item.number ?? ''}`
              .toLowerCase()
              .includes(query.search.toLowerCase())),
      );
      const offset = decodeCursor(query.cursor, snapshot.id);
      if (offset === null) {
        sendApiError(
          response,
          400,
          'INVALID_CURSOR',
          'Cursor does not belong to the current snapshot',
        );
        return;
      }
      const items = values.slice(offset, offset + query.limit);
      sendValidated(response, workItemsResponseSchema, {
        ...responseMeta(snapshot),
        items,
        nextCursor:
          offset + items.length < values.length
            ? encodeCursor(snapshot.id, offset + items.length)
            : null,
      });
    }),
  );

  router.get(
    '/v1/work-items/:id',
    audited(async (request, response) => {
      const snapshot = await requireSnapshot(options.store, response);
      if (!snapshot) return;
      const item = snapshot.workItems.find(
        candidate => candidate.id === request.params.id,
      );
      if (!item) {
        sendApiError(
          response,
          404,
          'WORK_ITEM_NOT_FOUND',
          'Work item not found',
        );
        return;
      }
      const links = snapshot.links.filter(link => link.workItemId === item.id);
      const executionIds = new Set(links.map(link => link.executionId));
      sendValidated(response, workItemDetailResponseSchema, {
        ...responseMeta(snapshot),
        item,
        executions: snapshot.agentExecutions.filter(execution =>
          executionIds.has(execution.id),
        ),
        links,
      });
    }),
  );

  router.get(
    '/v1/executions',
    audited(async (request, response) => {
      const query = parseQuery(windowedQuerySchema, request.query);
      const snapshot = await requireSnapshot(options.store, response);
      if (!snapshot) return;
      const cutoff = windowCutoff(query.window, options.now?.() ?? new Date());
      const scopedWorkIds = query.entityRef
        ? new Set(
            snapshot.workItems
              .filter(item => item.entityRef === query.entityRef)
              .map(item => item.id),
          )
        : null;
      const scopedExecutionIds = scopedWorkIds
        ? new Set(
            snapshot.links
              .filter(link => scopedWorkIds.has(link.workItemId))
              .map(link => link.executionId),
          )
        : null;
      const workflowRuns = snapshot.workflowRuns.filter(
        run =>
          run.startedAt >= cutoff &&
          (!query.scope || run.repository === query.scope),
      );
      const workflowIds = new Set(workflowRuns.map(run => run.id));
      const values = snapshot.agentExecutions.filter(
        execution =>
          workflowIds.has(execution.workflowRunId) &&
          (!scopedExecutionIds || scopedExecutionIds.has(execution.id)),
      );
      const offset = decodeCursor(query.cursor, snapshot.id);
      if (offset === null) {
        sendApiError(
          response,
          400,
          'INVALID_CURSOR',
          'Cursor does not belong to the current snapshot',
        );
        return;
      }
      const agentExecutions = values.slice(offset, offset + query.limit);
      const executionIds = new Set(
        agentExecutions.map(execution => execution.id),
      );
      const pageWorkflowIds = new Set(
        agentExecutions.map(execution => execution.workflowRunId),
      );
      sendValidated(response, executionsResponseSchema, {
        ...responseMeta(snapshot),
        workflowRuns: workflowRuns.filter(run => pageWorkflowIds.has(run.id)),
        agentExecutions,
        links: snapshot.links.filter(link =>
          executionIds.has(link.executionId),
        ),
        nextCursor:
          offset + agentExecutions.length < values.length
            ? encodeCursor(snapshot.id, offset + agentExecutions.length)
            : null,
      });
    }),
  );

  router.get(
    '/v1/sync-status',
    audited(async (_request, response) => {
      const snapshot = await requireSnapshot(options.store, response);
      if (!snapshot) return;
      sendValidated(response, syncStatusResponseSchema, {
        ...responseMeta(snapshot),
        sync: snapshot.sync,
      });
    }),
  );

  return router;
}

function audited(
  handler: (request: Request, response: Response) => Promise<void>,
) {
  return async (request: Request, response: Response): Promise<void> => {
    const event = auditEventFor(request);
    try {
      await handler(request, response);
      await event.success({ meta: { statusCode: response.statusCode } });
    } catch (error) {
      await event.fail({
        error: error instanceof Error ? error : new Error('Request failed'),
        meta: { statusCode: response.statusCode },
      });
      throw error;
    }
  };
}

async function requireSnapshot(
  store: Pick<SnapshotStore, 'readLatestSnapshot'>,
  response: Response,
): Promise<Snapshot | null> {
  const snapshot = await store.readLatestSnapshot();
  if (snapshot) return snapshot;
  sendApiError(
    response,
    503,
    'SNAPSHOT_UNAVAILABLE',
    'No completed ingestion snapshot is available',
  );
  return null;
}

function parseQuery<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new InputError('Request parameters are invalid', {
    cause: result.error,
  });
}

function sendValidated<T extends z.ZodTypeAny>(
  response: Response,
  schema: T,
  value: unknown,
): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error('Stored Fullsend Deck snapshot failed runtime validation');
  }
  response.json(result.data);
}

function sendApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
): void {
  response
    .status(status)
    .json(apiErrorSchema.parse({ error: { code, message } }));
}

function responseMeta(snapshot: Snapshot) {
  return {
    schemaVersion: API_SCHEMA_VERSION,
    snapshotId: snapshot.id,
    snapshotAt: snapshot.snapshotAt,
    partial: snapshot.partial,
  };
}

function filterScope(
  items: WorkItem[],
  repository?: string,
  entityRef?: string,
): WorkItem[] {
  return items.filter(
    item =>
      (!repository || item.repository === repository) &&
      (!entityRef || item.entityRef === entityRef),
  );
}

function ownershipMatches(
  item: WorkItem,
  ownership: 'mine' | 'unassigned' | 'all',
  principal: string,
): boolean {
  if (ownership === 'all') return true;
  if (ownership === 'unassigned') return item.ownership.assignees.length === 0;
  const username = principal.split('/').pop()?.toLowerCase() ?? principal;
  return item.ownership.assignees.some(
    assignee =>
      assignee.toLowerCase() === principal.toLowerCase() ||
      assignee.toLowerCase() === username,
  );
}

function count(items: WorkItem[], readiness: WorkItem['readiness']): number {
  return items.filter(item => item.readiness === readiness).length;
}

function roundCost(value: number): number {
  return Math.round(value * 100) / 100;
}

function windowCutoff(window: '24h' | '7d' | '30d', now: Date): string {
  const hoursByWindow = { '24h': 24, '7d': 168, '30d': 720 } as const;
  const hours = hoursByWindow[window];
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

function encodeCursor(snapshotId: string, offset: number): string {
  return Buffer.from(JSON.stringify({ snapshotId, offset })).toString(
    'base64url',
  );
}

function decodeCursor(
  cursor: string | undefined,
  snapshotId: string,
): number | null {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { snapshotId?: unknown; offset?: unknown };
    return parsed.snapshotId === snapshotId &&
      Number.isInteger(parsed.offset) &&
      Number(parsed.offset) >= 0
      ? Number(parsed.offset)
      : null;
  } catch {
    return null;
  }
}

const principalKey = Symbol('fullsendDeckPrincipal');
const auditEventKey = Symbol('fullsendDeckAuditEvent');

function setPrincipal(
  request: Request,
  principal: { type: string; userEntityRef?: string },
): void {
  (request as Request & { [principalKey]?: string })[principalKey] =
    principal.type === 'user' && principal.userEntityRef
      ? principal.userEntityRef
      : principal.type;
}

function principalFor(request: Request): string {
  return (
    (request as Request & { [principalKey]?: string })[principalKey] ??
    'service'
  );
}

function setAuditEvent(request: Request, event: AuditorServiceEvent): void {
  (request as Request & { [auditEventKey]?: AuditorServiceEvent })[
    auditEventKey
  ] = event;
}

function auditEventFor(request: Request): AuditorServiceEvent {
  const event = (
    request as Request & { [auditEventKey]?: AuditorServiceEvent }
  )[auditEventKey];
  if (!event) throw new Error('Fullsend Deck audit event was not initialized');
  return event;
}
