# Code Route Map

<!-- oli:regen:code-route-map:begin -->
Strategy: `file-based`

| Route | Method | Component | Auth | Params | Module |
|---|---|---|---|---|---|
| `/` | * | — | ? | — | apps/memberry |
| `/_authenticated` | * | AuthenticatedLayout | true | — | apps/memberry |
| `/onboarding` | * | OnboardingPage | true | — | apps/memberry |
| `/verify-email` | * | VerifyEmailPage | true | — | apps/memberry |
| `/associations/$associationId` | * | AssociationDetailPage | ? | associationId | apps/admin |
| `/associations/` | * | AssociationsPage | ? | — | apps/admin |
| `/audit/` | * | — | ? | — | apps/admin |
| `/committees/` | * | — | ? | — | apps/admin |
| `/communications/email` | * | EmailHealth | ? | — | apps/admin |
| `/communications/` | * | CommunicationsBroadcasts | ? | — | apps/admin |
| `/communications/moderation` | * | ModerationQueue | ? | — | apps/admin |
| `/communications/templates` | * | PlatformTemplates | ? | — | apps/admin |
| `/compliance/` | * | CompliancePage | ? | — | apps/admin |
| `/events/` | * | — | ? | — | apps/admin |
| `/feature-flags/` | * | — | ? | — | apps/admin |
| `/impersonate/` | * | — | ? | — | apps/admin |
| `/members/$personId` | * | MemberDetailPage | ? | personId | apps/admin |
| `/members/` | * | MembersPage | ? | — | apps/admin |
| `/national-dashboard/` | * | — | ? | — | apps/admin |
| `/operators/` | * | — | ? | — | apps/admin |
| `/organizations/$organizationId` | * | OrganizationDetailPage | ? | organizationId | apps/admin |
| `/organizations/` | * | OrganizationsPage | ? | — | apps/admin |
| `/training/` | * | — | ? | — | apps/admin |
| `/verifications/` | * | VerificationsPage | ? | — | apps/admin |
| `/_authenticated/dashboard` | * | DashboardPage | true | — | apps/memberry |
| `/auth/$authView` | * | AuthPage | ? | authView | apps/memberry |
| `/discover/events` | * | DiscoverEvents | ? | — | apps/memberry |
| `/events/$eventSlug` | * | PublicEventPage | ? | eventSlug | apps/memberry |
| `/invite/$token` | * | InvitePage | ? | token | apps/memberry |
| `/join/$slug` | * | PublicOrgProfile | ? | slug | apps/memberry |
| `/join/` | * | JoinPage | ? | — | apps/memberry |
| `/pay/$token` | * | PublicPaymentPage | ? | token | apps/memberry |
| `/verify/$certificateNumber` | * | VerifyCertificatePage | ? | certificateNumber | apps/memberry |
| `/verify/$credentialNumber` | * | VerifyCredentialPage | ? | credentialNumber | apps/memberry |
| `/verify/$token` | * | PublicVerification | ? | token | apps/memberry |
| `/_authenticated/my/billing` | * | BillingPage | true | — | apps/memberry |
| `/_authenticated/my/calendar` | * | MyCalendar | true | — | apps/memberry |
| `/_authenticated/my/data-export` | * | DataExportPage | true | — | apps/memberry |
| `/_authenticated/my/events` | * | MyEvents | true | — | apps/memberry |
| `/_authenticated/my/id-card` | * | MyIdCard | true | — | apps/memberry |
| `/_authenticated/my/notifications` | * | NotificationsPage | true | — | apps/memberry |
| `/_authenticated/my/organizations` | * | MyOrganizationsPage | true | — | apps/memberry |
| `/_authenticated/my/payments` | * | MyPaymentsPage | true | — | apps/memberry |
| `/_authenticated/my/profile` | * | MyProfilePage | true | — | apps/memberry |
| `/_authenticated/my/schedule` | * | SchedulePage | true | — | apps/memberry |
| `/_authenticated/my/settings` | * | MySettingsPage | true | — | apps/memberry |
| `/_authenticated/my/training` | * | MyTraining | true | — | apps/memberry |
| `/_authenticated/settings/account` | * | AccountSettingsPage | true | — | apps/memberry |
| `/_authenticated/settings/security` | * | SecuritySettingsPage | true | — | apps/memberry |
| `/_authenticated/my/bookings/$bookingId` | * | BookingDetailPage | true | bookingId | apps/memberry |
| `/_authenticated/my/bookings/host/$personId/$slotId` | * | ConfirmPage | true | personId, slotId | apps/memberry |
| `/_authenticated/my/bookings/host/$personId` | * | HostPage | true | personId | apps/memberry |
| `/_authenticated/my/bookings/` | * | BookingsPage | true | — | apps/memberry |
| `/_authenticated/my/certificates/$certificateId` | * | CertificateDetail | true | certificateId | apps/memberry |
| `/_authenticated/my/certificates/` | * | MyCertificates | true | — | apps/memberry |
| `/_authenticated/my/credits/` | * | MyCredits | true | — | apps/memberry |
| `/_authenticated/my/credits/log` | * | CreditLog | true | — | apps/memberry |
| `/_authenticated/my/surveys/$surveyId` | * | SurveyDetailPage | true | surveyId | apps/memberry |
| `/_authenticated/my/surveys/` | * | MySurveys | true | — | apps/memberry |
| `/_authenticated/org/$orgSlug/directory` | * | DirectoryPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/dues` | * | MemberDuesPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/home` | * | OrgHome | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/members` | * | MembersDirectoryPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/my-cpd` | * | MyCpdDashboard | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/my-notifications` | * | MyNotificationsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer` | * | OfficerLayout | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug` | * | OrgLayout | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/announcements/$announcementId` | * | MemberAnnouncementPage | true | orgSlug, announcementId | apps/memberry |
| `/_authenticated/org/$orgSlug/announcements/` | * | MemberAnnouncementFeed | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/directory/$personId` | * | MemberProfilePage | true | orgSlug, personId | apps/memberry |
| `/_authenticated/org/$orgSlug/documents/$documentId` | * | MemberDocumentDetailPage | true | orgSlug, documentId | apps/memberry |
| `/_authenticated/org/$orgSlug/documents/` | * | MemberDocumentsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/elections/` | * | MemberElectionsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/events/$eventId` | * | EventDetail | true | orgSlug, eventId | apps/memberry |
| `/_authenticated/org/$orgSlug/events/` | * | OrgEvents | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/governance/` | * | GovernancePage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/messages/` | * | MessagesIndexPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/applications` | * | ApplicationsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/certificates` | * | OfficerCertificates | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications` | * | — | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/compliance` | * | OfficerCompliance | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/dashboard` | * | OfficerDashboardPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/officers` | * | OfficersPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/payments` | * | — | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/roster` | * | — | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/training/$trainingId` | * | TrainingDetail | true | orgSlug, trainingId | apps/memberry |
| `/_authenticated/org/$orgSlug/training/` | * | OrgTraining | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/elections/$electionId/` | * | MemberElectionDetailPage | true | orgSlug, electionId | apps/memberry |
| `/_authenticated/org/$orgSlug/elections/$electionId/vote` | * | VotePage | true | orgSlug, electionId | apps/memberry |
| `/_authenticated/org/$orgSlug/messages/dm/` | * | DmIndexPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications/$announcementId` | * | AnnouncementDetailPage | true | orgSlug, announcementId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications/analytics` | * | AnalyticsDashboardPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications/` | * | OfficerCommunications | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications/new` | * | NewAnnouncementPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications/sent` | * | SentHistoryPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/documents/$documentId` | * | DocumentDetail | true | orgSlug, documentId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/documents/` | * | OfficerDocuments | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/dues/assessments` | * | — | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/dues/member/$memberId` | * | — | true | orgSlug, memberId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/dues/treasurer` | * | — | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/elections/$electionId` | * | ElectionDetailLayout | true | orgSlug, electionId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/elections/` | * | OfficerElections | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/elections/new` | * | NewElection | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/events/$eventId` | * | EventDetail | true | orgSlug, eventId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/events/` | * | OfficerEvents | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/events/new` | * | NewEvent | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/assessments` | * | FinancesAssessmentsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/dues` | * | DuesSchedulePage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/funds` | * | FundsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/` | * | FinancesOverviewPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/invoices` | * | InvoicesPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/members` | * | FinancialMembersPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/institutional-memberships/$institutionalMembershipId` | * | InstitutionalMembershipDetailPage | true | orgSlug, institutionalMembershipId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/institutional-memberships/` | * | InstitutionalMembershipsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/institutional-memberships/new` | * | NewInstitutionalMembershipPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/messages/` | * | OfficerMessagesPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/payments/$paymentId` | * | PaymentDetailPage | true | orgSlug, paymentId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/payments/` | * | OfficerPaymentsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/payments/new` | * | RecordPaymentPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/reports/credits` | * | CreditReport | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/reports/financial` | * | FinancialReportsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/reviews/` | * | OfficerReviews | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/roster/$memberId` | * | MemberDetailPage | true | orgSlug, memberId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/roster/import` | * | RosterImportPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/roster/` | * | RosterPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/chapters` | * | ChaptersSettingsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/cpd` | * | CpdSettings | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/dues` | * | — | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/funds` | * | — | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/gateway` | * | GatewaySettingsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/membership-categories` | * | CategoriesPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/org` | * | OrgSettingsPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/settings/providers` | * | ProvidersPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/surveys/$surveyId` | * | SurveyDetailPage | true | orgSlug, surveyId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/surveys/` | * | OfficerSurveys | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/surveys/new` | * | NewSurveyPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/training/$trainingId` | * | TrainingDetail | true | orgSlug, trainingId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/training/` | * | OfficerTraining | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/training/new` | * | NewTraining | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications/templates/` | * | TemplateListPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/communications/templates/new` | * | NewTemplatePage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/elections/$electionId/edit` | * | EditElection | true | orgSlug, electionId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/events/$eventId/attendance` | * | EventAttendance | true | orgSlug, eventId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/invoices/$invoiceId` | * | InvoiceDetailPage | true | orgSlug, invoiceId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/invoices/` | * | InvoicesPage | true | orgSlug | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/finances/members/$memberId` | * | MemberFinancialDetailPage | true | orgSlug, memberId | apps/memberry |
| `/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance` | * | TrainingAttendance | true | orgSlug, trainingId | apps/memberry |
<!-- oli:regen:code-route-map:end -->
