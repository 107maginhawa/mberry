#!/usr/bin/env bun
/**
 * E2E Seed Data Diagnostic Script
 *
 * Checks every module's seed data for: missing relationships, orphaned FKs,
 * empty tables that should have data, broken joins, and data quality issues.
 *
 * Run: cd services/api-ts && bun run ../scripts/diagnose-seed-data.ts
 * Requires: DATABASE_URL env var or defaults to localhost
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'] || 'postgres://postgres@localhost:5432/monobase';
const pool = new Pool({ connectionString: DATABASE_URL });

interface Issue {
  module: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  detail: string;
  fix: string;
}

const issues: Issue[] = [];

function report(module: string, severity: Issue['severity'], issue: string, detail: string, fix: string) {
  issues.push({ module, severity, issue, detail, fix });
}

async function query(sql: string): Promise<any[]> {
  const result = await pool.query(sql);
  return result.rows;
}

async function count(table: string): Promise<number> {
  try {
    const rows = await query(`SELECT count(*)::int as c FROM "${table}"`);
    return rows[0]?.c ?? 0;
  } catch {
    return -1; // table doesn't exist
  }
}

// ═══════════════════════════════════════════════════════════════
// Module Diagnostics
// ═══════════════════════════════════════════════════════════════

async function checkIdentity() {
  const persons = await count('person');
  const users = await count('user');

  if (persons === 0) report('Identity', 'CRITICAL', 'No persons', `person table has ${persons} rows`, 'Run seed-scenarios');
  if (users === 0) report('Identity', 'CRITICAL', 'No users', `user table has ${users} rows`, 'Run seed-scenarios');

  // Orphaned users (no person) — check via email match
  try {
    const orphanedUsers = await query(`
      SELECT count(*)::int as c FROM "user" u
      LEFT JOIN person p ON p.email = u.email
      WHERE p.id IS NULL
    `);
    if (orphanedUsers[0]?.c > 0) {
      report('Identity', 'HIGH', 'Orphaned users', `${orphanedUsers[0].c} users with no person record`, 'Create person for each user');
    }
  } catch { /* skip if schema differs */ }

  // Persons without names
  const noName = await query(`SELECT count(*)::int as c FROM person WHERE first_name IS NULL OR first_name = ''`);
  if (noName[0]?.c > 0) {
    report('Identity', 'MEDIUM', 'Nameless persons', `${noName[0].c} persons with no first_name`, 'Add names to seed data');
  }

  console.log(`  ✓ Identity: ${persons} persons, ${users} users`);
}

async function checkMembership() {
  const memberships = await count('membership');
  const tiers = await count('membership_tier');
  const categories = await count('membership_category');
  const apps = await count('membership_application');

  if (memberships === 0) report('Membership', 'CRITICAL', 'No memberships', '', 'Run seed-scenarios');

  // Memberships with no person
  try {
    const noPersonMembership = await query(`
      SELECT count(*)::int as c FROM membership m
      LEFT JOIN person p ON p.id::text = m.person_id::text
      WHERE p.id IS NULL
    `);
    if (noPersonMembership[0]?.c > 0) {
      report('Membership', 'CRITICAL', 'Orphaned memberships', `${noPersonMembership[0].c} memberships with no person`, 'Fix person_id FK');
    }
  } catch { /* type mismatch */ }

  // Status distribution
  const statuses = await query(`SELECT status, count(*)::int as c FROM membership GROUP BY status ORDER BY c DESC`);
  const statusStr = statuses.map((s: any) => `${s.status}=${s.c}`).join(', ');

  console.log(`  ✓ Membership: ${memberships} memberships (${statusStr}), ${tiers} tiers, ${categories} categories, ${apps} applications`);
}

