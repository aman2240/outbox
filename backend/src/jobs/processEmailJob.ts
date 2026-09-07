import { Job } from "bullmq";
import { getEmailJobById, updateEmailJobStatus } from "../db/emailJobs";
import { EmailJobData } from "../types";

/**
 * Phase 1: proves the scheduling pipeline end-to-end without a real send.
 * Phase 2 replaces the "would send here" branch with a real Ethereal send.
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

  console.log(`[worker] would send here: job=${emailJobId} to=${row.recipient} subject="${row.subject}"`);

  await updateEmailJobStatus(emailJobId, { status: "sent", sent_at: new Date() });
}
