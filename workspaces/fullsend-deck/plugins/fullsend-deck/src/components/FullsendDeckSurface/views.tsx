import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardFooter,
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
  Table,
  Text,
  type ColumnConfig,
} from '@backstage/ui';
import type {
  AgentExecution,
  ExecutionWorkItemLink,
  WorkItem,
} from '@red-hat-developer-hub/backstage-plugin-fullsend-deck-common';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeckData } from '../useDeckData';
import styles from './styles.module.css';

export function AttentionView({
  data,
  entityRef,
}: {
  data: DeckData;
  entityRef?: string;
}) {
  const [search, setSearch] = useState('');
  const counts = data.overview.work.byReadiness;
  const items = useMemo(
    () =>
      [...data.work.items]
        .filter(item =>
          `${item.title} ${item.repository ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort((left, right) => right.priority.score - left.priority.score),
    [data.work.items, search],
  );

  return (
    <section className={styles.view} aria-labelledby="attention-title">
      <SectionLead
        id="attention-title"
        kicker="Human queue"
        title="Attention"
        description="Readiness says what can move now. Automation status explains what happened, but never decides the queue by itself."
      />
      <div className={styles.metrics}>
        <Metric
          label="Actionable"
          value={counts.actionable ?? 0}
          tone="danger"
        />
        <Metric label="Waiting" value={counts.waiting ?? 0} tone="warning" />
        <Metric label="Blocked" value={counts.blocked ?? 0} tone="muted" />
        <Metric label="Done" value={counts.done ?? 0} tone="success" />
      </div>
      <div className={styles.queueToolbar}>
        <Text as="h3" variant="title-small" weight="bold">
          Priority queue
        </Text>
        <SearchField
          aria-label="Search work items"
          placeholder="Search title or repository"
          value={search}
          onChange={setSearch}
        />
      </div>
      {items.length === 0 ? (
        <EmptyState
          title={search ? 'No matching work' : 'Nothing needs attention'}
          description={
            entityRef
              ? 'No work in this entity matches the current queue.'
              : 'The current snapshot has no work in this scope.'
          }
        />
      ) : (
        <div className={styles.workList}>
          {items.map(item => (
            <WorkCard key={item.id} item={item} />
          ))}
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
    <Card className={styles.workCard}>
      <CardHeader>
        <Flex justify="between" align="start" gap="3">
          <div>
            <Flex align="center" gap="2" className={styles.wrap}>
              <StatusBadge value={item.readiness} />
              <Text variant="body-x-small" color="secondary">
                {item.repository ?? item.source}
                {item.number ? ` #${item.number}` : ''}
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
          </div>
          <div
            className={styles.priority}
            aria-label={`Priority ${item.priority.score}`}
          >
            <span>{item.priority.score}</span>
            <small>priority</small>
          </div>
        </Flex>
      </CardHeader>
      <CardBody>
        <Text variant="body-medium">{item.priority.summary}</Text>
        <dl className={styles.workFacts}>
          <div>
            <dt>Automation</dt>
            <dd>
              <StatusBadge value={item.automationState} />
            </dd>
          </div>
          <div>
            <dt>Checks</dt>
            <dd>
              <StatusBadge value={item.checksState} />
            </dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>
              <StatusBadge value={item.freshness.state} />
            </dd>
          </div>
        </dl>
      </CardBody>
      <CardFooter>
        <Flex justify="between" align="center" gap="3" className={styles.wrap}>
          <Text variant="body-small" color="secondary">
            {item.nextAction?.label ?? 'Review evidence before taking action'}
          </Text>
          <Flex gap="2">
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
            {item.nextAction ? (
              <ButtonLink
                href={item.nextAction.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open action
              </ButtonLink>
            ) : null}
          </Flex>
        </Flex>
      </CardFooter>
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
        kicker="Reliability"
        title="Executions"
        description="Workflow conclusions and agent exits are shown separately. A green workflow can still contain a failed agent."
      />
      <div className={styles.metrics}>
        <Metric
          label="Agent runs"
          value={data.overview.executions.agentExecutions}
        />
        <Metric
          label="Succeeded"
          value={data.overview.executions.succeeded}
          tone="success"
        />
        <Metric
          label="Failed"
          value={data.overview.executions.failed}
          tone="danger"
        />
        <Metric
          label="Success rate"
          value={`${data.overview.executions.successRate}%`}
        />
      </div>
      <Card>
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
  const costs = aggregateCosts(data.executions.agentExecutions);
  const max = Math.max(...costs.map(item => item.cost), 0);
  const columns: ColumnConfig<CostRow>[] = [
    {
      id: 'agent',
      label: 'Agent / model',
      isRowHeader: true,
      cell: item => (
        <CellText title={item.label} description={`${item.runs} runs`} />
      ),
    },
    {
      id: 'tokens',
      label: 'Tokens',
      cell: item => <CellText title={item.tokens.toLocaleString()} />,
    },
    {
      id: 'cost',
      label: 'Cost',
      cell: item => <CellText title={usd(item.cost)} />,
    },
  ];
  return (
    <section className={styles.view} aria-labelledby="cost-title">
      <SectionLead
        id="cost-title"
        kicker="Usage"
        title="Cost"
        description="Cost is operational evidence, not a readiness signal. Compare it within the same execution window."
      />
      <div className={styles.metrics}>
        <Metric label="Window cost" value={usd(data.overview.cost.totalUsd)} />
        <Metric
          label="Agent runs"
          value={data.overview.executions.agentExecutions}
        />
        <Metric label="Models" value={costs.length} />
      </div>
      {costs.length === 0 ? (
        <EmptyState
          title="No usage yet"
          description="No execution cost was recorded in this window."
        />
      ) : (
        <Grid.Root columns={{ initial: '1', lg: '2' }} gap="4">
          <Grid.Item>
            <Card>
              <CardHeader>
                <Text as="h3" variant="title-small" weight="bold">
                  Relative spend
                </Text>
              </CardHeader>
              <CardBody>
                <div
                  className={styles.costBars}
                  role="img"
                  aria-label={costSummary(costs)}
                >
                  {costs.map(item => (
                    <div key={item.id} className={styles.costRow}>
                      <Flex justify="between" gap="3">
                        <Text variant="body-small">{item.label}</Text>
                        <Text variant="body-small" weight="bold">
                          {usd(item.cost)}
                        </Text>
                      </Flex>
                      <div className={styles.costTrack}>
                        <div
                          className={styles.costFill}
                          style={{
                            width: `${
                              max > 0 ? Math.max((item.cost / max) * 100, 2) : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </Grid.Item>
          <Grid.Item>
            <Card>
              <CardBody className={styles.tableCard}>
                <Table
                  data={costs}
                  columnConfig={columns}
                  pagination={{ type: 'none' }}
                />
              </CardBody>
            </Card>
          </Grid.Item>
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
      <div className={styles.metrics}>
        <Metric
          label="Sync state"
          value={sync.state}
          tone={sync.state === 'healthy' ? 'success' : 'warning'}
        />
        <Metric label="Parser" value={sync.parserVersion} />
        <Metric
          label="Quarantined"
          value={sync.quarantinedArtifacts}
          tone={sync.quarantinedArtifacts ? 'danger' : 'success'}
        />
        <Metric label="Sources" value={sync.sources.length} />
      </div>
      <div className={styles.sourceGrid}>
        {sync.sources.map(source => (
          <Card key={source.source}>
            <CardHeader>
              <Flex justify="between" align="center" gap="2">
                <Text as="h3" variant="title-small" weight="bold">
                  {source.source}
                </Text>
                <StatusBadge value={source.state} />
              </Flex>
            </CardHeader>
            <CardBody>
              <dl className={styles.sourceFacts}>
                <div>
                  <dt>Last success</dt>
                  <dd>
                    {source.lastSuccessAt
                      ? formatDate(source.lastSuccessAt)
                      : 'Never'}
                  </dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>
                    {source.coverage === null
                      ? 'Unknown'
                      : `${Math.round(source.coverage * 100)}%`}
                  </dd>
                </div>
                <div>
                  <dt>Rate limit</dt>
                  <dd>{source.rateLimitRemaining ?? 'Unknown'}</dd>
                </div>
              </dl>
              {source.error ? (
                <Text color="warning" variant="body-small">
                  {source.error}
                </Text>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>
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
}: {
  label: string;
  value: string | number;
  tone?: 'accent' | 'danger' | 'warning' | 'success' | 'muted';
}) {
  return (
    <Card className={`${styles.metric} ${styles[`metric_${tone}`]}`}>
      <CardBody>
        <Text as="span" variant="body-x-small" color="secondary">
          {label}
        </Text>
        <Text as="strong" variant="title-medium" weight="bold">
          {value}
        </Text>
      </CardBody>
    </Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      className={`${styles.status} ${styles[`status_${statusTone(value)}`]}`}
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

interface CostRow {
  id: string;
  label: string;
  runs: number;
  tokens: number;
  cost: number;
}

function aggregateCosts(executions: AgentExecution[]): CostRow[] {
  const rows = new Map<string, CostRow>();
  for (const execution of executions) {
    const id = `${execution.agent}:${execution.model || 'unknown'}`;
    const row = rows.get(id) ?? {
      id,
      label: `${execution.agent} · ${execution.model || 'unknown'}`,
      runs: 0,
      tokens: 0,
      cost: 0,
    };
    row.runs += 1;
    row.tokens += execution.usage.inputTokens + execution.usage.outputTokens;
    row.cost += execution.usage.costUsd;
    rows.set(id, row);
  }
  return [...rows.values()].sort((left, right) => right.cost - left.cost);
}

function costSummary(rows: CostRow[]) {
  return rows.map(row => `${row.label}: ${usd(row.cost)}`).join('; ');
}

function statusTone(value: string) {
  if (['failed', 'actionable', 'stale'].includes(value)) return 'danger';
  if (['waiting', 'running', 'pending', 'partial', 'unknown'].includes(value))
    return 'warning';
  if (['succeeded', 'passed', 'healthy', 'done', 'current'].includes(value))
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
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
