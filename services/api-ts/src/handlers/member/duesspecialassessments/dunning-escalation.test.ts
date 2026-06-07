/**
 * Dunning Escalation Tests — GAP-012
 *
 * Covers:
 * - Dunning template by stage (1-5 escalation progression)
 * - Stage selection based on daysAfterDue thresholds
 * - Deceased/suppressed exclusion from dunning
 * - Multi-stage template ordering
 * - getDunningStageForMember logic
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  getDunningStageForMember,
  selectDunningTemplate,
  shouldExcludeFromDunning,
  DUNNING_EXCLUSION_STATUSES,
  type DunningMemberContext,
  type DunningTemplateConfig,
} from '@/handlers/association:member/utils/dunning-escalation';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ---------------------------------------------------------------------------
// GAP-012: Dunning stage determination
// ---------------------------------------------------------------------------

describe('GAP-012: getDunningStageForMember', () => {
  test('returns stage 1 for 0-30 days overdue', () => {
    expect(getDunningStageForMember(0)).toBe(1);
    expect(getDunningStageForMember(15)).toBe(1);
    expect(getDunningStageForMember(29)).toBe(1);
  });

  test('returns stage 2 for 30-60 days overdue', () => {
    expect(getDunningStageForMember(30)).toBe(2);
    expect(getDunningStageForMember(45)).toBe(2);
    expect(getDunningStageForMember(59)).toBe(2);
  });

  test('returns stage 3 for 60-90 days overdue', () => {
    expect(getDunningStageForMember(60)).toBe(3);
    expect(getDunningStageForMember(75)).toBe(3);
    expect(getDunningStageForMember(89)).toBe(3);
  });

  test('returns stage 4 for 90-120 days overdue', () => {
    expect(getDunningStageForMember(90)).toBe(4);
    expect(getDunningStageForMember(105)).toBe(4);
    expect(getDunningStageForMember(119)).toBe(4);
  });

  test('returns stage 5 for 120+ days overdue', () => {
    expect(getDunningStageForMember(120)).toBe(5);
    expect(getDunningStageForMember(365)).toBe(5);
  });

  test('returns null for negative days (not yet overdue)', () => {
    expect(getDunningStageForMember(-1)).toBeNull();
    expect(getDunningStageForMember(-30)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GAP-012: Template selection by stage
// ---------------------------------------------------------------------------

describe('GAP-012: selectDunningTemplate', () => {
  const templates: DunningTemplateConfig[] = [
    { id: 'tmpl-1', stage: 1, daysAfterDue: 7, channel: 'email', name: 'Friendly Reminder', status: 'active' },
    { id: 'tmpl-2', stage: 2, daysAfterDue: 30, channel: 'email', name: 'Second Notice', status: 'active' },
    { id: 'tmpl-3', stage: 3, daysAfterDue: 60, channel: 'email', name: 'Urgent Notice', status: 'active' },
    { id: 'tmpl-4', stage: 4, daysAfterDue: 90, channel: 'letter', name: 'Final Warning', status: 'active' },
    { id: 'tmpl-5', stage: 5, daysAfterDue: 120, channel: 'letter', name: 'Membership Termination', status: 'active' },
  ];

  test('selects correct template for stage 1', () => {
    const result = selectDunningTemplate(templates, 1);
    expect(result?.id).toBe('tmpl-1');
    expect(result?.name).toBe('Friendly Reminder');
  });

  test('selects correct template for stage 3', () => {
    const result = selectDunningTemplate(templates, 3);
    expect(result?.id).toBe('tmpl-3');
    expect(result?.name).toBe('Urgent Notice');
  });

  test('selects correct template for stage 5', () => {
    const result = selectDunningTemplate(templates, 5);
    expect(result?.id).toBe('tmpl-5');
    expect(result?.name).toBe('Membership Termination');
  });

  test('returns null when no template for stage', () => {
    const result = selectDunningTemplate(templates, 6);
    expect(result).toBeNull();
  });

  test('skips inactive templates', () => {
    const withInactive: DunningTemplateConfig[] = [
      { id: 'tmpl-1', stage: 1, daysAfterDue: 7, channel: 'email', name: 'Inactive', status: 'inactive' },
      { id: 'tmpl-1b', stage: 1, daysAfterDue: 7, channel: 'email', name: 'Active', status: 'active' },
    ];
    const result = selectDunningTemplate(withInactive, 1);
    expect(result?.name).toBe('Active');
  });

  test('returns null when only inactive templates for stage', () => {
    const inactive: DunningTemplateConfig[] = [
      { id: 'tmpl-1', stage: 1, daysAfterDue: 7, channel: 'email', name: 'Inactive', status: 'inactive' },
    ];
    const result = selectDunningTemplate(inactive, 1);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GAP-012: Deceased/suppressed exclusion
// ---------------------------------------------------------------------------

describe('GAP-012: shouldExcludeFromDunning', () => {
  test('excludes deceased members', () => {
    const member: DunningMemberContext = {
      personId: 'p-1',
      membershipId: 'mem-1',
      status: 'deceased',
      isSuppressed: false,
    };
    expect(shouldExcludeFromDunning(member)).toBe(true);
  });

  test('excludes resigned members', () => {
    const member: DunningMemberContext = {
      personId: 'p-2',
      membershipId: 'mem-2',
      status: 'resigned',
      isSuppressed: false,
    };
    expect(shouldExcludeFromDunning(member)).toBe(true);
  });

  test('excludes expelled members', () => {
    const member: DunningMemberContext = {
      personId: 'p-3',
      membershipId: 'mem-3',
      status: 'expelled',
      isSuppressed: false,
    };
    expect(shouldExcludeFromDunning(member)).toBe(true);
  });

  test('excludes suppressed members regardless of status', () => {
    const member: DunningMemberContext = {
      personId: 'p-4',
      membershipId: 'mem-4',
      status: 'active',
      isSuppressed: true,
    };
    expect(shouldExcludeFromDunning(member)).toBe(true);
  });

  test('does NOT exclude active non-suppressed members', () => {
    const member: DunningMemberContext = {
      personId: 'p-5',
      membershipId: 'mem-5',
      status: 'active',
      isSuppressed: false,
    };
    expect(shouldExcludeFromDunning(member)).toBe(false);
  });

  test('does NOT exclude gracePeriod non-suppressed members', () => {
    const member: DunningMemberContext = {
      personId: 'p-6',
      membershipId: 'mem-6',
      status: 'gracePeriod',
      isSuppressed: false,
    };
    expect(shouldExcludeFromDunning(member)).toBe(false);
  });

  test('DUNNING_EXCLUSION_STATUSES contains deceased, resigned, expelled', () => {
    expect(DUNNING_EXCLUSION_STATUSES).toContain('deceased');
    expect(DUNNING_EXCLUSION_STATUSES).toContain('resigned');
    expect(DUNNING_EXCLUSION_STATUSES).toContain('expelled');
  });

  test('DUNNING_EXCLUSION_STATUSES does NOT contain active or gracePeriod', () => {
    expect(DUNNING_EXCLUSION_STATUSES).not.toContain('active');
    expect(DUNNING_EXCLUSION_STATUSES).not.toContain('gracePeriod');
  });
});

// ---------------------------------------------------------------------------
// GAP-012: Escalation progression
// ---------------------------------------------------------------------------

describe('GAP-012: dunning escalation progression', () => {
  test('stages are sequential 1 through 5', () => {
    for (let days = 0; days < 150; days++) {
      const stage = getDunningStageForMember(days);
      if (stage !== null) {
        expect(stage).toBeGreaterThanOrEqual(1);
        expect(stage).toBeLessThanOrEqual(5);
      }
    }
  });

  test('stage never decreases as days increase', () => {
    let lastStage = 0;
    for (let days = 0; days < 200; days++) {
      const stage = getDunningStageForMember(days);
      if (stage !== null) {
        expect(stage).toBeGreaterThanOrEqual(lastStage);
        lastStage = stage;
      }
    }
  });

  test('each stage transition happens at expected boundary', () => {
    // Stage boundaries: 0-29=1, 30-59=2, 60-89=3, 90-119=4, 120+=5
    expect(getDunningStageForMember(29)).toBe(1);
    expect(getDunningStageForMember(30)).toBe(2);
    expect(getDunningStageForMember(59)).toBe(2);
    expect(getDunningStageForMember(60)).toBe(3);
    expect(getDunningStageForMember(89)).toBe(3);
    expect(getDunningStageForMember(90)).toBe(4);
    expect(getDunningStageForMember(119)).toBe(4);
    expect(getDunningStageForMember(120)).toBe(5);
  });
});
