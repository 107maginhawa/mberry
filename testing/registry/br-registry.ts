/**
 * Business Rule Registry — single source of truth for BR → test mapping.
 *
 * Every BR from docs/ver-3/business/business-rules.md is listed here.
 * `testFiles` is empty until tests are written (phases T2–T3).
 * Run `bun run test:registry` to see coverage gaps.
 */

export type BRPriority = 'P0' | 'P1' | 'P2'
export type BRStatus = 'untested' | 'partial' | 'covered'

export interface BREntry {
  id: string
  name: string
  priority: BRPriority
  module: string
  testFiles: string[]
  status: BRStatus
  notes?: string
}

export const brRegistry: BREntry[] = [
  // ── Membership ──
  { id: 'BR-01', name: 'Membership Status Computation', priority: 'P0', module: 'membership', testFiles: [], status: 'untested' },
  { id: 'BR-02', name: 'Grace Period Default', priority: 'P1', module: 'membership', testFiles: [], status: 'untested' },
  { id: 'BR-03', name: 'Membership Transitions', priority: 'P0', module: 'membership', testFiles: [], status: 'untested' },

  // ── Dues & Payments ──
  { id: 'BR-04', name: 'Dues Amount per Org', priority: 'P0', module: 'dues', testFiles: [], status: 'untested' },
  { id: 'BR-05', name: 'Fund Allocation', priority: 'P0', module: 'dues', testFiles: [], status: 'untested' },
  { id: 'BR-06', name: 'Payment Recording', priority: 'P0', module: 'dues', testFiles: [], status: 'untested' },
  { id: 'BR-07', name: 'Dues Expiry Extension on Payment', priority: 'P0', module: 'dues', testFiles: [], status: 'untested' },
  { id: 'BR-08', name: 'Refund Policy', priority: 'P1', module: 'dues', testFiles: [], status: 'untested' },

  // ── Roles & Auth ──
  { id: 'BR-09', name: 'Officer Role Assignment', priority: 'P0', module: 'membership', testFiles: [], status: 'untested' },
  { id: 'BR-10', name: 'Platform Admin Impersonation', priority: 'P1', module: 'platformadmin', testFiles: [], status: 'untested' },

  // ── Credits & Training ──
  { id: 'BR-11', name: 'Credit Cycle Start', priority: 'P1', module: 'training', testFiles: [], status: 'untested' },
  { id: 'BR-12', name: 'Credit Carry-Over', priority: 'P1', module: 'training', testFiles: [], status: 'untested' },
  { id: 'BR-13', name: 'Auto vs Manual Credits', priority: 'P1', module: 'training', testFiles: [], status: 'untested' },
  { id: 'BR-14', name: 'Cross-Org Credit Aggregation', priority: 'P1', module: 'training', testFiles: [], status: 'untested' },

  // ── Events & Activities ──
  { id: 'BR-15', name: 'Training vs Event Distinction', priority: 'P1', module: 'events', testFiles: [], status: 'untested' },
  { id: 'BR-16', name: 'Activity Visibility', priority: 'P1', module: 'events', testFiles: [], status: 'untested' },
  { id: 'BR-17', name: 'Attendance Confirmation', priority: 'P1', module: 'events', testFiles: [], status: 'untested' },
  { id: 'BR-18', name: 'QR Code Authentication', priority: 'P2', module: 'events', testFiles: [], status: 'untested' },

  // ── Identity & Documents ──
  { id: 'BR-19', name: 'ID Card Generation', priority: 'P2', module: 'certificates', testFiles: [], status: 'untested' },
  { id: 'BR-20', name: 'Certificate Generation', priority: 'P2', module: 'certificates', testFiles: [], status: 'untested' },
  { id: 'BR-21', name: 'Multi-Org Member Account', priority: 'P0', module: 'membership', testFiles: [], status: 'untested' },
  { id: 'BR-22', name: 'Member Matching on Import', priority: 'P1', module: 'membership', testFiles: [], status: 'untested' },
  { id: 'BR-23', name: 'License Number Format', priority: 'P1', module: 'membership', testFiles: [], status: 'untested' },

  // ── Auth & Invitations ──
  { id: 'BR-24', name: 'Invitation Expiry', priority: 'P1', module: 'invite', testFiles: [], status: 'untested' },
  { id: 'BR-25', name: 'OTP Registration', priority: 'P1', module: 'invite', testFiles: [], status: 'untested' },
  { id: 'BR-26', name: 'Session Management', priority: 'P1', module: 'auth', testFiles: [], status: 'untested' },

  // ── Event Capacity & Comms ──
  { id: 'BR-27', name: 'Event Registration Limits', priority: 'P1', module: 'events', testFiles: [], status: 'untested' },
  { id: 'BR-28', name: 'Communication Deduplication', priority: 'P2', module: 'communications', testFiles: [], status: 'untested' },

  // ── Public & Security ──
  { id: 'BR-29', name: 'Org Public Page', priority: 'P2', module: 'membership', testFiles: [], status: 'untested' },
  { id: 'BR-30', name: 'Payment Gateway Isolation', priority: 'P0', module: 'billing', testFiles: [], status: 'untested' },
  { id: 'BR-31', name: 'SVG Upload Security', priority: 'P1', module: 'storage', testFiles: [], status: 'untested' },
  { id: 'BR-32', name: 'Financial Record Retention', priority: 'P0', module: 'dues', testFiles: [], status: 'untested' },

  // ── Elections ──
  { id: 'BR-33', name: 'Election Integrity', priority: 'P0', module: 'elections', testFiles: [], status: 'untested' },
  { id: 'BR-34', name: 'Nomination Eligibility', priority: 'P1', module: 'elections', testFiles: [], status: 'untested' },

  // ── Future / Phase 2+ ──
  { id: 'BR-35', name: 'Feed Content Moderation', priority: 'P2', module: 'communications', testFiles: [], status: 'untested' },
  { id: 'BR-36', name: 'National Dashboard Access', priority: 'P2', module: 'platformadmin', testFiles: [], status: 'untested' },
  { id: 'BR-37', name: 'Job Posting Expiry', priority: 'P2', module: 'events', testFiles: [], status: 'untested' },
  { id: 'BR-38', name: 'Marketplace Referral Disclosure', priority: 'P2', module: 'billing', testFiles: [], status: 'untested' },
  { id: 'BR-39', name: 'Committee Dissolution', priority: 'P2', module: 'membership', testFiles: [], status: 'untested' },
  { id: 'BR-40', name: 'Survey Anonymity', priority: 'P2', module: 'communications', testFiles: [], status: 'untested' },
]

// ── Derived stats ──
export function getBRStats() {
  const total = brRegistry.length
  const covered = brRegistry.filter(br => br.status === 'covered').length
  const partial = brRegistry.filter(br => br.status === 'partial').length
  const untested = brRegistry.filter(br => br.status === 'untested').length
  const p0Untested = brRegistry.filter(br => br.priority === 'P0' && br.status === 'untested')
  return { total, covered, partial, untested, p0Untested, coveragePercent: Math.round((covered / total) * 100) }
}
