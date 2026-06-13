/**
 * FIX-006 (officer RBAC re-role) — generated-route gate assertion.
 *
 * Root cause: 15 communication management ops were gated
 * `@extension("x-security-required-roles", #["admin", "coordinator"])`. The
 * `coordinator` role does not exist anywhere (seed / role unions), and association
 * officers carry `association:officer`/`association:admin` — NOT bare `admin`. So
 * the generated `authMiddleware({ roles: ["admin","coordinator"] })` 403'd every
 * officer on templates / messages / saved-segments, even though m07 §6 / WF-047
 * assigns these flows to Officers.
 *
 * Fix (decision-free): re-role these ops to the canonical officer role used by the
 * sibling announcement ops — `association:officer` — in communication.tsp, then
 * regenerate. This test parses the GENERATED routes.ts (same approach as
 * route-auth-coverage.test.ts) and asserts each op now grants `association:officer`
 * and no longer references the phantom `coordinator` role.
 *
 * RED before regen (routes show ["admin","coordinator"]); GREEN after.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

// The 15 officer-management ops that were gated ["admin","coordinator"].
const OFFICER_MANAGEMENT_OPS = [
  'createMessageTemplate',
  'getMessageTemplate',
  'updateMessageTemplate',
  'searchMessageTemplates',
  'previewMessageTemplate',
  'createMessage',
  'getMessage',
  'updateMessage',
  'searchMessages',
  'sendMessage',
  'scheduleMessage',
  'cancelMessage',
  'createSavedSegment',
  'listSavedSegments',
  'deleteSavedSegment',
] as const;

describe('FIX-006: communication management ops are officer-gated in generated routes', () => {
  const routesPath = join(import.meta.dir, '..', '..', 'generated', 'openapi', 'routes.ts');
  const content = readFileSync(routesPath, 'utf-8');

  // Build operationId -> authMiddleware roles[] from the generated route blocks.
  const blockPattern =
    /\/\/ (\w+)\n\s+app\.(get|post|put|patch|delete)\('[^']+',\n([\s\S]*?)registry\.\w+ as unknown as Handler\n\s+\);/g;
  const rolesByOp = new Map<string, string[]>();

  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(content)) !== null) {
    const op = match[1]!;
    const body = match[3]!;
    const rolesMatch = body.match(/authMiddleware\(\{ roles: (\[[^\]]*\]) \}\)/);
    if (rolesMatch) {
      rolesByOp.set(op, JSON.parse(rolesMatch[1]!.replace(/'/g, '"')) as string[]);
    }
  }

  test('all 15 ops were parsed from generated routes', () => {
    for (const op of OFFICER_MANAGEMENT_OPS) {
      expect(rolesByOp.has(op), `route block not found for ${op}`).toBe(true);
    }
  });

  test('each op grants association:officer', () => {
    const offenders: string[] = [];
    for (const op of OFFICER_MANAGEMENT_OPS) {
      const roles = rolesByOp.get(op) ?? [];
      if (!roles.includes('association:officer')) {
        offenders.push(`${op} → ${JSON.stringify(roles)}`);
      }
    }
    expect(offenders, `ops missing association:officer:\n${offenders.join('\n')}`).toEqual([]);
  });

  test('no op references the phantom "coordinator" role', () => {
    const offenders: string[] = [];
    for (const op of OFFICER_MANAGEMENT_OPS) {
      const roles = rolesByOp.get(op) ?? [];
      if (roles.includes('coordinator')) {
        offenders.push(`${op} → ${JSON.stringify(roles)}`);
      }
    }
    expect(offenders, `ops still gated on nonexistent coordinator role:\n${offenders.join('\n')}`).toEqual([]);
  });
});
