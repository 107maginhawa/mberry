import type { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { memberships, membershipApplications } from '@/handlers/association:member/repos/membership.schema';
import { positions, officerTerms } from '@/handlers/association:member/repos/governance.schema';
import { platformAdmins } from '@/handlers/platformadmin/repos/platform-admin.schema';
import { user as userTable } from '@/generated/better-auth/schema';
import { SeedClient } from './client';
import { verifyEmail, ACTIVE_EXPIRY, graceExpiry, lapsedExpiry, TERM_START, TERM_END, MEMBERSHIP_START, daysAgo } from './helpers';
import { OFFICERS, MEMBERS, APPLICANTS } from './data';

// ═══════════════════════════════════════════════════════════════
// Phase 1: President (hybrid — API sign-up + DB bootstrap)
// ═══════════════════════════════════════════════════════════════

export async function seedPresident(
  db: ReturnType<typeof drizzle>,
  orgId: string, regularTierId: string,
): Promise<SeedClient> {
  console.log('\nPhase 1: President (Maria Santos)...');
  const o = OFFICERS[0]!;
  const client = new SeedClient(orgId);

  await client.signUp(o.email, `${o.firstName} ${o.lastName}`);
  await verifyEmail(db, o.email);
  // Re-sign-in after email verify to get fresh session
  await client.signIn(o.email);

  await client.createPerson({
    firstName: o.firstName, lastName: o.lastName,
    specialization: o.spec, licenseNumber: o.license,
    dateOfBirth: '1978-03-15', gender: 'female',
  });

  // DB: membership (chicken-and-egg — no officer exists to approve)
  const existingMembership = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMembership.length === 0) {
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: 'PDA-2025-001',
      startDate: MEMBERSHIP_START, duesExpiryDate: ACTIVE_EXPIRY,
      gracePeriodDays: 30, status: 'active', joinedAt: daysAgo(365),
    });
  }

  // DB: position + officer term
  const existingPos = await db.select().from(positions)
    .where(eq(positions.title, 'President')).limit(1);
  let presPos: { id: string };
  if (existingPos.length === 0) {
    const [inserted] = await db.insert(positions).values({
      organizationId: orgId, title: 'President',
      level: 'chapter', termLengthMonths: 12, sortOrder: 1,
    }).returning({ id: positions.id });
    presPos = inserted!;
  } else {
    presPos = existingPos[0]!;
  }

  const existingTerm = await db.select().from(officerTerms)
    .where(eq(officerTerms.personId, client.personId)).limit(1);
  if (existingTerm.length === 0) {
    await db.insert(officerTerms).values({
      positionId: presPos.id, personId: client.personId,
      organizationId: orgId, status: 'active',
      startDate: TERM_START, endDate: TERM_END,
    });
  }

  // Platform admin
  const existingAdmin = await db.select().from(platformAdmins)
    .where(eq(platformAdmins.email, o.email)).limit(1);
  if (existingAdmin.length === 0) {
    await db.insert(platformAdmins).values({
      userId: client.userId, email: o.email, name: `${o.firstName} ${o.lastName}`, role: 'super',
    });
  }

  // Set admin role so president can access all association endpoints (plus
  // platform_admin so the admin app's /admin/me/role endpoint is reachable —
  // seedPresident also inserts Maria into the platform_admin table).
  await db.update(userTable).set({ role: 'admin,platform_admin,association:admin,association:member,association:officer' }).where(eq(userTable.id, client.userId));

  console.log(`  ✓ Maria Santos — President, membership PDA-2025-001`);
  return client;
}

// ═══════════════════════════════════════════════════════════════
// Phase 2: Officers 2-5 (API-driven)
// ═══════════════════════════════════════════════════════════════

