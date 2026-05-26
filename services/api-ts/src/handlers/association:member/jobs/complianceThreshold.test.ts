/**
 * Tests for processComplianceThreshold job handler
 *
 * Thin job that logs when a member reaches CPD compliance threshold.
 * Tests validate payload validation and logging behavior.
 *
 * Uses the actual source import — this module is a pure function with
 * no external dependencies besides the logger from JobContext.
 */

import { describe, test, expect, mock } from 'bun:test';
import type { JobContext } from '@/core/jobs';

// Mock-Classification: APPROPRIATE — background job handler

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeContext(data?: any): JobContext {
  return {
    db: {} as any,
    logger: makeLogger() as any,
    jobId: 'job-compliance-001',
    jobName: 'compliance.threshold_met',
    data,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processComplianceThreshold', () => {
  // Use dynamic import to avoid mock.module pollution from sibling test files
  async function getProcessor() {
    const mod = await import('./complianceThreshold');
    return mod.processComplianceThreshold;
  }

  test('logs info when valid payload is provided', async () => {
    const processComplianceThreshold = await getProcessor();
    const context = makeContext({
      personId: 'person-1',
      organizationId: 'org-1',
      totalCredits: 65,
      requiredCredits: 60,
    });

    await processComplianceThreshold(context);

    const logger = context.logger as any;
    expect(logger.info).toHaveBeenCalledTimes(1);
    const [infoPayload] = logger.info.mock.calls[0];
    expect(infoPayload).toMatchObject({
      personId: 'person-1',
      totalCredits: 65,
      requiredCredits: 60,
    });
  });

  test('logs error and returns early when personId is missing', async () => {
    const processComplianceThreshold = await getProcessor();
    const context = makeContext({
      organizationId: 'org-1',
      totalCredits: 65,
      requiredCredits: 60,
    });

    await processComplianceThreshold(context);

    const logger = context.logger as any;
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('logs error and returns early when organizationId is missing', async () => {
    const processComplianceThreshold = await getProcessor();
    const context = makeContext({
      personId: 'person-1',
      totalCredits: 65,
      requiredCredits: 60,
    });

    await processComplianceThreshold(context);

    const logger = context.logger as any;
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('logs error when both personId and organizationId are missing', async () => {
    const processComplianceThreshold = await getProcessor();
    const context = makeContext({
      totalCredits: 65,
      requiredCredits: 60,
    });

    await processComplianceThreshold(context);

    const logger = context.logger as any;
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('throws when data is undefined (no null guard in source)', async () => {
    const processComplianceThreshold = await getProcessor();
    const context = makeContext(undefined);

    // Source casts undefined to object, property access throws TypeError
    await expect(processComplianceThreshold(context)).rejects.toThrow();
  });

  test('handles empty object data (falsy personId)', async () => {
    const processComplianceThreshold = await getProcessor();
    const context = makeContext({});

    await processComplianceThreshold(context);

    const logger = context.logger as any;
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('does not throw on valid input', async () => {
    const processComplianceThreshold = await getProcessor();
    const context = makeContext({
      personId: 'p-1',
      organizationId: 'o-1',
      totalCredits: 100,
      requiredCredits: 60,
    });

    await expect(processComplianceThreshold(context)).resolves.toBeUndefined();
  });
});
