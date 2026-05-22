// Business Rules: [BR-31]
/**
 * [BR-31] SVG Upload Security — Pure Domain Logic Tests
 *
 * BR-31: SVG uploads must be sanitized before storage.
 * - Script tags and their content must be removed.
 * - Event handler attributes (onload, onerror, onclick, etc.) must be stripped.
 * - External references (href, xlink:href to external URLs) must be removed.
 * - Safe SVG structure and inline styles/shapes must be preserved.
 */

import { describe, test, expect } from 'bun:test';

// ─── Domain helpers (pure sanitization logic) ────────────────

/**
 * Removes <script> blocks and their contents from SVG.
 */
function removeScriptTags(svg: string): string {
  return svg.replace(/<script[\s\S]*?<\/script>/gi, '');
}

/**
 * Strips all event handler attributes (on*) from SVG elements.
 */
function removeEventHandlers(svg: string): string {
  return svg.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Removes external href / xlink:href references (http/https/data).
 */
function removeExternalReferences(svg: string): string {
  // Remove xlink:href with external URL
  svg = svg.replace(/\s+xlink:href\s*=\s*["'](https?:|data:)[^"']*["']/gi, '');
  // Remove href with external URL on non-<a> elements (and <a> external links)
  svg = svg.replace(/\s+href\s*=\s*["'](https?:|data:)[^"']*["']/gi, '');
  return svg;
}

/**
 * Full SVG sanitizer — applies all BR-31 rules.
 */
function sanitizeSvg(svg: string): string {
  let result = removeScriptTags(svg);
  result = removeEventHandlers(result);
  result = removeExternalReferences(result);
  return result;
}

/**
 * Checks whether an SVG contains any known injection patterns.
 */
function svgHasSecurityRisk(svg: string): boolean {
  if (/<script/i.test(svg)) return true;
  if (/\son\w+\s*=/i.test(svg)) return true;
  if (/xlink:href\s*=\s*["'](https?:|data:)/i.test(svg)) return true;
  if (/\shref\s*=\s*["'](https?:|data:)/i.test(svg)) return true;
  return false;
}

// ─── [BR-31] Tests ──────────────────────────────────────────

describe('[BR-31] SVG Script Tag Removal', () => {
  test('[BR-31] removes inline script tag', () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg">
      <script>alert("xss")</script>
      <circle cx="50" cy="50" r="40"/>
    </svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert');
    expect(clean).toContain('<circle'); // safe content preserved
  });

  test('[BR-31] removes script with type attribute', () => {
    const malicious = `<svg><script type="text/javascript">evil()</script></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('evil');
    expect(svgHasSecurityRisk(clean)).toBe(false);
  });
});

describe('[BR-31] SVG Event Handler Removal', () => {
  test('[BR-31] removes onload attribute', () => {
    const malicious = `<svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg"><rect/></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('onload');
    expect(clean).toContain('<svg');
    expect(clean).toContain('<rect');
  });

  test('[BR-31] removes onerror and onclick attributes', () => {
    const malicious = `<svg><image onerror="evil()" onclick="bad()"/></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
  });
});

describe('[BR-31] SVG External Reference Removal', () => {
  test('[BR-31] removes xlink:href with external URL', () => {
    const malicious = `<svg><use xlink:href="https://evil.com/sprite.svg#icon"/></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('https://evil.com');
  });

  test('[BR-31] removes data: URI references', () => {
    const malicious = `<svg><image href="data:text/html,<script>alert(1)</script>"/></svg>`;
    const clean = sanitizeSvg(malicious);
    expect(clean).not.toContain('data:');
  });

  test('[BR-31] preserves safe SVG shapes and structure', () => {
    const safe = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="#e8f4f8"/>
      <rect x="10" y="10" width="30" height="30" fill="blue"/>
      <text x="20" y="20">Hello</text>
    </svg>`;
    const clean = sanitizeSvg(safe);
    expect(clean).toContain('<circle');
    expect(clean).toContain('<rect');
    expect(clean).toContain('<text');
    expect(svgHasSecurityRisk(clean)).toBe(false);
  });
});
