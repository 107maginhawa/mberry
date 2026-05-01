/**
 * Handler registry - maps operationIds to handler functions
 * This file is regenerated on each run
 */

import { createDocumentTag } from '../../handlers/documents/createDocumentTag';
import { listDocumentTags } from '../../handlers/documents/listDocumentTags';
import { getDocumentTag } from '../../handlers/documents/getDocumentTag';
import { updateDocumentTag } from '../../handlers/documents/updateDocumentTag';
import { deleteDocumentTag } from '../../handlers/documents/deleteDocumentTag';
import { createDocument } from '../../handlers/documents/createDocument';
import { searchDocuments } from '../../handlers/documents/searchDocuments';
import { getDocument } from '../../handlers/documents/getDocument';
import { updateDocument } from '../../handlers/documents/updateDocument';
import { deleteDocument } from '../../handlers/documents/deleteDocument';
import { getDocumentAccessLog } from '../../handlers/documents/getDocumentAccessLog';
import { archiveDocument } from '../../handlers/documents/archiveDocument';
import { uploadNewDocumentVersion } from '../../handlers/documents/uploadNewDocumentVersion';
import { listDocumentVersions } from '../../handlers/documents/listDocumentVersions';
import { getDocumentVersion } from '../../handlers/documents/getDocumentVersion';
import { createEvent } from '../../handlers/association:operations/createEvent';
import { searchEvents } from '../../handlers/association:operations/searchEvents';
import { createCheckIn } from '../../handlers/association:operations/createCheckIn';
import { searchCheckIns } from '../../handlers/association:operations/searchCheckIns';
import { createEventRegistration } from '../../handlers/association:operations/createEventRegistration';
import { searchEventRegistrations } from '../../handlers/association:operations/searchEventRegistrations';
import { getEventRegistration } from '../../handlers/association:operations/getEventRegistration';
import { updateEventRegistration } from '../../handlers/association:operations/updateEventRegistration';
import { deleteEventRegistration } from '../../handlers/association:operations/deleteEventRegistration';
import { cancelEventRegistration } from '../../handlers/association:operations/cancelEventRegistration';
import { refundEventRegistration } from '../../handlers/association:operations/refundEventRegistration';
import { getEvent } from '../../handlers/association:operations/getEvent';
import { updateEvent } from '../../handlers/association:operations/updateEvent';
import { deleteEvent } from '../../handlers/association:operations/deleteEvent';
import { cancelEvent } from '../../handlers/association:operations/cancelEvent';
import { publishEvent } from '../../handlers/association:operations/publishEvent';
import { listWaitlistEntries } from '../../handlers/association:operations/listWaitlistEntries';
import { promoteWaitlistEntry } from '../../handlers/association:operations/promoteWaitlistEntry';
import { createTraining } from '../../handlers/association:operations/createTraining';
import { searchTrainings } from '../../handlers/association:operations/searchTrainings';
import { createCourse } from '../../handlers/association:operations/createCourse';
import { searchCourses } from '../../handlers/association:operations/searchCourses';
import { createCourseEnrollment } from '../../handlers/association:operations/createCourseEnrollment';
import { searchCourseEnrollments } from '../../handlers/association:operations/searchCourseEnrollments';
import { getCourseEnrollment } from '../../handlers/association:operations/getCourseEnrollment';
import { updateCourseEnrollment } from '../../handlers/association:operations/updateCourseEnrollment';
import { deleteCourseEnrollment } from '../../handlers/association:operations/deleteCourseEnrollment';
import { updateCourseProgress } from '../../handlers/association:operations/updateCourseProgress';
import { createQuizAttempt } from '../../handlers/association:operations/createQuizAttempt';
import { searchQuizAttempts } from '../../handlers/association:operations/searchQuizAttempts';
import { getCourse } from '../../handlers/association:operations/getCourse';
import { updateCourse } from '../../handlers/association:operations/updateCourse';
import { deleteCourse } from '../../handlers/association:operations/deleteCourse';
import { createTrainingEnrollment } from '../../handlers/association:operations/createTrainingEnrollment';
import { searchTrainingEnrollments } from '../../handlers/association:operations/searchTrainingEnrollments';
import { getTrainingEnrollment } from '../../handlers/association:operations/getTrainingEnrollment';
import { updateTrainingEnrollment } from '../../handlers/association:operations/updateTrainingEnrollment';
import { deleteTrainingEnrollment } from '../../handlers/association:operations/deleteTrainingEnrollment';
import { completeTrainingEnrollment } from '../../handlers/association:operations/completeTrainingEnrollment';
import { getTraining } from '../../handlers/association:operations/getTraining';
import { updateTraining } from '../../handlers/association:operations/updateTraining';
import { deleteTraining } from '../../handlers/association:operations/deleteTraining';
import { publishTraining } from '../../handlers/association:operations/publishTraining';
import { createAffiliationTransfer } from '../../handlers/association:member/createAffiliationTransfer';
import { listAffiliationTransfers } from '../../handlers/association:member/listAffiliationTransfers';
import { getAffiliationTransfer } from '../../handlers/association:member/getAffiliationTransfer';
import { approveTransferBySource } from '../../handlers/association:member/approveTransferBySource';
import { approveTransferByTarget } from '../../handlers/association:member/approveTransferByTarget';
import { completeAffiliationTransfer } from '../../handlers/association:member/completeAffiliationTransfer';
import { denyAffiliationTransfer } from '../../handlers/association:member/denyAffiliationTransfer';
import { getAgingBucket } from '../../handlers/association:member/getAgingBucket';
import { recalculateAgingBucket } from '../../handlers/association:member/recalculateAgingBucket';
import { createMembershipApplication } from '../../handlers/association:member/createMembershipApplication';
import { listMembershipApplications } from '../../handlers/association:member/listMembershipApplications';
import { getMembershipApplication } from '../../handlers/association:member/getMembershipApplication';
import { updateMembershipApplication } from '../../handlers/association:member/updateMembershipApplication';
import { deleteMembershipApplication } from '../../handlers/association:member/deleteMembershipApplication';
import { approveMembershipApplication } from '../../handlers/association:member/approveMembershipApplication';
import { denyMembershipApplication } from '../../handlers/association:member/denyMembershipApplication';
import { createChapterAffiliation } from '../../handlers/association:member/createChapterAffiliation';
import { listChapterAffiliations } from '../../handlers/association:member/listChapterAffiliations';
import { getChapterAffiliation } from '../../handlers/association:member/getChapterAffiliation';
import { updateChapterAffiliation } from '../../handlers/association:member/updateChapterAffiliation';
import { deleteChapterAffiliation } from '../../handlers/association:member/deleteChapterAffiliation';
import { setPrimaryChapterAffiliation } from '../../handlers/association:member/setPrimaryChapterAffiliation';
import { createCredentialTemplate } from '../../handlers/association:member/createCredentialTemplate';
import { listCredentialTemplates } from '../../handlers/association:member/listCredentialTemplates';
import { getCredentialTemplate } from '../../handlers/association:member/getCredentialTemplate';
import { updateCredentialTemplate } from '../../handlers/association:member/updateCredentialTemplate';
import { deleteCredentialTemplate } from '../../handlers/association:member/deleteCredentialTemplate';
import { listDigitalCredentials } from '../../handlers/association:member/listDigitalCredentials';
import { issueDigitalCredential } from '../../handlers/association:member/issueDigitalCredential';
import { verifyCredentialPublic } from '../../handlers/association:member/verifyCredentialPublic';
import { verifyDigitalCredentialAuthenticated } from '../../handlers/association:member/verifyDigitalCredentialAuthenticated';
import { getDigitalCredential } from '../../handlers/association:member/getDigitalCredential';
import { updateDigitalCredential } from '../../handlers/association:member/updateDigitalCredential';
import { deleteDigitalCredential } from '../../handlers/association:member/deleteDigitalCredential';
import { revokeDigitalCredential } from '../../handlers/association:member/revokeDigitalCredential';
import { createDirectoryProfile } from '../../handlers/association:member/createDirectoryProfile';
import { listDirectoryProfiles } from '../../handlers/association:member/listDirectoryProfiles';
import { getDirectoryProfile } from '../../handlers/association:member/getDirectoryProfile';
import { updateDirectoryProfile } from '../../handlers/association:member/updateDirectoryProfile';
import { deleteDirectoryProfile } from '../../handlers/association:member/deleteDirectoryProfile';
import { searchDirectory } from '../../handlers/association:member/searchDirectory';
import { getPublicDirectoryProfile } from '../../handlers/association:member/getPublicDirectoryProfile';
import { createDuesConfig } from '../../handlers/association:member/createDuesConfig';
import { listDuesConfigs } from '../../handlers/association:member/listDuesConfigs';
import { getDuesConfig } from '../../handlers/association:member/getDuesConfig';
import { updateDuesConfig } from '../../handlers/association:member/updateDuesConfig';
import { deleteDuesConfig } from '../../handlers/association:member/deleteDuesConfig';
import { createDuesInvoice } from '../../handlers/association:member/createDuesInvoice';
import { listDuesInvoices } from '../../handlers/association:member/listDuesInvoices';
import { generateDuesInvoicesForOrg } from '../../handlers/association:member/generateDuesInvoicesForOrg';
import { getDuesInvoice } from '../../handlers/association:member/getDuesInvoice';
import { updateDuesInvoice } from '../../handlers/association:member/updateDuesInvoice';
import { deleteDuesInvoice } from '../../handlers/association:member/deleteDuesInvoice';
import { markDuesInvoicePaid } from '../../handlers/association:member/markDuesInvoicePaid';
import { listDunningEvents } from '../../handlers/association:member/listDunningEvents';
import { runDunning } from '../../handlers/association:member/runDunning';
import { createDunningTemplate } from '../../handlers/association:member/createDunningTemplate';
import { listDunningTemplates } from '../../handlers/association:member/listDunningTemplates';
import { getDunningTemplate } from '../../handlers/association:member/getDunningTemplate';
import { updateDunningTemplate } from '../../handlers/association:member/updateDunningTemplate';
import { deleteDunningTemplate } from '../../handlers/association:member/deleteDunningTemplate';
import { createInstitutionalMembership } from '../../handlers/association:member/createInstitutionalMembership';
import { listInstitutionalMemberships } from '../../handlers/association:member/listInstitutionalMemberships';
import { getInstitutionalMembership } from '../../handlers/association:member/getInstitutionalMembership';
import { updateInstitutionalMembership } from '../../handlers/association:member/updateInstitutionalMembership';
import { deleteInstitutionalMembership } from '../../handlers/association:member/deleteInstitutionalMembership';
import { allocateSeat } from '../../handlers/association:member/allocateSeat';
import { listSeatAllocations } from '../../handlers/association:member/listSeatAllocations';
import { revokeSeat } from '../../handlers/association:member/revokeSeat';
import { listLicenseRenewalAlerts } from '../../handlers/association:member/listLicenseRenewalAlerts';
import { acknowledgeLicenseRenewalAlert } from '../../handlers/association:member/acknowledgeLicenseRenewalAlert';
import { createProfessionalLicense } from '../../handlers/association:member/createProfessionalLicense';
import { listProfessionalLicenses } from '../../handlers/association:member/listProfessionalLicenses';
import { getProfessionalLicense } from '../../handlers/association:member/getProfessionalLicense';
import { updateProfessionalLicense } from '../../handlers/association:member/updateProfessionalLicense';
import { deleteProfessionalLicense } from '../../handlers/association:member/deleteProfessionalLicense';
import { createMembership } from '../../handlers/association:member/createMembership';
import { listMemberships } from '../../handlers/association:member/listMemberships';
import { getMembership } from '../../handlers/association:member/getMembership';
import { updateMembership } from '../../handlers/association:member/updateMembership';
import { deleteMembership } from '../../handlers/association:member/deleteMembership';
import { reinstateMembership } from '../../handlers/association:member/reinstateMembership';
import { renewMembership } from '../../handlers/association:member/renewMembership';
import { terminateMembership } from '../../handlers/association:member/terminateMembership';
import { createRoyaltySplit } from '../../handlers/association:member/createRoyaltySplit';
import { listRoyaltySplits } from '../../handlers/association:member/listRoyaltySplits';
import { getRoyaltySplit } from '../../handlers/association:member/getRoyaltySplit';
import { updateRoyaltySplit } from '../../handlers/association:member/updateRoyaltySplit';
import { deleteRoyaltySplit } from '../../handlers/association:member/deleteRoyaltySplit';
import { createMembershipTier } from '../../handlers/association:member/createMembershipTier';
import { listMembershipTiers } from '../../handlers/association:member/listMembershipTiers';
import { getMembershipTier } from '../../handlers/association:member/getMembershipTier';
import { updateMembershipTier } from '../../handlers/association:member/updateMembershipTier';
import { deleteMembershipTier } from '../../handlers/association:member/deleteMembershipTier';
import { createMessageTemplate } from '../../handlers/communication/createMessageTemplate';
import { searchMessageTemplates } from '../../handlers/communication/searchMessageTemplates';
import { getMessageTemplate } from '../../handlers/communication/getMessageTemplate';
import { updateMessageTemplate } from '../../handlers/communication/updateMessageTemplate';
import { deleteMessageTemplate } from '../../handlers/communication/deleteMessageTemplate';
import { previewMessageTemplate } from '../../handlers/communication/previewMessageTemplate';
import { createMessage } from '../../handlers/communication/createMessage';
import { searchMessages } from '../../handlers/communication/searchMessages';
import { getMessage } from '../../handlers/communication/getMessage';
import { updateMessage } from '../../handlers/communication/updateMessage';
import { deleteMessage } from '../../handlers/communication/deleteMessage';
import { cancelMessage } from '../../handlers/communication/cancelMessage';
import { scheduleMessage } from '../../handlers/communication/scheduleMessage';
import { sendMessage } from '../../handlers/communication/sendMessage';
import { listPersonSubscriptions } from '../../handlers/communication/listPersonSubscriptions';
import { bulkUpdatePersonSubscriptions } from '../../handlers/communication/bulkUpdatePersonSubscriptions';
import { updatePersonSubscription } from '../../handlers/communication/updatePersonSubscription';
import { createSubscriptionTopic } from '../../handlers/communication/createSubscriptionTopic';
import { getSubscriptionTopic } from '../../handlers/communication/getSubscriptionTopic';
import { updateSubscriptionTopic } from '../../handlers/communication/updateSubscriptionTopic';
import { deleteSubscriptionTopic } from '../../handlers/communication/deleteSubscriptionTopic';
import { listAuditLogs } from '../../handlers/audit/listAuditLogs';
import { createInvoice } from '../../handlers/billing/createInvoice';
import { listInvoices } from '../../handlers/billing/listInvoices';
import { getInvoice } from '../../handlers/billing/getInvoice';
import { updateInvoice } from '../../handlers/billing/updateInvoice';
import { deleteInvoice } from '../../handlers/billing/deleteInvoice';
import { captureInvoicePayment } from '../../handlers/billing/captureInvoicePayment';
import { finalizeInvoice } from '../../handlers/billing/finalizeInvoice';
import { markInvoiceUncollectible } from '../../handlers/billing/markInvoiceUncollectible';
import { payInvoice } from '../../handlers/billing/payInvoice';
import { refundInvoicePayment } from '../../handlers/billing/refundInvoicePayment';
import { voidInvoice } from '../../handlers/billing/voidInvoice';
import { createMerchantAccount } from '../../handlers/billing/createMerchantAccount';
import { getMerchantAccount } from '../../handlers/billing/getMerchantAccount';
import { getMerchantDashboard } from '../../handlers/billing/getMerchantDashboard';
import { onboardMerchantAccount } from '../../handlers/billing/onboardMerchantAccount';
import { handleStripeWebhook } from '../../handlers/billing/handleStripeWebhook';
import { createBooking } from '../../handlers/booking/createBooking';
import { listBookings } from '../../handlers/booking/listBookings';
import { getBooking } from '../../handlers/booking/getBooking';
import { cancelBooking } from '../../handlers/booking/cancelBooking';
import { confirmBooking } from '../../handlers/booking/confirmBooking';
import { markNoShowBooking } from '../../handlers/booking/markNoShowBooking';
import { rejectBooking } from '../../handlers/booking/rejectBooking';
import { listBookingEvents } from '../../handlers/booking/listBookingEvents';
import { createBookingEvent } from '../../handlers/booking/createBookingEvent';
import { getBookingEvent } from '../../handlers/booking/getBookingEvent';
import { updateBookingEvent } from '../../handlers/booking/updateBookingEvent';
import { deleteBookingEvent } from '../../handlers/booking/deleteBookingEvent';
import { createScheduleException } from '../../handlers/booking/createScheduleException';
import { listScheduleExceptions } from '../../handlers/booking/listScheduleExceptions';
import { getScheduleException } from '../../handlers/booking/getScheduleException';
import { deleteScheduleException } from '../../handlers/booking/deleteScheduleException';
import { listEventSlots } from '../../handlers/booking/listEventSlots';
import { getTimeSlot } from '../../handlers/booking/getTimeSlot';
import { createChatRoom } from '../../handlers/comms/createChatRoom';
import { listChatRooms } from '../../handlers/comms/listChatRooms';
import { getChatRoom } from '../../handlers/comms/getChatRoom';
import { getChatMessages } from '../../handlers/comms/getChatMessages';
import { sendChatMessage } from '../../handlers/comms/sendChatMessage';
import { endVideoCall } from '../../handlers/comms/endVideoCall';
import { joinVideoCall } from '../../handlers/comms/joinVideoCall';
import { leaveVideoCall } from '../../handlers/comms/leaveVideoCall';
import { updateVideoCallParticipant } from '../../handlers/comms/updateVideoCallParticipant';
import { getIceServers } from '../../handlers/comms/getIceServers';
import { listEmailQueueItems } from '../../handlers/email/listEmailQueueItems';
import { getEmailQueueItem } from '../../handlers/email/getEmailQueueItem';
import { cancelEmailQueueItem } from '../../handlers/email/cancelEmailQueueItem';
import { retryEmailQueueItem } from '../../handlers/email/retryEmailQueueItem';
import { listEmailTemplates } from '../../handlers/email/listEmailTemplates';
import { createEmailTemplate } from '../../handlers/email/createEmailTemplate';
import { getEmailTemplate } from '../../handlers/email/getEmailTemplate';
import { updateEmailTemplate } from '../../handlers/email/updateEmailTemplate';
import { testEmailTemplate } from '../../handlers/email/testEmailTemplate';
import { listNotifications } from '../../handlers/notifs/listNotifications';
import { markAllNotificationsAsRead } from '../../handlers/notifs/markAllNotificationsAsRead';
import { getNotification } from '../../handlers/notifs/getNotification';
import { markNotificationAsRead } from '../../handlers/notifs/markNotificationAsRead';
import { createPerson } from '../../handlers/person/createPerson';
import { listPersons } from '../../handlers/person/listPersons';
import { getPerson } from '../../handlers/person/getPerson';
import { updatePerson } from '../../handlers/person/updatePerson';
import { createReview } from '../../handlers/reviews/createReview';
import { listReviews } from '../../handlers/reviews/listReviews';
import { getReview } from '../../handlers/reviews/getReview';
import { deleteReview } from '../../handlers/reviews/deleteReview';
import { listFiles } from '../../handlers/storage/listFiles';
import { uploadFile } from '../../handlers/storage/uploadFile';
import { getFile } from '../../handlers/storage/getFile';
import { deleteFile } from '../../handlers/storage/deleteFile';
import { completeFileUpload } from '../../handlers/storage/completeFileUpload';
import { getFileDownload } from '../../handlers/storage/getFileDownload';

