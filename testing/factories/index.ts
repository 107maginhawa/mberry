/**
 * Test factories for common entities.
 *
 * Usage: import { createPerson, createPayment } from '@test/factories'
 * Each factory returns a plain object with sensible defaults.
 * Override any field: createPerson({ firstName: 'Maria' })
 *
 * These are frontend-friendly shapes (what the API returns),
 * not DB insert shapes. For backend test factories, use the
 * repo-level factories in services/api-ts/.
 */

let counter = 0
function nextId() { return `test-${++counter}-${Math.random().toString(36).slice(2, 8)}` }

// ── Person ──

export interface TestPerson {
  id: string
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth?: string
  gender?: string
  contactInfo?: { email?: string; phone?: string }
  licenseNumber?: string
  specialization?: string
  prcId?: string
  createdAt: string
  updatedAt: string
}

export function createPerson(overrides: Partial<TestPerson> = {}): TestPerson {
  const id = overrides.id ?? nextId()
  return {
    id,
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    contactInfo: { email: `${id}@test.memberry.app`, phone: '+639171234567' },
    licenseNumber: `LIC-${id.slice(0, 8)}`,
    specialization: 'General Dentistry',
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-01-15T08:00:00Z',
    ...overrides,
  }
}

// ── Organization ──

export interface TestOrganization {
  id: string
  name: string
  slug: string
  type: string
  createdAt: string
  updatedAt: string
}

export function createOrganization(overrides: Partial<TestOrganization> = {}): TestOrganization {
  const id = overrides.id ?? nextId()
  return {
    id,
    name: 'Philippine Dental Association - Chapter 1',
    slug: 'pda-chapter-1',
    type: 'chapter',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Membership ──

export type MembershipStatus = 'active' | 'expired' | 'lapsed' | 'pending' | 'suspended'

export interface TestMembership {
  id: string
  personId: string
  organizationId: string
  status: MembershipStatus
  startDate: string
  expiryDate: string
  person?: TestPerson
  createdAt: string
  updatedAt: string
}

export function createMembership(overrides: Partial<TestMembership> = {}): TestMembership {
  const id = overrides.id ?? nextId()
  return {
    id,
    personId: overrides.personId ?? nextId(),
    organizationId: overrides.organizationId ?? nextId(),
    status: 'active',
    startDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Payment ──

export type PaymentMethod = 'online' | 'cash' | 'check' | 'bankTransfer' | 'gcash' | 'other'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partiallyRefunded' | 'expired'

export interface TestPayment {
  id: string
  organizationId: string
  personId: string
  receiptNumber: string
  amount: number
  currency: string
  paymentMethod: PaymentMethod
  status: PaymentStatus
  paymentDate: string
  recordedBy?: string
  person?: TestPerson
  createdAt: string
  updatedAt: string
}

export function createPayment(overrides: Partial<TestPayment> = {}): TestPayment {
  const id = overrides.id ?? nextId()
  return {
    id,
    organizationId: overrides.organizationId ?? nextId(),
    personId: overrides.personId ?? nextId(),
    receiptNumber: `REC-${id.slice(0, 8)}`,
    amount: 150000, // 1500.00 PHP in cents
    currency: 'PHP',
    paymentMethod: 'cash',
    status: 'completed',
    paymentDate: '2025-06-15',
    createdAt: '2025-06-15T10:00:00Z',
    updatedAt: '2025-06-15T10:00:00Z',
    ...overrides,
  }
}

// ── Dues Config ──

export interface TestDuesConfig {
  id: string
  organizationId: string
  defaultAmount: number
  currency: string
  billingFrequency: 'annual' | 'quarterly'
  gracePeriodDays: number
  dueDateMonth?: number
  dueDateDay: number
}

export function createDuesConfig(overrides: Partial<TestDuesConfig> = {}): TestDuesConfig {
  return {
    id: overrides.id ?? nextId(),
    organizationId: overrides.organizationId ?? nextId(),
    defaultAmount: 150000,
    currency: 'PHP',
    billingFrequency: 'annual',
    gracePeriodDays: 30,
    dueDateDay: 1,
    ...overrides,
  }
}

// ── Event ──

export interface TestEvent {
  id: string
  organizationId: string
  title: string
  type: 'event' | 'training'
  startDate: string
  endDate: string
  maxParticipants?: number
  currentParticipants: number
  creditsAwarded?: number
  createdAt: string
  updatedAt: string
}

export function createEvent(overrides: Partial<TestEvent> = {}): TestEvent {
  const id = overrides.id ?? nextId()
  return {
    id,
    organizationId: overrides.organizationId ?? nextId(),
    title: 'Annual Dental Convention 2025',
    type: 'event',
    startDate: '2025-07-01T09:00:00Z',
    endDate: '2025-07-03T17:00:00Z',
    currentParticipants: 0,
    createdAt: '2025-05-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    ...overrides,
  }
}

// ── Reset counter (for test isolation) ──
export function resetFactoryCounter() { counter = 0 }
