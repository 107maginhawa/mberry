import { describe, test, expect, mock } from 'bun:test';
import { processDuesReminders } from './reminderProcessor';

describe('processDuesReminders', () => {
  test('returns zero counts when no configs exist', async () => {
    const mockDb = {
      select: () => ({
        from: () => Promise.resolve([]),
      }),
    };
    const mockLogger = { info: mock(() => {}), error: mock(() => {}) };

    const result = await processDuesReminders({ db: mockDb as any, logger: mockLogger });

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('processes enabled schedules for each config', async () => {
    const mockConfigs = [
      { id: 'config-1', organizationId: 'org-1' },
    ];
    const mockSchedules = [
      { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: true, channelEmail: true },
      { id: 'sched-2', duesConfigId: 'config-1', daysOffset: -7, enabled: true, channelInapp: true, channelPush: false, channelEmail: true },
    ];

    let callCount = 0;
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          // First call returns configs, subsequent calls return schedules
          if (callCount === 0) {
            callCount++;
            return Promise.resolve(mockConfigs);
          }
          // For schedule queries, need to handle .where()
          return {
            where: () => Promise.resolve(mockSchedules),
          };
        },
      }),
    };
    const mockLogger = { info: mock(() => {}), error: mock(() => {}) };

    const result = await processDuesReminders({ db: mockDb as any, logger: mockLogger });

    expect(result.processed).toBe(2);
    expect(result.sent).toBe(2);
    expect(result.errors).toBe(0);
  });

  test('counts errors without stopping processing', async () => {
    const mockConfigs = [{ id: 'config-1', organizationId: 'org-1' }];

    let callCount = 0;
    const mockDb = {
      select: () => ({
        from: (_table: any) => {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve(mockConfigs);
          }
          return {
            where: () => Promise.resolve([
              { id: 'sched-1', duesConfigId: 'config-1', daysOffset: -30, enabled: true, channelInapp: true, channelPush: true, channelEmail: true },
            ]),
          };
        },
      }),
    };

    // Logger.info throws to simulate processing error
    const mockLogger = {
      info: mock(() => { throw new Error('simulated error'); }),
      error: mock(() => {}),
    };

    const result = await processDuesReminders({ db: mockDb as any, logger: mockLogger });

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(0);
  });
});
