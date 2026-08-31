const assert = require('node:assert/strict');
const { access } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const workspaceRoot = resolve(__dirname, '..');
  const standaloneRoot = resolve(
    process.env.FULLSEND_DECK_STANDALONE_ROOT ??
      resolve(workspaceRoot, '../../../fullsend-deck'),
  );
  const standaloneFixturePath = resolve(
    standaloneRoot,
    'packages/shared/src/fixtures.ts',
  );
  const rhdhContractsPath = resolve(
    workspaceRoot,
    'plugins/fullsend-deck-common/src/contracts.ts',
  );

  await access(standaloneFixturePath).catch(() => {
    throw new Error(
      `Standalone fixtures were not found at ${standaloneFixturePath}. Set FULLSEND_DECK_STANDALONE_ROOT to the standalone checkout.`,
    );
  });

  const standalone = await import(pathToFileURL(standaloneFixturePath));
  const contracts = await import(pathToFileURL(rhdhContractsPath));

  const expected = {
    workItem: { ...standalone.canonicalWorkItemFixture, entityRef: null },
    workflowRun: standalone.canonicalWorkflowFixture,
    agentExecution: standalone.canonicalExecutionFixture,
    link: standalone.canonicalLinkFixture,
  };
  const actual = {
    workItem: contracts.workItemSchema.parse(expected.workItem),
    workflowRun: contracts.workflowRunSchema.parse(expected.workflowRun),
    agentExecution: contracts.agentExecutionSchema.parse(
      expected.agentExecution,
    ),
    link: contracts.executionWorkItemLinkSchema.parse(expected.link),
  };

  assert.deepEqual(actual, expected);
  assert.equal(actual.agentExecution.telemetrySource, 'run-telemetry.jsonl');
  assert.equal(actual.link.method, 'canonical');
  assert.equal(actual.link.confidence, 1);
  assert.equal(actual.link.evidence[0]?.label, 'fullsend.work_item_id');

  console.log(
    JSON.stringify({
      result: 'pass',
      standaloneRoot,
      contracts: ['WorkItem', 'WorkflowRun', 'AgentExecution', 'link'],
      canonicalTelemetry: actual.agentExecution.telemetrySource,
      canonicalIdentity: actual.link.evidence[0]?.label,
    }),
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
