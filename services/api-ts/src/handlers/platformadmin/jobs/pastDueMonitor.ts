/**
 * Past Due Monitor — runs daily.
 *
 * Finds subscriptions WHERE status='past_due' AND currentPeriodEnd < NOW() - 14 days.
 * Sets status to 'cancelled'.
 * Notifies org officers via in-app notification.
 *
 * UJ-M03 subscription lifecycle.
 */

import { and, eq, lt } from "drizzle-orm";
import type { JobContext, JobScheduler } from "@/core/jobs";
import { officerTerms } from "@/handlers/association:member/repos/governance.schema";
import { notifications } from "@/handlers/notifs/repos/notification.schema";
import { subscriptions } from "../repos/platform-admin.schema";

export function registerPastDueMonitor(scheduler: JobScheduler): void {
	scheduler.registerCron(
		"platformadmin.pastDueMonitor",
		"0 7 * * *",
		async (context: JobContext) => {
			const { db, logger, jobId } = context;
			logger.debug({ jobId }, "Past due monitor starting");

			try {
				const now = new Date();
				// 14-day grace period: cancel if past_due AND currentPeriodEnd was 14+ days ago
				const gracePeriodCutoff = new Date(
					now.getTime() - 14 * 24 * 60 * 60 * 1000,
				);

				const pastDueSubs = await db
					.select()
					.from(subscriptions)
					.where(
						and(
							eq(subscriptions.status, "past_due"),
							lt(subscriptions.currentPeriodEnd, gracePeriodCutoff),
						),
					);

				if (pastDueSubs.length === 0) {
					logger.debug({ jobId }, "No subscriptions past 14-day grace period");
					return;
				}

				logger.info(
					{ jobId, count: pastDueSubs.length },
					"Found past-due subscriptions past grace period — cancelling",
				);

				let processedCount = 0;
				let notifiedCount = 0;

				for (const sub of pastDueSubs) {
					try {
						await db
							.update(subscriptions)
							.set({
								status: "cancelled",
								cancelledAt: now,
								cancelReason: "Auto-cancelled after 14 days past due",
								updatedAt: now,
							})
							.where(eq(subscriptions.id, sub.id));

						processedCount++;

						// Notify org officers
						const officers = await db
							.select({ personId: officerTerms.personId })
							.from(officerTerms)
							.where(
								and(
									eq(officerTerms.organizationId, sub.organizationId),
									eq(officerTerms.status, "active"),
								),
							);

						for (const officer of officers) {
							try {
								await db.insert(notifications).values({
									organizationId: sub.organizationId,
									recipient: officer.personId,
									type: "system",
									channel: "in-app",
									title: "Subscription cancelled due to non-payment",
									message:
										"Your organization's subscription has been cancelled after 14 days of failed payment. Please update your payment method to reactivate.",
									status: "sent",
									sentAt: now,
									relatedEntityType: "subscription",
									relatedEntity: sub.id,
									consentValidated: false,
								});
								notifiedCount++;
							} catch (err) {
								logger.error(
									{ err, subscriptionId: sub.id, personId: officer.personId },
									"Failed to send past-due cancellation notification",
								);
							}
						}
					} catch (err) {
						logger.error(
							{ err, subscriptionId: sub.id },
							"Failed to process past-due subscription",
						);
					}
				}

				logger.info(
					{ jobId, processedCount, notifiedCount },
					"Past due monitor completed",
				);
			} catch (error) {
				logger.error({ error, jobId }, "Past due monitor failed");
				throw error;
			}
		},
	);
}
