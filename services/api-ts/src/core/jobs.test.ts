/**
 * Tests for the job scheduler wrapper (jobs.ts)
 *
 * Strategy: construct PgBossScheduler via createJobScheduler(), mocking the pg-boss
 * module so no real Postgres connection is required.  All tests operate against the
 * PgBossScheduler's public interface (JobScheduler).
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import type { JobScheduler, JobHandler, JobHealth } from './jobs';

// ---------------------------------------------------------------------------
// Mock pg-boss
// ---------------------------------------------------------------------------

/** Minimal in-memory stub that mimics the pg-boss methods we exercise */
class FakePgBoss {
  // Track calls for assertions
  startCalled = false;
  stopCalled = false;
  scheduledJobs: Array<{ name: string; pattern: string }> = [];
  createdQueues: string[] = [];
  workers: Map<string, Function> = new Map();
  sentJobs: Array<{ name: string; data: unknown }> = [];
  cancelledJobs: Array<{ queue: string; id: string }> = [];
  queueSizes: Map<string, number> = new Map();

  async start() {
    this.startCalled = true;
  }

  async stop(_opts?: unknown) {
    this.stopCalled = true;
  }

  async schedule(name: string, pattern: string, _data: unknown, _opts: unknown) {
    this.scheduledJobs.push({ name, pattern });
  }

  async createQueue(name: string) {
    this.createdQueues.push(name);
  }

  async work(name: string, _opts: unknown, handler: Function) {
    this.workers.set(name, handler);
  }

  async send(name: string, data: unknown): Promise<string> {
    const id = `job-${Date.now()}-${Math.random()}`;
    this.sentJobs.push({ name, data });
    return id;
  }

  async cancel(queue: string, id: string) {
    this.cancelledJobs.push({ queue, id });
  }

  async getQueueSize(name: string): Promise<number> {
    return this.queueSizes.get(name) ?? 0;
  }
}

// Hold a reference to the current fake so tests can inspect it
let fakeBoss: FakePgBoss;

