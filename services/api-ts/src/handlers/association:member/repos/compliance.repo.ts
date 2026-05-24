import { sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';

export interface ComplianceStanding {
  personId: string; organizationId: string; totalCredits: number; generalCredits: number; majorCredits: number; sdlCredits: number; entryCount: number; requiredCredits: number; sdlCapPercent: number; compliancePercent: number; complianceStatus: 'compliant' | 'at_risk' | 'non_compliant'; lastCreditAt: Date | null;
}

export class ComplianceRepository {
  constructor(private db: DatabaseInstance) {}
  async getByOrganization(organizationId: string, opts?: { status?: string; limit?: number; offset?: number }) {
    const limit = opts?.limit ?? 50; const offset = opts?.offset ?? 0;
    let wc = sql`organization_id = ${organizationId}`;
    if (opts?.status) wc = sql`${wc} AND compliance_status = ${opts.status}`;
    const cr = await this.db.execute(sql`SELECT COUNT(*) as count FROM compliance_standings WHERE ${wc}`);
    const total = Number((cr as any).rows?.[0]?.count ?? (cr as any)[0]?.count ?? 0);
    const rows = await this.db.execute(sql`SELECT * FROM compliance_standings WHERE ${wc} ORDER BY compliance_percent ASC LIMIT ${limit} OFFSET ${offset}`);
    const data = ((rows as any).rows ?? (rows as unknown as any[])).map((r: any) => this.mapRow(r));
    return { data, total };
  }
  async getOrgSummary(organizationId: string) {
    const r = await this.db.execute(sql`SELECT COUNT(*) AS total_members, COUNT(*) FILTER (WHERE compliance_status='compliant') AS compliant, COUNT(*) FILTER (WHERE compliance_status='at_risk') AS at_risk, COUNT(*) FILTER (WHERE compliance_status='non_compliant') AS non_compliant FROM compliance_standings WHERE organization_id = ${organizationId}`);
    const row = (r as any).rows?.[0] ?? (r as any)[0] ?? {};
    const tm = Number(row.total_members ?? 0);
    return { totalMembers: tm, compliant: Number(row.compliant ?? 0), atRisk: Number(row.at_risk ?? 0), nonCompliant: Number(row.non_compliant ?? 0), complianceRate: tm > 0 ? Math.round((Number(row.compliant ?? 0) / tm) * 100) : 0 };
  }
  async refresh() { await this.db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_standings`); }
  private mapRow(row: any): ComplianceStanding {
    return { personId: row.person_id, organizationId: row.organization_id, totalCredits: Number(row.total_credits ?? 0), generalCredits: Number(row.general_credits ?? 0), majorCredits: Number(row.major_credits ?? 0), sdlCredits: Number(row.sdl_credits ?? 0), entryCount: Number(row.entry_count ?? 0), requiredCredits: Number(row.required_credits ?? 0), sdlCapPercent: Number(row.sdl_cap_percent ?? 0), compliancePercent: Number(row.compliance_percent ?? 0), complianceStatus: row.compliance_status ?? 'non_compliant', lastCreditAt: row.last_credit_at ? new Date(row.last_credit_at) : null };
  }
}
