import type { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

export type MemberStatus = 'active' | 'grace' | 'lapsed' | 'suspended' | 'removed' | 'pendingPayment' | 'expired' | 'resigned' | 'deceased' | 'expelled';

// Forward declaration — SeedClient is extracted in Step 2
export interface SeedContext {
  db: ReturnType<typeof drizzle>;
  pool: Pool;
  orgId: string;
  org2Id: string;
  regularTierId: string;
  associateTierId: string;
  org2RegularTierId: string;
  presidentPersonId: string;
  memberPersonIds: string[];
  allPersonIds: string[];
  allMembershipIds: string[];
  genders: Record<string, string>;
}
