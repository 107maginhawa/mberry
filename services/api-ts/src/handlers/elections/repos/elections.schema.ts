import { pgTable, uuid, varchar, integer, boolean, timestamp, text, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons } from '../../person/repos/person.schema';

export const electionTypeEnum = pgEnum('election_type', ['officer', 'bylaw']);
export const electionStatusEnum = pgEnum('election_status', ['draft', 'nominations_open', 'voting_open', 'awaiting_confirmation', 'published', 'cancelled']);
export const votingModeEnum = pgEnum('voting_mode', ['online', 'in_person', 'hybrid']);
export const nomineeStatusEnum = pgEnum('nominee_status', ['nominated', 'accepted', 'declined', 'elected']);

export const elections = pgTable('election', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  type: electionTypeEnum('type').notNull().default('officer'),
  status: electionStatusEnum('status').notNull().default('draft'),
  votingMode: votingModeEnum('voting_mode').notNull().default('online'),
  nominationsOpenAt: timestamp('nominations_open_at'),
  nominationsCloseAt: timestamp('nominations_close_at'),
  votingOpenAt: timestamp('voting_open_at'),
  votingCloseAt: timestamp('voting_close_at'),
  passageThreshold: integer('passage_threshold'), // percentage for bylaws
  positions: jsonb('positions').$type<{ id: string; title: string; sortOrder: number }[]>(),
  publishedAt: timestamp('published_at'),
}, (table) => ({
  orgIdx: index('election_org_idx').on(table.organizationId),
  statusIdx: index('election_status_idx').on(table.status),
}));

export const electionNominees = pgTable('election_nominee', {
  ...baseEntityFields,
  electionId: uuid('election_id').notNull().references(() => elections.id, { onDelete: 'cascade' }),
  positionId: varchar('position_id', { length: 50 }).notNull(),
  personId: uuid('person_id').notNull().references(() => persons.id),
  nominatedBy: uuid('nominated_by').references(() => persons.id),
  status: nomineeStatusEnum('status').notNull().default('nominated'),
}, (table) => ({
  electionIdx: index('nominee_election_idx').on(table.electionId),
  personIdx: index('nominee_person_idx').on(table.personId),
}));

export const electionVotes = pgTable('election_vote', {
  ...baseEntityFields,
  electionId: uuid('election_id').notNull().references(() => elections.id, { onDelete: 'cascade' }),
  positionId: varchar('position_id', { length: 50 }).notNull(),
  nomineeId: uuid('nominee_id').notNull().references(() => electionNominees.id),
  voterId: uuid('voter_id').notNull().references(() => persons.id),
}, (table) => ({
  electionIdx: index('vote_election_idx').on(table.electionId),
  voterIdx: index('vote_voter_idx').on(table.voterId),
  electionVoterIdx: index('vote_election_voter_idx').on(table.electionId, table.voterId, table.positionId),
}));

export type Election = typeof elections.$inferSelect;
export type NewElection = typeof elections.$inferInsert;
export type ElectionNominee = typeof electionNominees.$inferSelect;
export type ElectionVote = typeof electionVotes.$inferSelect;
