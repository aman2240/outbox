import { Router } from "express";
import { createEmailJob } from "../db/emailJobs";
import { getAnySender, createSender } from "../db/senders";
import { scheduleEmailJob } from "../queues/emailQueue";
import { query } from "../db/client";
import { EmailJob } from "../types";

// Temporary routes for manually verifying Phase 1 (scheduling + restart
// reconciliation) before the real API lands in Phase 7.
export const debugRouter = Router();

debugRouter.post("/schedule-test-job", async (req, res) => {
  try {
    let sender = await getAnySender();
    if (!sender) {
      sender = await createSender({
        name: "Debug Sender",
        email: "debug@example.com",
        smtp_user: "debug",
        smtp_pass: "debug",
      });
    }

    const senderId = req.body?.sender_id ?? sender.id;
    const subject = req.body?.subject ?? "Test scheduled email";
    const body = req.body?.body ?? "This is a test email body.";
    const recipient = req.body?.recipient ?? "recipient@example.com";
    const delaySeconds = typeof req.body?.delay_seconds === "number" ? req.body.delay_seconds : 30;

    const scheduledAt = new Date(Date.now() + delaySeconds * 1000);

    const row = await createEmailJob({
      sender_id: senderId,
      recipient,
      subject,
      body,
      scheduled_at: scheduledAt,
    });

    await scheduleEmailJob(row);

    res.json({ ok: true, job: row });
  } catch (err) {
    console.error("[debug] schedule-test-job failed:", err);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

debugRouter.get("/jobs", async (_req, res) => {
  try {
    const rows = await query<EmailJob>("SELECT * FROM email_jobs ORDER BY created_at DESC");
    res.json({ jobs: rows });
  } catch (err) {
    console.error("[debug] list jobs failed:", err);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});
