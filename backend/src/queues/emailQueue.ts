import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { EmailJob, EmailJobData } from "../types";

export const EMAIL_QUEUE_NAME = "email-send";

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
});

/**
 * Schedules a BullMQ delayed job for an existing email_jobs row.
 *
 * jobId = dbRow.id is the whole idempotency story: BullMQ refuses to add a
 * second job under a jobId that already exists (waiting/delayed/active), so
 * calling this twice for the same DB row is always safe and never produces
 * a duplicate send.
 */
export async function scheduleEmailJob(dbRow: Pick<EmailJob, "id" | "scheduled_at">): Promise<void> {
  const delay = Math.max(0, new Date(dbRow.scheduled_at).getTime() - Date.now());

  await emailQueue.add(
    "send-email",
    { emailJobId: dbRow.id },
    {
      jobId: dbRow.id,
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 },
    }
  );
}
