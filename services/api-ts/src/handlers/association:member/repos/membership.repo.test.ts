import { describe, test, expect } from 'bun:test';
import { MembershipRepository } from './membership.repo';

/**
 * FIX-017 (§12): the `q` filter is declared on MembershipFilters but
 * buildWhereConditions never built a condition for it — roster search appeared
 * supported yet silently did nothing. These tests prove `q` now produces a real
 * WHERE condition (and that absent filters still produce none).
 *
 * buildWhereConditions is protected; a thin subclass exposes it for assertion.
 */
class TestableMembershipRepository extends MembershipRepository {
  public build(filters?: any) {
    return (this as unknown as { buildWhereConditions: (f?: any) => unknown }).buildWhereConditions(filters);
  }
}

describe('MembershipRepository.buildWhereConditions — q search (FIX-017)', () => {
  const repo = new TestableMembershipRepository({} as any);

  test('builds a WHERE condition when q is provided', () => {
    const condition = repo.build({ organizationId: 'org-1', q: 'Alice' });
    expect(condition).toBeDefined();
  });

  test('q alone (no other filters) still builds a condition — not a silent no-op', () => {
    const condition = repo.build({ q: 'MEM-001' });
    expect(condition).toBeDefined();
  });

  test('no filters builds no condition', () => {
    expect(repo.build({})).toBeUndefined();
  });
});
