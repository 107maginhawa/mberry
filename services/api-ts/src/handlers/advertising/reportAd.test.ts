/**
 * Tests for reportAd handler
 * Slice 046: Advertising Campaigns (M16)
 * M16-R5: persist each report, auto-pause the CREATIVE after threshold (AHA FIX-009 / G-03)
 *
 * RED-first notes — the previous version of this test blessed the broken
 * behavior:
 *  - reports were "simulated" (never persisted),
 *  - the threshold was 5 (spec m16 §4 = 3),
 *  - there was no rolling window,
 *  - it paused the CAMPAIGN instead of the CREATIVE.
 * These tests require: a persisted report row, threshold 3 over a 7-day window,
 * a creative-level pause (campaign untouched), and an admin notification.
 */

import { describe, test, expect, mock, beforeEach, afterAll } from 'bun:test';
import { reportAd } from './reportAd';
import { CreativeRepository } from './repos/creative.repo';
import { CampaignRepository } from './repos/campaign.repo';
import { NotificationRepository } from '../notifs/repos/notification.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { Creative } from './repos/advertising.schema';

// Preserve the real prototype methods so our prototype-level mocks (necessary
// for unit-isolating the handler) do not leak into other suites that exercise
// the real NotificationRepository (single-process bun test run).
const realCreateNotificationForModule = NotificationRepository.prototype.createNotificationForModule;
afterAll(() => {
  NotificationRepository.prototype.createNotificationForModule = realCreateNotificationForModule;
});

function makeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: 'cre-1', organizationId: 'org-1', campaignId: 'camp-1',
    title: 'Buy Now', bodyText: 'Great deals', status: 'approved',
    sponsoredLabel: true, reviewedBy: 'admin-1', reviewedAt: new Date(),
    rejectionReason: null, imageUrl: null, clickUrl: 'https://example.com',
    createdAt: new Date(), updatedAt: new Date(),
    createdBy: 'staff-1', updatedBy: 'staff-1', version: 1,
    ...overrides,
  } as unknown as Creative;
}

function makeCtx(opts: { userId?: string; body?: Record<string, any>; params?: Record<string, any> } = {}) {
  const userId = opts.userId ?? 'user-1';
  const body = opts.body ?? {};
  const params = opts.params ?? {};
  const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => logger };
  let captured: { data: any; status: number } = { data: null, status: 0 };
  const ctx = {
    get: (key: string) => ({ user: userId ? { id: userId, name: 'Test User' } : null, database: {}, logger, organizationId: 'org-1', requestId: 'trace-1' })[key],
    req: { valid: (type: string) => type === 'json' ? body : type === 'param' ? params : {} },
    json: (data: any, status: number) => { captured = { data, status }; return new Response(JSON.stringify(data), { status }); },
    _captured: () => captured,
  };
  return ctx as any;
}

function makeNoUserCtx(opts: Record<string, any> = {}) {
  const ctx = makeCtx({ ...opts, userId: 'placeholder' });
  const origGet = ctx.get;
  ctx.get = (key: string) => key === 'user' ? { id: '', name: '' } : origGet(key);
  return ctx;
}

