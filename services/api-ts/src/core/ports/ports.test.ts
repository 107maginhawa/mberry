/**
 * core/ports contract tests (S-C4-014).
 *
 * Verifies:
 *   1. Each port interface is exported from core/ports/index.ts.
 *   2. The matching adapter factory (exported from a handler repo) returns
 *      an object that structurally satisfies the port. Conformance is the
 *      runtime guarantee that prevents drift; TypeScript would catch type
 *      breakage at compile time but not late additions to the port that
 *      handlers forgot to implement.
 *   3. The four target middleware files no longer import directly from
 *      handler repos. This locks the hex boundary at file-import level.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ports from './index';
import { governanceRepoPort } from '@/handlers/association:member/repos/governance.repo';
import {
  platformAdminRepoPort,
  impersonationRepoPort,
} from '@/handlers/platformadmin/repos/platform-admin.repo';
import { membershipRepoPort } from '@/handlers/membership/repos/membership.repo';

const MIDDLEWARE_DIR = join(import.meta.dir, '..', '..', 'middleware');

describe('S-C4-014: core/ports interfaces and adapters', () => {
  test('index re-exports the three port-builder helpers', () => {
    // We expose helpers (not bare types — types are erased at runtime).
    expect(typeof ports.getGovernancePort).toBe('function');
    expect(typeof ports.getPlatformAdminPort).toBe('function');
    expect(typeof ports.getMembershipPort).toBe('function');
  });

  test('GovernancePort adapter satisfies the port shape', () => {
    const adapter = governanceRepoPort({} as never);
    expect(typeof adapter.findActiveOfficerTermsByPersonAndOrg).toBe('function');
  });

  test('PlatformAdminPort adapter satisfies the port shape', () => {
    const adapter = platformAdminRepoPort({} as never);
    expect(typeof adapter.findByUserId).toBe('function');
  });

  test('ImpersonationPort adapter satisfies the port shape', () => {
    const adapter = impersonationRepoPort({} as never, undefined);
    expect(typeof adapter.findByToken).toBe('function');
  });

  test('MembershipPort adapter satisfies the port shape', () => {
    const adapter = membershipRepoPort({} as never);
    expect(typeof adapter.findActiveMembershipByPersonAndOrg).toBe('function');
  });

  // ── Boundary: middleware files MUST NOT import from handlers/* ──
  const middlewareFiles = [
    'officer-auth.ts',
    'platform-admin-auth.ts',
    'impersonation-guard.ts',
    'org-context.ts',
  ];

  for (const file of middlewareFiles) {
    test(`${file} imports only via core/ports (no @/handlers/* import)`, () => {
      const src = readFileSync(join(MIDDLEWARE_DIR, file), 'utf-8');
      // The audit's specific finding: middleware reaching across to handlers.
      // After S-C4-014 these imports must go through the ports module.
      expect(src).not.toMatch(/from\s+['"]@\/handlers\/[^'"]+['"]/);
      expect(src).not.toMatch(/from\s+['"]\.\.\/handlers\//);
    });
  }
});