export async function seedOfficer(
  db: ReturnType<typeof drizzle>,
  officer: typeof OFFICERS[0],
  orgId: string, regularTierId: string,
  president: SeedClient, memberNum: string,
): Promise<SeedClient> {
  const client = new SeedClient(orgId);
  await client.signUp(officer.email, `${officer.firstName} ${officer.lastName}`);
  await verifyEmail(db, officer.email);
  await client.signIn(officer.email);

  await client.createPerson({
    firstName: officer.firstName, lastName: officer.lastName,
    specialization: officer.spec, licenseNumber: officer.license,
    dateOfBirth: '1980-06-20', gender: officer.firstName === 'Juan' || officer.firstName === 'Carlos' ? 'male' : 'female',
  });

  // Create application + approve + membership via DB (2FA on requirePosition blocks API approve)
  const app = await president.post('/association/member/applications', {
    organizationId: orgId,
    personId: client.personId,
    tierId: regularTierId,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  if (app && !app.__conflict) {
    const appId = app.id || app.data?.id;
    if (appId) {
      // DB approve: update application status + create membership
      await db.update(membershipApplications)
        .set({ status: 'approved', reviewedAt: new Date() })
        .where(eq(membershipApplications.id, appId));
    }
  }

  // Create membership via DB
  const existingMbr = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMbr.length === 0) {
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: memberNum,
      startDate: MEMBERSHIP_START,
      duesExpiryDate: ACTIVE_EXPIRY,
      gracePeriodDays: 30, status: 'active', joinedAt: daysAgo(365),
    });
  }

  // Set officer role (needs member+officer+admin for all endpoint access)
  await db.update(userTable).set({ role: 'association:admin,association:member,association:officer' }).where(eq(userTable.id, client.userId));

  // Create position + officer term via DB (requirePosition check blocks API)
  const existingPos = await db.select().from(positions)
    .where(eq(positions.title, officer.position)).limit(1);
  let pos: { id: string };
  if (existingPos.length === 0) {
    const [inserted] = await db.insert(positions).values({
      organizationId: orgId, title: officer.position,
      level: 'chapter', termLengthMonths: 12, sortOrder: OFFICERS.indexOf(officer) + 1,
    }).returning({ id: positions.id });
    pos = inserted!;
  } else {
    pos = existingPos[0]!;
  }

  const existingTerm = await db.select().from(officerTerms)
    .where(eq(officerTerms.personId, client.personId)).limit(1);
  if (existingTerm.length === 0) {
    await db.insert(officerTerms).values({
      positionId: pos.id, personId: client.personId,
      organizationId: orgId, status: 'active',
      startDate: TERM_START, endDate: TERM_END,
    });
  }

  console.log(`  ✓ ${officer.firstName} ${officer.lastName} — ${officer.position}, ${memberNum}`);
  return client;
}

// ═══════════════════════════════════════════════════════════════
// Phase 3: Regular Members (API-driven)
// ═══════════════════════════════════════════════════════════════

