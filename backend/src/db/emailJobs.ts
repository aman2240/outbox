import { query, queryOne } from "./client";
import { EmailJob, EmailJobStatus } from "../types";
import { indexEmailJob } from "../services/elasticsearchIndex";

export interface CreateEmailJobInput {
  sender_id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status?: EmailJobStatus;
}

export async function createEmailJob(input: CreateEmailJobInput): Promise<EmailJob> {
  const row = await queryOne<EmailJob>(
    `INSERT INTO email_jobs (sender_id, recipient, subject, body, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.sender_id, input.recipient, input.subject, input.body, input.scheduled_at, input.status ?? "scheduled"]
  );
  if (!row) throw new Error("Failed to create email job");
  await indexEmailJob(row);
  return row;
}

export async function getEmailJobById(id: string): Promise<EmailJob | null> {
  return queryOne<EmailJob>("SELECT * FROM email_jobs WHERE id = $1", [id]);
}

export interface UpdateEmailJobStatusInput {
  status: EmailJobStatus;
  scheduled_at?: Date;
  attempts?: number;
  error_message?: string | null;
  sent_at?: Date | null;
  preview_url?: string | null;
}

export async function updateEmailJobStatus(id: string, input: UpdateEmailJobStatusInput): Promise<EmailJob | null> {
  const sets: string[] = ["status = $2", "updated_at = now()"];
  const values: unknown[] = [id, input.status];
  let idx = 3;

  if (input.scheduled_at !== undefined) {
    sets.push(`scheduled_at = $${idx++}`);
    values.push(input.scheduled_at);
  }
  if (input.attempts !== undefined) {
    sets.push(`attempts = $${idx++}`);
    values.push(input.attempts);
  }
  if (input.error_message !== undefined) {
    sets.push(`error_message = $${idx++}`);
    values.push(input.error_message);
  }
  if (input.sent_at !== undefined) {
    sets.push(`sent_at = $${idx++}`);
    values.push(input.sent_at);
  }
  if (input.preview_url !== undefined) {
    sets.push(`preview_url = $${idx++}`);
    values.push(input.preview_url);
  }

  const row = await queryOne<EmailJob>(`UPDATE email_jobs SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, values);
  if (row) await indexEmailJob(row);
  return row;
}

export interface ListEmailJobsOptions {
  status?: EmailJobStatus | EmailJobStatus[];
  page?: number;
  pageSize?: number;
}

export async function listEmailJobs(options: ListEmailJobsOptions = {}): Promise<{ rows: EmailJob[]; total: number }> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(options.pageSize, 200) : 20;
  const offset = (page - 1) * pageSize;

  const statuses = options.status ? (Array.isArray(options.status) ? options.status : [options.status]) : null;
  const sortsByScheduled = statuses ? statuses.every((s) => s === "scheduled" || s === "delayed") : false;
  const orderBy = sortsByScheduled ? "scheduled_at ASC" : "COALESCE(sent_at, created_at) DESC";

  const where = statuses ? "WHERE status = ANY($1)" : "";
  const params: unknown[] = statuses ? [statuses] : [];

  const rows = await query<EmailJob>(
    `SELECT * FROM email_jobs ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset]
  );

  const countRow = await queryOne<{ count: string }>(`SELECT COUNT(*)::text as count FROM email_jobs ${where}`, params);

  return { rows, total: countRow ? parseInt(countRow.count, 10) : 0 };
}

// Used by reconciliation on boot: anything still "pending" from the queue's
// point of view, regardless of whether its scheduled time has passed.
export async function getScheduledJobsBeforeNow(): Promise<EmailJob[]> {
  return query<EmailJob>(`SELECT * FROM email_jobs WHERE status IN ('scheduled', 'delayed') ORDER BY scheduled_at ASC`);
}
