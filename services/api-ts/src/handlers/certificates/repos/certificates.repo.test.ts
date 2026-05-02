import { describe, test, expect } from 'bun:test';
import { CertificatesRepository } from './certificates.repo';

function makeDb(rows: any[] = []) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rows),
    then: (resolve: any) => Promise.resolve(rows).then(resolve),
    [Symbol.iterator]: () => rows[Symbol.iterator](),
  };
  return {
    select: () => chain,
    insert: () => ({ values: () => ({ returning: () => Promise.resolve(rows) }) }),
  } as any;
}

function makeCert(overrides: Record<string, any> = {}) {
  return {
    id: 'cert-1',
    organizationId: 'org-1',
    personId: 'person-1',
    trainingId: 'training-1',
    certificateNumber: 'CERT-2026-001',
    issuedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('CertificatesRepository', () => {
  describe('get', () => {
    test('returns certificate by id', async () => {
      const cert = makeCert();
      const repo = new CertificatesRepository(makeDb([cert]));
      const result = await repo.get('cert-1');
      expect(result).toEqual(cert);
    });

    test('returns undefined when not found', async () => {
      const repo = new CertificatesRepository(makeDb([]));
      const result = await repo.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('listByPerson', () => {
    test('returns certificates for person', async () => {
      const certs = [makeCert(), makeCert({ id: 'cert-2', certificateNumber: 'CERT-2026-002' })];
      const repo = new CertificatesRepository(makeDb(certs));
      const result = await repo.listByPerson('person-1');
      expect(result).toHaveLength(2);
    });

    test('returns empty array when none', async () => {
      const repo = new CertificatesRepository(makeDb([]));
      const result = await repo.listByPerson('person-1');
      expect(result).toEqual([]);
    });
  });
});
