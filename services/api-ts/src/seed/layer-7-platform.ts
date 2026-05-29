/**
 * Layer 7: Platform admin coverage seeding
 *
 * Seeds FK-coherent, idempotent data for the platformadmin cluster:
 * feature flags, pricing tiers, subscriptions, support tickets + comments,
 * breach incidents, impersonation sessions, and national-dashboard tables
 * (chapter snapshots, export logs, access grants).
 *
 * Idempotent: every insert is guarded by a unique-marker existence check.
 * Each table group runs in its own try/catch — failures log and continue.
 */

import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { daysAgo, daysFromNow } from './helpers';

import {
  featureFlags,
  pricingTiers,
  subscriptions,
  supportTickets,
  ticketComments,
  breachIncidents,
  impersonationSessions,
} from '@/handlers/platformadmin/repos/platform-admin.schema';
import {
  chapterSnapshots,
  dashboardExportLogs,
  nationalDashboardAccess,
} from '@/handlers/platformadmin/repos/dashboard-snapshot.schema';

export async function seedPlatformCoverage(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  associationId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Platform admin coverage (flags, tiers, subscriptions, tickets, security, dashboard)...');

  // ─── pricingTiers (seed first — subscriptions FK to it) ───
  try {
    type NewTier = typeof pricingTiers.$inferInsert;
    const tiers: NewTier[] = [
      {
        name: 'Free',
        slug: 'free',
        monthlyPrice: 0,
        annualPrice: 0,
        currency: 'PHP',
        maxMembers: 50,
        trialDays: 0,
        features: ['membership', 'dues_tracking'],
        isActive: true,
        sortOrder: 0,
        createdBy: presidentPersonId,
        updatedBy: presidentPersonId,
      },
      {
        name: 'Pro',
        slug: 'pro',
        monthlyPrice: 499900,
        annualPrice: 4999900,
        currency: 'PHP',
        maxMembers: 500,
        trialDays: 30,
        features: ['membership', 'dues_tracking', 'events', 'training', 'communications'],
        isActive: true,
        sortOrder: 1,
        createdBy: presidentPersonId,
        updatedBy: presidentPersonId,
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        monthlyPrice: 1999900,
        annualPrice: 19999900,
        currency: 'PHP',
        maxMembers: null, // unlimited
        trialDays: 14,
        features: ['membership', 'dues_tracking', 'events', 'training', 'communications', 'elections', 'national_dashboard', 'sla_support'],
        isActive: true,
        sortOrder: 2,
        createdBy: presidentPersonId,
        updatedBy: presidentPersonId,
      },
    ];
    for (const t of tiers) {
      const existing = (await db.execute(sql`SELECT id FROM pricing_tier WHERE slug = ${t.slug} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(pricingTiers).values(t);
      }
    }
    console.log('    ✓ pricing tiers (Free, Pro, Enterprise)');
  } catch (e) {
    console.log(`    (pricing tier seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── subscriptions (FK → pricingTiers, org) ───
  try {
    const existing = (await db.execute(sql`SELECT id FROM subscription WHERE organization_id = ${orgId} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
    if (existing.rows?.length === 0) {
      const proTier = (await db.execute(sql`SELECT id FROM pricing_tier WHERE slug = 'pro' LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
      const tierId = proTier.rows?.[0]?.id;
      if (tierId) {
        await db.insert(subscriptions).values({
          organizationId: orgId,
          pricingTierId: tierId,
          status: 'active',
          billingCycle: 'annual',
          currentPeriodStart: daysAgo(60),
          currentPeriodEnd: daysFromNow(305),
          trialEndsAt: daysAgo(30),
          stripeSubscriptionId: 'sub_seed_pro_001',
          stripeCustomerId: 'cus_seed_001',
          lastStripeEventId: 'evt_seed_001',
          createdBy: presidentPersonId,
          updatedBy: presidentPersonId,
        });
      }
    }
    console.log('    ✓ subscription (active / annual / Pro tier)');
  } catch (e) {
    console.log(`    (subscription seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── featureFlags (~6, mix enabled/override, multiple targets) ───
  try {
    type NewFlag = typeof featureFlags.$inferInsert;
    const flags: NewFlag[] = [
      { targetType: 'org', targetId: orgId, moduleName: 'feed.enabled', enabled: true, isOverride: false },
      { targetType: 'org', targetId: orgId, moduleName: 'marketplace.beta', enabled: false, isOverride: true },
      { targetType: 'org', targetId: orgId, moduleName: 'elections.online_voting', enabled: true, isOverride: false },
      { targetType: 'association', targetId: associationId, moduleName: 'national_dashboard', enabled: true, isOverride: false },
      { targetType: 'association', targetId: associationId, moduleName: 'communications.bulk_email', enabled: false, isOverride: false },
      { targetType: 'tier', targetId: 'pro', moduleName: 'training.cpd_tracking', enabled: true, isOverride: false },
    ];
    for (const f of flags) {
      const existing = (await db.execute(sql`SELECT id FROM feature_flag WHERE target_type = ${f.targetType} AND target_id = ${f.targetId} AND module_name = ${f.moduleName} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(featureFlags).values(f);
      }
    }
    console.log('    ✓ 6 feature flags (org / association / tier targets)');
  } catch (e) {
    console.log(`    (feature flag seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── supportTickets + ticketComments (status + priority + category spread) ───
  try {
    type NewTicket = typeof supportTickets.$inferInsert;
    const tickets: Array<NewTicket & { _marker: string; _comments: Array<{ content: string; internal: boolean; author: string }> }> = [
      {
        _marker: 'SEED-TICKET-001',
        organizationId: orgId,
        reportedBy: memberPersonIds[0]!,
        assignedTo: presidentPersonId,
        subject: '[SEED-TICKET-001] Cannot pay dues via GCash',
        description: 'Payment fails at the GCash redirect step with a gateway error.',
        category: 'billing',
        priority: 'high',
        status: 'in_progress',
        slaFirstResponseDeadline: daysAgo(2),
        slaResolutionDeadline: daysFromNow(1),
        firstRespondedAt: daysAgo(2),
        createdBy: memberPersonIds[0]!,
        updatedBy: presidentPersonId,
        _comments: [
          { content: 'Thanks for reporting — we are escalating to the payments team.', internal: false, author: presidentPersonId },
          { content: 'Reproduced on staging; gateway timeout under investigation.', internal: true, author: presidentPersonId },
        ],
      },
      {
        _marker: 'SEED-TICKET-002',
        organizationId: orgId,
        reportedBy: memberPersonIds[1]!,
        assignedTo: presidentPersonId,
        subject: '[SEED-TICKET-002] Event registration page blank',
        description: 'The events list renders empty even though events are published.',
        category: 'technical',
        priority: 'critical',
        status: 'resolved',
        slaFirstResponseDeadline: daysAgo(9),
        slaResolutionDeadline: daysAgo(7),
        firstRespondedAt: daysAgo(9),
        resolvedAt: daysAgo(6),
        createdBy: memberPersonIds[1]!,
        updatedBy: presidentPersonId,
        _comments: [
          { content: 'Fixed a caching bug — please refresh and confirm.', internal: false, author: presidentPersonId },
        ],
      },
      {
        _marker: 'SEED-TICKET-003',
        organizationId: orgId,
        reportedBy: memberPersonIds[2 % memberPersonIds.length]!,
        assignedTo: null,
        subject: '[SEED-TICKET-003] How do I update my membership tier?',
        description: 'I want to upgrade my membership but cannot find the option.',
        category: 'membership',
        priority: 'standard',
        status: 'open',
        slaFirstResponseDeadline: daysFromNow(1),
        slaResolutionDeadline: daysFromNow(3),
        createdBy: memberPersonIds[2 % memberPersonIds.length]!,
        updatedBy: memberPersonIds[2 % memberPersonIds.length]!,
        _comments: [],
      },
      {
        _marker: 'SEED-TICKET-004',
        organizationId: orgId,
        reportedBy: memberPersonIds[3 % memberPersonIds.length]!,
        assignedTo: presidentPersonId,
        subject: '[SEED-TICKET-004] General question about CPD credits',
        description: 'Are externally earned CPD credits accepted?',
        category: 'general',
        priority: 'low',
        status: 'closed',
        slaFirstResponseDeadline: daysAgo(20),
        slaResolutionDeadline: daysAgo(18),
        firstRespondedAt: daysAgo(20),
        resolvedAt: daysAgo(17),
        closedAt: daysAgo(16),
        createdBy: memberPersonIds[3 % memberPersonIds.length]!,
        updatedBy: presidentPersonId,
        _comments: [
          { content: 'Yes — submit external credits under Training > External Credits.', internal: false, author: presidentPersonId },
        ],
      },
    ];

    for (const t of tickets) {
      const { _marker, _comments, ...ticketValues } = t;
      const existing = (await db.execute(sql`SELECT id FROM support_ticket WHERE subject LIKE ${'%' + _marker + '%'} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        const [ticket] = await db.insert(supportTickets).values(ticketValues).returning({ id: supportTickets.id });
        if (ticket) {
          for (const c of _comments) {
            await db.insert(ticketComments).values({
              ticketId: ticket.id,
              authorId: c.author,
              content: c.content,
              isInternal: c.internal,
            });
          }
        }
      }
    }
    console.log('    ✓ 4 support tickets + comments (status/priority/category spread)');
  } catch (e) {
    console.log(`    (support ticket seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── breachIncidents (1 resolved) ───
  try {
    const marker = 'SEED-BREACH-001';
    const existing = (await db.execute(sql`SELECT id FROM breach_incident WHERE npc_reference_number = ${marker} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
    if (existing.rows?.length === 0) {
      await db.insert(breachIncidents).values({
        organizationId: orgId,
        reportedBy: presidentPersonId,
        discoveredAt: daysAgo(40),
        description: 'Misconfigured export endpoint briefly exposed member email addresses. Access revoked and rotated within the hour.',
        affectedRecordsCount: 23,
        dataCategories: ['email', 'name'],
        notificationDeadline: daysAgo(40 - 3),
        status: 'resolved',
        notifiedAt: daysAgo(38),
        resolvedAt: daysAgo(35),
        npcReferenceNumber: marker,
        createdBy: presidentPersonId,
        updatedBy: presidentPersonId,
      });
    }
    console.log('    ✓ 1 breach incident (resolved)');
  } catch (e) {
    console.log(`    (breach incident seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── impersonationSessions (1 ended) ───
  try {
    const marker = 'seed-impersonation-token-001';
    const existing = (await db.execute(sql`SELECT id FROM impersonation_session WHERE session_token = ${marker} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
    if (existing.rows?.length === 0) {
      await db.insert(impersonationSessions).values({
        adminId: presidentPersonId,
        targetUserId: memberPersonIds[0]!,
        targetOrgId: orgId,
        sessionToken: marker,
        startedAt: daysAgo(5),
        expiresAt: daysAgo(5),
        endedAt: daysAgo(5),
      });
    }
    console.log('    ✓ 1 impersonation session (ended)');
  } catch (e) {
    console.log(`    (impersonation session seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── chapterSnapshots (metric JSON-ish numeric aggregates) ───
  try {
    const months = [
      { month: monthStr(daysAgo(60)), total: 120, active: 95, grace: 10, lapsed: 12, suspended: 3, rate: '0.79', collected: '950000', expected: '1200000', cpd: '0.72', avgCredits: '14.5', activity: 210 },
      { month: monthStr(daysAgo(30)), total: 128, active: 104, grace: 8, lapsed: 13, suspended: 3, rate: '0.81', collected: '1040000', expected: '1280000', cpd: '0.75', avgCredits: '15.2', activity: 245 },
    ];
    for (const m of months) {
      const existing = (await db.execute(sql`SELECT id FROM chapter_snapshot WHERE org_id = ${orgId} AND snapshot_month = ${m.month} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(chapterSnapshots).values({
          orgId,
          associationId,
          snapshotMonth: m.month,
          totalMembers: m.total,
          activeMembers: m.active,
          graceMembers: m.grace,
          lapsedMembers: m.lapsed,
          suspendedMembers: m.suspended,
          collectionRate: m.rate,
          totalCollected: m.collected,
          totalExpected: m.expected,
          cpdComplianceRate: m.cpd,
          avgCreditsPerMember: m.avgCredits,
          activityCount90d: m.activity,
          createdBy: presidentPersonId,
          updatedBy: presidentPersonId,
        });
      }
    }
    console.log('    ✓ 2 chapter snapshots (monthly metrics)');
  } catch (e) {
    console.log(`    (chapter snapshot seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── nationalDashboardAccess (1 active grant + 1 revoked) ───
  try {
    const grants = [
      { member: memberPersonIds[0]!, revoked: null as Date | null },
      { member: memberPersonIds[1]!, revoked: daysAgo(10) },
    ];
    for (const g of grants) {
      const existing = (await db.execute(sql`SELECT id FROM national_dashboard_access WHERE association_id = ${associationId} AND member_id = ${g.member} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(nationalDashboardAccess).values({
          associationId,
          memberId: g.member,
          grantedBy: presidentPersonId,
          grantedAt: daysAgo(45),
          revokedAt: g.revoked,
          createdBy: presidentPersonId,
          updatedBy: presidentPersonId,
        });
      }
    }
    console.log('    ✓ 2 national dashboard access grants (1 active, 1 revoked)');
  } catch (e) {
    console.log(`    (national dashboard access seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── dashboardExportLogs (report types + formats spread) ───
  try {
    type NewExport = typeof dashboardExportLogs.$inferInsert;
    const logs: Array<NewExport & { _scope: string }> = [
      { _scope: 'SEED-EXPORT-001', exportedBy: presidentPersonId, associationId, reportType: 'association_summary', scope: 'all_chapters', dateRangeStart: daysAgo(90), dateRangeEnd: daysAgo(1), outputFormat: 'pdf', createdBy: presidentPersonId, updatedBy: presidentPersonId },
      { _scope: 'SEED-EXPORT-002', exportedBy: presidentPersonId, associationId, reportType: 'dues_collection', scope: orgId, dateRangeStart: daysAgo(30), dateRangeEnd: daysAgo(1), outputFormat: 'csv', createdBy: presidentPersonId, updatedBy: presidentPersonId },
    ];
    for (const l of logs) {
      const { _scope, ...vals } = l;
      const existing = (await db.execute(sql`SELECT id FROM dashboard_export_log WHERE association_id = ${associationId} AND report_type = ${l.reportType} AND output_format = ${l.outputFormat} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(dashboardExportLogs).values(vals);
      }
    }
    console.log('    ✓ 2 dashboard export logs (pdf + csv)');
  } catch (e) {
    console.log(`    (dashboard export log seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  console.log('  Platform admin coverage complete.');
}

/** YYYY-MM for chapter snapshot month column. */
function monthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
