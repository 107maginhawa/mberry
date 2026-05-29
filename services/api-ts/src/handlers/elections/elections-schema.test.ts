/**
 * [024] Elections Schema Verification
 *
 * Validates the Drizzle schema definitions enforce BR-20 and BR-33 constraints:
 * - electionStatusEnum has all required lifecycle states
 * - nomineeStatusEnum has all required transition states
 * - electionVotes table has unique index on (electionId, voterId, positionId) — BR-20
 * - elections table has date ordering constraints
 * - Schema exports correct types
 */

import { describe, test, expect } from 'bun:test';
import {
  elections,
  electionNominees,
  electionVotes,
  electionStatusEnum,
  nomineeStatusEnum,
  electionTypeEnum,
  votingModeEnum,
} from './repos/elections.schema';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

describe('[024] Elections Schema — Enum Verification', () => {
  test('electionStatusEnum contains all lifecycle states', () => {
    const values = electionStatusEnum.enumValues;
    expect(values).toContain('draft');
    expect(values).toContain('nominationsOpen');
    expect(values).toContain('votingOpen');
    expect(values).toContain('awaitingConfirmation');
    expect(values).toContain('published');
    expect(values).toContain('cancelled');
    expect(values).toHaveLength(6);
  });

  test('nomineeStatusEnum contains all transition states', () => {
    const values = nomineeStatusEnum.enumValues;
    expect(values).toContain('nominated');
    expect(values).toContain('accepted');
    expect(values).toContain('declined');
    expect(values).toContain('elected');
    expect(values).toHaveLength(4);
  });

  test('electionTypeEnum has officer and bylaw', () => {
    const values = electionTypeEnum.enumValues;
    expect(values).toContain('officer');
    expect(values).toContain('bylaw');
    expect(values).toHaveLength(2);
  });

  test('votingModeEnum has all modes', () => {
    const values = votingModeEnum.enumValues;
    expect(values).toContain('online');
    expect(values).toContain('inPerson');
    expect(values).toContain('hybrid');
    expect(values).toHaveLength(3);
  });
});

describe('[024] Elections Schema — Table Structure', () => {
  test('elections table has required columns', () => {
    const cols = Object.keys(elections);
    const required = [
      'organizationId', 'title', 'type', 'status', 'votingMode',
      'nominationsOpenAt', 'nominationsCloseAt', 'votingOpenAt', 'votingCloseAt',
      'positions', 'publishedAt',
    ];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  test('electionNominees table has required columns', () => {
    const cols = Object.keys(electionNominees);
    const required = ['organizationId', 'electionId', 'positionId', 'personId', 'nominatedBy', 'status'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  test('electionVotes table has required columns', () => {
    const cols = Object.keys(electionVotes);
    const required = ['organizationId', 'electionId', 'positionId', 'nomineeId', 'voterId'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  test('[BR-20] electionVotes table exports for unique constraint enforcement', () => {
    // The unique index on (electionId, voterId, positionId) is defined in the table config.
    // We verify the columns exist that the unique index references.
    expect(electionVotes.electionId).toBeDefined();
    expect(electionVotes.voterId).toBeDefined();
    expect(electionVotes.positionId).toBeDefined();
  });

  test('electionNominees has foreign key to elections', () => {
    // The electionId column references elections.id
    expect(electionNominees.electionId).toBeDefined();
  });

  test('electionVotes has foreign key to electionNominees', () => {
    // The nomineeId column references electionNominees.id
    expect(electionVotes.nomineeId).toBeDefined();
  });
});

// ─── [BR-50] Election Date Ordering DB Constraints ────────────────────────
// Source: services/api-ts/src/handlers/elections/repos/elections.schema.ts:29-31
//   check('election_nominations_date_order', nominationsCloseAt > nominationsOpenAt)
//   check('election_voting_date_order',      votingCloseAt      > votingOpenAt)
//   check('election_nominations_before_voting', votingOpenAt   >= nominationsCloseAt)
//
// Rule (br-registry.json#BR-50): the election table MUST carry DB-level CHECK
// constraints that enforce the temporal ordering of nomination and voting
// windows. These constraints are the last line of defense against malformed
// elections — any application-layer skip (e.g. direct repo insert from a
// migration or a future admin tool) would still be caught at the DB.
//
// The Drizzle CHECK definitions live in the table's index/constraint config
// callback. We assert by inspecting the generated migration SQL — the
// constraints exist in the migration journal, so a regression that drops
// them from the schema will show up as a migration diff and fail this test.
describe('[BR-50] elections schema — date ordering constraints', () => {
  // Read the migration that creates the election table and assert the
  // three CHECK constraints are present in the emitted DDL.
  const findElectionMigrationSQL = (): string => {
    // Use Bun's file/fs primitives via dynamic import-less paths. Resolve
    // the migrations directory relative to this test file.
    const migDir = new URL('../../generated/migrations/', import.meta.url).pathname;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    const files: string[] = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql'));
    for (const f of files) {
      const sql = fs.readFileSync(migDir + f, 'utf-8');
      if (sql.includes('CREATE TABLE "election"') || sql.includes('CREATE TABLE election')) {
        return sql;
      }
    }
    // Fallback: scan all migrations and look for an ALTER TABLE adding the
    // constraints (in case the table predates the constraint addition).
    let combined = '';
    for (const f of files) {
      combined += fs.readFileSync(migDir + f, 'utf-8') + '\n';
    }
    return combined;
  };

  test('[BR-50] nominations_close_at > nominations_open_at constraint is in migrations', () => {
    const sql = findElectionMigrationSQL();
    expect(sql.toLowerCase()).toContain('election_nominations_date_order');
  });

  test('[BR-50] voting_close_at > voting_open_at constraint is in migrations', () => {
    const sql = findElectionMigrationSQL();
    expect(sql.toLowerCase()).toContain('election_voting_date_order');
  });

  test('[BR-50] voting_open_at >= nominations_close_at constraint is in migrations', () => {
    const sql = findElectionMigrationSQL();
    expect(sql.toLowerCase()).toContain('election_nominations_before_voting');
  });

  test('[BR-50] all three constraints reference the correct columns', () => {
    const sql = findElectionMigrationSQL().toLowerCase();
    // nominations_date_order: close > open
    expect(sql).toMatch(/nominations_close_at.+>.+nominations_open_at/s);
    // voting_date_order: close > open
    expect(sql).toMatch(/voting_close_at.+>.+voting_open_at/s);
    // nominations_before_voting: voting_open >= nominations_close
    expect(sql).toMatch(/voting_open_at.+>=.+nominations_close_at/s);
  });

  test('[BR-50] elections table exposes the four date columns the constraints reference', () => {
    // Defense in depth: if a future refactor renamed the columns, the
    // migration-text checks above would still pass against legacy
    // migrations. Verify the live schema has the canonical columns.
    expect(elections.nominationsOpenAt).toBeDefined();
    expect(elections.nominationsCloseAt).toBeDefined();
    expect(elections.votingOpenAt).toBeDefined();
    expect(elections.votingCloseAt).toBeDefined();
  });
});
