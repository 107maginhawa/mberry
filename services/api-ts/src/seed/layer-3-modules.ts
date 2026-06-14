import type { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { events, eventRegistrations } from '@/handlers/association:operations/repos/events.schema';
import { trainings, trainingEnrollments } from '@/handlers/association:operations/repos/training.schema';
import { creditEntries } from '@/handlers/association:member/repos/credits.schema';
import { positions } from '@/handlers/association:member/repos/governance.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { SeedClient } from './client';
import { NOW, daysAgo, daysFromNow, dateStr } from './helpers';

// ═══════════════════════════════════════════════════════════════
// Phase 5: Activities (Events, Training, Dues)
// ═══════════════════════════════════════════════════════════════

export async function seedEvents(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('\n  Events...');

  const eventData = [
    { title: 'PDA Annual Dental Convention 2025', eventType: 'generalAssembly' as const, description: 'Annual gathering of dental professionals.', location: 'SMX Convention Center, Pasay City', startDate: new Date('2025-03-15T08:00:00Z'), endDate: new Date('2025-03-16T17:00:00Z'), capacity: 200, registrationFee: 2500, status: 'completed' as const, visibility: 'internal' as const },
    { title: 'Monthly General Assembly - May 2026', eventType: 'generalAssembly' as const, description: 'Regular monthly meeting with updates.', location: 'PDA Metro Manila Office, Makati City', startDate: new Date('2026-05-09T14:00:00Z'), endDate: new Date('2026-05-09T17:00:00Z'), capacity: 100, registrationFee: 0, status: 'published' as const, visibility: 'internal' as const },
    { title: 'Year-End Gala Dinner', eventType: 'fellowship' as const, description: 'Annual year-end celebration and awards night.', location: 'Manila Hotel, Rizal Ballroom', startDate: new Date('2026-08-01T18:00:00Z'), endDate: new Date('2026-08-01T23:00:00Z'), capacity: 150, registrationFee: 3500, status: 'published' as const, visibility: 'internal' as const },
    { title: 'Community Dental Mission - Tondo', eventType: 'medicalMission' as const, description: 'Free dental services for underserved communities.', location: 'Tondo Community Center, Manila', startDate: new Date('2026-09-20T07:00:00Z'), endDate: new Date('2026-09-20T16:00:00Z'), capacity: 50, registrationFee: 0, status: 'draft' as const, visibility: 'internal' as const },
  ];

  for (const e of eventData) {
    const existing = await db.select().from(events).where(eq(events.title, e.title)).limit(1);
    if (existing.length === 0) {
      await db.insert(events).values({
        organizationId: orgId, ...e,
        creditBearing: false, creditAmount: 0,
        createdBy: presidentId, updatedBy: presidentId,
      });
    }
    console.log(`    ✓ ${e.status}: ${e.title}`);
  }
}

export async function seedTraining(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('  Training...');

  const trainingData = [
    { title: 'Advanced Implant Placement Workshop', description: 'Hands-on workshop covering modern implant techniques.', instructorName: 'Dr. Ramon Aquino', location: 'PDA Training Center, Quezon City', startDate: new Date('2025-02-01T08:00:00Z'), endDate: new Date('2025-02-02T17:00:00Z'), capacity: 30, registrationFee: 5000, creditBearing: true, creditAmount: 16, status: 'completed' as const },
    // Published endodontics training — e2e officer/member training specs assert this
    // exists as SEEDED data (training-lifecycle, officer/training, training-actions).
    { title: 'Advanced Endodontics', description: 'Advanced root canal therapy and endodontic techniques.', instructorName: 'Dr. Carlos Diaz', location: 'PDA Metro Manila Office', startDate: new Date('2026-06-10T09:00:00Z'), endDate: new Date('2026-06-11T17:00:00Z'), capacity: 20, registrationFee: 4500, creditBearing: true, creditAmount: 12, status: 'published' as const },
    { title: 'Dental Photography Seminar', description: 'Clinical photography techniques for documentation.', instructorName: 'Dr. Elena Villanueva', location: 'Makati Medical Center', startDate: new Date('2026-04-20T09:00:00Z'), endDate: new Date('2026-04-20T17:00:00Z'), capacity: 25, registrationFee: 3000, creditBearing: true, creditAmount: 8, status: 'published' as const },
    { title: 'Infection Control & Sterilization Update', description: 'Updated protocols for infection prevention.', instructorName: 'Dr. Patricia Reyes', location: 'PDA Metro Manila Office', startDate: new Date('2026-07-15T09:00:00Z'), endDate: new Date('2026-07-15T16:00:00Z'), capacity: 40, registrationFee: 2000, creditBearing: true, creditAmount: 6, status: 'published' as const },
  ];

  for (const t of trainingData) {
    const existing = await db.select().from(trainings).where(eq(trainings.title, t.title)).limit(1);
    if (existing.length === 0) {
      await db.insert(trainings).values({
        organizationId: orgId, ...t,
        createdBy: presidentId, updatedBy: presidentId,
      });
    }
    console.log(`    ✓ ${t.status}: ${t.title}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 6: Governance (Elections, Announcements)
// ═══════════════════════════════════════════════════════════════

export async function seedElections(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('  Elections...');

  // AHA FIX-002 (G2): election.positions slots must carry REAL `position` row ids
  // (canonical identity) so seeded nominee/vote inserts satisfy the position FK and
  // the BR-33 min-candidate counts group correctly. Resolve the desired titles to
  // existing org positions (seeded in layer-2); skip any title without a row.
  const desiredTitles = ['President', 'Treasurer', 'Secretary'];
  const posRows = await db.select({ id: positions.id, title: positions.title })
    .from(positions)
    .where(eq(positions.organizationId, orgId));
  const slots = desiredTitles
    .map((title, sortOrder) => {
      const match = posRows.find((p) => p.title.trim().toLowerCase() === title.toLowerCase());
      return match ? { id: match.id, title, sortOrder } : null;
    })
    .filter((s): s is { id: string; title: string; sortOrder: number } => s !== null);
  const positionsJson = JSON.stringify(slots);

  // Use raw SQL since election table uses hand-wired schema
  const electionData = [
    { title: 'PDA Metro Manila Officers Election 2025', status: 'published', nominationsOpenAt: '2025-01-01', nominationsCloseAt: '2025-01-15', votingOpenAt: '2025-01-20', votingCloseAt: '2025-01-25' },
    { title: 'PDA Metro Manila Officers Election 2026', status: 'draft', nominationsOpenAt: '2026-07-01', nominationsCloseAt: '2026-07-15', votingOpenAt: '2026-07-20', votingCloseAt: '2026-07-25' },
    // votingOpen election — enables BR-67 vote integrity testing
    { title: 'PDA Metro Manila Mid-Year Election 2026', status: 'votingOpen', nominationsOpenAt: dateStr(daysAgo(30)), nominationsCloseAt: dateStr(daysAgo(7)), votingOpenAt: dateStr(daysAgo(3)), votingCloseAt: dateStr(daysFromNow(14)) },
  ];

  for (const e of electionData) {
    const existing = await db.execute(sql`SELECT id FROM election WHERE title = ${e.title} LIMIT 1`);
    const rows = (existing as unknown as { rows: Array<{ id: string }> }).rows ?? [];
    if (rows.length === 0) {
      await db.execute(sql`
        INSERT INTO election (organization_id, title, type, status, voting_mode,
          nominations_open_at, nominations_close_at, voting_open_at, voting_close_at,
          positions, created_by, updated_by)
        VALUES (${orgId}, ${e.title}, 'officer', ${e.status}, 'online',
          ${e.nominationsOpenAt}::timestamptz, ${e.nominationsCloseAt}::timestamptz,
          ${e.votingOpenAt}::timestamptz, ${e.votingCloseAt}::timestamptz,
          ${positionsJson}::jsonb, ${presidentId}, ${presidentId})
      `);
    }
    console.log(`    ✓ ${e.status}: ${e.title}`);
  }
}

export async function seedAnnouncements(db: ReturnType<typeof drizzle>, orgId: string, presidentId: string) {
  console.log('  Announcements...');

  const annData = [
    { title: 'May Dues Reminder - Please Pay Before June 1', content: '<p>Dear members, annual dues for 2025 are due. Please settle your accounts before June 1.</p>', audienceType: 'all', visibility: 'internal', status: 'sent', publishedAt: new Date('2026-05-01T00:00:00Z') },
    { title: 'Upcoming Board Meeting - June 15', content: '<p>Board meeting on June 15 at 2:00 PM. Agenda: budget review, election prep, membership drive.</p>', audienceType: 'officers', visibility: 'internal', status: 'draft', publishedAt: null },
    { title: 'Annual Convention Registration Open', content: '<p>Early bird registration for the 2026 PDA Annual Convention is now open.</p>', audienceType: 'all', visibility: 'internal', status: 'scheduled', publishedAt: daysFromNow(7) },
    { title: 'April Newsletter - Community Dental Mission Recap', content: '<p>Thank you to all volunteers who participated in the Tondo dental mission.</p>', audienceType: 'all', visibility: 'internal', status: 'archived', publishedAt: daysAgo(45) },
  ];

  for (const a of annData) {
    const existing = await db.execute(sql`SELECT id FROM announcement WHERE title = ${a.title} LIMIT 1`);
    const annRows = (existing as unknown as { rows: Array<{ id: string }> }).rows ?? [];
    if (annRows.length === 0) {
      await db.execute(sql`
        INSERT INTO announcement (organization_id, author_id, title, content, audience_type, visibility, status, published_at)
        VALUES (${orgId}, ${presidentId}, ${a.title}, ${a.content}, ${a.audienceType}, ${a.visibility}::announcement_visibility, ${a.status}::announcement_status, ${a.publishedAt})
      `);
    }
    console.log(`    ✓ ${a.status}: ${a.title}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Phase 7: Credit Entries (manual, since completeTraining
//          doesn't auto-create credits)
// ═══════════════════════════════════════════════════════════════

export async function seedCredits(db: ReturnType<typeof drizzle>, memberClients: SeedClient[], orgId: string) {
  console.log('  Credits...');

  const activities = [
    { name: 'Dental Photography Seminar (Completed)', credits: 4, date: '2026-04-25' },
    { name: 'External Implant Workshop', credits: 6, date: '2026-04-15', provider: 'Philippine College of Oral Surgeons' },
    { name: 'API Test Credit', credits: 3, date: '2026-04-01', provider: 'Self-Study' },
    { name: 'Infection Control Webinar', credits: 2, date: '2026-03-10', provider: 'DOH' },
    { name: 'CPD Seminar: Advances in Periodontics', credits: 4, date: '2026-02-15', provider: 'PDA National' },
  ];

  // Check if credits already seeded
  const existingCredits = await db.select().from(creditEntries).limit(1);
  if (existingCredits.length > 0) {
    console.log(`    (credits already seeded, skipping)`);
    return;
  }

  // Give credits to first 10 members (varied amounts for realistic dashboard)
  // Members 0-4: well above requirement (60+), 5-7: close to requirement, 8-9: shortfall
  const creditCounts = [8, 6, 5, 5, 4, 3, 3, 2, 1, 1];
  for (let i = 0; i < Math.min(creditCounts.length, memberClients.length); i++) {
    const client = memberClients[i]!;
    const count = creditCounts[i]!;
    for (let j = 0; j < count; j++) {
      const act = activities[j % activities.length]!;
      await client.post('/persons/me/credit-entries', {
        organizationId: orgId,
        activityName: act.name,
        provider: act.provider || 'PDA Metro Manila',
        activityDate: act.date,
        creditAmount: act.credits,
        registrationDate: dateStr(daysAgo(365)),
        cyclePeriodYears: 3,
      });
    }
    if (i < 5) console.log(`    ✓ ${client.email}: ${count} credit entries`);
  }
  console.log(`    ✓ 10 members with credit entries (varied amounts)`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 8: Relational Data (registrations, enrollments, payments)
// ═══════════════════════════════════════════════════════════════

export async function seedRelationalData(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  president: SeedClient,
  memberClients: SeedClient[],
) {
  console.log('  Relational data...');

  // Get event and training IDs
  const allEvents = await db.select({ id: events.id, title: events.title, status: events.status }).from(events);
  const allTrainings = await db.select({ id: trainings.id, title: trainings.title, status: trainings.status }).from(trainings);

  // Event registrations — register Maria + first 5 members for published events
  const publishedEvents = allEvents.filter(e => e.status === 'published' || e.status === 'completed');
  const existingRegs = await db.select().from(eventRegistrations).limit(1);
  if (existingRegs.length === 0 && publishedEvents.length > 0) {
    const registrants = [president.personId, ...memberClients.slice(0, 5).map(c => c.personId)];
    for (const evt of publishedEvents) {
      for (const personId of registrants) {
        await db.insert(eventRegistrations).values({
          organizationId: orgId, eventId: evt.id, personId,
          status: 'confirmed', registeredAt: new Date(),
        });
      }
    }
    console.log(`    ✓ Event registrations: ${registrants.length} people × ${publishedEvents.length} events`);
  }

  // Training enrollments — enroll Maria + first 3 members
  const existingEnrollments = await db.select().from(trainingEnrollments).limit(1);
  if (existingEnrollments.length === 0 && allTrainings.length > 0) {
    const enrollees = [president.personId, ...memberClients.slice(0, 3).map(c => c.personId)];
    for (const trn of allTrainings) {
      for (const personId of enrollees) {
        const isCompleted = trn.status === 'completed';
        await db.insert(trainingEnrollments).values({
          organizationId: orgId, trainingId: trn.id, personId,
          status: isCompleted ? 'completed' as const : 'enrolled' as const,
          enrolledAt: new Date(),
          completedAt: isCompleted ? new Date() : null,
        });
      }
    }
    console.log(`    ✓ Training enrollments: ${enrollees.length} people × ${allTrainings.length} trainings`);
  }

  // Dues payments — 10 payments for first 10 active members
  const existingPayments = await db.execute(sql`SELECT count(*) as c FROM dues_payment`);
  const paymentRows = (existingPayments as unknown as { rows: Array<{ c: string }> }).rows ?? [];
  const paymentCount = paymentRows[0]?.c ?? 0;
  if (Number(paymentCount) === 0) {
    const paymentMembers = memberClients.slice(0, 10);
    for (let i = 0; i < paymentMembers.length; i++) {
      const methods = ['gcash', 'bankTransfer', 'cash', 'online', 'check'];
      await db.execute(sql`
        INSERT INTO dues_payment (organization_id, person_id, receipt_number, amount, currency, payment_method, status, paid_at)
        VALUES (${orgId}, ${paymentMembers[i]!.personId}, ${`RCP-${NOW.getFullYear()}-${String(i + 1).padStart(3, '0')}`}, 300000, 'PHP', ${methods[i % methods.length]}::dues_payment_method, 'completed'::dues_payment_status, ${daysAgo(50 - i * 5)})
      `);
    }
    console.log(`    ✓ Dues payments: 10 records`);
  }

  // Credits for Maria (president) — so her credits page isn't empty
  await president.post('/persons/me/credit-entries', {
    organizationId: orgId,
    activityName: 'PDA Annual Convention 2025 (Attended)',
    provider: 'PDA Metro Manila',
    activityDate: '2025-03-15',
    creditAmount: 8,
    registrationDate: '2025-01-01',
    cyclePeriodYears: 3,
  });
  await president.post('/persons/me/credit-entries', {
    organizationId: orgId,
    activityName: 'Advanced Implant Workshop (Completed)',
    provider: 'PDA Training Center',
    activityDate: '2025-02-02',
    creditAmount: 16,
    registrationDate: '2025-01-01',
    cyclePeriodYears: 3,
  });
  await president.post('/persons/me/credit-entries', {
    organizationId: orgId,
    activityName: 'Leadership & Governance Seminar',
    provider: 'PDA National',
    activityDate: '2025-04-10',
    creditAmount: 4,
    registrationDate: '2025-01-01',
    cyclePeriodYears: 3,
  });
  console.log(`    ✓ Maria credits: 3 entries (28 total credits)`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 9: Profile Photos (from randomuser.me)
// ═══════════════════════════════════════════════════════════════

export async function seedProfilePhotos(db: ReturnType<typeof drizzle>, allPersonIds: string[], genders: Record<string, string>) {
  console.log('  Profile photos...');

  // Check if any person already has an avatar
  const [sample] = await db.select({ id: persons.id, avatar: persons.avatar }).from(persons).limit(1);
  if (sample?.avatar) {
    console.log('    (photos already seeded, skipping)');
    return;
  }

  try {
    // Fetch photos from randomuser.me in batch
    const count = Math.min(allPersonIds.length, 40);
    const maleCount = Object.values(genders).filter(g => g === 'male').length;
    const femaleCount = count - maleCount;

    // Use deterministic portrait URLs (no API call needed, faster + no rate limit)
    let maleIdx = 1;
    let femaleIdx = 1;

    for (const personId of allPersonIds) {
      const gender = genders[personId] || 'male';
      const folder = gender === 'female' ? 'women' : 'men';
      const idx = gender === 'female' ? femaleIdx++ : maleIdx++;
      const url = `https://randomuser.me/api/portraits/${folder}/${idx}.jpg`;

      await db.update(persons)
        .set({ avatar: { url } })
        .where(eq(persons.id, personId));
    }

    console.log(`    ✓ ${allPersonIds.length} profile photos assigned`);
  } catch (err) {
    console.log(`    ⚠ Photo seeding failed (non-blocking): ${(err as Error).message}`);
  }
}
