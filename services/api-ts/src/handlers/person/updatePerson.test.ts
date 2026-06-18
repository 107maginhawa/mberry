import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { updatePerson } from './updatePerson';

describe('updatePerson', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('returns 200 on happy path (owner updating own record)', async () => {
    const person = { id: 'user-1', firstName: 'Test', lastName: 'User' };
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async () => ({ ...person, firstName: 'Updated' }),
    });
    const ctx = makeCtx({ _body: { firstName: 'Updated' } });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'user-1' : '';
    const res = await updatePerson(ctx);
    expect(res.status).toBe(200);
  });

  test('throws ForbiddenError when updating another person', async () => {
    const ctx = makeCtx({ _body: {} });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'other-user' : '';
    await expect(updatePerson(ctx)).rejects.toThrow('You can only update your own profile');
  });

  test('resolves "me" alias to authenticated user id', async () => {
    const person = { id: 'user-1', firstName: 'Test' };
    stubRepo(PersonRepository, {
      findOneById: async (id: string) => (id === 'user-1' ? person : null),
      updateOneById: async () => ({ ...person, firstName: 'Me' }),
    });
    const ctx = makeCtx({ _body: { firstName: 'Me' } });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'me' : '';
    const res = await updatePerson(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when person does not exist', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => null,
    });
    const ctx = makeCtx({ _body: { firstName: 'X' } });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'user-1' : '';
    await expect(updatePerson(ctx)).rejects.toThrow('Person not found');
  });

  test('updates many fields including dateOfBirth and null clears', async () => {
    const person = { id: 'user-1', firstName: 'Test' };
    let captured: any;
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async (_id: string, data: any) => { captured = data; return { ...person, ...data }; },
    });
    const ctx = makeCtx({
      _body: {
        firstName: 'A',
        lastName: 'B',
        middleName: 'C',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        contactInfo: { phone: '123' },
        primaryAddress: { city: 'Manila' },
        avatar: 'img.png',
        languagesSpoken: ['en'],
        timezone: 'Asia/Manila',
        licenseNumber: 'L1',
        specialization: 'Endo',
        prcId: 'PRC1',
        bio: null,
        preferredLanguage: 'en',
      },
    });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'user-1' : '';
    const res = await updatePerson(ctx);
    expect(res.status).toBe(200);
    expect(captured.dateOfBirth instanceof Date).toBe(true);
    expect(captured.bio).toBe(null);
    expect(captured.firstName).toBe('A');
  });

  test('clears dateOfBirth when explicitly null', async () => {
    const person = { id: 'user-1' };
    let captured: any;
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async (_id: string, data: any) => { captured = data; return { ...person, ...data }; },
    });
    const ctx = makeCtx({ _body: { dateOfBirth: null } });
    (ctx as any).req.param = (key: string) => key === 'person' ? 'user-1' : '';
    const res = await updatePerson(ctx);
    expect(res.status).toBe(200);
    expect(captured.dateOfBirth).toBe(null);
  });
});
