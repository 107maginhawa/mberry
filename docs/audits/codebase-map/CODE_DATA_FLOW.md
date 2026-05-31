# Code Data Flow

<!-- oli:regen:code-data-flow:begin -->
| Component | Props From | Events To | Store Reads | Store Writes | API Calls |
|---|---|---|---|---|---|
| `AlertDialogHeader` | AccountSettingsPage, ActiveBookingCard, ConfirmDialog | — | — | — | — |
| `AlertDialogFooter` | AccountSettingsPage, ActiveBookingCard, ConfirmDialog | — | — | — | — |
| `Badge` | AnalyticsDashboardPage, AudiencePicker, BookingList, CategoryEditor, ConnectionStatus, FinancialMembersPage, GatewaySetup, HostDirectory, InstitutionalMembershipDetailPage, InstitutionalMembershipTable, JoinPage, MemberDetail, MemberFinancialDetailPage, MemberTable, MyIdCard, OrgIconRail, OrgPickerSheet, PaymentDetailPage, PendingProofsList, ReportResults, SeatManagementPanel, SentHistoryPage, SpecialAssessmentsList, TemplateForm, TemplateList, VerifyCertificatePage, VerifyCredentialPage | — | — | — | — |
| `Calendar` | AssociationDetailPage, ConfirmPage, DashboardPage, DatePicker, DateRangePicker, DateTimePicker, DiscoverEvents, DocumentDetail, DuesStatusCard, EventCard, EventDetail, HostDirectory, MyCalendar, MyEvents, OrgEvents, OrgHome, OrgSettingsForm, PersonalInfoForm, PublicEventPage, QuickActions, TrainingCard, TrainingDetail | — | — | — | — |
| `CalendarDayButton` | — | — | — | — | — |
| `CommandDialog` | — | — | — | — | — |
| `CommandShortcut` | — | — | — | — | — |
| `DialogHeader` | CategoryEditor, CreateChannelDialog, GatewaySetup, ImageCropperDialog, InstitutionalMembershipDetailPage, MemberDetail, MyOrganizationsPage, OfficerManagement, RecordPaymentForm, RefundForm, SeatManagementPanel, SpecialAssessmentsList, SurveyBuilder | — | — | — | — |
| `DialogFooter` | CategoryEditor, CreateChannelDialog, GatewaySetup, ImageCropperDialog, InstitutionalMembershipDetailPage, MemberDetail, MyOrganizationsPage, OfficerManagement, RecordPaymentForm, RefundForm, SeatManagementPanel, SpecialAssessmentsList | — | — | — | — |
| `DropdownMenuShortcut` | — | — | — | — | — |
| `FormField` | AddressForm, ContactInfoForm, PersonalInfoForm, PreferencesForm, RecordPaymentForm | — | — | — | — |
| `useFormField` | — | — | — | — | — |
| `SheetHeader` | NotificationDrawer, OfficerMobileNav, OrgPickerSheet | — | — | — | — |
| `SheetFooter` | — | — | — | — | — |
| `Skeleton` | AnnouncementList, AttendanceView, BookingWidgetSkeleton, CategoryEditor, ChannelList, ChatView, DateSelectionSkeleton, DmList, DocumentBrowser, DocumentLibrary, DuesConfigForm, DuesInvoiceList, EditElection, ElectionDetail, ElectionList, EventList, FinancesAssessmentsPage, FinancialDashboard, FinancialMembersPage, FundsPage, GatewaySetup, InstitutionalMembershipDetailPage, InstitutionalMembershipTable, InvoiceDetailPage, InvoicesPage, JoinPage, MemberAnnouncementFeed, MemberDocumentDetailPage, MemberDuesPage, MemberElectionDetail, MemberElectionList, MemberFinancialDetailPage, MemberTable, MessageSearch, NomineePickerDialog, NpsTrendChart, OfficerReviews, OrgSettingsForm, PaymentHistoryTable, RecentActivityFeed, ReportResults, SeatManagementPanel, SpecialAssessmentsList, SurveyList, SurveyResults, ThreadPanel, TimeSlotsSkeleton, VotingBallot | — | — | — | — |
| `CardSkeleton` | CertificateList, CertificatePreview, CpdSettings, CreditReport, DashboardPage, DirectorySearch, GovernancePage, MemberDashboard, MyCpdDashboard, MyCredits, MyTraining, OfficerCompliance, OfficerDashboard, OrgTraining, PaymentDetailPage, TrustDirectory | — | — | — | — |
| `TableSkeleton` | CreditReport, DocumentDetail, EventDetail, MyCredits, OfficerManagement, ProvidersPage, TemplateList | — | — | — | — |
| `StatCardSkeleton` | — | — | — | — | — |
| `ErrorState` | BookingDetailPage, ConfirmPage, FinancialMembersPage, HostPage, JoinPage, MemberAnnouncementFeed, MemberDuesPage, MemberFinancialDetailPage, OfficerCompliance, OrganizationDetailPage, OrganizationsPage | BookingDetailPage, ConfirmPage, FinancialMembersPage, HostPage, JoinPage, MemberAnnouncementFeed, MemberDuesPage, MemberFinancialDetailPage, OfficerCompliance, OrganizationDetailPage, OrganizationsPage | — | — | — |
| `useAdminUser` | — | — | — | — | — |
| `RequireRole` | CommunicationsBroadcasts, CompliancePage, EmailHealth, ModerationQueue, PlatformTemplates, VerificationsPage | — | — | — | — |
| `RootComponent` | — | — | — | — | — |
| `DashboardPage` | — | — | — | — | — |
| `Combobox` | PreferencesForm, RecordPaymentForm | — | — | — | — |
| `ImageCropperDialog` | PersonalInfoForm | PersonalInfoForm | — | — | — |
| `NotificationDrawer` | — | — | — | — | — |
| `useDetectCountry` | — | — | — | — | — |
| `useDetectLanguage` | — | — | — | — | — |
| `useDetectTimezone` | — | — | — | — | — |
| `useFormatDate` | — | — | — | — | — |
| `useMutationFeedback` | — | — | — | — | — |
| `useFinancialStanding` | — | — | — | — | — |
| `useMyOrgs` | — | — | — | — | — |
| `useOrg` | — | — | — | — | — |
| `useOrgContext` | — | — | — | — | — |
| `OrgProvider` | OrgLayout | — | — | — | — |
| `useOrgProvider` | — | — | — | — | — |
| `useOrgProviderOptional` | — | — | — | — | — |
| `AuthenticatedLayout` | — | — | — | — | — |
| `JoinPage` | — | — | — | — | — |
| `OnboardingPage` | — | — | — | — | — |
| `VerifyEmailPage` | — | — | — | — | — |
| `useFileUpload` | — | — | — | — | — |
| `useAuthClient` | — | — | — | — | — |
| `ApiProvider` | — | — | — | — | — |
| `useOptimisticMutation` | — | — | — | — | — |
| `useDirtyPatch` | — | — | — | — | — |
| `useDirtyValues` | — | — | — | — | — |
| `AssociationDetailPage` | — | — | — | — | GET /api/admin/national-dashboard/:associationId |
| `AssociationsPage` | — | — | — | — | — |
| `EmailHealth` | — | — | — | — | — |
| `CommunicationsBroadcasts` | — | — | — | — | — |
| `ModerationQueue` | — | — | — | — | — |
| `PlatformTemplates` | — | — | — | — | — |
| `CompliancePage` | — | — | — | — | — |
| `MemberDetailPage` | — | — | — | — | — |
| `MembersPage` | — | — | — | — | — |
| `OrganizationDetailPage` | — | — | — | — | POST /api/admin/organizations/:organizationId/transition |
| `OrganizationsPage` | — | — | — | — | — |
| `VerificationsPage` | — | — | — | — | — |
| `MemberBottomNav` | AuthenticatedLayout | — | — | — | — |
| `MemberHeader` | AuthenticatedLayout | — | — | — | — |
| `MemberSidebar` | AuthenticatedLayout | — | — | — | — |
| `OfficerMobileNav` | OfficerLayout | — | — | — | — |
| `OfficerSidebar` | OfficerLayout | — | — | — | — |
| `OrgIconRail` | AuthenticatedLayout | — | — | — | — |
| `OrgPickerSheet` | MemberHeader | MemberHeader | — | — | — |
| `CountUp` | CreditBreakdown, CreditReport, DashboardKpiCard, DashboardPage, FinancialDashboard, FundsPage, GovernancePage, MemberDuesPage, MetricCard, MyCredits, MyEvents, MyTraining | — | — | — | — |
| `GlassCard` | AnalyticsDashboardPage, AnnouncementContent, AnnouncementDetailPage, ApplicationList, ArrearsBreakdown, BillingSchedulePreview, CategoriesPage, CertificateList, CertificatePreview, ChannelList, ChaptersSettingsPage, ChatView, CollectionsAreaChart, CpdSettings, CredentialList, CreditBreakdown, CreditLog, CreditReport, DashboardKpiCard, DataExport, DeliveryFunnel, DirectorySearch, DiscoverEvents, DmList, DocumentDetail, DocumentLibrary, DuesSchedulePage, DuesSetupChecklist, DuesStatusCard, EditElection, ElectionDetailLayout, EventAttendance, EventCard, EventDetail, FinancialDashboard, FinancialMembersPage, FinancialReportsPage, FundsPage, GatewaySettingsPage, GovernancePage, InvoiceDetailPage, InvoicesPage, MemberAnnouncementFeed, MemberDetail, MemberDocumentDetailPage, MemberDocumentsPage, MemberDuesPage, MemberElectionDetailPage, MemberElectionsPage, MemberFinancialDetailPage, MemberProfile, MessageSearch, MetricCard, MetricCardSkeleton, ModuleSummaryCard, MyCpdDashboard, MyCredits, MyEvents, MyIdCard, MyPaymentsPage, MyProfilePage, MySurveys, MyTraining, NewAnnouncementPage, NewElection, NewEvent, NewTemplatePage, NewTraining, NotificationInbox, NotificationPreferences, OfficerCertificates, OfficerCompliance, OfficerManagement, OfficerPaymentsPage, OrgAnnouncements, OrgEvents, OrgHome, OrgSettingsPage, OrgTraining, PaymentDetailPage, PaymentHistoryTable, PaymentScheduleTimeline, PendingProofsList, PostEventActions, ProvidersPage, PublicEventPage, RecentActivityFeed, RecordPaymentPage, RosterImportPage, SentHistoryPage, TemplateList, TemplatePreview, TemplateSplitEditor, ThreadPanel, TrainingAttendance, TrainingDetail, TrustCard, VideoLobby, VotePage | — | — | — | — |
| `StaggerGrid` | CertificateList, CreditReport, DashboardPage, DiscoverEvents, FinancialDashboard, FundsPage, GovernancePage, MemberDuesPage, MyCredits, MyEvents, MyOrganizationsPage, MySurveys, MyTraining, OfficerDashboard, OrgEvents, OrgHome, OrgTraining | — | — | — | — |
| `StaggerItem` | CertificateList, CreditReport, DashboardPage, DiscoverEvents, FinancialDashboard, FundsPage, GovernancePage, MemberDuesPage, MyCredits, MyEvents, MyOrganizationsPage, MySurveys, MyTraining, OfficerDashboard, OrgEvents, OrgHome, OrgTraining | — | — | — | — |
| `useSpringTransition` | — | — | — | — | — |
| `AvatarInitials` | FinancialMembersPage, MemberHeader, MemberTable, MyOrganizationsPage, MyProfilePage, OrgIconRail, OrgPickerSheet | — | — | — | — |
| `ConfirmDialog` | BookingDetailPage, DocumentLibrary, EventList, MyOrganizationsPage, PostEventActions, TrainingList | BookingDetailPage, DocumentLibrary, EventList, MyOrganizationsPage, PostEventActions, TrainingList | — | — | — |
| `DataTable` | — | — | — | — | — |
| `DatePicker` | CreditLog, FinancialReportsPage, OrgSettingsForm, RecordPaymentForm | CreditLog, FinancialReportsPage, OrgSettingsForm, RecordPaymentForm | — | — | — |
| `DateTimePicker` | ComposeForm, ElectionForm, EventForm, SurveyBuilder, TrainingForm | ComposeForm, ElectionForm, EventForm, SurveyBuilder, TrainingForm | — | — | — |
| `DateRangePicker` | — | — | — | — | — |
| `EmptyState` | AnnouncementDetailPage, ApplicationList, CertificateList, ChannelList, CreditBreakdown, CreditReport, DashboardPage, DirectorySearch, DiscoverEvents, DmIndexPage, DmList, DuesInvoiceList, EventAttendance, FinancialMembersPage, InvoicesPage, MemberAnnouncementFeed, MemberAnnouncementPage, MemberDashboard, MemberDuesPage, MessagesIndexPage, MyCredits, MyEvents, MyIdCard, MyOrganizationsPage, MyProfilePage, MySurveys, MyTraining, NotificationInbox, OfficerManagement, OfficerMessagesPage, OfficerReviews, OrgAnnouncements, OrgEvents, OrgHome, OrgTraining, PaymentHistoryTable, PendingProofsList, ProvidersPage, PublicEventPage, TemplateList, TrainingAttendance, TrustDirectory | — | — | — | — |
| `PageHeader` | AnalyticsDashboardPage, AnnouncementDetailPage, ApplicationsPage, CategoriesPage, CertificateDetail, ChaptersSettingsPage, CpdSettings, CreditLog, CreditReport, DashboardPage, DataExportPage, DirectoryPage, DiscoverEvents, DmIndexPage, DocumentDetail, DuesSchedulePage, EditElection, ElectionDetailLayout, EventAttendance, EventDetail, FinancesAssessmentsPage, FinancesOverviewPage, FinancialMembersPage, FinancialReportsPage, FundsPage, GatewaySettingsPage, GovernancePage, InstitutionalMembershipDetailPage, InstitutionalMembershipsPage, InvoiceDetailPage, InvoicesPage, MemberAnnouncementFeed, MemberAnnouncementPage, MemberDetail, MemberDocumentDetailPage, MemberDocumentsPage, MemberDuesPage, MemberElectionDetailPage, MemberElectionsPage, MemberFinancialDetailPage, MemberProfilePage, MembersDirectoryPage, MessagesIndexPage, MyCalendar, MyCertificates, MyCpdDashboard, MyCredits, MyEvents, MyIdCard, MyNotificationsPage, MyOrganizationsPage, MyPaymentsPage, MyProfilePage, MySettingsPage, MySurveys, MyTraining, NewAnnouncementPage, NewElection, NewEvent, NewInstitutionalMembershipPage, NewSurveyPage, NewTemplatePage, NewTraining, NotificationsPage, OfficerCertificates, OfficerCommunications, OfficerCompliance, OfficerDashboard, OfficerDocuments, OfficerElections, OfficerEvents, OfficerMessagesPage, OfficerPaymentsPage, OfficerReviews, OfficersPage, OfficerSurveys, OfficerTraining, OrgEvents, OrgHome, OrgSettingsPage, OrgTraining, PaymentDetailPage, ProvidersPage, PublicEventPage, RecordPaymentPage, RosterImportPage, RosterPage, SentHistoryPage, SurveyDetailPage, TemplateListPage, TrainingAttendance, TrainingDetail, VotePage | — | — | — | — |
| `ListSkeleton` | AnalyticsDashboardPage, AnnouncementDetailPage, ApplicationList, EventAttendance, MemberAnnouncementPage, MemberProfile, MyOrganizationsPage, NotificationInbox, OrgHome, PendingProofsList, SentHistoryPage, TrainingAttendance, TrainingDetail | — | — | — | — |
| `ProfileSkeleton` | MemberDetail, MyProfilePage | — | — | — | — |
| `StatCard` | CommunicationsBroadcasts, EventList, PostEventActions | — | — | — | — |
| `StatusBadge` | ElectionList, EventDetail, MemberProfile, MembershipList, MyOrganizationsPage, MyProfilePage, SurveyList | — | — | — | — |
| `AuthPage` | — | — | — | — | — |
| `DiscoverEvents` | — | — | — | — | — |
| `PublicEventPage` | — | — | — | — | — |
| `InvitePage` | — | — | — | — | — |
| `PublicOrgProfile` | — | — | — | — | — |
| `PublicPaymentPage` | — | — | — | — | — |
| `VerifyCertificatePage` | — | — | — | — | — |
| `VerifyCredentialPage` | — | — | — | — | — |
| `PublicVerification` | — | — | — | — | — |
| `useSession` | — | — | — | — | — |
| `usePrefetchSession` | — | — | — | — | — |
| `useToken` | — | — | — | — | — |
| `useListAccounts` | — | — | — | — | — |
| `useListSessions` | — | — | — | — | — |
| `useListDeviceSessions` | — | — | — | — | — |
| `useListPasskeys` | — | — | — | — | — |
| `useUpdateUser` | — | — | — | — | — |
| `useUnlinkAccount` | — | — | — | — | — |
| `useRevokeOtherSessions` | — | — | — | — | — |
| `useRevokeSession` | — | — | — | — | — |
| `useRevokeSessions` | — | — | — | — | — |
| `useSetActiveSession` | — | — | — | — | — |
| `useRevokeDeviceSession` | — | — | — | — | — |
| `useDeletePasskey` | — | — | — | — | — |
| `useAuthQuery` | — | — | — | — | — |
| `useAuthMutation` | — | — | — | — | — |
| `useSignOut` | — | — | — | — | — |
| `useEmailVerification` | — | — | — | — | — |
| `DataExport` | DataExportPage | — | — | — | — |
| `OfficerDashboard` | OfficerDashboardPage | — | — | — | — |
| `OfficerManagement` | OfficersPage | — | — | — | — |
| `OrgSettingsForm` | OrgSettingsPage | — | — | — | — |
| `MerchantAccountSetup` | BillingPage | BillingPage | — | — | — |
| `ActiveBookingCard` | BookingDetailPage | BookingDetailPage | — | — | — |
| `BookingEventEditor` | SchedulePage | — | — | — | — |
| `BookingList` | BookingsPage | — | — | — | — |
| `BookingWidgetSkeleton` | — | — | — | — | — |
| `TimeSlotsSkeleton` | — | — | — | — | — |
| `DateSelectionSkeleton` | — | — | — | — | — |
| `BookingWidget` | HostPage | HostPage | — | — | — |
| `HostDirectory` | BookingsPage | — | — | — | — |
| `CertificateList` | MyCertificates | — | — | — | — |
| `CertificatePreview` | CertificateDetail | — | — | — | — |
| `AffiliationList` | ChaptersSettingsPage | — | — | — | — |
| `CallControls` | VideoCallUI, VideoGrid | VideoCallUI, VideoGrid | — | — | — |
| `ChannelList` | MessagesIndexPage, OfficerMessagesPage | MessagesIndexPage, OfficerMessagesPage | — | — | — |
| `ChatThread` | BookingDetailPage | — | — | — | — |
| `ChatView` | DmIndexPage, MessagesIndexPage, OfficerMessagesPage | — | — | — | — |
| `ConnectionStatus` | VideoCallUI, VideoGrid | — | — | — | — |
| `CreateChannelDialog` | OfficerMessagesPage | OfficerMessagesPage | — | — | — |
| `DmList` | DmIndexPage | DmIndexPage | — | — | — |
| `MessageBubble` | ChatView, ThreadPanel | ChatView | — | — | — |
| `MessageComposer` | ChatView, ThreadPanel | ChatView, ThreadPanel | — | — | — |
| `MessageReactions` | MessageBubble | MessageBubble | — | — | — |
| `MessageSearch` | — | — | — | — | — |
| `ThreadPanel` | ChatView | ChatView | — | — | — |
| `TypingIndicator` | ChatView | — | — | — | — |
| `VideoCallPanel` | BookingDetailPage | — | — | — | — |
| `VideoCallUI` | VideoCallPanel | VideoCallPanel | — | — | — |
| `VideoGrid` | — | — | — | — | — |
| `VideoLobby` | — | — | — | — | — |
| `VideoTile` | VideoCallUI, VideoGrid, VideoLobby | — | — | — | — |
| `useChatWebSocket` | — | — | — | — | — |
| `useMediaStream` | — | — | — | — | — |
| `useUnreadCounts` | — | — | — | — | — |
| `useVideoCall` | — | — | — | — | — |
| `AnnouncementContent` | MemberAnnouncementPage | — | — | — | — |
| `AnnouncementList` | OfficerCommunications | — | — | — | — |
| `AudiencePicker` | — | — | — | — | — |
| `ComposeForm` | NewAnnouncementPage | — | — | — | — |
| `DeliveryFunnel` | AnalyticsDashboardPage | — | — | — | — |
| `NotificationPreferences` | MyNotificationsPage | — | — | — | — |
| `TemplateForm` | NewTemplatePage | NewTemplatePage | — | — | — |
| `TemplateList` | TemplateListPage | TemplateListPage | — | — | — |
| `TemplatePreview` | TemplateForm | — | — | — | — |
| `TemplateSplitEditor` | — | — | — | — | — |
| `ActionWidget` | DashboardPage | — | — | — | — |
| `CreditRing` | CreditBreakdown, DashboardPage | — | — | — | — |
| `AlertBanner` | DashboardPage, FinancesOverviewPage | — | — | — | — |
| `CreditBreakdown` | DashboardPage | — | — | — | — |
| `MemberDashboard` | — | — | — | — | — |
| `OrgAnnouncements` | DashboardPage | — | — | — | — |
| `QuickActions` | DashboardPage | — | — | — | — |
| `DirectoryFilters` | TrustDirectory | TrustDirectory | — | — | — |
| `DirectorySearch` | MembersDirectoryPage | — | — | — | — |
| `MemberProfile` | MemberProfilePage | — | — | — | — |
| `TrustCard` | TrustDirectory | — | — | — | — |
| `TrustDirectory` | DirectoryPage | — | — | — | — |
| `DocumentBrowser` | MemberDocumentsPage | — | — | — | — |
| `DocumentLibrary` | OfficerDocuments | — | — | — | — |
| `ArrearsBreakdown` | MemberDuesPage | — | — | — | — |
| `BillingSchedulePreview` | — | — | — | — | — |
| `CollectionRateCard` | — | — | — | — | — |
| `CollectionsAreaChart` | FinancesOverviewPage | — | — | — | — |
| `DuesConfigForm` | DuesSchedulePage | — | — | — | — |
| `DuesGateBanner` | — | — | — | — | — |
| `DuesInvoiceList` | — | — | — | — | — |
| `DuesSetupChecklist` | — | — | — | — | — |
| `DuesStatusBadge` | DuesInvoiceList, InvoiceDetailPage, InvoicesPage, MemberDuesPage, MemberFinancialDetailPage, PaymentHistoryTable | — | — | — | — |
| `DuesStatusCard` | MemberDuesPage | MemberDuesPage | — | — | — |
| `FinancialDashboard` | OfficerPaymentsPage | — | — | — | — |
| `FundAllocationEditor` | FundsPage | FundsPage | — | — | — |
| `FundAllocationPreview` | RecordPaymentForm | — | — | — | — |
| `GatewaySetup` | GatewaySettingsPage | — | — | — | — |
| `MetricCard` | FinancesOverviewPage | — | — | — | — |
| `MetricCardSkeleton` | FinancesOverviewPage | — | — | — | — |
| `MonthlyTrendChart` | — | — | — | — | — |
| `PaymentHistoryTable` | MyPaymentsPage, OfficerPaymentsPage | — | — | — | — |
| `PaymentScheduleTimeline` | MemberDuesPage | — | — | — | — |
| `PendingProofsList` | OfficerPaymentsPage | — | — | — | — |
| `ProofUploadForm` | MemberDuesPage | — | — | — | POST /api/storage/files |
| `RecentActivityFeed` | FinancesOverviewPage | — | — | — | — |
| `RecordPaymentForm` | RecordPaymentPage | — | — | — | — |
| `RefundForm` | PaymentDetailPage | — | — | — | — |
| `ReportResults` | FinancialReportsPage | — | — | — | — |
| `ReportSelector` | FinancialReportsPage | FinancialReportsPage | — | — | — |
| `SpecialAssessmentsList` | FinancesAssessmentsPage | — | — | — | — |
| `StatusDistributionChart` | — | — | — | — | — |
| `TopUnpaidList` | — | — | — | — | — |
| `ElectionDetail` | ElectionDetailLayout | — | — | — | — |
| `ElectionForm` | EditElection, NewElection | EditElection, NewElection | — | — | — |
| `ElectionList` | OfficerElections | — | — | — | — |
| `ElectionTimeline` | ElectionDetail, MemberElectionDetail | — | — | — | — |
| `MemberElectionDetail` | MemberElectionDetailPage | — | — | — | — |
| `MemberElectionList` | MemberElectionsPage | — | — | — | — |
| `NomineePickerDialog` | ElectionDetail | ElectionDetail | — | — | — |
| `SelfNominationDialog` | MemberElectionDetail | MemberElectionDetail | — | — | — |
| `VotingBallot` | VotePage | — | — | — | — |
| `AttendanceView` | EventDetail | — | — | — | — |
| `EventCalendar` | MyCalendar | — | — | — | — |
| `EventCard` | EventList, OrgEvents | EventList | — | — | — |
| `EventForm` | EventDetail, NewEvent | EventDetail, NewEvent | — | — | — |
| `EventList` | OfficerEvents | — | — | — | — |
| `EventTimeline` | — | — | — | — | — |
| `PostEventActions` | — | — | — | — | POST /api/association/member/credits/void-event |
| `ApplicationList` | ApplicationsPage | — | — | — | POST /api/association/member/applications/bulk-approve |
| `CategoryEditor` | CategoriesPage | — | — | — | — |
| `CredentialList` | MemberDetail | — | — | — | — |
| `InstitutionalMembershipForm` | InstitutionalMembershipDetailPage, NewInstitutionalMembershipPage | InstitutionalMembershipDetailPage, NewInstitutionalMembershipPage | — | — | — |
| `InstitutionalMembershipTable` | InstitutionalMembershipsPage | — | — | — | — |
| `MemberDetail` | MemberDetailPage | — | — | — | — |
| `MemberTable` | RosterPage | — | — | — | — |
| `MembershipList` | — | — | — | — | — |
| `SeatManagementPanel` | InstitutionalMembershipDetailPage | — | — | — | — |
| `NotificationInbox` | NotificationsPage | — | — | — | — |
| `AddressForm` | AccountSettingsPage, OnboardingPage | AccountSettingsPage, OnboardingPage | — | — | — |
| `ContactInfoForm` | AccountSettingsPage | AccountSettingsPage | — | — | — |
| `PersonalInfoForm` | AccountSettingsPage, OnboardingPage | AccountSettingsPage, OnboardingPage | — | — | — |
| `PreferencesForm` | AccountSettingsPage | AccountSettingsPage | — | — | — |
| `StandingMeter` | MyProfilePage | MyProfilePage | — | — | — |
| `TrustBadges` | MyProfilePage | — | — | — | — |
| `NpsGauge` | SurveyResults | — | — | — | — |
| `NpsModal` | NpsProvider | NpsProvider | — | — | — |
| `NpsProvider` | — | — | — | — | — |
| `NpsTrendChart` | — | — | — | — | — |
| `PollCard` | — | — | — | — | — |
| `QuestionEditor` | SurveyBuilder | SurveyBuilder | — | — | — |
| `SurveyBuilder` | NewSurveyPage | NewSurveyPage | — | — | — |
| `SurveyFlow` | SurveyBuilder | — | — | — | — |
| `SurveyList` | OfficerSurveys | — | — | — | — |
| `SurveyResults` | SurveyDetailPage | — | — | — | — |
| `SurveyTemplates` | NewSurveyPage | NewSurveyPage | — | — | — |
| `usePendingNps` | — | — | — | — | — |
| `useSurveyDraft` | — | — | — | — | — |
| `CompletionTable` | TrainingDetail | — | — | — | — |
| `TrainingCard` | TrainingList | TrainingList | — | — | — |
| `TrainingForm` | NewTraining, TrainingDetail | — | — | — | — |
| `TrainingList` | OfficerTraining | — | — | — | — |
| `BillingPage` | — | — | — | — | — |
| `MyCalendar` | — | — | — | — | — |
| `DataExportPage` | — | — | — | — | — |
| `MyEvents` | — | — | — | — | — |
| `MyIdCard` | — | — | — | — | — |
| `NotificationsPage` | — | — | — | — | — |
| `MyOrganizationsPage` | — | — | — | — | — |
| `MyPaymentsPage` | — | — | — | — | — |
| `MyProfilePage` | — | — | — | — | — |
| `SchedulePage` | — | — | — | — | — |
| `MySettingsPage` | — | — | — | — | — |
| `MyTraining` | — | — | — | — | — |
| `AccountSettingsPage` | — | — | — | — | — |
| `SecuritySettingsPage` | — | — | — | — | — |
| `ActionQueue` | OfficerDashboard | — | — | — | — |
| `DashboardKpiCard` | OfficerDashboard | — | — | — | — |
| `ModuleSummaryCard` | OfficerDashboard | — | — | — | — |
| `ChoiceQuestion` | — | — | — | — | — |
| `NpsQuestion` | — | — | — | — | — |
| `RatingQuestion` | — | — | — | — | — |
| `TextQuestion` | — | — | — | — | — |
| `YesNoQuestion` | — | — | — | — | — |
| `BookingDetailPage` | — | — | — | — | — |
| `ConfirmPage` | — | — | — | — | — |
| `HostPage` | — | — | — | — | — |
| `BookingsPage` | — | — | — | — | — |
| `CertificateDetail` | — | — | — | — | — |
| `MyCertificates` | — | — | — | — | — |
| `MyCredits` | — | — | — | — | — |
| `CreditLog` | — | — | — | — | — |
| `SurveyDetailPage` | — | — | — | — | — |
| `MySurveys` | — | — | — | — | — |
| `DirectoryPage` | — | — | — | — | — |
| `MemberDuesPage` | — | — | — | — | — |
| `OrgHome` | — | — | — | — | — |
| `MembersDirectoryPage` | — | — | — | — | — |
| `MyCpdDashboard` | — | — | — | — | — |
| `MyNotificationsPage` | — | — | — | — | — |
| `OfficerLayout` | — | — | — | — | — |
| `OrgLayout` | — | — | — | — | — |
| `MemberAnnouncementPage` | — | — | — | — | — |
| `MemberAnnouncementFeed` | — | — | — | — | — |
| `MemberProfilePage` | — | — | — | — | — |
| `MemberDocumentDetailPage` | — | — | — | — | — |
| `MemberDocumentsPage` | — | — | — | — | — |
| `MemberElectionsPage` | — | — | — | — | — |
| `EventDetail` | — | — | — | — | — |
| `OrgEvents` | — | — | — | — | — |
| `GovernancePage` | — | — | — | — | — |
| `MessagesIndexPage` | — | — | — | — | — |
| `ApplicationsPage` | — | — | — | — | — |
| `OfficerCertificates` | — | — | — | — | — |
| `OfficerCompliance` | — | — | — | — | — |
| `OfficerDashboardPage` | — | — | — | — | — |
| `OfficersPage` | — | — | — | — | — |
| `TrainingDetail` | — | — | — | — | — |
| `OrgTraining` | — | — | — | — | — |
| `MemberElectionDetailPage` | — | — | — | — | — |
| `VotePage` | — | — | — | — | — |
| `DmIndexPage` | — | — | — | — | — |
| `AnnouncementDetailPage` | — | — | — | — | — |
| `AnalyticsDashboardPage` | — | — | — | — | — |
| `OfficerCommunications` | — | — | — | — | — |
| `NewAnnouncementPage` | — | — | — | — | — |
| `SentHistoryPage` | — | — | — | — | — |
| `DocumentDetail` | — | — | — | — | — |
| `OfficerDocuments` | — | — | — | — | — |
| `ElectionDetailLayout` | — | — | — | — | — |
| `OfficerElections` | — | — | — | — | — |
| `NewElection` | — | — | — | — | — |
| `OfficerEvents` | — | — | — | — | — |
| `NewEvent` | — | — | — | — | — |
| `FinancesAssessmentsPage` | — | — | — | — | — |
| `DuesSchedulePage` | — | — | — | — | — |
| `FundsPage` | — | — | — | — | — |
| `FinancesOverviewPage` | — | — | — | — | — |
| `InvoicesPage` | — | — | — | — | — |
| `FinancialMembersPage` | — | — | — | — | — |
| `InstitutionalMembershipDetailPage` | — | — | — | — | — |
| `InstitutionalMembershipsPage` | — | — | — | — | — |
| `NewInstitutionalMembershipPage` | — | — | — | — | — |
| `OfficerMessagesPage` | — | — | — | — | — |
| `PaymentDetailPage` | — | — | — | — | — |
| `OfficerPaymentsPage` | — | — | — | — | — |
| `RecordPaymentPage` | — | — | — | — | — |
| `CreditReport` | — | — | — | — | — |
| `FinancialReportsPage` | — | — | — | — | — |
| `OfficerReviews` | — | — | — | — | — |
| `RosterImportPage` | — | — | — | — | — |
| `RosterPage` | — | — | — | — | — |
| `ChaptersSettingsPage` | — | — | — | — | — |
| `CpdSettings` | — | — | — | — | — |
| `GatewaySettingsPage` | — | — | — | — | — |
| `CategoriesPage` | — | — | — | — | — |
| `OrgSettingsPage` | — | — | — | — | — |
| `ProvidersPage` | — | — | — | — | — |
| `OfficerSurveys` | — | — | — | — | — |
| `NewSurveyPage` | — | — | — | — | — |
| `OfficerTraining` | — | — | — | — | — |
| `NewTraining` | — | — | — | — | — |
| `TemplateListPage` | — | — | — | — | — |
| `NewTemplatePage` | — | — | — | — | — |
| `EditElection` | — | — | — | — | — |
| `EventAttendance` | — | — | — | — | — |
| `InvoiceDetailPage` | — | — | — | — | — |
| `MemberFinancialDetailPage` | — | — | — | — | — |
| `TrainingAttendance` | — | — | — | — | — |
<!-- oli:regen:code-data-flow:end -->
