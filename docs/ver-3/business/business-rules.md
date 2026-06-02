# Business Rules — Memberry Healthcare Association Management Platform

This document is the definitive reference for all platform business rules. It covers Phase 1 (BR-01 through BR-32, plus the M09 training rules BR-41/BR-42/BR-43), Phase 2 (BR-33 through BR-37, plus the M12 election rules BR-44/BR-50/BR-67), and Phase 3 (BR-38 through BR-40). Additional Wave-4-discovery rules (BR-41..BR-51) are cataloged in `br-registry.json`; BR-52..BR-66 are reserved per the m20-booking / m21-billing / m22-email MODULE_SPECs (allocated to resolve TR-P1-001..003 anchor gaps). Authoritative per-module definitions live in each MODULE_SPEC §5; this file carries the long-form normative description for rules where prose disambiguation matters (e.g., BR-42 and BR-67 post-split). Every rule here is normative: the system must behave exactly as described. Rules are used by the tech team for implementation, by QA for validation, and by the product team as the authoritative source during story creation. When a rule conflicts with a story or specification, this document takes precedence unless a change has been formally approved and this document updated.

---

### BR-01: Membership Status Computation

- **Phase:** 1
- **Module(s):** M05
- **Description:** Membership status is computed at query time from `dues_expiry_date`. It is never stored as a mutable field. Status is per-organization, not global — a member can be Active in one org and Lapsed in another.
- **Edge cases:** If `dues_expiry_date` is null (e.g., life member or honorary member), status defaults to Active unless the membership record has been explicitly suspended.

---

### BR-02: Grace Period Default

- **Phase:** 1
- **Module(s):** M05
- **Description:** The default grace period is 30 days after `dues_expiry_date`. Grace period is configurable per org, with a minimum of 0 days and a maximum of 90 days. Members in Grace status retain read-only platform access but cannot register for new events or training sessions.
- **Edge cases:** None beyond the min/max config bounds.

---

### BR-03: Membership Transitions

- **Phase:** 1
- **Module(s):** M05
- **Description:** Only the following state machine transitions are valid:
  - PENDING → ACTIVE (officer approves)
  - PENDING → REMOVED (officer rejects)
  - ACTIVE → GRACE (automatic, dues expired)
  - GRACE → LAPSED (automatic, grace period expired)
  - LAPSED → ACTIVE (member pays dues)
  - ACTIVE / GRACE / LAPSED → SUSPENDED (officer action)
  - SUSPENDED → ACTIVE (officer restores)
  - ACTIVE → REMOVED (president action)

  Invalid transitions are rejected silently — no error is surfaced to the user, and no state change occurs.
- **Edge cases:** None. The list above is exhaustive.

---

### BR-04: Dues Amount per Org

- **Phase:** 1
- **Module(s):** M06
- **Description:** Each org sets its own dues amount, currency (inherited from the association), and billing cycle (annual, semi-annual, or quarterly). The configured amount applies to all members of that org regardless of membership category, unless category-specific overrides have been explicitly configured.
- **Edge cases:** None beyond the category-override path.

---

### BR-05: Fund Allocation

- **Phase:** 1
- **Module(s):** M06
- **Description:** Dues payments are split into 0–N designated funds per configuration. Allocation percentages must sum to exactly 100%; configurations that do not sum to 100% are rejected. Rounding is currency-aware (PHP uses 2 decimal places). The last fund in the ordered list absorbs any rounding remainder, whether positive or negative, so that the sum of all fund amounts always equals the original payment amount exactly.

  Example (PHP 500.00 across 3 funds at 60/30/10%): Fund A = ₱300.00, Fund B = ₱150.00, Fund C = ₱50.00.
  Example with rounding (PHP 100.00 at 33/33/34%): Fund A = ₱33.00, Fund B = ₱33.00, Fund C = ₱34.00.
- **Edge cases:** Orgs with zero funds configured still process payments successfully; no allocation records are created, and the payment is recorded as unallocated.

---

### BR-06: Payment Recording

- **Phase:** 1
- **Module(s):** M06
- **Description:** Treasurers can record payments manually (cash, check, bank transfer) or via the payment gateway. Each payment record includes: member, amount, date, method, fund breakdown, and the identity of the officer who recorded it. Gateway payments generate receipts automatically. Manual payments generate a printable receipt on demand.
- **Edge cases:** None beyond method-specific receipt behavior.

