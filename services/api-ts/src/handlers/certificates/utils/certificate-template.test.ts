/**
 * Tests for certificate template rendering (Slice 042)
 *
 * Covers:
 * - Template rendering with all certificate types
 * - Org-specific branding (logo, colors, signatory)
 * - Credit line rendering
 * - Validation of template data
 */

import { describe, test, expect } from 'bun:test';
import {
  renderCertificateHtml,
  validateTemplateData,
  type CertificateTemplateData,
  type OrgBranding,
} from './certificate-template';

// ─── Fixtures ───────────────────────────────────────────

function makeTemplateData(overrides: Partial<CertificateTemplateData> = {}): CertificateTemplateData {
  return {
    certificateNumber: 'CERT-2026-000001',
    recipientName: 'Dr. Maria Santos',
    trainingTitle: 'Advanced Dental Implants Workshop',
    issuedAt: new Date('2026-03-15'),
    organizationName: 'Philippine Dental Association',
    certificateType: 'attendance',
    ...overrides,
  };
}

// ─── Template Rendering ─────────────────────────────────

describe('[042] Certificate Template Rendering', () => {
  test('renders attendance certificate HTML with required fields', () => {
    const data = makeTemplateData();
    const html = renderCertificateHtml(data);

    expect(html).toContain('Certificate of Attendance');
    expect(html).toContain('Dr. Maria Santos');
    expect(html).toContain('Advanced Dental Implants Workshop');
    expect(html).toContain('CERT-2026-000001');
    expect(html).toContain('March 15, 2026');
  });

  test('renders completion certificate type', () => {
    const data = makeTemplateData({ certificateType: 'completion' });
    const html = renderCertificateHtml(data);

    expect(html).toContain('Certificate of Completion');
    expect(html).toContain('has completed');
  });

  test('renders speaker certificate type', () => {
    const data = makeTemplateData({ certificateType: 'speaker' });
    const html = renderCertificateHtml(data);

    expect(html).toContain('Certificate of Recognition as Speaker');
    expect(html).toContain('has presented at');
  });

  test('includes credit line when creditAmount provided', () => {
    const data = makeTemplateData({ creditAmount: 8, creditCategory: 'Major' });
    const html = renderCertificateHtml(data);

    expect(html).toContain('8 CPD Credits');
    expect(html).toContain('(Major)');
  });

  test('singular credit label for 1 credit', () => {
    const data = makeTemplateData({ creditAmount: 1 });
    const html = renderCertificateHtml(data);

    expect(html).toContain('1 CPD Credit');
    expect(html).not.toContain('Credits');
  });

  test('omits credit line when creditAmount not provided', () => {
    const data = makeTemplateData();
    const html = renderCertificateHtml(data);

    expect(html).not.toContain('CPD Credit');
  });
});

// ─── Org Branding ───────────────────────────────────────

describe('[042] Org-Specific Branding', () => {
  test('applies custom branding colors', () => {
    const data = makeTemplateData();
    const branding: Partial<OrgBranding> = { primaryColor: '#ff5733' };
    const html = renderCertificateHtml(data, branding);

    expect(html).toContain('#ff5733');
  });

  test('includes logo when logoUrl provided', () => {
    const data = makeTemplateData();
    const branding: Partial<OrgBranding> = {
      logoUrl: 'https://example.com/logo.png',
      orgName: 'PDA',
    };
    const html = renderCertificateHtml(data, branding);

    expect(html).toContain('https://example.com/logo.png');
    expect(html).toContain('PDA');
  });

  test('omits logo when logoUrl not provided', () => {
    const data = makeTemplateData();
    const html = renderCertificateHtml(data);

    expect(html).not.toContain('<img');
  });

  test('includes signatory when provided', () => {
    const data = makeTemplateData();
    const branding: Partial<OrgBranding> = {
      signatoryName: 'Dr. Juan Cruz',
      signatoryTitle: 'President',
    };
    const html = renderCertificateHtml(data, branding);

    expect(html).toContain('Dr. Juan Cruz');
    expect(html).toContain('President');
  });

  test('omits signatory section when not provided', () => {
    const data = makeTemplateData();
    const html = renderCertificateHtml(data);

    expect(html).not.toContain('sig-name"');
    expect(html).not.toContain('sig-title"');
  });

  test('uses default branding when none provided', () => {
    const data = makeTemplateData();
    const html = renderCertificateHtml(data);

    expect(html).toContain('#1a365d'); // default color
    expect(html).toContain('Organization'); // default org name
  });
});

// ─── Template Validation ────────────────────────────────

describe('[042] Certificate Template Validation', () => {
  test('valid data returns no errors', () => {
    const data = makeTemplateData();
    const errors = validateTemplateData(data);
    expect(errors).toHaveLength(0);
  });

  test('missing certificateNumber', () => {
    const errors = validateTemplateData({ recipientName: 'Test' });
    expect(errors).toContain('certificateNumber is required');
  });

  test('missing recipientName', () => {
    const errors = validateTemplateData({ certificateNumber: 'CERT-001' });
    expect(errors).toContain('recipientName is required');
  });

  test('missing all required fields', () => {
    const errors = validateTemplateData({});
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  test('invalid certificateType', () => {
    const errors = validateTemplateData({
      ...makeTemplateData(),
      certificateType: 'invalid' as any,
    });
    expect(errors.some(e => e.includes('Invalid certificateType'))).toBe(true);
  });
});