async function checkDuesInvoices() {
  const invoices = await count('dues_invoice');

  if (invoices === 0) {
    report('Dues/Invoices', 'CRITICAL', 'No invoices', '', 'Run seed-scenarios Phase 17');
    return;
  }

  // Invoice status distribution
  const statuses = await query(`SELECT status, count(*)::int as c FROM dues_invoice GROUP BY status ORDER BY c DESC`);
  const statusStr = statuses.map((s: any) => `${s.status}=${s.c}`).join(', ');

  // Invoices with no membership
  try {
    const noMembership = await query(`
      SELECT count(*)::int as c FROM dues_invoice di
      LEFT JOIN membership m ON m.id::text = di.membership_id::text
      WHERE m.id IS NULL
    `);
    if (noMembership[0]?.c > 0) {
      report('Dues/Invoices', 'HIGH', 'Orphaned invoices', `${noMembership[0].c} invoices with no membership`, 'Fix membership_id FK');
    }
  } catch { /* type mismatch — skip */ }

  // Invoices with no person
  try {
    const noPerson = await query(`
      SELECT count(*)::int as c FROM dues_invoice di
      LEFT JOIN person p ON p.id::text = di.person_id::text
      WHERE p.id IS NULL
    `);
    if (noPerson[0]?.c > 0) {
      report('Dues/Invoices', 'HIGH', 'Invoices without person', `${noPerson[0].c} invoices have orphaned person_id`, 'Fix person_id FK');
    }
  } catch { /* type mismatch — skip */ }

  console.log(`  ✓ Invoices: ${invoices} (${statusStr})`);
}

async function checkDuesPayments() {
  const payments = await count('dues_payment');

  if (payments === 0) {
    report('Dues/Payments', 'CRITICAL', 'No payments', '', 'Run seed-scenarios');
    return;
  }

  // Payment status distribution
  const statuses = await query(`SELECT status, count(*)::int as c FROM dues_payment GROUP BY status ORDER BY c DESC`);
  const statusStr = statuses.map((s: any) => `${s.status}=${s.c}`).join(', ');

  // Payments with NULL invoice_id
  const noInvoice = await query(`SELECT count(*)::int as c FROM dues_payment WHERE invoice_id IS NULL`);
  if (noInvoice[0]?.c > 0) {
    report('Dues/Payments', 'HIGH', 'Payments not linked to invoices', `${noInvoice[0].c} payments have invoice_id = NULL`, 'Link payments to their invoices');
  }

  // Payments with no person (will show "Unknown member" in UI)
  const noPerson = await query(`
    SELECT count(*)::int as c FROM dues_payment dp
    LEFT JOIN person p ON p.id::text = dp.person_id::text
    WHERE p.id IS NULL
  `);
  if (noPerson[0]?.c > 0) {
    report('Dues/Payments', 'CRITICAL', 'Payments with no person (shows "Unknown member")', `${noPerson[0].c} payments have orphaned person_id`, 'Fix person_id references');
  }

  // Payments where person exists but has no name
  const noName = await query(`
    SELECT count(*)::int as c FROM dues_payment dp
    JOIN person p ON p.id::text = dp.person_id::text
    WHERE p.first_name IS NULL OR p.first_name = ''
  `);
  if (noName[0]?.c > 0) {
    report('Dues/Payments', 'HIGH', 'Payments with nameless person', `${noName[0].c} payments linked to person with no name`, 'Add names to person records');
  }

  console.log(`  ✓ Payments: ${payments} (${statusStr})`);
}

async function checkDuesFunds() {
  const funds = await count('dues_fund');
  const allocations = await count('dues_fund_allocation');

  if (funds === 0) {
    report('Dues/Funds', 'HIGH', 'No funds configured', '', 'Run seed-scenarios Phase 17');
  }

  if (allocations === 0 && funds > 0) {
    report('Dues/Funds', 'HIGH', 'No fund allocations', 'Funds exist but no payment→fund allocations', 'Run seed Phase 23');
  }

  // Allocations referencing non-existent funds
  if (allocations > 0) {
    const orphaned = await query(`
      SELECT count(*)::int as c FROM dues_fund_allocation dfa
      LEFT JOIN dues_fund df ON df.id::text = dfa.fund_id::text
      WHERE df.id IS NULL
    `);
    if (orphaned[0]?.c > 0) {
      report('Dues/Funds', 'MEDIUM', 'Orphaned fund allocations', `${orphaned[0].c} allocations reference non-existent funds`, 'Fix fund_id FK');
    }
  }

  console.log(`  ✓ Funds: ${funds} funds, ${allocations} allocations`);
}

