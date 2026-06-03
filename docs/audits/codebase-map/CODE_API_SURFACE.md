# Code API Surface

<!-- oli:regen:code-api-surface:begin -->
| Endpoint | Handler | Auth | Consumers | Phantom | Confidence |
|---|---|---|---|---|---|
| `GET /csrf-token` | `<inline>` | false | 0 |  | HIGH |
| `GET /accredited-providers/:organizationId` | `listOrgAccreditedProviders` | true | 0 |  | HIGH |
| `POST /accredited-providers/:organizationId` | `createOrgAccreditedProvider` | true | 0 |  | HIGH |
| `PATCH /accredited-providers/:organizationId/:providerId` | `updateOrgAccreditedProvider` | true | 0 |  | HIGH |
| `DELETE /accredited-providers/:organizationId/:providerId` | `deleteOrgAccreditedProvider` | true | 0 |  | HIGH |
| `POST /admin/admins` | `inviteAdmin` | true | 0 |  | HIGH |
| `GET /admin/admins` | `listAdmins` | true | 0 |  | HIGH |
| `PATCH /admin/admins/:adminId` | `updateAdmin` | true | 0 |  | HIGH |
| `DELETE /admin/admins/:adminId` | `revokeAdmin` | true | 0 |  | HIGH |
| `POST /admin/associations` | `createAssociation` | true | 0 |  | HIGH |
| `GET /admin/associations` | `listAssociations` | true | 1 |  | HIGH |
| `GET /admin/associations/:associationId` | `getAssociation` | true | 1 |  | HIGH |
| `PATCH /admin/associations/:associationId` | `updateAssociation` | true | 1 |  | HIGH |
| `DELETE /admin/associations/:associationId` | `deleteAssociation` | true | 1 |  | HIGH |
| `GET /admin/committees` | `listAllCommittees` | true | 0 |  | HIGH |
| `GET /admin/committees/:id` | `getCommittee` | true | 0 |  | HIGH |
| `POST /admin/feature-flags` | `setFeatureFlag` | true | 0 |  | HIGH |
| `GET /admin/feature-flags` | `listFeatureFlags` | true | 0 |  | HIGH |
| `DELETE /admin/feature-flags/:flagId` | `deleteFeatureFlag` | true | 0 |  | HIGH |
| `POST /admin/impersonate` | `startImpersonation` | true | 0 |  | HIGH |
| `POST /admin/impersonate/:sessionId/end` | `endImpersonation` | true | 0 |  | HIGH |
| `GET /admin/me/role` | `getAdminRole` | true | 0 |  | HIGH |
| `GET /admin/national-dashboard/:associationId` | `getNationalDashboard` | true | 1 |  | HIGH |
| `GET /admin/national/chapters` | `listNationalChapters` | true | 0 |  | HIGH |
| `GET /admin/national/chapters/:organizationId` | `getNationalChapterDetail` | true | 0 |  | HIGH |
| `GET /admin/national/platform` | `getPlatformSummary` | true | 0 |  | HIGH |
| `POST /admin/organizations` | `createOrganization` | true | 1 |  | HIGH |
| `GET /admin/organizations` | `listOrganizations` | true | 1 |  | HIGH |
| `GET /admin/organizations/:organizationId` | `getOrganization` | true | 1 |  | HIGH |
| `PATCH /admin/organizations/:organizationId` | `updateOrganization` | true | 0 |  | HIGH |
| `POST /admin/organizations/:organizationId/transition` | `transitionOrgStatus` | true | 1 |  | HIGH |
| `GET /admin/surveys/` | `listAdminSurveys` | true | 0 |  | HIGH |
| `POST /advertisers` | `createAdvertiser` | true | 0 |  | HIGH |
| `POST /applications` | `createJobApplication` | true | 0 |  | HIGH |
| `PATCH /applications/:applicationId` | `updateJobApplication` | true | 0 |  | HIGH |
| `POST /association/document-tags` | `createDocumentTag` | true | 0 |  | HIGH |
| `GET /association/document-tags` | `listDocumentTags` | true | 0 |  | HIGH |
| `GET /association/document-tags/:tagId` | `getDocumentTag` | true | 0 |  | HIGH |
| `PATCH /association/document-tags/:tagId` | `updateDocumentTag` | true | 0 |  | HIGH |
| `DELETE /association/document-tags/:tagId` | `deleteDocumentTag` | true | 0 |  | HIGH |
| `POST /association/documents` | `createDocument` | true | 1 |  | HIGH |
| `GET /association/documents` | `searchDocuments` | true | 1 |  | HIGH |
| `GET /association/documents/:documentId` | `getDocument` | true | 1 |  | HIGH |
| `PATCH /association/documents/:documentId` | `updateDocument` | true | 1 |  | HIGH |
| `DELETE /association/documents/:documentId` | `deleteDocument` | true | 1 |  | HIGH |
| `GET /association/documents/:documentId/access-log` | `getDocumentAccessLog` | true | 0 |  | HIGH |
| `POST /association/documents/:documentId/archive` | `archiveDocument` | true | 1 |  | HIGH |
| `POST /association/documents/:documentId/versions` | `uploadNewDocumentVersion` | true | 0 |  | HIGH |
| `GET /association/documents/:documentId/versions` | `listDocumentVersions` | true | 1 |  | HIGH |
| `GET /association/documents/:documentId/versions/:versionId` | `getDocumentVersion` | true | 0 |  | HIGH |
| `GET /association/event-lifecycle/my` | `listMyCustomEvents` | true | 1 |  | HIGH |
| `GET /association/event-lifecycle/:eventId/attendance` | `listCustomEventAttendance` | true | 1 |  | HIGH |
| `POST /association/event-lifecycle/:eventId/check-in` | `checkInCustomEvent` | true | 1 |  | HIGH |
| `POST /association/event-lifecycle/:eventId/complete` | `completeEvent` | true | 1 |  | HIGH |
| `POST /association/event-lifecycle/:eventId/register` | `registerForCustomEvent` | true | 0 |  | HIGH |
| `POST /association/event-lifecycle/:eventId/register-and-pay` | `registerAndPayForEvent` | true | 0 |  | HIGH |
| `GET /association/event-lifecycle/:eventId/registrations` | `listCustomEventRegistrations` | true | 1 |  | HIGH |
| `POST /association/events` | `createEvent` | true | 1 |  | HIGH |
| `GET /association/events` | `searchEvents` | true | 2 |  | HIGH |
| `POST /association/events/checkins` | `createCheckIn` | true | 0 |  | HIGH |
| `GET /association/events/checkins` | `searchCheckIns` | true | 0 |  | HIGH |
| `POST /association/events/registrations` | `createEventRegistration` | true | 0 |  | HIGH |
| `GET /association/events/registrations` | `searchEventRegistrations` | true | 0 |  | HIGH |
| `GET /association/events/registrations/:registrationId` | `getEventRegistration` | true | 0 |  | HIGH |
| `PATCH /association/events/registrations/:registrationId` | `updateEventRegistration` | true | 0 |  | HIGH |
| `DELETE /association/events/registrations/:registrationId` | `deleteEventRegistration` | true | 0 |  | HIGH |
| `POST /association/events/registrations/:registrationId/cancel` | `cancelEventRegistration` | true | 0 |  | HIGH |
| `POST /association/events/registrations/:registrationId/refund` | `refundEventRegistration` | true | 0 |  | HIGH |
| `GET /association/events/:eventId` | `getEvent` | true | 1 |  | HIGH |
| `PATCH /association/events/:eventId` | `updateEvent` | true | 1 |  | HIGH |
| `DELETE /association/events/:eventId` | `deleteEvent` | true | 0 |  | HIGH |
| `POST /association/events/:eventId/cancel` | `cancelEvent` | true | 1 |  | HIGH |
| `POST /association/events/:eventId/publish` | `publishEvent` | true | 0 |  | HIGH |
| `GET /association/events/:eventId/waitlist` | `listWaitlistEntries` | true | 0 |  | HIGH |
| `POST /association/events/:eventId/waitlist/:entryId/promote` | `promoteWaitlistEntry` | true | 0 |  | HIGH |
| `POST /association/member/affiliation-transfers` | `createAffiliationTransfer` | true | 1 |  | HIGH |
| `GET /association/member/affiliation-transfers` | `listAffiliationTransfers` | true | 0 |  | HIGH |
| `GET /association/member/affiliation-transfers/:transferId` | `getAffiliationTransfer` | true | 0 |  | HIGH |
| `POST /association/member/affiliation-transfers/:transferId/approve-source` | `approveTransferBySource` | true | 0 |  | HIGH |
| `POST /association/member/affiliation-transfers/:transferId/approve-target` | `approveTransferByTarget` | true | 0 |  | HIGH |
| `POST /association/member/affiliation-transfers/:transferId/complete` | `completeAffiliationTransfer` | true | 0 |  | HIGH |
| `POST /association/member/affiliation-transfers/:transferId/deny` | `denyAffiliationTransfer` | true | 0 |  | HIGH |
| `GET /association/member/aging-buckets/:organizationId` | `getAgingBucket` | true | 0 |  | HIGH |
| `POST /association/member/aging-buckets/:organizationId/recalculate` | `recalculateAgingBucket` | true | 0 |  | HIGH |
| `POST /association/member/applications` | `createMembershipApplication` | true | 1 |  | HIGH |
| `GET /association/member/applications` | `listMembershipApplications` | true | 1 |  | HIGH |
| `POST /association/member/applications/bulk-approve` | `bulkApproveMembershipApplications` | true | 1 |  | HIGH |
| `GET /association/member/applications/:applicationId` | `getMembershipApplication` | true | 0 |  | HIGH |
| `PATCH /association/member/applications/:applicationId` | `updateMembershipApplication` | true | 0 |  | HIGH |
| `DELETE /association/member/applications/:applicationId` | `deleteMembershipApplication` | true | 0 |  | HIGH |
| `POST /association/member/applications/:applicationId/approve` | `approveMembershipApplication` | true | 1 |  | HIGH |
| `POST /association/member/applications/:applicationId/deny` | `denyMembershipApplication` | true | 1 |  | HIGH |
| `POST /association/member/ballots` | `castBallot` | true | 1 |  | HIGH |
| `GET /association/member/ballots` | `listBallots` | true | 1 |  | HIGH |
| `POST /association/member/candidates` | `createCandidate` | true | 1 |  | HIGH |
| `GET /association/member/candidates` | `listCandidates` | true | 0 |  | HIGH |
| `GET /association/member/candidates/:candidateId` | `getCandidate` | true | 0 |  | HIGH |
| `PATCH /association/member/candidates/:candidateId` | `updateCandidate` | true | 0 |  | HIGH |
| `DELETE /association/member/candidates/:candidateId` | `deleteCandidate` | true | 1 |  | HIGH |
| `POST /association/member/candidates/:candidateId/status` | `updateCandidateStatus` | true | 0 |  | HIGH |
| `GET /association/member/certificates` | `listMyCertificates` | true | 1 |  | HIGH |
| `GET /association/member/certificates/:certificateId` | `getCertificate` | true | 1 |  | HIGH |
| `POST /association/member/chapter-affiliations` | `createChapterAffiliation` | true | 0 |  | HIGH |
| `GET /association/member/chapter-affiliations` | `listChapterAffiliations` | true | 1 |  | HIGH |
| `GET /association/member/chapter-affiliations/:affiliationId` | `getChapterAffiliation` | true | 0 |  | HIGH |
| `PATCH /association/member/chapter-affiliations/:affiliationId` | `updateChapterAffiliation` | true | 0 |  | HIGH |
| `DELETE /association/member/chapter-affiliations/:affiliationId` | `deleteChapterAffiliation` | true | 0 |  | HIGH |
| `POST /association/member/chapter-affiliations/:affiliationId/set-primary` | `setPrimaryChapterAffiliation` | true | 0 |  | HIGH |
| `GET /association/member/compliance/:organizationId` | `getComplianceReport` | true | 0 |  | HIGH |
| `POST /association/member/compliance/:organizationId/refresh` | `refreshCompliance` | true | 0 |  | HIGH |
| `GET /association/member/cpd-config/:organizationId` | `getOrgCpdConfig` | true | 1 |  | HIGH |
| `PATCH /association/member/cpd-config/:organizationId` | `updateOrgCpdConfig` | true | 0 |  | HIGH |
| `POST /association/member/credential-templates` | `createCredentialTemplate` | true | 0 |  | HIGH |
| `GET /association/member/credential-templates` | `listCredentialTemplates` | true | 0 |  | HIGH |
| `GET /association/member/credential-templates/:templateId` | `getCredentialTemplate` | true | 0 |  | HIGH |
| `PATCH /association/member/credential-templates/:templateId` | `updateCredentialTemplate` | true | 0 |  | HIGH |
| `DELETE /association/member/credential-templates/:templateId` | `deleteCredentialTemplate` | true | 0 |  | HIGH |
| `GET /association/member/credentials` | `listDigitalCredentials` | true | 0 |  | HIGH |
| `POST /association/member/credentials/issue` | `issueDigitalCredential` | true | 0 |  | HIGH |
| `GET /association/member/credentials/lookup/:credentialNumber` | `lookupCredentialPublic` | ? | 0 |  | HIGH |
| `POST /association/member/credentials/public-verify` | `verifyCredentialPublic` | ? | 0 |  | HIGH |
| `POST /association/member/credentials/verify` | `verifyDigitalCredentialAuthenticated` | true | 0 |  | HIGH |
| `GET /association/member/credentials/:credentialId` | `getDigitalCredential` | true | 0 |  | HIGH |
| `PATCH /association/member/credentials/:credentialId` | `updateDigitalCredential` | true | 0 |  | HIGH |
| `DELETE /association/member/credentials/:credentialId` | `deleteDigitalCredential` | true | 0 |  | HIGH |
| `POST /association/member/credentials/:credentialId/revoke` | `revokeDigitalCredential` | true | 0 |  | HIGH |
| `POST /association/member/credits/adjust` | `adjustCreditEntry` | true | 0 |  | HIGH |
| `POST /association/member/credits/manual` | `awardManualCredit` | true | 1 |  | HIGH |
| `POST /association/member/credits/void-event` | `voidCreditEntry` | true | 1 |  | HIGH |
| `POST /association/member/directory/profiles` | `createDirectoryProfile` | true | 1 |  | HIGH |
| `GET /association/member/directory/profiles` | `listDirectoryProfiles` | true | 0 |  | HIGH |
| `GET /association/member/directory/profiles/:profileId` | `getDirectoryProfile` | true | 0 |  | HIGH |
| `PATCH /association/member/directory/profiles/:profileId` | `updateDirectoryProfile` | true | 0 |  | HIGH |
| `DELETE /association/member/directory/profiles/:profileId` | `deleteDirectoryProfile` | true | 0 |  | HIGH |
| `GET /association/member/directory/search` | `searchDirectory` | true | 1 |  | HIGH |
| `GET /association/member/directory/search/:personId/public` | `getPublicDirectoryProfile` | true | 0 |  | HIGH |
| `POST /association/member/dues-configs` | `createDuesConfig` | true | 1 |  | HIGH |
| `GET /association/member/dues-configs` | `listDuesConfigs` | true | 1 |  | HIGH |
| `GET /association/member/dues-configs/:duesConfigId` | `getDuesConfig` | true | 1 |  | HIGH |
| `PATCH /association/member/dues-configs/:duesConfigId` | `updateDuesConfig` | true | 1 |  | HIGH |
| `DELETE /association/member/dues-configs/:duesConfigId` | `deleteDuesConfig` | true | 0 |  | HIGH |
| `GET /association/member/dues-gateway/:organizationId` | `getDuesGatewayConfig` | true | 1 |  | HIGH |
| `PUT /association/member/dues-gateway/:organizationId` | `upsertDuesGatewayConfig` | true | 1 |  | HIGH |
| `DELETE /association/member/dues-gateway/:organizationId` | `disconnectDuesGateway` | true | 1 |  | HIGH |
| `POST /association/member/dues-gateway/:organizationId/test` | `testDuesGatewayConnection` | true | 1 |  | HIGH |
| `POST /association/member/dues-invoices` | `createDuesInvoice` | true | 0 |  | HIGH |
| `GET /association/member/dues-invoices` | `listDuesInvoices` | true | 1 |  | HIGH |
| `POST /association/member/dues-invoices/generate` | `generateDuesInvoicesForOrg` | true | 1 |  | HIGH |
| `GET /association/member/dues-invoices/:invoiceId` | `getDuesInvoice` | true | 1 |  | HIGH |
| `PATCH /association/member/dues-invoices/:invoiceId` | `updateDuesInvoice` | true | 1 |  | HIGH |
| `DELETE /association/member/dues-invoices/:invoiceId` | `deleteDuesInvoice` | true | 0 |  | HIGH |
| `POST /association/member/dues-invoices/:invoiceId/mark-paid` | `markDuesInvoicePaid` | true | 1 |  | HIGH |
| `GET /association/member/dues-payments` | `listDuesPayments` | true | 1 |  | HIGH |
| `POST /association/member/dues-payments` | `recordDuesPayment` | true | 1 |  | HIGH |
| `GET /association/member/dues-payments/pending-proofs` | `listPendingProofs` | true | 1 |  | HIGH |
| `POST /association/member/dues-payments/submit-proof` | `submitPaymentProof` | true | 1 |  | HIGH |
| `GET /association/member/dues-payments/:paymentId` | `getDuesPayment` | true | 1 |  | HIGH |
| `POST /association/member/dues-payments/:paymentId/confirm` | `confirmPaymentProof` | true | 1 |  | HIGH |
| `POST /association/member/dues-payments/:paymentId/refund` | `refundDuesPayment` | true | 1 |  | HIGH |
| `POST /association/member/dues-payments/:paymentId/reject` | `rejectPaymentProof` | true | 1 |  | HIGH |
| `GET /association/member/dues-reporting` | `listDuesFunds` | true | 1 |  | HIGH |
| `PUT /association/member/dues-reporting/:organizationId` | `upsertDuesFunds` | true | 1 |  | HIGH |
| `GET /association/member/dues-reporting/:organizationId/dashboard` | `getDuesFinancialDashboard` | true | 1 |  | HIGH |
| `GET /association/member/dues-reporting/:organizationId/report` | `generateDuesReport` | true | 1 |  | HIGH |
| `GET /association/member/dunning/events` | `listDunningEvents` | true | 0 |  | HIGH |
| `POST /association/member/dunning/run` | `runDunning` | true | 0 |  | HIGH |
| `POST /association/member/dunning/templates` | `createDunningTemplate` | true | 0 |  | HIGH |
| `GET /association/member/dunning/templates` | `listDunningTemplates` | true | 0 |  | HIGH |
| `GET /association/member/dunning/templates/:templateId` | `getDunningTemplate` | true | 0 |  | HIGH |
| `PATCH /association/member/dunning/templates/:templateId` | `updateDunningTemplate` | true | 0 |  | HIGH |
| `DELETE /association/member/dunning/templates/:templateId` | `deleteDunningTemplate` | true | 0 |  | HIGH |
| `POST /association/member/elections` | `createElection` | true | 1 |  | HIGH |
| `GET /association/member/elections` | `listElections` | true | 1 |  | HIGH |
| `GET /association/member/elections/:electionId` | `getElection` | true | 1 |  | HIGH |
| `PATCH /association/member/elections/:electionId` | `updateElection` | true | 1 |  | HIGH |
| `DELETE /association/member/elections/:electionId` | `deleteElection` | true | 0 |  | HIGH |
| `POST /association/member/elections/:electionId/certify` | `certifyElection` | true | 1 |  | HIGH |
| `POST /association/member/elections/:electionId/open-nominations` | `openElectionNominations` | true | 1 |  | HIGH |
| `POST /association/member/elections/:electionId/open-voting` | `openElectionVoting` | true | 1 |  | HIGH |
| `POST /association/member/institutional-memberships` | `createInstitutionalMembership` | true | 1 |  | HIGH |
| `GET /association/member/institutional-memberships` | `listInstitutionalMemberships` | true | 1 |  | HIGH |
| `GET /association/member/institutional-memberships/:institutionalMembershipId` | `getInstitutionalMembership` | true | 1 |  | HIGH |
| `PATCH /association/member/institutional-memberships/:institutionalMembershipId` | `updateInstitutionalMembership` | true | 1 |  | HIGH |
| `DELETE /association/member/institutional-memberships/:institutionalMembershipId` | `deleteInstitutionalMembership` | true | 1 |  | HIGH |
| `POST /association/member/institutional-memberships/:institutionalMembershipId/seats` | `allocateSeat` | true | 1 |  | HIGH |
| `GET /association/member/institutional-memberships/:institutionalMembershipId/seats` | `listSeatAllocations` | true | 1 |  | HIGH |
| `POST /association/member/institutional-memberships/:institutionalMembershipId/seats/:seatAllocationId/revoke` | `revokeSeat` | true | 1 |  | HIGH |
| `GET /association/member/license-renewal-alerts` | `listLicenseRenewalAlerts` | true | 0 |  | HIGH |
| `POST /association/member/license-renewal-alerts/:alertId/acknowledge` | `acknowledgeLicenseRenewalAlert` | true | 0 |  | HIGH |
| `POST /association/member/licenses` | `createProfessionalLicense` | true | 0 |  | HIGH |
| `GET /association/member/licenses` | `listProfessionalLicenses` | true | 1 |  | HIGH |
| `GET /association/member/licenses/:licenseId` | `getProfessionalLicense` | true | 0 |  | HIGH |
| `PATCH /association/member/licenses/:licenseId` | `updateProfessionalLicense` | true | 0 |  | HIGH |
| `DELETE /association/member/licenses/:licenseId` | `deleteProfessionalLicense` | true | 0 |  | HIGH |
| `GET /association/member/membership-categories` | `listMembershipCategories` | true | 1 |  | HIGH |
| `PUT /association/member/membership-categories/:organizationId` | `upsertMembershipCategory` | true | 1 |  | HIGH |
| `POST /association/member/memberships` | `createMembership` | true | 0 |  | HIGH |
| `GET /association/member/memberships` | `listMemberships` | true | 1 |  | HIGH |
| `GET /association/member/memberships/:membershipId` | `getMembership` | true | 0 |  | HIGH |
| `PATCH /association/member/memberships/:membershipId` | `updateMembership` | true | 0 |  | HIGH |
| `DELETE /association/member/memberships/:membershipId` | `deleteMembership` | true | 0 |  | HIGH |
| `POST /association/member/memberships/:membershipId/deceased` | `deceaseMembership` | true | 0 |  | HIGH |
| `POST /association/member/memberships/:membershipId/reinstate` | `reinstateMembership` | true | 1 |  | HIGH |
| `POST /association/member/memberships/:membershipId/renew` | `renewMembership` | true | 0 |  | HIGH |
| `POST /association/member/memberships/:membershipId/resign` | `resignMembership` | true | 0 |  | HIGH |
| `POST /association/member/memberships/:membershipId/terminate` | `terminateMembership` | true | 1 |  | HIGH |
| `POST /association/member/officer-terms` | `createOfficerTerm` | true | 0 |  | HIGH |
| `GET /association/member/officer-terms` | `listOfficerTerms` | true | 1 |  | HIGH |
| `GET /association/member/officer-terms/:termId` | `getOfficerTerm` | true | 0 |  | HIGH |
| `PATCH /association/member/officer-terms/:termId` | `updateOfficerTerm` | true | 0 |  | HIGH |
| `DELETE /association/member/officer-terms/:termId` | `deleteOfficerTerm` | true | 1 |  | HIGH |
| `GET /association/member/org-profile/:organizationId` | `getOrganizationProfile` | true | 0 |  | HIGH |
| `PUT /association/member/org-profile/:organizationId` | `updateOrganizationProfile` | true | 0 |  | HIGH |
| `POST /association/member/positions` | `createPosition` | true | 0 |  | HIGH |
| `GET /association/member/positions` | `listPositions` | true | 0 |  | HIGH |
| `GET /association/member/positions/:positionId` | `getPosition` | true | 0 |  | HIGH |
| `PATCH /association/member/positions/:positionId` | `updatePosition` | true | 0 |  | HIGH |
| `DELETE /association/member/positions/:positionId` | `deletePosition` | true | 0 |  | HIGH |
| `GET /association/member/roster` | `listRosterMembers` | true | 2 |  | HIGH |
| `POST /association/member/roster` | `addRosterMember` | true | 0 |  | HIGH |
| `POST /association/member/roster/import` | `importRosterMembers` | true | 1 |  | HIGH |
| `GET /association/member/roster/:memberId` | `getRosterMember` | true | 1 |  | HIGH |
| `PUT /association/member/roster/:memberId` | `updateRosterMember` | true | 1 |  | HIGH |
| `POST /association/member/royalty-splits` | `createRoyaltySplit` | true | 0 |  | HIGH |
| `GET /association/member/royalty-splits` | `listRoyaltySplits` | true | 0 |  | HIGH |
| `GET /association/member/royalty-splits/:royaltySplitId` | `getRoyaltySplit` | true | 0 |  | HIGH |
| `PATCH /association/member/royalty-splits/:royaltySplitId` | `updateRoyaltySplit` | true | 0 |  | HIGH |
| `DELETE /association/member/royalty-splits/:royaltySplitId` | `deleteRoyaltySplit` | true | 0 |  | HIGH |
| `POST /association/member/special-assessments` | `createSpecialAssessment` | true | 1 |  | HIGH |
| `PUT /association/member/special-assessments/:id` | `updateSpecialAssessment` | true | 1 |  | HIGH |
| `DELETE /association/member/special-assessments/:id` | `deleteSpecialAssessment` | true | 1 |  | HIGH |
| `POST /association/member/special-assessments/:id/apply` | `applySpecialAssessment` | true | 1 |  | HIGH |
| `GET /association/member/special-assessments/:id/collection` | `getSpecialAssessmentCollection` | true | 0 |  | HIGH |
| `GET /association/member/special-assessments/:orgId` | `listSpecialAssessments` | true | 1 |  | HIGH |
| `POST /association/member/tiers` | `createMembershipTier` | true | 0 |  | HIGH |
| `GET /association/member/tiers` | `listMembershipTiers` | true | 1 |  | HIGH |
| `GET /association/member/tiers/:tierId` | `getMembershipTier` | true | 0 |  | HIGH |
| `PATCH /association/member/tiers/:tierId` | `updateMembershipTier` | true | 0 |  | HIGH |
| `DELETE /association/member/tiers/:tierId` | `deleteMembershipTier` | true | 0 |  | HIGH |
| `POST /association/message-templates` | `createMessageTemplate` | true | 1 |  | HIGH |
| `GET /association/message-templates` | `searchMessageTemplates` | true | 1 |  | HIGH |
| `GET /association/message-templates/:templateId` | `getMessageTemplate` | true | 0 |  | HIGH |
| `PATCH /association/message-templates/:templateId` | `updateMessageTemplate` | true | 0 |  | HIGH |
| `DELETE /association/message-templates/:templateId` | `deleteMessageTemplate` | true | 0 |  | HIGH |
| `POST /association/message-templates/:templateId/preview` | `previewMessageTemplate` | true | 0 |  | HIGH |
| `POST /association/messages` | `createMessage` | true | 1 |  | HIGH |
| `GET /association/messages` | `searchMessages` | true | 0 |  | HIGH |
| `GET /association/messages/:messageId` | `getMessage` | true | 0 |  | HIGH |
| `PATCH /association/messages/:messageId` | `updateMessage` | true | 0 |  | HIGH |
| `DELETE /association/messages/:messageId` | `deleteMessage` | true | 0 |  | HIGH |
| `POST /association/messages/:messageId/cancel` | `cancelMessage` | true | 0 |  | HIGH |
| `POST /association/messages/:messageId/schedule` | `scheduleMessage` | true | 0 |  | HIGH |
| `POST /association/messages/:messageId/send` | `sendMessage` | true | 1 |  | HIGH |
| `GET /association/person-subscriptions` | `listPersonSubscriptions` | true | 0 |  | HIGH |
| `POST /association/person-subscriptions/bulk-update` | `bulkUpdatePersonSubscriptions` | true | 1 |  | HIGH |
| `PATCH /association/person-subscriptions/:subscriptionId` | `updatePersonSubscription` | true | 0 |  | HIGH |
| `POST /association/subscription-topics` | `createSubscriptionTopic` | true | 0 |  | HIGH |
| `GET /association/subscription-topics/:topicId` | `getSubscriptionTopic` | true | 0 |  | HIGH |
| `PATCH /association/subscription-topics/:topicId` | `updateSubscriptionTopic` | true | 0 |  | HIGH |
| `DELETE /association/subscription-topics/:topicId` | `deleteSubscriptionTopic` | true | 0 |  | HIGH |
| `POST /association/training` | `createTraining` | true | 1 |  | HIGH |
| `GET /association/training` | `searchTrainings` | true | 1 |  | HIGH |
| `GET /association/training-lifecycle/my` | `listMyCustomTrainings` | true | 1 |  | HIGH |
| `POST /association/training-lifecycle/:trainingId/cancel` | `cancelCustomTraining` | true | 1 |  | HIGH |
| `POST /association/training-lifecycle/:trainingId/check-in` | `checkInCustomTraining` | true | 1 |  | HIGH |
| `POST /association/training-lifecycle/:trainingId/complete` | `completeCustomTraining` | true | 1 |  | HIGH |
| `POST /association/training-lifecycle/:trainingId/enroll` | `enrollInCustomTraining` | true | 0 |  | HIGH |
| `GET /association/training-lifecycle/:trainingId/enrollments` | `listCustomTrainingEnrollments` | true | 1 |  | HIGH |
| `POST /association/training/courses` | `createCourse` | true | 0 |  | HIGH |
| `GET /association/training/courses` | `searchCourses` | true | 1 |  | HIGH |
| `POST /association/training/courses/enrollments` | `createCourseEnrollment` | true | 0 |  | HIGH |
| `GET /association/training/courses/enrollments` | `searchCourseEnrollments` | true | 0 |  | HIGH |
| `GET /association/training/courses/enrollments/:enrollmentId` | `getCourseEnrollment` | true | 0 |  | HIGH |
| `PATCH /association/training/courses/enrollments/:enrollmentId` | `updateCourseEnrollment` | true | 0 |  | HIGH |
| `DELETE /association/training/courses/enrollments/:enrollmentId` | `deleteCourseEnrollment` | true | 0 |  | HIGH |
| `POST /association/training/courses/enrollments/:enrollmentId/progress` | `updateCourseProgress` | true | 0 |  | HIGH |
| `POST /association/training/courses/quiz-attempts` | `createQuizAttempt` | true | 0 |  | HIGH |
| `GET /association/training/courses/quiz-attempts` | `searchQuizAttempts` | true | 0 |  | HIGH |
| `GET /association/training/courses/:courseId` | `getCourse` | true | 0 |  | HIGH |
| `PATCH /association/training/courses/:courseId` | `updateCourse` | true | 0 |  | HIGH |
| `DELETE /association/training/courses/:courseId` | `deleteCourse` | true | 0 |  | HIGH |
| `POST /association/training/enrollments` | `createTrainingEnrollment` | true | 0 |  | HIGH |
| `GET /association/training/enrollments` | `searchTrainingEnrollments` | true | 0 |  | HIGH |
| `GET /association/training/enrollments/:enrollmentId` | `getTrainingEnrollment` | true | 0 |  | HIGH |
| `PATCH /association/training/enrollments/:enrollmentId` | `updateTrainingEnrollment` | true | 0 |  | HIGH |
| `DELETE /association/training/enrollments/:enrollmentId` | `deleteTrainingEnrollment` | true | 0 |  | HIGH |
| `POST /association/training/enrollments/:enrollmentId/complete` | `completeTrainingEnrollment` | true | 0 |  | HIGH |
| `GET /association/training/:trainingId` | `getTraining` | true | 1 |  | HIGH |
| `PATCH /association/training/:trainingId` | `updateTraining` | true | 1 |  | HIGH |
| `DELETE /association/training/:trainingId` | `deleteTraining` | true | 0 |  | HIGH |
| `POST /association/training/:trainingId/publish` | `publishTraining` | true | 0 |  | HIGH |
| `GET /audit/logs` | `listAuditLogs` | true | 0 |  | HIGH |
| `POST /billing/invoices` | `createInvoice` | true | 0 |  | HIGH |
| `GET /billing/invoices` | `listInvoices` | true | 0 |  | HIGH |
| `GET /billing/invoices/:invoice` | `getInvoice` | true | 0 |  | HIGH |
| `PATCH /billing/invoices/:invoice` | `updateInvoice` | true | 0 |  | HIGH |
| `DELETE /billing/invoices/:invoice` | `deleteInvoice` | true | 0 |  | HIGH |
| `POST /billing/invoices/:invoice/capture` | `captureInvoicePayment` | true | 0 |  | HIGH |
| `POST /billing/invoices/:invoice/finalize` | `finalizeInvoice` | true | 0 |  | HIGH |
| `POST /billing/invoices/:invoice/mark-uncollectible` | `markInvoiceUncollectible` | true | 0 |  | HIGH |
| `POST /billing/invoices/:invoice/pay` | `payInvoice` | true | 1 |  | HIGH |
| `POST /billing/invoices/:invoice/refund` | `refundInvoicePayment` | true | 0 |  | HIGH |
| `POST /billing/invoices/:invoice/void` | `voidInvoice` | true | 0 |  | HIGH |
| `POST /billing/merchant-accounts` | `createMerchantAccount` | true | 0 |  | HIGH |
| `GET /billing/merchant-accounts/:merchantAccount` | `getMerchantAccount` | true | 1 |  | HIGH |
| `POST /billing/merchant-accounts/:merchantAccount/dashboard` | `getMerchantDashboard` | true | 0 |  | HIGH |
| `POST /billing/merchant-accounts/:merchantAccount/onboard` | `onboardMerchantAccount` | true | 0 |  | HIGH |
| `POST /billing/webhooks/stripe` | `handleStripeWebhook` | ? | 0 |  | HIGH |
| `POST /booking/bookings` | `createBooking` | true | 1 |  | HIGH |
| `GET /booking/bookings` | `listBookings` | true | 1 |  | HIGH |
| `GET /booking/bookings/:booking` | `getBooking` | true | 1 |  | HIGH |
| `POST /booking/bookings/:booking/cancel` | `cancelBooking` | true | 1 |  | HIGH |
| `POST /booking/bookings/:booking/confirm` | `confirmBooking` | true | 1 |  | HIGH |
| `POST /booking/bookings/:booking/no-show` | `markNoShowBooking` | true | 0 |  | HIGH |
| `POST /booking/bookings/:booking/reject` | `rejectBooking` | true | 1 |  | HIGH |
| `GET /booking/events` | `listBookingEvents` | true | 1 |  | HIGH |
| `POST /booking/events` | `createBookingEvent` | true | 1 |  | HIGH |
| `GET /booking/events/:event` | `getBookingEvent` | true | 1 |  | HIGH |
| `PATCH /booking/events/:event` | `updateBookingEvent` | true | 1 |  | HIGH |
| `DELETE /booking/events/:event` | `deleteBookingEvent` | true | 0 |  | HIGH |
| `POST /booking/events/:event/exceptions` | `createScheduleException` | true | 0 |  | HIGH |
| `GET /booking/events/:event/exceptions` | `listScheduleExceptions` | true | 0 |  | HIGH |
| `GET /booking/events/:event/exceptions/:exception` | `getScheduleException` | true | 0 |  | HIGH |
| `DELETE /booking/events/:event/exceptions/:exception` | `deleteScheduleException` | true | 0 |  | HIGH |
| `GET /booking/events/:event/slots` | `listEventSlots` | true | 1 |  | HIGH |
| `GET /booking/slots/:slotId` | `getTimeSlot` | true | 1 |  | HIGH |
| `POST /campaigns` | `createCampaign` | true | 0 |  | HIGH |
| `POST /certificates/bulk-issue` | `bulkIssueCertificates` | true | 1 |  | HIGH |
| `GET /certificates/verify/:certificateNumber` | `verifyCertificatePublic` | ? | 0 |  | HIGH |
| `POST /comms/chat-rooms` | `createChatRoom` | true | 1 |  | HIGH |
| `GET /comms/chat-rooms` | `listChatRooms` | true | 1 |  | HIGH |
| `GET /comms/chat-rooms/:room` | `getChatRoom` | true | 0 |  | HIGH |
| `GET /comms/chat-rooms/:room/messages` | `getChatMessages` | true | 1 |  | HIGH |
| `POST /comms/chat-rooms/:room/messages` | `sendChatMessage` | true | 1 |  | HIGH |
| `POST /comms/chat-rooms/:room/video-call/end` | `endVideoCall` | true | 0 |  | HIGH |
| `POST /comms/chat-rooms/:room/video-call/join` | `joinVideoCall` | true | 1 |  | HIGH |
| `POST /comms/chat-rooms/:room/video-call/leave` | `leaveVideoCall` | true | 1 |  | HIGH |
| `PATCH /comms/chat-rooms/:room/video-call/participant` | `updateVideoCallParticipant` | true | 0 |  | HIGH |
| `GET /comms/ice-servers` | `getIceServers` | true | 1 |  | HIGH |
| `GET /communications/announcements/detail/:id` | `getAnnouncement` | true | 0 |  | HIGH |
| `PATCH /communications/announcements/:id` | `updateAnnouncement` | true | 1 |  | HIGH |
| `DELETE /communications/announcements/:id` | `deleteAnnouncement` | true | 0 |  | HIGH |
| `POST /communications/announcements/:id/archive` | `archiveAnnouncement` | true | 0 |  | HIGH |
| `POST /communications/announcements/:id/publish` | `publishAnnouncement` | true | 0 |  | HIGH |
| `POST /communications/announcements/:id/schedule` | `scheduleAnnouncement` | true | 0 |  | HIGH |
| `GET /communications/announcements/:id/stats` | `getAnnouncementStats` | true | 0 |  | HIGH |
| `GET /communications/announcements/:organizationId` | `listAnnouncements` | true | 1 |  | HIGH |
| `POST /communications/announcements/:organizationId` | `createAnnouncement` | true | 0 |  | HIGH |
| `POST /communications/segments` | `createSavedSegment` | true | 1 |  | HIGH |
| `GET /communications/segments` | `listSavedSegments` | true | 1 |  | HIGH |
| `DELETE /communications/segments/:id` | `deleteSavedSegment` | true | 1 |  | HIGH |
| `POST /creatives` | `createCreative` | true | 0 |  | HIGH |
| `POST /creatives/:creativeId/report` | `reportAd` | true | 0 |  | HIGH |
| `POST /creatives/:creativeId/review` | `reviewCreative` | true | 0 |  | HIGH |
| `GET /credit-compliance/:organizationId` | `getCreditCompliance` | true | 0 |  | HIGH |
| `GET /dues/dashboard/:organizationId` | `getDuesDashboard` | true | 0 |  | HIGH |
| `GET /email/queue` | `listEmailQueueItems` | true | 0 |  | HIGH |
| `GET /email/queue/:queue` | `getEmailQueueItem` | true | 0 |  | HIGH |
| `POST /email/queue/:queue/cancel` | `cancelEmailQueueItem` | true | 0 |  | HIGH |
| `POST /email/queue/:queue/retry` | `retryEmailQueueItem` | true | 0 |  | HIGH |
| `GET /email/suppressions` | `listEmailSuppressions` | true | 0 |  | HIGH |
| `GET /email/templates` | `listEmailTemplates` | true | 0 |  | HIGH |
| `POST /email/templates` | `createEmailTemplate` | true | 0 |  | HIGH |
| `GET /email/templates/:template` | `getEmailTemplate` | true | 0 |  | HIGH |
| `PATCH /email/templates/:template` | `updateEmailTemplate` | true | 0 |  | HIGH |
| `POST /email/templates/:template/test` | `testEmailTemplate` | true | 0 |  | HIGH |
| `GET /email/unsubscribe` | `unsubscribeEmailGet` | ? | 0 |  | HIGH |
| `POST /email/unsubscribe` | `unsubscribeEmailPost` | ? | 0 |  | HIGH |
| `POST /invitations/bulk-import` | `bulkImportMembers` | true | 0 |  | HIGH |
| `POST /invite` | `createInvite` | true | 0 |  | HIGH |
| `POST /invite/claim/:token` | `claimInvite` | true | 0 |  | HIGH |
| `GET /invite/validate/:token` | `validateInvite` | ? | 0 |  | HIGH |
| `POST /listings` | `createListing` | true | 0 |  | HIGH |
| `GET /listings` | `listListings` | true | 0 |  | HIGH |
| `GET /membership/applications/:organizationId` | `listOrgApplications` | true | 0 |  | HIGH |
| `GET /membership/members/:organizationId` | `listOrgMembers` | true | 0 |  | HIGH |
| `GET /membership/org-profile/:organizationId` | `getOrgProfile` | true | 0 |  | HIGH |
| `PUT /membership/org-profile/:organizationId` | `updateOrgProfile` | true | 0 |  | HIGH |
| `GET /notifs` | `listNotifications` | true | 1 |  | HIGH |
| `POST /notifs/read-all` | `markAllNotificationsAsRead` | true | 1 |  | HIGH |
| `GET /notifs/:notif` | `getNotification` | true | 0 |  | HIGH |
| `POST /notifs/:notif/read` | `markNotificationAsRead` | true | 0 |  | HIGH |
| `GET /officer-terms/:organizationId` | `listOfficerTermsSummary` | true | 0 |  | HIGH |
| `GET /onboarding/state` | `getOnboardingState` | true | 0 |  | HIGH |
| `PUT /onboarding/step` | `updateOnboardingStep` | true | 0 |  | HIGH |
| `POST /opt-out` | `setMemberOptOut` | true | 0 |  | HIGH |
| `POST /orders` | `createOrder` | true | 0 |  | HIGH |
| `POST /orders/:orderId/fulfill` | `fulfillOrder` | true | 0 |  | HIGH |
| `POST /org/:organizationId/payments/send-link` | `sendPaymentLink` | true | 0 |  | HIGH |
| `GET /org/:organizationId/payments/:paymentId/receipt` | `downloadReceipt` | true | 0 |  | HIGH |
| `POST /pay/:token/checkout` | `checkoutPaymentToken` | ? | 0 |  | HIGH |
| `GET /pay/:token/validate` | `validatePaymentToken` | ? | 0 |  | HIGH |
| `POST /persons` | `createPerson` | true | 1 |  | HIGH |
| `GET /persons` | `listPersons` | true | 0 |  | HIGH |
| `PATCH /persons/me` | `updateMyProfile` | true | 0 |  | HIGH |
| `POST /persons/me/cancel-delete` | `cancelMyAccountDeletion` | true | 1 |  | HIGH |
| `POST /persons/me/credit-entries` | `createMyCreditEntry` | true | 1 |  | HIGH |
| `GET /persons/me/credit-entries` | `listMyCreditEntries` | true | 1 |  | HIGH |
| `GET /persons/me/credit-summary` | `getMyCreditSummary` | true | 1 |  | HIGH |
| `GET /persons/me/credits` | `getMyCredits` | true | 1 |  | HIGH |
| `POST /persons/me/delete` | `requestMyAccountDeletion` | true | 1 |  | HIGH |
| `GET /persons/me/export` | `exportMyData` | true | 1 |  | HIGH |
| `GET /persons/me/memberships` | `getMyMemberships` | true | 1 |  | HIGH |
| `GET /persons/me/notification-preferences` | `getMyNotificationPreferences` | true | 0 |  | HIGH |
| `PATCH /persons/me/notification-preferences` | `updateMyNotificationPreferences` | true | 0 |  | HIGH |
| `GET /persons/me/officer-role/:organizationId` | `getMyOfficerRole` | true | 1 |  | HIGH |
| `GET /persons/me/privacy` | `getMyPrivacySettings` | true | 0 |  | HIGH |
| `PATCH /persons/me/privacy` | `updateMyPrivacySettings` | true | 0 |  | HIGH |
| `GET /persons/:person` | `getPerson` | true | 1 |  | HIGH |
| `PATCH /persons/:person` | `updatePerson` | true | 1 |  | HIGH |
| `GET /placement` | `getAdForPlacement` | true | 0 |  | HIGH |
| `POST /postings` | `createJobPosting` | true | 0 |  | HIGH |
| `GET /postings` | `searchJobPostings` | true | 0 |  | HIGH |
| `GET /postings/:postingId` | `getJobPosting` | true | 0 |  | HIGH |
| `PATCH /postings/:postingId` | `updateJobPosting` | true | 0 |  | HIGH |
| `DELETE /postings/:postingId` | `deleteJobPosting` | true | 0 |  | HIGH |
| `GET /public/events` | `listPublicEvents` | ? | 1 |  | HIGH |
| `GET /public/events/:slug` | `getPublicEvent` | ? | 1 |  | HIGH |
| `GET /public/org/:slug` | `getOrganizationBySlug` | ? | 1 |  | HIGH |
| `GET /public/orgs` | `listPublicOrgs` | ? | 0 |  | HIGH |
| `POST /read-all` | `markAllNotificationsRead` | true | 0 |  | HIGH |
| `POST /reviews/` | `createReview` | true | 0 |  | HIGH |
| `GET /reviews/` | `listReviews` | true | 1 |  | HIGH |
| `GET /reviews/:review` | `getReview` | true | 0 |  | HIGH |
| `DELETE /reviews/:review` | `deleteReview` | true | 0 |  | HIGH |
| `GET /storage/files` | `listFiles` | true | 0 |  | HIGH |
| `POST /storage/files/upload` | `uploadFile` | true | 0 |  | HIGH |
| `GET /storage/files/:file` | `getFile` | true | 0 |  | HIGH |
| `DELETE /storage/files/:file` | `deleteFile` | true | 0 |  | HIGH |
| `POST /storage/files/:file/complete` | `completeFileUpload` | true | 0 |  | HIGH |
| `GET /storage/files/:file/download` | `getFileDownload` | true | 0 |  | HIGH |
| `POST /surveys/` | `createSurvey` | true | 0 |  | HIGH |
| `GET /surveys/` | `listSurveys` | true | 1 |  | HIGH |
| `GET /surveys/analytics/nps-trends` | `getNpsTrends` | true | 1 |  | HIGH |
| `DELETE /surveys/my-responses` | `deleteMemberResponses` | true | 0 |  | HIGH |
| `GET /surveys/:survey` | `getSurvey` | true | 0 |  | HIGH |
| `PATCH /surveys/:survey` | `updateSurvey` | true | 0 |  | HIGH |
| `DELETE /surveys/:survey` | `deleteSurvey` | true | 0 |  | HIGH |
| `GET /surveys/:survey/analytics` | `getSurveyAnalytics` | true | 0 |  | HIGH |
| `POST /surveys/:survey/clone` | `cloneSurvey` | true | 0 |  | HIGH |
| `POST /surveys/:survey/close` | `closeSurvey` | true | 0 |  | HIGH |
| `GET /surveys/:survey/export` | `exportSurveyResponses` | true | 0 |  | HIGH |
| `POST /surveys/:survey/publish` | `publishSurvey` | true | 0 |  | HIGH |
| `POST /surveys/:survey/responses` | `submitSurveyResponse` | true | 0 |  | HIGH |
| `GET /surveys/:survey/responses` | `listSurveyResponses` | true | 0 |  | HIGH |
| `POST /surveys/:survey/responses/dismiss` | `dismissSurveyResponse` | true | 0 |  | HIGH |
| `POST /vendors` | `createVendor` | true | 0 |  | HIGH |
| `GET /vendors` | `listVendors` | true | 0 |  | HIGH |
| `GET /vendors/:vendorId` | `getVendor` | true | 0 |  | HIGH |
| `PATCH /vendors/:vendorId` | `updateVendor` | true | 0 |  | HIGH |
| `POST /vendors/:vendorId/verify` | `verifyVendor` | true | 0 |  | HIGH |
| `GET /communications/announcements/:firstOrgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /credit-compliance/:firstOrgId` | — | ? | 1 | ⚠️ | LOW |
| `POST /notifs/:id/read` | — | ? | 1 | ⚠️ | LOW |
| `GET /persons/me/officer-role/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /public/orgs*` | — | ? | 1 | ⚠️ | LOW |
| `GET /public/org/*` | — | ? | 1 | ⚠️ | LOW |
| `GET /persons/me` | — | ? | 1 | ⚠️ | LOW |
| `GET /pay/*/validate` | — | ? | 1 | ⚠️ | LOW |
| `POST /pay/*/checkout` | — | ? | 1 | ⚠️ | LOW |
| `GET /public/verify/:certificateNumber` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/credentials/lookup/*` | — | ? | 1 | ⚠️ | LOW |
| `GET /verify/*` | — | ? | 1 | ⚠️ | LOW |
| `POST /persons/me/export` | — | ? | 1 | ⚠️ | LOW |
| `GET /membership/members/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /membership/applications/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /dues/dashboard/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `PUT /membership/org-profile/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /comms/messages/search` | — | ? | 1 | ⚠️ | LOW |
| `GET /communications/announcements/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `POST /communications/announcements/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /communications/subscriptions/person` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /association/message-templates/:id` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /association/message-templates/:id` | — | ? | 1 | ⚠️ | LOW |
| `GET /events/my` | — | ? | 1 | ⚠️ | LOW |
| `GET /training/my` | — | ? | 1 | ⚠️ | LOW |
| `GET /notifications/my` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/directory/:personId/public` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/credits` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/chapters` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/professional-licenses` | — | ? | 1 | ⚠️ | LOW |
| `POST /surveys/:id/responses` | — | ? | 1 | ⚠️ | LOW |
| `GET /surveys` | — | ? | 1 | ⚠️ | LOW |
| `GET /surveys/:surveyId` | — | ? | 1 | ⚠️ | LOW |
| `POST /surveys/:surveyId/responses` | — | ? | 1 | ⚠️ | LOW |
| `POST /surveys` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /surveys/:id` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /surveys/:id` | — | ? | 1 | ⚠️ | LOW |
| `POST /surveys/:id/clone` | — | ? | 1 | ⚠️ | LOW |
| `GET /surveys/:surveyId/responses` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /association/member/directory/profiles/:id` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/aging-buckets/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /communications/announcements/detail/:announcementId` | — | ? | 1 | ⚠️ | LOW |
| `GET /certificates/verify/*` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/compliance/:orgId*` | — | ? | 1 | ⚠️ | LOW |
| `POST /association/member/compliance/:orgId/refresh` | — | ? | 1 | ⚠️ | LOW |
| `POST /communications/announcements/:announcementId/publish` | — | ? | 1 | ⚠️ | LOW |
| `POST /communications/announcements/:announcementId/archive` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /communications/announcements/:announcementId` | — | ? | 1 | ⚠️ | LOW |
| `GET /communications/announcements/detail/:edit` | — | ? | 1 | ⚠️ | LOW |
| `GET /communications/announcements` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/dues-metrics/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /credit-compliance/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/cpd-config/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /association/member/cpd-config/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `GET /accredited-providers/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `POST /accredited-providers/:orgId` | — | ? | 1 | ⚠️ | LOW |
| `PATCH /accredited-providers/:orgId/:id` | — | ? | 1 | ⚠️ | LOW |
| `DELETE /accredited-providers/:orgId/:id` | — | ? | 1 | ⚠️ | LOW |
| `GET /communications/templates/:edit` | — | ? | 1 | ⚠️ | LOW |
| `GET /association/member/dues-member-summary/:orgId/:memberId` | — | ? | 1 | ⚠️ | LOW |
<!-- oli:regen:code-api-surface:end -->
