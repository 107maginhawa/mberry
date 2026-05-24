import { pgTable, uuid, varchar, integer, boolean, timestamp, text, pgEnum, index, uniqueIndex, jsonb, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';
import { positions } from '../../association:member/repos/governance.schema';

export const electionTypeEnum = pgEnum('election_type', ['officer', 'bylaw']);
export const electionStatusEnum = pgEnum('election_status', ['draft', 'nominationsOpen', 'votingOpen', 'awaitingConfirmation', 'published', 'cancelled']);
export const votingModeEnum = pgEnum('voting_mode', ['online', 'inPerson', 'hybrid']);
export const nomineeStatusEnum = pgEnum('nominee_status', ['nominated', 'accepted', 'declined', 'elected']);

export const elections = pgTable('election', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  type: electionTypeEnum('type').notNull().default('officer'),
  status: electionStatusEnum('status').notNull().default('draft'),
  votingMode: votingModeEnum('voting_mode').notNull().default('online'),
  nominationsOpenAt: timestamp('nominations_open_at', { withTimezone: true }),
  nominationsCloseAt: timestamp('nominations_close_at', { withTimezone: true }),
  votingOpenAt: timestamp('voting_open_at', { withTimezone: true }),
  votingCloseAt: timestamp('voting_close_at', { withTimezone: true }),
  passageThreshold: integer('passage_threshold'), // percentage for bylaws
  positions: jsonb('positions').$type<{ id: string; title: string; sortOrder: number }[]>(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('election_org_idx').on(table.organizationId),
  statusIdx: index('election_status_idx').on(table.status),
  nominationsDateOrder: check('election_nominations_date_order', sql`${table.nominationsCloseAt} IS NULL OR ${table.nominationsOpenAt} IS NULL OR ${table.nominationsCloseAt} > ${table.nominationsOpenAt}`),
  votingDateOrder: check('election_voting_date_order', sql`${table.votingCloseAt} IS NULL OR ${table.votingOpenAt} IS NULL OR ${table.votingCloseAt} > ${table.votingOpenAt}`),
  nominationsBeforeVoting: check('election_nominations_before_voting', sql`${table.votingOpenAt} IS NULL OR ${table.nominationsCloseAt} IS NULL OR ${table.votingOpenAt} >= ${table.nominationsCloseAt}`),
}));

export const electionNominees = pgTable('election_nominee', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  electionId: uuid('election_id').notNull().references(() => elections.id, { onDelete: 'cascade' }),
  positionId: uuid('position_id').notNull().references(() => positions.id),
  personId: uuid('person_id').notNull().references(() => persons.id),
  nominatedBy: uuid('nominated_by').references(() => persons.id),
  status: nomineeStatusEnum('status').notNull().default('nominated'),
}, (table) => ({
  orgIdx: index('nominee_org_idx').on(table.organizationId),
  electionIdx: index('nominee_election_idx').on(table.electionId),
  personIdx: index('nominee_person_idx').on(table.personId),
}));

export const electionVotes = pgTable('election_vote', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  electionId: uuid('election_id').notNull().references(() => elections.id, { onDelete: 'cascade' }),
  positionId: uuid('position_id').notNull().references(() => positions.id),
  nomineeId: uuid('nominee_id').notNull().references(() => electionNominees.id),
  voterId: uuid('voter_id').notNull().references(() => persons.id),
}, (table) => ({
  orgIdx: index('vote_org_idx').on(table.organizationId),
  electionIdx: index('vote_election_idx').on(table.electionId),
  voterIdx: index('vote_voter_idx').on(table.voterId),
  electionVoterUniqueIdx: uniqueIndex('election_vote_unique').on(table.electionId, table.voterId, table.positionId),
}));

export type Election = typeof elections.$inferSelect;
export type NewElection = typeof elections.$inferInsert;
export type ElectionNominee = typeof electionNominees.$inferSelect;
export type ElectionVote = typeof electionVotes.$inferSelect;
