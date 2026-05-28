/**
 * Domain factory functions for test data.
 *
 * Usage:
 *   import { fakePerson, fakeEvent, fakeBooking } from '@/test-utils/factories';
 *   const person = fakePerson({ firstName: 'Juan' });
 *   const event = fakeEvent({ status: 'cancelled' });
 *
 * Every factory returns sensible defaults. Pass overrides for the fields you care about.
 */

// ─── Person ─────────────────────────────────────────────

export function fakePerson(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    firstName: 'Maria',
    lastName: 'Santos',
    middleName: 'Ramos',
    contactInfo: { email: 'maria@test.com', phone: '+639171234567' },
    primaryAddress: { street1: '123 Main', city: 'Manila', state: 'NCR', postalCode: '1000', country: 'PH' },
    licenseNumber: 'PRC-12345',
    dateOfBirth: '1985-06-15',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

// ─── Booking ────────────────────────────────────────────

export function fakeBookingEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'event-1',
    owner: 'user-1',
    title: 'Dental Consultation',
    status: 'active',
    organizationId: 'org-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function fakeBooking(overrides: Record<string, any> = {}) {
  return {
    id: 'booking-1',
    client: 'client-1',
    host: 'host-1',
    slot: 'slot-1',
    locationType: 'video',
    status: 'pending',
    scheduledAt: new Date('2026-06-01T10:00:00Z'),
    durationMinutes: 30,
    bookedAt: new Date('2026-05-01T09:00:00Z'),
    confirmationTimestamp: null,
    cancellationReason: null,
    notes: null,
    formResponses: null,
    invoice: null,
    createdBy: 'client-1',
    ...overrides,
  };
}

export function fakeSlot(overrides: Record<string, any> = {}) {
  return {
    id: 'slot-1',
    eventId: 'event-1',
    startTime: new Date('2026-06-01T10:00:00Z'),
    endTime: new Date('2026-06-01T10:30:00Z'),
    status: 'available',
    maxBookings: 1,
    currentBookings: 0,
    ...overrides,
  };
}

export function fakeScheduleException(overrides: Record<string, any> = {}) {
  return {
    id: 'exc-1',
    eventId: 'event-1',
    date: '2026-06-15',
    type: 'unavailable',
    reason: 'Holiday',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Events ─────────────────────────────────────────────

export function fakeEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'evt-1',
    organizationId: 'org-1',
    title: 'Annual Conference',
    status: 'published',
    createdBy: 'user-1',
    updatedBy: 'user-1',
    ...overrides,
  };
}

