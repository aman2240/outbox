// Request/response shapes for the REST API, framework-agnostic (plain
// interfaces) so the frontend can copy these directly into its own
// lib/types.ts without depending on the backend's build.
import { EmailJob, EmailJobStatus, Sender, User } from "./index";

export interface ScheduleEmailsRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO date string, must be in the future
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

export type { EmailJob, EmailJobStatus, Sender, User };
