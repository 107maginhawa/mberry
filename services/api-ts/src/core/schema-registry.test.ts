/**
 * Schema Registry contract tests (S-C4-013).
 *
 * Cycle 3 audit IC-01 flagged 20 inverted core→handler dependencies. The
 * schema-registry pattern was ratified (not moved) — see ARCHITECTURE.md
 * "Schema Registry Pattern" ADR. These tests guard the contract:
 *
 * 1. The registry file documents itself as intentional (architectural marker).
 * 2. ARCHITECTURE.md contains the ratifying ADR section.
 * 3. The set of re-exported schemas matches the audit's enumerated 8 tables.
 *    Adding a new cross-module schema requires an explicit registry update
 *    + ADR entry; we lock the surface to prevent silent inversion creep.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as registry from './schema-registry';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..', '..');

describe('S-C4-013: schema-registry pattern (ratified ADR)', () => {
  test('registry file declares itself as architecturally intentional', () => {
    const content = readFileSync(
      join(import.meta.dir, 'schema-registry.ts'),
      'utf-8',
    );
    // The ADR marker proves this inversion is sanctioned, not accidental.
    expect(content).toContain('[INTENTIONAL]');
    expect(content).toMatch(/ARCHITECTURE\.md.*Schema Registry|Schema Registry.*ARCHITECTURE\.md/);
  });

  test('ARCHITECTURE.md contains ratifying ADR section', () => {
    const arch = readFileSync(join(REPO_ROOT, 'ARCHITECTURE.md'), 'utf-8');
    expect(arch).toMatch(/##\s+Schema Registry Pattern/);
    expect(arch).toContain('ADR-001');
    // ADR must enumerate the 5 modules the registry crosses.
    expect(arch).toContain('domain-event-consumers');
  });

  test('registry exposes exactly the 8 audit-enumerated schemas', () => {
    // S-C4-013 source list (audit IC-01, Phase 2 spec): notifications, bookings,
    // platformAdmins, training (trainings+trainingEnrollments), memberships,
    // positions, events (events+eventRegistrations), invitationTokens.
    const expected = new Set([
      'notifications',
      'bookings',
      'platformAdmins',
      'trainingEnrollments',
      'trainings',
      'memberships',
      'positions',
      'events',
      'eventRegistrations',
      'invitationTokens',
    ]);
    const actual = new Set(Object.keys(registry));
    expect(actual).toEqual(expected);
  });
});
