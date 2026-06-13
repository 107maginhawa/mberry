import { describe, test, expect } from '@/test/vitest-shim'
import { computeTrainingStats, type MyTrainingItem } from './training'

/**
 * FIX-011 (G11): the My Training dashboard counted enrollments with
 * status === 'enrolled' as EARNED CPE credits and as "Completed", overstating
 * a member's earned credits. A credit is earned only once the enrollment is
 * `completed` (officer-confirmed attendance / completion). These tests lock
 * the corrected predicate on the pure stats helper.
 */
function item(status: string, creditAmount: number): MyTrainingItem {
  return {
    enrollment: { id: `e-${status}-${creditAmount}`, status },
    training: { id: 't', title: 'CPD', status: 'published', creditAmount },
  }
}

describe('computeTrainingStats — earned-credit predicate (FIX-011)', () => {
  test('only COMPLETED enrollments contribute to CPE credits', () => {
    const stats = computeTrainingStats([
      item('completed', 10),
      item('completed', 5),
      item('enrolled', 99), // must NOT count toward earned credits
    ])
    expect(stats.totalCredits).toBe(15)
  })

  test('an ENROLLED-only member has zero earned credits (not the enrolled total)', () => {
    const stats = computeTrainingStats([
      item('enrolled', 12),
      item('enrolled', 8),
    ])
    expect(stats.totalCredits).toBe(0)
  })

  test('"Completed" count reflects completed enrollments, not enrolled ones', () => {
    const stats = computeTrainingStats([
      item('completed', 10),
      item('enrolled', 10),
      item('enrolled', 10),
    ])
    expect(stats.completed).toBe(1)
  })

  test('"Enrolled" count reflects active enrolled enrollments', () => {
    const stats = computeTrainingStats([
      item('enrolled', 10),
      item('enrolled', 10),
      item('completed', 10),
    ])
    expect(stats.enrolled).toBe(2)
  })

  test('cancelled / noShow enrollments earn no credit and are not completed', () => {
    const stats = computeTrainingStats([
      item('cancelled', 10),
      item('noShow', 10),
    ])
    expect(stats.totalCredits).toBe(0)
    expect(stats.completed).toBe(0)
  })
})