async function checkSpecialAssessments() {
  const assessments = await count('special_assessment');
  const targets = await count('special_assessment_target');

  if (assessments === -1) {
    console.log('  ⊘ Special assessments: table not migrated');
    return;
  }

  if (assessments === 0) {
    report('Assessments', 'MEDIUM', 'No special assessments', '', 'Run seed Phase 23');
  }

  console.log(`  ✓ Assessments: ${assessments} assessments, ${targets} targets`);
}

async function checkDuesConfig() {
  const configs = await count('dues_config');
  const orgConfigs = await count('dues_org_config');
  const gatewayConfigs = await count('dues_gateway_config');
  const reminderSchedules = await count('dues_reminder_schedule');

  if (configs === 0) report('Dues/Config', 'HIGH', 'No dues configs', '', 'Run seed-scenarios Phase 17');
  if (orgConfigs === 0) report('Dues/Config', 'HIGH', 'No org dues config', '', 'Run seed-scenarios Phase 17');

  console.log(`  ✓ Dues config: ${configs} tier configs, ${orgConfigs} org configs, ${gatewayConfigs} gateways, ${reminderSchedules} reminders`);
}

async function checkEvents() {
  const evts = await count('event');
  const regs = await count('event_registration');
  const checkins = await count('check_in');

  if (evts === 0) report('Events', 'HIGH', 'No events', '', 'Run seed-scenarios');

  // Registrations with no person
  if (regs > 0) {
    const orphaned = await query(`
      SELECT count(*)::int as c FROM event_registration er
      LEFT JOIN person p ON p.id::text = er.person_id::text
      WHERE p.id IS NULL
    `);
    if (orphaned[0]?.c > 0) {
      report('Events', 'HIGH', 'Orphaned registrations', `${orphaned[0].c} registrations with no person`, 'Fix person_id FK');
    }
  }

  console.log(`  ✓ Events: ${evts} events, ${regs} registrations, ${checkins} check-ins`);
}

async function checkTraining() {
  const trainings = await count('training');
  const enrollments = await count('training_enrollment');
  const courses = await count('course');
  const courseEnrollments = await count('course_enrollment');
  const providers = await count('accredited_provider');

  if (trainings === 0) report('Training', 'HIGH', 'No trainings', '', 'Run seed-scenarios');

  console.log(`  ✓ Training: ${trainings} trainings, ${enrollments} enrollments, ${courses} courses, ${courseEnrollments} course enrollments, ${providers} providers`);
}

async function checkCredits() {
  const credits = await count('credit_entry');
  const cpdConfig = await count('org_cpd_config');

  if (credits === 0) report('Credits', 'HIGH', 'No credit entries', '', 'Run seed-scenarios');
  if (cpdConfig === 0) report('Credits', 'MEDIUM', 'No CPD config', 'CPD compliance features won\'t work', 'Run seed Phase 26');

  // Credits with no source_type
  if (credits > 0) {
    try {
      const noSource = await query(`SELECT count(*)::int as c FROM credit_entry WHERE source_type IS NULL`);
      if (noSource[0]?.c > 0) {
        report('Credits', 'MEDIUM', 'Credits without source_type', `${noSource[0].c} credits have no source_type`, 'Backfill source_type');
      }
    } catch { /* column not migrated */ }
  }

  console.log(`  ✓ Credits: ${credits} entries, ${cpdConfig} CPD configs`);
}

async function checkCertificates() {
  const certs = await count('certificate');
  const seqs = await count('org_certificate_seq');

  if (certs === 0) report('Certificates', 'HIGH', 'No certificates', '', 'Run seed-scenarios');

  // Certs with no status
  if (certs > 0) {
    const noStatus = await query(`SELECT count(*)::int as c FROM certificate WHERE status IS NULL`);
    if (noStatus[0]?.c > 0) {
      report('Certificates', 'MEDIUM', 'Certs without status', `${noStatus[0].c} certs have no status`, 'Backfill status');
    }
  }

  console.log(`  ✓ Certificates: ${certs} certs, ${seqs} sequences`);
}

