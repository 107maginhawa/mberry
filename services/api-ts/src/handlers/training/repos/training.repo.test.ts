/**
 * Tests for TrainingRepository
 *
 * All database calls are intercepted by a hand-crafted db stub so no real
 * Postgres connection is needed.
 */

import { describe, test, expect } from 'bun:test';
import { TrainingRepository } from './training.repo';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTraining(overrides: Record<string, any> = {}) {
  return {
    id: 'training-1',
    organizationId: 'org-1',
    organizationId: 'org-1',
    title: 'CPD Seminar',
    description: 'Dental CPD seminar',
    instructorName: 'Dr. Santos',
    instructorId: 'person-inst-1',
    location: 'Manila Hotel',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-06-02'),
    capacity: 50,
    registrationFee: 5000,
    currency: 'PHP',
    creditBearing: true,
    creditAmount: 8,
    status: 'published',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    version: 1,
    ...overrides,
  };
}

function makeEnrollment(overrides: Record<string, any> = {}) {
  return {
    id: 'enroll-1',
    organizationId: 'org-1',
    trainingId: 'training-1',
    personId: 'person-1',
    status: 'enrolled',
    enrolledAt: new Date(),
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'person-1',
    updatedBy: 'person-1',
    version: 1,
    ...overrides,
  };
}

/**
 * Build a minimal db stub whose chainable select/update/insert methods
 * resolve to whatever rows are provided.
 */
function makeDb({
  selectRows = [] as any[],
  selectRowsSets = undefined as any[][] | undefined,
  insertRow = {} as any,
  updateRow = {} as any,
}: {
  selectRows?: any[];
  selectRowsSets?: any[][];
  insertRow?: any;
  updateRow?: any;
} = {}) {
  let selectCallCount = 0;

  const awaitable = (result: any) => ({
    from: () => awaitable(result),
    leftJoin: () => awaitable(result),
    innerJoin: () => awaitable(result),
    where: () => awaitable(result),
    limit: (_n: number) => awaitable(result),
    returning: () => Promise.resolve(result),
    orderBy: () => awaitable(result),
    offset: (_n: number) => awaitable(result),
    groupBy: () => awaitable(result),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (_fields?: any) => {
      const rows = selectRowsSets
        ? selectRowsSets[selectCallCount++] ?? selectRows
        : selectRows;
      return awaitable(rows);
    },
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () =>
          Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        onConflictDoUpdate: (_opts: any) => ({
          returning: () =>
            Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        }),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([updateRow]),
        }),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    delete: (_table: any) => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
  };
}

// ---------------------------------------------------------------------------
// TrainingRepository.list
// ---------------------------------------------------------------------------

