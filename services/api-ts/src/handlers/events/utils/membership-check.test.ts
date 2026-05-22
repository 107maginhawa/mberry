// V-18: Tests for membership check utility (events module seam)
import { describe, test, expect, afterEach } from 'bun:test';
import { stubRepo } from '@/test-utils/make-ctx';
import { MembershipRepository } from '../../association:member/repos/membership.repo';
import { checkActiveMembership } from './membership-check';

// Factory N/A: empty DB stub for dependency injection
// Fake db placeholder — stubRepo patches the prototype so db is unused
const fakeDb = {} as any;

describe('checkActiveMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns true for active membership', async () => {
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'active' }),
    });

    const result = await checkActiveMembership(fakeDb, 'person-1', 'org-1');
    expect(result).toBe(true);
  });

  test('returns false for grace-period membership', async () => {
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'gracePeriod' }),
    });

    const result = await checkActiveMembership(fakeDb, 'person-1', 'org-1');
    expect(result).toBe(false);
  });

  test('returns false for lapsed membership', async () => {
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'lapsed' }),
    });

    const result = await checkActiveMembership(fakeDb, 'person-1', 'org-1');
    expect(result).toBe(false);
  });

  test('returns false when no membership exists (null)', async () => {
    mocks = stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => null,
    });

    const result = await checkActiveMembership(fakeDb, 'person-1', 'org-1');
    expect(result).toBe(false);
  });
});