async function checkGovernance() {
  const elections = await count('election');
  const nominees = await count('election_nominee');
  const votes = await count('election_vote');
  const positions = await count('position');
  const officers = await count('officer_term');

  if (elections === 0) report('Governance', 'MEDIUM', 'No elections', '', 'Run seed-scenarios Phase 19');

  console.log(`  ✓ Governance: ${elections} elections, ${nominees} nominees, ${votes} votes, ${positions} positions, ${officers} officer terms`);
}

async function checkComms() {
  const rooms = await count('chat_room');
  const members = await count('chat_room_member');
  const messages = await count('chat_message');
  const reactions = await count('chat_message_reaction');

  if (rooms > 0 && members === 0) {
    report('Comms', 'CRITICAL', 'Chat rooms without members', `${rooms} rooms but 0 chat_room_member rows`, 'Run seed Phase 24');
  }

  // Messages with threading
  if (messages > 0) {
    try {
      const threaded = await query(`SELECT count(*)::int as c FROM chat_message WHERE parent_message_id IS NOT NULL`);
      if (threaded[0]?.c === 0) {
        report('Comms', 'LOW', 'No threaded messages', 'No messages have parent_message_id set', 'Add threaded replies in seed');
      }
    } catch { /* column not migrated */ }
  }

  // Room type distribution
  if (rooms > 0) {
    try {
      const types = await query(`SELECT room_type, count(*)::int as c FROM chat_room GROUP BY room_type`);
      const typeStr = types.map((t: any) => `${t.room_type ?? 'NULL'}=${t.c}`).join(', ');
      console.log(`  ✓ Comms: ${rooms} rooms (${typeStr}), ${members} members, ${messages} messages, ${reactions} reactions`);
    } catch {
      console.log(`  ✓ Comms: ${rooms} rooms, ${members} members, ${messages} messages, ${reactions} reactions`);
    }
  } else {
    console.log(`  ✓ Comms: ${rooms} rooms, ${members} members, ${messages} messages`);
  }
}

async function checkCommunication() {
  const announcements = await count('announcement');
  const templates = await count('message_template');
  const segments = await count('saved_segment');
  const surveys = await count('survey');

  console.log(`  ✓ Communication: ${announcements} announcements, ${templates} templates, ${segments} segments, ${surveys} surveys`);
}

async function checkDocuments() {
  const docs = await count('document');
  const versions = await count('document_version');
  const accessLogs = await count('document_access_log');

  if (docs === 0) report('Documents', 'MEDIUM', 'No documents', '', 'Run seed-scenarios');

  console.log(`  ✓ Documents: ${docs} documents, ${versions} versions, ${accessLogs} access logs`);
}

async function checkBilling() {
  const invoices = await count('invoice');
  const lineItems = await count('invoice_line_item');
  const merchants = await count('merchant_account');

  console.log(`  ✓ Billing: ${invoices} invoices, ${lineItems} line items, ${merchants} merchants`);
}

async function checkNotifications() {
  const notifs = await count('notification');
  const prefs = await count('notification_preference');

  console.log(`  ✓ Notifications: ${notifs} notifications, ${prefs} preferences`);
}

async function checkStorage() {
  const files = await count('stored_file');
  console.log(`  ✓ Storage: ${files} files`);
}

async function checkJobs() {
  const postings = await count('job_posting');
  const applications = await count('job_application');

  if (postings === -1) {
    console.log('  ⊘ Jobs: table not migrated');
    return;
  }

  if (postings === 0) {
    report('Jobs', 'LOW', 'No job postings', '', 'Run seed Phase 28');
  }

  console.log(`  ✓ Jobs: ${postings} postings, ${applications} applications`);
}