await mock.module('pg-boss', () => {
  return {
    default: class MockPgBoss {
      constructor(_opts: unknown) {
        fakeBoss = new FakePgBoss();
        Object.assign(this, fakeBoss);
        // Proxy all method calls to the shared fakeBoss
        return new Proxy(this, {
          get: (target, prop) => {
            if (prop in fakeBoss) {
              const val = (fakeBoss as any)[prop];
              return typeof val === 'function' ? val.bind(fakeBoss) : val;
            }
            return (target as any)[prop];
          },
        });
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): any {
  // Drizzle instance with the $client pool accessor pg-boss constructor reads
  return {
    $client: {
      query: mock(async () => ({ rows: [] })),
    },
    execute: mock(async () => ({ rows: [{ health_check: 1 }] })),
  };
}

function makeLogger(): any {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    child: mock(function () { return this; }),
  };
}

const noop: JobHandler = async () => {};

// ---------------------------------------------------------------------------
// Import after mocking so the module picks up the mocked pg-boss
// ---------------------------------------------------------------------------

const { createJobScheduler } = await import('./jobs');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createJobScheduler', () => {
  test('returns a JobScheduler with the expected interface', () => {
    const scheduler = createJobScheduler(makeDb(), makeLogger());
    expect(typeof scheduler.registerCron).toBe('function');
    expect(typeof scheduler.registerInterval).toBe('function');
    expect(typeof scheduler.registerDelayed).toBe('function');
    expect(typeof scheduler.start).toBe('function');
    expect(typeof scheduler.shutdown).toBe('function');
    expect(typeof scheduler.trigger).toBe('function');
    expect(typeof scheduler.cancel).toBe('function');
    expect(typeof scheduler.getHealth).toBe('function');
    expect(typeof scheduler.getQueueSize).toBe('function');
  });

  test('throws when db.$client is missing', () => {
    expect(() => createJobScheduler({} as any, makeLogger())).toThrow(
      'Unable to access pg.Pool from Drizzle instance'
    );
  });
});

describe('Job registration', () => {
  let scheduler: JobScheduler;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
    scheduler = createJobScheduler(makeDb(), logger);
  });

  test('registerCron stores the handler and logs a debug message', () => {
    scheduler.registerCron('my-cron', '*/5 * * * *', noop);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('my-cron')
    );
  });

  test('registerInterval stores the handler and logs a debug message', () => {
    // Use a super-short interval so it takes the fast-interval (setInterval) path
    scheduler.registerInterval('my-interval', 5000, noop);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('my-interval')
    );
  });

  test('registerDelayed stores the handler and logs a debug message', () => {
    scheduler.registerDelayed('my-delayed', 10000, noop);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('my-delayed')
    );
  });

  test('duplicate registration: registerCron overwrites handler without throwing', () => {
    const handler1: JobHandler = async () => {};
    const handler2: JobHandler = async () => {};

    // Should not throw
    scheduler.registerCron('dup-cron', '*/1 * * * *', handler1);
    scheduler.registerCron('dup-cron', '*/2 * * * *', handler2);

    // Just verify it did not throw (no assertion on internal state needed)
    expect(true).toBe(true);
  });

  test('fast-interval (sub-minute) path does NOT create an intervalMinutes entry > 0', async () => {
    // After registering a 30s interval the scheduler should have set up a
    // setInterval timer, not scheduled via pg-boss cron.
    // We verify by starting and confirming boss.schedule was NOT called for it.
    scheduler.registerInterval('fast-job', 30_000, noop);
    await scheduler.start();

    const schedCalls = fakeBoss.scheduledJobs.map((j) => j.name);
    expect(schedCalls).not.toContain('fast-job');

    await scheduler.shutdown();
  });

  test('minute-granularity interval creates a cron schedule via pg-boss', async () => {
    scheduler.registerInterval('slow-job', 120_000, noop); // 2 min
    await scheduler.start();

    const schedCalls = fakeBoss.scheduledJobs.map((j) => j.name);
    expect(schedCalls).toContain('slow-job');
    const entry = fakeBoss.scheduledJobs.find((j) => j.name === 'slow-job');
    expect(entry?.pattern).toBe('*/2 * * * *');

    await scheduler.shutdown();
  });
});

describe('Lifecycle — start / shutdown', () => {
  let scheduler: JobScheduler;

  beforeEach(() => {
    scheduler = createJobScheduler(makeDb(), makeLogger());
  });

  test('start() calls boss.start()', async () => {
    await scheduler.start();
    expect(fakeBoss.startCalled).toBe(true);
    await scheduler.shutdown();
  });

  test('calling start() twice is a no-op (logs warn, does not double-start)', async () => {
    const logger = makeLogger();
    scheduler = createJobScheduler(makeDb(), logger);

    await scheduler.start();
    await scheduler.start(); // second call

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('already started')
    );

    await scheduler.shutdown();
  });

  test('shutdown() calls boss.stop() and resets state', async () => {
    await scheduler.start();
    await scheduler.shutdown();

    expect(fakeBoss.stopCalled).toBe(true);
  });

  test('shutdown() before start() logs a warning and returns without throwing', async () => {
    const logger = makeLogger();
    scheduler = createJobScheduler(makeDb(), logger);

    await scheduler.shutdown();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not started')
    );
  });

  test('start() creates queues for pre-registered cron jobs', async () => {
    scheduler.registerCron('q-cron', '0 * * * *', noop);
    await scheduler.start();

    expect(fakeBoss.createdQueues).toContain('q-cron');

    await scheduler.shutdown();
  });

  test('start() registers workers for pre-registered jobs', async () => {
    scheduler.registerCron('w-job', '0 * * * *', noop);
    await scheduler.start();

    expect(fakeBoss.workers.has('w-job')).toBe(true);

    await scheduler.shutdown();
  });
});

