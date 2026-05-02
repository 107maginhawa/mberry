import type { Context } from 'hono';
import { ValidationError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';

const VALID_TYPES = ['collection', 'fund_breakdown', 'dues_status', 'aging'] as const;

export async function generateReport(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const type = ctx.req.query('type') as typeof VALID_TYPES[number];
  const from = ctx.req.query('from');
  const to = ctx.req.query('to');

  if (!type || !VALID_TYPES.includes(type)) {
    throw new ValidationError(`Invalid report type. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const repo = new DuesRepository(db);
  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const toDate = to ? new Date(to) : new Date();

  let data: any;
  let summary: any = {};

  switch (type) {
    case 'collection': {
      data = await repo.reportCollectionSummary(orgId, fromDate, toDate);
      const totalCollected = data.reduce((sum: number, row: any) => sum + row.total, 0);
      summary = { totalCollected, rowCount: data.length };
      break;
    }
    case 'fund_breakdown': {
      data = await repo.reportFundBreakdown(orgId, fromDate, toDate);
      summary = { fundCount: data.length };
      break;
    }
    case 'dues_status': {
      data = await repo.reportDuesStatus(orgId);
      summary = { memberCount: data.length };
      break;
    }
    case 'aging': {
      data = await repo.reportAging(orgId);
      const buckets: Record<string, number> = { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      const bucketAmounts: Record<string, number> = { '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      for (const row of data) {
        const days = row.daysPending;
        const bucket = days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
        buckets[bucket]++;
        bucketAmounts[bucket] += row.amount;
      }
      summary = { buckets, bucketAmounts, totalOverdue: data.length };
      break;
    }
  }

  return ctx.json({ data, summary, meta: { type, from: fromDate.toISOString(), to: toDate.toISOString() } }, 200);
}