describe('TrainingRepository.list', () => {
  test('returns trainings and total count for an org', async () => {
    const training = makeTraining();
    const countRow = { count: 1 };
    const db = makeDb({ selectRowsSets: [[training], [countRow]] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.list('org-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('training-1');
    expect(result.total).toBe(1);
  });

  test('returns empty data when no trainings exist', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.list('org-1');
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('supports status filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.list('org-1', { status: 'published' });
    expect(result.data).toEqual([]);
  });

  test('supports search filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.list('org-1', { search: 'CPD' });
    expect(result.data).toEqual([]);
  });

  test('supports pagination via limit and offset', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.list('org-1', { limit: 10, offset: 20 });
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.get
// ---------------------------------------------------------------------------

describe('TrainingRepository.get', () => {
  test('returns training when found', async () => {
    const training = makeTraining();
    const db = makeDb({ selectRows: [training] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.get('training-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('training-1');
    expect(result!.title).toBe('CPD Seminar');
  });

  test('returns undefined when training not found', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.get('missing-id');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.create
// ---------------------------------------------------------------------------

describe('TrainingRepository.create', () => {
  test('inserts and returns training record', async () => {
    const training = makeTraining();
    const db = makeDb({ insertRow: training });
    const repo = new TrainingRepository(db as any);

    const result = await repo.create({
      organizationId: 'org-1',
      organizationId: 'org-1',
      title: 'CPD Seminar',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-02'),
      status: 'draft',
      createdBy: 'user-1',
      updatedBy: 'user-1',
    } as any);

    expect(result.id).toBe('training-1');
    expect(result.title).toBe('CPD Seminar');
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.update
// ---------------------------------------------------------------------------

describe('TrainingRepository.update', () => {
  test('updates and returns training', async () => {
    const updated = makeTraining({ title: 'Updated Seminar' });
    const db = makeDb({ updateRow: updated });
    const repo = new TrainingRepository(db as any);

    const result = await repo.update('training-1', { title: 'Updated Seminar' } as any);
    expect(result.title).toBe('Updated Seminar');
  });

  test('sets updatedAt on update', async () => {
    let capturedData: any;
    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => {
          capturedData = data;
          return {
            where: () => ({
              returning: () => Promise.resolve([makeTraining()]),
            }),
          };
        },
      }),
    };

    const repo = new TrainingRepository(db);
    await repo.update('training-1', { title: 'Test' } as any);
    expect(capturedData.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.update (cancel via status)
// ---------------------------------------------------------------------------

describe('TrainingRepository cancel (via update)', () => {
  test('sets status to cancelled', async () => {
    const cancelled = makeTraining({ status: 'cancelled' });
    const db = makeDb({ updateRow: cancelled });
    const repo = new TrainingRepository(db as any);

    const result = await repo.update('training-1', { status: 'cancelled' } as any);
    expect(result.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.enroll
// ---------------------------------------------------------------------------

describe('TrainingRepository.enroll', () => {
  test('inserts and returns enrollment', async () => {
    const enrollment = makeEnrollment();
    const db = makeDb({ insertRow: enrollment });
    const repo = new TrainingRepository(db as any);

    const result = await repo.enroll({
      organizationId: 'org-1',
      trainingId: 'training-1',
      personId: 'person-1',
      status: 'enrolled',
      createdBy: 'person-1',
      updatedBy: 'person-1',
    } as any);

    expect(result.id).toBe('enroll-1');
    expect(result.status).toBe('enrolled');
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.getEnrollmentCount
// ---------------------------------------------------------------------------

describe('TrainingRepository.getEnrollmentCount', () => {
  test('returns count of enrolled participants', async () => {
    const db = makeDb({ selectRows: [{ count: 15 }] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.getEnrollmentCount('training-1');
    expect(result).toBe(15);
  });

  test('returns 0 when no enrollments', async () => {
    const db = makeDb({ selectRows: [{ count: 0 }] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.getEnrollmentCount('training-1');
    expect(result).toBe(0);
  });

  test('returns 0 when no result row', async () => {
    const db = makeDb({ selectRows: [undefined] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.getEnrollmentCount('training-1');
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.listEnrollments
// ---------------------------------------------------------------------------

describe('TrainingRepository.listEnrollments', () => {
  test('returns enrollments for a training', async () => {
    const enrollment = makeEnrollment();
    const db = makeDb({ selectRows: [enrollment] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.listEnrollments('training-1');
    expect(result).toHaveLength(1);
    expect(result[0].personId).toBe('person-1');
  });

  test('returns empty array when no enrollments', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.listEnrollments('training-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.updateEnrollmentStatus (markComplete)
// ---------------------------------------------------------------------------

describe('TrainingRepository.updateEnrollmentStatus', () => {
  test('updates enrollment status and returns it', async () => {
    const completed = makeEnrollment({ status: 'completed' });
    const db = makeDb({ updateRow: completed });
    const repo = new TrainingRepository(db as any);

    const result = await repo.updateEnrollmentStatus('enroll-1', 'completed');
    expect(result.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.listByPerson (listMyTrainings)
// ---------------------------------------------------------------------------

describe('TrainingRepository.listByPerson', () => {
  test('returns enrollments with training data for a person', async () => {
    const row = { enrollment: makeEnrollment(), training: makeTraining() };
    const db = makeDb({ selectRows: [row] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.listByPerson('person-1');
    expect(result).toHaveLength(1);
    expect(result[0].enrollment.personId).toBe('person-1');
    expect(result[0].training.title).toBe('CPD Seminar');
  });

  test('returns empty array when person has no enrollments', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.listByPerson('person-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.getAttendanceStats
// ---------------------------------------------------------------------------

describe('TrainingRepository.getAttendanceStats', () => {
  test('returns completed and total counts', async () => {
    const db = makeDb({ selectRows: [{ completed: 5, total: 10 }] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.getAttendanceStats('training-1');
    expect(result.completed).toBe(5);
    expect(result.total).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// TrainingRepository.getStats
// ---------------------------------------------------------------------------

describe('TrainingRepository.getStats', () => {
  test('returns quarterly stats', async () => {
    const db = makeDb({ selectRows: [{ totalThisQuarter: 3, totalEnrollments: 0 }] });
    const repo = new TrainingRepository(db as any);

    const result = await repo.getStats('org-1');
    expect(result.totalThisQuarter).toBe(3);
    expect(result.totalEnrollments).toBe(0);
  });
});
