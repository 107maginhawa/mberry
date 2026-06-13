/**
 * buildMyDataExport — FIX-008 (G-08)
 *
 * Single source of truth for the DPA 2012 personal-data export envelope, shared
 * by the sync export (`exportMyData`, GET /persons/me/export) and the async
 * export (`requestDataExport`, stored into data_export.payload). Returning the
 * SAME shape from both paths removes the drift that left the contract and the
 * stored payload disagreeing (the same two-list hazard FIX-003 fixed for scrub).
 *
 * The shape matches the `MyDataExport` TypeSpec model + certificates + a
 * top-level prcId. EF-M01: the `profile` projection strips internal IDs,
 * timestamps, deletion fields, system metadata, and prcId (prcId is surfaced
 * as a dedicated top-level field, never inside the profile).
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { PersonRepository } from '../repos/person.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { duesPayments } from '@/handlers/association:member/repos/dues-payments.schema';
import { certificates } from '@/handlers/member/certificates/repos/certificates.schema';
import { notifications } from '@/core/schema-registry';

export interface MyDataExportEnvelope {
  exportedAt: string;
  categories: string[];
  profile: Record<string, unknown>;
  memberships: unknown[];
  payments: unknown[];
  credits: unknown[];
  notifications: unknown[];
  certificates: unknown[];
  prcId?: string;
}

export async function buildMyDataExport(
  db: DatabaseInstance,
  logger: any,
  personId: string,
): Promise<MyDataExportEnvelope> {
  const personRepo = new PersonRepository(db, logger);
  const membershipRepo = new MembershipRepository(db, logger);
  const creditRepo = new CreditEntryRepository(db, logger);

  const [person, memberships, credits, payments, certificateRows, notificationRows] = await Promise.all([
    personRepo.findOneById(personId),
    membershipRepo.findAllByPerson(personId),
    creditRepo.findMany({ personId }),
    db.select().from(duesPayments).where(eq(duesPayments.personId, personId)),
    db.select().from(certificates).where(eq(certificates.personId, personId)),
    db.select().from(notifications).where(eq(notifications.recipient, personId)),
  ]);

  // EF-M01: GDPR-appropriate fields only — exclude internal IDs, timestamps,
  // deletion fields, system metadata, and prcId (surfaced top-level below).
  const profile: Record<string, unknown> = person
    ? {
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
        dateOfBirth: person.dateOfBirth,
        gender: person.gender,
        primaryAddress: person.primaryAddress,
        contactInfo: person.contactInfo,
        avatar: person.avatar,
        languagesSpoken: person.languagesSpoken,
        timezone: person.timezone,
        licenseNumber: person.licenseNumber,
        specialization: person.specialization,
        preferredLanguage: person.preferredLanguage,
        bio: person.bio,
      }
    : {};

  return {
    exportedAt: new Date().toISOString(),
    categories: ['profile', 'memberships', 'payments', 'credits', 'notifications', 'certificates'],
    profile,
    memberships,
    payments,
    credits,
    notifications: notificationRows,
    certificates: certificateRows,
    prcId: person?.prcId ?? undefined,
  };
}
