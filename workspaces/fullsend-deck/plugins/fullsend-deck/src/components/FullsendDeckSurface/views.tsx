import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Cell,
  CellText,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  Flex,
  Grid,
  SearchField,
  Select,
  Table,
  Text,
  type ColumnConfig,
} from '@backstage/ui';
import type {
  AgentExecution,
  ExecutionWorkItemLink,
  WorkItem,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DeckData } from '../useDeckData';
import styles from './styles.module.css';

const queueGroups = [
  {
    id: 'do-now',
    label: 'Do now',
    description: 'A person can move these forward.',
  },
  {
    id: 'fullsend',
    label: 'Waiting on Fullsend',
    description: 'Automation is still working.',
  },
  {
    id: 'infrastructure',
    label: 'Waiting on CI or merge',
    description: 'Infrastructure owns the next transition.',
  },
  {
    id: 'blocked',
    label: 'Blocked',
    description: 'A dependency or missing input prevents progress.',
  },
  {
    id: 'done',
    label: 'Done',
    description: 'Completed work in the current snapshot.',
  },
] as const;

type QueueGroupId = (typeof queueGroups)[number]['id'];

export function AttentionView({
  data,
  entityRef,
}: {
  data: DeckData;
  entityRef?: string;
}) {
  const [search, setSearch] = useState('');
  const [repository, setRepository] = useState('all');
  const [readiness, setReadiness] = useState('all');
  const repositories = useMemo(
    () =>
      [...new Set(data.work.items.map(item => item.repository).filter(Boolean))]
        .sort()
        .map(value => ({ id: value!, label: value! })),
    [data.work.items],
  );
  const items = useMemo(
    () =>
      [...data.work.items]
        .filter(
          item =>
            (repository === 'all' || item.repository === repository) &&
            (readiness === 'all' || item.readiness === readiness) &&
            `${item.title} ${item.repository ?? ''} ${item.number ?? ''}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((left, right) => right.priority.score - left.priority.score),
    [data.work.items, readiness, repository, search],
  );
  const grouped = new Map<QueueGroupId, WorkItem[]>(
    queueGroups.map(group => [group.id, []]),
  );
  items.forEach(item => grouped.get(queueGroupFor(item))!.push(item));
  const hasFilters = Boolean(
    search || repository !== 'all' || readiness !== 'all',
  );
  const hasSources = data.sync.sync.sources.length > 0;
  const emptyState = emptyWorkCopy({ hasFilters, hasSources, entityRef });

  return (
    <section className={styles.view} aria-labelledby="attention-title">
      <SectionLead
        id="attention-title"
        kicker="Human queue"
        title="Attention"
        description="Readiness says what can move now. Automation status explains what happened, but never decides the queue by itself."
      />
      <Card>
        <CardBody>
          <div className={styles.queueToolbar} role="search">
            <SearchField
              label="Find work"
              placeholder="Title, repository, or number"
              value={search}
              onChange={setSearch}
            />
            <Select
              label="Repository"
              options={[
                { id: 'all', label: 'All repositories' },
                ...repositories,
              ]}
              selectedKey={repository}
              onSelectionChange={key =>
                setRepository(key ? String(key) : 'all')
              }
            />
            <Select
              label="Readiness"
              options={[
                { id: 'all', label: 'All readiness' },
                { id: 'actionable', label: 'Actionable' },
                { id: 'waiting', label: 'Waiting' },
                { id: 'blocked', label: 'Blocked' },
                { id: 'done', label: 'Done' },
              ]}
              selectedKey={readiness}
              onSelectionChange={key => setReadiness(key ? String(key) : 'all')}
            />
          </div>
        </CardBody>
      </Card>
      {items.length === 0 ? (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
        />
      ) : (
        <div className={styles.workQueue}>
          {queueGroups.map(group => {
            const groupItems = grouped.get(group.id)!;
            if (groupItems.length === 0) return null;
            return (
              <section
                key={group.id}
                aria-labelledby={`queue-${group.id}`}
                className={styles.queueSection}
              >
                <div className={styles.queueHeading}>
                  <div>
                    <Text
                      as="h3"
                      id={`queue-${group.id}`}
                      variant="title-small"
                      weight="bold"
                    >
                      {group.label}
                    </Text>
                    <Text variant="body-small" color="secondary">
                      {group.description}
                    </Text>
                  </div>
                  <Badge>{groupItems.length}</Badge>
                </div>
                <div className={styles.workList}>
                  {groupItems.map(item => (
                    <WorkCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {data.work.nextCursor ? (
        <Text variant="body-small" color="warning">
          The snapshot contains more than 100 work items. This view
          intentionally shows the highest-priority first page.
        </Text>
      ) : null}
    </section>
  );
}

function WorkCard({ item }: { item: WorkItem }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (opened.current && !dialogOpen) triggerRef.current?.focus();
  }, [dialogOpen]);

  return (
    <Card
      className={`${styles.workCard} ${
        styles[`workCard_${item.readiness}`] ?? ''
      }`}
    >
      <CardBody>
        <div className={styles.workCardLayout}>
          <div className={styles.workMain}>
            <Flex align="center" gap="2" className={styles.wrap}>
              <StatusBadge value={item.readiness} />
              <Text variant="body-x-small" color="secondary">
                {item.repository ?? item.source}
                {item.number ? ` #${item.number}` : ''}
              </Text>
              <Text
                as="span"
                variant="body-x-small"
                color="secondary"
                className={styles.priority}
                title={item.priority.summary}
              >
                P{item.priority.score}
              </Text>
            </Flex>
            <Text
              as="h4"
              variant="title-small"
              weight="bold"
              className={styles.workTitle}
            >
              {item.title}
            </Text>
            <Text variant="body-small" className={styles.nextAction}>
              {item.nextAction?.label ?? 'Review evidence before taking action'}
            </Text>
            <dl className={styles.workFacts}>
              <div>
                <dt>Automation</dt>
                <dd>{humanize(item.automationState)}</dd>
              </div>
              <div>
                <dt>Checks</dt>
                <dd>{humanize(item.checksState)}</dd>
              </div>
              <div>
                <dt>Observed</dt>
                <dd>{formatDate(item.freshness.observedAt)}</dd>
              </div>
            </dl>
          </div>
          <Flex gap="2" align="center" className={styles.workActions}>
            {item.nextAction ? (
              <ButtonLink
                href={item.nextAction.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open action
              </ButtonLink>
            ) : null}
            <DialogTrigger
              isOpen={dialogOpen}
              onOpenChange={isOpen => {
                if (isOpen) opened.current = true;
                setDialogOpen(isOpen);
              }}
            >
              <Button ref={triggerRef} variant="secondary">
                Evidence
              </Button>
              <WorkDialog item={item} />
            </DialogTrigger>
          </Flex>
        </div>
      </CardBody>
    </Card>
  );
}

function WorkDialog({ item }: { item: WorkItem }) {
  return (
    <Dialog width="min(680px, calc(100vw - 32px))">
      <>
        <DialogHeader>{item.title}</DialogHeader>
        <DialogBody>
          <Text as="h3" variant="title-x-small" weight="bold">
            Why it is ranked here
          </Text>
          <ul className={styles.evidenceList}>
            {item.priority.factors.map(factor => (
              <li key={factor.code}>
                <Text>
                  {factor.label} <strong>{signed(factor.points)}</strong>
                </Text>
              </li>
            ))}
          </ul>
          <Text
            as="h3"
            variant="title-x-small"
            weight="bold"
            className={styles.evidenceHeading}
          >
            Evidence
          </Text>
          {item.evidence.length === 0 ? (
            <Text color="secondary">No source evidence was recorded.</Text>
          ) : (
            <ul className={styles.evidenceList}>
              {item.evidence.map((evidence, index) => (
                <li key={`${evidence.type}-${index}`}>
                  <Text>{evidence.label}</Text>
                  <Text variant="body-small" color="secondary">
                    {evidence.source}
                    {evidence.value !== undefined ? ` · ${evidence.value}` : ''}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" slot="close">
            Close
          </Button>
          <ButtonLink href={item.url} target="_blank" rel="noopener noreferrer">
            View source
          </ButtonLink>
        </DialogFooter>
      </>
    </Dialog>
  );
}

export function ExecutionsView({ data }: { data: DeckData }) {
  const workflows = new Map(
    data.executions.workflowRuns.map(workflow => [workflow.id, workflow]),
  );
  const links = new Map(
    data.executions.links.map(link => [link.executionId, link]),
  );
  const executionCounts = aggregateValues(
    data.executions.agentExecutions,
    execution => execution.agent,
    () => 1,
  );
  const columns: ColumnConfig<AgentExecution>[] = [
    {
      id: 'agent',
      label: 'Agent execution',
      isRowHeader: true,
      cell: execution => (
        <CellText
          title={execution.agent}
          description={`${execution.model || 'Unknown model'} · ${formatDate(
            execution.startedAt,
          )}`}
        />
      ),
    },
    {
      id: 'agent-status',
      label: 'Agent result',
      cell: execution => (
        <Cell>
          <StatusBadge value={execution.status} />
        </Cell>
      ),
    },
    {
      id: 'workflow-status',
      label: 'Workflow result',
      cell: execution => (
        <Cell>
          <StatusBadge
            value={workflows.get(execution.workflowRunId)?.status ?? 'unknown'}
          />
        </Cell>
      ),
    },
    {
      id: 'correlation',
      label: 'Work link',
      cell: execution => <CorrelationCell link={links.get(execution.id)} />,
    },
    {
      id: 'cost',
      label: 'Cost',
      cell: execution => <CellText title={usd(execution.usage.costUsd)} />,
    },
  ];

  return (
    <section className={styles.view} aria-labelledby="executions-title">
      <SectionLead
        id="executions-title"
        kicker={`${data.overview.window} snapshot`}
        title="Executions"
        description="Workflow conclusions and agent exits are shown separately. A green workflow can still contain a failed agent."
      />
      <div className={styles.metrics}>
        <Metric
          label="Agent executions"
          value={data.overview.executions.agentExecutions}
          detail={`${data.overview.executions.workflows} workflow runs`}
        />
        <Metric
          label="Agent failures"
          value={data.overview.executions.failed}
          tone={data.overview.executions.failed > 0 ? 'danger' : 'success'}
          detail="Uses agent exit status"
        />
        <Metric
          label="Recorded cost"
          value={usd(data.overview.cost.totalUsd)}
          detail={`Across ${data.overview.window}`}
        />
      </div>
      <div className={styles.executionGrid}>
        <Card>
          <CardHeader>
            <Text as="h3" variant="title-small" weight="bold">
              Executions by agent
            </Text>
          </CardHeader>
          <CardBody>
            <BarList rows={executionCounts} format={value => String(value)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <Flex justify="between" align="center" gap="3">
              <Text as="h3" variant="title-small" weight="bold">
                Recent execution records
              </Text>
              <Text variant="body-x-small" color="secondary">
                {data.overview.window}
              </Text>
            </Flex>
          </CardHeader>
          <CardBody className={styles.tableCard}>
            <Table
              data={data.executions.agentExecutions}
              columnConfig={columns}
              pagination={{ type: 'none' }}
              emptyState={
                <EmptyState
                  title="No executions"
                  description="No agent executions exist in this window and scope."
                />
              }
            />
          </CardBody>
        </Card>
      </div>
      {data.executions.nextCursor ? (
        <Text variant="body-small" color="warning">
          Showing the first 100 snapshot-consistent executions.
        </Text>
      ) : null}
    </section>
  );
}

function CorrelationCell({ link }: { link?: ExecutionWorkItemLink }) {
  if (!link) return <CellText title="Unlinked" description="No work item" />;
  return (
    <CellText
      title={link.method === 'canonical' ? 'Canonical' : 'Heuristic'}
      description={`${Math.round(link.confidence * 100)}% confidence`}
      color={link.method === 'heuristic' ? 'secondary' : 'primary'}
    />
  );
}

export function CostView({ data }: { data: DeckData }) {
  const executions = data.executions.agentExecutions;
  const workflows = new Map(
    data.executions.workflowRuns.map(workflow => [workflow.id, workflow]),
  );
  const total = executions.reduce(
    (sum, execution) => sum + execution.usage.costUsd,
    0,
  );
  const tokens = executions.reduce(
    (sum, execution) =>
      sum + execution.usage.inputTokens + execution.usage.outputTokens,
    0,
  );
  const byRepository = aggregateValues(
    executions,
    execution =>
      workflows.get(execution.workflowRunId)?.repository ??
      'Unknown repository',
    execution => execution.usage.costUsd,
  );
  const byAgent = aggregateValues(
    executions,
    execution => execution.agent,
    execution => execution.usage.costUsd,
  );
  const byModel = aggregateValues(
    executions,
    execution => execution.model || 'Unknown model',
    execution => execution.usage.costUsd,
  );
  return (
    <section className={styles.view} aria-labelledby="cost-title">
      <SectionLead
        id="cost-title"
        kicker={`${data.overview.window} usage`}
        title="Cost"
        description="Cost is operational evidence, not a readiness signal. Compare it within the same execution window."
      />
      <div className={styles.costLedger}>
        <Card className={styles.costHero}>
          <CardBody>
            <span>Recorded spend</span>
            <strong>{usd(total)}</strong>
            <p>
              {executions.length} executions · {tokens.toLocaleString()} input
              and output tokens
            </p>
          </CardBody>
        </Card>
        <Metric
          label="Average per execution"
          value={usd(executions.length ? total / executions.length : 0)}
        />
        <Metric
          label="Highest execution"
          value={usd(
            Math.max(0, ...executions.map(item => item.usage.costUsd)),
          )}
        />
      </div>
      {executions.length === 0 ? (
        <EmptyState
          title="No usage yet"
          description="No execution cost was recorded in this window."
        />
      ) : (
        <Grid.Root columns={{ initial: '1', lg: '2' }} gap="4">
          <CostBreakdown title="Spend by repository" rows={byRepository} />
          <CostBreakdown title="Spend by agent" rows={byAgent} />
          <CostBreakdown title="Spend by model" rows={byModel} />
        </Grid.Root>
      )}
    </section>
  );
}

export function DataHealthView({ data }: { data: DeckData }) {
  const { sync } = data.sync;
  return (
    <section className={styles.view} aria-labelledby="health-title">
      <SectionLead
        id="health-title"
        kicker="Trust surface"
        title="Data health"
        description="Freshness, source coverage, parser state, and unsupported systems are part of the product—not hidden diagnostics."
      />
      <div className={styles.healthGrid}>
        <Card>
          <CardHeader>
            <div>
              <Text
                as="p"
                variant="body-x-small"
                weight="bold"
                className={styles.kicker}
              >
                Work health
              </Text>
              <Text as="h3" variant="title-small" weight="bold">
                Can people move the work?
              </Text>
            </div>
          </CardHeader>
          <CardBody>
            <div className={styles.healthMetrics}>
              <Metric
                label="Actionable"
                value={data.overview.work.byReadiness.actionable ?? 0}
              />
              <Metric
                label="Blocked"
                value={data.overview.work.byReadiness.blocked ?? 0}
                tone={
                  data.overview.work.byReadiness.blocked ? 'danger' : 'accent'
                }
              />
              <Metric
                label="Waiting"
                value={data.overview.work.byReadiness.waiting ?? 0}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <Text
                as="p"
                variant="body-x-small"
                weight="bold"
                className={styles.kicker}
              >
                Automation reliability
              </Text>
              <Text as="h3" variant="title-small" weight="bold">
                Did agent executions finish?
              </Text>
            </div>
          </CardHeader>
          <CardBody>
            <div className={styles.healthMetrics}>
              <Metric
                label="Succeeded"
                value={data.overview.executions.succeeded}
                tone="success"
              />
              <Metric
                label="Failed"
                value={data.overview.executions.failed}
                tone={data.overview.executions.failed ? 'danger' : 'accent'}
              />
              <Metric
                label="Success rate"
                value={`${data.overview.executions.successRate}%`}
                detail={`${data.overview.window} agent outcomes`}
              />
            </div>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Flex justify="between" align="center" gap="3">
            <div>
              <Text as="h3" variant="title-small" weight="bold">
                Source coverage
              </Text>
              <Text variant="body-small" color="secondary">
                Snapshot {formatDate(sync.snapshotAt)} · parser{' '}
                {sync.parserVersion}
              </Text>
            </div>
            <StatusBadge value={sync.state} />
          </Flex>
        </CardHeader>
        <CardBody>
          {sync.sources.length === 0 ? (
            <EmptyState
              title="No configured sources"
              description="Add a supported GitHub repository or filesystem export to the Fullsend Deck configuration."
            />
          ) : (
            <div className={styles.sourceList}>
              {sync.sources.map(source => (
                <article key={source.source} className={styles.sourceRow}>
                  <div>
                    <Text as="h4" variant="title-x-small" weight="bold">
                      {source.source}
                    </Text>
                    <Text variant="body-small" color="secondary">
                      {source.error ??
                        `Last successful sync ${
                          source.lastSuccessAt
                            ? formatDate(source.lastSuccessAt)
                            : 'never'
                        }`}
                    </Text>
                  </div>
                  <Flex gap="3" align="center" className={styles.sourceMeta}>
                    <StatusBadge value={source.state} />
                    <Text variant="body-x-small" color="secondary">
                      Coverage{' '}
                      {source.coverage === null
                        ? 'unknown'
                        : `${Math.round(source.coverage * 100)}%`}
                    </Text>
                    <Text variant="body-x-small" color="secondary">
                      Rate limit {source.rateLimitRemaining ?? 'unknown'}
                    </Text>
                  </Flex>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      {sync.quarantinedArtifacts > 0 ? (
        <Alert
          status="warning"
          icon
          title={`${sync.quarantinedArtifacts} quarantined artifacts`}
          description="They were excluded because the current parser could not produce a reliable execution record. A parser upgrade will retry them."
        />
      ) : null}
    </section>
  );
}

function SectionLead({
  id,
  kicker,
  title,
  description,
}: {
  id: string;
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.sectionLead}>
      <Text
        as="p"
        variant="body-x-small"
        weight="bold"
        className={styles.kicker}
      >
        {kicker}
      </Text>
      <Text as="h2" id={id} variant="title-medium" weight="bold">
        {title}
      </Text>
      <Text color="secondary">{description}</Text>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'accent',
  detail,
}: {
  label: string;
  value: string | number;
  tone?: 'accent' | 'danger' | 'warning' | 'success' | 'muted';
  detail?: ReactNode;
}) {
  return (
    <Card className={`${styles.metric} ${styles[`metric_${tone}`] ?? ''}`}>
      <CardBody>
        <Text as="span" variant="body-x-small" color="secondary">
          {label}
        </Text>
        <Text as="strong" variant="title-medium" weight="bold">
          {value}
        </Text>
        {detail ? (
          <Text as="small" variant="body-x-small" color="secondary">
            {detail}
          </Text>
        ) : null}
      </CardBody>
    </Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      className={`${styles.status} ${
        styles[`status_${statusTone(value)}`] ?? ''
      }`}
    >
      {humanize(value)}
    </Badge>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className={styles.emptyState}>
      <CardBody>
        <Text as="h3" variant="title-small" weight="bold">
          {title}
        </Text>
        <Text color="secondary">{description}</Text>
      </CardBody>
    </Card>
  );
}

interface ValueRow {
  label: string;
  value: number;
}

function CostBreakdown({ title, rows }: { title: string; rows: ValueRow[] }) {
  return (
    <Grid.Item>
      <Card>
        <CardHeader>
          <Text as="h3" variant="title-small" weight="bold">
            {title}
          </Text>
        </CardHeader>
        <CardBody>
          <BarList rows={rows} format={usd} />
        </CardBody>
      </Card>
    </Grid.Item>
  );
}

function BarList({
  rows,
  format,
}: {
  rows: ValueRow[];
  format: (value: number) => string;
}) {
  const max = Math.max(0, ...rows.map(row => row.value));
  if (rows.length === 0) {
    return <Text color="secondary">No data in this range.</Text>;
  }
  return (
    <ul className={styles.costBars}>
      {rows.map(row => (
        <li key={row.label} className={styles.costRow}>
          <Flex justify="between" gap="3">
            <Text variant="body-small">{row.label}</Text>
            <Text variant="body-small" weight="bold">
              {format(row.value)}
            </Text>
          </Flex>
          <div className={styles.costTrack} aria-hidden="true">
            <div
              className={styles.costFill}
              style={{
                width: `${max > 0 ? Math.max((row.value / max) * 100, 2) : 0}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function aggregateValues<T>(
  items: T[],
  labelFor: (item: T) => string,
  valueFor: (item: T) => number,
): ValueRow[] {
  const rows = new Map<string, number>();
  for (const item of items) {
    const label = labelFor(item);
    rows.set(label, (rows.get(label) ?? 0) + valueFor(item));
  }
  return [...rows.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function queueGroupFor(item: WorkItem): QueueGroupId {
  if (item.lifecycle !== 'open' || item.readiness === 'done') return 'done';
  if (item.readiness === 'blocked') return 'blocked';
  if (item.readiness === 'actionable') return 'do-now';
  if (item.automationState === 'running') return 'fullsend';
  return 'infrastructure';
}

function emptyWorkCopy({
  hasFilters,
  hasSources,
  entityRef,
}: {
  hasFilters: boolean;
  hasSources: boolean;
  entityRef?: string;
}) {
  if (hasFilters) {
    return {
      title: 'No matching work',
      description:
        'Change the filters or wait for the next completed ingestion snapshot.',
    };
  }
  if (entityRef) {
    return {
      title: 'No work in this snapshot',
      description: 'No work items were found for this entity.',
    };
  }
  if (hasSources) {
    return {
      title: 'No work in this snapshot',
      description: 'No work items were found in the current scope.',
    };
  }
  return {
    title: 'No work has been ingested',
    description:
      'Source configuration is required before Deck can build the attention queue.',
  };
}

function statusTone(value: string) {
  if (['failed', 'blocked', 'partial', 'stale'].includes(value))
    return 'danger';
  if (value === 'actionable') return 'accent';
  if (['waiting', 'running', 'pending', 'unknown'].includes(value))
    return 'warning';
  if (
    ['succeeded', 'passed', 'healthy', 'done', 'current', 'canonical'].includes(
      value,
    )
  )
    return 'success';
  return 'muted';
}

function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/^./, letter => letter.toUpperCase());
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}
function usd(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}
function formatDate(value: string | null) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
