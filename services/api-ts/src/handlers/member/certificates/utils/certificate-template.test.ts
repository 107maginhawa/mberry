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

// ─── XSS Prevention ──────────────────────────────────────

describe('[042] Certificate Template XSS Prevention', () => {
  test('escapes HTML in recipientName', () => {
    const data = makeTemplateData({ recipientName: '<script>alert("xss")</script>' });
    const html = renderCertificateHtml(data);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('escapes HTML in trainingTitle', () => {
    const data = makeTemplateData({ trainingTitle: '<img src=x onerror="alert(1)">' });
    const html = renderCertificateHtml(data);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  test('escapes HTML in orgName', () => {
    const html = renderCertificateHtml(makeTemplateData(), { orgName: '"><script>xss</script>' });
    expect(html).not.toContain('<script>xss');
  });

  test('sanitizes javascript: URLs in logoUrl', () => {
    const html = renderCertificateHtml(makeTemplateData(), {
      orgName: 'Test',
      logoUrl: 'javascript:alert(1)',
    });
    expect(html).not.toContain('javascript:');
  });

  test('escapes HTML in signatoryName', () => {
    const html = renderCertificateHtml(makeTemplateData(), {
      orgName: 'Test',
      signatoryName: '"><script>alert(1)</script>',
      signatoryTitle: 'President',
    });
    expect(html).not.toContain('<script>alert');
  });

  test('escapes HTML in certificateNumber', () => {
    const data = makeTemplateData({ certificateNumber: '<b>CERT-001</b>' });
    const html = renderCertificateHtml(data);
    expect(html).not.toContain('<b>CERT');
    expect(html).toContain('&lt;b&gt;');
  });
});

// ─── CSS Injection Prevention ────────────────────────────

describe('[042] Certificate Template CSS Injection Prevention', () => {
  test('sanitizeColor accepts 3-digit hex color', () => {
    const html = renderCertificateHtml(makeTemplateData(), { primaryColor: '#abc' });
    expect(html).toContain('color: #abc');
  });

  test('sanitizeColor accepts 6-digit hex color', () => {
    const html = renderCertificateHtml(makeTemplateData(), { primaryColor: '#1a365d' });
    expect(html).toContain('color: #1a365d');
  });

  test('sanitizeColor accepts 8-digit hex with alpha', () => {
    const html = renderCertificateHtml(makeTemplateData(), { primaryColor: '#1a365dff' });
    expect(html).toContain('color: #1a365dff');
  });

  test('sanitizeColor accepts rgb color', () => {
    const html = renderCertificateHtml(makeTemplateData(), { primaryColor: 'rgb(26, 54, 93)' });
    expect(html).toContain('color: rgb(26, 54, 93)');
  });

  test('sanitizeColor accepts rgba color', () => {
    const html = renderCertificateHtml(makeTemplateData(), { primaryColor: 'rgba(26, 54, 93, 0.5)' });
    expect(html).toContain('color: rgba(26, 54, 93, 0.5)');
  });

  test('rejects CSS injection — named color with expression', () => {
    const html = renderCertificateHtml(makeTemplateData(), {
      primaryColor: 'red; background-image: url(evil)',
    });
    expect(html).toContain('color: #1a365d');
    expect(html).not.toContain('background-image');
  });

  test('rejects CSS injection — closing brace injection', () => {
    const html = renderCertificateHtml(makeTemplateData(), {
      primaryColor: '; } body { display:none',
    });
    expect(html).toContain('color: #1a365d');
    expect(html).not.toContain('display:none');
  });

  test('rejects plain named color (not in allowlist)', () => {
    const html = renderCertificateHtml(makeTemplateData(), { primaryColor: 'red' });
    expect(html).toContain('color: #1a365d');
  });

  test('falls back for undefined primaryColor', () => {
    const html = renderCertificateHtml(makeTemplateData(), { primaryColor: undefined });
    expect(html).toContain('color: #1a365d');
  });

  test('signatoryTitle truncated at 100 chars', () => {
    const longTitle = 'A'.repeat(150);
    const html = renderCertificateHtml(makeTemplateData(), {
      signatoryName: 'Dr. Smith',
      signatoryTitle: longTitle,
    });
    expect(html).not.toContain(longTitle);
    expect(html).toContain('A'.repeat(100));
  });

  test('short signatoryTitle passes through unchanged', () => {
    const html = renderCertificateHtml(makeTemplateData(), {
      signatoryName: 'Dr. Smith',
      signatoryTitle: 'President',
    });
    expect(html).toContain('President');
  });
});