---

### BR-07: Dues Expiry Extension on Payment

- **Phase:** 1
- **Module(s):** M06
- **Description:** When a payment is recorded for a member, `dues_expiry_date` is extended by exactly one billing cycle from the current expiry date — not from today's date. This ensures early-paying members do not lose credit for the remaining time on their current term.

  Exception: if `dues_expiry_date` is more than one billing cycle in the past (severely lapsed), the new expiry is set from today + one billing cycle.
- **Edge cases:** The "severely lapsed" threshold is exactly one billing cycle. If the expiry is exactly one billing cycle ago to the day, the standard extension (from current expiry) still applies.

---

### BR-08: Refund Policy

- **Phase:** 1
- **Module(s):** M06
- **Description:** Refunds can only be issued by the Treasurer. Refunding a payment reverses the `dues_expiry_date` extension that payment created. If the reversal would place the member's expiry date in the past, membership status is recomputed immediately upon saving the refund. Gateway payment refunds trigger a refund request to the payment gateway. Manual payment refunds are recorded as a negative payment entry.
- **Edge cases:** A refund that causes a status regression (e.g., Active → Grace or Active → Lapsed) does not require a separate officer action — the status change follows automatically from the recomputed expiry date per BR-01.

---

### BR-09: Officer Role Assignment

- **Phase:** 1
- **Module(s):** M04
- **Description:** Officer roles (President, Treasurer, Secretary) are assigned by the President. Only one person may hold each role per org at any given time. The President can remove and reassign roles at any time. A member cannot hold more than one officer role in the same org simultaneously. Officers remain regular members of the org regardless of their officer designation.
- **Edge cases:** If the President role itself needs to be reassigned (e.g., the sitting President is stepping down), a National Admin or Platform Admin must perform the reassignment.

---

### BR-10: Platform Admin Impersonation

- **Phase:** 1
- **Module(s):** M03
- **Description:** Platform admins can impersonate any user for support purposes. While impersonating, an orange "Viewing as [Name]" banner is always visible on every page. All actions taken during the impersonation session are logged with both the impersonator's ID and the impersonated user's ID. Impersonation sessions auto-expire after 30 minutes of inactivity.
- **Edge cases:** Actions taken during impersonation that require confirmation (e.g., payment recording, role changes) must also display the banner at the confirmation step so there is no ambiguity in the audit log.

---

### BR-11: Credit Cycle Start

- **Phase:** 1
- **Module(s):** M10
- **Description:** Each member's CPD/CE credit cycle starts from their registration date in the association (not the org, and not the platform sign-up date). Cycle duration is configurable per association: 1, 2, or 3 years. Credit cycles are per-member — they are not synchronized across members of the same org.
- **Edge cases:** If a member's registration date is unknown (e.g., imported from a legacy system without dates), an officer must manually set it before credit tracking activates for that member.

---

### BR-12: Credit Carry-Over

- **Phase:** 1
- **Module(s):** M10
- **Description:** Credits earned beyond the cycle requirement carry over to the next cycle automatically. Carry-over amount = total credits earned minus the cycle requirement. Carry-over is capped at 50% of the next cycle's requirement unless the association has configured a different cap.
- **Edge cases:** If a member has a negative balance at cycle end (due to deductions), the deficit carries forward into the new cycle as a negative opening balance.

---

### BR-13: Auto vs Manual Credits

- **Phase:** 1
- **Module(s):** M10
- **Description:** AUTO credits are generated by the platform when a member's attendance at a training session is confirmed. MANUAL credits are self-entered by the member — no officer approval is required. Both types are summed in the member's total. Manual credit entries require: activity name, date, credit hours, and a description. Supporting documents are optional but recommended.
- **Edge cases:** Manual credits self-entered by a member are not subject to officer approval, but officers retain the ability to deduct credits per M10-R4 (Officer Manual Adjustment) if a manual entry is found to be inaccurate.

---

### BR-14: Cross-Org Credit Aggregation

- **Phase:** 1
- **Module(s):** M10
- **Description:** A member's total CPD credits are aggregated across all organizations they belong to within the same association. Credits earned through Org A count toward the member's association-wide total. Credits from different associations are never aggregated with each other.
- **Edge cases:** Credits earned at an org the member has since left (transferred out or deactivated) still count toward the aggregate. Credit history is never orphaned.

