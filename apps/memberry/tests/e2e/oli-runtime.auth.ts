/**
 * oli-runtime.auth.ts — per-repo auth + seed adapter for the OLI runtime loop.
 *
 * Multi-persona scaffold (Tier-3): signs in as three distinct seeded personas
 * in their OWN browser contexts and DISCOVERS representative detail-route
 * `$id` fixtures by scraping the first detail link off each role-appropriate
 * list page. This lifts the otherwise-skipped `$eventId`/`$documentId`/…
 * (member), `$invoiceId`/`$paymentId`/`$memberId` (officer), and
 * `$associationId`/`$organizationId`/`$personId` (admin) routes into the live
 * matrix without guessing API shapes or inventing ids.
 *
 * Personas (seeded — see services/api-ts/src/seed/layer-2-users.ts):
 *   • MEMBER  — member@memberry.ph (role: 'association:member')
 *   • OFFICER — test@memberry.ph    (role: 'admin,platform_admin,
 *                                           association:admin,
 *                                           association:member,
 *                                           association:officer')
 *   • ADMIN   — test@memberry.ph    (same auth user; platformAdmins row
 *                                    role='super' covers /admin/* routes)
 *
 * The returned storageState is the LAST persona signed in (ADMIN) so the
 * runner can navigate admin app routes; the runner re-establishes per-route
 * auth context only when role-scoped IDOR walks are added. Discovered fixtures
 * are merged into a single paramFixtures map keyed by route param name —
 * conflicts between personas are resolved last-write-wins (admin > officer >
 * member), which mirrors the privilege hierarchy.
 *
 * Admin app runs on a different origin (port 3003 vs 3004). Admin-list
 * navigation uses absolute URLs against `config.adminBaseURL`; member/officer
 * navigation uses the relative baseURL.
 *
 * orgSlug comes from config.paramFixtures (pda-metro-manila, the seeded chapter).
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { signInAsAdmin, signInAsMember, signInAsOfficer } from "./helpers/auth";
import { config } from "./oli-runtime.config";

export interface OliAuthAdapter {
  /**
   * Legacy single-context entry: signs in the MEMBER persona and discovers
   * member-scope fixtures. Kept for callers that only have a Page handle.
   */
  setup(page: Page): Promise<{ paramFixtures?: Record<string, string> }>;
  /**
   * Multi-persona entry: spins up three contexts (member, officer, admin),
   * collects fixtures from each, and returns the ADMIN storageState (the
   * super-set session). The runner can opt into this when admin-app routes
   * are in the matrix.
   */
  setupAll?(browser: Browser): Promise<{
    storageState: any;
    paramFixtures: Record<string, string>;
    perPersonaStorageState: { member: any; officer: any; admin: any };
  }>;
}

const ORG = "pda-metro-manila";
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

interface DiscoverEntry {
  param: string;
  list: string;
  rx: RegExp;
  /** If true, `list` is an absolute URL (admin app, different origin). */
  absolute?: boolean;
}

// Member-facing list pages — orgSlug-scoped + personal /my/* surfaces.
const MEMBER_DISCOVER: DiscoverEntry[] = [
  { param: "eventId", list: `/org/${ORG}/events/`, rx: new RegExp(`/events/(${UUID})`) },
  { param: "documentId", list: `/org/${ORG}/documents/`, rx: new RegExp(`/documents/(${UUID})`) },
  { param: "announcementId", list: `/org/${ORG}/announcements/`, rx: new RegExp(`/announcements/(${UUID})`) },
  { param: "trainingId", list: `/org/${ORG}/training/`, rx: new RegExp(`/training/(${UUID})`) },
  { param: "electionId", list: `/org/${ORG}/elections/`, rx: new RegExp(`/elections/(${UUID})`) },
  { param: "personId", list: `/org/${ORG}/directory`, rx: new RegExp(`/directory/(${UUID})`) },
  { param: "certificateId", list: `/my/certificates/`, rx: new RegExp(`/certificates/(${UUID})`) },
  { param: "surveyId", list: `/my/surveys/`, rx: new RegExp(`/surveys/(${UUID})`) },
  { param: "bookingId", list: `/my/bookings/`, rx: new RegExp(`/bookings/(${UUID})`) },
];

