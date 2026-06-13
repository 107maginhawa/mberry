import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { CredentialTemplateRepository, DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';
import { ensureMemberCardCredential } from './ensure-member-card-credential';

const PERSON = 'person-1';
const ORG = 'org-1';
const MEMBERSHIP = 'mem-1';
const TEMPLATE = { id: 'tmpl-1', organizationId: ORG, type: 'memberCard', status: 'active', name: 'Member Card' };

let createdTemplates: any[] = [];
let createdCreds: any[] = [];
let updatedCreds: any[] = [];

function baseStubs(opts: { template?: any; existingCred?: any }) {
  createdTemplates = [];
  createdCreds = [];
  updatedCreds = [];
  stubRepo(CredentialTemplateRepository, {
    findOne: async () => opts.template ?? null,
    createOne: async (row: any) => { const t = { id: 'tmpl-new', ...row }; createdTemplates.push(t); return t; },
  });
  stubRepo(DigitalCredentialRepository, {
    findOne: async () => opts.existingCred ?? null,
    createOne: async (row: any) => { const c = { id: 'cred-new', ...row }; createdCreds.push(c); return c; },
    updateOneById: async (id: string, patch: any) => { const u = { id, ...patch }; updatedCreds.push(u); return u; },
  });
}

beforeEach(() => {
  restoreRepo(CredentialTemplateRepository);
  restoreRepo(DigitalCredentialRepository);
});
afterEach(() => {
  restoreRepo(CredentialTemplateRepository);
  restoreRepo(DigitalCredentialRepository);
});

describe('ensureMemberCardCredential', () => {
  test('returns the existing credential number without creating a new one', async () => {
    baseStubs({ template: TEMPLATE, existingCred: { id: 'cred-x', credentialNumber: 'MC-EXISTING', status: 'active' } });
    const num = await ensureMemberCardCredential({} as any, undefined, { personId: PERSON, orgId: ORG, membershipId: MEMBERSHIP });
    expect(num).toBe('MC-EXISTING');
    expect(createdCreds).toHaveLength(0);
    expect(createdTemplates).toHaveLength(0);
  });

  test('creates a credential (reusing the existing memberCard template) and returns its number', async () => {
    baseStubs({ template: TEMPLATE, existingCred: null });
    const num = await ensureMemberCardCredential({} as any, undefined, { personId: PERSON, orgId: ORG, membershipId: MEMBERSHIP });
    expect(num).toBeTruthy();
    expect(createdTemplates).toHaveLength(0); // template reused
    expect(createdCreds).toHaveLength(1);
    expect(createdCreds[0].personId).toBe(PERSON);
    expect(createdCreds[0].organizationId).toBe(ORG);
    expect(createdCreds[0].templateId).toBe(TEMPLATE.id);
    expect(createdCreds[0].membershipId).toBe(MEMBERSHIP);
    expect(createdCreds[0].credentialNumber).toBe(num);
    // a verification token is written to the new credential
    expect(updatedCreds).toHaveLength(1);
    expect(updatedCreds[0].qrPayload).toContain('.'); // base64url.base64url token
  });

  test('auto-provisions a memberCard template when the org has none', async () => {
    baseStubs({ template: null, existingCred: null });
    const num = await ensureMemberCardCredential({} as any, undefined, { personId: PERSON, orgId: ORG, membershipId: MEMBERSHIP });
    expect(num).toBeTruthy();
    expect(createdTemplates).toHaveLength(1);
    expect(createdTemplates[0].organizationId).toBe(ORG);
    expect(createdTemplates[0].type).toBe('memberCard');
    expect(createdCreds[0].templateId).toBe('tmpl-new');
  });

  test('best-effort: returns null (never throws) when issuance fails', async () => {
    stubRepo(CredentialTemplateRepository, { findOne: async () => { throw new Error('db down'); } });
    stubRepo(DigitalCredentialRepository, {});
    const num = await ensureMemberCardCredential({} as any, undefined, { personId: PERSON, orgId: ORG, membershipId: MEMBERSHIP });
    expect(num).toBeNull();
  });
});