export const registry = {
  // Documents handlers
  createDocumentTag,
  listDocumentTags,
  getDocumentTag,
  updateDocumentTag,
  deleteDocumentTag,
  createDocument,
  searchDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  getDocumentAccessLog,
  archiveDocument,
  uploadNewDocumentVersion,
  listDocumentVersions,
  getDocumentVersion,

  // Association:operations handlers
  createEvent,
  searchEvents,
  createCheckIn,
  searchCheckIns,
  createEventRegistration,
  searchEventRegistrations,
  getEventRegistration,
  updateEventRegistration,
  deleteEventRegistration,
  cancelEventRegistration,
  refundEventRegistration,
  getEvent,
  updateEvent,
  deleteEvent,
  cancelEvent,
  publishEvent,
  listWaitlistEntries,
  promoteWaitlistEntry,
  createTraining,
  searchTrainings,
  createCourse,
  searchCourses,
  createCourseEnrollment,
  searchCourseEnrollments,
  getCourseEnrollment,
  updateCourseEnrollment,
  deleteCourseEnrollment,
  updateCourseProgress,
  createQuizAttempt,
  searchQuizAttempts,
  getCourse,
  updateCourse,
  deleteCourse,
  createTrainingEnrollment,
  searchTrainingEnrollments,
  getTrainingEnrollment,
  updateTrainingEnrollment,
  deleteTrainingEnrollment,
  completeTrainingEnrollment,
  getTraining,
  updateTraining,
  deleteTraining,
  publishTraining,

  // Association:member handlers
  createAffiliationTransfer,
  listAffiliationTransfers,
  getAffiliationTransfer,
  approveTransferBySource,
  approveTransferByTarget,
  completeAffiliationTransfer,
  denyAffiliationTransfer,
  getAgingBucket,
  recalculateAgingBucket,
  createMembershipApplication,
  listMembershipApplications,
  getMembershipApplication,
  updateMembershipApplication,
  deleteMembershipApplication,
  approveMembershipApplication,
  denyMembershipApplication,
  createChapterAffiliation,
  listChapterAffiliations,
  getChapterAffiliation,
  updateChapterAffiliation,
  deleteChapterAffiliation,
  setPrimaryChapterAffiliation,
  createCredentialTemplate,
  listCredentialTemplates,
  getCredentialTemplate,
  updateCredentialTemplate,
  deleteCredentialTemplate,
  listDigitalCredentials,
  issueDigitalCredential,
  verifyCredentialPublic,
  verifyDigitalCredentialAuthenticated,
  getDigitalCredential,
  updateDigitalCredential,
  deleteDigitalCredential,
  revokeDigitalCredential,
  createDirectoryProfile,
  listDirectoryProfiles,
  getDirectoryProfile,
  updateDirectoryProfile,
  deleteDirectoryProfile,
  searchDirectory,
  getPublicDirectoryProfile,
  createDuesConfig,
  listDuesConfigs,
  getDuesConfig,
  updateDuesConfig,
  deleteDuesConfig,
  createDuesInvoice,
  listDuesInvoices,
  generateDuesInvoicesForOrg,
  getDuesInvoice,
  updateDuesInvoice,
  deleteDuesInvoice,
  markDuesInvoicePaid,
  listDunningEvents,
  runDunning,
  createDunningTemplate,
  listDunningTemplates,
  getDunningTemplate,
  updateDunningTemplate,
  deleteDunningTemplate,
  createInstitutionalMembership,
  listInstitutionalMemberships,
  getInstitutionalMembership,
  updateInstitutionalMembership,
  deleteInstitutionalMembership,
  allocateSeat,
  listSeatAllocations,
  revokeSeat,
  listLicenseRenewalAlerts,
  acknowledgeLicenseRenewalAlert,
  createProfessionalLicense,
  listProfessionalLicenses,
  getProfessionalLicense,
  updateProfessionalLicense,
  deleteProfessionalLicense,
  createMembership,
  listMemberships,
  getMembership,
  updateMembership,
  deleteMembership,
  reinstateMembership,
  renewMembership,
  terminateMembership,
  createRoyaltySplit,
  listRoyaltySplits,
  getRoyaltySplit,
  updateRoyaltySplit,
  deleteRoyaltySplit,
  createMembershipTier,
  listMembershipTiers,
  getMembershipTier,
  updateMembershipTier,
  deleteMembershipTier,

  // Communication handlers
  createMessageTemplate,
  searchMessageTemplates,
  getMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  previewMessageTemplate,
  createMessage,
  searchMessages,
  getMessage,
  updateMessage,
  deleteMessage,
  cancelMessage,
  scheduleMessage,
  sendMessage,
  listPersonSubscriptions,
  bulkUpdatePersonSubscriptions,
  updatePersonSubscription,
  createSubscriptionTopic,
  getSubscriptionTopic,
  updateSubscriptionTopic,
  deleteSubscriptionTopic,

  // Audit handlers
  listAuditLogs,

  // Billing handlers
  createInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  captureInvoicePayment,
  finalizeInvoice,
  markInvoiceUncollectible,
  payInvoice,
  refundInvoicePayment,
  voidInvoice,
  createMerchantAccount,
  getMerchantAccount,
  getMerchantDashboard,
  onboardMerchantAccount,
  handleStripeWebhook,

  // Booking handlers
  createBooking,
  listBookings,
  getBooking,
  cancelBooking,
  confirmBooking,
  markNoShowBooking,
  rejectBooking,
  listBookingEvents,
  createBookingEvent,
  getBookingEvent,
  updateBookingEvent,
  deleteBookingEvent,
  createScheduleException,
  listScheduleExceptions,
  getScheduleException,
  deleteScheduleException,
  listEventSlots,
  getTimeSlot,

  // Comms handlers
  createChatRoom,
  listChatRooms,
  getChatRoom,
  getChatMessages,
  sendChatMessage,
  endVideoCall,
  joinVideoCall,
  leaveVideoCall,
  updateVideoCallParticipant,
  getIceServers,

  // Email handlers
  listEmailQueueItems,
  getEmailQueueItem,
  cancelEmailQueueItem,
  retryEmailQueueItem,
  listEmailTemplates,
  createEmailTemplate,
  getEmailTemplate,
  updateEmailTemplate,
  testEmailTemplate,

  // Notifs handlers
  listNotifications,
  markAllNotificationsAsRead,
  getNotification,
  markNotificationAsRead,

  // Person handlers
  createPerson,
  listPersons,
  getPerson,
  updatePerson,

  // Reviews handlers
  createReview,
  listReviews,
  getReview,
  deleteReview,

  // Storage handlers
  listFiles,
  uploadFile,
  getFile,
  deleteFile,
  completeFileUpload,
  getFileDownload,

};