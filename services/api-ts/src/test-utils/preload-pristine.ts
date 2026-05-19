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
 */
import { ensurePristine } from './make-ctx';

// Repo classes that get stubbed across test files
import { MembershipApplicationRepository, MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { PlatformAdminRepository, ImpersonationSessionRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import { BookingEventRepository } from '@/handlers/booking/repos/bookingEvent.repo';
import { TimeSlotRepository } from '@/handlers/booking/repos/timeSlot.repo';
import { ScheduleExceptionRepository } from '@/handlers/booking/repos/scheduleException.repo';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { InvoiceRepository, MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { DocumentRepository, DocumentVersionRepository } from '@/handlers/documents/repos/documents.repo';

for (const Repo of [
  MembershipApplicationRepository,
  MembershipRepository,
  OfficerTermRepository,
  PlatformAdminRepository,
  ImpersonationSessionRepository,
  BookingEventRepository,
  TimeSlotRepository,
  ScheduleExceptionRepository,
  DuesRepository,
  InvoiceRepository,
  MerchantAccountRepository,
  ElectionsRepository,
  DocumentRepository,
  DocumentVersionRepository,
]) {
  ensurePristine(Repo);
}
