import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';

import { getCertificate } from './getCertificate';
import { DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';

const OWNER_ID = 'person-1';
const CERT_ID = 'cert-abc';

const FAKE_CERT = {
  id: CERT_ID,
  personId: OWNER_ID,
  organizationId: 'org-1',
  trainingId: 'training-xyz',
  certificateNumber: 'CERT-2026-000001',
  issuedAt: new Date('2026-05-01'),
};

function makeCtx(overrides: {
  session?: any;
  certificateId?: string;
} = {}) {
  const session =
    'session' in overrides ? overrides.session : { user: { id: OWNER_ID } };
  return {
    get: (key: string) => {
      const store: Record<string, unknown> = {
        session,
        database: {},
        logger: { info: () => {}, error: () => {} },
      };
      return store[key];
    },
    req: {
      valid: (_what: 'param') => ({ certificateId: overrides.certificateId ?? CERT_ID }),
    },
    json: (data: unknown, status?: number) =>
      new Response(JSON.stringify(data), { status: status ?? 200 }),
  } as never;
}

describe('getCertificate', () => {
  let findOneById: ReturnType<typeof mock>;

  beforeEach(() => {
    findOneById = mock(async (_id: string) => FAKE_CERT);
    DigitalCredentialRepository.prototype.findOneById = findOneById as never;
  });

  test('returns 200 with cert body for the owner', async () => {
    const res = await getCertificate(makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(CERT_ID);
    expect(body.certificateNumber).toBe('CERT-2026-000001');
    expect(findOneById).toHaveBeenCalledWith(CERT_ID);
  });

  test('throws UnauthorizedError when session is missing', async () => {
    await expect(getCertificate(makeCtx({ session: null }))).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  test('throws NotFoundError when certificate does not exist', async () => {
    DigitalCredentialRepository.prototype.findOneById = mock(async () => null) as never;
    await expect(getCertificate(makeCtx({ certificateId: 'missing' }))).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  test('throws ForbiddenError when requester is not the owner', async () => {
    DigitalCredentialRepository.prototype.findOneById = mock(async () => ({
      ...FAKE_CERT,
      personId: 'different-person',
    })) as never;
    await expect(getCertificate(makeCtx())).rejects.toBeInstanceOf(ForbiddenError);
  });
});
