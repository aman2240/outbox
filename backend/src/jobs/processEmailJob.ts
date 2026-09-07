import { Job } from "bullmq";
import { getEmailJobById, updateEmailJobStatus } from "../db/emailJobs";
import { getSenderById } from "../db/senders";
import { sendEmail } from "../services/email";
import { EmailJobData } from "../types";

/**
 * Sends the real email via Ethereal (Phase 2) for a scheduled email_jobs row.
 *
 * Failure handling note: on a send failure this throws so BullMQ's own
 * retry/backoff (configured on the job in scheduleEmailJob) can re-run it.
 * We record the attempt count and error message here on every failure, but
 * we deliberately do NOT flip status to 'failed' until retries are
 * exhausted (handled in the Worker's 'failed' event in emailWorker.ts) —
 * otherwise our own idempotency guard below ("must be scheduled/delayed")
 * would reject BullMQ's own retry of the same job.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
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
