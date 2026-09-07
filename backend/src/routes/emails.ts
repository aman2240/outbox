import { Router } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { createEmailJob, listEmailJobs } from "../db/emailJobs";
import { getSenderById, updateSenderHourlyLimit } from "../db/senders";
import { scheduleEmailJob } from "../queues/emailQueue";
import { searchEmailIds } from "../services/elasticsearchIndex";
import { requireAuth } from "../middleware/requireAuth";
import { EmailJob, EmailJobStatus } from "../types";

export const emailsRouter = Router();

const VALID_STATUSES: EmailJobStatus[] = ["scheduled", "processing", "sent", "failed", "delayed"];

const scheduleEmailsSchema = z.object({
  senderId: z.string().uuid("senderId must be a valid UUID"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  recipients: z
    .array(z.string().email("One or more recipients are not valid email addresses"))
    .min(1, "At least one recipient is required"),
  startTime: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "startTime must be a valid date")
    .refine((v) => new Date(v).getTime() > Date.now(), "startTime must be in the future"),
  delayBetweenEmailsMs: z.number().int().min(0, "delayBetweenEmailsMs must be zero or positive"),
  hourlyLimit: z.number().int().positive("hourlyLimit must be a positive number").optional(),
});

/**
 * Recipients are staggered starting at startTime, delayBetweenEmailsMs apart
 * — this gives a natural initial ordering even before the per-sender hourly
 * rate limiter (Phase 3) kicks in and potentially reshuffles some of them
 * into a later hour.
 *
 * hourlyLimit, when provided, updates the sender's hourly_limit globally
 * (affecting all future sends from this sender, not just this batch) — the
 * simpler of the two options the assignment allows, chosen since senders
 * are shared, named identities rather than a construct scoped to one batch.
 */
emailsRouter.post("/schedule", requireAuth, async (req, res) => {
  const parsed = scheduleEmailsSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      error: firstIssue?.message ?? "Invalid request body",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    });
    return;
  }

  const { senderId, subject, body, recipients, startTime, delayBetweenEmailsMs, hourlyLimit } = parsed.data;

  try {
    const sender = await getSenderById(senderId);
    if (!sender) {
      res.status(400).json({ error: "Sender not found" });
      return;
    }

    if (hourlyLimit !== undefined) {
      await updateSenderHourlyLimit(senderId, hourlyLimit);
    }

    const startTimeMs = new Date(startTime).getTime();
    const jobIds: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const scheduledAt = new Date(startTimeMs + i * delayBetweenEmailsMs);
      const row = await createEmailJob({
        sender_id: senderId,
        recipient: recipients[i],
        subject,
        body,
        scheduled_at: scheduledAt,
      });
      await scheduleEmailJob(row);
      jobIds.push(row.id);
    }

    res.json({ count: jobIds.length, jobIds });
  } catch (err) {
    console.error("[emails] schedule failed:", err);
    res.status(500).json({ error: "Failed to schedule emails" });
  }
});

emailsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const statusParam = typeof req.query.status === "string" ? req.query.status : undefined;
    const statuses = statusParam
      ? (statusParam.split(",").map((s) => s.trim()) as EmailJobStatus[]).filter((s) => VALID_STATUSES.includes(s))
      : undefined;

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : 20;

    const { rows, total } = await listEmailJobs({ status: statuses, page, pageSize });
    res.json({ results: rows, total, page, pageSize });
  } catch (err) {
    console.error("[emails] list failed:", err);
    res.status(500).json({ error: "Failed to list emails" });
  }
});

// Elasticsearch is used for search only — it decides *which* rows match,
// Postgres remains the source of truth for the actual row data. We fetch
// full rows by the matched ids rather than trusting the ES documents to
// carry everything the frontend needs (keeps ES's schema free to diverge
// from Postgres's without the API breaking).
emailsRouter.get("/search", requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const ids = await searchEmailIds(q, status);
    if (ids.length === 0) {
      res.json({ results: [] });
      return;
    }

    const rows = await query<EmailJob>("SELECT * FROM email_jobs WHERE id = ANY($1)", [ids]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = ids.map((id) => byId.get(id)).filter((row): row is EmailJob => Boolean(row));

    res.json({ results: ordered });
  } catch (err) {
    console.error("[emails] search failed:", err);
    res.status(500).json({ error: "Search failed" });
  }
});
