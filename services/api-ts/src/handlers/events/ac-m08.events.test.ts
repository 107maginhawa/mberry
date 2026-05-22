// Business Rules: [BR-16]
/**
 * AC-M08: Events Module — Pure Domain Logic Tests
 *
 * Covers:
 *   AC-M08-001: QR check-in security (validation prerequisites)
 *   AC-M08-002: Capacity management — waitlist FIFO auto-promotion
 *   AC-M08-003: Paid event — payment required before confirmed status
 *   AC-M08-004: Event cancellation cascade (notification + refund trigger)
 *   AC-M08-005: Visibility enforcement — internal events block non-members
 *   AC-M08-006: Post-completion lock — reject registration and check-in
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ─────────────────────────────────────────

type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled';
type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled' | 'refunded' | 'noShow';
type EventVisibility = 'internal' | 'network';
type CheckInMethod = 'qr' | 'manual';

interface OrgEvent {
  id: string;
  status: EventStatus;
  visibility: EventVisibility;
  capacity: number | null; // null = unlimited
  isPaid: boolean;
  registrationFee: number;
}

interface Registration {
  id: string;
  eventId: string;
  personId: string;
  status: RegistrationStatus;
  waitlistPosition: number | null;
}

interface WaitlistEntry {
  id: string;
  eventId: string;
  personId: string;
  position: number; // 1-indexed, FIFO
  joinedAt: Date;
  promotedAt: Date | null;
}

interface CheckInRequest {
  eventId: string;
  personId: string;
  scannerPersonId: string;
  method: CheckInMethod;
}

interface CheckInValidationResult {
  valid: boolean;
  error: string | null;
}

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M08-001: QR check-in requires:
 *   1. Authenticated scanner (scannerPersonId present)
 *   2. Event is published (not draft/cancelled/completed)
 *   3. Member is registered for the event
 */
function validateCheckIn(
  req: CheckInRequest,
  event: OrgEvent,
  registration: Registration | null,
): CheckInValidationResult {
  if (!req.scannerPersonId) {
    return { valid: false, error: 'Scanner must be authenticated.' };
  }
  if (event.status !== 'published' && event.status !== 'active') {
    return { valid: false, error: 'Event is not active for check-in.' };
  }
  if (!registration || registration.status !== 'confirmed') {
    return { valid: false, error: 'Member not registered for this event.' };
  }
  return { valid: true, error: null };
}

/**
 * AC-M08-002: Determine registration outcome given capacity.
 * Returns 'confirmed', 'waitlisted', or 'blocked' (event full, waitlist off).
 */
function resolveRegistrationStatus(
  event: OrgEvent,
  confirmedCount: number,
  waitlistEnabled: boolean,
): RegistrationStatus | 'blocked' {
  if (event.capacity === null) return 'confirmed'; // unlimited
  if (confirmedCount < event.capacity) return 'confirmed';
  if (waitlistEnabled) return 'waitlisted';
  return 'blocked';
}

/**
 * AC-M08-002: Get the next person to promote from waitlist (FIFO = lowest position).
 */
function getNextWaitlistPromotion(entries: WaitlistEntry[]): WaitlistEntry | null {
  const unpromotedEntries = entries
    .filter((e) => e.promotedAt === null)
    .sort((a, b) => a.position - b.position);
  return unpromotedEntries[0] ?? null;
}

/**
 * AC-M08-003: Resolve registration status for a paid event.
 * Paid events start in 'pending' until PaymentRecorded confirms them.
 */
function resolvePaidRegistrationStatus(event: OrgEvent): RegistrationStatus {
  if (event.isPaid && event.registrationFee > 0) {
    return 'pending'; // payment required before confirmed
  }
  return 'confirmed';
}

/**
 * AC-M08-004: Check whether event cancellation should trigger notifications and refunds.
 */
interface CancellationActions {
  notifyMembers: boolean;
  refundRequired: boolean;
  affectedRegistrations: string[]; // registration IDs
}

function computeCancellationActions(
  event: OrgEvent,
  registrations: Registration[],
): CancellationActions {
  const confirmedRegistrations = registrations.filter(
    (r) => r.status === 'confirmed' || r.status === 'pending',
  );
  return {
    notifyMembers: confirmedRegistrations.length > 0,
    refundRequired: event.isPaid && confirmedRegistrations.length > 0,
    affectedRegistrations: confirmedRegistrations.map((r) => r.id),
  };
}

