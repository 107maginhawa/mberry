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
  { id: 'BR-01', name: 'Membership Status Computation', priority: 'P0', module: 'membership', testFiles: ['services/api-ts/src/handlers/membership/br-01.status-computation.test.ts'], status: 'covered', notes: 'T3: computeMembershipStatus pure function — 15 tests' },
  { id: 'BR-02', name: 'Grace Period Default', priority: 'P1', module: 'membership', testFiles: ['services/api-ts/src/handlers/membership/br-01.status-computation.test.ts'], status: 'covered', notes: 'T3: grace period 0/30/90 day bounds tested via BR-01 suite' },
  { id: 'BR-03', name: 'Membership Transitions', priority: 'P0', module: 'membership', testFiles: ['services/api-ts/src/handlers/membership/br-03.transitions.test.ts'], status: 'covered', notes: 'T3: 20 handler-level tests; found gracePeriod/grace enum mismatch bug' },

  // ── Dues & Payments ──
  { id: 'BR-04', name: 'Dues Amount per Org', priority: 'P0', module: 'dues', testFiles: ['services/api-ts/src/handlers/dues/br-04.dues-amount.test.ts'], status: 'covered', notes: 'T3: org-specific config isolation, empty state, currency differences — 8 tests' },
  { id: 'BR-05', name: 'Fund Allocation', priority: 'P0', module: 'dues', testFiles: ['apps/memberry/src/features/dues/lib/money.test.ts', 'services/api-ts/src/handlers/dues/utils/fund-math.test.ts'], status: 'covered', notes: 'T2: frontend + T2: backend fund-math — fully covered' },
  { id: 'BR-06', name: 'Payment Recording', priority: 'P0', module: 'dues', testFiles: ['services/api-ts/src/handlers/bug-class/bigint-serialization.test.ts', 'services/api-ts/src/handlers/dues/br-06.payment-recording.test.ts'], status: 'covered', notes: 'T2: BigInt + T3: full payment flow handler — 12 tests' },
  { id: 'BR-07', name: 'Dues Expiry Extension on Payment', priority: 'P0', module: 'dues', testFiles: ['services/api-ts/src/handlers/dues/utils/expiry-extension.test.ts'], status: 'covered', notes: 'T2: computeNewExpiry 11 tests — fully covered' },
  { id: 'BR-08', name: 'Refund Policy', priority: 'P1', module: 'dues', testFiles: ['services/api-ts/src/handlers/dues/br-08.refund-policy.test.ts'], status: 'covered', notes: 'T3: full/partial refund, reversals, error cases, BR-32 audit — 15 tests' },

  // ── Roles & Auth ──
  { id: 'BR-09', name: 'Officer Role Assignment', priority: 'P0', module: 'membership', testFiles: ['services/api-ts/src/handlers/bug-class/auth-matrix.test.ts'], status: 'covered', notes: 'T2: requireOrgRole + hasMinimumRole hierarchy tested' },
  { id: 'BR-10', name: 'Platform Admin Impersonation', priority: 'P1', module: 'platformadmin', testFiles: ['services/api-ts/src/handlers/br-edge-cases.test.ts'], status: 'covered', notes: 'T3: covered in br-edge-cases (impersonation handler tests)' },

  // ── Credits & Training ──
  { id: 'BR-11', name: 'Credit Cycle Start', priority: 'P1', module: 'training', testFiles: ['services/api-ts/src/handlers/training/br-credits.test.ts'], status: 'covered', notes: 'T3: getCycleBounds — calendar + fiscal year, 6 tests' },
  { id: 'BR-12', name: 'Credit Carry-Over', priority: 'P1', module: 'training', testFiles: ['services/api-ts/src/handlers/training/br-credits.test.ts'], status: 'covered', notes: 'T3: computeCarryOver — cap, negative balance, 8 tests' },
  { id: 'BR-13', name: 'Auto vs Manual Credits', priority: 'P1', module: 'training', testFiles: ['services/api-ts/src/handlers/training/br-credits.test.ts'], status: 'covered', notes: 'T3: auto/manual type distinction + deduction, 6 tests' },
  { id: 'BR-14', name: 'Cross-Org Credit Aggregation', priority: 'P1', module: 'training', testFiles: ['services/api-ts/src/handlers/training/br-credits.test.ts'], status: 'covered', notes: 'T3: aggregateCredits multi-org + global view, 5 tests' },

  // ── Events & Activities ──
  { id: 'BR-15', name: 'Training vs Event Distinction', priority: 'P1', module: 'events', testFiles: ['services/api-ts/src/handlers/events/br-events.test.ts'], status: 'covered', notes: 'T3: shouldAwardCredits — training vs event credit-bearing, 6 tests' },
  { id: 'BR-16', name: 'Activity Visibility', priority: 'P1', module: 'events', testFiles: ['services/api-ts/src/handlers/membership/br-p2-gap.test.ts'], status: 'covered', notes: 'T2: br-p2-gap + br-edge-cases visibility tests' },
  { id: 'BR-17', name: 'Attendance Confirmation', priority: 'P1', module: 'events', testFiles: ['services/api-ts/src/handlers/events/br-events.test.ts'], status: 'covered', notes: 'T3: attendance + duplicate check-in detection, 7 tests' },
  { id: 'BR-18', name: 'QR Code Authentication', priority: 'P2', module: 'events', testFiles: ['services/api-ts/src/handlers/events/br-events.test.ts'], status: 'partial', notes: 'T3: duplicate scan detection tested; QR crypto/auth pending' },

  // ── Identity & Documents ──
  { id: 'BR-19', name: 'ID Card Generation', priority: 'P2', module: 'certificates', testFiles: ['services/api-ts/src/handlers/br-edge-cases.test.ts'], status: 'covered', notes: 'T2: blocked for lapsed/suspended, allowed for active' },
  { id: 'BR-20', name: 'Certificate Generation', priority: 'P2', module: 'certificates', testFiles: ['services/api-ts/src/handlers/br-edge-cases.test.ts'], status: 'covered', notes: 'T2: canIssueCertificate logic tested' },
  { id: 'BR-21', name: 'Multi-Org Member Account', priority: 'P0', module: 'membership', testFiles: ['services/api-ts/src/handlers/membership/br-21.multi-org.test.ts'], status: 'covered', notes: 'T2: multi-org independence, deactivation, historical access' },
  { id: 'BR-22', name: 'Member Matching on Import', priority: 'P1', module: 'membership', testFiles: ['services/api-ts/src/handlers/membership/br-22.member-matching.test.ts'], status: 'covered', notes: 'T3: normalizeEmail/License, matchMember conflict detection — 12 tests' },
  { id: 'BR-23', name: 'License Number Format', priority: 'P1', module: 'membership', testFiles: ['services/api-ts/src/handlers/membership/br-p2-gap.test.ts'], status: 'covered', notes: 'T2: normalization + original format preservation' },

  // ── Auth & Invitations ──
  { id: 'BR-24', name: 'Invitation Expiry', priority: 'P1', module: 'invite', testFiles: ['services/api-ts/src/handlers/invite/br-24.invite-expiry.test.ts'], status: 'covered', notes: 'T3: token utils + claimInvite handler — 14 tests' },
  { id: 'BR-25', name: 'OTP Registration', priority: 'P1', module: 'invite', testFiles: ['services/api-ts/src/handlers/membership/br-p2-gap.test.ts', 'services/api-ts/src/handlers/br-edge-cases.test.ts'], status: 'covered', notes: 'T2: OTP validity, max attempts, rate limiting' },
  { id: 'BR-26', name: 'Session Management', priority: 'P1', module: 'auth', testFiles: ['services/api-ts/src/handlers/membership/br-p2-gap.test.ts'], status: 'covered', notes: 'T2: max concurrent sessions, FIFO eviction' },

  // ── Event Capacity & Comms ──
  { id: 'BR-27', name: 'Event Registration Limits', priority: 'P1', module: 'events', testFiles: ['services/api-ts/src/handlers/events/br-events.test.ts'], status: 'covered', notes: 'T3: capacity, waitlist, cancellation deadline — 11 tests' },
  { id: 'BR-28', name: 'Communication Deduplication', priority: 'P2', module: 'communications', testFiles: ['services/api-ts/src/handlers/communication/communication.test.ts'], status: 'covered', notes: 'T8: dedup logic — skip duplicate recipients same channel same day' },

  // ── Public & Security ──
  { id: 'BR-29', name: 'Org Public Page', priority: 'P2', module: 'membership', testFiles: ['services/api-ts/src/handlers/br-edge-cases.test.ts'], status: 'covered', notes: 'T2: active member count, cancelled org exclusion' },
  { id: 'BR-30', name: 'Payment Gateway Isolation', priority: 'P0', module: 'billing', testFiles: ['services/api-ts/src/handlers/bug-class/auth-matrix.test.ts', 'services/api-ts/src/handlers/dues/br-30.gateway-isolation.test.ts'], status: 'covered', notes: 'T2: tenant isolation + T2: gateway scoping, secret masking — 6 tests' },
  { id: 'BR-31', name: 'SVG Upload Security', priority: 'P1', module: 'storage', testFiles: ['services/api-ts/src/handlers/storage/br-31.svg-security.test.ts'], status: 'covered', notes: 'T3: sanitization — script, event handlers, data URIs, foreignObject — 15 tests' },
  { id: 'BR-32', name: 'Financial Record Retention', priority: 'P0', module: 'dues', testFiles: ['services/api-ts/src/handlers/dues/br-08.refund-policy.test.ts'], status: 'covered', notes: 'T3: no hard-delete, reversal records, audit trail — tested via BR-08 suite' },

  // ── Elections ──
  { id: 'BR-33', name: 'Election Integrity', priority: 'P0', module: 'elections', testFiles: ['services/api-ts/src/handlers/elections/br-33.election-integrity.test.ts'], status: 'covered', notes: 'T2: min candidates, one-time tokens, double-vote prevention, result visibility — 12 tests' },
  { id: 'BR-34', name: 'Nomination Eligibility', priority: 'P1', module: 'elections', testFiles: ['services/api-ts/src/handlers/elections/br-34.nomination-eligibility.test.ts'], status: 'covered', notes: 'T3: checkNominationEligibility — status, duration, suspension — 12 tests' },

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