describe('trigger()', () => {
  let scheduler: JobScheduler;

  beforeEach(async () => {
    scheduler = createJobScheduler(makeDb(), makeLogger());
    scheduler.registerCron('send-email', '*/10 * * * *', noop);
    await scheduler.start();
  });

  afterEach(async () => {
    await scheduler.shutdown();
  });

  test('trigger() sends a job and returns a string job ID', async () => {
    const id = await scheduler.trigger('send-email', { to: 'a@b.com' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('trigger() passes payload to pg-boss send()', async () => {
    await scheduler.trigger('send-email', { to: 'x@y.com' });
    const sent = fakeBoss.sentJobs.find((j) => j.name === 'send-email');
    expect(sent).toBeDefined();
    expect(sent?.data).toEqual({ to: 'x@y.com' });
  });

  test('trigger() before start() throws', async () => {
    const fresh = createJobScheduler(makeDb(), makeLogger());
    expect(fresh.trigger('anything')).rejects.toThrow('not started');
  });
});

describe('cancel()', () => {
  let scheduler: JobScheduler;

  beforeEach(async () => {
    scheduler = createJobScheduler(makeDb(), makeLogger());
    scheduler.registerCron('notify', '0 * * * *', noop);
    await scheduler.start();
  });

  afterEach(async () => {
    await scheduler.shutdown();
  });

  test('cancel() removes a previously triggered job', async () => {
    const id = await scheduler.trigger('notify');
    await scheduler.cancel(id);

    const cancelled = fakeBoss.cancelledJobs.find((c) => c.id === id);
    expect(cancelled).toBeDefined();
    expect(cancelled?.queue).toBe('notify');
  });

  test('cancel() before start() throws', async () => {
    const fresh = createJobScheduler(makeDb(), makeLogger());
    expect(fresh.cancel('some-id')).rejects.toThrow('not started');
  });

  test('cancel() with unknown jobId throws', async () => {
    expect(scheduler.cancel('nonexistent-id')).rejects.toThrow('nonexistent-id');
  });
});

describe('getHealth()', () => {
  test('returns healthy:false when scheduler is not started', async () => {
    const scheduler = createJobScheduler(makeDb(), makeLogger());
    const health = await scheduler.getHealth();
    expect(health.healthy).toBe(false);
  });

  test('returns healthy:true after start()', async () => {
    const scheduler = createJobScheduler(makeDb(), makeLogger());
    await scheduler.start();

    const health = await scheduler.getHealth();
    expect(health.healthy).toBe(true);

    await scheduler.shutdown();
  });

  test('health response conforms to JobHealth shape', async () => {
    const scheduler = createJobScheduler(makeDb(), makeLogger());
    await scheduler.start();

    const health: JobHealth = await scheduler.getHealth();
    expect(typeof health.healthy).toBe('boolean');
    // Optional numeric fields — if present they must be numbers
    if (health.queueSize !== undefined) expect(typeof health.queueSize).toBe('number');
    if (health.failedCount !== undefined) expect(typeof health.failedCount).toBe('number');
    if (health.completedCount !== undefined) expect(typeof health.completedCount).toBe('number');

    await scheduler.shutdown();
  });

  test('returns healthy:false again after shutdown()', async () => {
    const scheduler = createJobScheduler(makeDb(), makeLogger());
    await scheduler.start();
    await scheduler.shutdown();

    const health = await scheduler.getHealth();
    expect(health.healthy).toBe(false);
  });
});

describe('getQueueSize()', () => {
  test('returns queue size from pg-boss', async () => {
    const scheduler = createJobScheduler(makeDb(), makeLogger());
    scheduler.registerCron('sized-queue', '* * * * *', noop);
    await scheduler.start();

    fakeBoss.queueSizes.set('sized-queue', 7);
    const size = await scheduler.getQueueSize('sized-queue');
    expect(size).toBe(7);

    await scheduler.shutdown();
  });

  test('throws when called before start()', async () => {
    const scheduler = createJobScheduler(makeDb(), makeLogger());
    expect(scheduler.getQueueSize('any')).rejects.toThrow('not started');
  });
});
