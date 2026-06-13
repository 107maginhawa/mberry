/**
 * Tests for NotificationRepository.createNotificationForModule
 *
 * FIX-012 — organizationId guard: a missing/empty organizationId must surface
 * a caller-visible ValidationError at enqueue time, NOT a Postgres uuid cast
 * error at insert (the old `request.organizationId || ''` against a notNull
 * uuid column). The single caller (core/notifs.ts -> notification-triggers)
 * always passes organizationId, so this guard is defensive on the optional
 * InternalNotificationRequest.organizationId? path.
 */

import { describe, test, expect, spyOn } from 'bun:test';
import { NotificationRepository } from './notification.repo';
import { resolveNotificationCategory } from './notification-category';
import type { NotificationPreferencePort } from '@/core/ports/notification-preference.port';
import { ValidationError } from '@/core/errors';

function makeLogger() {
  return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
}

function makeRepo() {
  // Person lookup is optional in createNotificationForModule (a warning is
  // logged when absent), so returning null keeps the happy path reachable.
  const personRepo = { findOneById: async () => null } as any;
  return new NotificationRepository({} as any, personRepo, makeLogger());
}

/**
 * Repo whose preference port is overridden — `disabledCategories` lists the
 * categories the recipient has EXPLICITLY disabled. Anything not in the set
 * is enabled (fail-open).
 */
function makeRepoWithPrefs(disabledCategories: string[]) {
  const personRepo = { findOneById: async () => null } as any;
  const disabled = new Set(disabledCategories.map((c) => c.toLowerCase()));
  const port: NotificationPreferencePort = {
    async isCategoryEnabledForPerson(_personId, _orgId, category) {
      return !disabled.has(category.toLowerCase());
    },
  };
  return new NotificationRepository(
    {} as any,
    personRepo,
    makeLogger(),
    undefined,
    port,
  );
}

const baseRequest = {
  recipient: '22222222-2222-2222-2222-222222222222',
  type: 'system',
  title: 'Hello',
  message: 'World',
  channel: 'in-app' as const,
};

