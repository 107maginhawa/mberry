/**
 * oli-runtime.auth.ts — per-repo auth + seed adapter for the OLI runtime loop.
 *
 * Signs in as the seeded regular MEMBER (primary persona, broadest
 * /_authenticated/org/* coverage), then DISCOVERS representative detail-route
 * `$id` fixtures by scraping the first detail link off each member-facing list
 * page. This lifts the otherwise-skipped `$eventId`/`$documentId`/… routes into
 * the live matrix without guessing API shapes or inventing ids.
 *
 * Officer-only params ($invoiceId/$paymentId/$memberId under /officer/) are
 * intentionally NOT seeded here — a member hitting them would 403 and produce a
 * false P1. Those stay legitimately ⊘ until an officer-session pass is added.
 *
 * orgSlug comes from config.paramFixtures (pda-metro-manila, the seeded chapter).
 */
import type { Page } from "@playwright/test";
import { signInAsMember } from "./helpers/auth";

export interface OliAuthAdapter {
  setup(page: Page): Promise<{ paramFixtures?: Record<string, string> }>;
}

const ORG = "pda-metro-manila";
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

// param token -> { list route to visit, regex capturing the id from a detail href }
const DISCOVER: { param: string; list: string; rx: RegExp }[] = [
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

async function firstId(page: Page, list: string, rx: RegExp): Promise<string | null> {
  try {
    await page.goto(list, { waitUntil: "domcontentloaded" });
    // let the list query settle (bounded; no fixed sleep beyond a short ceiling)
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const hrefs = await page.locator("a[href]").evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href") || ""),
    );
    for (const h of hrefs) {
      const m = h.match(rx);
      if (m) return m[1] ?? null;
    }
  } catch {
    /* best-effort — unresolved param just stays ⊘ skipped */
  }
  return null;
}

export const authAdapter: OliAuthAdapter = {
  async setup(page) {
    await signInAsMember(page);
    const paramFixtures: Record<string, string> = {};
    for (const d of DISCOVER) {
      const id = await firstId(page, d.list, d.rx);
      if (id) paramFixtures[d.param] = id;
    }
    return { paramFixtures };
  },
};