async function checkSurveys() {
  // Check surveys/ module (separate from communication/survey)
  try {
    const surveys = await query(`SELECT count(*)::int as c FROM survey WHERE organization_id IS NOT NULL`);
    const responses = await query(`SELECT count(*)::int as c FROM survey_response`);

    if (surveys[0]?.c === 0) {
      report('Surveys', 'MEDIUM', 'No surveys (surveys module)', '', 'Run seed Phase 25');
    }

    console.log(`  ✓ Surveys: ${surveys[0]?.c ?? 0} surveys, ${responses[0]?.c ?? 0} responses`);
  } catch {
    console.log('  ⊘ Surveys: table not migrated');
  }
}

async function checkMarketplace() {
  const vendors = await count('vendor');
  const listings = await count('marketplace_listing');
  const orders = await count('marketplace_order');

  console.log(`  ✓ Marketplace: ${vendors} vendors, ${listings} listings, ${orders} orders`);
}

async function checkPrivacy() {
  const settings = await count('person_privacy_setting');

  if (settings > 0) {
    const withCredentials = await query(`SELECT count(*)::int as c FROM person_privacy_setting WHERE credentials_visible = true`);
    const withDues = await query(`SELECT count(*)::int as c FROM person_privacy_setting WHERE dues_status_visible = true`);
    console.log(`  ✓ Privacy: ${settings} settings (${withCredentials[0]?.c ?? 0} credentials visible, ${withDues[0]?.c ?? 0} dues visible)`);
  } else {
    console.log(`  ✓ Privacy: ${settings} settings`);
  }
}

async function checkDirectoryProfiles() {
  const profiles = await count('directory_profile');
  console.log(`  ✓ Directory: ${profiles} profiles`);
}

async function checkAudit() {
  const logs = await count('audit_log_entry');
  console.log(`  ✓ Audit: ${logs} log entries`);
}

async function checkCommittees() {
  const committees = await count('committee');
  const members = await count('committee_member');
  const tasks = await count('committee_task');
  console.log(`  ✓ Committees: ${committees} committees, ${members} members, ${tasks} tasks`);
}

// ═══════════════════════════════════════════════════════════════
// Cross-Module Relationship Checks
// ═══════════════════════════════════════════════════════════════

