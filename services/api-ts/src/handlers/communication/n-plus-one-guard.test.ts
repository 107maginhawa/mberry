/**
 * S-C4-011 + S-C4-012 regression guard.
 *
 * The original N+1 fixes shipped in commit 2e41b2cb (Wave G1 / pre-G2):
 *   - communication/bulkUpdatePersonSubscriptions → repo.bulkUpsert (1 query)
 *   - communication/createMessage → repo.findDuplicatesSentToday (1 query)
 *
 * The cycle-3 audit listed these slices as still-open carry-forwards
 * because the audit ran before the fix was indexed. This test prevents
 * the loops from regressing back into per-item DB calls by source-level
 * inspection: the batched repo methods must remain in use and no `for`
 * loop in the touched files may invoke an awaitable repo call.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = join(import.meta.dir);

function read(p: string): string {
  return readFileSync(p, 'utf-8');
}

describe('S-C4-011 / S-C4-012: batched bulk operations stay batched', () => {
  test('bulkUpdatePersonSubscriptions uses repo.bulkUpsert (no per-item upsert)', () => {
    const src = read(join(BASE, 'bulkUpdatePersonSubscriptions.ts'));
    expect(src).toContain('bulkUpsert');
    // Loops over the input must NOT issue per-item awaited repo calls.
    expect(src).not.toMatch(/for\s*\([^)]*\)\s*\{[^}]*await\s+repo\./s);
  });

  test('createMessage uses batched findDuplicatesSentToday (not per-item lookup)', () => {
    const src = read(join(BASE, 'createMessage.ts'));
    expect(src).toContain('findDuplicatesSentToday');
    expect(src).not.toContain('findDuplicateSentToday(');
  });

  // batchGenerateCertificates check removed — handler deleted as an
  // unwired duplicate of association:member/bulkIssueCertificates.
});
