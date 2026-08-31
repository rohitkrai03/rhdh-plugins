import { randomUUID } from 'node:crypto';
import type { DatabaseService } from '@backstage/backend-plugin-api';
import {
  agentExecutionSchema,
  executionWorkItemLinkSchema,
  partialDataSchema,
  syncStatusSchema,
  workflowRunSchema,
  workItemSchema,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import type { z } from 'zod/v3';
import type {
  QuarantineRecord,
  Snapshot,
  SnapshotWrite,
} from '../domain/types';

type DatabaseClient = Awaited<ReturnType<DatabaseService['getClient']>>;

const tables = {
  snapshots: 'fullsend_deck_snapshots',
  workItems: 'fullsend_deck_work_items',
  workflowRuns: 'fullsend_deck_workflow_runs',
  agentExecutions: 'fullsend_deck_agent_executions',
  links: 'fullsend_deck_execution_links',
  errors: 'fullsend_deck_ingestion_errors',
  quarantine: 'fullsend_deck_quarantine',
} as const;

export class SnapshotStore {
  private constructor(private readonly client: DatabaseClient) {}

  static async create(database: DatabaseService): Promise<SnapshotStore> {
    const store = new SnapshotStore(await database.getClient());
    await store.migrate();
    return store;
  }

  async migrate(): Promise<void> {
    if (!(await this.client.schema.hasTable(tables.snapshots))) {
      await this.client.schema.createTable(tables.snapshots, table => {
        table.string('id').primary();
        table.string('ingestion_key').notNullable().unique();
        table.string('snapshot_at').notNullable().index();
        table.text('sync_json').notNullable();
        table.text('partial_json').notNullable();
        table.boolean('completed').notNullable().defaultTo(false).index();
      });
    }
    await this.createPayloadTable(tables.workItems);
    await this.createPayloadTable(tables.workflowRuns);
    await this.createPayloadTable(tables.agentExecutions);
    await this.createPayloadTable(tables.links);
    if (!(await this.client.schema.hasTable(tables.errors))) {
      await this.client.schema.createTable(tables.errors, table => {
        table.increments('id').primary();
        table.string('source').notNullable();
        table.text('message').notNullable();
        table.string('occurred_at').notNullable().index();
        table.string('retry_at').nullable();
      });
    }
    if (!(await this.client.schema.hasTable(tables.quarantine))) {
      await this.client.schema.createTable(tables.quarantine, table => {
        table.string('artifact_key').notNullable();
        table.string('parser_version').notNullable();
        table.text('reason').notNullable();
        table.string('failed_at').notNullable();
        table.integer('retry_count').notNullable().defaultTo(1);
        table.primary(['artifact_key', 'parser_version']);
      });
    }
  }

  async writeSnapshot(input: SnapshotWrite): Promise<Snapshot> {
    return this.client.transaction(async tx => {
      const existing = await tx(tables.snapshots)
        .select('id')
        .where({ ingestion_key: input.ingestionKey, completed: true })
        .first();
      if (existing) {
        const snapshot = await this.readById(String(existing.id), tx);
        if (!snapshot) throw new Error('Completed snapshot could not be read');
        return snapshot;
      }

      const id = randomUUID();
      await tx(tables.snapshots)
        .insert({
          id,
          ingestion_key: input.ingestionKey,
          snapshot_at: input.snapshotAt,
          sync_json: JSON.stringify(input.sync),
          partial_json: JSON.stringify(input.partial),
          completed: false,
        })
        .onConflict('ingestion_key')
        .ignore();

      // ON CONFLICT waits for a concurrent writer on PostgreSQL. Re-read the
      // owner after that wait so horizontally concurrent ingesters return the
      // committed snapshot instead of surfacing a unique-key failure.
      const owner = await tx(tables.snapshots)
        .select('id', 'completed')
        .where({ ingestion_key: input.ingestionKey })
        .first();
      if (!owner) throw new Error('Snapshot reservation could not be read');
      if (String(owner.id) !== id) {
        if (!owner.completed) {
          throw new Error('Snapshot ingestion is already in progress');
        }
        const snapshot = await this.readById(String(owner.id), tx);
        if (!snapshot) throw new Error('Completed snapshot could not be read');
        return snapshot;
      }
      await this.insertPayloads(
        tx,
        tables.workItems,
        id,
        input.workItems,
        item => item.id,
      );
      await this.insertPayloads(
        tx,
        tables.workflowRuns,
        id,
        input.workflowRuns,
        run => run.id,
      );
      await this.insertPayloads(
        tx,
        tables.agentExecutions,
        id,
        input.agentExecutions,
        execution => execution.id,
      );
      await this.insertPayloads(
        tx,
        tables.links,
        id,
        input.links,
        link => `${link.executionId}:${link.workItemId}`,
      );
      await tx(tables.snapshots).where({ id }).update({ completed: true });
      return { id, ...input };
    });
  }

  async readLatestSnapshot(): Promise<Snapshot | null> {
    const row = await this.client(tables.snapshots)
      .select('id')
      .where({ completed: true })
      .orderBy('snapshot_at', 'desc')
      .orderBy('id', 'desc')
      .first();
    return row ? this.readById(String(row.id), this.client) : null;
  }

  async recordIngestionError(
    source: string,
    error: unknown,
    occurredAt: Date,
    retryAt?: Date,
  ): Promise<void> {
    await this.client(tables.errors).insert({
      source,
      message: safeErrorMessage(error),
      occurred_at: occurredAt.toISOString(),
      retry_at: retryAt?.toISOString() ?? null,
    });
  }

  async quarantine(
    artifactKey: string,
    parserVersion: string,
    reason: string,
    failedAt: string,
  ): Promise<void> {
    const existing = await this.client(tables.quarantine)
      .where({ artifact_key: artifactKey, parser_version: parserVersion })
      .first();
    if (existing) {
      await this.client(tables.quarantine)
        .where({ artifact_key: artifactKey, parser_version: parserVersion })
        .update({
          reason,
          failed_at: failedAt,
          retry_count: Number(existing.retry_count) + 1,
        });
      return;
    }
    await this.client(tables.quarantine).insert({
      artifact_key: artifactKey,
      parser_version: parserVersion,
      reason,
      failed_at: failedAt,
      retry_count: 1,
    });
  }

  async clearQuarantineForArtifact(artifactKey: string): Promise<void> {
    await this.client(tables.quarantine)
      .where({ artifact_key: artifactKey })
      .delete();
  }

  async listQuarantine(): Promise<QuarantineRecord[]> {
    const rows = await this.client(tables.quarantine)
      .select('*')
      .orderBy('failed_at', 'desc');
    return rows.map(row => ({
      artifactKey: String(row.artifact_key),
      parserVersion: String(row.parser_version),
      reason: String(row.reason),
      failedAt: String(row.failed_at),
      retryCount: Number(row.retry_count),
    }));
  }

  private async createPayloadTable(name: string): Promise<void> {
    if (await this.client.schema.hasTable(name)) return;
    await this.client.schema.createTable(name, table => {
      table
        .string('snapshot_id')
        .notNullable()
        .references('id')
        .inTable(tables.snapshots)
        .onDelete('CASCADE');
      table.integer('position').notNullable();
      table.string('record_id').notNullable();
      table.text('payload').notNullable();
      table.primary(['snapshot_id', 'record_id']);
    });
  }

  private async insertPayloads<T>(
    tx: DatabaseClient,
    table: string,
    snapshotId: string,
    values: T[],
    id: (value: T) => string,
  ): Promise<void> {
    if (values.length === 0) return;
    await tx(table).insert(
      values.map((value, position) => ({
        snapshot_id: snapshotId,
        position,
        record_id: id(value),
        payload: JSON.stringify(value),
      })),
    );
  }

  private async readById(
    id: string,
    client: DatabaseClient,
  ): Promise<Snapshot | null> {
    const row = await client(tables.snapshots)
      .select('*')
      .where({ id, completed: true })
      .first();
    if (!row) return null;
    return {
      id: String(row.id),
      ingestionKey: String(row.ingestion_key),
      snapshotAt: String(row.snapshot_at),
      sync: syncStatusSchema.parse(parseJson(row.sync_json)),
      partial: partialDataSchema.parse(parseJson(row.partial_json)),
      workItems: await this.readPayloads(
        client,
        tables.workItems,
        id,
        workItemSchema,
      ),
      workflowRuns: await this.readPayloads(
        client,
        tables.workflowRuns,
        id,
        workflowRunSchema,
      ),
      agentExecutions: await this.readPayloads(
        client,
        tables.agentExecutions,
        id,
        agentExecutionSchema,
      ),
      links: await this.readPayloads(
        client,
        tables.links,
        id,
        executionWorkItemLinkSchema,
      ),
    };
  }

  private async readPayloads<T extends z.ZodTypeAny>(
    client: DatabaseClient,
    table: string,
    snapshotId: string,
    schema: T,
  ): Promise<Array<z.infer<T>>> {
    const rows = await client(table)
      .select('payload')
      .where({ snapshot_id: snapshotId })
      .orderBy('position', 'asc');
    return rows.map(row => schema.parse(parseJson(row.payload)));
  }
}

function parseJson(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function safeErrorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(
    /(token|authorization|password)=?[^\s,]*/gi,
    '$1=[redacted]',
  );
}
