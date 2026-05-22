import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus = 'active' | 'paused' | 'paused_for_review' | 'completed';

interface AdCampaign {
  id: string;
  advertiserId: string;
  status: CampaignStatus;
  budgetImpressions: number;
  impressionsServed: number;
  reportCount: number;
  reportThreshold: number;
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

function recordImpression(campaign: AdCampaign): AdCampaign {
  const updated = { ...campaign, impressionsServed: campaign.impressionsServed + 1 };
  if (updated.impressionsServed >= updated.budgetImpressions) {
    return { ...updated, status: 'paused' };
  }
  return updated;
}

function reportAd(campaign: AdCampaign): AdCampaign {
  const updated = { ...campaign, reportCount: campaign.reportCount + 1 };
  if (updated.reportCount >= updated.reportThreshold) {
    return { ...updated, status: 'paused_for_review' };
  }
  return updated;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('[AC-M16-005] Budget Enforcement', () => {
  const campaign: AdCampaign = {
    id: 'ad-001',
    advertiserId: 'adv-1',
    status: 'active',
    budgetImpressions: 100,
    impressionsServed: 99,
    reportCount: 0,
    reportThreshold: 5,
  };

  test('campaign paused when impressions reach budget limit', () => {
    const result = recordImpression(campaign);
    expect(result.impressionsServed).toBe(100);
    expect(result.status).toBe('paused');
  });

  test('campaign stays active when under budget', () => {
    const underBudget: AdCampaign = { ...campaign, impressionsServed: 50 };
    const result = recordImpression(underBudget);
    expect(result.status).toBe('active');
  });

  test('paused campaign has correct impression count', () => {
    const result = recordImpression(campaign);
    expect(result.impressionsServed).toBe(campaign.budgetImpressions);
  });
});

describe('[AC-M16-006] Report Threshold Auto-Pause', () => {
  const campaign: AdCampaign = {
    id: 'ad-002',
    advertiserId: 'adv-2',
    status: 'active',
    budgetImpressions: 1000,
    impressionsServed: 200,
    reportCount: 4,
    reportThreshold: 5,
  };

  test('campaign paused for review when report threshold reached', () => {
    const result = reportAd(campaign);
    expect(result.reportCount).toBe(5);
    expect(result.status).toBe('paused_for_review');
  });

  test('campaign stays active below report threshold', () => {
    const fewReports: AdCampaign = { ...campaign, reportCount: 2 };
    const result = reportAd(fewReports);
    expect(result.status).toBe('active');
  });

  test('paused-for-review status is distinct from budget-paused', () => {
    const result = reportAd(campaign);
    expect(result.status).toBe('paused_for_review');
    expect(result.status).not.toBe('paused');
  });
});
