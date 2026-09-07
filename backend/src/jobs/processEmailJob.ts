import { Job, DelayedError } from "bullmq";
import { getEmailJobById, updateEmailJobStatus } from "../db/emailJobs";
import { getSenderById } from "../db/senders";
import { sendEmail } from "../services/email";
import {
  checkAndIncrementSenderHourlyCount,
  claimRateLimitNotification,
  getNextUtcHourStart,
  getStartOfUtcHour,
} from "../services/rateLimiter";
import { sendSlackNotification } from "../services/slack";
import { env } from "../config/env";
import { EmailJobData } from "../types";

/**
 * Sends the real email via Ethereal for a scheduled email_jobs row, subject
 * to the sender's per-hour rate limit.
 *
 * Failure handling note: on a send failure this throws so BullMQ's own
 * retry/backoff (configured on the job in scheduleEmailJob) can re-run it.
 * We record the attempt count and error message here on every failure, but
 * we deliberately do NOT flip status to 'failed' until retries are
 * exhausted (handled in the Worker's 'failed' event in emailWorker.ts) —
 * otherwise our own idempotency guard below ("must be scheduled/delayed")
 * would reject BullMQ's own retry of the same job.
 */
export async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<void> {
  const { emailJobId } = job.data;

  const row = await getEmailJobById(emailJobId);
  if (!row) {
    console.error(`[worker] email_jobs row ${emailJobId} not found — skipping (nothing to send)`);
    return;
  }

  // Idempotency guard: if a previous attempt already got this row to 'sent'
  // (e.g. duplicate processing after a crash-and-redeliver), don't resend.
  if (row.status === "sent") {
    console.log(`[worker] job ${emailJobId} already marked sent — skipping duplicate processing`);
    return;
  }

  if (row.status !== "scheduled" && row.status !== "delayed") {
    console.log(`[worker] job ${emailJobId} has status '${row.status}', not scheduled/delayed — skipping`);
    return;
  }

  const sender = await getSenderById(row.sender_id);
  if (!sender) {
    await updateEmailJobStatus(emailJobId, {
      status: "failed",
      attempts: row.attempts + 1,
      error_message: `Sender ${row.sender_id} not found`,
    });
    return;
  }

  // Only consult the rate limiter on a job's first attempt at sending. If
  // this run is a BullMQ-driven retry after a *send* failure (attemptsMade
  // > 0 — DelayedError reschedules below don't count as failures, so a
  // rate-limited-then-woken-up-next-hour job still looks like attempt 0
  // here, which is correct: it needs to be re-checked against the new
  // hour's count), the job already claimed its slot in the hourly count on
  // the first attempt. Re-running the check here would either double-count
  // it or, worse, wrongly bump it to the next hour just because *other*
  // jobs used up the remaining slots while this one was retrying.
  const hourlyLimit = sender.hourly_limit ?? env.maxEmailsPerHourPerSender;
  const isFirstAttempt = job.attemptsMade === 0;
  const { allowed, count } = isFirstAttempt
    ? await checkAndIncrementSenderHourlyCount(sender.id, hourlyLimit)
    : { allowed: true, count: -1 };

  if (!allowed) {
    // Push this job into the next UTC hour window, preserving its relative
    // position within the hour so ordering among rescheduled jobs is kept.
    const nextHourStart = getNextUtcHourStart(new Date());
    const originalScheduledAt = new Date(row.scheduled_at);
    const millisIntoHour = originalScheduledAt.getTime() - getStartOfUtcHour(originalScheduledAt).getTime();
    const newScheduledAt = new Date(nextHourStart.getTime() + millisIntoHour);

    await updateEmailJobStatus(emailJobId, { status: "delayed", scheduled_at: newScheduledAt });

    // Only the first job to overflow in this sender+hour fires the Slack
    // ping — without this, hundreds of overflowing jobs would each fire one.
    const isFirstToNotify = await claimRateLimitNotification(sender.id);
    if (isFirstToNotify) {
      await sendSlackNotification(
        sender.id,
        `⚠️ Sender ${sender.email} hit its hourly limit (${count}/${hourlyLimit}). Remaining emails have been rescheduled to the next hour window.`
      );
    }

    console.log(`[worker] job ${emailJobId} hit rate limit for sender ${sender.id} — delaying to ${newScheduledAt.toISOString()}`);

    if (!token) {
      throw new Error(`No lock token available to delay job ${emailJobId}`);
    }

    // The BullMQ-native way to reschedule a job from inside its own
    // processor: move it to the delayed set, then throw DelayedError so the
    // Worker treats this as an intentional pause rather than a failure (no
    // 'failed' event, no attempts consumed).
    await job.moveToDelayed(newScheduledAt.getTime(), token);
    throw new DelayedError();
  }

  try {
    const result = await sendEmail(sender, row.recipient, row.subject, row.body);
    await updateEmailJobStatus(emailJobId, {
      status: "sent",
      sent_at: new Date(),
      preview_url: result.previewUrl,
    });
    console.log(`[worker] sent job ${emailJobId} to=${row.recipient} preview=${result.previewUrl ?? "n/a"}`);
  } catch (err) {
    console.error(`[worker] send failed for job ${emailJobId}:`, (err as Error).message);
    await updateEmailJobStatus(emailJobId, {
      status: row.status,
      attempts: row.attempts + 1,
      error_message: (err as Error).message,
    });
    throw err;
  }
}
