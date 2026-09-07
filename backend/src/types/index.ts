// Shared, framework-agnostic types. Mirrored (copy-pasted, not imported) on the
// frontend in /frontend/src/lib/types.ts since the two apps don't share a build.

export type EmailJobStatus = "scheduled" | "processing" | "sent" | "failed" | "delayed";

export interface Sender {
  id: string;
  name: string;
  email: string;
  smtp_user: string;
  smtp_pass: string;
  hourly_limit: number;
  owner_user_id: string | null;
  created_at: string;
}

export interface EmailJob {
  id: string;
  sender_id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: EmailJobStatus;
  attempts: number;
  error_message: string | null;
  preview_url: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  google_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface SlackIntegration {
  id: string;
  user_id: string;
  access_token: string | null;
  webhook_url: string | null;
  team_name: string | null;
  connected: boolean;
  created_at: string;
}

export interface EmailJobData {
  emailJobId: string;
}