async function checkCrossModuleRelationships() {
  console.log('\n── Cross-Module Relationship Checks ──');

  // 1. Dashboard API simulation: what would the overview page show?
  const dashboard = await query(`
    SELECT
      (SELECT count(*)::int FROM dues_payment WHERE status = 'completed') as completed_payments,
      (SELECT count(*)::int FROM dues_payment WHERE status = 'pending') as pending_payments,
      (SELECT count(*)::int FROM dues_payment WHERE status = 'submitted') as submitted_payments,
      (SELECT COALESCE(sum(amount), 0)::bigint FROM dues_payment WHERE status = 'completed') as total_collected,
      (SELECT COALESCE(sum(total_amount), 0)::bigint FROM dues_invoice WHERE status IN ('generated', 'sent', 'overdue')) as total_outstanding
  `);
  const d = dashboard[0];
  console.log(`  Dashboard data: ${d?.completed_payments ?? 0} completed, ${d?.pending_payments ?? 0} pending, ${d?.submitted_payments ?? 0} submitted`);
  console.log(`  Collected: ₱${((d?.total_collected ?? 0) / 100).toLocaleString()}, Outstanding: ₱${((d?.total_outstanding ?? 0) / 100).toLocaleString()}`);

  // 2. Activity feed: payments with person names
  const recentPayments = await query(`
    SELECT dp.id, dp.amount, dp.status, dp.payment_method, dp.created_at,
           p.first_name, p.last_name
    FROM dues_payment dp
    LEFT JOIN person p ON p.id::text = dp.person_id::text
    ORDER BY dp.created_at DESC
    LIMIT 5
  `);
  let unknownCount = 0;
  for (const pay of recentPayments) {
    if (!pay.first_name && !pay.last_name) unknownCount++;
  }
  if (unknownCount > 0) {
    report('Cross-Module', 'CRITICAL', 'Activity feed shows "Unknown member"',
      `${unknownCount} of last 5 payments have no person name (NULL first_name + last_name)`,
      'Fix: payment person_id points to person without name, or person_id is wrong');

    // Dig deeper
    const badPayments = await query(`
      SELECT dp.person_id, dp.receipt_number, p.id as person_exists, p.first_name, p.last_name, p.email
      FROM dues_payment dp
      LEFT JOIN person p ON p.id::text = dp.person_id::text
      WHERE p.first_name IS NULL OR p.first_name = ''
      LIMIT 10
    `);
    for (const bp of badPayments) {
      console.log(`    BAD: receipt=${bp.receipt_number} person_id=${bp.person_id} exists=${bp.person_exists ? 'YES' : 'NO'} name="${bp.first_name ?? ''} ${bp.last_name ?? ''}" email=${bp.email ?? 'null'}`);
    }
  }

  // 3. Monthly trend: check if dues-metrics endpoint would return data
  const monthlyPayments = await query(`
    SELECT date_trunc('month', created_at)::text as month, count(*)::int as c, sum(amount)::bigint as total
    FROM dues_payment
    WHERE status = 'completed'
    GROUP BY date_trunc('month', created_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  if (monthlyPayments.length === 0) {
    report('Cross-Module', 'HIGH', 'No monthly payment data for chart', 'Collections Over Time chart will show "No data"', 'Ensure completed payments have varied created_at dates');
  } else {
    console.log(`  Monthly data: ${monthlyPayments.length} months with payments`);
  }

  // 4. Members financial view: balance computation
  try {
  const membersWithBalance = await query(`
    SELECT m.person_id, p.first_name, p.last_name,
           COALESCE(sum(CASE WHEN di.status IN ('generated', 'sent', 'overdue') THEN di.total_amount ELSE 0 END), 0)::bigint as outstanding
    FROM membership m
    JOIN person p ON p.id::text = m.person_id::text
    LEFT JOIN dues_invoice di ON di.person_id::text = m.person_id::text
    GROUP BY m.person_id, p.first_name, p.last_name
    HAVING COALESCE(sum(CASE WHEN di.status IN ('generated', 'sent', 'overdue') THEN di.total_amount ELSE 0 END), 0) > 0
    LIMIT 5
  `);
  console.log(`  Members with outstanding balance: ${membersWithBalance.length}`);
  } catch (e) {
    console.log(`  Members balance check failed: ${(e as Error).message?.slice(0, 60)}`);
  }

  // 5. Invoice detail: fund allocations present?
  const invoicesWithAllocations = await query(`
    SELECT di.id, di.invoice_number, di.fund_allocations
    FROM dues_invoice di
    LIMIT 3
  `);
  for (const inv of invoicesWithAllocations) {
    const allocs = inv.fund_allocations;
    if (!allocs || (Array.isArray(allocs) && allocs.length === 0)) {
      report('Cross-Module', 'MEDIUM', `Invoice ${inv.invoice_number} has no fund allocations`, 'Invoice detail page fund allocations section will be empty', 'Ensure fund_allocations JSONB is populated');
    }
  }

  // 6. Member detail: does the dues-member-summary endpoint have data?
  try {
  const memberWithInvoices = await query(`
    SELECT m.id as membership_id, m.person_id, p.first_name,
           count(di.id)::int as invoice_count,
           count(dp.id)::int as payment_count
    FROM membership m
    JOIN person p ON p.id::text = m.person_id::text
    LEFT JOIN dues_invoice di ON di.membership_id::text = m.id::text
    LEFT JOIN dues_payment dp ON dp.person_id::text = m.person_id::text
    GROUP BY m.id, m.person_id, p.first_name
    LIMIT 5
  `);
  for (const mem of memberWithInvoices) {
    if (mem.invoice_count === 0 && mem.payment_count === 0) {
      // Not necessarily an issue — some members may not have dues yet
    }
  }
  console.log(`  Member financial data sampled: ${memberWithInvoices.length} members checked`);
  } catch (e) {
    console.log(`  Member detail check failed: ${(e as Error).message?.slice(0, 60)}`);
  }

  // 7-10: Cross-module person checks
  try {
  const eventRegs = await query(`
    SELECT er.id, er.person_id, p.first_name, p.last_name
    FROM event_registration er
    LEFT JOIN person p ON p.id::text = er.person_id::text
    WHERE p.first_name IS NULL
    LIMIT 5
  `);
  if (eventRegs.length > 0) {
    report('Cross-Module', 'HIGH', 'Event registrations with nameless persons', `${eventRegs.length} registrations have no person name`, 'Fix person records');
  }

  // 8. Training enrollments with person data
  const trainingEnrolls = await query(`
    SELECT te.id, te.person_id, p.first_name
    FROM training_enrollment te
    LEFT JOIN person p ON p.id::text = te.person_id::text
    WHERE p.first_name IS NULL
    LIMIT 5
  `);
  if (trainingEnrolls.length > 0) {
    report('Cross-Module', 'HIGH', 'Training enrollments with nameless persons', `${trainingEnrolls.length} enrollments have no person name`, 'Fix person records');
  }

  // 9. Certificates with person data
  const certsNoPerson = await query(`
    SELECT c.id, c.person_id, p.first_name
    FROM certificate c
    LEFT JOIN person p ON p.id::text = c.person_id::text
    WHERE p.id IS NULL
    LIMIT 5
  `);
  if (certsNoPerson.length > 0) {
    report('Cross-Module', 'HIGH', 'Certificates with orphaned person_id', `${certsNoPerson.length} certs reference non-existent person`, 'Fix person_id FK');
  }

  // 10. Officer terms with person data
  const officersNoPerson = await query(`
    SELECT ot.id, ot.person_id, p.first_name
    FROM officer_term ot
    LEFT JOIN person p ON p.id::text = ot.person_id::text
    WHERE p.id IS NULL
    LIMIT 5
  `);
  if (officersNoPerson.length > 0) {
    report('Cross-Module', 'HIGH', 'Officer terms with orphaned person_id', `${officersNoPerson.length} officers reference non-existent person`, 'Fix person_id FK');
  }
  } catch (e) {
    console.log(`  Person cross-checks failed: ${(e as Error).message?.slice(0, 60)}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     SEED DATA E2E DIAGNOSTIC                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  console.log('── Module Table Counts ──');

  await checkIdentity();
  await checkMembership();
  await checkDuesConfig();
  await checkDuesInvoices();
  await checkDuesPayments();
  await checkDuesFunds();
  await checkSpecialAssessments();
  await checkEvents();
  await checkTraining();
  await checkCredits();
  await checkCertificates();
  await checkGovernance();
  await checkComms();
  await checkCommunication();
  await checkDocuments();
  await checkBilling();
  await checkNotifications();
  await checkStorage();
  await checkJobs();
  await checkSurveys();
  await checkMarketplace();
  await checkPrivacy();
  await checkDirectoryProfiles();
  await checkAudit();
  await checkCommittees();

  await checkCrossModuleRelationships();

  // ─── Report ──
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     ISSUE REPORT                             ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const high = issues.filter(i => i.severity === 'HIGH');
  const medium = issues.filter(i => i.severity === 'MEDIUM');
  const low = issues.filter(i => i.severity === 'LOW');

  if (issues.length === 0) {
    console.log('  ✅ No issues found!');
  } else {
    console.log(`  Found ${issues.length} issues: ${critical.length} CRITICAL, ${high.length} HIGH, ${medium.length} MEDIUM, ${low.length} LOW\n`);

    for (const issue of issues) {
      const icon = issue.severity === 'CRITICAL' ? '🔴' : issue.severity === 'HIGH' ? '🟠' : issue.severity === 'MEDIUM' ? '🟡' : '⚪';
      console.log(`  ${icon} [${issue.severity}] ${issue.module}: ${issue.issue}`);
      if (issue.detail) console.log(`     ${issue.detail}`);
      console.log(`     Fix: ${issue.fix}`);
      console.log('');
    }
  }

  await pool.end();

  // Exit with error code if critical issues found
  if (critical.length > 0) process.exit(1);
}

main().catch(err => {
  console.error('Diagnostic failed:', err);
  pool.end();
  process.exit(2);
});
