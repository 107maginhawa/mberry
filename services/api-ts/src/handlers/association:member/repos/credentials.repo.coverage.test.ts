/**
 * Credentials repos — CredentialTemplateRepository + DigitalCredentialRepository.
 * buildWhereConditions branches + findByQrPayload. Mock-DB style.
 */

import { describe, test, expect } from 'bun:test';
import { CredentialTemplateRepository, DigitalCredentialRepository } from './credentials.repo';
import { makeFakeDb } from './__testkit__/fake-db';

const hasWhere = (db: ReturnType<typeof makeFakeDb>) =>
  db.ops.select[0]!.some((c) => c.method === 'where');

describe('CredentialTemplateRepository.buildWhereConditions', () => {
  test('none → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new CredentialTemplateRepository(db as any).findMany();
    expect(hasWhere(db)).toBe(false);
  });

  test('org + type + status + q build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'ct-1' }]] });
    await new CredentialTemplateRepository(db as any).findMany({
      organizationId: 'org-1', type: 'membership', status: 'active', q: 'card',
    });
    expect(hasWhere(db)).toBe(true);
  });
});

describe('DigitalCredentialRepository.buildWhereConditions', () => {
  test('none → no where', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    await new DigitalCredentialRepository(db as any).findMany();
    expect(hasWhere(db)).toBe(false);
  });

  test('org + person + template + status + q build conditions', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'dc-1' }]] });
    await new DigitalCredentialRepository(db as any).findMany({
      organizationId: 'org-1', personId: 'p-1', templateId: 'ct-1', status: 'active', q: 'CRED-1',
    });
    expect(hasWhere(db)).toBe(true);
  });
});

describe('DigitalCredentialRepository.findByQrPayload', () => {
  test('returns credential when token matches', async () => {
    const db = makeFakeDb({ selectResults: [[{ id: 'dc-1', qrPayload: 'tok' }]] });
    expect(await new DigitalCredentialRepository(db as any).findByQrPayload('tok')).toMatchObject({ id: 'dc-1' });
  });

  test('returns null when no match', async () => {
    const db = makeFakeDb({ selectResults: [[]] });
    expect(await new DigitalCredentialRepository(db as any).findByQrPayload('nope')).toBeNull();
  });
});
