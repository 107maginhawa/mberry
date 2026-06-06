---
based-on: map@2331bd9f
last-modified: 2026-06-03T20:30:00Z
engine-version: 7b2a640
map-version: 6
---

# Code Data Model

<!-- oli:regen:code-data-model:begin -->
Dialect: `postgres` · Tables: 131 · Enums: 122

| Table | Cols | PK | FK | Module |
|---|---|---|---|---|
| `account` | 13 | id | user_id→user | unknown |
| `accredited_provider` | 5 | — | — | handlers/association:operations |
| `ad_campaign` | 12 | — | advertiser_id→advertisers | handlers/advertising |
| `ad_creative` | 11 | — | campaign_id→campaigns | handlers/advertising |
| `ad_report` | 4 | — | creative_id→creatives | handlers/advertising |
| `advertiser` | 5 | — | — | handlers/advertising |
| `affiliation_transfer` | 10 | — | — | handlers/association:member |
| `aging_bucket` | 8 | — | — | handlers/dues |
| `announcement` | 12 | — | author_id→persons | handlers/communication |
| `announcement_stats` | 7 | — | announcement_id→announcements | handlers/communication |
| `apikey` | 22 | id | — | unknown |
| `association` | 11 | — | — | handlers/platformadmin |
| `audit_log_entry` | 21 | — | archived_by→user | handlers/audit |
| `billing_config` | 7 | — | — | handlers/billing |
| `booking` | 18 | — | client_id→persons, host_id→persons, slot_id→timeSlots | handlers/booking |
| `booking_event` | 17 | — | owner_id→persons | handlers/booking |
| `breach_incident` | 16 | id | — | handlers/platformadmin |
| `certificate` | 13 | — | person_id→persons | handlers/certificates |
| `chapter_affiliation` | 7 | — | — | handlers/association:member |
| `chapter_snapshot` | 14 | — | — | handlers/platformadmin |
| `chat_message` | 9 | — | chat_room_id→chatRooms | handlers/comms |
| `chat_message_reaction` | 5 | id | message_id→chatMessages | handlers/comms |
| `chat_room` | 10 | — | — | handlers/comms |
| `chat_room_member` | 7 | id | chat_room_id→chatRooms | handlers/comms |
| `check_in` | 7 | — | — | handlers/association:operations |
| `committee` | 7 | — | — | handlers/association:operations |
| `committee_member` | 7 | — | — | handlers/association:operations |
| `committee_task` | 10 | — | — | handlers/association:operations |
| `course` | 6 | — | — | handlers/association:operations |
| `course_enrollment` | 6 | — | — | handlers/association:operations |
| `credential_template` | 6 | — | organization_id→organizations | handlers/association:member |
| `credit_entry` | 20 | — | — | handlers/association:member |
| `dashboard_export_log` | 7 | — | — | handlers/platformadmin |
| `data_export` | 6 | — | — | handlers/person |
| `digital_credential` | 14 | — | organization_id→organizations | handlers/association:member |
| `directory_profile` | 16 | — | — | handlers/association:member |
| `disciplinary_action` | 8 | — | — | handlers/association:member |
| `document` | 13 | — | — | handlers/documents |
| `document_access_log` | 6 | — | — | handlers/documents |
| `document_tag` | 3 | — | — | handlers/documents |
| `document_version` | 8 | — | — | handlers/documents |
| `dues_category_override` | 4 | — | organization_id→organizations, dues_config_id→duesOrgConfigs, category_id→membershipCategories | handlers/dues |
| `dues_config` | 10 | — | — | handlers/dues |
| `dues_fund` | 5 | — | organization_id→organizations | handlers/dues |
| `dues_fund_allocation` | 5 | — | organization_id→organizations, payment_id→duesPayments, fund_id→duesFunds | handlers/dues |
| `dues_gateway_config` | 6 | — | organization_id→organizations | handlers/dues |
| `dues_invoice` | 13 | — | — | handlers/dues |
| `dues_org_config` | 7 | — | organization_id→organizations | handlers/dues |
| `dues_payment` | 22 | — | organization_id→organizations, person_id→persons, recorded_by→persons | handlers/dues |
| `dues_payment_status_history` | 8 | — | payment_id→duesPayments, person_id→persons, changed_by→persons | handlers/association:member |
| `dues_reminder_log` | 9 | — | — | handlers/dues |
| `dues_reminder_schedule` | 8 | — | organization_id→organizations, dues_config_id→duesOrgConfigs | handlers/dues |
| `dunning_event` | 7 | — | — | handlers/association:member |
| `dunning_template` | 8 | — | — | handlers/association:member |
| `election` | 12 | — | — | handlers/elections |
| `election_nominee` | 6 | — | election_id→elections, position_id→positions, person_id→persons, nominated_by→persons | handlers/elections |
| `election_vote` | 5 | — | election_id→elections, position_id→positions, nominee_id→electionNominees, voter_id→persons | handlers/elections |
| `email_queue` | 21 | — | template→emailTemplates | handlers/email |
| `email_suppression` | 6 | — | — | handlers/email |
| `email_template` | 14 | — | — | handlers/email |
| `event` | 18 | — | — | handlers/association:operations |
| `event_registration` | 7 | — | — | handlers/association:operations |
| `feature_flag` | 5 | — | — | handlers/platformadmin |
| `feed_muted_author` | 3 | — | — | handlers/communication |
| `feed_post` | 12 | — | — | handlers/communication |
| `feed_post_reaction` | 3 | — | — | handlers/communication |
| `feed_post_report` | 3 | — | — | handlers/communication |
| `impersonation_session` | 7 | — | — | handlers/platformadmin |
| `institutional_membership` | 10 | — | — | handlers/association:member |
| `invitation_token` | 11 | — | organization_id→organizations | handlers/invite |
| `invoice` | 22 | — | customer→persons, merchant→persons, merchant_account→merchantAccounts | handlers/billing |
| `invoice_line_item` | 7 | — | invoice→invoices | handlers/billing |
| `job_application` | 6 | — | — | handlers/jobs |
| `job_posting` | 12 | — | — | handlers/jobs |
| `license_renewal_alert` | 6 | — | organization_id→organizations | handlers/association:member |
| `marketplace_listing` | 8 | — | vendor_id→vendors | handlers/marketplace |
| `marketplace_order` | 9 | — | listing_id→marketplaceListings, vendor_id→vendors | handlers/marketplace |
| `member_ad_opt_out` | 3 | — | — | handlers/advertising |
| `membership` | 15 | — | tier_id→membershipTiers, category_id→membershipCategories | handlers/association:member |
| `membership_application` | 8 | — | tier_id→membershipTiers, reviewed_by→persons | handlers/association:member |
| `membership_category` | 4 | — | — | handlers/association:member |
| `membership_status_history` | 8 | — | membership_id→memberships, person_id→persons, changed_by→persons | handlers/association:member |
| `membership_tier` | 9 | — | — | handlers/association:member |
| `merchant_account` | 4 | — | person→persons | handlers/billing |
| `message` | 10 | — | — | handlers/communication |
| `message_template` | 9 | — | — | handlers/communication |
| `national_dashboard_access` | 5 | — | — | handlers/platformadmin |
| `notification` | 13 | — | — | handlers/notifs |
| `notification_preference` | 5 | — | — | handlers/person |
| `officer_term` | 7 | — | position_id→positions | handlers/association:member |
| `onboarding_state` | 4 | — | organization_id→organizations | handlers/onboarding |
| `org_certificate_seq` | 4 | — | — | handlers/certificates |
| `org_cpd_config` | 6 | — | — | handlers/association:member |
| `organization` | 10 | — | — | handlers/platformadmin |
| `passkey` | 11 | id | user_id→user | unknown |
| `payment_token` | 9 | — | person_id→persons, organization_id→organizations, created_by_officer→persons | handlers/dues |
| `person` | 18 | — | — | handlers/person |
| `person_privacy_setting` | 9 | — | — | handlers/person |
| `person_subscription` | 4 | — | — | handlers/communication |
| `platform_admin` | 4 | — | — | handlers/platformadmin |
| `position` | 7 | — | — | handlers/association:member |
| `pricing_tier` | 15 | id | — | handlers/platformadmin |
| `professional_license` | 12 | — | organization_id→organizations | handlers/association:member |
| `quiz_attempt` | 8 | — | — | handlers/association:operations |
| `review` | 7 | — | reviewer_id→persons, reviewed_entity_id→persons | handlers/reviews |
| `royalty_split` | 7 | — | — | handlers/association:member |
| `saved_segment` | 3 | — | — | handlers/communication |
| `schedule_exception` | 10 | — | event_id→bookingEvents, owner_id→persons | handlers/booking |
| `seat_allocation` | 6 | — | institutional_membership_id→institutionalMemberships | handlers/association:member |
| `session` | 9 | id | user_id→user | unknown |
| `special_assessment` | 9 | — | organization_id→organizations, fund_id→duesFunds | handlers/association:member |
| `special_assessment_target` | 4 | — | assessment_id→specialAssessments, person_id→persons, invoice_id→duesInvoices | handlers/association:member |
| `stored_file` | 7 | — | — | handlers/storage |
| `subscription` | 17 | id | pricing_tier_id→pricingTiers | handlers/platformadmin |
| `subscription_topic` | 6 | — | — | handlers/communication |
| `support_ticket` | 18 | id | — | handlers/platformadmin |
| `survey` | 13 | — | — | handlers/communication |
| `survey` | 9 | — | created_by→persons | handlers/surveys |
| `survey_response` | 4 | — | — | handlers/communication |
| `survey_response` | 7 | — | survey_id→surveys, responder_id→persons | handlers/surveys |
| `ticket_comment` | 7 | id | ticket_id→supportTickets | handlers/platformadmin |
| `time_slot` | 10 | — | owner_id→persons, event_id→bookingEvents, booking_id→bookings | handlers/booking |
| `training` | 18 | — | — | handlers/association:operations |
| `training_enrollment` | 7 | — | — | handlers/association:operations |
| `transition_checklist` | 7 | — | officer_term_id→officerTerms | handlers/association:member |
| `two_factor` | 5 | id | user_id→user | unknown |
| `user` | 12 | id | — | unknown |
| `vendor` | 10 | — | — | handlers/marketplace |
| `verification` | 6 | id | — | unknown |
| `waitlist_entry` | 6 | — | — | handlers/association:operations |
| `webhook_retry_log` | 10 | — | organization_id→organizations | handlers/dues |