describe('reportAd', () => {
  let createReport: ReturnType<typeof mock>;
  let pauseCreative: ReturnType<typeof mock>;
  let pauseCampaign: ReturnType<typeof mock>;
  let notify: ReturnType<typeof mock>;

  beforeEach(() => {
    CreativeRepository.prototype.findOneById = mock(async () => makeCreative()) as any;
    createReport = mock(async () => ({ id: 'rep-1' }));
    CreativeRepository.prototype.createReport = createReport as any;
    CreativeRepository.prototype.countReportsWithinDays = mock(async () => 1) as any;
    pauseCreative = mock(async () => makeCreative({ status: 'pending' }));
    CreativeRepository.prototype.pauseCreative = pauseCreative as any;
    pauseCampaign = mock(async () => ({}));
    CampaignRepository.prototype.pauseCampaign = pauseCampaign as any;
    notify = mock(async () => ({ id: 'notif-1' }));
    NotificationRepository.prototype.createNotificationForModule = notify as any;
  });

  test('throws ValidationError without valid user', async () => {
    const ctx = makeNoUserCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Inappropriate' } });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws NotFoundError when creative does not exist', async () => {
    CreativeRepository.prototype.findOneById = mock(async () => null) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-999' }, body: { reason: 'X' } });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ValidationError when reason is missing', async () => {
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: {} });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects a cross-org report (creative belongs to another org) — no report persisted', async () => {
    // ctx org is org-1 but the creative lives in another org
    CreativeRepository.prototype.findOneById = mock(async () => makeCreative({ organizationId: 'org-OTHER' })) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'cross-org poison' } });
    await expect(reportAd(ctx)).rejects.toBeInstanceOf(NotFoundError);
    expect(createReport).not.toHaveBeenCalled();
  });

  test('PERSISTS the report and returns the windowed count', async () => {
    CreativeRepository.prototype.countReportsWithinDays = mock(async () => 1) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Misleading ad' } });
    await reportAd(ctx);
    const { status, data } = ctx._captured();
    expect(status).toBe(200);
    // Report row persisted — not simulated
    expect(createReport).toHaveBeenCalledTimes(1);
    const arg = createReport.mock.calls[0][0];
    expect(arg.creativeId).toBe('cre-1');
    expect(arg.reporterPersonId).toBe('user-1');
    expect(arg.reason).toBe('Misleading ad');
    expect(data.reportCount).toBe(1);
    expect(data.autoPaused).toBe(false);
  });

  test('M16-R5: at 3 reports within 7 days, pauses the CREATIVE (not the campaign) + notifies admin', async () => {
    CreativeRepository.prototype.countReportsWithinDays = mock(async () => 3) as any; // threshold = 3
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Bad content' } });
    await reportAd(ctx);
    const { data } = ctx._captured();
    expect(data.autoPaused).toBe(true);
    expect(pauseCreative).toHaveBeenCalledTimes(1);
    expect(pauseCreative.mock.calls[0][0]).toBe('cre-1');
    // Creative-level only — the campaign must NOT be paused
    expect(pauseCampaign).not.toHaveBeenCalled();
    // Admin notification fired
    expect(notify).toHaveBeenCalledTimes(1);
  });

  test('M16-R5: below threshold (2 in window) does NOT pause', async () => {
    CreativeRepository.prototype.countReportsWithinDays = mock(async () => 2) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'Bad content' } });
    await reportAd(ctx);
    const { data } = ctx._captured();
    expect(data.autoPaused).toBe(false);
    expect(pauseCreative).not.toHaveBeenCalled();
    expect(pauseCampaign).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  test('M16-R5: 7-day rolling window — older reports outside the window do NOT trigger a pause', async () => {
    // 3 reports total but only 2 fall within the 7-day window → no pause.
    CreativeRepository.prototype.countReportsWithinDays = mock(async () => 2) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'stale' } });
    await reportAd(ctx);
    const { data } = ctx._captured();
    expect(data.autoPaused).toBe(false);
    expect(pauseCreative).not.toHaveBeenCalled();
  });

  test('M16-R5: does NOT re-pause a creative that is not currently serving (already pending)', async () => {
    CreativeRepository.prototype.findOneById = mock(async () => makeCreative({ status: 'pending' })) as any;
    CreativeRepository.prototype.countReportsWithinDays = mock(async () => 5) as any;
    const ctx = makeCtx({ params: { creativeId: 'cre-1' }, body: { reason: 'pile-on' } });
    await reportAd(ctx);
    const { data } = ctx._captured();
    // report still recorded (m16 §4: "Ad already paused — report still recorded")
    expect(createReport).toHaveBeenCalledTimes(1);
    expect(data.autoPaused).toBe(false);
    expect(pauseCreative).not.toHaveBeenCalled();
  });
});
