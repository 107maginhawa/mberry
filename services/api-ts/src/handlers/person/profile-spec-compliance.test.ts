/**
 * Profile Spec Compliance Tests — AC-M02-001 thru AC-M02-005
 *
 * Covers acceptance criteria from MODULE_SPEC M02:
 *  AC-M02-001: Photo upload (avatar via updateMyProfile)
 *  AC-M02-002: Privacy toggle per-org (getMyPrivacySettings + updateMyPrivacySettings)
 *  AC-M02-004: QR verification returns real-time status
 *  AC-M02-005: Multi-org membership display with independent statuses
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PersonRepository } from './repos/person.repo';
import { updateMyProfile } from './updateMyProfile';
import { getMyPrivacySettings } from './getMyPrivacySettings';
import { updateMyPrivacySettings } from './updateMyPrivacySettings';
import { getMyNotificationPreferences } from './getMyNotificationPreferences';
import { updateMyNotificationPreferences } from './updateMyNotificationPreferences';
import { getMyMemberships } from './getMyMemberships';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// ---------------------------------------------------------------------------
// AC-M02-001: Photo Upload
// Given a member uploads a 3MB JPEG and crops to square,
// When saved,
// Then photo appears on profile, ID card, and directory within 1 minute.
//
// NOTE (FIX-005 / G-05): `avatar` is NOT a field of PersonMeUpdateRequest, so
// the generated validator strips it before it reaches updateMyProfile. Avatar
// persistence happens on the full-profile path (updatePerson) / onboarding, not
// on PATCH /persons/me. The original tests here asserted a dead mapping (the
// handler used to map a field the validator removes) — fake-green. These tests
// now assert the REAL contract: updateMyProfile does not write avatar, and the
// contract field path still works.
// ---------------------------------------------------------------------------
describe('AC-M02-001: Photo Upload (updateMyProfile contract boundary)', () => {
  beforeEach(() => { restoreRepo(PersonRepository); });
  afterEach(() => { restoreRepo(PersonRepository); });

  test('updateMyProfile does NOT persist avatar (not a /persons/me contract field)', async () => {
    const person = { id: 'user-1', firstName: 'Test', avatar: null };
    let capturedUpdate: any = null;
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...person, ...data };
      },
    });
    // A raw body carrying avatar (validator would strip it). The handler must
    // not map it — avatar belongs to the full-profile / onboarding path.
    const ctx = makeCtx({ _body: { avatar: { fileId: 'file-abc', url: 'https://cdn.example.com/photo.jpg' } } });
    const res = await updateMyProfile(ctx);
    expect(res.status).toBe(200);
    expect(capturedUpdate).not.toHaveProperty('avatar');
  });

  test('updateMyProfile persists a real contract field (firstName) and ignores avatar', async () => {
    const person = { id: 'user-1', firstName: 'Test', lastName: 'User', avatar: null };
    let capturedUpdate: any = null;
    stubRepo(PersonRepository, {
      findOneById: async () => person,
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...person, ...data };
      },
    });
    const ctx = makeCtx({ _body: { avatar: { fileId: 'f1' }, firstName: 'NewName' } });
    const res = await updateMyProfile(ctx);
    expect(res.status).toBe(200);
    expect(capturedUpdate.firstName).toBe('NewName');
    expect(capturedUpdate).not.toHaveProperty('avatar');
  });

  test('updateMyProfile returns 404 when person not found', async () => {
    stubRepo(PersonRepository, {
      findOneById: async () => null,
      updateOneById: async () => null,
    });
    const ctx = makeCtx({ _body: { firstName: 'X' } });
    await expect(updateMyProfile(ctx)).rejects.toThrow('Person not found');
  });
});

// ---------------------------------------------------------------------------
// AC-M02-002: Privacy Toggle
// Given a member toggles email visibility to visible,
// When another member searches the directory,
// Then the email is visible within 1 minute.
// ---------------------------------------------------------------------------
describe('AC-M02-002: Privacy Toggle', () => {
  test('getMyPrivacySettings returns defaults when no row exists (no orgId)', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _query: {} });
    const res = await getMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body).toEqual([]);
  });

  test('getMyPrivacySettings returns defaults for specific org when no row', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _query: { orgId: 'org-1' } });
    const res = await getMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    // Should return sensible defaults per M02-C2.3
    expect(body.emailVisible).toBe(false);
    expect(body.phoneVisible).toBe(false);
    expect(body.photoVisible).toBe(true);
    expect(body.addressVisible).toBe(false);
  });

  test('getMyPrivacySettings returns stored row when exists for org', async () => {
    const storedRow = {
      id: 'ps-1',
      personId: 'user-1',
      organizationId: 'org-1',
      emailVisible: true,
      phoneVisible: false,
      photoVisible: true,
      addressVisible: false,
    };
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [storedRow],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _query: { orgId: 'org-1' } });
    const res = await getMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.emailVisible).toBe(true);
  });

  test('updateMyPrivacySettings toggles emailVisible to true', async () => {
    let selectCallCount = 0;
    const insertedRow = { id: 'ps-new', personId: 'user-1', organizationId: 'org-1', emailVisible: true, phoneVisible: false, photoVisible: true, addressVisible: false };
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCallCount++;
              if (selectCallCount === 1) return [{ id: 'mem-1' }]; // membership check
              return []; // no existing privacy row
            },
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => [insertedRow],
        }),
      }),
    };
    // FIX-001 (G-01): contract field is `orgId`, not `organizationId`.
    const ctx = makeCtx({ database: mockDb, _body: { orgId: 'org-1', emailVisible: true } });
    const res = await updateMyPrivacySettings(ctx);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body.emailVisible).toBe(true);
  });

  test('updateMyPrivacySettings updates existing row (200)', async () => {
    let selectCallCount = 0;
    const updatedRow = { id: 'ps-1', personId: 'user-1', organizationId: 'org-1', emailVisible: false, phoneVisible: true, photoVisible: true, addressVisible: false };
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCallCount++;
              if (selectCallCount === 1) return [{ id: 'mem-1' }]; // membership
              return [{ id: 'ps-1', emailVisible: true, phoneVisible: false, photoVisible: true, addressVisible: false }]; // existing privacy row
            },
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [updatedRow],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _body: { orgId: 'org-1', phoneVisible: true, emailVisible: false } });
    const res = await updateMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
  });

  test('updateMyPrivacySettings rejects non-member (ForbiddenError)', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _body: { orgId: 'org-1', emailVisible: true } });
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('Not a member of this organization');
  });

  test('updateMyPrivacySettings requires orgId', async () => {
    // FIX-001 (G-01): the contract scope field is `orgId`.
    const ctx = makeCtx({ _body: {} });
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('orgId is required');
  });
});

// ---------------------------------------------------------------------------
// AC-M02-004: QR Verification
// Given a member downloads their ID card PDF,
// When a third party scans the QR code,
// Then the verification page shows current real-time status.
//
// Tests the credential token + verification flow.
// ---------------------------------------------------------------------------
describe('AC-M02-004: QR Verification (credential token)', () => {
  // Import inline to avoid module-level dependency issues
  test('createCredentialToken produces valid token that decodes', async () => {
    const { createCredentialToken, verifyCredentialToken } = await import(
      '@/handlers/association:member/utils/credential-token'
    );
    const secret = 'test-secret-key';
    const token = createCredentialToken('cred-1', 'org-1', secret);
    expect(token).toContain('.');
    const payload = verifyCredentialToken(token, secret);
    expect(payload).not.toBeNull();
    expect(payload!.credentialId).toBe('cred-1');
    expect(payload!.organizationId).toBe('org-1');
  });

  test('verifyCredentialToken rejects tampered token', async () => {
    const { createCredentialToken, verifyCredentialToken } = await import(
      '@/handlers/association:member/utils/credential-token'
    );
    const secret = 'test-secret-key';
    const token = createCredentialToken('cred-1', 'org-1', secret);
    const tampered = token.slice(0, -3) + 'xxx';
    expect(verifyCredentialToken(tampered, secret)).toBeNull();
  });

  test('verifyCredentialToken rejects wrong secret', async () => {
    const { createCredentialToken, verifyCredentialToken } = await import(
      '@/handlers/association:member/utils/credential-token'
    );
    const token = createCredentialToken('cred-1', 'org-1', 'secret-a');
    expect(verifyCredentialToken(token, 'secret-b')).toBeNull();
  });

  test('verifyCredentialToken rejects malformed input', async () => {
    const { verifyCredentialToken } = await import(
      '@/handlers/association:member/utils/credential-token'
    );
    expect(verifyCredentialToken('not-a-valid-token', 'secret')).toBeNull();
    expect(verifyCredentialToken('', 'secret')).toBeNull();
    expect(verifyCredentialToken('a.b.c', 'secret')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-M02-005: Multi-Org Display
// Given a member belongs to 3 orgs with statuses Active, Grace, and Lapsed,
// When viewing /my/profile,
// Then all 3 displayed as separate cards with independent status indicators.
// ---------------------------------------------------------------------------
describe('AC-M02-005: Multi-Org Display', () => {
  test('getMyMemberships returns multiple orgs with independent statuses', async () => {
    const memberships = [
      { id: 'm-1', organizationId: 'org-1', personId: 'user-1', status: 'active', memberNumber: 'M001', orgName: 'Org Alpha' },
      { id: 'm-2', organizationId: 'org-2', personId: 'user-1', status: 'gracePeriod', memberNumber: 'M002', orgName: 'Org Beta' },
      { id: 'm-3', organizationId: 'org-3', personId: 'user-1', status: 'lapsed', memberNumber: 'M003', orgName: 'Org Gamma' },
    ];
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: async () => memberships,
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyMemberships(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.total).toBe(3);
    expect(body.data).toHaveLength(3);

    // Verify independent statuses
    const statuses = body.data.map((d: any) => d.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('gracePeriod');
    expect(statuses).toContain('lapsed');

    // Verify org names enriched
    const orgNames = body.data.map((d: any) => d.orgName);
    expect(orgNames).toContain('Org Alpha');
    expect(orgNames).toContain('Org Beta');
    expect(orgNames).toContain('Org Gamma');

    // Verify orgId alias exists
    body.data.forEach((d: any) => {
      expect(d.orgId).toBe(d.organizationId);
    });
  });

  test('getMyMemberships returns empty list for user with no memberships', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: async () => [],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyMemberships(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.total).toBe(0);
    expect(body.data).toEqual([]);
  });

  test('getMyMemberships rejects unauthenticated user', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getMyMemberships(ctx)).rejects.toThrow('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// Notification Preferences — supplementary coverage for M02 spec compliance
// ---------------------------------------------------------------------------
describe('Notification Preferences (M02 supplementary)', () => {
  test('getMyNotificationPreferences returns all categories with defaults', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyNotificationPreferences(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    // Should return all 5 categories
    expect(body).toHaveLength(5);
    const categories = body.map((b: any) => b.category);
    expect(categories).toContain('dues');
    expect(categories).toContain('events');
    expect(categories).toContain('trainings');
    expect(categories).toContain('announcements');
    expect(categories).toContain('credits');
    // Defaults: push on, email off, inApp always true (M02-R8)
    body.forEach((pref: any) => {
      expect(pref.pushEnabled).toBe(true);
      expect(pref.emailEnabled).toBe(false);
      expect(pref.inApp).toBe(true);
    });
  });

  test('getMyNotificationPreferences merges stored prefs over defaults', async () => {
    const storedRows = [
      { category: 'dues', pushEnabled: false, emailEnabled: true },
    ];
    const mockDb = {
      select: () => ({
        from: () => ({
          where: async () => storedRows,
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyNotificationPreferences(ctx);
    const body = (res as any).body;
    const dues = body.find((b: any) => b.category === 'dues');
    expect(dues.pushEnabled).toBe(false);
    expect(dues.emailEnabled).toBe(true);
    expect(dues.inApp).toBe(true); // always on

    // Other categories still get defaults
    const events = body.find((b: any) => b.category === 'events');
    expect(events.pushEnabled).toBe(true);
    expect(events.emailEnabled).toBe(false);
  });

  test('updateMyNotificationPreferences rejects invalid category', async () => {
    const ctx = makeCtx({ _body: { category: 'nonexistent' } });
    await expect(updateMyNotificationPreferences(ctx)).rejects.toThrow('Invalid category');
  });

  test('updateMyNotificationPreferences updates existing pref (200)', async () => {
    const updatedRow = { id: 'pref-1', category: 'events', pushEnabled: false, emailEnabled: true };
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: 'pref-1', pushEnabled: true, emailEnabled: false }],
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [updatedRow],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _body: { category: 'events', pushEnabled: false, emailEnabled: true } });
    const res = await updateMyNotificationPreferences(ctx);
    expect(res.status).toBe(200);
  });
});
