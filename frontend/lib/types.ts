// Mirrors /backend/src/types/index.ts and /backend/src/types/api.ts.
// Copied rather than imported since the frontend and backend don't share a
// build — kept in sync by hand.

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

export interface ScheduleEmailsRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit?: number;
}

export interface ScheduleEmailsResponse {
  count: number;
  jobIds: string[];
}

export interface ListEmailsResponse {
  results: EmailJob[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchEmailsResponse {
  results: EmailJob[];
}

export interface ListSendersResponse {
  senders: Sender[];
}

export interface MeResponse {
  user: User;
}

export interface SlackStatusResponse {
  connected: boolean;
  teamName: string | null;
}

export interface ApiErrorResponse {
  error: string;
  issues?: { path: (string | number)[]; message: string }[];
}
