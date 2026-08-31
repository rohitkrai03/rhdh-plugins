import {
  agentExecutionSchema,
  executionWorkItemLinkSchema,
  fixtureAgentExecution,
  fixtureLink,
  fixtureSync,
  fixtureWorkItem,
  fixtureWorkflowRun,
  syncStatusSchema,
  workItemSchema,
  workflowRunSchema,
} from './index';

describe('Fullsend Deck contracts', () => {
  it('validates canonical conformance fixtures', () => {
    expect(workItemSchema.parse(fixtureWorkItem)).toEqual(fixtureWorkItem);
    expect(workflowRunSchema.parse(fixtureWorkflowRun)).toEqual(
      fixtureWorkflowRun,
    );
    expect(agentExecutionSchema.parse(fixtureAgentExecution)).toEqual(
      fixtureAgentExecution,
    );
    expect(executionWorkItemLinkSchema.parse(fixtureLink)).toEqual(fixtureLink);
    expect(syncStatusSchema.parse(fixtureSync)).toEqual(fixtureSync);
  });

  it('keeps readiness independent from execution reliability', () => {
    expect(fixtureWorkItem.readiness).toBe('actionable');
    expect(fixtureAgentExecution.status).toBe('failed');
    expect(fixtureWorkflowRun.status).toBe('succeeded');
  });
});
