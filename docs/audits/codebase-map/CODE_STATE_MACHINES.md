# Code State Machines

<!-- oli:regen:code-state-machines:begin -->
| FSM | States | Transitions | Method | Confidence |
|---|---|---|---|---|
| `fsm:accredited-provider-status` | active / suspended / expired | 0 | drizzle_enum | MEDIUM |
| `fsm:affiliation-status` | active / transferred / withdrawn | 0 | drizzle_enum | MEDIUM |
| `fsm:announcement-status` | draft / scheduled / sent / scheduledFailed / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:application-status` | submitted / underReview / approved / denied / waitlisted | 0 | drizzle_enum | MEDIUM |
| `fsm:assessment-status` | draft / active / closed | 0 | drizzle_enum | MEDIUM |
| `fsm:assessment-target-status` | pending / paid | 0 | drizzle_enum | MEDIUM |
| `fsm:audit-retention-status` | active / archived / pending-purge | 0 | drizzle_enum | MEDIUM |
| `fsm:billing-frequency` | annual / semi-annual / quarterly | 0 | useState_union | HIGH |
| `fsm:booking-event-status` | draft / active / paused / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:booking-status` | pending / confirmed / rejected / cancelled / completed / no_show_client / no_show_host | 0 | drizzle_enum | MEDIUM |
| `fsm:breach-status` | reported / investigating / notified / resolved | 0 | drizzle_enum | MEDIUM |
| `fsm:campaign-status` | draft / pending_review / active / paused / completed / rejected | 0 | drizzle_enum | MEDIUM |
| `fsm:certificate-status` | issued / revoked | 0 | drizzle_enum | MEDIUM |
| `fsm:chat-room-status` | active / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:committee-status` | active / completed | 0 | drizzle_enum | MEDIUM |
| `fsm:committee-task-status` | pending / in_progress / completed / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:course-status` | draft / published / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:creative-status` | pending / approved / rejected | 0 | drizzle_enum | MEDIUM |
| `fsm:credential-status` | active / suspended / revoked / expired | 0 | drizzle_enum | MEDIUM |
| `fsm:credential-template-status` | active / retired | 0 | drizzle_enum | MEDIUM |
| `fsm:credit-status` | active / voided / disputed | 0 | drizzle_enum | MEDIUM |
| `fsm:credit-verification-status` | pending / verified / rejected | 0 | drizzle_enum | MEDIUM |
| `fsm:data-export-status` | requested / processing / ready / failed / expired | 0 | drizzle_enum | MEDIUM |
| `fsm:delivery-status` | pending / sent / delivered / failed / bounced | 0 | drizzle_enum | MEDIUM |
| `fsm:detail-tab` | details / registrations | 3 | useState_union | HIGH |
| `fsm:document-status` | draft / published / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:dues-config-status` | active / retired | 0 | drizzle_enum | MEDIUM |
| `fsm:dues-invoice-status` | generated / sent / paid / overdue / cancelled / writtenOff | 0 | drizzle_enum | MEDIUM |
| `fsm:dues-payment-status` | pending / completed / failed / refunded / partiallyRefunded / expired / submitted / underReview / confirmed / rejected | 0 | drizzle_enum | MEDIUM |
| `fsm:dunning-delivery-status` | pending / sent / delivered / failed | 0 | drizzle_enum | MEDIUM |
| `fsm:dunning-template-status` | active / inactive | 0 | drizzle_enum | MEDIUM |
| `fsm:election-status` | draft / nominationsOpen / votingOpen / awaitingConfirmation / published / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:email-queue-status` | pending / processing / sent / failed / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:enrollment-status` | enrolled / completed / cancelled / noShow | 0 | drizzle_enum | MEDIUM |
| `fsm:event-status` | draft / published / cancelled / completed | 0 | drizzle_enum | MEDIUM |
| `fsm:feed-post-status` | published / draft / flagged / removed | 0 | drizzle_enum | MEDIUM |
| `fsm:file-status` | uploading / processing / available / failed | 0 | drizzle_enum | MEDIUM |
| `fsm:invite-status` | pending / claimed / expired / revoked | 0 | drizzle_enum | MEDIUM |
| `fsm:invoice-status` | draft / open / paid / void / uncollectible | 0 | drizzle_enum | MEDIUM |
| `fsm:job-application-status` | applied / screening / interviewed / offered / hired / rejected / withdrawn | 0 | drizzle_enum | MEDIUM |
| `fsm:job-posting-status` | draft / active / filled / expired / closed | 0 | drizzle_enum | MEDIUM |
| `fsm:license-status` | active / expired / suspended / revoked / pending | 0 | drizzle_enum | MEDIUM |
| `fsm:listing-status` | draft / active / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:membership-status` | pendingPayment / active / gracePeriod / lapsed / expired / suspended / removed / resigned / deceased / expelled | 0 | drizzle_enum | MEDIUM |
| `fsm:message-status` | draft / scheduled / sending / sent / cancelled / failed | 0 | drizzle_enum | MEDIUM |
| `fsm:nominee-status` | nominated / accepted / declined / elected | 0 | drizzle_enum | MEDIUM |
| `fsm:notification-status` | queued / sent / delivered / read / failed / expired | 0 | drizzle_enum | MEDIUM |
| `fsm:order-status` | pending / confirmed / fulfilled / cancelled / refunded | 0 | drizzle_enum | MEDIUM |
| `fsm:org-lifecycle-status` | trial / active / suspended / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:payment-status` | pending / requires_capture / processing / succeeded / failed / canceled | 0 | drizzle_enum | MEDIUM |
| `fsm:registration-status` | confirmed / waitlisted / cancelled / refunded / noShow | 0 | drizzle_enum | MEDIUM |
| `fsm:renewal-alert-status` | pending / sent / acknowledged / dismissed | 0 | drizzle_enum | MEDIUM |
| `fsm:seat-allocation-status` | active / revoked | 0 | drizzle_enum | MEDIUM |
| `fsm:slot-status` | available / booked / blocked | 0 | drizzle_enum | MEDIUM |
| `fsm:sort-by` | date / name | 0 | useState_union | HIGH |
| `fsm:subscription-status` | trial / active / past_due / cancelled / expired | 0 | drizzle_enum | MEDIUM |
| `fsm:survey-status` | draft / active / closed | 0 | drizzle_enum | MEDIUM |
| `fsm:template-status` | draft / active / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:template-status` | draft / active / archived | 0 | drizzle_enum | MEDIUM |
| `fsm:term-status` | upcoming / active / completed / resigned / removed | 0 | drizzle_enum | MEDIUM |
| `fsm:ticket-status` | open / in_progress / waiting_customer / resolved / closed | 0 | drizzle_enum | MEDIUM |
| `fsm:tier-status` | active / retired | 0 | drizzle_enum | MEDIUM |
| `fsm:training-status` | draft / published / cancelled / completed | 0 | drizzle_enum | MEDIUM |
| `fsm:transfer-status` | requested / pendingSourceApproval / pendingTargetApproval / approved / denied / completed / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:transition-checklist-status` | pending / completed | 0 | drizzle_enum | MEDIUM |
| `fsm:vendor-status` | pending / verified / suspended / rejected | 0 | drizzle_enum | MEDIUM |
| `fsm:video-call-status` | starting / active / ended / cancelled | 0 | drizzle_enum | MEDIUM |
| `fsm:webhook-retry-status` | processing / completed / pending_retry / dead_letter | 0 | drizzle_enum | MEDIUM |
<!-- oli:regen:code-state-machines:end -->
