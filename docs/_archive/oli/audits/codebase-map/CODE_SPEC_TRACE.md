---
based-on: map@2331bd9f
last-modified: 2026-06-03T20:30:00Z
engine-version: 7b2a640
map-version: 6
---

# Code Spec Trace

<!-- oli:regen:code-spec-trace:begin -->
Spec: `specs/api/dist/openapi/openapi.json` · Matched: 455 · Spec-only: 0 · Code-only: 1 · Auth-drift: 0

| Operation | operationId | Roles | Backend | Status | Drift |
|---|---|---|---|---|---|
| `DELETE /accredited-providers/:organizationId/:providerId` | `deleteOrgAccreditedProvider` | association:admin, association:staff | `deleteOrgAccreditedProvider` | matched |  |
| `DELETE /admin/admins/:adminId` | `revokeAdmin` | — | `revokeAdmin` | matched |  |
| `DELETE /admin/associations/:associationId` | `deleteAssociation` | — | `deleteAssociation` | matched |  |
| `DELETE /admin/feature-flags/:flagId` | `deleteFeatureFlag` | — | `deleteFeatureFlag` | matched |  |
| `DELETE /association/document-tags/:tagId` | `deleteDocumentTag` | admin | `deleteDocumentTag` | matched |  |
| `DELETE /association/documents/:documentId` | `deleteDocument` | admin, member:owner | `deleteDocument` | matched |  |
| `DELETE /association/events/:eventId` | `deleteEvent` | association:admin | `deleteEvent` | matched |  |
| `DELETE /association/events/registrations/:registrationId` | `deleteEventRegistration` | association:admin | `deleteEventRegistration` | matched |  |
| `DELETE /association/member/applications/:applicationId` | `deleteMembershipApplication` | association:admin | `deleteMembershipApplication` | matched |  |
| `DELETE /association/member/candidates/:candidateId` | `deleteCandidate` | association:admin | `deleteCandidate` | matched |  |
| `DELETE /association/member/chapter-affiliations/:affiliationId` | `deleteChapterAffiliation` | association:admin | `deleteChapterAffiliation` | matched |  |
| `DELETE /association/member/credential-templates/:templateId` | `deleteCredentialTemplate` | association:admin | `deleteCredentialTemplate` | matched |  |
| `DELETE /association/member/credentials/:credentialId` | `deleteDigitalCredential` | association:admin | `deleteDigitalCredential` | matched |  |
| `DELETE /association/member/directory/profiles/:profileId` | `deleteDirectoryProfile` | association:member:owner, association:admin | `deleteDirectoryProfile` | matched |  |
| `DELETE /association/member/dues-configs/:duesConfigId` | `deleteDuesConfig` | association:admin | `deleteDuesConfig` | matched |  |
| `DELETE /association/member/dues-gateway/:organizationId` | `disconnectDuesGateway` | association:admin | `disconnectDuesGateway` | matched |  |
| `DELETE /association/member/dues-invoices/:invoiceId` | `deleteDuesInvoice` | association:admin | `deleteDuesInvoice` | matched |  |
| `DELETE /association/member/dunning/templates/:templateId` | `deleteDunningTemplate` | association:admin | `deleteDunningTemplate` | matched |  |
| `DELETE /association/member/elections/:electionId` | `deleteElection` | association:admin | `deleteElection` | matched |  |
| `DELETE /association/member/institutional-memberships/:institutionalMembershipId` | `deleteInstitutionalMembership` | association:admin | `deleteInstitutionalMembership` | matched |  |
| `DELETE /association/member/licenses/:licenseId` | `deleteProfessionalLicense` | association:admin | `deleteProfessionalLicense` | matched |  |
| `DELETE /association/member/memberships/:membershipId` | `deleteMembership` | association:admin | `deleteMembership` | matched |  |
| `DELETE /association/member/officer-terms/:termId` | `deleteOfficerTerm` | association:admin | `deleteOfficerTerm` | matched |  |
| `DELETE /association/member/positions/:positionId` | `deletePosition` | association:admin | `deletePosition` | matched |  |
| `DELETE /association/member/royalty-splits/:royaltySplitId` | `deleteRoyaltySplit` | association:admin | `deleteRoyaltySplit` | matched |  |
| `DELETE /association/member/special-assessments/:id` | `deleteSpecialAssessment` | association:admin | `deleteSpecialAssessment` | matched |  |
| `DELETE /association/member/tiers/:tierId` | `deleteMembershipTier` | association:admin | `deleteMembershipTier` | matched |  |
| `DELETE /association/message-templates/:templateId` | `deleteMessageTemplate` | admin | `deleteMessageTemplate` | matched |  |
| `DELETE /association/messages/:messageId` | `deleteMessage` | admin | `deleteMessage` | matched |  |
| `DELETE /association/subscription-topics/:topicId` | `deleteSubscriptionTopic` | admin | `deleteSubscriptionTopic` | matched |  |
| `DELETE /association/training/:trainingId` | `deleteTraining` | association:admin | `deleteTraining` | matched |  |
| `DELETE /association/training/courses/:courseId` | `deleteCourse` | association:admin | `deleteCourse` | matched |  |
| `DELETE /association/training/courses/enrollments/:enrollmentId` | `deleteCourseEnrollment` | association:admin | `deleteCourseEnrollment` | matched |  |
| `DELETE /association/training/enrollments/:enrollmentId` | `deleteTrainingEnrollment` | association:admin | `deleteTrainingEnrollment` | matched |  |
| `DELETE /billing/invoices/:invoice` | `deleteInvoice` | — | `deleteInvoice` | matched |  |
| `DELETE /booking/events/:event` | `deleteBookingEvent` | event:owner, admin | `deleteBookingEvent` | matched |  |
| `DELETE /booking/events/:event/exceptions/:exception` | `deleteScheduleException` | event:owner, admin | `deleteScheduleException` | matched |  |
| `DELETE /communications/announcements/:id` | `deleteAnnouncement` | association:officer | `deleteAnnouncement` | matched |  |
| `DELETE /communications/segments/:id` | `deleteSavedSegment` | admin, coordinator | `deleteSavedSegment` | matched |  |
| `DELETE /postings/:postingId` | `deleteJobPosting` | association:admin, association:staff | `deleteJobPosting` | matched |  |
| `DELETE /reviews/:review` | `deleteReview` | review:owner, admin | `deleteReview` | matched |  |
| `DELETE /storage/files/:file` | `deleteFile` | user:owner | `deleteFile` | matched |  |
| `DELETE /surveys/:survey` | `deleteSurvey` | officer, admin | `deleteSurvey` | matched |  |
| `DELETE /surveys/my-responses` | `deleteMemberResponses` | user | `deleteMemberResponses` | matched |  |
| `GET /accredited-providers/:organizationId` | `listOrgAccreditedProviders` | association:admin, association:staff | `listOrgAccreditedProviders` | matched |  |
| `GET /admin/admins` | `listAdmins` | — | `listAdmins` | matched |  |
| `GET /admin/associations` | `listAssociations` | — | `listAssociations` | matched |  |
| `GET /admin/associations/:associationId` | `getAssociation` | — | `getAssociation` | matched |  |
| `GET /admin/committees` | `listAllCommittees` | platform_admin | `listAllCommittees` | matched |  |
| `GET /admin/committees/:id` | `getCommittee` | platform_admin | `getCommittee` | matched |  |
| `GET /admin/feature-flags` | `listFeatureFlags` | — | `listFeatureFlags` | matched |  |
| `GET /admin/me/role` | `getAdminRole` | platform_admin | `getAdminRole` | matched |  |
| `GET /admin/national-dashboard/:associationId` | `getNationalDashboard` | platform_admin, national_officer | `getNationalDashboard` | matched |  |
| `GET /admin/national/chapters` | `listNationalChapters` | platform_admin, national_officer | `listNationalChapters` | matched |  |
| `GET /admin/national/chapters/:organizationId` | `getNationalChapterDetail` | platform_admin, national_officer | `getNationalChapterDetail` | matched |  |
| `GET /admin/national/platform` | `getPlatformSummary` | platform_admin | `getPlatformSummary` | matched |  |
| `GET /admin/organizations` | `listOrganizations` | — | `listOrganizations` | matched |  |
| `GET /admin/organizations/:organizationId` | `getOrganization` | — | `getOrganization` | matched |  |
| `GET /admin/surveys/` | `listAdminSurveys` | admin | `listAdminSurveys` | matched |  |
| `GET /association/document-tags` | `listDocumentTags` | admin, coordinator, member | `listDocumentTags` | matched |  |
| `GET /association/document-tags/:tagId` | `getDocumentTag` | admin, coordinator, member | `getDocumentTag` | matched |  |
| `GET /association/documents` | `searchDocuments` | admin, coordinator, member | `searchDocuments` | matched |  |
| `GET /association/documents/:documentId` | `getDocument` | admin, coordinator, member | `getDocument` | matched |  |
| `GET /association/documents/:documentId/access-log` | `getDocumentAccessLog` | admin, coordinator | `getDocumentAccessLog` | matched |  |
| `GET /association/documents/:documentId/versions` | `listDocumentVersions` | admin, coordinator, member | `listDocumentVersions` | matched |  |
| `GET /association/documents/:documentId/versions/:versionId` | `getDocumentVersion` | admin, coordinator, member | `getDocumentVersion` | matched |  |
| `GET /association/event-lifecycle/:eventId/attendance` | `listCustomEventAttendance` | association:admin, association:staff | `listCustomEventAttendance` | matched |  |
| `GET /association/event-lifecycle/:eventId/registrations` | `listCustomEventRegistrations` | association:admin, association:staff | `listCustomEventRegistrations` | matched |  |
| `GET /association/event-lifecycle/my` | `listMyCustomEvents` | association:member | `listMyCustomEvents` | matched |  |
| `GET /association/events` | `searchEvents` | association:admin, association:staff, association:member | `searchEvents` | matched |  |
| `GET /association/events/:eventId` | `getEvent` | association:admin, association:staff, association:member | `getEvent` | matched |  |
| `GET /association/events/:eventId/waitlist` | `listWaitlistEntries` | association:admin, association:staff | `listWaitlistEntries` | matched |  |
| `GET /association/events/checkins` | `searchCheckIns` | association:admin, association:staff | `searchCheckIns` | matched |  |
| `GET /association/events/registrations` | `searchEventRegistrations` | association:admin, association:staff | `searchEventRegistrations` | matched |  |
| `GET /association/events/registrations/:registrationId` | `getEventRegistration` | association:admin, association:staff, association:member:owner | `getEventRegistration` | matched |  |
| `GET /association/member/affiliation-transfers` | `listAffiliationTransfers` | association:admin, chapter:officer | `listAffiliationTransfers` | matched |  |
| `GET /association/member/affiliation-transfers/:transferId` | `getAffiliationTransfer` | association:admin, chapter:officer | `getAffiliationTransfer` | matched |  |
| `GET /association/member/aging-buckets/:organizationId` | `getAgingBucket` | association:admin | `getAgingBucket` | matched |  |
| `GET /association/member/applications` | `listMembershipApplications` | association:admin | `listMembershipApplications` | matched |  |
| `GET /association/member/applications/:applicationId` | `getMembershipApplication` | association:admin, user:owner | `getMembershipApplication` | matched |  |
| `GET /association/member/ballots` | `listBallots` | association:admin | `listBallots` | matched |  |
| `GET /association/member/candidates` | `listCandidates` | association:admin, association:member | `listCandidates` | matched |  |
| `GET /association/member/candidates/:candidateId` | `getCandidate` | association:admin, association:member | `getCandidate` | matched |  |
| `GET /association/member/certificates` | `listMyCertificates` | association:member | `listMyCertificates` | matched |  |
| `GET /association/member/certificates/:certificateId` | `getCertificate` | association:member | `getCertificate` | matched |  |
| `GET /association/member/chapter-affiliations` | `listChapterAffiliations` | association:admin, chapter:officer | `listChapterAffiliations` | matched |  |
| `GET /association/member/chapter-affiliations/:affiliationId` | `getChapterAffiliation` | association:admin, association:member:owner | `getChapterAffiliation` | matched |  |
| `GET /association/member/chapters` | `listOrgChapters` | association:member | `listOrgChapters` | matched |  |
| `GET /association/member/compliance/:organizationId` | `getComplianceReport` | association:admin, association:staff | `getComplianceReport` | matched |  |
| `GET /association/member/cpd-config/:organizationId` | `getOrgCpdConfig` | association:admin, association:staff | `getOrgCpdConfig` | matched |  |
| `GET /association/member/credential-templates` | `listCredentialTemplates` | association:admin | `listCredentialTemplates` | matched |  |
| `GET /association/member/credential-templates/:templateId` | `getCredentialTemplate` | association:admin | `getCredentialTemplate` | matched |  |
| `GET /association/member/credentials` | `listDigitalCredentials` | association:admin | `listDigitalCredentials` | matched |  |
| `GET /association/member/credentials/:credentialId` | `getDigitalCredential` | association:admin, association:member:owner | `getDigitalCredential` | matched |  |
| `GET /association/member/credentials/lookup/:credentialNumber` | `lookupCredentialPublic` | — | `lookupCredentialPublic` | matched |  |
| `GET /association/member/credits` | `listMemberCreditsForPeer` | association:member | `listMemberCreditsForPeer` | matched |  |
| `GET /association/member/directory/profiles` | `listDirectoryProfiles` | association:admin | `listDirectoryProfiles` | matched |  |
| `GET /association/member/directory/profiles/:profileId` | `getDirectoryProfile` | association:member:owner, association:admin | `getDirectoryProfile` | matched |  |
| `GET /association/member/directory/search` | `searchDirectory` | association:member, association:admin | `searchDirectory` | matched |  |
| `GET /association/member/directory/search/:personId/public` | `getPublicDirectoryProfile` | — | `getPublicDirectoryProfile` | matched |  |
| `GET /association/member/dues-configs` | `listDuesConfigs` | association:admin | `listDuesConfigs` | matched |  |
| `GET /association/member/dues-configs/:duesConfigId` | `getDuesConfig` | association:admin | `getDuesConfig` | matched |  |
| `GET /association/member/dues-gateway/:organizationId` | `getDuesGatewayConfig` | association:admin | `getDuesGatewayConfig` | matched |  |
| `GET /association/member/dues-invoices` | `listDuesInvoices` | association:admin, association:member | `listDuesInvoices` | matched |  |
| `GET /association/member/dues-invoices/:invoiceId` | `getDuesInvoice` | association:admin, association:member:owner | `getDuesInvoice` | matched |  |
| `GET /association/member/dues-member-summary/:organizationId/:personId` | `getDuesMemberSummary` | association:admin | `getDuesMemberSummary` | matched |  |
| `GET /association/member/dues-metrics/:organizationId` | `getDuesMetrics` | association:admin | `getDuesMetrics` | matched |  |
| `GET /association/member/dues-payments` | `listDuesPayments` | association:admin, association:member | `listDuesPayments` | matched |  |
| `GET /association/member/dues-payments/:paymentId` | `getDuesPayment` | association:admin, association:member | `getDuesPayment` | matched |  |
| `GET /association/member/dues-payments/pending-proofs` | `listPendingProofs` | association:admin | `listPendingProofs` | matched |  |
| `GET /association/member/dues-reporting` | `listDuesFunds` | association:admin | `listDuesFunds` | matched |  |
| `GET /association/member/dues-reporting/:organizationId/dashboard` | `getDuesFinancialDashboard` | association:admin | `getDuesFinancialDashboard` | matched |  |
| `GET /association/member/dues-reporting/:organizationId/report` | `generateDuesReport` | association:admin | `generateDuesReport` | matched |  |
| `GET /association/member/dunning/events` | `listDunningEvents` | association:admin | `listDunningEvents` | matched |  |
| `GET /association/member/dunning/templates` | `listDunningTemplates` | association:admin | `listDunningTemplates` | matched |  |
| `GET /association/member/dunning/templates/:templateId` | `getDunningTemplate` | association:admin | `getDunningTemplate` | matched |  |
| `GET /association/member/elections` | `listElections` | association:admin, association:member | `listElections` | matched |  |
| `GET /association/member/elections/:electionId` | `getElection` | association:admin, association:member | `getElection` | matched |  |
| `GET /association/member/institutional-memberships` | `listInstitutionalMemberships` | association:admin | `listInstitutionalMemberships` | matched |  |
| `GET /association/member/institutional-memberships/:institutionalMembershipId` | `getInstitutionalMembership` | association:admin, institution:owner | `getInstitutionalMembership` | matched |  |
| `GET /association/member/institutional-memberships/:institutionalMembershipId/seats` | `listSeatAllocations` | association:admin, institution:admin | `listSeatAllocations` | matched |  |
| `GET /association/member/license-renewal-alerts` | `listLicenseRenewalAlerts` | association:admin, association:member:owner | `listLicenseRenewalAlerts` | matched |  |
| `GET /association/member/licenses` | `listProfessionalLicenses` | association:admin | `listProfessionalLicenses` | matched |  |
| `GET /association/member/licenses/:licenseId` | `getProfessionalLicense` | association:admin, association:member:owner | `getProfessionalLicense` | matched |  |
| `GET /association/member/membership-categories` | `listMembershipCategories` | association:admin, association:member | `listMembershipCategories` | matched |  |
| `GET /association/member/memberships` | `listMemberships` | association:admin, association:member | `listMemberships` | matched |  |
| `GET /association/member/memberships/:membershipId` | `getMembership` | association:member:owner, association:admin | `getMembership` | matched |  |
| `GET /association/member/officer-terms` | `listOfficerTerms` | association:admin, association:member | `listOfficerTerms` | matched |  |
| `GET /association/member/officer-terms/:termId` | `getOfficerTerm` | association:admin, association:member | `getOfficerTerm` | matched |  |
| `GET /association/member/org-profile/:organizationId` | `getOrganizationProfile` | association:admin | `getOrganizationProfile` | matched |  |
| `GET /association/member/positions` | `listPositions` | association:admin, association:member | `listPositions` | matched |  |
| `GET /association/member/positions/:positionId` | `getPosition` | association:admin, association:member | `getPosition` | matched |  |
| `GET /association/member/roster` | `listRosterMembers` | association:admin | `listRosterMembers` | matched |  |
| `GET /association/member/roster/:memberId` | `getRosterMember` | association:admin | `getRosterMember` | matched |  |
| `GET /association/member/royalty-splits` | `listRoyaltySplits` | association:admin | `listRoyaltySplits` | matched |  |
| `GET /association/member/royalty-splits/:royaltySplitId` | `getRoyaltySplit` | association:admin | `getRoyaltySplit` | matched |  |
| `GET /association/member/special-assessments/:id/collection` | `getSpecialAssessmentCollection` | association:admin | `getSpecialAssessmentCollection` | matched |  |
| `GET /association/member/special-assessments/:orgId` | `listSpecialAssessments` | association:admin | `listSpecialAssessments` | matched |  |
| `GET /association/member/tiers` | `listMembershipTiers` | association:member, association:admin | `listMembershipTiers` | matched |  |
| `GET /association/member/tiers/:tierId` | `getMembershipTier` | association:member, association:admin | `getMembershipTier` | matched |  |
| `GET /association/message-templates` | `searchMessageTemplates` | admin, coordinator | `searchMessageTemplates` | matched |  |
| `GET /association/message-templates/:templateId` | `getMessageTemplate` | admin, coordinator | `getMessageTemplate` | matched |  |
| `GET /association/messages` | `searchMessages` | admin, coordinator | `searchMessages` | matched |  |
| `GET /association/messages/:messageId` | `getMessage` | admin, coordinator | `getMessage` | matched |  |
| `GET /association/person-subscriptions` | `listPersonSubscriptions` | admin, coordinator, member:owner | `listPersonSubscriptions` | matched |  |
| `GET /association/subscription-topics/:topicId` | `getSubscriptionTopic` | admin, coordinator, member | `getSubscriptionTopic` | matched |  |
| `GET /association/training` | `searchTrainings` | association:admin, association:staff, association:member | `searchTrainings` | matched |  |
| `GET /association/training-lifecycle/:trainingId/enrollments` | `listCustomTrainingEnrollments` | association:admin, association:staff | `listCustomTrainingEnrollments` | matched |  |
| `GET /association/training-lifecycle/my` | `listMyCustomTrainings` | association:member | `listMyCustomTrainings` | matched |  |
| `GET /association/training/:trainingId` | `getTraining` | association:admin, association:staff, association:member | `getTraining` | matched |  |
| `GET /association/training/courses` | `searchCourses` | association:admin, association:staff, association:member | `searchCourses` | matched |  |
| `GET /association/training/courses/:courseId` | `getCourse` | association:admin, association:staff, association:member | `getCourse` | matched |  |
| `GET /association/training/courses/enrollments` | `searchCourseEnrollments` | association:admin, association:staff | `searchCourseEnrollments` | matched |  |
| `GET /association/training/courses/enrollments/:enrollmentId` | `getCourseEnrollment` | association:admin, association:staff, association:member:owner | `getCourseEnrollment` | matched |  |
| `GET /association/training/courses/quiz-attempts` | `searchQuizAttempts` | association:admin, association:staff, association:member:owner | `searchQuizAttempts` | matched |  |
| `GET /association/training/enrollments` | `searchTrainingEnrollments` | association:admin, association:staff | `searchTrainingEnrollments` | matched |  |
| `GET /association/training/enrollments/:enrollmentId` | `getTrainingEnrollment` | association:admin, association:staff, association:member:owner | `getTrainingEnrollment` | matched |  |
| `GET /audit/logs` | `listAuditLogs` | admin, support | `listAuditLogs` | matched |  |
| `GET /billing/invoices` | `listInvoices` | — | `listInvoices` | matched |  |
| `GET /billing/invoices/:invoice` | `getInvoice` | — | `getInvoice` | matched |  |
| `GET /billing/merchant-accounts/:merchantAccount` | `getMerchantAccount` | — | `getMerchantAccount` | matched |  |
| `GET /booking/bookings` | `listBookings` | client:owner, host:owner, admin, support | `listBookings` | matched |  |
| `GET /booking/bookings/:booking` | `getBooking` | client:owner, host:owner, admin, support | `getBooking` | matched |  |
| `GET /booking/events` | `listBookingEvents` | — | `listBookingEvents` | matched |  |
| `GET /booking/events/:event` | `getBookingEvent` | — | `getBookingEvent` | matched |  |
| `GET /booking/events/:event/exceptions` | `listScheduleExceptions` | event:owner, admin, support | `listScheduleExceptions` | matched |  |
| `GET /booking/events/:event/exceptions/:exception` | `getScheduleException` | event:owner, admin, support | `getScheduleException` | matched |  |
| `GET /booking/events/:event/slots` | `listEventSlots` | — | `listEventSlots` | matched |  |
| `GET /booking/slots/:slotId` | `getTimeSlot` | — | `getTimeSlot` | matched |  |
| `GET /certificates/verify/:certificateNumber` | `verifyCertificatePublic` | — | `verifyCertificatePublic` | matched |  |
| `GET /comms/chat-rooms` | `listChatRooms` | user | `listChatRooms` | matched |  |
| `GET /comms/chat-rooms/:room` | `getChatRoom` | user | `getChatRoom` | matched |  |
| `GET /comms/chat-rooms/:room/messages` | `getChatMessages` | user | `getChatMessages` | matched |  |
| `GET /comms/ice-servers` | `getIceServers` | user | `getIceServers` | matched |  |
| `GET /comms/messages/search` | `searchChatMessages` | user | `searchChatMessages` | matched |  |
| `GET /communications/announcements/:id/stats` | `getAnnouncementStats` | association:member | `getAnnouncementStats` | matched |  |
| `GET /communications/announcements/:organizationId` | `listAnnouncements` | association:member | `listAnnouncements` | matched |  |
| `GET /communications/announcements/detail/:id` | `getAnnouncement` | association:member | `getAnnouncement` | matched |  |
| `GET /communications/segments` | `listSavedSegments` | admin, coordinator | `listSavedSegments` | matched |  |
| `GET /credit-compliance/:organizationId` | `getCreditCompliance` | association:admin | `getCreditCompliance` | matched |  |
| `GET /dues/dashboard/:organizationId` | `getDuesDashboard` | association:admin | `getDuesDashboard` | matched |  |
| `GET /email/queue` | `listEmailQueueItems` | admin | `listEmailQueueItems` | matched |  |
| `GET /email/queue/:queue` | `getEmailQueueItem` | admin | `getEmailQueueItem` | matched |  |
| `GET /email/suppressions` | `listEmailSuppressions` | admin | `listEmailSuppressions` | matched |  |
| `GET /email/templates` | `listEmailTemplates` | admin | `listEmailTemplates` | matched |  |
| `GET /email/templates/:template` | `getEmailTemplate` | admin | `getEmailTemplate` | matched |  |
| `GET /email/unsubscribe` | `unsubscribeEmailGet` | — | `unsubscribeEmailGet` | matched |  |
| `GET /invite/validate/:token` | `validateInvite` | — | `validateInvite` | matched |  |
| `GET /listings` | `listListings` | user | `listListings` | matched |  |
| `GET /membership/applications/:organizationId` | `listOrgApplications` | association:admin | `listOrgApplications` | matched |  |
| `GET /membership/members/:organizationId` | `listOrgMembers` | association:admin | `listOrgMembers` | matched |  |
| `GET /membership/org-profile/:organizationId` | `getOrgProfile` | user | `getOrgProfile` | matched |  |
| `GET /notifs` | `listNotifications` | user, admin | `listNotifications` | matched |  |
| `GET /notifs/:notif` | `getNotification` | user, admin | `getNotification` | matched |  |
| `GET /officer-terms/:organizationId` | `listOfficerTermsSummary` | user | `listOfficerTermsSummary` | matched |  |
| `GET /onboarding/state` | `getOnboardingState` | user | `getOnboardingState` | matched |  |
| `GET /org/:organizationId/payments/:paymentId/receipt` | `downloadReceipt` | association:member | `downloadReceipt` | matched |  |
| `GET /pay/:token/validate` | `validatePaymentToken` | — | `validatePaymentToken` | matched |  |
| `GET /persons` | `listPersons` | admin, support | `listPersons` | matched |  |
| `GET /persons/:person` | `getPerson` | admin, support, user:owner | `getPerson` | matched |  |
| `GET /persons/me/credit-entries` | `listMyCreditEntries` | user | `listMyCreditEntries` | matched |  |
| `GET /persons/me/credit-summary` | `getMyCreditSummary` | user | `getMyCreditSummary` | matched |  |
| `GET /persons/me/credits` | `getMyCredits` | user | `getMyCredits` | matched |  |
| `GET /persons/me/export` | `exportMyData` | user | `exportMyData` | matched |  |
| `GET /persons/me/memberships` | `getMyMemberships` | user | `getMyMemberships` | matched |  |
| `GET /persons/me/notification-preferences` | `getMyNotificationPreferences` | user | `getMyNotificationPreferences` | matched |  |
| `GET /persons/me/officer-role/:organizationId` | `getMyOfficerRole` | user | `getMyOfficerRole` | matched |  |
| `GET /persons/me/privacy` | `getMyPrivacySettings` | user | `getMyPrivacySettings` | matched |  |
| `GET /placement` | `getAdForPlacement` | user | `getAdForPlacement` | matched |  |
| `GET /postings` | `searchJobPostings` | user | `searchJobPostings` | matched |  |
| `GET /postings/:postingId` | `getJobPosting` | user | `getJobPosting` | matched |  |
| `GET /public/events` | `listPublicEvents` | — | `listPublicEvents` | matched |  |
| `GET /public/events/:slug` | `getPublicEvent` | — | `getPublicEvent` | matched |  |
| `GET /public/org/:slug` | `getOrganizationBySlug` | — | `getOrganizationBySlug` | matched |  |
| `GET /public/orgs` | `listPublicOrgs` | — | `listPublicOrgs` | matched |  |
| `GET /reviews/` | `listReviews` | user | `listReviews` | matched |  |
| `GET /reviews/:review` | `getReview` | user | `getReview` | matched |  |
| `GET /storage/files` | `listFiles` | — | `listFiles` | matched |  |
| `GET /storage/files/:file` | `getFile` | admin, user:owner | `getFile` | matched |  |
| `GET /storage/files/:file/download` | `getFileDownload` | admin, user:owner | `getFileDownload` | matched |  |
| `GET /surveys/` | `listSurveys` | user | `listSurveys` | matched |  |
| `GET /surveys/:survey` | `getSurvey` | user | `getSurvey` | matched |  |
| `GET /surveys/:survey/analytics` | `getSurveyAnalytics` | officer, admin | `getSurveyAnalytics` | matched |  |
| `GET /surveys/:survey/export` | `exportSurveyResponses` | officer, admin | `exportSurveyResponses` | matched |  |
| `GET /surveys/:survey/responses` | `listSurveyResponses` | officer, admin | `listSurveyResponses` | matched |  |
| `GET /surveys/analytics/nps-trends` | `getNpsTrends` | officer, admin | `getNpsTrends` | matched |  |
| `GET /vendors` | `listVendors` | user | `listVendors` | matched |  |
| `GET /vendors/:vendorId` | `getVendor` | user | `getVendor` | matched |  |
| `PATCH /accredited-providers/:organizationId/:providerId` | `updateOrgAccreditedProvider` | association:admin, association:staff | `updateOrgAccreditedProvider` | matched |  |
| `PATCH /admin/admins/:adminId` | `updateAdmin` | — | `updateAdmin` | matched |  |
| `PATCH /admin/associations/:associationId` | `updateAssociation` | — | `updateAssociation` | matched |  |
| `PATCH /admin/organizations/:organizationId` | `updateOrganization` | — | `updateOrganization` | matched |  |
| `PATCH /applications/:applicationId` | `updateJobApplication` | association:admin, association:staff | `updateJobApplication` | matched |  |
| `PATCH /association/document-tags/:tagId` | `updateDocumentTag` | admin, coordinator | `updateDocumentTag` | matched |  |
| `PATCH /association/documents/:documentId` | `updateDocument` | admin, coordinator, member:owner | `updateDocument` | matched |  |
| `PATCH /association/events/:eventId` | `updateEvent` | association:admin, association:staff | `updateEvent` | matched |  |
| `PATCH /association/events/registrations/:registrationId` | `updateEventRegistration` | association:admin, association:staff | `updateEventRegistration` | matched |  |
| `PATCH /association/member/applications/:applicationId` | `updateMembershipApplication` | association:admin | `updateMembershipApplication` | matched |  |
| `PATCH /association/member/candidates/:candidateId` | `updateCandidate` | association:admin | `updateCandidate` | matched |  |
| `PATCH /association/member/chapter-affiliations/:affiliationId` | `updateChapterAffiliation` | association:admin | `updateChapterAffiliation` | matched |  |
| `PATCH /association/member/cpd-config/:organizationId` | `updateOrgCpdConfig` | association:admin | `updateOrgCpdConfig` | matched |  |
| `PATCH /association/member/credential-templates/:templateId` | `updateCredentialTemplate` | association:admin | `updateCredentialTemplate` | matched |  |
| `PATCH /association/member/credentials/:credentialId` | `updateDigitalCredential` | association:admin | `updateDigitalCredential` | matched |  |
| `PATCH /association/member/directory/profiles/:profileId` | `updateDirectoryProfile` | association:member:owner, association:admin | `updateDirectoryProfile` | matched |  |
| `PATCH /association/member/dues-configs/:duesConfigId` | `updateDuesConfig` | association:admin | `updateDuesConfig` | matched |  |
| `PATCH /association/member/dues-invoices/:invoiceId` | `updateDuesInvoice` | association:admin | `updateDuesInvoice` | matched |  |
| `PATCH /association/member/dunning/templates/:templateId` | `updateDunningTemplate` | association:admin | `updateDunningTemplate` | matched |  |
| `PATCH /association/member/elections/:electionId` | `updateElection` | association:admin | `updateElection` | matched |  |
| `PATCH /association/member/institutional-memberships/:institutionalMembershipId` | `updateInstitutionalMembership` | association:admin | `updateInstitutionalMembership` | matched |  |
| `PATCH /association/member/licenses/:licenseId` | `updateProfessionalLicense` | association:admin | `updateProfessionalLicense` | matched |  |
| `PATCH /association/member/memberships/:membershipId` | `updateMembership` | association:admin | `updateMembership` | matched |  |
| `PATCH /association/member/officer-terms/:termId` | `updateOfficerTerm` | association:admin | `updateOfficerTerm` | matched |  |
| `PATCH /association/member/positions/:positionId` | `updatePosition` | association:admin | `updatePosition` | matched |  |
| `PATCH /association/member/royalty-splits/:royaltySplitId` | `updateRoyaltySplit` | association:admin | `updateRoyaltySplit` | matched |  |
| `PATCH /association/member/tiers/:tierId` | `updateMembershipTier` | association:admin | `updateMembershipTier` | matched |  |
| `PATCH /association/message-templates/:templateId` | `updateMessageTemplate` | admin, coordinator | `updateMessageTemplate` | matched |  |
| `PATCH /association/messages/:messageId` | `updateMessage` | admin, coordinator | `updateMessage` | matched |  |
| `PATCH /association/person-subscriptions/:subscriptionId` | `updatePersonSubscription` | admin, member:owner | `updatePersonSubscription` | matched |  |
| `PATCH /association/subscription-topics/:topicId` | `updateSubscriptionTopic` | admin | `updateSubscriptionTopic` | matched |  |
| `PATCH /association/training/:trainingId` | `updateTraining` | association:admin, association:staff | `updateTraining` | matched |  |
| `PATCH /association/training/courses/:courseId` | `updateCourse` | association:admin, association:staff | `updateCourse` | matched |  |
| `PATCH /association/training/courses/enrollments/:enrollmentId` | `updateCourseEnrollment` | association:admin, association:staff | `updateCourseEnrollment` | matched |  |
| `PATCH /association/training/enrollments/:enrollmentId` | `updateTrainingEnrollment` | association:admin, association:staff | `updateTrainingEnrollment` | matched |  |
| `PATCH /billing/invoices/:invoice` | `updateInvoice` | — | `updateInvoice` | matched |  |
| `PATCH /booking/events/:event` | `updateBookingEvent` | event:owner, admin | `updateBookingEvent` | matched |  |
| `PATCH /comms/chat-rooms/:room/video-call/participant` | `updateVideoCallParticipant` | user | `updateVideoCallParticipant` | matched |  |
| `PATCH /communications/announcements/:id` | `updateAnnouncement` | association:officer | `updateAnnouncement` | matched |  |
| `PATCH /email/templates/:template` | `updateEmailTemplate` | admin | `updateEmailTemplate` | matched |  |
| `PATCH /persons/:person` | `updatePerson` | user:owner | `updatePerson` | matched |  |
| `PATCH /persons/me` | `updateMyProfile` | user | `updateMyProfile` | matched |  |
| `PATCH /persons/me/notification-preferences` | `updateMyNotificationPreferences` | user | `updateMyNotificationPreferences` | matched |  |
| `PATCH /persons/me/privacy` | `updateMyPrivacySettings` | user | `updateMyPrivacySettings` | matched |  |
| `PATCH /postings/:postingId` | `updateJobPosting` | association:admin, association:staff | `updateJobPosting` | matched |  |
| `PATCH /surveys/:survey` | `updateSurvey` | officer, admin | `updateSurvey` | matched |  |
| `PATCH /vendors/:vendorId` | `updateVendor` | association:admin, association:staff | `updateVendor` | matched |  |
| `POST /accredited-providers/:organizationId` | `createOrgAccreditedProvider` | association:admin, association:staff | `createOrgAccreditedProvider` | matched |  |
| `POST /admin/admins` | `inviteAdmin` | — | `inviteAdmin` | matched |  |
| `POST /admin/associations` | `createAssociation` | — | `createAssociation` | matched |  |
| `POST /admin/feature-flags` | `setFeatureFlag` | — | `setFeatureFlag` | matched |  |
| `POST /admin/impersonate` | `startImpersonation` | — | `startImpersonation` | matched |  |
| `POST /admin/impersonate/:sessionId/end` | `endImpersonation` | — | `endImpersonation` | matched |  |
| `POST /admin/organizations` | `createOrganization` | — | `createOrganization` | matched |  |
| `POST /admin/organizations/:organizationId/transition` | `transitionOrgStatus` | — | `transitionOrgStatus` | matched |  |
| `POST /advertisers` | `createAdvertiser` | association:admin, association:staff | `createAdvertiser` | matched |  |
| `POST /applications` | `createJobApplication` | user | `createJobApplication` | matched |  |
| `POST /association/document-tags` | `createDocumentTag` | admin, coordinator | `createDocumentTag` | matched |  |
| `POST /association/documents` | `createDocument` | admin, coordinator, member:owner | `createDocument` | matched |  |
| `POST /association/documents/:documentId/archive` | `archiveDocument` | admin, coordinator | `archiveDocument` | matched |  |
| `POST /association/documents/:documentId/versions` | `uploadNewDocumentVersion` | admin, coordinator, member:owner | `uploadNewDocumentVersion` | matched |  |
| `POST /association/event-lifecycle/:eventId/check-in` | `checkInCustomEvent` | association:admin, association:staff | `checkInCustomEvent` | matched |  |
| `POST /association/event-lifecycle/:eventId/complete` | `completeEvent` | association:admin, association:staff | `completeEvent` | matched |  |
| `POST /association/event-lifecycle/:eventId/register` | `registerForCustomEvent` | association:member | `registerForCustomEvent` | matched |  |
| `POST /association/event-lifecycle/:eventId/register-and-pay` | `registerAndPayForEvent` | association:member | `registerAndPayForEvent` | matched |  |
| `POST /association/events` | `createEvent` | association:admin, association:staff | `createEvent` | matched |  |
| `POST /association/events/:eventId/cancel` | `cancelEvent` | association:admin, association:staff | `cancelEvent` | matched |  |
| `POST /association/events/:eventId/publish` | `publishEvent` | association:admin, association:staff | `publishEvent` | matched |  |
| `POST /association/events/:eventId/waitlist/:entryId/promote` | `promoteWaitlistEntry` | association:admin, association:staff | `promoteWaitlistEntry` | matched |  |
| `POST /association/events/checkins` | `createCheckIn` | association:admin, association:staff | `createCheckIn` | matched |  |
| `POST /association/events/registrations` | `createEventRegistration` | association:admin, association:staff, association:member:owner | `createEventRegistration` | matched |  |
| `POST /association/events/registrations/:registrationId/cancel` | `cancelEventRegistration` | association:admin, association:staff, association:member:owner | `cancelEventRegistration` | matched |  |
| `POST /association/events/registrations/:registrationId/refund` | `refundEventRegistration` | association:admin, association:staff | `refundEventRegistration` | matched |  |
| `POST /association/member/affiliation-transfers` | `createAffiliationTransfer` | association:member:owner, association:admin | `createAffiliationTransfer` | matched |  |
| `POST /association/member/affiliation-transfers/:transferId/approve-source` | `approveTransferBySource` | association:admin, chapter:officer | `approveTransferBySource` | matched |  |
| `POST /association/member/affiliation-transfers/:transferId/approve-target` | `approveTransferByTarget` | association:admin, chapter:officer | `approveTransferByTarget` | matched |  |
| `POST /association/member/affiliation-transfers/:transferId/complete` | `completeAffiliationTransfer` | association:admin | `completeAffiliationTransfer` | matched |  |
| `POST /association/member/affiliation-transfers/:transferId/deny` | `denyAffiliationTransfer` | association:admin, chapter:officer | `denyAffiliationTransfer` | matched |  |
| `POST /association/member/aging-buckets/:organizationId/recalculate` | `recalculateAgingBucket` | association:admin | `recalculateAgingBucket` | matched |  |
| `POST /association/member/applications` | `createMembershipApplication` | user | `createMembershipApplication` | matched |  |
| `POST /association/member/applications/:applicationId/approve` | `approveMembershipApplication` | association:admin | `approveMembershipApplication` | matched |  |
| `POST /association/member/applications/:applicationId/deny` | `denyMembershipApplication` | association:admin | `denyMembershipApplication` | matched |  |
| `POST /association/member/applications/bulk-approve` | `bulkApproveMembershipApplications` | association:admin | `bulkApproveMembershipApplications` | matched |  |
| `POST /association/member/ballots` | `castBallot` | association:member | `castBallot` | matched |  |
| `POST /association/member/candidates` | `createCandidate` | association:admin, association:member | `createCandidate` | matched |  |
| `POST /association/member/candidates/:candidateId/status` | `updateCandidateStatus` | association:admin, association:member | `updateCandidateStatus` | matched |  |
| `POST /association/member/chapter-affiliations` | `createChapterAffiliation` | association:admin | `createChapterAffiliation` | matched |  |
| `POST /association/member/chapter-affiliations/:affiliationId/set-primary` | `setPrimaryChapterAffiliation` | association:admin | `setPrimaryChapterAffiliation` | matched |  |
| `POST /association/member/compliance/:organizationId/refresh` | `refreshCompliance` | association:admin | `refreshCompliance` | matched |  |
| `POST /association/member/credential-templates` | `createCredentialTemplate` | association:admin | `createCredentialTemplate` | matched |  |
| `POST /association/member/credentials/:credentialId/revoke` | `revokeDigitalCredential` | association:admin | `revokeDigitalCredential` | matched |  |
| `POST /association/member/credentials/issue` | `issueDigitalCredential` | association:admin | `issueDigitalCredential` | matched |  |
| `POST /association/member/credentials/public-verify` | `verifyCredentialPublic` | — | `verifyCredentialPublic` | matched |  |
| `POST /association/member/credentials/verify` | `verifyDigitalCredentialAuthenticated` | association:admin, association:member | `verifyDigitalCredentialAuthenticated` | matched |  |
| `POST /association/member/credits/adjust` | `adjustCreditEntry` | association:admin, association:staff | `adjustCreditEntry` | matched |  |
| `POST /association/member/credits/manual` | `awardManualCredit` | association:admin, association:staff | `awardManualCredit` | matched |  |
| `POST /association/member/credits/void-event` | `voidCreditEntry` | association:admin, association:staff | `voidCreditEntry` | matched |  |
| `POST /association/member/directory/profiles` | `createDirectoryProfile` | association:member:owner, association:admin | `createDirectoryProfile` | matched |  |
| `POST /association/member/dues-configs` | `createDuesConfig` | association:admin | `createDuesConfig` | matched |  |
| `POST /association/member/dues-gateway/:organizationId/test` | `testDuesGatewayConnection` | association:admin | `testDuesGatewayConnection` | matched |  |
| `POST /association/member/dues-invoices` | `createDuesInvoice` | association:admin | `createDuesInvoice` | matched |  |
| `POST /association/member/dues-invoices/:invoiceId/mark-paid` | `markDuesInvoicePaid` | association:admin | `markDuesInvoicePaid` | matched |  |
| `POST /association/member/dues-invoices/generate` | `generateDuesInvoicesForOrg` | association:admin | `generateDuesInvoicesForOrg` | matched |  |
| `POST /association/member/dues-payments` | `recordDuesPayment` | association:admin | `recordDuesPayment` | matched |  |
| `POST /association/member/dues-payments/:paymentId/confirm` | `confirmPaymentProof` | association:admin | `confirmPaymentProof` | matched |  |
| `POST /association/member/dues-payments/:paymentId/refund` | `refundDuesPayment` | association:admin | `refundDuesPayment` | matched |  |
| `POST /association/member/dues-payments/:paymentId/reject` | `rejectPaymentProof` | association:admin | `rejectPaymentProof` | matched |  |
| `POST /association/member/dues-payments/submit-proof` | `submitPaymentProof` | association:member | `submitPaymentProof` | matched |  |
| `POST /association/member/dunning/run` | `runDunning` | association:admin | `runDunning` | matched |  |
| `POST /association/member/dunning/templates` | `createDunningTemplate` | association:admin | `createDunningTemplate` | matched |  |
| `POST /association/member/elections` | `createElection` | association:admin | `createElection` | matched |  |
| `POST /association/member/elections/:electionId/certify` | `certifyElection` | association:admin | `certifyElection` | matched |  |
| `POST /association/member/elections/:electionId/open-nominations` | `openElectionNominations` | association:admin | `openElectionNominations` | matched |  |
| `POST /association/member/elections/:electionId/open-voting` | `openElectionVoting` | association:admin | `openElectionVoting` | matched |  |
| `POST /association/member/institutional-memberships` | `createInstitutionalMembership` | association:admin | `createInstitutionalMembership` | matched |  |
| `POST /association/member/institutional-memberships/:institutionalMembershipId/seats` | `allocateSeat` | association:admin, institution:admin | `allocateSeat` | matched |  |
| `POST /association/member/institutional-memberships/:institutionalMembershipId/seats/:seatAllocationId/revoke` | `revokeSeat` | association:admin, institution:admin | `revokeSeat` | matched |  |
| `POST /association/member/license-renewal-alerts/:alertId/acknowledge` | `acknowledgeLicenseRenewalAlert` | association:admin, association:member:owner | `acknowledgeLicenseRenewalAlert` | matched |  |
| `POST /association/member/licenses` | `createProfessionalLicense` | association:admin, association:member:owner | `createProfessionalLicense` | matched |  |
| `POST /association/member/memberships` | `createMembership` | association:admin | `createMembership` | matched |  |
| `POST /association/member/memberships/:membershipId/deceased` | `deceaseMembership` | association:admin | `deceaseMembership` | matched |  |
| `POST /association/member/memberships/:membershipId/reinstate` | `reinstateMembership` | association:admin | `reinstateMembership` | matched |  |
| `POST /association/member/memberships/:membershipId/renew` | `renewMembership` | association:admin | `renewMembership` | matched |  |
| `POST /association/member/memberships/:membershipId/resign` | `resignMembership` | association:admin | `resignMembership` | matched |  |
| `POST /association/member/memberships/:membershipId/terminate` | `terminateMembership` | association:admin | `terminateMembership` | matched |  |
| `POST /association/member/officer-terms` | `createOfficerTerm` | association:admin | `createOfficerTerm` | matched |  |
| `POST /association/member/positions` | `createPosition` | association:admin | `createPosition` | matched |  |
| `POST /association/member/roster` | `addRosterMember` | association:admin | `addRosterMember` | matched |  |
| `POST /association/member/roster/import` | `importRosterMembers` | association:admin | `importRosterMembers` | matched |  |
| `POST /association/member/royalty-splits` | `createRoyaltySplit` | association:admin | `createRoyaltySplit` | matched |  |
| `POST /association/member/special-assessments` | `createSpecialAssessment` | association:admin | `createSpecialAssessment` | matched |  |
| `POST /association/member/special-assessments/:id/apply` | `applySpecialAssessment` | association:admin | `applySpecialAssessment` | matched |  |
| `POST /association/member/tiers` | `createMembershipTier` | association:admin | `createMembershipTier` | matched |  |
| `POST /association/message-templates` | `createMessageTemplate` | admin, coordinator | `createMessageTemplate` | matched |  |
| `POST /association/message-templates/:templateId/preview` | `previewMessageTemplate` | admin, coordinator | `previewMessageTemplate` | matched |  |
| `POST /association/messages` | `createMessage` | admin, coordinator | `createMessage` | matched |  |
| `POST /association/messages/:messageId/cancel` | `cancelMessage` | admin, coordinator | `cancelMessage` | matched |  |
| `POST /association/messages/:messageId/schedule` | `scheduleMessage` | admin, coordinator | `scheduleMessage` | matched |  |
| `POST /association/messages/:messageId/send` | `sendMessage` | admin, coordinator | `sendMessage` | matched |  |
| `POST /association/person-subscriptions/bulk-update` | `bulkUpdatePersonSubscriptions` | admin, member:owner | `bulkUpdatePersonSubscriptions` | matched |  |
| `POST /association/subscription-topics` | `createSubscriptionTopic` | admin | `createSubscriptionTopic` | matched |  |
| `POST /association/training` | `createTraining` | association:admin, association:staff | `createTraining` | matched |  |
| `POST /association/training-lifecycle/:trainingId/cancel` | `cancelCustomTraining` | association:admin, association:staff | `cancelCustomTraining` | matched |  |
| `POST /association/training-lifecycle/:trainingId/check-in` | `checkInCustomTraining` | association:admin, association:staff | `checkInCustomTraining` | matched |  |
| `POST /association/training-lifecycle/:trainingId/complete` | `completeCustomTraining` | association:admin, association:staff | `completeCustomTraining` | matched |  |
| `POST /association/training-lifecycle/:trainingId/enroll` | `enrollInCustomTraining` | association:member | `enrollInCustomTraining` | matched |  |
| `POST /association/training/:trainingId/publish` | `publishTraining` | association:admin, association:staff | `publishTraining` | matched |  |
| `POST /association/training/courses` | `createCourse` | association:admin, association:staff | `createCourse` | matched |  |
| `POST /association/training/courses/enrollments` | `createCourseEnrollment` | association:admin, association:staff, association:member:owner | `createCourseEnrollment` | matched |  |
| `POST /association/training/courses/enrollments/:enrollmentId/progress` | `updateCourseProgress` | association:admin, association:staff, association:member:owner | `updateCourseProgress` | matched |  |
| `POST /association/training/courses/quiz-attempts` | `createQuizAttempt` | association:member:owner | `createQuizAttempt` | matched |  |
| `POST /association/training/enrollments` | `createTrainingEnrollment` | association:admin, association:staff, association:member:owner | `createTrainingEnrollment` | matched |  |
| `POST /association/training/enrollments/:enrollmentId/complete` | `completeTrainingEnrollment` | association:admin, association:staff | `completeTrainingEnrollment` | matched |  |
| `POST /billing/invoices` | `createInvoice` | — | `createInvoice` | matched |  |
| `POST /billing/invoices/:invoice/capture` | `captureInvoicePayment` | — | `captureInvoicePayment` | matched |  |
| `POST /billing/invoices/:invoice/finalize` | `finalizeInvoice` | — | `finalizeInvoice` | matched |  |
| `POST /billing/invoices/:invoice/mark-uncollectible` | `markInvoiceUncollectible` | — | `markInvoiceUncollectible` | matched |  |
| `POST /billing/invoices/:invoice/pay` | `payInvoice` | — | `payInvoice` | matched |  |
| `POST /billing/invoices/:invoice/refund` | `refundInvoicePayment` | — | `refundInvoicePayment` | matched |  |
| `POST /billing/invoices/:invoice/void` | `voidInvoice` | — | `voidInvoice` | matched |  |
| `POST /billing/merchant-accounts` | `createMerchantAccount` | — | `createMerchantAccount` | matched |  |
| `POST /billing/merchant-accounts/:merchantAccount/dashboard` | `getMerchantDashboard` | — | `getMerchantDashboard` | matched |  |
| `POST /billing/merchant-accounts/:merchantAccount/onboard` | `onboardMerchantAccount` | — | `onboardMerchantAccount` | matched |  |
| `POST /billing/webhooks/stripe` | `handleStripeWebhook` | — | `handleStripeWebhook` | matched |  |
| `POST /booking/bookings` | `createBooking` | user | `createBooking` | matched |  |
| `POST /booking/bookings/:booking/cancel` | `cancelBooking` | client:owner, host:owner, admin | `cancelBooking` | matched |  |
| `POST /booking/bookings/:booking/confirm` | `confirmBooking` | host:owner, admin | `confirmBooking` | matched |  |
| `POST /booking/bookings/:booking/no-show` | `markNoShowBooking` | client:owner, host:owner, admin | `markNoShowBooking` | matched |  |
| `POST /booking/bookings/:booking/reject` | `rejectBooking` | host:owner, admin | `rejectBooking` | matched |  |
| `POST /booking/events` | `createBookingEvent` | user | `createBookingEvent` | matched |  |
| `POST /booking/events/:event/exceptions` | `createScheduleException` | event:owner, admin | `createScheduleException` | matched |  |
| `POST /campaigns` | `createCampaign` | association:admin, association:staff | `createCampaign` | matched |  |
| `POST /certificates/bulk-issue` | `bulkIssueCertificates` | association:admin, association:staff | `bulkIssueCertificates` | matched |  |
| `POST /comms/chat-rooms` | `createChatRoom` | user | `createChatRoom` | matched |  |
| `POST /comms/chat-rooms/:room/messages` | `sendChatMessage` | user | `sendChatMessage` | matched |  |
| `POST /comms/chat-rooms/:room/video-call/end` | `endVideoCall` | user:admin | `endVideoCall` | matched |  |
| `POST /comms/chat-rooms/:room/video-call/join` | `joinVideoCall` | user | `joinVideoCall` | matched |  |
| `POST /comms/chat-rooms/:room/video-call/leave` | `leaveVideoCall` | user | `leaveVideoCall` | matched |  |
| `POST /communications/announcements/:id/archive` | `archiveAnnouncement` | association:officer | `archiveAnnouncement` | matched |  |
| `POST /communications/announcements/:id/publish` | `publishAnnouncement` | association:officer | `publishAnnouncement` | matched |  |
| `POST /communications/announcements/:id/schedule` | `scheduleAnnouncement` | association:officer | `scheduleAnnouncement` | matched |  |
| `POST /communications/announcements/:organizationId` | `createAnnouncement` | association:officer | `createAnnouncement` | matched |  |
| `POST /communications/segments` | `createSavedSegment` | admin, coordinator | `createSavedSegment` | matched |  |
| `POST /creatives` | `createCreative` | association:admin, association:staff | `createCreative` | matched |  |
| `POST /creatives/:creativeId/report` | `reportAd` | user | `reportAd` | matched |  |
| `POST /creatives/:creativeId/review` | `reviewCreative` | association:admin | `reviewCreative` | matched |  |
| `POST /email/queue/:queue/cancel` | `cancelEmailQueueItem` | admin | `cancelEmailQueueItem` | matched |  |
| `POST /email/queue/:queue/retry` | `retryEmailQueueItem` | admin | `retryEmailQueueItem` | matched |  |
| `POST /email/templates` | `createEmailTemplate` | admin | `createEmailTemplate` | matched |  |
| `POST /email/templates/:template/test` | `testEmailTemplate` | admin | `testEmailTemplate` | matched |  |
| `POST /email/unsubscribe` | `unsubscribeEmailPost` | — | `unsubscribeEmailPost` | matched |  |
| `POST /invitations/bulk-import` | `bulkImportMembers` | officer | `bulkImportMembers` | matched |  |
| `POST /invite` | `createInvite` | officer | `createInvite` | matched |  |
| `POST /invite/claim/:token` | `claimInvite` | — | `claimInvite` | matched |  |
| `POST /listings` | `createListing` | association:admin, association:staff | `createListing` | matched |  |
| `POST /notifs/:notif/read` | `markNotificationAsRead` | user | `markNotificationAsRead` | matched |  |
| `POST /notifs/read-all` | `markAllNotificationsAsRead` | user | `markAllNotificationsAsRead` | matched |  |
| `POST /opt-out` | `setMemberOptOut` | user | `setMemberOptOut` | matched |  |
| `POST /orders` | `createOrder` | user | `createOrder` | matched |  |
| `POST /orders/:orderId/fulfill` | `fulfillOrder` | association:admin, association:staff, user | `fulfillOrder` | matched |  |
| `POST /org/:organizationId/payments/send-link` | `sendPaymentLink` | association:admin, association:staff | `sendPaymentLink` | matched |  |
| `POST /pay/:token/checkout` | `checkoutPaymentToken` | — | `checkoutPaymentToken` | matched |  |
| `POST /persons` | `createPerson` | user | `createPerson` | matched |  |
| `POST /persons/me/cancel-delete` | `cancelMyAccountDeletion` | user | `cancelMyAccountDeletion` | matched |  |
| `POST /persons/me/credit-entries` | `createMyCreditEntry` | user | `createMyCreditEntry` | matched |  |
| `POST /persons/me/delete` | `requestMyAccountDeletion` | user | `requestMyAccountDeletion` | matched |  |
| `POST /postings` | `createJobPosting` | association:admin, association:staff | `createJobPosting` | matched |  |
| `POST /read-all` | `markAllNotificationsRead` | user | `markAllNotificationsRead` | matched |  |
| `POST /reviews/` | `createReview` | user | `createReview` | matched |  |
| `POST /storage/files/:file/complete` | `completeFileUpload` | user:owner | `completeFileUpload` | matched |  |
| `POST /storage/files/upload` | `uploadFile` | user | `uploadFile` | matched |  |
| `POST /surveys/` | `createSurvey` | officer, admin | `createSurvey` | matched |  |
| `POST /surveys/:survey/clone` | `cloneSurvey` | officer, admin | `cloneSurvey` | matched |  |
| `POST /surveys/:survey/close` | `closeSurvey` | officer, admin | `closeSurvey` | matched |  |
| `POST /surveys/:survey/publish` | `publishSurvey` | officer, admin | `publishSurvey` | matched |  |
| `POST /surveys/:survey/responses` | `submitSurveyResponse` | user | `submitSurveyResponse` | matched |  |
| `POST /surveys/:survey/responses/dismiss` | `dismissSurveyResponse` | user | `dismissSurveyResponse` | matched |  |
| `POST /vendors` | `createVendor` | association:admin, association:staff | `createVendor` | matched |  |
| `POST /vendors/:vendorId/verify` | `verifyVendor` | association:admin | `verifyVendor` | matched |  |
| `PUT /association/member/dues-gateway/:organizationId` | `upsertDuesGatewayConfig` | association:admin | `upsertDuesGatewayConfig` | matched |  |
| `PUT /association/member/dues-reporting/:organizationId` | `upsertDuesFunds` | association:admin | `upsertDuesFunds` | matched |  |
| `PUT /association/member/membership-categories/:organizationId` | `upsertMembershipCategory` | association:admin | `upsertMembershipCategory` | matched |  |
| `PUT /association/member/org-profile/:organizationId` | `updateOrganizationProfile` | association:admin | `updateOrganizationProfile` | matched |  |
| `PUT /association/member/roster/:memberId` | `updateRosterMember` | association:admin | `updateRosterMember` | matched |  |
| `PUT /association/member/special-assessments/:id` | `updateSpecialAssessment` | association:admin | `updateSpecialAssessment` | matched |  |
| `PUT /membership/org-profile/:organizationId` | `updateOrgProfile` | association:admin | `updateOrgProfile` | matched |  |
| `PUT /onboarding/step` | `updateOnboardingStep` | user | `updateOnboardingStep` | matched |  |
<!-- oli:regen:code-spec-trace:end -->