---

### BR-15: Training vs Event Distinction

- **Phase:** 1
- **Module(s):** M08, M09
- **Description:** Events do not generate CPD credits. Training sessions generate credits. The distinction is set at creation time by selecting an activity type. Event types: General Assembly, Induction Ceremony, Mission Trip, Social Gathering, Sports Event, Fundraiser, Site Visit, Other. Training types: Seminar, Workshop, Convention, Online Course, Webinar.
- **Edge cases:** Activity type cannot be changed after the activity has been published and registrations have been received. If a type correction is needed after that point, the activity must be cancelled and recreated.

---

### BR-16: Activity Visibility

- **Phase:** 1
- **Module(s):** M08, M09
- **Description:** Events default to Internal visibility (visible only to the hosting org's members). Training sessions default to Network-Wide visibility (visible across all orgs in the association). Officers can override the default visibility setting when creating an activity, before publishing.
- **Edge cases:** Changing visibility from Network-Wide to Internal after external members have already registered must not silently remove those registrations. The system must warn the officer and list affected external registrants. The officer may proceed (external registrations are preserved, no new external registrations accepted) or cancel the change.

---

### BR-17: Attendance Confirmation

- **Phase:** 1
- **Module(s):** M08, M09
- **Description:** Attendance must be explicitly confirmed for CPD credits to be generated for training sessions. Officers can record attendance manually (checking off a list) or via QR code scan. QR code scanning records a timestamp. Manual recording by an officer does not require supporting proof. The system does not auto-confirm attendance from registration alone.
- **Edge cases:** If a member scans the QR code multiple times (accidentally or otherwise), the system recognizes the duplicate, notifies the scanner that the member is already checked in, and awards no additional credits.

---

### BR-18: QR Code Authentication

- **Phase:** 1
- **Module(s):** M11
- **Description:** QR codes on member ID cards and training certificates are HMAC-signed. Scanning verifies that the encoded data has not been tampered with (authenticity check). It does not verify current membership status in real time. The QR payload includes the date the card was generated. Cards older than 30 days should be considered potentially stale. The verification landing page displays: "Authentic as of [date generated]. For current status, contact the organization."
- **Edge cases:** HMAC secrets must be rotatable. When a secret is rotated, previously generated QR codes must remain verifiable during a transition period (the system tries the current secret, then the previous secret). After the transition window closes, affected cards must be regenerated.

---

### BR-19: ID Card Generation

- **Phase:** 1
- **Module(s):** M11
- **Description:** Member ID cards are generated on demand — they are not pre-generated for all members. Members in Active or Grace status can generate cards. Members in Lapsed or Suspended status cannot generate new cards, but their previously generated cards remain technically valid (HMAC-authentic) until the 30-day staleness recommendation passes. Platform admins can generate a card for any member regardless of status.
- **Edge cases:** A member who transitions from Active to Lapsed between card generation and use will present an authentic but stale card. The verification page will show the generation date, allowing the checker to assess staleness.

---

### BR-20: Certificate Generation

- **Phase:** 1
- **Module(s):** M11
- **Description:** Training certificates are generated per attendance record. A certificate can only be generated after the activity's scheduled end date has passed and the member's attendance has been confirmed. Each certificate includes: member name, activity name, credit hours, date of activity, organization name, and a QR code for verification. Certificates are not automatically regenerated if the training record changes after initial generation — a new certificate must be generated manually.
- **Edge cases:** For multi-day activities, "end date has passed" means after the last scheduled day. Cancelled activities must never produce certificates, even if attendance was recorded before cancellation.

---

### BR-21: Multi-Org Member Account

- **Phase:** 1
- **Module(s):** M01
- **Description:** One member equals one platform account and one set of login credentials. A member can belong to multiple organizations simultaneously. Each org membership is independent: separate dues schedule, separate membership status, and separate activity participation within that org's context.
- **Edge cases:** A member whose last remaining active org-membership is deactivated can still log in and view historical data, but sees an empty org selector with guidance to join or re-join an organization.

---

### BR-22: Member Matching on Import

- **Phase:** 1
- **Module(s):** M01, M05
- **Description:** When importing a roster or when a member self-registers, the platform attempts to match the record to an existing account. Match criteria: email (exact, case-insensitive) OR license number (normalized: strip spaces, dashes, and leading zeros; case-insensitive; association-aware format). If the email matches Person A but the license number matches Person B: conflict. The record is flagged for human (platform admin) resolution, and no auto-linking occurs. If no match is found, a new account is created.
- **Edge cases:** A match where the names differ significantly between the import row and the existing account (e.g., "Maria Cruz" vs. "Jose Santos") should be flagged for manual review even if a single field matches, as this suggests a data entry error rather than a genuine match.

---

### BR-23: License Number Format

- **Phase:** 1
- **Module(s):** M02
- **Description:** License numbers are stored in their original entered format. For matching purposes, they are normalized using the following algorithm: lowercase, remove spaces, remove dashes, remove leading zeros. Example: "PRC-12345", "PRC 12345", "prc12345", and "12345" all normalize to the same canonical value within the Philippine dental association context.
- **Edge cases:** Normalization rules are configurable per association to accommodate different national license number formats. The normalization algorithm described here is the default; associations with different conventions can override it.

---

### BR-24: Invitation Expiry

- **Phase:** 1
- **Module(s):** M01
- **Description:** Officer-generated member invitations expire after 7 days. After expiry, the officer must resend the invitation. The invitation link allows the recipient to set an initial password and activates the account. Members who claim their account via invitation do not need to separately verify their email address — the officer's act of importing and sending the invitation constitutes verification.
- **Edge cases:** If a member clicks an expired invitation link, the system displays: "This invitation has expired. Please contact your association officer to request a new one." The expired link is not reactivated.

---

### BR-25: OTP Registration

- **Phase:** 1
- **Module(s):** M01
- **Description:** Self-registration uses a 6-digit OTP sent to the member's email address. The OTP is valid for 10 minutes. The member has a maximum of 3 attempts before the OTP is invalidated and they must request a new one. After 3 failed OTP requests within a single hour, the email address is rate-limited for 1 hour.
- **Edge cases:** Rate-limiting applies to the email address, not the IP address. A member using a different device or network with the same email still hits the same rate limit.

---

### BR-26: Session Management

- **Phase:** 1
- **Module(s):** M01
- **Description:** Each user account supports a maximum of 3 concurrent active sessions. Sessions expire after 8 hours of inactivity. Changing a password force-logs out all other active sessions immediately. The session in which the password was changed remains active.
- **Edge cases:** If a user is at the 3-session limit and logs in on a new device, the oldest inactive session is automatically invalidated to make room for the new one.

---

### BR-27: Event Registration Limits

- **Phase:** 1
- **Module(s):** M08
- **Description:** Events can have a maximum capacity configured. When capacity is reached, new registrations are added to a waitlist. When a confirmed registration is cancelled, the next waitlisted member is automatically promoted to confirmed (FIFO by position).
- **Edge cases:** If a cancellation occurs after the deadline, the slot is not automatically offered to the waitlist. The officer must manually decide whether to accept the late cancellation and open the slot.
- **Deferred (v1.2):** Automatic notification to promoted member (needs notifs module wiring). Configurable cancellation deadline per event (needs `cancellationDeadlineHours` schema field). Late-cancellation officer workflow.

---

### BR-28: Communication Deduplication

- **Phase:** 1
- **Module(s):** M07
- **Description:** When sending communications to members who belong to multiple organizations, duplicate messages for the same notification type are suppressed. Each member receives at most one notification per notification event, regardless of how many orgs trigger the same notification. Example: if a member belongs to 3 orgs and all 3 have dues reminders scheduled for the same day, the member receives only 1 dues reminder.
- **Edge cases:** Deduplication applies per notification type per day. Two different notification types (e.g., a dues reminder and an event announcement) from the same orgs on the same day are not deduplicated against each other.

---

### BR-29: Org Public Page

- **Phase:** 1
- **Module(s):** M04
- **Description:** Each org has a public page accessible at a unique URL without requiring login. The page displays: org name, org type, associated association, member count, upcoming events and training (network-wide or public activities only), and an "Apply to Join" button.
- **Edge cases:** If an org has no upcoming public activities, the activities section is hidden rather than shown empty. Member count shows the count of Active members only, not total roster.

---

### BR-30: Payment Gateway Isolation

- **Phase:** 1
- **Module(s):** M06
- **Description:** Two entirely separate gateway accounts exist: the Platform Gateway (used by Memberry to bill associations for platform subscription fees) and the Org Gateway (used by each org to collect dues from members). These are never shared or co-mingled. An org's gateway credentials cannot be used for platform billing and vice versa. Each org configures and owns its own gateway account independently.
- **Edge cases:** An org that has not configured a gateway can still operate the platform for membership management, events, and credit tracking. Online payment collection is unavailable; manual payment recording per BR-06 remains functional.

---

### BR-31: SVG Upload Security

- **Phase:** 1
- **Module(s):** M04
- **Description:** SVG files uploaded as org logos must be sanitized before storage. Sanitization removes: embedded scripts (script tags), event handlers (onload, onclick, and all other on* attributes), external references (href or src attributes pointing to external URLs), and embedded base64 data URIs. SVG files that cannot be successfully sanitized are rejected with a user-facing error message. Member profile photos do not accept SVG — only JPEG, PNG, and WebP are permitted per M2-R9.
- **Edge cases:** If a member attempts to upload an SVG as a profile photo, the upload is rejected at format validation before sanitization: "Accepted formats: JPEG, PNG, WebP."

---

### BR-32: Financial Record Retention

- **Phase:** 1
- **Module(s):** M06
- **Description:** Payment records are retained for a minimum of 7 years per Philippine BIR (Bureau of Internal Revenue) requirements. If a member deletes their account, their payment records are retained but associated with an anonymized member identifier rather than the live account record.
- **Edge cases:** Anonymization is not deletion. The payment amount, date, method, fund breakdown, and recording officer remain intact. Only the direct personal identifier (name, email) is replaced with an anonymized token.

---

### BR-33: Election Integrity

- **Phase:** 2
- **Module(s):** M12
- **Description:** An election requires a minimum of 2 candidates per position to be considered valid. Officers can manually close nominations if the minimum is not met. Online votes use one-time tokens issued per eligible member — double voting is prevented at the token level, not merely at the UI level. Election results are not displayed to any member until the election is officially closed by the President.
- **Edge cases:** If a candidate becomes ineligible (per BR-34) after nominations close but before voting closes, the system notifies the election administrator. The administrator decides whether to remove the candidate from the ballot or proceed. Votes already cast for a removed candidate are voided.

---

### BR-34: Nomination Eligibility

- **Phase:** 2
- **Module(s):** M12
- **Description:** To be nominated for an officer position, a member must satisfy all three conditions: (1) be in Active status in the org at the time of nomination, (2) have been a member of the association for at least 6 months (configurable per association), and (3) not be currently suspended in any org within the association. The duration requirement is configurable per association.
- **Edge cases:** Eligibility is checked at the moment of nomination, not retroactively. A member who meets all criteria at nomination time but later falls into Grace status before voting opens does not become ineligible retroactively — only their voting eligibility is affected (per BR-33), not their candidacy.

---

### BR-35: Feed Content Moderation

- **Phase:** 2
- **Module(s):** M13
- **Description:** Officers can remove posts and comments from the professional feed within their own org's context. Platform admins can remove content from any org's feed. Members can report content for officer review. Reported content remains visible to officers (flagged) while under review. All content removed for policy violations is logged with the removal reason in the audit trail.
- **Edge cases:** A member whose post is removed receives an in-app notification that their content was removed and the reason given. They are not shown who reported it.

---

### BR-36: National Dashboard Access

- **Phase:** 2
- **Module(s):** M14
- **Description:** National-level dashboards showing cross-chapter aggregate reports are accessible to Platform Admins and to designated National Officers (configured per association by the Platform Admin). Chapter-level officers cannot view data from other chapters. All cross-chapter data shown in the national dashboard is aggregated — no individual member-level data is exposed unless the relevant chapter has explicitly granted consent.
- **Edge cases:** Aggregate data for chapters with fewer than 5 members must be rolled into a "Small chapters" combined category rather than displayed individually, to prevent re-identification.

---

### BR-37: Job Posting Expiry

- **Phase:** 2
- **Module(s):** M15
- **Description:** Job postings expire after 30 days by default. Expiry duration is configurable per individual posting at creation time. Expired postings are removed from the public job board but retained in the officer's posting history for record-keeping. Job posters receive a reminder notification 3 days before their posting expires. They can extend the posting for another 30 days with a single action.
- **Edge cases:** Extensions reset the expiry clock from the current expiry date, not from today. A posting extended on day 28 of a 30-day term expires on day 58 from original posting, not day 58 from today.

---

### BR-38: Marketplace Referral Disclosure

- **Phase:** 3
- **Module(s):** M17
- **Description:** Any referral fee, commission, or revenue-share arrangement between Memberry and a marketplace vendor must be disclosed to the association before the association can interact with that vendor's listing. The disclosure is shown on the vendor's product detail page and must be acknowledged before proceeding with any adoption or application flow. Associations can opt out of seeing marketplace listings from specific vendors.
- **Edge cases:** If a referral arrangement is added to a vendor after their listing goes live, existing associations must be notified of the updated terms within 30 days. Until they acknowledge the updated disclosure, they cannot interact with the listing.

---

### BR-39: Committee Dissolution

- **Phase:** 3
- **Module(s):** M19
- **Description:** When a committee term ends or the committee is dissolved by the President, the committee status changes to Completed. All committee data — meetings, minutes, tasks, and reports — is retained indefinitely for audit purposes. Members lose access to the committee workspace, but officers and platform admins can still view the full historical record.
- **Edge cases:** Dissolving a committee does not affect the membership status of its members. Members who served on the committee retain their org membership and all associated history. Only committee-specific access is removed.

---

### BR-40: Survey Anonymity

- **Phase:** 3
- **Module(s):** M18
- **Description:** For anonymous surveys, the platform does not store any mapping between a response and the responding member. Platform admins cannot reconstruct which member submitted which response — the architecture must make this technically impossible, not merely policy-prohibited. Only the response content and its submission timestamp are stored. For identified surveys, the member-response mapping is stored and visible to association officers only; platform admins cannot deanonymize any survey response regardless of survey type.
- **Edge cases:** Anonymous surveys with very small response pools (below 10 responses by default) display a warning to the survey creator that anonymity may be compromised through inference, even though the platform itself does not expose identity. Free-text fields in anonymous surveys display a respondent-facing warning: "Avoid including personal details in open-ended answers to preserve your anonymity."

---

### BR-42: Training Type Restricted to Platform-Defined Types

- **Phase:** 1
- **Module(s):** M09
- **Description:** Training type is restricted to a fixed enum of five platform-defined types (e.g., webinar, in-person, hybrid, self-paced, workshop). Associations cannot define custom training types — the catalog is platform-managed to keep reporting, credit-rules, and CE-board exports consistent across orgs. Enforced at the schema/enum layer and validated in `createTraining.ts` via the `VALID_TRAINING_TYPES` constant. Implements M9-R1; canonical per WORKFLOW_MAP §4. **Provenance:** previously this BR-ID was reused for the M12 vote-integrity rule. Per TR-P1-004 the M12 use was renamed to BR-67, leaving BR-42 exclusively for this M09 training-type rule (the canonical meaning per WORKFLOW_MAP §4).
- **Edge cases:** A request that supplies a non-enum training type is rejected with a 422 validation error before the handler runs. Adding a new training type requires a platform-level migration and is not an org-admin operation.

---

### BR-67: One Vote Per Person Per Position

- **Phase:** 2
- **Module(s):** M12
- **Description:** During an open election, each eligible member may cast exactly one vote per position per election. The vote-cast handler enforces this via a uniqueness check on `(electionId, positionId, voterId)`; duplicate submissions are rejected with a `ConflictError`. Implements M12-R1. **Provenance:** minted on 2026-06-02 to resolve TR-P1-004 (BR-42 overload). The previous tagging used `BR-42` in tests/seed/registry, which clashed with the canonical M09 BR-42 (training-type restriction) in WORKFLOW_MAP §4. The vote-integrity rule keeps the same semantics, just under the new ID BR-67. (BR-52..BR-66 are reserved for the m20-booking / m21-billing / m22-email spec-ID blocks; this rule jumps to BR-67 to avoid collision.)
- **Edge cases:** Re-submitting the same ballot is idempotent only when the payload is byte-identical and arrives before the conflict guard reads — in practice all duplicates are rejected. Vote changes during the open window are not supported in v1: members must contact the election officer to invalidate the prior vote, and even that path is gated by `M12-R2` (results immutability once published). Cross-position votes within a single ballot are independent rows and do not trigger the conflict guard against each other.
