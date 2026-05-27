/**
 * Trial Expiry Monitor — runs daily.
 *
 * Finds subscriptions where status='trial' AND trialEndsAt < NOW().
 * Sets status to 'expired' (no auto-charge in v1 — require manual conversion).
 * Notifies org officers via in-app notification.
 *
 * UJ-M03 subscription lifecycle.
 */

import { and, eq, lt, sql } from "drizzle-orm";
import type { JobContext, JobScheduler } from "@/core/jobs";
import { officerTerms } from "@/handlers/association:member/repos/governance.schema";
import { notifications } from "@/handlers/notifs/repos/notification.schema";
import { platformAdmins, subscriptions } from "../repos/platform-admin.schema";

const PLATFORM_ORG_ID = "00000000-0000-0000-0000-000000000000";

export function registerTrialExpiryMonitor(scheduler: JobScheduler): void {
	scheduler.registerCron(
		"platformadmin.trialExpiryMonitor",
		"0 6 * * *",
		async (context: JobContext) => {
			const { db, logger, jobId } = context;
			logger.debug({ jobId }, "Trial expiry monitor starting");

			try {
				const now = new Date();

				// Find all expired trials
				const expiredTrials = await db
					.select()
					.from(subscriptions)
					.where(
						and(
							eq(subscriptions.status, "trial"),
							lt(subscriptions.trialEndsAt, now),
						),
					);

				if (expiredTrials.length === 0) {
					logger.debug({ jobId }, "No expired trials found");
					return;
				}

				logger.info(
					{ jobId, count: expiredTrials.length },
					"Found expired trials — marking as expired",
				);

				let processedCount = 0;
				let notifiedCount = 0;

				for (const sub of expiredTrials) {
					try {
						// Mark as expired
						await db
							.update(subscriptions)
							.set({
								status: "expired",
								updatedAt: now,
							})
							.where(eq(subscriptions.id, sub.id));

						processedCount++;

						// Find officers for this org to notify
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
									title: "Trial period expired",
									message:
										"Your organization's trial period has ended. Upgrade your subscription to continue using all features.",
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
									"Failed to send trial expiry notification",
								);
							}
						}
					} catch (err) {
						logger.error(
							{ err, subscriptionId: sub.id },
							"Failed to process expired trial",
						);
					}
				}

				logger.info(
					{ jobId, processedCount, notifiedCount },
					"Trial expiry monitor completed",
				);
			} catch (error) {
				logger.error({ error, jobId }, "Trial expiry monitor failed");
				throw error;
			}
		},
	);
}
