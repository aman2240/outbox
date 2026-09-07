import {
  ApiErrorResponse,
  ListEmailsResponse,
  ListSendersResponse,
  MeResponse,
  ScheduleEmailsRequest,
  ScheduleEmailsResponse,
  SearchEmailsResponse,
  SlackStatusResponse,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  issues?: ApiErrorResponse["issues"];

  constructor(message: string, status: number, issues?: ApiErrorResponse["issues"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let body: ApiErrorResponse | undefined;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error body — fall through to a generic message.
    }
    throw new ApiError(body?.error ?? `Request failed with status ${response.status}`, response.status, body?.issues);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getMe: () => request<MeResponse>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  loginUrl: () => `${API_BASE_URL}/auth/google`,

  listEmails: (params: { status?: string; page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const qs = query.toString();
    return request<ListEmailsResponse>(`/api/emails${qs ? `?${qs}` : ""}`);
  },

  searchEmails: (q: string, status?: string) => {
    const query = new URLSearchParams({ q });
    if (status) query.set("status", status);
    return request<SearchEmailsResponse>(`/api/emails/search?${query.toString()}`);
  },

  scheduleEmails: (payload: ScheduleEmailsRequest) =>
    request<ScheduleEmailsResponse>("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSenders: () => request<ListSendersResponse>("/api/senders"),

  getSlackStatus: () => request<SlackStatusResponse>("/slack/status"),
  connectSlackUrl: () => `${API_BASE_URL}/slack/connect`,
  disconnectSlack: () => request<{ ok: true }>("/slack/disconnect", { method: "POST" }),
};