/**
 * AC-M08-005: Visibility enforcement.
 * Internal events are only accessible to members of the hosting org.
 */
function canAccessEvent(
  event: OrgEvent,
  viewerOrgIds: string[],
  hostOrgId: string,
): boolean {
  if (event.visibility === 'network') return true;
  // internal: viewer must belong to the hosting org
  return viewerOrgIds.includes(hostOrgId);
}

/**
 * AC-M08-006: Post-completion lock.
 * Completed and cancelled events reject new registrations and check-ins.
 */
function isEventLocked(event: OrgEvent): boolean {
  return event.status === 'completed' || event.status === 'cancelled';
}

// ─── Helpers ──────────────────────────────────────────────

function makeEvent(overrides: Partial<OrgEvent> = {}): OrgEvent {
  return {
    id: 'evt-1',
    status: 'published',
    visibility: 'network',
    capacity: 50,
    isPaid: false,
    registrationFee: 0,
    ...overrides,
  };
}

function makeRegistration(overrides: Partial<Registration> = {}): Registration {
  return {
    id: 'reg-1',
    eventId: 'evt-1',
    personId: 'person-1',
    status: 'confirmed',
    waitlistPosition: null,
    ...overrides,
  };
}

function makeWaitlistEntry(position: number, overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: `entry-${position}`,
    eventId: 'evt-1',
    personId: `person-${position}`,
    position,
    joinedAt: new Date(Date.now() + position * 1000),
    promotedAt: null,
    ...overrides,
  };
}

// ─── AC-M08-001: QR Check-In Security ────────────────────

