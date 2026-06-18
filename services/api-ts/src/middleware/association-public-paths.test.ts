import { describe, test, expect } from 'bun:test';
import { isAssociationPublicPath } from './association-public-paths';

describe('isAssociationPublicPath (FIX-009 — public-path exemption boundary match)', () => {
  test('exact public path is exempt', () => {
    expect(isAssociationPublicPath('/association/member/credentials/public-verify')).toBe(true);
    expect(isAssociationPublicPath('/association/member/directory/public')).toBe(true);
  });

  test('a public-path subtree (/search/:personId/public) is exempt', () => {
    expect(isAssociationPublicPath('/association/member/directory/search/abc-123/public')).toBe(true);
    expect(isAssociationPublicPath('/association/member/credentials/public-verify/xyz')).toBe(true);
  });

  test('a sibling route sharing a public prefix is NOT exempt', () => {
    // Must not be exempted by the `/public-verify` entry.
    expect(isAssociationPublicPath('/association/member/credentials/public-verify-admin')).toBe(false);
  });

  test('a private route under a public prefix segment is NOT exempt', () => {
    // `/searchInternal` is a distinct private route.
    expect(isAssociationPublicPath('/association/member/directory/searchInternal')).toBe(false);
  });

  test('the authenticated base directory search is NOT exempt', () => {
    // Only the public profile sub-path (/search/:personId/public) is public.
    // The bare /directory/search is the AUTHENTICATED member search and must
    // pass through auth + org-context middleware (else orgMembership is never
    // set and the handler 403s with "Organization membership required").
    expect(isAssociationPublicPath('/association/member/directory/search')).toBe(false);
    expect(
      isAssociationPublicPath(
        '/association/member/directory/search?organizationId=abc&q=Juan',
      ),
    ).toBe(false);
  });

  test('an unrelated association route is NOT exempt', () => {
    expect(isAssociationPublicPath('/association/member/dues/invoices')).toBe(false);
  });
});
