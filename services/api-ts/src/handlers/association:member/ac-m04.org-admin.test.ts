/**
 * AC tests for M04 — Org Admin
 * Pure domain logic — no DB, no HTTP.
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgSettings {
  orgId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  publicPageEnabled: boolean;
}

interface OfficerTerm {
  id: string;
  orgId: string;
  personId: string;
  role: string;
  startDate: Date;
  endDate: Date | null; // null = current/ongoing
}

interface HandoffChecklist {
  outgoingOfficerId: string;
  incomingOfficerId: string;
  orgId: string;
  role: string;
  items: string[];
}

interface DisciplinaryAction {
  personId: string;
  orgId: string;
  reason: string | null;
  actionType: string;
}

interface OrgMember {
  personId: string;
  orgId: string;
  status: 'active' | 'inactive' | 'suspended';
}

// ---------------------------------------------------------------------------
// Pure functions under test
// ---------------------------------------------------------------------------

function updateOrgSettings(
  current: OrgSettings,
  patch: Partial<OrgSettings>,
): OrgSettings {
  return { ...current, ...patch };
}

function findActiveOfficerForRole(
  terms: OfficerTerm[],
  orgId: string,
  role: string,
): OfficerTerm | null {
  return terms.find(t => t.orgId === orgId && t.role === role && t.endDate === null) ?? null;
}

function canAssignOfficerRole(
  terms: OfficerTerm[],
  orgId: string,
  role: string,
): { allowed: boolean; reason?: string } {
  const current = findActiveOfficerForRole(terms, orgId, role);
  if (current) {
    return { allowed: false, reason: `Role '${role}' is already occupied by person ${current.personId}` };
  }
  return { allowed: true };
}

function generateHandoffChecklist(
  outgoingOfficerId: string,
  incomingOfficerId: string,
  orgId: string,
  role: string,
): HandoffChecklist {
  return {
    outgoingOfficerId,
    incomingOfficerId,
    orgId,
    role,
    items: [
      'Transfer access credentials',
      'Review pending action items',
      'Update contact directory',
      'Brief incoming officer on ongoing matters',
    ],
  };
}

function validateDisciplinaryAction(action: DisciplinaryAction): { valid: boolean; error?: string } {
  if (!action.reason || action.reason.trim().length === 0) {
    return { valid: false, error: 'Disciplinary action requires a reason' };
  }
  return { valid: true };
}

function computeOrgMetrics(members: OrgMember[], orgId: string): {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
} {
  const orgMembers = members.filter(m => m.orgId === orgId);
  return {
    total: orgMembers.length,
    active: orgMembers.filter(m => m.status === 'active').length,
    inactive: orgMembers.filter(m => m.status === 'inactive').length,
    suspended: orgMembers.filter(m => m.status === 'suspended').length,
  };
}

function buildPublicPageUrl(slug: string, baseUrl = 'https://app.example.com'): string {
  return `${baseUrl}/org/${slug}`;
}

function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug must contain only lowercase letters, digits, and hyphens' };
  }
  return { valid: true };
}

function sanitizeSvg(svg: string): string {
  // Strip <script> tags and event handlers from SVG
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

// ---------------------------------------------------------------------------
// AC-M04-001: Org Settings CRUD
// ---------------------------------------------------------------------------

describe('[AC-M04-001] Org Settings CRUD', () => {
  const base: OrgSettings = {
    orgId: 'org-1',
    name: 'Dental Association',
    slug: 'dental-assoc',
    logoUrl: null,
    publicPageEnabled: false,
  };

  test('saves updated name', () => {
    const result = updateOrgSettings(base, { name: 'Philippine Dental Association' });
    expect(result.name).toBe('Philippine Dental Association');
  });

  test('saves updated slug', () => {
    const result = updateOrgSettings(base, { slug: 'pda-ph' });
    expect(result.slug).toBe('pda-ph');
  });

  test('partial update does not overwrite unrelated fields', () => {
    const result = updateOrgSettings(base, { logoUrl: 'https://cdn.example.com/logo.png' });
    expect(result.name).toBe(base.name);
    expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
  });
});

// ---------------------------------------------------------------------------
// AC-M04-002: Officer Role Constraint
// ---------------------------------------------------------------------------

describe('[AC-M04-002] Officer Role Constraint', () => {
  const now = new Date();
  const terms: OfficerTerm[] = [
    { id: 't1', orgId: 'org-1', personId: 'p1', role: 'president', startDate: now, endDate: null },
  ];

  test('rejects assigning same role when already occupied', () => {
    const result = canAssignOfficerRole(terms, 'org-1', 'president');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('allows assigning role when vacant', () => {
    const result = canAssignOfficerRole(terms, 'org-1', 'treasurer');
    expect(result.allowed).toBe(true);
  });

  test('allows reassignment after previous officer term ends', () => {
    const pastTerms: OfficerTerm[] = [
      { id: 't1', orgId: 'org-1', personId: 'p1', role: 'president', startDate: now, endDate: new Date() },
    ];
    const result = canAssignOfficerRole(pastTerms, 'org-1', 'president');
    expect(result.allowed).toBe(true);
  });

  test('role constraint is per-org — same role in different org is allowed', () => {
    const result = canAssignOfficerRole(terms, 'org-2', 'president');
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-M04-003: Officer Transition with Handoff Checklist
// ---------------------------------------------------------------------------

describe('[AC-M04-003] Officer Transition with Handoff Checklist', () => {
  test('generates checklist when new officer is assigned', () => {
    const checklist = generateHandoffChecklist('outgoing-p', 'incoming-p', 'org-1', 'president');
    expect(checklist.outgoingOfficerId).toBe('outgoing-p');
    expect(checklist.incomingOfficerId).toBe('incoming-p');
    expect(checklist.orgId).toBe('org-1');
    expect(checklist.role).toBe('president');
    expect(checklist.items.length).toBeGreaterThan(0);
  });

  test('checklist includes required handoff items', () => {
    const checklist = generateHandoffChecklist('outgoing-p', 'incoming-p', 'org-1', 'treasurer');
    expect(checklist.items.some(i => i.toLowerCase().includes('access'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-M04-004: Disciplinary Action with Mandatory Reason
// ---------------------------------------------------------------------------

describe('[AC-M04-004] Disciplinary Action with Mandatory Reason', () => {
  test('rejects disciplinary action with null reason', () => {
    const action: DisciplinaryAction = { personId: 'p1', orgId: 'org-1', reason: null, actionType: 'warning' };
    const result = validateDisciplinaryAction(action);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('rejects disciplinary action with empty reason', () => {
    const action: DisciplinaryAction = { personId: 'p1', orgId: 'org-1', reason: '   ', actionType: 'warning' };
    const result = validateDisciplinaryAction(action);
    expect(result.valid).toBe(false);
  });

  test('accepts disciplinary action with a reason', () => {
    const action: DisciplinaryAction = {
      personId: 'p1',
      orgId: 'org-1',
      reason: 'Repeated violation of code of conduct',
      actionType: 'suspension',
    };
    const result = validateDisciplinaryAction(action);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-M04-005: Org Dashboard Metrics
// ---------------------------------------------------------------------------

describe('[AC-M04-005] Org Dashboard Metrics', () => {
  const members: OrgMember[] = [
    { personId: 'p1', orgId: 'org-1', status: 'active' },
    { personId: 'p2', orgId: 'org-1', status: 'active' },
    { personId: 'p3', orgId: 'org-1', status: 'inactive' },
    { personId: 'p4', orgId: 'org-1', status: 'suspended' },
    { personId: 'p5', orgId: 'org-2', status: 'active' },
  ];

  test('shows aggregate stats for the org', () => {
    const metrics = computeOrgMetrics(members, 'org-1');
    expect(metrics.total).toBe(4);
    expect(metrics.active).toBe(2);
    expect(metrics.inactive).toBe(1);
    expect(metrics.suspended).toBe(1);
  });

  test('excludes members from other orgs', () => {
    const metrics = computeOrgMetrics(members, 'org-2');
    expect(metrics.total).toBe(1);
    expect(metrics.active).toBe(1);
  });

  test('returns zeros for org with no members', () => {
    const metrics = computeOrgMetrics(members, 'org-99');
    expect(metrics.total).toBe(0);
    expect(metrics.active).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-M04-006: Public Page Slug
// ---------------------------------------------------------------------------

describe('[AC-M04-006] Public Page Slug', () => {
  test('builds accessible URL from slug', () => {
    const url = buildPublicPageUrl('dental-assoc');
    expect(url).toContain('/org/dental-assoc');
  });

  test('valid slug accepted', () => {
    expect(validateSlug('dental-assoc-ph').valid).toBe(true);
  });

  test('slug with uppercase rejected', () => {
    expect(validateSlug('Dental-Assoc').valid).toBe(false);
  });

  test('slug with spaces rejected', () => {
    expect(validateSlug('dental assoc').valid).toBe(false);
  });

  test('slug with special characters rejected', () => {
    expect(validateSlug('dental@assoc!').valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-M04-007: SVG Sanitization
// ---------------------------------------------------------------------------

describe('[AC-M04-007] SVG Sanitization', () => {
  test('strips script tags from SVG', () => {
    const malicious = `<svg><script>alert('xss')</script><circle r="10"/></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert');
    expect(clean).toContain('<circle');
  });

  test('strips inline event handlers', () => {
    const malicious = `<svg><rect onclick="alert('xss')" width="10"/></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('onclick');
    expect(clean).toContain('<rect');
  });

  test('strips javascript: URIs', () => {
    const malicious = `<svg><a href="javascript:alert(1)">link</a></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('javascript:');
  });

  test('preserves safe SVG content', () => {
    const safe = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>`;
    const clean = sanitizeSvg(safe);
    expect(clean).toContain('<circle');
    expect(clean).toContain('fill="blue"');
  });
});
