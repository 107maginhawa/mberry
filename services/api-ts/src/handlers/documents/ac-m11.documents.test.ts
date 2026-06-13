// FIX-014 (verify-chain test hardening / AHA Batch A): both former AC blocks in
// this file were fake-green — they asserted against test-local closures
// (`logDocumentAccess`, `uploadNewVersion`/`getVersionHistory`), not the real
// handlers, so they could never catch a production regression.
//
// They have been replaced with real handler-driven coverage:
//
//   AC-M11-005 (Document Access Logging):
//     - getDocument.access-log.test.ts   (view     → document_access_log row)
//     - downloadDocument.test.ts          (download → document_access_log row + auth matrix)
//
//   AC-M11-006 (Version History / monotonic version numbering):
//     - uploadNewDocumentVersion.test.ts  (handler computes nextVersion = repo latest + 1;
//                                           records the acting uploader id) — see the
//                                           `[AC-M11-006]` describe block
//     - listDocumentVersions.test.ts      (immutable history is listed back)
//     - getDocumentVersion.test.ts        (a stored version is retrievable; cross-doc IDOR guard)
//
// This file intentionally contains no tests: keeping it as a pointer prevents the
// fake-green simulation from being reintroduced. Do NOT re-add local-closure
// "simulation" tests here — drive the real handler instead.

import { describe, test, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('ac-m11 documents (fake-green simulations removed)', () => {
  // Real guard (not a vacuous sentinel): enforce that the real handler-driven
  // coverage that replaced the former in-file simulations still exists. If a
  // sibling file is deleted/renamed, this fails loudly instead of silently
  // dropping AC-M11-005/006 coverage.
  test('AC-M11-005 / AC-M11-006 real handler coverage files exist', () => {
    const dir = import.meta.dir;
    const required = [
      'getDocument.access-log.test.ts',
      'downloadDocument.test.ts',
      'uploadNewDocumentVersion.test.ts',
      'listDocumentVersions.test.ts',
      'getDocumentVersion.test.ts',
    ];
    const missing = required.filter((f) => !existsSync(join(dir, f)));
    expect(missing).toEqual([]);
  });
});