export function fakeRegistration(overrides: Record<string, any> = {}) {
  return {
    id: 'reg-1',
    eventId: 'evt-1',
    personId: 'user-1',
    status: 'confirmed',
    registrationFee: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

export function fakeCheckIn(overrides: Record<string, any> = {}) {
  return {
    id: 'checkin-1',
    eventId: 'evt-1',
    personId: 'user-1',
    checkedInAt: new Date(),
    ...overrides,
  };
}

export function fakeAttendance(overrides: Record<string, any> = {}) {
  return {
    id: 'att-1',
    eventId: 'evt-1',
    personId: 'user-1',
    status: 'present',
    creditBearing: true,
    creditAmount: 1,
    ...overrides,
  };
}

// ─── Elections ──────────────────────────────────────────

export function fakeElection(overrides: Record<string, any> = {}) {
  return {
    id: 'election-1',
    organizationId: 'org-1',
    title: '2026 Board Election',
    status: 'votingOpen',
    ...overrides,
  };
}

export function fakeNominee(overrides: Record<string, any> = {}) {
  return {
    id: 'nominee-1',
    electionId: 'election-1',
    positionId: '00000000-0000-4000-8000-000000000001',
    personId: 'user-1',
    status: 'accepted',
    nominatedBy: 'user-2',
    ...overrides,
  };
}

export function fakeVote(overrides: Record<string, any> = {}) {
  return {
    id: 'vote-1',
    electionId: 'election-1',
    positionId: '00000000-0000-4000-8000-000000000001',
    voterId: 'user-1',
    nomineeId: 'nominee-1',
    castAt: new Date(),
    ...overrides,
  };
}

// ─── Training ───────────────────────────────────────────

export function fakeTraining(overrides: Record<string, any> = {}) {
  return {
    id: 'training-1',
    orgId: 'org-1',
    title: 'Advanced Endodontics',
    description: 'CE course',
    status: 'published',
    creditHours: 8,
    startDate: new Date('2026-06-01T00:00:00Z'),
    endDate: new Date('2026-06-02T00:00:00Z'),
    location: 'Manila Convention Center',
    capacity: 50,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function fakeEnrollment(overrides: Record<string, any> = {}) {
  return {
    id: 'enroll-1',
    trainingId: 'training-1',
    personId: 'user-1',
    status: 'enrolled',
    enrolledAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

export function fakeAccreditedProvider(overrides: Record<string, any> = {}) {
  return {
    id: 'provider-1',
    organizationId: 'org-1',
    name: 'PRC Academy',
    accreditationNumber: 'ACC-001',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Membership / Association ───────────────────────────

export function fakeMembership(overrides: Record<string, any> = {}) {
  return {
    id: 'membership-1',
    personId: 'user-1',
    organizationId: 'org-1',
    status: 'active',
    tier: 'regular',
    joinedAt: new Date('2025-01-01T00:00:00Z'),
    expiresAt: new Date('2026-12-31T00:00:00Z'),
    // BR-01 flag fields required by withComputedStatus / persistWithComputedStatus
    duesExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now → active
    suspendedAt: null,
    removedAt: null,
    dateOfDeath: null,
    expelledAt: null,
    resignedAt: null,
    isPendingPayment: false,
    gracePeriodDays: 30,
    ...overrides,
  };
}

export function fakeApplication(overrides: Record<string, any> = {}) {
  return {
    id: 'app-1',
    personId: 'user-1',
    organizationId: 'org-1',
    status: 'pending',
    submittedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    ...overrides,
  };
}

export function fakeMember(overrides: Record<string, any> = {}) {
  return {
    id: 'member-1',
    personId: 'user-1',
    organizationId: 'org-1',
    role: 'member',
    status: 'active',
    ...overrides,
  };
}

// ─── Billing ────────────────────────────────────────────

export function fakeBillingInvoice(overrides: Record<string, any> = {}) {
  return {
    id: 'inv-1',
    organizationId: 'org-1',
    personId: 'user-1',
    amount: 5000,
    currency: 'PHP',
    status: 'draft',
    paymentStatus: 'unpaid',
    description: 'Membership dues',
    createdAt: new Date(),
    ...overrides,
  };
}

export function fakeMerchantAccount(overrides: Record<string, any> = {}) {
  return {
    id: 'merchant-1',
    organizationId: 'org-1',
    stripeAccountId: 'acct_test123',
    status: 'active',
    chargesEnabled: true,
    payoutsEnabled: true,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Dues ───────────────────────────────────────────────

export function fakeDuesInvoice(overrides: Record<string, any> = {}) {
  return {
    id: 'dues-inv-1',
    organizationId: 'org-1',
    personId: 'user-1',
    amount: 2500,
    currency: 'PHP',
    status: 'generated',
    dueDate: new Date('2026-12-31T00:00:00Z'),
    createdAt: new Date(),
    ...overrides,
  };
}

export function fakeDuesPayment(overrides: Record<string, any> = {}) {
  return {
    id: 'dues-pay-1',
    invoiceId: 'dues-inv-1',
    amount: 2500,
    method: 'manual',
    status: 'pending',
    paidAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function fakeDuesConfig(overrides: Record<string, any> = {}) {
  return {
    id: 'dues-cfg-1',
    organizationId: 'org-1',
    defaultAmount: 2500,
    currency: 'PHP',
    billingFrequency: 'annual',
    dueDateMonth: 12,
    gracePeriodDays: 30,
    ...overrides,
  };
}

// ─── Communication ──────────────────────────────────────

export function fakeTemplate(overrides: Record<string, any> = {}) {
  return {
    id: 'tmpl-1',
    organizationId: 'org-1',
    name: 'Welcome Email',
    channel: 'email',
    subject: 'Welcome to the Association',
    body: 'Dear {{name}}, welcome!',
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

export function fakeFeedPost(overrides: Record<string, any> = {}) {
  return {
    id: 'post-1',
    organizationId: 'org-1',
    authorId: 'user-1',
    title: 'Announcement',
    body: 'Test post body',
    status: 'published',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Email ──────────────────────────────────────────────

export function fakeEmailQueue(overrides: Record<string, any> = {}) {
  return {
    id: 'eq-1',
    organizationId: 'org-1',
    to: 'test@example.com',
    subject: 'Test Email',
    body: '<p>Hello</p>',
    status: 'queued',
    attempts: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Documents ──────────────────────────────────────────

export function fakeDocument(overrides: Record<string, any> = {}) {
  return {
    id: 'doc-1',
    organizationId: 'tenant-1',
    title: 'Test Doc',
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    storageKey: 'uploads/test.pdf',
    status: 'published',
    ...overrides,
  };
}

export function fakeDocumentVersion(overrides: Record<string, any> = {}) {
  return {
    id: 'ver-1',
    documentId: 'doc-1',
    organizationId: 'tenant-1',
    versionNumber: 1,
    fileName: 'v1.pdf',
    fileSize: 1024,
    ...overrides,
  };
}

export function fakeDocumentTag(overrides: Record<string, any> = {}) {
  return {
    id: 'tag-1',
    organizationId: 'tenant-1',
    name: 'Policy',
    color: '#ff0000',
    ...overrides,
  };
}

// ─── Certificates ───────────────────────────────────────

export function fakeCertificate(overrides: Record<string, any> = {}) {
  return {
    id: 'cert-1',
    organizationId: 'org-1',
    personId: 'user-1',
    templateId: 'tmpl-1',
    title: 'Certificate of Completion',
    issuedAt: new Date(),
    ...overrides,
  };
}

// ─── Storage Files ──────────────────────────────────────

export function fakeStoredFile(overrides: Record<string, any> = {}) {
  return {
    id: 'file-1',
    organizationId: 'tenant-1',
    filename: 'test-upload.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    status: 'uploading',
    owner: 'user-1',
    uploadedAt: new Date(),
    ...overrides,
  };
}

// ─── Notifications ──────────────────────────────────────

export function fakeNotification(overrides: Record<string, any> = {}) {
  return {
    id: 'n-1',
    organizationId: 'org-1',
    recipient: 'user-1',
    type: 'system',
    channel: 'in-app',
    title: 'Test',
    message: 'Hello',
    status: 'sent',
    sentAt: new Date(),
    readAt: null,
    deliveredAt: null,
    scheduledAt: null,
    ...overrides,
  };
}

// ─── Audit ──────────────────────────────────────────────

export function fakeAuditLog(overrides: Record<string, any> = {}) {
  return {
    id: 'audit-1',
    organizationId: 'org-1',
    actorId: 'user-1',
    action: 'create',
    resource: 'person',
    resourceId: 'user-1',
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Reviews ────────────────────────────────────────────

export function fakeReview(overrides: Record<string, any> = {}) {
  return {
    id: 'review-1',
    organizationId: 'org-1',
    personId: 'user-1',
    score: 8,
    comment: 'Great service',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Invite ─────────────────────────────────────────────

export function fakeInvite(overrides: Record<string, any> = {}) {
  return {
    id: 'invite-1',
    organizationId: 'org-1',
    email: 'invitee@test.com',
    role: 'member',
    status: 'pending',
    expiresAt: new Date('2026-12-31'),
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Association Operations ─────────────────────────────

export function fakeDashboardSnapshot(overrides: Record<string, any> = {}) {
  return {
    id: 'snap-1',
    organizationId: 'org-1',
    totalMembers: 150,
    activeMembers: 120,
    revenue: 375000,
    period: '2026-Q1',
    createdAt: new Date(),
    ...overrides,
  };
}

export function fakeSurvey(overrides: Record<string, any> = {}) {
  return {
    id: 'survey-1',
    organizationId: 'org-1',
    title: 'Member Satisfaction',
    status: 'active',
    createdBy: 'user-1',
    createdAt: new Date(),
    ...overrides,
  };
}

export function fakeCommittee(overrides: Record<string, any> = {}) {
  return {
    id: 'committee-1',
    organizationId: 'org-1',
    name: 'Ethics Committee',
    status: 'active',
    chairPersonId: 'user-1',
    ...overrides,
  };
}

// ─── Job Posting (Marketplace) ──────────────────────────

export function fakeJobPosting(overrides: Record<string, any> = {}) {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    title: 'Associate Dentist',
    description: 'Full-time position',
    status: 'published',
    location: 'Manila',
    createdBy: 'user-1',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Membership Tier ────────────────────────────────────

export function fakeMembershipTier(overrides: Record<string, any> = {}) {
  return {
    id: 'tier-1',
    organizationId: 'org-1',
    name: 'Regular',
    code: 'REG',
    annualFee: 100_00,
    currency: 'PHP',
    status: 'active',
    ...overrides,
  };
}

// ─── Membership Category ────────────────────────────────

export function fakeMembershipCategory(overrides: Record<string, any> = {}) {
  return {
    id: 'cat-1',
    organizationId: 'org-1',
    name: 'General Dentistry',
    description: 'General practitioners',
    code: 'GEN',
    ...overrides,
  };
}

// ─── Training Course ────────────────────────────────────

export function fakeTrainingCourse(overrides: Record<string, any> = {}) {
  return {
    id: 'crs-1',
    title: 'Dental Anatomy 101',
    status: 'active',
    ...overrides,
  };
}

// ─── Quiz Attempt ───────────────────────────────────────

export function fakeQuizAttempt(overrides: Record<string, any> = {}) {
  return {
    id: 'qa-1',
    courseId: 'crs-1',
    personId: 'user-1',
    score: 85,
    passed: true,
    ...overrides,
  };
}

// ─── Platform Admin ─────────────────────────────────────

export function fakePlatformAdmin(overrides: Record<string, any> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'super',
    ...overrides,
  };
}

// ─── Feature Flag ───────────────────────────────────────

export function fakeFeatureFlag(overrides: Record<string, any> = {}) {
  return {
    id: 'flag-1',
    targetType: 'org',
    targetId: 'org-1',
    moduleName: 'billing',
    enabled: true,
    ...overrides,
  };
}

// ─── Organization ───────────────────────────────────────

export function fakeOrg(overrides: Record<string, any> = {}) {
  return {
    id: 'org-1',
    name: 'Philippine Dental Association',
    slug: 'pda',
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}
