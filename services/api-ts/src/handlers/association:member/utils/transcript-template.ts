/**
 * Credit transcript template rendering utilities (Slice 043).
 *
 * Renders cycle-aware credit transcripts as HTML for PDF conversion.
 * Supports multi-org aggregation and cycle boundary formatting.
 */

import type { CreditCycle, CreditCycleSummary } from './credit-cycle';

export interface TranscriptCreditEntry {
  activityName: string;
  activityDate: Date;
  creditAmount: number;
  category?: string;
  type: 'auto' | 'manual';
  organizationName?: string;
}

export interface TranscriptData {
  personName: string;
  personId: string;
  generatedAt: Date;
  cycle: CreditCycle;
  summary: CreditCycleSummary;
  entries: TranscriptCreditEntry[];
  organizations: { organizationId: string; name: string; credits: number }[];
}

/**
 * Render a credit transcript as HTML.
 * Entries grouped by organization, sorted by date within each group.
 * Includes cycle boundary information and compliance status.
 */
export function renderTranscriptHtml(data: TranscriptData): string {
  const cycleStartStr = formatDate(data.cycle.cycleStart);
  const cycleEndStr = formatDate(data.cycle.cycleEnd);
  const generatedStr = formatDate(data.generatedAt);

  const complianceClass = data.summary.compliant ? 'compliant' : 'non-compliant';
  const complianceLabel = data.summary.compliant ? 'COMPLIANT' : 'NON-COMPLIANT';

  // Group entries by org
  const entriesByOrg = new Map<string, TranscriptCreditEntry[]>();
  for (const entry of data.entries) {
    const orgName = entry.organizationName ?? 'Unaffiliated';
    if (!entriesByOrg.has(orgName)) entriesByOrg.set(orgName, []);
    entriesByOrg.get(orgName)!.push(entry);
  }

  // Sort entries within each group by date
  for (const entries of entriesByOrg.values()) {
    entries.sort((a, b) => a.activityDate.getTime() - b.activityDate.getTime());
  }

  const orgSections = Array.from(entriesByOrg.entries())
    .map(([orgName, entries]) => renderOrgSection(orgName, entries))
    .join('\n');

  const orgSummaryRows = data.organizations
    .map(
      (o) =>
        `<tr><td>${o.name}</td><td class="num">${o.credits}</td></tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; font-size: 13px; }
  h1 { font-size: 22px; color: #1a365d; margin-bottom: 5px; }
  .subtitle { color: #666; margin-bottom: 20px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; color: #888; }
  .cycle-info { background: #f7fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
  .cycle-info .label { font-weight: bold; color: #4a5568; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 3px; font-weight: bold; font-size: 12px; }
  .compliant { background: #c6f6d5; color: #276749; }
  .non-compliant { background: #fed7d7; color: #9b2c2c; }
  .org-section { margin-bottom: 20px; }
  .org-title { font-size: 15px; font-weight: bold; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th { text-align: left; padding: 6px 8px; background: #edf2f7; border-bottom: 2px solid #cbd5e0; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  .num { text-align: right; }
  .type-badge { font-size: 11px; padding: 2px 6px; border-radius: 2px; }
  .type-auto { background: #bee3f8; color: #2b6cb0; }
  .type-manual { background: #fefcbf; color: #975a16; }
  .summary-table { max-width: 400px; }
  .totals { background: #f7fafc; font-weight: bold; }
  .footer { margin-top: 30px; font-size: 11px; color: #a0aec0; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style>
</head>
<body>
  <h1>Continuing Professional Development Transcript</h1>
  <p class="subtitle">${data.personName}</p>

  <div class="meta">
    <span>Person ID: ${data.personId}</span>
    <span>Generated: ${generatedStr}</span>
  </div>

  <div class="cycle-info">
    <p><span class="label">Compliance Cycle ${data.cycle.cycleNumber}:</span> ${cycleStartStr} &mdash; ${cycleEndStr}</p>
    <p>
      <span class="label">Status:</span>
      <span class="status ${complianceClass}">${complianceLabel}</span>
    </p>
    <p><span class="label">Credits Earned:</span> ${data.summary.earned} | <span class="label">Carryover:</span> ${data.summary.carryoverFromPrevious} | <span class="label">Total:</span> ${data.summary.total} / ${data.summary.required}</p>
    <p><span class="label">Remaining:</span> ${data.summary.remaining}</p>
  </div>

  <h2>Organization Summary</h2>
  <table class="summary-table">
    <thead><tr><th>Organization</th><th class="num">Credits</th></tr></thead>
    <tbody>
      ${orgSummaryRows}
      <tr class="totals"><td>Total</td><td class="num">${data.summary.earned}</td></tr>
    </tbody>
  </table>

  <h2>Credit Entries</h2>
  ${orgSections || '<p>No credit entries recorded for this cycle.</p>'}

  <div class="footer">
    This transcript was generated on ${generatedStr}. Certificate numbers and activity records are maintained by the issuing organization.
  </div>
</body>
</html>`;
}

function renderOrgSection(orgName: string, entries: TranscriptCreditEntry[]): string {
  const rows = entries
    .map(
      (e) =>
        `<tr>
          <td>${formatDate(e.activityDate)}</td>
          <td>${e.activityName}</td>
          <td>${e.category ?? '—'}</td>
          <td class="num">${e.creditAmount}</td>
          <td><span class="type-badge type-${e.type}">${e.type}</span></td>
        </tr>`,
    )
    .join('\n');

  const subtotal = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  return `<div class="org-section">
    <div class="org-title">${orgName}</div>
    <table>
      <thead><tr><th>Date</th><th>Activity</th><th>Category</th><th class="num">Credits</th><th>Type</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="totals"><td colspan="3">Subtotal</td><td class="num">${subtotal}</td><td></td></tr>
      </tbody>
    </table>
  </div>`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Validate transcript data before rendering.
 */
export function validateTranscriptData(data: Partial<TranscriptData>): string[] {
  const errors: string[] = [];
  if (!data.personName) errors.push('personName is required');
  if (!data.personId) errors.push('personId is required');
  if (!data.cycle) errors.push('cycle is required');
  if (!data.summary) errors.push('summary is required');
  return errors;
}
