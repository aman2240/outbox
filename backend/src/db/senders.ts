import { query, queryOne } from "./client";
import { Sender } from "../types";
import { env } from "../config/env";

export interface CreateSenderInput {
  name: string;
  email: string;
  smtp_user: string;
  smtp_pass: string;
  hourly_limit?: number;
}

export async function createSender(input: CreateSenderInput): Promise<Sender> {
  const row = await queryOne<Sender>(
    `INSERT INTO senders (name, email, smtp_user, smtp_pass, hourly_limit)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.name, input.email, input.smtp_user, input.smtp_pass, input.hourly_limit ?? env.maxEmailsPerHourPerSender]
  );
  if (!row) throw new Error("Failed to create sender");
  return row;
}

export async function listSenders(): Promise<Sender[]> {
  return query<Sender>("SELECT * FROM senders ORDER BY created_at ASC");
}

export async function getSenderById(id: string): Promise<Sender | null> {
  return queryOne<Sender>("SELECT * FROM senders WHERE id = $1", [id]);
}

export async function getAnySender(): Promise<Sender | null> {
  return queryOne<Sender>("SELECT * FROM senders ORDER BY created_at ASC LIMIT 1");
}

export async function updateSenderHourlyLimit(id: string, hourlyLimit: number): Promise<void> {
  await query("UPDATE senders SET hourly_limit = $2 WHERE id = $1", [id, hourlyLimit]);
}
