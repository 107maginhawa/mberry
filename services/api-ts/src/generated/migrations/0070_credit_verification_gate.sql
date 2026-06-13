-- TC-DEC-02 (AHA Step 47) — manual-entry VERIFICATION GATE on the
-- officer-facing compliance_standings materialized view.
--
-- The repo aggregate reads (sumCreditsForCycle / sumCreditsByOrg /
-- sumCreditsByCategoryBatch / transcript list / getMyCredits) now exclude
-- member self-reported entries that are still 'pending' (and 'rejected') by
-- filtering verification_status = 'verified'. The matview that backs the
-- officer compliance report must agree, or an officer would see a member's
-- unverified credits counted while the member's own /my/credits does not —
-- exactly the FIX-005 (status='active') consistency class of bug.
--
-- This re-creates the view adding `AND ce.verification_status = 'verified'`
-- to the existing `ce.status = 'active'` (void exclusion) filter.
DROP MATERIALIZED VIEW IF EXISTS compliance_standings;--> statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS compliance_standings AS
SELECT ce.person_id,ce.organization_id,COALESCE(SUM(ce.credit_amount),0) AS total_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='General'),0) AS general_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Major'),0) AS major_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Self-Directed'),0) AS sdl_credits,
COUNT(*) AS entry_count,COALESCE(occ.required_credits,60) AS required_credits,
COALESCE(occ.sdl_cap_percent,40) AS sdl_cap_percent,
CASE WHEN COALESCE(occ.required_credits,60)=0 THEN 100 ELSE LEAST(ROUND((COALESCE(SUM(ce.credit_amount),0)::numeric/COALESCE(occ.required_credits,60))*100,1),100) END AS compliance_percent,
CASE WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60) THEN 'compliant' WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60)*0.6 THEN 'at_risk' ELSE 'non_compliant' END AS compliance_status,
MAX(ce.updated_at) AS last_credit_at
FROM credit_entry ce LEFT JOIN org_cpd_config occ ON occ.organization_id=ce.organization_id WHERE ce.status='active' AND ce.verification_status='verified' GROUP BY ce.person_id,ce.organization_id,occ.required_credits,occ.sdl_cap_percent;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_standings_pk ON compliance_standings (person_id,organization_id);
