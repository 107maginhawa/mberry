import type { Context } from 'hono';
import type { Variables } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { memberships, membershipApplications } from './repos/membership.schema';
import { officerTerms, positions } from './repos/governance.schema';
import { duesInvoices } from './repos/dues.schema';
import { events } from '@/handlers/association:operations/repos/events.schema';
import { trainings } from '@/handlers/association:operations/repos/training.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';

/**
 * getOrgDashboard
 *
 * Path: GET /association/member/org/:organizationId/dashboard
 *
 * Aggregated org-wide dashboard for officer home screen (AC-M04-005).
 * Returns member stats, finance summary, activity counts, officer list,
 * and prioritised action cards.
 *
 * Position-restricted: PRESIDENT, TREASURER, or SECRETARY.
 */
export async function getOrgDashboard(
  ctx: Context<{ Variables: Variables }>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const orgId = ctx.req.param('organizationId')!;

  // Ensure org context is set for requirePosition
  ctx.set('organizationId', orgId);
  const denied = await requirePosition(ctx, [
    POSITION_TITLES.PRESIDENT,
    POSITION_TITLES.TREASURER,
    POSITION_TITLES.SECRETARY,
  ]);
  if (denied) return denied;

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // ── Member counts ─────────────────────────────────────────────────────────

  const [activeMembersResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memberships)
    .where(and(eq(memberships.organizationId, orgId), eq(memberships.status, 'active')));

  const [pendingAppsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(membershipApplications)
    .where(
      and(
        eq(membershipApplications.organizationId, orgId),
        inArray(membershipApplications.status, ['submitted', 'underReview']),
      )
    );

  const [expiringResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, orgId),
        eq(memberships.status, 'active'),
        gte(memberships.duesExpiryDate, now.toISOString().split('T')[0]!),
        lte(memberships.duesExpiryDate, thirtyDaysOut.toISOString().split('T')[0]!),
      )
    );

  const [totalMembersResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memberships)
    .where(eq(memberships.organizationId, orgId));

  const activeCount = Number(activeMembersResult?.count ?? 0);
  const pendingCount = Number(pendingAppsResult?.count ?? 0);
  const expiringCount = Number(expiringResult?.count ?? 0);
  const totalCount = Number(totalMembersResult?.count ?? 0);

  // ── Finance stats ─────────────────────────────────────────────────────────

  const [paidInvoicesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(duesInvoices)
    .where(
      and(
        eq(duesInvoices.organizationId, orgId),
        eq(duesInvoices.status, 'paid'),
        gte(duesInvoices.generatedAt, yearStart),
      )
    );

  const [totalInvoicesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(duesInvoices)
    .where(
      and(
        eq(duesInvoices.organizationId, orgId),
        gte(duesInvoices.generatedAt, yearStart),
      )
    );

  const [outstandingResult] = await db
    .select({ total: sql<string>`coalesce(sum(total_amount), 0)` })
    .from(duesInvoices)
    .where(
      and(
        eq(duesInvoices.organizationId, orgId),
        inArray(duesInvoices.status, ['generated', 'sent', 'overdue']),
      )
    );

  const paidCount = Number(paidInvoicesResult?.count ?? 0);
  const totalInvoiceCount = Number(totalInvoicesResult?.count ?? 0);
  const collectionRate =
    totalInvoiceCount > 0
      ? Math.round((paidCount / totalInvoiceCount) * 100)
      : 0;
  const outstandingAmount = Number(outstandingResult?.total ?? 0);

  // ── Activity counts ───────────────────────────────────────────────────────

  const [upcomingEventsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.organizationId, orgId),
        eq(events.status, 'published'),
        gte(events.startDate, now),
      )
    );

  const [activeTrainingsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trainings)
    .where(
      and(
        eq(trainings.organizationId, orgId),
        eq(trainings.status, 'published'),
      )
    );

  const upcomingEventsCount = Number(upcomingEventsResult?.count ?? 0);
  const activeTrainingsCount = Number(activeTrainingsResult?.count ?? 0);

  // ── Officers list ─────────────────────────────────────────────────────────

  const officerRows = await db
    .select({
      personId: officerTerms.personId,
      firstName: persons.firstName,
      lastName: persons.lastName,
      positionTitle: positions.title,
    })
    .from(officerTerms)
    .innerJoin(positions, eq(officerTerms.positionId, positions.id))
    .innerJoin(persons, eq(sql`${officerTerms.personId}::uuid`, persons.id))
    .where(
      and(
        eq(officerTerms.organizationId, orgId),
        eq(officerTerms.status, 'active'),
      )
    );

  const officerList = officerRows.map((row) => ({
    personId: row.personId,
    name: [row.firstName, row.lastName].filter(Boolean).join(' '),
    position: row.positionTitle,
  }));

  // ── Action cards ──────────────────────────────────────────────────────────

  const actionCards: Array<{
    type: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    actionUrl: string;
  }> = [];

  if (expiringCount > 0) {
    actionCards.push({
      type: 'dues_reminder',
      title: `${expiringCount} memberships expiring this month`,
      priority: 'high',
      actionUrl: '/officer/roster',
    });
  }

  if (pendingCount > 0) {
    actionCards.push({
      type: 'pending_apps',
      title: `${pendingCount} applications awaiting review`,
      priority: 'medium',
      actionUrl: '/officer/applications',
    });
  }

  if (upcomingEventsCount === 0) {
    actionCards.push({
      type: 'no_events',
      title: 'No upcoming events scheduled',
      priority: 'low',
      actionUrl: '/officer/events/new',
    });
  }

  return ctx.json(
    {
      data: {
        members: {
          active: activeCount,
          pending: pendingCount,
          expiring: expiringCount,
          total: totalCount,
        },
        finances: {
          collectionRate,
          outstandingAmount,
        },
        activities: {
          upcomingEvents: upcomingEventsCount,
          activeTrainings: activeTrainingsCount,
        },
        officers: officerList,
        actionCards,
      },
    },
    200,
  );
}
