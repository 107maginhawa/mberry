import { describe, test, expect, mock } from 'bun:test';
import { processDirectoryAutoPopulate } from './directoryAutoPopulate';
import type { JobContext } from '@/core/jobs';

function createMockLogger() {
  return {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  };
}

function buildMockDb(selectResponses: any[][], insertSpy?: (values: any) => void) {
  let selectIdx = 0;
  return {
    select: (..._args: any[]) => ({
      from: (_table: any) => {
        const idx = selectIdx++;
        const result = idx < selectResponses.length ? selectResponses[idx] : [];
        return {
          where: (_cond: any) => ({
            limit: (_n: number) => Promise.resolve(result),
          }),
          limit: (_n: number) => Promise.resolve(result),
        };
      },
    }),
    insert: (_table: any) => ({
      values: (vals: any) => {
        insertSpy?.(vals);
        return Promise.resolve();
      },
    }),
  };
}

function makeContext(data: any, db: any, logger?: any): JobContext {
  return {
    db,
    logger: logger ?? createMockLogger(),
    jobId: 'test-job-1',
    jobName: 'directory.autoPopulate',
    data,
  };
}

describe('processDirectoryAutoPopulate', () => {
  test('creates hidden profile from person data', async () => {
    const insertSpy = mock((_v: any) => {});
    const db = buildMockDb(
      [
        [],
        [{ firstName: 'Maria', lastName: 'Santos', contactInfo: { email: 'maria@example.com' }, specialization: 'Orthodontics', primaryAddress: { city: 'Manila', state: 'NCR', country: 'PH' } }],
      ],
      insertSpy,
    );

    await processDirectoryAutoPopulate(makeContext({ personId: 'p1', organizationId: 'org1' }, db));

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0][0];
    expect(inserted.displayName).toBe('Maria Santos');
    expect(inserted.specialty).toBe('Orthodontics');
    expect(inserted.contactEmail).toBe('maria@example.com');
    expect(inserted.location).toBe('Manila, NCR, PH');
    expect(inserted.visibility).toBe('hidden');
  });

  test('idempotent — no-op if profile already exists', async () => {
    const insertSpy = mock((_v: any) => {});
    const db = buildMockDb([[{ id: 'existing-profile' }]], insertSpy);
    await processDirectoryAutoPopulate(makeContext({ personId: 'p1', organizationId: 'org1' }, db));
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test('handles missing person gracefully', async () => {
    const insertSpy = mock((_v: any) => {});
    const logger = createMockLogger();
    const db = buildMockDb([[], []], insertSpy);
    await processDirectoryAutoPopulate(makeContext({ personId: 'p-missing', organizationId: 'org1' }, db, logger));
    expect(insertSpy).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('handles missing person fields gracefully', async () => {
    const insertSpy = mock((_v: any) => {});
    const db = buildMockDb([[], [{ firstName: 'Juan', lastName: null, contactInfo: null, specialization: null, primaryAddress: null }]], insertSpy);
    await processDirectoryAutoPopulate(makeContext({ personId: 'p2', organizationId: 'org1' }, db));
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0][0];
    expect(inserted.displayName).toBe('Juan');
    expect(inserted.specialty).toBeNull();
    expect(inserted.contactEmail).toBeNull();
    expect(inserted.location).toBeNull();
  });

  test('skips if personId or organizationId missing', async () => {
    const insertSpy = mock((_v: any) => {});
    const logger = createMockLogger();
    const db = buildMockDb([], insertSpy);
    await processDirectoryAutoPopulate(makeContext({ personId: null, organizationId: 'org1' }, db, logger));
    expect(insertSpy).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
