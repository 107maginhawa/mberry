/**
 * Bun test preload: eagerly capture pristine repo prototypes before
 * any test file can pollute them via stubRepo().
 *
 * Problem: ensurePristine() uses lazy "first caller wins" — in Bun's
 * parallel test execution, the first file to call stubRepo() for a class
 * captures an already-polluted prototype as "pristine." All subsequent
 * restoreRepo() calls restore to corrupted state.
 *
 * Fix: Import all repo classes and snapshot their prototypes HERE,
 * before any test file runs. Bun's preload runs before all test files.
 *
 * IMPORTANT: Every repo class used with stubRepo() in any test file
 * MUST be listed here. Run this to find missing repos:
 *   grep -roh 'stubRepo([A-Z][A-Za-z]*' src/ --include='*.test.ts' | sed 's/stubRepo(//' | sort -u
 */
// Ensure AUTH_SECRET is set for all tests (required since hardcoded fallback was removed)
if (!process.env['AUTH_SECRET']) {
  process.env['AUTH_SECRET'] = 'test-secret-for-automated-tests-minimum-32-chars';
}

import { ensurePristine } from './make-ctx';

// --- association:member repos ---
import { MembershipApplicationRepository, MembershipRepository as AssocMembershipRepository, MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { CredentialTemplateRepository, DigitalCredentialRepository } from '@/handlers/association:member/repos/credentials.repo';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';
import { ChapterAffiliationRepository, AffiliationTransferRepository } from '@/handlers/association:member/repos/chapters.repo';
import { DunningTemplateRepository, DunningEventRepository } from '@/handlers/association:member/repos/dunning.repo';
import { DuesConfigRepository, DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';

// --- association:operations repos ---
import { EventRegistrationRepository, WaitlistEntryRepository } from '@/handlers/association:operations/repos/events.repo';

// --- billing repos ---
import { InvoiceRepository, MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';

// --- booking repos ---
import { BookingEventRepository } from '@/handlers/booking/repos/bookingEvent.repo';
import { BookingRepository } from '@/handlers/booking/repos/booking.repo';
import { TimeSlotRepository } from '@/handlers/booking/repos/timeSlot.repo';
import { ScheduleExceptionRepository } from '@/handlers/booking/repos/scheduleException.repo';

// --- certificates repos ---
import { CertificatesRepository } from '@/handlers/certificates/repos/certificates.repo';

// --- communication repos ---
import { CommunicationsRepository, MessageRepository, MessageTemplateRepository, SubscriptionTopicRepository, PersonSubscriptionRepository } from '@/handlers/communication/repos/communication.repo';

// --- documents repos ---
import { DocumentRepository, DocumentVersionRepository, DocumentAccessLogRepository, DocumentTagRepository } from '@/handlers/documents/repos/documents.repo';

// --- dues repos ---
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

// --- elections repos ---
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

// --- email repos ---
import { EmailQueueRepository } from '@/handlers/email/repos/queue.repo';
import { EmailTemplateRepository } from '@/handlers/email/repos/template.repo';
import { SuppressionRepository } from '@/handlers/email/repos/suppression.repo';

// --- events repos ---
import { EventsRepository } from '@/handlers/events/repos/events.repo';

// --- invite repos ---
import { InviteRepository } from '@/handlers/invite/repos/invite.repo';

// --- membership repos (standalone module, separate from association:member) ---
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

// --- notifs repos ---
import { NotificationRepository } from '@/handlers/notifs/repos/notification.repo';

// --- person repos ---
import { PersonRepository } from '@/handlers/person/repos/person.repo';

// --- platformadmin repos ---
import { PlatformAdminRepository, ImpersonationSessionRepository, AssociationRepository, OrganizationRepository, FeatureFlagRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';

// --- reviews repos ---
import { ReviewRepository } from '@/handlers/reviews/repos/review.repo';

// --- storage repos ---
import { StorageFileRepository } from '@/handlers/storage/repos/file.repo';

// --- training repos (moved to association:operations) ---
import { TrainingRepository } from '@/handlers/association:operations/repos/training.repo';
import { AccreditedProviderRepository } from '@/handlers/association:operations/repos/accredited-provider.repo';

// Snapshot all 50 repo prototypes
for (const Repo of [
  // association:member
  MembershipApplicationRepository,
  AssocMembershipRepository,
  MembershipTierRepository,
  OfficerTermRepository,
  CredentialTemplateRepository,
  DigitalCredentialRepository,
  CreditEntryRepository,
  ChapterAffiliationRepository,
  AffiliationTransferRepository,
  DunningTemplateRepository,
  DunningEventRepository,
  DuesConfigRepository,
  DuesInvoiceRepository,
  // association:operations
  EventRegistrationRepository,
  WaitlistEntryRepository,
  // billing
  InvoiceRepository,
  MerchantAccountRepository,
  // booking
  BookingEventRepository,
  BookingRepository,
  TimeSlotRepository,
  ScheduleExceptionRepository,
  // certificates
  CertificatesRepository,
  // communication
  CommunicationsRepository,
  MessageRepository,
  MessageTemplateRepository,
  SubscriptionTopicRepository,
  PersonSubscriptionRepository,
  // documents
  DocumentRepository,
  DocumentVersionRepository,
  DocumentAccessLogRepository,
  DocumentTagRepository,
  // dues
  DuesRepository,
  // elections
  ElectionsRepository,
  // email
  EmailQueueRepository,
  EmailTemplateRepository,
  SuppressionRepository,
  // events
  EventsRepository,
  // invite
  InviteRepository,
  // membership (standalone)
  MembershipRepository,
  // notifs
  NotificationRepository,
  // person
  PersonRepository,
  // platformadmin
  PlatformAdminRepository,
  ImpersonationSessionRepository,
  AssociationRepository,
  OrganizationRepository,
  FeatureFlagRepository,
  // reviews
  ReviewRepository,
  // storage
  StorageFileRepository,
  // training
  TrainingRepository,
  AccreditedProviderRepository,
]) {
  ensurePristine(Repo);
}
