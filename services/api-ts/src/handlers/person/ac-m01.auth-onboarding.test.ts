/**
 * AC tests for M01 — Auth / Onboarding
 * Pure domain logic — no DB, no HTTP.
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingStep = 'personal_info' | 'org_selection' | 'dues_payment' | 'complete';

interface OnboardingState {
  personId: string;
  completedSteps: OnboardingStep[];
  totalSteps: OnboardingStep[];
}

interface CsvRow {
  email: string;
  firstName: string;
  lastName: string;
}

interface Person {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

// ---------------------------------------------------------------------------
// Pure functions under test
// ---------------------------------------------------------------------------

const ALL_STEPS: OnboardingStep[] = ['personal_info', 'org_selection', 'dues_payment', 'complete'];

function resolveResumeStep(state: OnboardingState): OnboardingStep {
  const remaining = state.totalSteps.filter(s => !state.completedSteps.includes(s));
  return remaining[0] ?? 'complete';
}

function isOnboardingComplete(state: OnboardingState): boolean {
  return state.totalSteps.every(s => state.completedSteps.includes(s));
}

function matchCsvRowToPerson(row: CsvRow, existing: Person[]): Person | null {
  return existing.find(p => p.email.toLowerCase() === row.email.toLowerCase()) ?? null;
}

function importCsvRow(
  row: CsvRow,
  existing: Person[],
  createFn: (r: CsvRow) => Person,
): { person: Person; created: boolean } {
  const match = matchCsvRowToPerson(row, existing);
  if (match) return { person: match, created: false };
  return { person: createFn(row), created: true };
}

function isLoginRoute(path: string): boolean {
  return path === '/auth/sign-in';
}

function requiresAuthRedirect(path: string, isAuthenticated: boolean): string | null {
  // Unauthenticated users going to protected routes get redirected to login
  const publicRoutes = ['/auth/sign-in', '/auth/sign-up'];
  if (!isAuthenticated && !publicRoutes.includes(path)) {
    return '/auth/sign-in';
  }
  return null;
}

// ---------------------------------------------------------------------------
// AC-M01-003: Wizard Resume
// ---------------------------------------------------------------------------

describe('[AC-M01-003] Wizard Resume', () => {
  test('returns first incomplete step when none completed', () => {
    const state: OnboardingState = {
      personId: 'p1',
      completedSteps: [],
      totalSteps: ALL_STEPS,
    };
    expect(resolveResumeStep(state)).toBe('personal_info');
  });

  test('resumes from correct step after partial completion', () => {
    const state: OnboardingState = {
      personId: 'p1',
      completedSteps: ['personal_info', 'org_selection'],
      totalSteps: ALL_STEPS,
    };
    expect(resolveResumeStep(state)).toBe('dues_payment');
  });

  test('returns complete when all steps done', () => {
    const state: OnboardingState = {
      personId: 'p1',
      completedSteps: [...ALL_STEPS],
      totalSteps: ALL_STEPS,
    };
    expect(resolveResumeStep(state)).toBe('complete');
    expect(isOnboardingComplete(state)).toBe(true);
  });

  test('isOnboardingComplete false when steps remain', () => {
    const state: OnboardingState = {
      personId: 'p1',
      completedSteps: ['personal_info'],
      totalSteps: ALL_STEPS,
    };
    expect(isOnboardingComplete(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-M01-006: Member Matching on Import
// ---------------------------------------------------------------------------

describe('[AC-M01-006] Member Matching on Import', () => {
  const existing: Person[] = [
    { id: 'p1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith' },
    { id: 'p2', email: 'bob@example.com', firstName: 'Bob', lastName: 'Jones' },
  ];

  const creator = (r: CsvRow): Person => ({ id: 'new-id', ...r });

  test('matches existing person by email — no duplicate created', () => {
    const row: CsvRow = { email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith' };
    const result = importCsvRow(row, existing, creator);
    expect(result.created).toBe(false);
    expect(result.person.id).toBe('p1');
  });

  test('match is case-insensitive', () => {
    const row: CsvRow = { email: 'ALICE@EXAMPLE.COM', firstName: 'Alice', lastName: 'Smith' };
    const result = importCsvRow(row, existing, creator);
    expect(result.created).toBe(false);
    expect(result.person.id).toBe('p1');
  });

  test('creates new person when email not found', () => {
    const row: CsvRow = { email: 'carol@example.com', firstName: 'Carol', lastName: 'Lee' };
    const result = importCsvRow(row, existing, creator);
    expect(result.created).toBe(true);
    expect(result.person.email).toBe('carol@example.com');
  });

  test('does not create duplicate when same row imported twice', () => {
    const row: CsvRow = { email: 'bob@example.com', firstName: 'Bob', lastName: 'Jones' };
    const r1 = importCsvRow(row, existing, creator);
    // Second import uses updated roster including original
    const roster = [...existing, ...(r1.created ? [r1.person] : [])];
    const r2 = importCsvRow(row, roster, creator);
    expect(r2.created).toBe(false);
    expect(r2.person.id).toBe('p2');
  });
});

// ---------------------------------------------------------------------------
// AC-M01-007: Login Route
// ---------------------------------------------------------------------------

describe('[AC-M01-007] Login Route', () => {
  test('/auth/sign-in is the correct login route', () => {
    expect(isLoginRoute('/auth/sign-in')).toBe(true);
  });

  test('/login is NOT the login route (wrong path)', () => {
    expect(isLoginRoute('/login')).toBe(false);
  });

  test('unauthenticated user accessing protected route is redirected to sign-in', () => {
    const redirect = requiresAuthRedirect('/dashboard', false);
    expect(redirect).toBe('/auth/sign-in');
  });

  test('unauthenticated user accessing sign-in page is not redirected', () => {
    const redirect = requiresAuthRedirect('/auth/sign-in', false);
    expect(redirect).toBeNull();
  });

  test('authenticated user accessing protected route is not redirected', () => {
    const redirect = requiresAuthRedirect('/dashboard', true);
    expect(redirect).toBeNull();
  });
});