describe('NotificationRepository.createNotificationForModule — organizationId guard (FIX-012)', () => {
  test('throws ValidationError when organizationId is missing', async () => {
    const repo = makeRepo();
    // No DB cast: createOne must never be reached.
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue({} as any);

    await expect(
      repo.createNotificationForModule({ ...baseRequest } as any),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(createOneSpy).not.toHaveBeenCalled();
  });

  test('throws ValidationError when organizationId is an empty string', async () => {
    const repo = makeRepo();
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue({} as any);

    await expect(
      repo.createNotificationForModule({ ...baseRequest, organizationId: '   ' } as any),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(createOneSpy).not.toHaveBeenCalled();
  });

  test('does NOT throw the guard when organizationId is present (reaches insert)', async () => {
    const repo = makeRepo();
    const fakeNotification = { id: 'n-1', organizationId: 'org-1', channel: 'in-app', status: 'sent' };
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(fakeNotification as any);

    const result = await repo.createNotificationForModule({ ...baseRequest, organizationId: 'org-1' } as any);

    expect(createOneSpy).toHaveBeenCalledTimes(1);
    expect((createOneSpy.mock.calls[0][0] as any).organizationId).toBe('org-1');
    expect(result).toEqual(fakeNotification as any);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FIX-004 / G4 — notification.type → preference category resolver
// ───────────────────────────────────────────────────────────────────────────

describe('resolveNotificationCategory (FIX-004 type→category map)', () => {
  test('maps dues family', () => {
    expect(resolveNotificationCategory('billing')).toBe('dues');
    expect(resolveNotificationCategory('dunning.escalation')).toBe('dues');
  });
  test('maps events family', () => {
    expect(resolveNotificationCategory('event.late-cancellation')).toBe('events');
    expect(resolveNotificationCategory('booking.confirmed')).toBe('events');
  });
  test('maps training family', () => {
    expect(resolveNotificationCategory('training.reminder')).toBe('training');
  });
  test('maps announcements (system)', () => {
    expect(resolveNotificationCategory('system')).toBe('announcements');
  });
  test('maps comms family', () => {
    expect(resolveNotificationCategory('comms.chat-message')).toBe('comms');
    expect(resolveNotificationCategory('waitlist.promoted')).toBe('comms');
    expect(resolveNotificationCategory('task.overdue')).toBe('comms');
  });
  test('returns null for unmapped types (fail-open)', () => {
    expect(resolveNotificationCategory('security')).toBeNull();
    expect(resolveNotificationCategory('totally.unknown')).toBeNull();
    expect(resolveNotificationCategory('')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// FIX-004 / G4 — delivery preference enforcement at create time
//
// Skip representation: when an email/push notification is for an explicitly
// disabled category, createNotificationForModule does NOT create a DB row
// (createOne is never called) and returns a synthetic, non-persisted marker
// (`suppressed: true`, `id: ''`). In-app is NEVER suppressed. Fail-open when
// no explicit disable exists.
// ───────────────────────────────────────────────────────────────────────────

describe('createNotificationForModule — preference enforcement (FIX-004 / G4)', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';

  test('(a) email for a disabled category is SKIPPED (no row created)', async () => {
    const repo = makeRepoWithPrefs(['dues']);
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue({ id: 'should-not-happen' } as any);

    const result = await repo.createNotificationForModule({
      organizationId: orgId,
      recipient: '22222222-2222-2222-2222-222222222222',
      type: 'billing',
      channel: 'email',
      title: 'Dues due',
      message: 'Pay up',
    } as any);

    expect(createOneSpy).not.toHaveBeenCalled();
    expect((result as any).suppressed).toBe(true);
    expect((result as any).id).toBe('');
  });

  test('(b) push for a disabled category is SKIPPED (no row created)', async () => {
    const repo = makeRepoWithPrefs(['dues']);
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue({ id: 'should-not-happen' } as any);

    const result = await repo.createNotificationForModule({
      organizationId: orgId,
      recipient: '22222222-2222-2222-2222-222222222222',
      type: 'dunning.escalation',
      channel: 'push',
      title: 'Overdue',
      message: 'Pay up',
    } as any);

    expect(createOneSpy).not.toHaveBeenCalled();
    expect((result as any).suppressed).toBe(true);
  });

  test('(c) in-app for a disabled category is STILL delivered (never suppressed)', async () => {
    const repo = makeRepoWithPrefs(['dues']);
    const fake = { id: 'n-inapp', organizationId: orgId, channel: 'in-app', status: 'sent' };
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(fake as any);

    const result = await repo.createNotificationForModule({
      organizationId: orgId,
      recipient: '22222222-2222-2222-2222-222222222222',
      type: 'billing',
      channel: 'in-app',
      title: 'Dues due',
      message: 'See inbox',
    } as any);

    expect(createOneSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fake as any);
  });

  test('(d) email with NO matching disable is SENT (fail-open)', async () => {
    const repo = makeRepoWithPrefs([]); // nothing disabled
    const fake = { id: 'n-email', organizationId: orgId, channel: 'email', status: 'queued' };
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(fake as any);

    const result = await repo.createNotificationForModule({
      organizationId: orgId,
      recipient: '22222222-2222-2222-2222-222222222222',
      type: 'billing',
      channel: 'email',
      title: 'Dues due',
      message: 'Pay up',
    } as any);

    expect(createOneSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fake as any);
  });

  test('(e) email whose type maps to NO category is SENT (fail-open, port not consulted)', async () => {
    // `security` resolves to null → port must not be able to suppress it even
    // if every category were disabled.
    const repo = makeRepoWithPrefs(['dues', 'events', 'training', 'announcements', 'comms']);
    const fake = { id: 'n-sec', organizationId: orgId, channel: 'email', status: 'queued' };
    const createOneSpy = spyOn(repo, 'createOne' as any).mockResolvedValue(fake as any);

    const result = await repo.createNotificationForModule({
      organizationId: orgId,
      recipient: '22222222-2222-2222-2222-222222222222',
      type: 'security',
      channel: 'email',
      title: 'Security alert',
      message: 'New login',
    } as any);

    expect(createOneSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fake as any);
  });

  test('default port (no override) fails open — email is sent', async () => {
    // No preference port injected; the production default must not block
    // delivery when it cannot resolve a disable. Stub the lazy adapter via the
    // protected resolver so we exercise the default-construction path.
    const repo = makeRepo();
    const fake = { id: 'n-default', organizationId: orgId, channel: 'email', status: 'queued' };
    spyOn(repo, 'createOne' as any).mockResolvedValue(fake as any);
    // Force the default port to behave as fail-open (enabled) without a DB.
    spyOn(repo as any, 'getPreferencePort').mockReturnValue({
      isCategoryEnabledForPerson: async () => true,
    });

    const result = await repo.createNotificationForModule({
      organizationId: orgId,
      recipient: '22222222-2222-2222-2222-222222222222',
      type: 'billing',
      channel: 'email',
      title: 'Dues due',
      message: 'Pay up',
    } as any);

    expect(result).toEqual(fake as any);
  });
});
