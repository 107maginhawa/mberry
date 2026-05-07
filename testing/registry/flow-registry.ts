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
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-02',
    name: 'Training Completion → Credit Award',
    trigger: 'Member completes training event',
    modules: ['training', 'events'],
    sideEffects: ['Attendance confirmed', 'Credit entry created', 'Credit summary updated'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-03',
    name: 'Application → Membership Creation',
    trigger: 'Officer approves membership application',
    modules: ['membership', 'invite'],
    sideEffects: ['Application status updated', 'Membership record created', 'Welcome notification sent'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-04',
    name: 'Election Vote → Tally → Winner',
    trigger: 'Member casts vote in election',
    modules: ['elections'],
    sideEffects: ['Vote recorded', 'Tally updated', 'Winner determined when voting closes'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-05',
    name: 'Event Creation → Registration Open',
    trigger: 'Officer creates event with registration',
    modules: ['events', 'communications'],
    sideEffects: ['Event record created', 'Registration slots available', 'Announcement optionally sent'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-06',
    name: 'Dues Config → Invoice Generation',
    trigger: 'Officer configures dues for org',
    modules: ['dues', 'membership'],
    sideEffects: ['Dues config saved', 'Fund allocation percentages set', 'Invoice amounts reflect new config'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-07',
    name: 'Member Import → Matching → Account',
    trigger: 'Officer bulk imports members',
    modules: ['membership', 'person', 'invite'],
    sideEffects: ['Existing members matched by license number', 'New accounts created for unmatched', 'Invitations sent'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-08',
    name: 'Officer Term → Role Grant',
    trigger: 'Officer term created for member',
    modules: ['membership'],
    sideEffects: ['Officer term record created', 'Member gains officer privileges', 'Dashboard access unlocked'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-09',
    name: 'Certificate Request → Generation',
    trigger: 'Member requests certificate for event',
    modules: ['certificates', 'events', 'training'],
    sideEffects: ['Eligibility verified (attendance + credits)', 'Certificate generated', 'Certificate record stored'],
    testFiles: [],
    status: 'untested',
  },
  {
    id: 'FLOW-10',
    name: 'Membership Expiry → Status Downgrade',
    trigger: 'Dues expiry date passes without payment',
    modules: ['membership', 'dues'],
    sideEffects: ['Status changes to expired/lapsed', 'Grace period starts', 'Member notified'],
    testFiles: [],
    status: 'untested',
  },
]

export function getFlowStats() {
  const total = flowRegistry.length
  const covered = flowRegistry.filter(f => f.status === 'covered').length
  const partial = flowRegistry.filter(f => f.status === 'partial').length
  const untested = flowRegistry.filter(f => f.status === 'untested').length
  return { total, covered, partial, untested, coveragePercent: Math.round((covered / total) * 100) }
}
