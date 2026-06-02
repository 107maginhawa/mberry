/**
 * Layer 7 (misc): coverage seeding for advertising + booking + document tags.
 *
 * Seeds realistic, FK-coherent data for previously-unseeded tables:
 *   advertising:  advertiser → ad_campaign → ad_creative → ad_report, member_ad_opt_out
 *   booking:      booking_event, schedule_exception
 *   documents:    document_tag (attached to existing seeded documents)
 *
 * Idempotent: every block checks for existing rows before inserting and
 * skips gracefully when a required parent has no rows. Never throws.
 */

import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import { daysAgo, daysFromNow } from './helpers';

import {
  advertisers,
  campaigns,
  creatives,
  adReports,
  memberAdOptOuts,
} from '@/handlers/advertising/repos/advertising.schema';
import {
  bookingEvents,
  scheduleExceptions,
  timeSlots,
  type DailyConfig,
  DayOfWeek,
} from '@/handlers/booking/repos/booking.schema';
import { documentTags } from '@/handlers/documents/repos/documents.schema';

export async function seedMiscCoverage(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  presidentPersonId: string,
  memberPersonIds: string[],
) {
  console.log('  Misc coverage (advertising, booking, document tags)...');

  // ─── advertisers → campaigns → creatives → adReports ───
  try {
    type NewCampaign = typeof campaigns.$inferInsert;
    interface AdvertiserSeed {
      marker: string;
      companyName: string;
      contactEmail: string;
      campaigns: Array<{
        name: string;
        status: NonNullable<NewCampaign['status']>;
        adSlot: NonNullable<NewCampaign['adSlot']>;
        budgetCents: number;
        spentCents: number;
        startsAt: Date;
        endsAt: Date;
        creative: {
          title: string;
          bodyText: string;
          imageUrl: string;
          clickUrl: string;
          status: 'pending' | 'approved' | 'rejected';
        };
      }>;
    }

    const advertiserSeeds: AdvertiserSeed[] = [
      {
        marker: 'SEED-ADV-DENTALCO',
        companyName: 'DentalCo Supply Inc.',
        contactEmail: 'ads@dentalco.example.com',
        campaigns: [
          {
            name: 'Spring Composite Promo',
            status: 'active',
            adSlot: 'feed_banner',
            budgetCents: 500000,
            spentCents: 124500,
            startsAt: daysAgo(20),
            endsAt: daysFromNow(40),
            creative: {
              title: '20% Off Composite Kits',
              bodyText: 'Stock up on premium composite restoration kits this spring.',
              imageUrl: 'ads/dentalco/spring-banner-728x90.png',
              clickUrl: 'https://dentalco.example.com/spring',
              status: 'approved',
            },
          },
          {
            name: 'Sidebar Awareness Q2',
            status: 'paused',
            adSlot: 'sidebar',
            budgetCents: 250000,
            spentCents: 80000,
            startsAt: daysAgo(35),
            endsAt: daysFromNow(10),
            creative: {
              title: 'DentalCo — Trusted Since 1998',
              bodyText: 'Quality dental consumables delivered nationwide.',
              imageUrl: 'ads/dentalco/sidebar-300x250.png',
              clickUrl: 'https://dentalco.example.com',
              status: 'pending',
            },
          },
        ],
      },
      {
        marker: 'SEED-ADV-ORTHOPLUS',
        companyName: 'OrthoPlus Equipment',
        contactEmail: 'marketing@orthoplus.example.com',
        campaigns: [
          {
            name: 'Event Sponsorship — Annual Congress',
            status: 'completed',
            adSlot: 'event_sponsor',
            budgetCents: 1000000,
            spentCents: 1000000,
            startsAt: daysAgo(90),
            endsAt: daysAgo(30),
            creative: {
              title: 'OrthoPlus — Proud Congress Sponsor',
              bodyText: 'Visit booth #14 for live demos of our new scanner line.',
              imageUrl: 'ads/orthoplus/congress-sponsor.png',
              clickUrl: 'https://orthoplus.example.com/congress',
              status: 'rejected',
            },
          },
        ],
      },
    ];

    for (const advSeed of advertiserSeeds) {
      const existing = (await db.execute(
        sql`SELECT id FROM advertiser WHERE company_name = ${advSeed.companyName} AND organization_id = ${orgId} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length !== 0) continue;

      const [adv] = await db
        .insert(advertisers)
        .values({
          organizationId: orgId,
          companyName: advSeed.companyName,
          contactEmail: advSeed.contactEmail,
          contactPersonId: presidentPersonId,
          isActive: true,
        })
        .returning({ id: advertisers.id });
      if (!adv) continue;

      for (const campSeed of advSeed.campaigns) {
        const [camp] = await db
          .insert(campaigns)
          .values({
            organizationId: orgId,
            advertiserId: adv.id,
            name: campSeed.name,
            description: `${advSeed.companyName} — ${campSeed.name}`,
            status: campSeed.status,
            targetSegmentId: 'segment-all-members',
            targetSegmentSize: 1200,
            budgetCents: campSeed.budgetCents,
            spentCents: campSeed.spentCents,
            startsAt: campSeed.startsAt,
            endsAt: campSeed.endsAt,
            adSlot: campSeed.adSlot,
          })
          .returning({ id: campaigns.id });
        if (!camp) continue;

        const [cre] = await db
          .insert(creatives)
          .values({
            organizationId: orgId,
            campaignId: camp.id,
            title: campSeed.creative.title,
            bodyText: campSeed.creative.bodyText,
            imageUrl: campSeed.creative.imageUrl,
            clickUrl: campSeed.creative.clickUrl,
            status: campSeed.creative.status,
            reviewedBy: campSeed.creative.status === 'pending' ? null : presidentPersonId,
            reviewedAt: campSeed.creative.status === 'pending' ? null : daysAgo(5),
            rejectionReason:
              campSeed.creative.status === 'rejected'
                ? 'Image resolution below minimum requirements'
                : null,
            sponsoredLabel: true,
          })
          .returning({ id: creatives.id });

        // Ad report (member-reported creative) for the first advertiser's first creative
        if (cre && advSeed.marker === 'SEED-ADV-DENTALCO' && campSeed.adSlot === 'feed_banner') {
          const reporter = memberPersonIds[0];
          if (reporter) {
            await db.insert(adReports).values({
              organizationId: orgId,
              creativeId: cre.id,
              reporterPersonId: reporter,
              reason: 'Ad content not relevant to dental professionals',
            });
          }
        }
      }
    }
    console.log('    ✓ advertising funnel');
  } catch (e) {
    console.log(`    (advertising seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── member ad opt-outs ───
  try {
    const optOutMembers = memberPersonIds.slice(0, 3);
    for (const personId of optOutMembers) {
      const existing = (await db.execute(
        sql`SELECT id FROM member_ad_opt_out WHERE person_id = ${personId} AND organization_id = ${orgId} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(memberAdOptOuts).values({
          organizationId: orgId,
          personId,
          optedOutAt: daysAgo(12),
        });
      }
    }
    console.log('    ✓ member ad opt-outs');
  } catch (e) {
    console.log(`    (ad opt-out seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── booking events → schedule exceptions ───
  try {
    const owner = presidentPersonId;
    const weekday: DailyConfig = {
      enabled: true,
      timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30, bufferTime: 0 }],
    };
    const closed: DailyConfig = { enabled: false, timeBlocks: [] };
    const dailyConfigs: Record<DayOfWeek, DailyConfig> = {
      [DayOfWeek.sun]: closed,
      [DayOfWeek.mon]: weekday,
      [DayOfWeek.tue]: weekday,
      [DayOfWeek.wed]: weekday,
      [DayOfWeek.thu]: weekday,
      [DayOfWeek.fri]: weekday,
      [DayOfWeek.sat]: closed,
    };

    type NewBookingEvent = typeof bookingEvents.$inferInsert;
    interface EventSeed {
      title: string;
      status: NonNullable<NewBookingEvent['status']>;
      description: string;
      keywords: string[];
      tags: string[];
    }
    const eventSeeds: EventSeed[] = [
      {
        title: 'Member Consultation Slots',
        status: 'active',
        description: 'One-on-one consultations with the chapter president.',
        keywords: ['consultation', 'membership'],
        tags: ['consultation'],
      },
      {
        title: 'CPD Advisory Sessions',
        status: 'draft',
        description: 'Continuing education advisory and credit planning.',
        keywords: ['cpd', 'credits', 'advisory'],
        tags: ['cpd'],
      },
    ];

    const eventIds: string[] = [];
    for (const ev of eventSeeds) {
      const existing = (await db.execute(
        sql`SELECT id FROM booking_event WHERE title = ${ev.title} AND organization_id = ${orgId} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length !== 0) {
        if (existing.rows?.[0]) eventIds.push(existing.rows[0].id);
        continue;
      }
      const [created] = await db
        .insert(bookingEvents)
        .values({
          organizationId: orgId,
          owner,
          title: ev.title,
          description: ev.description,
          keywords: ev.keywords,
          tags: ev.tags,
          timezone: 'Asia/Manila',
          locationTypes: ['video', 'in-person'],
          maxBookingDays: 30,
          minBookingMinutes: 1440,
          status: ev.status,
          effectiveFrom: daysAgo(10),
          effectiveTo: daysFromNow(120),
          dailyConfigs,
        })
        .returning({ id: bookingEvents.id });
      if (created) eventIds.push(created.id);
    }
    console.log('    ✓ booking events');

    // SC-P1-001 fix: generate a small slice of bookable time_slot rows tied to the
    // first active booking_event so the booking flow has real availability in dev.
    // Bookings remain user-generated runtime data (still empty by design).
    const slotEventId = eventIds[0];
    if (slotEventId) {
      const existingSlots = (await db.execute(
        sql`SELECT id FROM time_slot WHERE event_id = ${slotEventId} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existingSlots.rows?.length === 0) {
        // Build 8 half-hour slots across the next 4 weekdays at 09:00 + 09:30 Manila time.
        let slotCount = 0;
        for (let dayOffset = 2; dayOffset <= 5; dayOffset++) {
          for (const hour of [9, 10]) {
            const start = daysFromNow(dayOffset);
            start.setUTCHours(hour - 8, 0, 0, 0); // Asia/Manila is UTC+8
            const end = new Date(start.getTime() + 30 * 60 * 1000);
            await db.insert(timeSlots).values({
              organizationId: orgId,
              owner,
              event: slotEventId,
              startTime: start,
              endTime: end,
              locationTypes: ['video', 'in-person'],
              status: 'available' as const,
            });
            slotCount++;
          }
        }
        console.log(`    ✓ ${slotCount} time slots seeded`);
      } else {
        console.log('    (time slots already seeded, skipping)');
      }
    }

    // Schedule exceptions (holidays / blackout dates) on the first event
    const exceptionEventId = eventIds[0];
    if (exceptionEventId) {
      interface ExceptionSeed {
        reason: string;
        start: Date;
        end: Date;
        recurring: boolean;
      }
      const exceptionSeeds: ExceptionSeed[] = [
        { reason: 'National Holiday — Independence Day', start: daysFromNow(14), end: daysFromNow(15), recurring: false },
        { reason: 'Annual Congress — office closed', start: daysFromNow(30), end: daysFromNow(33), recurring: false },
        { reason: 'Weekly admin blackout', start: daysFromNow(7), end: daysFromNow(8), recurring: true },
      ];
      for (const ex of exceptionSeeds) {
        const existing = (await db.execute(
          sql`SELECT id FROM schedule_exception WHERE event_id = ${exceptionEventId} AND reason = ${ex.reason} LIMIT 1`,
        )) as unknown as { rows: Array<{ id: string }> };
        if (existing.rows?.length === 0) {
          await db.insert(scheduleExceptions).values({
            organizationId: orgId,
            event: exceptionEventId,
            owner,
            timezone: 'Asia/Manila',
            startDatetime: ex.start,
            endDatetime: ex.end,
            reason: ex.reason,
            recurring: ex.recurring,
            recurrencePattern: ex.recurring ? { type: 'weekly', interval: 1, daysOfWeek: [1] } : null,
          });
        }
      }
      console.log('    ✓ schedule exceptions');
    } else {
      console.log('    (schedule exceptions skipped: no booking event)');
    }
  } catch (e) {
    console.log(`    (booking seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  // ─── document tags (attached to existing seeded documents) ───
  try {
    const docs = (await db.execute(
      sql`SELECT id FROM document WHERE organization_id = ${orgId} LIMIT 5`,
    )) as unknown as { rows: Array<{ id: string }> };

    const tagSeeds: Array<{ name: string; color: string }> = [
      { name: 'License', color: '#2563eb' },
      { name: 'CPD Certificate', color: '#16a34a' },
      { name: 'Insurance', color: '#dc2626' },
      { name: 'Policy', color: '#9333ea' },
      { name: 'Receipt', color: '#ea580c' },
    ];

    for (const tag of tagSeeds) {
      const existing = (await db.execute(
        sql`SELECT id FROM document_tag WHERE name = ${tag.name} AND organization_id = ${orgId} LIMIT 1`,
      )) as unknown as { rows: Array<{ id: string }> };
      if (existing.rows?.length === 0) {
        await db.insert(documentTags).values({
          organizationId: orgId,
          name: tag.name,
          color: tag.color,
        });
      }
    }

    // Attach tag names to a few existing documents via their jsonb tags column
    if (docs.rows && docs.rows.length > 0) {
      const tagNames = tagSeeds.map((t) => t.name);
      for (let i = 0; i < docs.rows.length; i++) {
        const docId = docs.rows[i]!.id;
        const assigned = [tagNames[i % tagNames.length]!, tagNames[(i + 1) % tagNames.length]!];
        await db.execute(
          sql`UPDATE document SET tags = ${JSON.stringify(assigned)}::jsonb WHERE id = ${docId} AND (tags IS NULL OR tags = '[]'::jsonb)`,
        );
      }
      console.log('    ✓ document tags');
    } else {
      console.log('    (document tag attach skipped: no documents)');
    }
  } catch (e) {
    console.log(`    (document tag seed failed: ${(e as Error).message?.slice(0, 120)})`);
  }

  console.log('  Misc coverage complete.');
}
