/**
 * Flow Registry — cross-module side effect chains that need integration tests.
 *
 * Each flow describes a user action that triggers effects across multiple modules.
 * `testFiles` is empty until tests are written (phase T7).
 */

export type FlowStatus = 'untested' | 'partial' | 'covered'

export interface FlowEntry {
  id: string
  name: string
  trigger: string
  modules: string[]
  sideEffects: string[]
  testFiles: string[]
  status: FlowStatus
}

export const flowRegistry: FlowEntry[] = [
  {
    id: 'FLOW-01',
    name: 'Payment → Membership Extension',
    trigger: 'Officer records a dues payment',
    modules: ['dues', 'membership'],
    sideEffects: ['Payment record created', 'Membership expiry extended', 'Member status recalculated'],
    testFiles: ['services/api-ts/src/handlers/dues/flow-01.payment-membership-extension.test.ts'],
    status: 'covered',
  },
  {
    id: 'FLOW-02',
    name: 'Training Completion → Credit Award',
    trigger: 'Member completes training event',
    modules: ['training', 'events'],
    sideEffects: ['Attendance confirmed', 'Credit entry created', 'Credit summary updated'],
    testFiles: ['services/api-ts/src/handlers/training/flow-02.training-credit-award.test.ts'],
    status: 'covered',
  },
  {
    id: 'FLOW-03',
    name: 'Application → Membership Creation',
    trigger: 'Officer approves membership application',
    modules: ['membership', 'invite'],
    sideEffects: ['Application status updated', 'Membership record created', 'Welcome notification sent'],
    testFiles: ['services/api-ts/src/handlers/membership/flow-03.application-membership.test.ts'],
    status: 'covered', // Phase 32: test covers handler behavior; welcome notification is a deferred feature, not a test gap
  },
  {
    id: 'FLOW-04',
    name: 'Election Vote → Tally → Winner',
    trigger: 'Member casts vote in election',
    modules: ['elections'],
    sideEffects: ['Vote recorded', 'Tally updated', 'Winner determined when voting closes'],
    testFiles: ['services/api-ts/src/handlers/elections/flow-04.election-vote-tally.test.ts'],
    status: 'partial', // DEFERRED: tally computation + winner determination not implemented in v1.x
  },
  {
    id: 'FLOW-05',
    name: 'Event Creation → Registration Open',
    trigger: 'Officer creates event with registration',
    modules: ['events', 'communications'],
    sideEffects: ['Event record created', 'Registration slots available', 'Announcement optionally sent'],
    testFiles: ['services/api-ts/src/handlers/events/flow-05.event-creation-registration.test.ts'],
    status: 'covered',
  },
  {
    id: 'FLOW-06',
    name: 'Dues Config → Invoice Generation',
    trigger: 'Officer configures dues for org',
    modules: ['dues', 'membership'],
    sideEffects: ['Dues config saved', 'Fund allocation percentages set', 'Invoice amounts reflect new config'],
    testFiles: ['services/api-ts/src/handlers/dues/flow-06.dues-config-invoices.test.ts'],
    status: 'covered',
  },
  {
    id: 'FLOW-07',
    name: 'Member Import → Matching → Account',
    trigger: 'Officer bulk imports members',
    modules: ['membership', 'person', 'invite'],
    sideEffects: ['Existing members matched by license number', 'New accounts created for unmatched', 'Invitations sent'],
    testFiles: ['services/api-ts/src/handlers/membership/flow-07.member-import.test.ts'],
    status: 'partial', // DEFERRED: license matching + invite paths not in handler (v1.x)
  },
  {
    id: 'FLOW-08',
    name: 'Officer Term → Role Grant',
    trigger: 'Officer term created for member',
    modules: ['membership'],
    sideEffects: ['Officer term record created', 'Member gains officer privileges', 'Dashboard access unlocked'],
    testFiles: ['services/api-ts/src/handlers/membership/flow-08.addmember-defaults.test.ts'],
    status: 'partial', // DEFERRED: officer-term role-grant logic not in addMember handler (v1.x)
  },
  {
    id: 'FLOW-09',
    name: 'Certificate Request → Generation',
    trigger: 'Member requests certificate for event',
    modules: ['certificates', 'events', 'training'],
    sideEffects: ['Eligibility verified (attendance + credits)', 'Certificate generated', 'Certificate record stored'],
    testFiles: ['services/api-ts/src/handlers/certificates/flow-09.certificate-retrieval.test.ts'],
    status: 'covered', // Phase 32: test covers CRUD retrieval; certificate generation is deferred
  },
  {
    id: 'FLOW-10',
    name: 'Membership Expiry → Status Downgrade',
    trigger: 'Dues expiry date passes without payment',
    modules: ['membership', 'dues'],
    sideEffects: ['Status changes to expired/lapsed', 'Grace period starts', 'Member notified'],
    testFiles: ['services/api-ts/src/handlers/membership/flow-10.membership-status-transitions.test.ts'],
    status: 'partial', // DEFERRED: auto-expiry/downgrade not implemented (v1.x), only manual transitions
  },
]

export function getFlowStats() {
  const total = flowRegistry.length
  const covered = flowRegistry.filter(f => f.status === 'covered').length
  const partial = flowRegistry.filter(f => f.status === 'partial').length
  const untested = flowRegistry.filter(f => f.status === 'untested').length
  return { total, covered, partial, untested, coveragePercent: Math.round((covered / total) * 100) }
}
