DROP INDEX "vote_election_voter_idx";--> statement-breakpoint
DELETE FROM "election_vote" WHERE "id" NOT IN (
  SELECT MIN("id") FROM "election_vote"
  GROUP BY "election_id", "voter_id", "position_id"
);--> statement-breakpoint
CREATE UNIQUE INDEX "election_vote_unique" ON "election_vote" USING btree ("election_id","voter_id","position_id");