export async function seedMember(
  db: ReturnType<typeof drizzle>,
  member: typeof MEMBERS[0],
  orgId: string, regularTierId: string,
  president: SeedClient, memberNum: string,
): Promise<SeedClient> {
  const client = new SeedClient(orgId);
  await client.signUp(member.email, `${member.firstName} ${member.lastName}`);
  await verifyEmail(db, member.email);
  await client.signIn(member.email);

  await client.createPerson({
    firstName: member.firstName, lastName: member.lastName,
    specialization: member.spec, licenseNumber: member.license,
    dateOfBirth: `19${80 + Math.floor(Math.random() * 15)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    gender: ['Isabella', 'Patricia', 'Carmen', 'Teresa', 'Rosa', 'Lucia', 'Gabriela', 'Andrea', 'Valeria', 'Catalina', 'Mariana', 'Daniela', 'Claudia'].includes(member.firstName) ? 'female' : 'male',
  });

  // Create application via API (proper person linkage), approve + membership via DB (2FA blocks API)
  const app = await president.post('/association/member/applications', {
    organizationId: orgId,
    personId: client.personId,
    tierId: regularTierId,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  if (app && !app.__conflict) {
    const appId = app.id || app.data?.id;
    if (appId) {
      await db.update(membershipApplications)
        .set({ status: 'approved', reviewedAt: new Date() })
        .where(eq(membershipApplications.id, appId));
    }
  }

  // Set member role
  await db.update(userTable).set({ role: 'association:member' }).where(eq(userTable.id, client.userId));

  // Create membership via DB — status-specific dates and fields
  let duesExpiry: string;
  let dbStatus: string = member.status;
  let suspendedAt: Date | null = null;
  let removedAt: Date | null = null;
  let removalReason: string | null = null;

  switch (member.status) {
    case 'active':
      duesExpiry = ACTIVE_EXPIRY; // +7 months
      dbStatus = 'active';
      break;
    case 'grace':
      duesExpiry = graceExpiry(15); // expired 15 days ago (within 30-day grace)
      dbStatus = 'gracePeriod'; // stored as gracePeriod enum value
      break;
    case 'lapsed':
      duesExpiry = lapsedExpiry(75); // expired 75 days ago (past 30-day grace)
      dbStatus = 'lapsed';
      break;
    case 'suspended':
      duesExpiry = ACTIVE_EXPIRY; // was active before suspension
      dbStatus = 'suspended';
      suspendedAt = daysAgo(14); // suspended 2 weeks ago
      break;
    case 'removed':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'removed';
      removedAt = daysAgo(30); // removed 1 month ago
      removalReason = 'Fraudulent credentials — license number verified as invalid by PRC';
      break;
    case 'expired':
      duesExpiry = lapsedExpiry(400); // expired over a year ago
      dbStatus = 'expired';
      break;
    case 'resigned':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'resigned';
      break;
    case 'pendingPayment':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'pendingPayment';
      break;
    case 'deceased':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'deceased';
      break;
    case 'expelled':
      duesExpiry = ACTIVE_EXPIRY;
      dbStatus = 'expelled';
      removedAt = daysAgo(45);
      removalReason = 'Expelled after disciplinary hearing — violations of professional ethics code';
      break;
    default:
      duesExpiry = ACTIVE_EXPIRY;
  }

  const existingMbr = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMbr.length === 0) {
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: memberNum,
      startDate: MEMBERSHIP_START,
      duesExpiryDate: duesExpiry,
      gracePeriodDays: 30,
      status: dbStatus as typeof memberships.$inferInsert['status'],
      joinedAt: daysAgo(365),
      suspendedAt,
      removedAt,
      removalReason,
    });
  }

  return client;
}

// ═══════════════════════════════════════════════════════════════
// Phase 4: Pending Applicants (API-driven, NOT approved)
// ═══════════════════════════════════════════════════════════════

export async function seedApplicant(
  db: ReturnType<typeof drizzle>,
  applicant: typeof APPLICANTS[0],
  orgId: string, regularTierId: string,
  president: SeedClient,
): Promise<void> {
  const client = new SeedClient(orgId);
  await client.signUp(applicant.email, `${applicant.firstName} ${applicant.lastName}`);
  await verifyEmail(db, applicant.email);
  await client.signIn(applicant.email);

  await client.createPerson({
    firstName: applicant.firstName, lastName: applicant.lastName,
    specialization: applicant.spec, licenseNumber: applicant.license,
    dateOfBirth: '1992-08-10', gender: applicant.firstName === 'Manuel' ? 'male' : 'female',
  });

  // President submits application on behalf
  const app = await president.post('/association/member/applications', {
    organizationId: orgId,
    personId: client.personId,
    tierId: regularTierId,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  // If rejected applicant, update via DB
  if (applicant.rejected && app && !app.__conflict) {
    const appId = app.id || app.data?.id;
    if (appId) {
      await db.update(membershipApplications)
        .set({ status: 'denied', reviewedAt: new Date() })
        .where(eq(membershipApplications.id, appId));
    }
  }

  console.log(`  ✓ ${applicant.firstName} ${applicant.lastName} — ${applicant.rejected ? 'rejected' : 'pending'} applicant`);
}

// ═══════════════════════════════════════════════════════════════
// IDOR Test Officer (org2) — required by route-protection-idor.test.ts
// ═══════════════════════════════════════════════════════════════

export async function seedIdorOfficer(db: ReturnType<typeof drizzle>, org2Id: string, tierId: string) {
  const email = 'idor-officer@memberry.ph';
  const client = new SeedClient(org2Id);
  await client.signUp(email, 'IDOR Test Officer');
  await verifyEmail(db, email);
  await client.signIn(email);

  await client.createPerson({
    firstName: 'IDOR', lastName: 'Officer',
    specialization: 'General Dentistry', licenseNumber: '0099998',
    dateOfBirth: '1985-01-01', gender: 'male',
  });

  // Set role. Mirror the other seeded officers (vicepresident/boardmember):
  // this user has a membership row + officer term below, so it must carry
  // association:member (member-content routes like listAnnouncements enforce
  // authMiddleware({roles:["association:member"]}) at the session-role level).
  // Without it the dashboard's announcements widget 403'd — a swallowed 4xx the
  // e2e journey-firewall (cross-org-isolation.spec) flags on the success path.
  await db.update(userTable).set({ role: 'association:admin,association:member,association:officer' }).where(eq(userTable.id, client.userId));

  // Membership in org2
  const existingMbr = await db.select().from(memberships)
    .where(eq(memberships.personId, client.personId)).limit(1);
  if (existingMbr.length === 0) {
    await db.insert(memberships).values({
      organizationId: org2Id, personId: client.personId,
      tierId, memberNumber: 'PDA-CEBU-001',
      startDate: MEMBERSHIP_START, duesExpiryDate: ACTIVE_EXPIRY,
      gracePeriodDays: 30, status: 'active', joinedAt: daysAgo(365),
    });
  }

  // Position + officer term in org2
  const existingPos = await db.select().from(positions)
    .where(eq(positions.title, 'IDOR Officer')).limit(1);
  let pos: { id: string };
  if (existingPos.length === 0) {
    const [inserted] = await db.insert(positions).values({
      organizationId: org2Id, title: 'IDOR Officer',
      level: 'chapter', termLengthMonths: 12, sortOrder: 1,
    }).returning({ id: positions.id });
    pos = inserted!;
  } else {
    pos = existingPos[0]!;
  }

  const existingTerm = await db.select().from(officerTerms)
    .where(eq(officerTerms.personId, client.personId)).limit(1);
  if (existingTerm.length === 0) {
    await db.insert(officerTerms).values({
      positionId: pos.id, personId: client.personId,
      organizationId: org2Id, status: 'active',
      startDate: TERM_START, endDate: TERM_END,
    });
  }

  console.log(`  ✓ IDOR Officer — org2 (pda-cebu), ${email}`);
}

// ═══════════════════════════════════════════════════════════════
// Missing role users (VP, board member, staff, platform support/viewer)
// ═══════════════════════════════════════════════════════════════

export async function seedMissingRoles(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  regularTierId: string,
) {
  console.log('  Missing role users...');

  const roleUsers = [
    { email: 'vicepresident@memberry.ph', firstName: 'Miguel', lastName: 'Torres', position: 'Vice President', dbRole: 'association:admin,association:member,association:officer', spec: 'Orthodontics', license: '0300001', memberNum: 'MM-030' },
    { email: 'boardmember@memberry.ph', firstName: 'Celeste', lastName: 'Mendoza', position: 'Board Member', dbRole: 'association:admin,association:member', spec: 'Pediatric Dentistry', license: '0300002', memberNum: 'MM-031' },
    { email: 'staff@memberry.ph', firstName: 'Renato', lastName: 'Soriano', position: null, dbRole: 'association:member', spec: 'General Dentistry', license: '0300003', memberNum: 'MM-032' },
  ];

  for (const ru of roleUsers) {
    // Check if user exists
    const existingUser = (await db.execute(sql`SELECT id FROM "user" WHERE email = ${ru.email} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
    if (existingUser.rows?.length > 0) {
      console.log(`    (${ru.email} already exists, skipping)`);
      continue;
    }

    // Sign up via API
    const client = new SeedClient(orgId);
    await client.signUp(ru.email, `${ru.firstName} ${ru.lastName}`);
    await verifyEmail(db, ru.email);
    await client.signIn(ru.email);

    await client.createPerson({
      firstName: ru.firstName, lastName: ru.lastName,
      specialization: ru.spec, licenseNumber: ru.license,
      dateOfBirth: '1978-03-15', gender: ['Celeste'].includes(ru.firstName) ? 'female' : 'male',
    });

    // Set role
    await db.update(userTable).set({ role: ru.dbRole }).where(eq(userTable.id, client.userId));

    // Create membership
    await db.insert(memberships).values({
      organizationId: orgId, personId: client.personId,
      tierId: regularTierId, memberNumber: ru.memberNum,
      startDate: MEMBERSHIP_START,
      duesExpiryDate: ACTIVE_EXPIRY,
      gracePeriodDays: 30, status: 'active', joinedAt: daysAgo(365),
    });

    // Create position + officer term (if applicable)
    if (ru.position) {
      const existingPos = await db.select().from(positions)
        .where(eq(positions.title, ru.position)).limit(1);
      let pos: { id: string };
      if (existingPos.length === 0) {
        const [inserted] = await db.insert(positions).values({
          organizationId: orgId, title: ru.position,
          level: 'chapter', termLengthMonths: 12, sortOrder: 10,
        }).returning({ id: positions.id });
        pos = inserted!;
      } else {
        pos = existingPos[0]!;
      }

      await db.insert(officerTerms).values({
        positionId: pos.id, personId: client.personId,
        organizationId: orgId, status: 'active',
        startDate: TERM_START, endDate: TERM_END,
      });
    }

    console.log(`    ✓ ${ru.firstName} ${ru.lastName} — ${ru.position ?? 'Staff'} (${ru.email})`);
  }

  // Platform admin roles (support + analyst) — backed by a real auth user so
  // platform_admin.userId holds a valid uuid (the column is a NOT NULL uuid FK).
  const platformRoles: Array<{ email: string; name: string; role: typeof platformAdmins.$inferInsert['role'] }> = [
    { email: 'support-admin@memberry.ph', name: 'Platform Support', role: 'support' },
    { email: 'viewer-admin@memberry.ph', name: 'Platform Viewer', role: 'analyst' },
  ];

  for (const pr of platformRoles) {
    const existing = (await db.execute(sql`SELECT id FROM platform_admin WHERE email = ${pr.email} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
    if (existing.rows?.length > 0) continue;

    const existingUser = (await db.execute(sql`SELECT id FROM "user" WHERE email = ${pr.email} LIMIT 1`)) as unknown as { rows: Array<{ id: string }> };
    let userId: string;
    if (existingUser.rows?.length > 0) {
      userId = existingUser.rows[0]!.id;
    } else {
      const client = new SeedClient(orgId);
      await client.signUp(pr.email, pr.name);
      await verifyEmail(db, pr.email);
      await client.signIn(pr.email);
      userId = client.userId;
    }

    await db.insert(platformAdmins).values({
      email: pr.email,
      name: pr.name,
      role: pr.role,
      userId,
    });
    console.log(`    ✓ ${pr.name} — platform ${pr.role} (${pr.email})`);
  }

  console.log('  Missing roles complete.');
}
