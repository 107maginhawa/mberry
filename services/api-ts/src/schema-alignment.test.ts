/**
 * Schema Alignment Tests (DATA-01)
 *
 * These tests catch drift between Drizzle schemas and TypeSpec-generated types
 * at build/test time, preventing mismatches from reaching production.
 *
 * They also enforce the invariant that tenantId is fully replaced by organizationId
 * across all DB schema files.
 */

import { describe, test, expect } from 'bun:test';
import { Glob } from 'bun';
import path from 'path';
import type { InferSelectModel } from 'drizzle-orm';
import type { trainings } from '@/handlers/association:operations/repos/training.schema';
import type { memberships } from '@/handlers/association:member/repos/membership.schema';
import type { events } from '@/handlers/association:operations/repos/events.schema';
import type { components } from '@monobase/api-spec/types';

// ── Type aliases for TypeSpec-generated schemas ───────────────────────────────
type ApiTraining = components['schemas']['Training'];
type ApiEvent = components['schemas']['Event'];

// ── Compile-time type alignment assertions (D-07) ─────────────────────────────
// These assertions confirm that Drizzle select models have the same key fields
// as the TypeSpec-generated OpenAPI types. If either is changed, TS compilation fails.

// Training: Drizzle field organizationId must be assignable to ApiTraining['organizationId']
const _trainingOrgIdCheck: {
  organizationId: ApiTraining['organizationId'];
} = {} as Pick<InferSelectModel<typeof trainings>, 'organizationId'>;
void _trainingOrgIdCheck;

// Event: Drizzle field organizationId must be assignable to ApiEvent['organizationId']
const _eventOrgIdCheck: {
  organizationId: ApiEvent['organizationId'];
} = {} as Pick<InferSelectModel<typeof events>, 'organizationId'>;
void _eventOrgIdCheck;

// Membership: confirm organizationId field exists at compile time
type MembershipSelect = InferSelectModel<typeof memberships>;
const _membershipHasOrgId: MembershipSelect['organizationId'] extends string ? true : false = true satisfies true;
void _membershipHasOrgId;

// ── Runtime tests ─────────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(import.meta.dir, '..');

describe('Schema Alignment (DATA-01)', () => {
  test('no duplicate pgTable definitions for the same DB table name', async () => {
    const glob = new Glob('src/handlers/**/repos/*.schema.ts');
    const tableNames = new Map<string, string>();

    for await (const file of glob.scan({ cwd: ROOT_DIR, absolute: false })) {
      const content = await Bun.file(path.join(ROOT_DIR, file)).text();
      const matches = content.matchAll(/pgTable\(['"]([^'"]+)['"]/g);

      for (const match of matches) {
        const tableName = match[1];
        if (tableNames.has(tableName)) {
          throw new Error(
            `Duplicate pgTable('${tableName}') found in:\n  - ${tableNames.get(tableName)}\n  - ${file}`,
          );
        }
        tableNames.set(tableName, file);
      }
    }

    expect(tableNames.size).toBeGreaterThan(0);
  });

  test('no tenantId field in any schema file', async () => {
    const glob = new Glob('src/handlers/**/repos/*.schema.ts');
    const violations: string[] = [];

    for await (const file of glob.scan({ cwd: ROOT_DIR, absolute: false })) {
      const content = await Bun.file(path.join(ROOT_DIR, file)).text();
      if (content.includes('tenantId:') || content.includes("'tenant_id'")) {
        violations.push(file);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found tenantId references in schema files (should be organizationId):\n  - ${violations.join('\n  - ')}`,
      );
    }

    expect(violations).toHaveLength(0);
  });

  test('all association schema files define organizationId column', async () => {
    const glob = new Glob('src/handlers/association:**/repos/*.schema.ts');
    const missingOrgId: string[] = [];

    for await (const file of glob.scan({ cwd: ROOT_DIR, absolute: false })) {
      const content = await Bun.file(path.join(ROOT_DIR, file)).text();
      // Only check tables (not just enums or type-only files)
      if (content.includes('pgTable') && !content.includes("'organization_id'")) {
        missingOrgId.push(file);
      }
    }

    // These are known exception files (junction/relationship tables without direct org ownership)
    const knownExceptions = ['fundraising', 'ethics', 'awards', 'certification'];
    const unexpectedMissing = missingOrgId.filter(
      (f) => !knownExceptions.some((exc) => f.includes(exc)),
    );

    expect(unexpectedMissing).toHaveLength(0);
  });
});
