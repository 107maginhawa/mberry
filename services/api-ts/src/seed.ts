/**
 * Seed entry point — orchestrates all seed layers in dependency order.
 *
 * Modular architecture:
 *   seed/types.ts              — SeedContext, MemberStatus
 *   seed/helpers.ts            — Date math, constants, utilities
 *   seed/client.ts             — SeedClient API wrapper
 *   seed/data.ts               — OFFICERS, MEMBERS, APPLICANTS arrays
 *   seed/layer-1-foundation.ts — Org, tiers, categories
 *   seed/layer-2-users.ts      — President, officers, members, applicants
 *   seed/layer-3-modules.ts    — Events, training, elections, announcements, credits
 *   seed/layer-4-cross-module.ts — Notifications, certs, docs, comms, billing, committees
 *   seed/layer-5-gap-fill.ts   — Gap-fill phases 19-29
 *   seed/layer-6-states.ts     — State coverage (all enum values)
 *
 * Requires: API server running on port 7213.
 * Idempotent — safe to re-run.
 *
 * Run: cd services/api-ts && bun run db:seed
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { memberships } from './handlers/association:member/repos/membership.schema';
import { persons } from './handlers/person/repos/person.schema';

// Retained for main summary
import { notifications } from './handlers/notifs/repos/notification.schema';
import { certificates } from './handlers/certificates/repos/certificates.schema';
import { documents } from './handlers/documents/repos/documents.schema';
import { courses } from './handlers/association:operations/repos/training.schema';
import { DATABASE_URL, API_URL } from './seed/helpers';

import { SeedClient } from './seed/client';
import { OFFICERS, MEMBERS, APPLICANTS } from './seed/data';
import { bootstrapDB } from './seed/layer-1-foundation';
import { seedPresident, seedOfficer, seedMember, seedApplicant, seedIdorOfficer, seedMissingRoles } from './seed/layer-2-users';
import { seedEvents, seedTraining, seedElections, seedAnnouncements, seedCredits, seedRelationalData, seedProfilePhotos } from './seed/layer-3-modules';
import { seedNotifications, seedCertificates, seedDocuments, seedComms, seedBilling, seedDunningEventsAndAudit, seedRemainingModules, seedDuesInfrastructure, seedCommittees } from './seed/layer-4-cross-module';
import { seedEventsGapFill, seedTrainingGapFill, seedCredentialsGapFill, seedProfileAndGovernanceGapFill, seedFinanceDeepFill, seedCommsGapFill, seedSurveysModule, seedCpdBackfill, seedSavedSegments, seedJobsModule, seedPrivacyBackfill } from './seed/layer-5-gap-fill';
import { seedStateCoverage } from './seed/layer-6-states';
import { seedCommsCoverage } from './seed/layer-7-comms';
import { seedPlatformCoverage } from './seed/layer-7-platform';
import { seedDuesCoverage } from './seed/layer-7-dues';
import { seedMemberGovernanceCoverage } from './seed/layer-7-member';
import { seedMiscCoverage } from './seed/layer-7-misc';

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SEED — modular API-driven seeding      ║');
  console.log('║   Requires: API server on port 7213      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Verify API is reachable
  try {
    const health = await fetch(`${API_URL}/auth/ok`);
    if (!health.ok) throw new Error(`API returned ${health.status}`);
  } catch (err) {
    console.error(`✗ Cannot reach API at ${API_URL}. Start the server first: bun dev`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  // ═══ Layer 1: Foundation ═══
  const { assocId, orgId, org2Id, regularTierId, associateTierId, org2RegularTierId } = await bootstrapDB(db);

  // ═══ Layer 2: Users ═══
  const president = await seedPresident(db, orgId, regularTierId);

  console.log('\nPhase 2: Officers...');
  const officerClients: SeedClient[] = [president];
  for (let i = 1; i < OFFICERS.length; i++) {
    const o = OFFICERS[i]!;
    const memberNum = `PDA-2025-${String(i + 1).padStart(3, '0')}`;
    const client = await seedOfficer(db, o, orgId, regularTierId, president, memberNum);
    officerClients.push(client);
  }

  console.log('\nPhase 3: Regular Members...');
  const memberClients: SeedClient[] = [];
  for (let i = 0; i < MEMBERS.length; i++) {
    const m = MEMBERS[i]!;
    const memberNum = `PDA-2025-${String(i + 6).padStart(3, '0')}`;
    const client = await seedMember(db, m, orgId, regularTierId, president, memberNum);
    memberClients.push(client);
    process.stdout.write('.');
  }
  console.log(` done (${MEMBERS.length} members)`);

  console.log('\nPhase 4: Pending Applicants...');
  for (const a of APPLICANTS) {
    await seedApplicant(db, a, orgId, regularTierId, president);
  }

  console.log('\nPhase 4b: IDOR Officer (org2)...');
  await seedIdorOfficer(db, org2Id, org2RegularTierId);

  // ═══ Layer 3: Core Modules ═══
  console.log('\nPhase 5: Activities...');
  await seedEvents(db, orgId, president.personId);
  await seedTraining(db, orgId, president.personId);

  console.log('\nPhase 6: Governance...');
  await seedElections(db, orgId, president.personId);
  await seedAnnouncements(db, orgId, president.personId);

  console.log('\nPhase 7: Credits...');
  await seedCredits(db, memberClients, orgId);

  console.log('\nPhase 8: Relational data...');
  await seedRelationalData(db, orgId, president, memberClients);

  console.log('\nPhase 9: Profile photos...');
  const allClients = [president, ...officerClients.slice(1), ...memberClients];
  const genderMap: Record<string, string> = {};
  for (const o of OFFICERS) {
    const c = allClients.find(c => c.email === o.email);
    if (c) genderMap[c.personId] = ['Juan', 'Carlos'].includes(o.firstName) ? 'male' : 'female';
  }
  const femaleNames = ['Isabella', 'Patricia', 'Carmen', 'Teresa', 'Rosa', 'Lucia', 'Gabriela', 'Andrea', 'Valeria', 'Catalina', 'Mariana', 'Daniela', 'Claudia', 'Beatriz', 'Miguel'];
  for (const m of MEMBERS) {
    const c = allClients.find(c => c.email === m.email);
    if (c) genderMap[c.personId] = femaleNames.includes(m.firstName) ? 'female' : 'male';
  }
  await seedProfilePhotos(db, allClients.filter(c => c.personId).map(c => c.personId), genderMap);

  // ═══ Layer 4: Cross-Module ═══
  const allPersonIds = allClients.filter(c => c.personId).map(c => c.personId);
  const memberPersonIds = memberClients.filter(c => c.personId).map(c => c.personId);

  console.log('\nPhase 10: Notifications...');
  await seedNotifications(db, orgId, memberPersonIds, president.personId);

  console.log('\nPhase 11: Certificates...');
  await seedCertificates(db, orgId, [president.personId, ...memberPersonIds.slice(0, 4)]);

  console.log('\nPhase 12: Documents...');
  await seedDocuments(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 13: Comms...');
  await seedComms(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 14: Billing...');
  await seedBilling(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 15: Dunning events & audit...');
  await seedDunningEventsAndAudit(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 16: Remaining modules...');
  await seedRemainingModules(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 17: Dues infrastructure...');
  await seedDuesInfrastructure(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 18: Committees...');
  await seedCommittees(db, orgId, president.personId, memberPersonIds);

  // ═══ Layer 5: Gap-Fill ═══
  const allMembershipRows = await db.select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.organizationId, orgId));
  const allMembershipIds = allMembershipRows.map((r: any) => r.id);

  console.log('\nPhase 19: Events gap-fill...');
  await seedEventsGapFill(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 20: Training gap-fill...');
  await seedTrainingGapFill(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 21: Credentials gap-fill...');
  await seedCredentialsGapFill(db, orgId, president.personId, memberPersonIds, allMembershipIds);

  console.log('\nPhase 22: Profile & governance gap-fill...');
  await seedProfileAndGovernanceGapFill(db, orgId, president.personId, memberPersonIds, allMembershipIds);

  console.log('\nPhase 23: Finance deep-fill...');
  await seedFinanceDeepFill(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 24: Comms gap-fill...');
  await seedCommsGapFill(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 25: Surveys module...');
  await seedSurveysModule(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 26: CPD backfill...');
  await seedCpdBackfill(db, orgId);

  console.log('\nPhase 27: Saved segments...');
  await seedSavedSegments(db, orgId);

  console.log('\nPhase 28: Jobs module...');
  await seedJobsModule(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 29: Privacy backfill...');
  await seedPrivacyBackfill(db, memberPersonIds);

  // ═══ Layer 6: State Coverage ═══
  console.log('\nPhase 30: State coverage...');
  await seedStateCoverage(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 31: Missing role users...');
  await seedMissingRoles(db, orgId, regularTierId);

  // ═══ Layer 7: Table Coverage — fill remaining unseeded tables ═══
  console.log('\nPhase 32: Comms coverage (feed, templates, subscriptions, email)...');
  await seedCommsCoverage(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 33: Platform admin coverage (flags, tiers, tickets, security)...');
  await seedPlatformCoverage(db, orgId, assocId, president.personId, memberPersonIds);

  console.log('\nPhase 34: Dues + privacy coverage (aging, reminders, tokens, exports)...');
  await seedDuesCoverage(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 35: Member governance coverage (transfers, royalties, discipline)...');
  await seedMemberGovernanceCoverage(db, orgId, president.personId, memberPersonIds);

  console.log('\nPhase 36: Misc coverage (advertising, booking, document tags)...');
  await seedMiscCoverage(db, orgId, president.personId, memberPersonIds);

  // ═══ Summary ═══
  const personCount = await db.select().from(persons);
  const membershipCount = await db.select().from(memberships);
  const notifCount = await db.select().from(notifications);
  const certCount = await db.select().from(certificates);
  const docCount = await db.select().from(documents);
  const courseCount = await db.select().from(courses);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║           SEED COMPLETE                      ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Persons:         ${String(personCount.length).padStart(4)}                     ║`);
  console.log(`║  Memberships:     ${String(membershipCount.length).padStart(4)}                     ║`);
  console.log(`║  Officers:           5 + 3 (VP/Board/Staff)  ║`);
  console.log(`║  Applicants:         2 (1 pending, 1 reject) ║`);
  console.log(`║  Notifications:   ${String(notifCount.length).padStart(4)}                     ║`);
  console.log(`║  Certificates:    ${String(certCount.length).padStart(4)}                     ║`);
  console.log(`║  Documents:       ${String(docCount.length).padStart(4)}                     ║`);
  console.log(`║  Courses:         ${String(courseCount.length).padStart(4)}                     ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Member Status: all 11 enum values covered   ║');
  console.log('║  Payment Status: all 10 enum values covered  ║');
  console.log('║  Roles: all 11 role variants seeded          ║');
  console.log('╚══════════════════════════════════════════════╝');

  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
