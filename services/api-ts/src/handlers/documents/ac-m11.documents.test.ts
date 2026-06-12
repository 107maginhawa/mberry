import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Types ────────────────────────────────────────────────────────────────────

type PersonId = string;

interface DocumentVersion {
  versionNumber: number;
  uploadedAt: Date;
  uploadedBy: PersonId;
  content: string;
}

interface Document {
  id: string;
  currentVersion: number;
  versions: DocumentVersion[];
  accessLog: unknown[];
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

// NOTE (FIX-003 / AC-M11-005): the former in-memory `logDocumentAccess`
// simulation was removed. It tested a local closure, not the production code
// path, and gave fake-green confidence while `document_access_log` was never
// actually written on view/download. Real handler-level coverage now lives in:
//   - getDocument.access-log.test.ts  (view → access-log row)
//   - downloadDocument.test.ts        (download → access-log row + auth matrix)

function uploadNewVersion(
  doc: Document,
  content: string,
  uploadedBy: PersonId,
  now: Date,
): Document {
  const nextVersion = doc.currentVersion + 1;
  const newVersionEntry: DocumentVersion = {
    versionNumber: nextVersion,
    uploadedAt: now,
    uploadedBy,
    content,
  };
  return {
    ...doc,
    currentVersion: nextVersion,
    versions: [...doc.versions, newVersionEntry],
  };
}

function getVersionHistory(doc: Document): DocumentVersion[] {
  return [...doc.versions].sort((a, b) => a.versionNumber - b.versionNumber);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// [AC-M11-005] Document Access Logging is now covered by real handler tests:
//   getDocument.access-log.test.ts and downloadDocument.test.ts (FIX-003).

describe('[AC-M11-006] Version History', () => {
  const baseDoc: Document = {
    id: 'doc-002',
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        uploadedAt: new Date('2026-01-01T00:00:00Z'),
        uploadedBy: 'person-owner',
        content: 'version 1 content',
      },
    ],
    accessLog: [],
  };

  test('uploading a new version increments version number', () => {
    const updated = uploadNewVersion(
      baseDoc,
      'version 2 content',
      'person-editor',
      new Date('2026-05-22T12:00:00Z'),
    );
    expect(updated.currentVersion).toBe(2);
    expect(updated.versions).toHaveLength(2);
  });

  test('previous version is preserved after new upload', () => {
    const updated = uploadNewVersion(
      baseDoc,
      'version 2 content',
      'person-editor',
      new Date(),
    );
    const history = getVersionHistory(updated);
    expect(history[0].versionNumber).toBe(1);
    expect(history[0].content).toBe('version 1 content');
  });

  test('version history returns all versions in order', () => {
    const v2 = uploadNewVersion(baseDoc, 'v2', 'person-a', new Date('2026-02-01T00:00:00Z'));
    const v3 = uploadNewVersion(v2, 'v3', 'person-b', new Date('2026-03-01T00:00:00Z'));
    const history = getVersionHistory(v3);

    expect(history).toHaveLength(3);
    expect(history.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
  });

  test('new version records uploader ID', () => {
    const uploaderId = 'person-editor-99';
    const updated = uploadNewVersion(baseDoc, 'new content', uploaderId, new Date());
    const latest = updated.versions[updated.versions.length - 1];
    expect(latest.uploadedBy).toBe(uploaderId);
  });
});