// Officer-facing list pages (under /_authenticated/org/$orgSlug/officer/*).
// A member hitting these would 403 → false P1; officer session avoids that.
// Note: $memberId is captured from the officer roster (officers reach members
// via /officer/roster/$memberId, NOT the public /directory/$personId surface).
// $invoiceId / $paymentId / $institutionalMembershipId are pure officer params.
const OFFICER_DISCOVER: DiscoverEntry[] = [
  { param: "memberId", list: `/org/${ORG}/officer/roster/`, rx: new RegExp(`/roster/(${UUID})`) },
  { param: "invoiceId", list: `/org/${ORG}/officer/finances/invoices/`, rx: new RegExp(`/invoices/(${UUID})`) },
  { param: "paymentId", list: `/org/${ORG}/officer/payments/`, rx: new RegExp(`/payments/(${UUID})`) },
  { param: "institutionalMembershipId", list: `/org/${ORG}/officer/institutional-memberships/`, rx: new RegExp(`/institutional-memberships/(${UUID})`) },
  // Officer-scoped survey/training/event re-discovery (separate from member
  // visibility — drafts/unpublished items only the officer can list).
  { param: "surveyId", list: `/org/${ORG}/officer/surveys/`, rx: new RegExp(`/surveys/(${UUID})`) },
  { param: "trainingId", list: `/org/${ORG}/officer/training/`, rx: new RegExp(`/training/(${UUID})`) },
  { param: "eventId", list: `/org/${ORG}/officer/events/`, rx: new RegExp(`/events/(${UUID})`) },
  { param: "announcementId", list: `/org/${ORG}/officer/communications/`, rx: new RegExp(`/communications/(${UUID})`) },
  { param: "electionId", list: `/org/${ORG}/officer/elections/`, rx: new RegExp(`/elections/(${UUID})`) },
  { param: "documentId", list: `/org/${ORG}/officer/documents/`, rx: new RegExp(`/documents/(${UUID})`) },
];

// Admin-app pages live on a DIFFERENT origin (config.adminBaseURL, port 3003).
// These are the top-level admin routes from CODE_ROUTE_MAP (module: apps/admin):
// /associations/$associationId, /organizations/$organizationId, /members/$personId.
const ADMIN_DISCOVER: DiscoverEntry[] = [
  { param: "associationId", list: `${config.adminBaseURL}/associations/`, rx: new RegExp(`/associations/(${UUID})`), absolute: true },
  { param: "organizationId", list: `${config.adminBaseURL}/organizations/`, rx: new RegExp(`/organizations/(${UUID})`), absolute: true },
  { param: "personId", list: `${config.adminBaseURL}/members/`, rx: new RegExp(`/members/(${UUID})`), absolute: true },
];

async function firstId(page: Page, entry: DiscoverEntry): Promise<string | null> {
  try {
    await page.goto(entry.list, { waitUntil: "domcontentloaded" });
    // let the list query settle (bounded; no fixed sleep beyond a short ceiling)
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const hrefs = await page.locator("a[href]").evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href") || ""),
    );
    for (const h of hrefs) {
      const m = h.match(entry.rx);
      if (m) return m[1] ?? null;
    }
  } catch {
    /* best-effort — unresolved param just stays ⊘ skipped */
  }
  return null;
}

async function discoverAs(
  context: BrowserContext,
  signIn: (p: Page) => Promise<void>,
  baseURL: string,
  entries: DiscoverEntry[],
): Promise<Record<string, string>> {
  const page = await context.newPage();
  await signIn(page);
  const collected: Record<string, string> = {};
  for (const e of entries) {
    // Each persona context is created with its own baseURL; absolute URLs in
    // `list` (admin app) bypass it and hit the foreign origin directly.
    const id = await firstId(page, e);
    if (id) collected[e.param] = id;
  }
  await page.close();
  return collected;
}

export const authAdapter: OliAuthAdapter = {
  /**
   * Legacy single-persona entry: member only. Retained because the current
   * runner (oli-runtime-loop.spec.ts) calls setup(page) with a single Page.
   * The runner upgrade to setupAll() is a separate change.
   */
  async setup(page) {
    await signInAsMember(page);
    const paramFixtures: Record<string, string> = {};
    for (const d of MEMBER_DISCOVER) {
      const id = await firstId(page, d);
      if (id) paramFixtures[d.param] = id;
    }
    return { paramFixtures };
  },

  async setupAll(browser) {
    // Three isolated contexts — each persona gets its own cookies/session so
    // we never accidentally walk officer pages while still authed as member
    // (which would 403 → false P1 noise in the runner's bad-response classifier).
    const memberCtx = await browser.newContext({ baseURL: config.baseURL });
    const officerCtx = await browser.newContext({ baseURL: config.baseURL });
    const adminCtx = await browser.newContext({ baseURL: config.adminBaseURL });

    const memberFx = await discoverAs(memberCtx, signInAsMember, config.baseURL, MEMBER_DISCOVER);
    const officerFx = await discoverAs(officerCtx, signInAsOfficer, config.baseURL, OFFICER_DISCOVER);
    const adminFx = await discoverAs(adminCtx, signInAsAdmin, config.adminBaseURL, ADMIN_DISCOVER);

    // Privilege-hierarchy merge: admin overrides officer overrides member when
    // the same param name appears in multiple personas (e.g. $surveyId visible
    // to both member and officer — officer's draft list is the more permissive
    // fixture and walking it as officer is correct).
    const paramFixtures: Record<string, string> = { ...memberFx, ...officerFx, ...adminFx };

    const perPersonaStorageState = {
      member: await memberCtx.storageState(),
      officer: await officerCtx.storageState(),
      admin: await adminCtx.storageState(),
    };

    // Return ADMIN session as the default storageState — it's the super-set
    // session (super-admin user with all roles), so it can navigate the widest
    // route surface in single-context runs.
    const storageState = perPersonaStorageState.admin;

    await memberCtx.close();
    await officerCtx.close();
    await adminCtx.close();

    return { storageState, paramFixtures, perPersonaStorageState };
  },
};
