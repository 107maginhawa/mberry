import { describe, test, expect, mock } from 'bun:test';
import { getNextCertificateNumber } from './certificate-numbering';

function buildMockDb(existingRows: any[] = []) {
  const updateSpy = mock(() => Promise.resolve());
  return { db: { execute: mock(() => Promise.resolve({ rows: existingRows })), update: (_t: any) => ({ set: (_v: any) => ({ where: (_c: any) => { updateSpy(); return Promise.resolve(); } }) }), insert: (_t: any) => ({ values: (_v: any) => Promise.resolve() }) }, updateSpy };
}

describe('getNextCertificateNumber', () => {
  test('first cert', async () => { const { db } = buildMockDb([]); expect((await getNextCertificateNumber(db as any, 'org-1', 'PDA', 2026)).certificateNumber).toBe('PDA-2026-0001'); });
  test('increments', async () => { const { db, updateSpy } = buildMockDb([{ id: 's', last_seq: 5 }]); expect((await getNextCertificateNumber(db as any, 'org-1', 'PDA', 2026)).certificateNumber).toBe('PDA-2026-0006'); expect(updateSpy).toHaveBeenCalledTimes(1); });
  test('pads', async () => { const { db } = buildMockDb([{ id: 's', last_seq: 99 }]); expect((await getNextCertificateNumber(db as any, 'org-1', 'PDA', 2026)).certificateNumber).toBe('PDA-2026-0100'); });
  test('current year', async () => { const { db } = buildMockDb([]); expect((await getNextCertificateNumber(db as any, 'org-1', 'PDA')).certificateNumber).toContain(String(new Date().getFullYear())); });
});