| Enum | Values |
|---|---|
| `accredited_provider_status` | active / suspended / expired |
| `ad_slot` | feed_banner / sidebar / email_footer / event_sponsor |
| `admin_role` | super / support / analyst |
| `affiliation_status` | active / transferred / withdrawn |
| `announcement_status` | draft / scheduled / sent / scheduledFailed / archived |
| `announcement_visibility` | internal / network |
| `application_status` | submitted / underReview / approved / denied / waitlisted |
| `assessment_applies_to` | all / selected |
| `assessment_status` | draft / active / closed |
| `assessment_target_status` | pending / paid |
| `audit_action` | create / read / update / delete / login / logout / approve / deny / renew / terminate / reinstate / mark-paid / complete / transfer / delete-request / delete-cancel / anonymize / export / resign / deceased |
| `audit_category` | hipaa / security / privacy / administrative / clinical / financial / association |
| `audit_event_type` | authentication / data-access / data-modification / data-deletion / system-config / security / compliance |
| `audit_outcome` | success / failure / partial / denied |
| `audit_retention_status` | active / archived / pending-purge |
| `billing_cycle` | monthly / annual |
| `billing_frequency` | annual / semi-annual / quarterly |
| `booking_event_status` | draft / active / paused / archived |
| `booking_status` | pending / confirmed / rejected / cancelled / completed / no_show_client / no_show_host |
| `breach_status` | reported / investigating / notified / resolved |
| `campaign_status` | draft / pending_review / active / paused / completed / rejected |
| `capture_method` | automatic / manual |
| `certificate_status` | issued / revoked |
| `chat_room_member_role` | member / admin |
| `chat_room_status` | active / archived |
| `chat_room_type` | channel / dm / group |
| `check_in_method` | qr / manual |
| `comm_channel` | email / push / inApp / sms |
| `committee_member_role` | member / chairperson / vice_chairperson / secretary |
| `committee_status` | active / completed |
| `committee_task_priority` | low / medium / high / urgent |
| `committee_task_status` | pending / in_progress / completed / cancelled |
| `course_status` | draft / published / archived |
| `cpd_activity_type` | seminar / workshop / conference / webinar / hands_on / community / research / mentorship / self_directed / other |
| `creative_status` | pending / approved / rejected |
| `credential_status` | active / suspended / revoked / expired |
| `credential_template_status` | active / retired |
| `credential_type` | memberCard / certificate / badge / license |
| `credit_cpd_category` | General / Major / Self-Directed |
| `credit_entry_type` | auto / manual |
| `credit_source_type` | event_checkin / training_completion / course_completion / manual_award |
| `credit_status` | active / voided / disputed |
| `credit_verification_status` | pending / verified / rejected |
| `dashboard_output_format` | pdf / csv |
| `dashboard_report_type` | association_summary / dues_collection / cpd_compliance / activity |
| `data_export_status` | requested / processing / ready / failed / expired |
| `delivery_status` | pending / sent / delivered / failed / bounced |
| `directory_visibility` | public / memberOnly / hidden |
| `disciplinary_action_type` | warning / suspension / removal / probation |
| `document_status` | draft / published / archived |
| `dues_config_status` | active / retired |
| `dues_invoice_status` | generated / sent / paid / overdue / cancelled / writtenOff |
| `dues_payment_method` | online / cash / check / bankTransfer / gcash / other |
| `dues_payment_status` | pending / completed / failed / refunded / partiallyRefunded / expired / submitted / underReview / confirmed / rejected |
| `dunning_channel` | email / sms / letter |
| `dunning_delivery_status` | pending / sent / delivered / failed |
| `dunning_template_status` | active / inactive |
| `election_status` | draft / nominationsOpen / votingOpen / awaitingConfirmation / published / cancelled |
| `election_type` | officer / bylaw |
| `email_category` | bulk / transactional |
| `email_provider` | smtp / postmark / onesignal |
| `email_queue_status` | pending / processing / sent / failed / cancelled |
| `enrollment_status` | enrolled / completed / cancelled / noShow |
| `event_status` | draft / published / cancelled / completed |
| `event_type` | generalAssembly / inductionCeremony / fellowship / medicalMission / boardMeeting / committeeMeeting / fundraiser / other |
| `event_visibility` | internal / network |
| `feed_post_status` | published / draft / flagged / removed |
| `feed_post_type` | announcement / event_highlight / training_opportunity / achievement / clinical_update |
| `feed_post_visibility` | org / network |
| `file_status` | uploading / processing / available / failed |
| `gateway_provider` | stripe / paymongo |
| `gateway_provider` | paymongo / stripe |
| `gender` | male / female / non-binary / other / prefer-not-to-say |
| `invite_status` | pending / claimed / expired / revoked |
| `invite_type` | claim / invite |
| `invoice_status` | draft / open / paid / void / uncollectible |
| `job_application_status` | applied / screening / interviewed / offered / hired / rejected / withdrawn |
| `job_posting_status` | draft / active / filled / expired / closed |
| `job_posting_type` | full_time / part_time / contract / fellowship / internship |
| `license_status` | active / expired / suspended / revoked / pending |
| `listing_status` | draft / active / archived |
| `location_type` | video / phone / in-person |
| `membership_status` | pendingPayment / active / gracePeriod / lapsed / expired / suspended / removed / resigned / deceased / expelled |
| `message_status` | draft / scheduled / sending / sent / cancelled / failed |
| `message_type` | text / system / video_call |
| `nominee_status` | nominated / accepted / declined / elected |
| `notification_channel` | email / push / in-app |
| `notification_status` | queued / sent / delivered / read / failed / expired |
| `notification_type` | billing / security / system / booking.created / booking.confirmed / booking.rejected / booking.cancelled / booking.no-show-client / booking.no-show-host / booking.auto-rejected / booking.expired / comms.video-call-started / comms.video-call-joined / comms.video-call-left / comms.video-call-ended / comms.chat-message / waitlist.promoted / event.late-cancellation / dunning.escalation / task.overdue |
| `order_status` | pending / confirmed / fulfilled / cancelled / refunded |
| `org_lifecycle_status` | trial / active / suspended / cancelled |
| `org_type` | chapter / society / national / clinic |
| `participant_type` | client / host |
| `payment_status` | pending / requires_capture / processing / succeeded / failed / canceled |
| `position_level` | national / regional / chapter |
| `recurrence_type` | daily / weekly / monthly / yearly |
| `registration_status` | confirmed / waitlisted / cancelled / refunded / noShow |
| `renewal_alert_status` | pending / sent / acknowledged / dismissed |
| `seat_allocation_status` | active / revoked |
| `slot_status` | available / booked / blocked |
| `subscription_status` | trial / active / past_due / cancelled / expired |
| `suppression_reason` | hard_bounce / unsubscribe / complaint / manual |
| `survey_distribution` | all_members / active_members / specific_categories |
| `survey_status` | draft / active / closed |
| `survey_type` | anonymous / identified |
| `template_status` | draft / active / archived |
| `template_status` | draft / active / archived |
| `term_status` | upcoming / active / completed / resigned / removed |
| `ticket_category` | billing / technical / membership / general |
| `ticket_priority` | low / standard / high / critical |
| `ticket_status` | open / in_progress / waiting_customer / resolved / closed |
| `tier_status` | active / retired |
| `training_status` | draft / published / cancelled / completed |
| `training_visibility` | internal / network |
| `transfer_status` | requested / pendingSourceApproval / pendingTargetApproval / approved / denied / completed / cancelled |
| `transition_checklist_status` | pending / completed |
| `variable_type` | string / number / boolean / date / datetime / url / email / array |
| `vendor_category` | emr / supplies / insurance / telehealth / other |
| `vendor_status` | pending / verified / suspended / rejected |
| `video_call_status` | starting / active / ended / cancelled |
| `voting_mode` | online / inPerson / hybrid |
| `webhook_retry_status` | processing / completed / pending_retry / dead_letter |
<!-- oli:regen:code-data-model:end -->
