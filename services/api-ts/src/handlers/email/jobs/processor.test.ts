/**
 * Tests for emailProcessorJob
 *
 * The job is a thin adapter: it calls emailService.processPendingEmails()
 * and re-throws on failure.  We test:
 * - Normal execution delegates to the email service
 * - Errors are logged and re-thrown (letting the job scheduler handle retry)
 * - Logger is called with the jobId in the debug messages
 */

import { describe, test, expect, mock } from 'bun:test';
import { emailProcessorJob } from './processor';
import type { JobContext } from '@/core/jobs';
import type { EmailService } from '@/core/email';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
  };
}

function makeContext(overrides: Partial<JobContext> = {}): JobContext {
  const logger = makeLogger();
  return {
    db: {} as any,
    logger: logger as any,
    jobId: 'job-abc-123',
    jobName: 'email.processor',
    data: undefined,
    ...overrides,
  };
}

function makeEmailService(overrides: Partial<EmailService> = {}): EmailService {
  return {
    processPendingEmails: mock(async () => {}),
    initializeDefaultTemplates: mock(async () => {}),
    queueEmail: mock(async () => ({} as any)),
    sendEmail: mock(async () => ({ success: true, provider: 'smtp' as const })),
    previewTemplate: mock(async () => ({} as any)),
    renderTemplate: mock(async () => ({} as any)),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emailProcessorJob', () => {
  test('calls processPendingEmails once', async () => {
    const emailService = makeEmailService();
    const context = makeContext();

    await emailProcessorJob(context, emailService);

    expect(emailService.processPendingEmails).toHaveBeenCalledTimes(1);
  });

  test('logs debug at start and end of job', async () => {
    const emailService = makeEmailService();
    const context = makeContext();

    await emailProcessorJob(context, emailService);

    const logger = context.logger as any;
    expect(logger.debug).toHaveBeenCalledTimes(2);

    const calls = (logger.debug as ReturnType<typeof mock>).mock.calls;
    // Both calls include jobId
    expect(calls[0][0]).toMatchObject({ jobId: 'job-abc-123' });
    expect(calls[1][0]).toMatchObject({ jobId: 'job-abc-123' });
  });

  test('re-throws when processPendingEmails fails', async () => {
    const emailService = makeEmailService({
      processPendingEmails: mock(async () => {
        throw new Error('SMTP connection refused');
      }),
    });
    const context = makeContext();

    await expect(emailProcessorJob(context, emailService)).rejects.toThrow('SMTP connection refused');
  });

  test('logs error before re-throwing', async () => {
    const boom = new Error('provider failure');
    const emailService = makeEmailService({
      processPendingEmails: mock(async () => { throw boom; }),
    });
    const context = makeContext();

    await expect(emailProcessorJob(context, emailService)).rejects.toThrow();

    const logger = context.logger as any;
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [errorPayload] = (logger.error as ReturnType<typeof mock>).mock.calls[0];
    expect(errorPayload).toMatchObject({ jobId: 'job-abc-123', error: boom });
  });

  test('does not call logger.error on success', async () => {
    const emailService = makeEmailService();
    const context = makeContext();

    await emailProcessorJob(context, emailService);

    const logger = context.logger as any;
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('uses the jobId from context in log calls', async () => {
    const emailService = makeEmailService();
    const context = makeContext({ jobId: 'custom-job-id-999' });

    await emailProcessorJob(context, emailService);

    const logger = context.logger as any;
    const debugCalls = (logger.debug as ReturnType<typeof mock>).mock.calls;
    expect(debugCalls[0][0]).toMatchObject({ jobId: 'custom-job-id-999' });
  });

  // Provider selection test removed — responsibility of EmailService
  // implementation, not the processor job. Test at service layer.
});
