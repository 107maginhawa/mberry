DROP INDEX "vote_election_voter_idx";--> statement-breakpoint
DELETE FROM "election_vote" WHERE "id" NOT IN (
  SELECT DISTINCT ON ("election_id", "voter_id", "position_id") "id"
  FROM "election_vote"
  ORDER BY "election_id", "voter_id", "position_id", "created_at" DESC
);--> statement-breakpoint
CREATE UNIQUE INDEX "election_vote_unique" ON "election_vote" USING btree ("election_id","voter_id","position_id");