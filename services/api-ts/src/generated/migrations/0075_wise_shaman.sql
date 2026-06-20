-- T2 — make CPD credit_amount fractional (0.5 increments).
-- Storage = Postgres double precision (float8). node-postgres returns float8
-- as a JS number, so no string coercion is needed in app code.
--
-- The materialized view `compliance_standings` (created in
-- 0070_credit_verification_gate.sql) reads credit_entry.credit_amount, so the
-- column type cannot be altered while the view depends on it. We therefore
-- DROP the matview, ALTER the column, then recreate the matview + its unique
-- index VERBATIM from 0070. int4 -> float8 is an implicit Postgres cast, so no
-- USING clause is required on the ALTER.
DROP MATERIALIZED VIEW IF EXISTS compliance_standings;--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "credit_amount" SET DATA TYPE double precision;--> statement-breakpoint
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
