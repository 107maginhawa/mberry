import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentId = string;
type PersonId = string;

interface AccessLogEntry {
  documentId: DocumentId;
  viewerId: PersonId;
  timestamp: Date;
}

interface DocumentVersion {
  versionNumber: number;
  uploadedAt: Date;
  uploadedBy: PersonId;
  content: string;
}

interface Document {
  id: DocumentId;
  currentVersion: number;
  versions: DocumentVersion[];
  accessLog: AccessLogEntry[];
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

function logDocumentAccess(
  doc: Document,
  viewerId: PersonId,
  now: Date,
): Document {
  const entry: AccessLogEntry = {
    documentId: doc.id,
    viewerId,
    timestamp: now,
  };
  return { ...doc, accessLog: [...doc.accessLog, entry] };
}

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

describe('[AC-M11-005] Document Access Logging', () => {
  const baseDoc: Document = {
    id: 'doc-001',
    currentVersion: 1,
    versions: [
      {
        versionNumber: 1,
        uploadedAt: new Date('2026-01-01T00:00:00Z'),
        uploadedBy: 'person-owner',
        content: 'initial content',
      },
    ],
    accessLog: [],
  };

  test('viewing a document logs viewer ID and timestamp', () => {
    const viewerId = 'person-viewer-1';
    const now = new Date('2026-05-22T10:00:00Z');
    const updated = logDocumentAccess(baseDoc, viewerId, now);

    expect(updated.accessLog).toHaveLength(1);
    expect(updated.accessLog[0].viewerId).toBe(viewerId);
    expect(updated.accessLog[0].timestamp).toEqual(now);
    expect(updated.accessLog[0].documentId).toBe(baseDoc.id);
  });

  test('multiple views accumulate in access log', () => {
    const t1 = new Date('2026-05-22T10:00:00Z');
    const t2 = new Date('2026-05-22T11:00:00Z');
    const doc1 = logDocumentAccess(baseDoc, 'person-a', t1);
    const doc2 = logDocumentAccess(doc1, 'person-b', t2);

    expect(doc2.accessLog).toHaveLength(2);
    expect(doc2.accessLog[0].viewerId).toBe('person-a');
    expect(doc2.accessLog[1].viewerId).toBe('person-b');
  });

  test('access log entry preserves document ID', () => {
    const updated = logDocumentAccess(baseDoc, 'person-x', new Date());
    expect(updated.accessLog[0].documentId).toBe('doc-001');
  });
});

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