describe('[AC-M08-001] QR check-in security validation', () => {
  test('AC-M08-001: valid check-in passes all three guards', () => {
    // Given: authenticated scanner, published event, confirmed registration
    const event = makeEvent({ status: 'published' });
    const registration = makeRegistration({ status: 'confirmed' });
    const req: CheckInRequest = {
      eventId: 'evt-1',
      personId: 'person-1',
      scannerPersonId: 'officer-1',
      method: 'qr',
    };
    // When: validated
    const result = validateCheckIn(req, event, registration);
    // Then: valid
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  test('AC-M08-001: unauthenticated scanner is rejected', () => {
    // Given: no scanner identity
    const event = makeEvent();
    const registration = makeRegistration();
    const req: CheckInRequest = {
      eventId: 'evt-1',
      personId: 'person-1',
      scannerPersonId: '',
      method: 'qr',
    };
    // When: validated
    const result = validateCheckIn(req, event, registration);
    // Then: rejected
    expect(result.valid).toBe(false);
    expect(result.error).toContain('authenticated');
  });

  test('AC-M08-001: draft event is rejected for check-in', () => {
    // Given: event is still in draft
    const event = makeEvent({ status: 'draft' });
    const registration = makeRegistration();
    const req: CheckInRequest = {
      eventId: 'evt-1',
      personId: 'person-1',
      scannerPersonId: 'officer-1',
      method: 'qr',
    };
    // When: validated
    const result = validateCheckIn(req, event, registration);
    // Then: rejected
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not active');
  });

  test('AC-M08-001: member not registered is rejected', () => {
    // Given: no matching registration
    const event = makeEvent({ status: 'published' });
    const req: CheckInRequest = {
      eventId: 'evt-1',
      personId: 'person-99',
      scannerPersonId: 'officer-1',
      method: 'manual',
    };
    // When: validated with null registration
    const result = validateCheckIn(req, event, null);
    // Then: rejected
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not registered');
  });
});

// ─── AC-M08-002: Capacity Management ─────────────────────

describe('[AC-M08-002] Capacity management — waitlist FIFO', () => {
  test('AC-M08-002: registration confirmed when capacity available', () => {
    // Given: event with 50 capacity, 30 confirmed
    const event = makeEvent({ capacity: 50 });
    // When: new registration
    const status = resolveRegistrationStatus(event, 30, true);
    // Then: confirmed
    expect(status).toBe('confirmed');
  });

  test('AC-M08-002: registration goes to waitlist when at capacity', () => {
    // Given: event full (50/50)
    const event = makeEvent({ capacity: 50 });
    // When: new registration
    const status = resolveRegistrationStatus(event, 50, true);
    // Then: waitlisted
    expect(status).toBe('waitlisted');
  });

  test('AC-M08-002: null capacity means unlimited registration', () => {
    // Given: event with no capacity limit
    const event = makeEvent({ capacity: null });
    // When: registration with 10000 confirmed
    const status = resolveRegistrationStatus(event, 10000, true);
    // Then: always confirmed
    expect(status).toBe('confirmed');
  });

  test('AC-M08-002: FIFO — lowest position promoted first', () => {
    // Given: 3 waitlist entries in order
    const entries: WaitlistEntry[] = [
      makeWaitlistEntry(3),
      makeWaitlistEntry(1),
      makeWaitlistEntry(2),
    ];
    // When: next promotion computed
    const next = getNextWaitlistPromotion(entries);
    // Then: position 1 (joined first) is promoted
    expect(next?.position).toBe(1);
    expect(next?.personId).toBe('person-1');
  });

  test('AC-M08-002: already promoted entries are skipped', () => {
    // Given: position 1 already promoted, positions 2 and 3 waiting
    const entries: WaitlistEntry[] = [
      makeWaitlistEntry(1, { promotedAt: new Date() }),
      makeWaitlistEntry(2),
      makeWaitlistEntry(3),
    ];
    // When: next promotion computed
    const next = getNextWaitlistPromotion(entries);
    // Then: position 2 is next
    expect(next?.position).toBe(2);
  });

  test('AC-M08-002: returns null when all waitlist entries promoted', () => {
    // Given: all entries already promoted
    const entries: WaitlistEntry[] = [
      makeWaitlistEntry(1, { promotedAt: new Date() }),
      makeWaitlistEntry(2, { promotedAt: new Date() }),
    ];
    // When: next promotion computed
    const next = getNextWaitlistPromotion(entries);
    // Then: no one to promote
    expect(next).toBeNull();
  });
});

// ─── AC-M08-003: Paid Event Registration ─────────────────

describe('[AC-M08-003] Paid event — pending until payment confirmed', () => {
  test('AC-M08-003: paid event registration starts as pending', () => {
    // Given: paid event with non-zero fee
    const event = makeEvent({ isPaid: true, registrationFee: 500 });
    // When: registration status resolved
    const status = resolvePaidRegistrationStatus(event);
    // Then: pending (awaits PaymentRecorded)
    expect(status).toBe('pending');
  });

  test('AC-M08-003: free event registration is immediately confirmed', () => {
    // Given: free event
    const event = makeEvent({ isPaid: false, registrationFee: 0 });
    // When: registration status resolved
    const status = resolvePaidRegistrationStatus(event);
    // Then: confirmed immediately
    expect(status).toBe('confirmed');
  });

  test('AC-M08-003: isPaid=true but fee=0 treated as free (edge case)', () => {
    // Given: event marked paid but fee is 0 (misconfiguration edge case)
    const event = makeEvent({ isPaid: true, registrationFee: 0 });
    // When: registration status resolved
    const status = resolvePaidRegistrationStatus(event);
    // Then: confirmed (no payment needed for zero-fee)
    expect(status).toBe('confirmed');
  });
});

// ─── AC-M08-004: Event Cancellation Cascade ──────────────

describe('[AC-M08-004] Event cancellation triggers notifications and refunds', () => {
  test('AC-M08-004: cancelling event with confirmed registrations flags notifyMembers', () => {
    // Given: published paid event with 2 confirmed registrations
    const event = makeEvent({ isPaid: true, registrationFee: 1000 });
    const registrations = [
      makeRegistration({ id: 'reg-1', status: 'confirmed' }),
      makeRegistration({ id: 'reg-2', personId: 'person-2', status: 'confirmed' }),
    ];
    // When: cancellation actions computed
    const actions = computeCancellationActions(event, registrations);
    // Then: notifications and refunds required
    expect(actions.notifyMembers).toBe(true);
    expect(actions.refundRequired).toBe(true);
    expect(actions.affectedRegistrations).toHaveLength(2);
  });

  test('AC-M08-004: cancelling free event with confirmed registrations — no refund', () => {
    // Given: free event with confirmed registrations
    const event = makeEvent({ isPaid: false, registrationFee: 0 });
    const registrations = [makeRegistration({ status: 'confirmed' })];
    // When: cancellation actions computed
    const actions = computeCancellationActions(event, registrations);
    // Then: notify but no refund needed
    expect(actions.notifyMembers).toBe(true);
    expect(actions.refundRequired).toBe(false);
  });

  test('AC-M08-004: cancelling event with no active registrations — no notifications', () => {
    // Given: event with only cancelled registrations
    const event = makeEvent({ isPaid: true, registrationFee: 500 });
    const registrations = [
      makeRegistration({ status: 'cancelled' }),
      makeRegistration({ personId: 'person-2', status: 'refunded' }),
    ];
    // When: cancellation actions computed
    const actions = computeCancellationActions(event, registrations);
    // Then: no notifications or refunds needed
    expect(actions.notifyMembers).toBe(false);
    expect(actions.refundRequired).toBe(false);
    expect(actions.affectedRegistrations).toHaveLength(0);
  });

  test('AC-M08-004: pending paid registrations also trigger refund on cancellation', () => {
    // Given: paid event with one pending registration (payment in progress)
    const event = makeEvent({ isPaid: true, registrationFee: 500 });
    const registrations = [makeRegistration({ status: 'pending' })];
    // When: cancellation actions computed
    const actions = computeCancellationActions(event, registrations);
    // Then: refund required for pending paid too
    expect(actions.refundRequired).toBe(true);
  });
});

// ─── AC-M08-005: Visibility Enforcement ──────────────────

describe('[AC-M08-005] Internal event visibility enforcement', () => {
  test('AC-M08-005: network event accessible to non-members', () => {
    // Given: network-visible event
    const event = makeEvent({ visibility: 'network' });
    // When: viewer from unrelated org
    const canAccess = canAccessEvent(event, ['org-other'], 'org-host');
    // Then: accessible
    expect(canAccess).toBe(true);
  });

  test('AC-M08-005: internal event blocks non-org member', () => {
    // Given: internal event hosted by org-host
    const event = makeEvent({ visibility: 'internal' });
    // When: viewer from different org
    const canAccess = canAccessEvent(event, ['org-other'], 'org-host');
    // Then: blocked
    expect(canAccess).toBe(false);
  });

  test('AC-M08-005: internal event allows hosting org member', () => {
    // Given: internal event
    const event = makeEvent({ visibility: 'internal' });
    // When: viewer is member of hosting org
    const canAccess = canAccessEvent(event, ['org-host', 'org-other'], 'org-host');
    // Then: allowed
    expect(canAccess).toBe(true);
  });

  test('AC-M08-005: member of multiple orgs can access internal event of any org they belong to', () => {
    // Given: internal event at org-b
    const event = makeEvent({ visibility: 'internal' });
    // When: viewer belongs to org-a and org-b
    const canAccess = canAccessEvent(event, ['org-a', 'org-b'], 'org-b');
    // Then: allowed (member of org-b)
    expect(canAccess).toBe(true);
  });
});

// ─── AC-M08-006: Post-Completion Lock ────────────────────

describe('[AC-M08-006] Post-completion lock — reject registration and check-in', () => {
  test('AC-M08-006: completed event is locked', () => {
    // Given: completed event
    const event = makeEvent({ status: 'completed' });
    // When: lock checked
    expect(isEventLocked(event)).toBe(true);
  });

  test('AC-M08-006: cancelled event is locked', () => {
    // Given: cancelled event
    const event = makeEvent({ status: 'cancelled' });
    // When: lock checked
    expect(isEventLocked(event)).toBe(true);
  });

  test('AC-M08-006: published event is not locked', () => {
    // Given: published event
    const event = makeEvent({ status: 'published' });
    // When: lock checked
    expect(isEventLocked(event)).toBe(false);
  });

  test('AC-M08-006: draft event is not locked (can still be configured)', () => {
    // Given: draft event
    const event = makeEvent({ status: 'draft' });
    // When: lock checked
    expect(isEventLocked(event)).toBe(false);
  });

  test('AC-M08-006: check-in on completed event is rejected', () => {
    // Given: completed event
    const event = makeEvent({ status: 'completed' });
    const registration = makeRegistration({ status: 'confirmed' });
    const req: CheckInRequest = {
      eventId: 'evt-1',
      personId: 'person-1',
      scannerPersonId: 'officer-1',
      method: 'qr',
    };
    // When: check-in attempted
    const result = validateCheckIn(req, event, registration);
    // Then: rejected (completed ≠ published/active)
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not active');
  });
});
