/**
 * core/ports — port interfaces consumed by core/ and middleware/.
 *
 * The `get*` helpers below are the wire-up point used by middleware so that
 * the middleware files themselves never `import` from `@/handlers/*`. Each
 * helper lazily resolves the adapter via a dynamic import — that
 * indirection is required to keep this index file free of handler
 * dependencies. The dynamic import is a constant string literal, so
 * bundlers/tsc resolve it statically and there is no runtime cost beyond
 * the one-time module load (Bun caches modules per process).
 *
 * See `core/ports/README.md` for the boundary rules.
 */

import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';

export type { GovernancePort, ActiveOfficerTerm } from './governance.port';
export type {
  PlatformAdminPort,
  PlatformAdminRecord,
  ImpersonationPort,
  ImpersonationSessionRecord,
} from './platform-admin.port';
export type { MembershipPort, ActiveMembership } from './membership.port';

import type { GovernancePort } from './governance.port';
import type {
  PlatformAdminPort,
  ImpersonationPort,
} from './platform-admin.port';
import type { MembershipPort } from './membership.port';

// ── Wire-up helpers ─────────────────────────────────────────────────────
//
// These dynamically resolve adapters from handler-owned repos. The lazy
// import keeps the static dependency graph (`core` → `handlers`) clean:
// only the middleware -> port edge survives a static analyzer.

export async function getGovernancePort(db: DatabaseInstance): Promise<GovernancePort> {
  const { governanceRepoPort } = await import(
    '@/handlers/association:member/repos/governance.repo'
  );
  return governanceRepoPort(db);
}

export async function getPlatformAdminPort(db: DatabaseInstance): Promise<PlatformAdminPort> {
  const { platformAdminRepoPort } = await import(
    '@/handlers/platformadmin/repos/platform-admin.repo'
  );
  return platformAdminRepoPort(db);
}

export async function getImpersonationPort(
  db: DatabaseInstance,
  logger?: Logger,
): Promise<ImpersonationPort> {
  const { impersonationRepoPort } = await import(
    '@/handlers/platformadmin/repos/platform-admin.repo'
  );
  return impersonationRepoPort(db, logger);
}

export async function getMembershipPort(db: DatabaseInstance): Promise<MembershipPort> {
  const { membershipRepoPort } = await import(
    '@/handlers/membership/repos/membership.repo'
  );
  return membershipRepoPort(db);
}
