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

// ponytail: the 'ARCHITECTURE.md contains ratifying ADR section' guard was dropped
// in the lean-launch cleanup — root ARCHITECTURE.md was deleted with the old
// product docs. The registry's own in-file [INTENTIONAL] marker (test 1) plus the
// locked export surface (test 3) still guard the pattern at the code level.
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
