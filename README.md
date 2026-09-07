# ReachInbox Email Scheduler

A full-stack email scheduling system: schedule bulk emails for future delivery,
with restart-safe persistence, per-sender rate limiting, Slack notifications,
Google login, and searchable send history.

## Overview

_Placeholder — finalized in Phase 9._

## Setup Instructions

_Full instructions finalized in Phase 9._

### BullMQ live dashboard

A [bull-board](https://github.com/felixmosh/bull-board) dashboard is mounted
at `http://localhost:4000/admin/queues`, wired to the same `email-send` queue
everything else uses. It requires being logged in (gated behind the same
`requireAuth` middleware as the rest of the protected API — no separate admin
role for this assignment's scope). It shows live waiting/delayed/active/
completed/failed counts and lets you inspect individual job payloads —
useful for the demo video's "behavior under load" section (Phase 9).

### Setting up Ethereal Email

We use [Ethereal](https://ethereal.email/) as a fake SMTP provider — it accepts
mail like a real inbox but never delivers anywhere, and instead gives back a
preview URL you can open to see exactly what was "sent". This is ideal for
demoing without spamming real inboxes.

1. From `/backend`, run: `npm run create-ethereal-senders`
2. This calls `nodemailer.createTestAccount()` twice, generating two disposable
   SMTP test accounts, and inserts both directly into the `senders` table (so
   no manual `.env` editing is required — they immediately show up as
   selectable senders).
3. Credentials are printed to the console for reference; you generally don't
   need them again since they're already stored in Postgres.
4. Since Ethereal never delivers to a real inbox, every sent email's
   `preview_url` (Ethereal's hosted view of that exact message) is stored on
   the `email_jobs` row and surfaced in the frontend's Sent Emails table.

### Setting up Google OAuth (login)

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or
   pick) a project, then go to **APIs & Services → OAuth consent screen** and
   configure it (External is fine for testing; add your own Google account
   as a test user if the app is left in "Testing" publish status).
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**, application type **Web application**.
3. Add an **Authorized redirect URI**: `http://localhost:4000/auth/google/callback`
   (must match `GOOGLE_CALLBACK_URL` exactly).
4. Copy the generated Client ID and Client Secret into `.env`:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Restart the backend. Until these are set, `/auth/google` responds `501`
   and the server logs a warning on boot instead of crashing — Google login
   is optional at boot, not a hard dependency.

### Setting up Slack OAuth (per-user "Connect Slack")

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
   → From scratch.
2. Under **OAuth & Permissions**, add a redirect URL:
   `http://localhost:4000/slack/callback` (must match `SLACK_REDIRECT_URI`).
3. Under **Incoming Webhooks**, toggle it on — this is what grants the
   `incoming-webhook` scope our `/slack/connect` flow requests.
4. Under **Basic Information**, copy the **Client ID** and **Client Secret**
   into `.env`: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`.
5. Restart the backend, log in with Google, then click "Connect Slack" in the
   dashboard (or visit `/slack/connect` directly) — you'll be asked which
   channel the incoming webhook should post to, then redirected back.
6. Before this is set up, `MIN_DELAY`/rate-limit Slack notifications can
   still be manually tested via the temporary `SLACK_TEST_WEBHOOK_URL` env
   var from Phase 3 (a webhook URL from **Incoming Webhooks → Add New
   Webhook to Workspace**) — this is only consulted for senders that don't
   have an owning user yet (e.g. ones created via the old `/debug` routes).

## Architecture Overview

### Scheduling: BullMQ delayed jobs, no cron

There is no cron job anywhere in this system. Every scheduled send is a single
BullMQ **delayed job** on one queue (`email-send`). When an email is scheduled:

1. A row is inserted into Postgres `email_jobs` with `status='scheduled'` and a
   `scheduled_at` timestamp. Postgres's generated UUID for that row becomes the
   job's identity for the rest of its life.
2. That same UUID is reused as the **BullMQ `jobId`** when the job is added to
   the queue, with `delay = scheduled_at - now`. BullMQ/Redis fires it at
   (approximately) the right time; no polling loop or cron tick is involved.

### Restart-persistence & idempotency

Postgres is the source of truth for "what should eventually be sent." BullMQ/
Redis is only the mechanism that fires it at the right time. Two things
guarantee that a crash or restart never loses or duplicates a send:

- **`jobId` reuse as the idempotency key.** Because `jobId = email_jobs.id`
  always, BullMQ itself refuses to add a second job under an id that's already
  waiting/delayed/active. Calling `scheduleEmailJob` twice for the same DB row
  is always a safe no-op from BullMQ's perspective.
- **Reconciliation on boot** (`src/services/reconciliation.ts`), run once,
  before the server accepts traffic:
  - Load every `email_jobs` row still `scheduled` or `delayed` from Postgres.
  - For each, ask BullMQ (`queue.getJob(id)`) whether a job with that id
    exists and is in a state that will still fire (`waiting`/`delayed`/
    `active`). If so, leave it alone — this is what prevents duplicates.
  - If it's missing (e.g. Redis lost it, or the process crashed between the
    DB insert and the `queue.add` call) or stuck in a stale terminal state
    that disagrees with the DB, it is (re-)scheduled from the DB row. If its
    `scheduled_at` has already passed, it's scheduled with `delay=0` (fires
    immediately) and this is logged loudly, since it means the exact intended
    send time was missed while the server was down.
  - A summary line is logged: `Reconciliation: X jobs checked, Y re-queued, Z
    already healthy`.

This was verified manually: schedule a job, kill the server mid-countdown,
restart — the job survives a normal process restart (Redis still has it,
reconciliation reports it "already healthy") and also survives Redis itself
losing the job (simulated via `FLUSHALL` — reconciliation detects it's
missing and re-queues it from Postgres). In both cases the job fires exactly
once.

### Rate limiting & concurrency

Three separate mechanisms cooperate here:

- **Minimum delay between sends** (`MIN_DELAY_MS_BETWEEN_SENDS`): applied via
  BullMQ's built-in Worker `limiter: { max: 1, duration }` option. This paces
  overall throughput across the *whole* worker — at most one job is picked up
  per window, regardless of concurrency. It's global pacing, not per-sender.
- **Configurable concurrency** (`WORKER_CONCURRENCY`): how many jobs the
  Worker can have in-flight at once, independent of the pacing above.
- **Per-sender hourly cap** (`senders.hourly_limit`, falling back to
  `MAX_EMAILS_PER_HOUR_PER_SENDER` when a sender doesn't specify one at
  creation time): enforced with a Redis Lua script
  (`checkAndIncrementSenderHourlyCount` in `services/rateLimiter.ts`) that
  atomically reads-and-increments a counter keyed
  `ratelimit:{senderId}:{YYYYMMDDHH}` (UTC hour bucket). Doing the
  check-then-increment as one Lua script — rather than separate `GET`/`INCR`
  calls — is what makes it safe across multiple concurrent workers/jobs: two
  jobs can never both slip through as "under the limit" and overshoot it.

**When a sender's hourly cap is hit:** the job is never dropped or failed. It's
pushed into the next UTC hour window, at the same offset-into-the-hour as its
original `scheduled_at` (so relative ordering among rescheduled jobs is
preserved), via BullMQ's native "delay a job from inside its own processor"
pattern: `job.moveToDelayed(newTimestamp, token)` followed by throwing
`DelayedError`. This tells BullMQ "this is an intentional pause," not a
failure — no `failed` event fires and no retry attempt is consumed.

**Slack notification on limit-hit:** fires once per sender-per-hour, not once
per overflowing job (there can be hundreds queued at the same instant). This
is guarded by a separate Redis key, `ratelimit:notified:{senderId}:{hour}`,
claimed with `SET ... NX EX 3600` — only the first job to hit the limit in
that window wins the claim and sends the notification.

**A bug we found and fixed while testing this manually:** the rate-limit
check must only run on a job's *first* attempt at sending
(`job.attemptsMade === 0`), not on every BullMQ-driven retry after a
transient send failure. Without that guard, a job that was already correctly
"allowed" (and counted) could get re-checked on retry, find the counter now
at the limit (because other jobs used the remaining slots while it was
retrying), and get wrongly bumped to the next hour — even though it had
already claimed its slot. `DelayedError` reschedules don't increment
`attemptsMade`, so a job that legitimately gets pushed to the next hour still
looks like attempt 0 when it wakes up there, and correctly gets re-checked
against that new hour's count.

**Documented trade-off:** hour buckets are UTC-aligned wall-clock hours
(`00:00–00:59`, `01:00–01:59`, ...), not a rolling 60-minute window from each
individual send. A sender could in principle send its full hourly quota at
`00:59` and again at `01:00`, a 1-minute burst of double the nominal rate.
This is simpler to reason about and implement correctly under concurrency
than a true sliding window, and was an explicit scope trade-off for this
assignment.

**Manually verified:** `MAX_EMAILS_PER_HOUR_PER_SENDER=3`, 5 jobs scheduled
for the same sender within milliseconds of each other. Jobs 1–3 were
allowed; jobs 4–5 were immediately moved to `status='delayed'` with
`scheduled_at` pushed to the next UTC hour. Exactly one Slack webhook call
fired (message: `hit its hourly limit (3/3)`), not five. Retried sends for
jobs 1–3 (which then failed for an unrelated reason — no real SMTP egress in
the dev sandbox this was built in) correctly did *not* re-trigger the
rate-limit path on retry.

### Behavior under load

`src/scripts/simulate-load.ts` (Phase 9) creates ~1000 `email_jobs` rows all
scheduled at (or very near) the same timestamp, for a single sender with a
deliberately low `hourly_limit`, and schedules each through the normal
`scheduleEmailJob` path. Within the first hour, only `hourly_limit` of them
send; the rest are visibly pushed to `status='delayed'` with `scheduled_at`
values spread across the following hour(s) — observable both in the
Scheduled Emails table (as "Delayed" badges) and in the BullMQ dashboard's
delayed-job count, without needing to wait for 1000 real sends.

### Authentication & Slack OAuth

Google login uses `passport` + `passport-google-oauth20` with a server-side
session (`express-session`, cookie-based). `requireAuth` middleware gates any
route that needs a logged-in user. If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
aren't set, the app still boots — `/auth/google` just responds `501` — rather
than making Google OAuth a hard startup dependency.

Slack's per-user "Connect Slack" flow is a second, independent OAuth
handshake (`/slack/connect` → Slack → `/slack/callback`), scoped to
`incoming-webhook`. Since the callback lands on a public redirect URI, the
`state` param can't be trusted as-is — it's HMAC-signed
(`crypto.createHmac('sha256', SESSION_SECRET)`) with the initiating user's id
before redirecting to Slack, and the signature is verified with a
timing-safe comparison on the way back, so `/slack/callback` knows which
user to attach the resulting webhook to without relying on the session
cookie surviving the round trip through Slack's domain. Disconnecting is a
soft delete (`connected=false`, row kept) so reconnecting is just flipping
it back. `senders.owner_user_id` links a sender identity to the user who
should be notified about it; `services/slack.ts` re-queries
`slack_integrations` on every notification (never caches), so connect/
disconnect take effect immediately.

**Documented trade-off:** sessions are stored in-memory
(`express-session`'s default `MemoryStore`), which is fine for a single
backend process in local dev/demo but would need a shared store (Redis,
via `connect-redis`) to survive a restart or run behind multiple instances.

### Elasticsearch indexing

Elasticsearch is used for **search only** — Postgres remains the single
source of truth for every email's actual data and status. The `emails`
index (`services/elasticsearchIndex.ts`) mirrors `recipient`, `subject`,
`body`, `status`, `sender_id`, `scheduled_at`, and `sent_at`, using each
`email_jobs` row's own UUID as the ES document id, so re-indexing the same
row (which happens on every status transition) is naturally an idempotent
upsert rather than needing separate insert/update logic.

**Indexing happens synchronously at each write point** — inside
`createEmailJob` and `updateEmailJobStatus` in `db/emailJobs.ts` — rather
than via a separate sync job or queue. Given the scope of this assignment,
keeping DB and ES writes co-located was simpler to reason about and
guarantees they can never drift out of sync from a missed sync-job run; the
trade-off is that an ES write happens synchronously on the request path (it's
fire-and-forget in effect, since failures are caught and logged, never
thrown — see below).

**Search** (`GET /api/emails/search?q=&status=`) runs a `multi_match` query
across `subject`/`body`/`recipient` in Elasticsearch (optionally filtered by
`status`), takes the matched document ids, and then fetches the full,
authoritative rows from Postgres by those ids — the API response is always
built from Postgres data, never directly from ES documents. This was a
deliberate choice: it means ES's document shape is free to diverge from the
API's response shape without becoming a compatibility concern.

**Degrades gracefully when Elasticsearch is unavailable** (verified
manually, since this environment has no reachable ES cluster): server boot
does not fail if `ensureEmailsIndexExists()` can't reach ES — it logs the
failure and continues. Scheduling and sending emails work completely
normally with ES down (indexing calls are wrapped in try/catch and only
logged on failure, never thrown — a search-index outage must never block
the actual product). The search endpoint itself returns an empty result set
rather than a 500 when ES can't be reached.

### Frontend

Next.js App Router, all client-rendered (no server components hold app
state — the backend is a separate origin, so there's nothing for the
server-rendering to buy here beyond the static shell).

- `lib/api.ts` — a single typed fetch wrapper with `credentials: 'include'`
  baked in (so the session cookie rides along cross-origin) and a typed
  method per backend route. Every failed request throws `ApiError` with the
  backend's actual error message, which every call site catches and routes
  to a toast — nothing fails silently.
- `components/AuthContext.tsx` — calls `GET /auth/me` once on the dashboard
  layout mounting; a `401` redirects to `/login`. This is the auth guard for
  the entire `/dashboard` subtree.
- `lib/useEmailsQuery.ts` — the shared data-fetching hook behind both
  tables: fetches on mount/dependency-change, polls every 15s for a "live"
  feel (a documented simplification over websockets — see Assumptions &
  Trade-offs), and guards against a slow, now-stale request clobbering a
  fresher one if the user changes the search box again before the first
  response lands.
- `lib/parseRecipients.ts` — CSV/TXT parsing via `papaparse`, supporting
  both a bare list of addresses and a CSV with an `email` header column;
  invalid entries are counted and surfaced, not silently dropped, and
  duplicates are de-duplicated case-insensitively.
- Sent and failed emails share one "Sent Emails" tab (distinguished by
  badge color) rather than a separate filter toggle — simpler for this
  assignment's scope; a `View` link opens the Ethereal preview for sent
  mail, a hoverable `Error` badge shows the failure reason for failed mail.

**Bug found and fixed while testing this in a real browser (not just
typechecking):** the Elasticsearch JS client's default retry/backoff made
`GET /api/emails/search` take ~7 seconds to respond whenever ES was
unreachable (retries with backoff on the *read* path, while the *write*
path used by indexing failed instantly) — long enough that the frontend's
loading state looked permanently stuck. Fixed by setting `maxRetries: 0` and
a short `requestTimeout` on the ES client (`config/elasticsearch.ts`), so
every ES call now fails fast and consistently, matching the "degrades
gracefully" behavior the rest of the system already had. This is exactly
the kind of thing that only surfaces by actually clicking through the UI —
recorded here as a reminder that a green typecheck isn't the same as a
working feature.

## API Reference

All routes are prefixed with the backend's base URL (`http://localhost:4000`
by default). "Auth" = requires an active logged-in session
(`requireAuth` middleware) — a request without one gets `401`.

| Method | Path | Auth | Request body | Response |
|---|---|---|---|---|
| GET | `/health` | No | — | `{ status, db, redis, elasticsearch }` |
| GET | `/auth/google` | No | — | Redirects to Google's OAuth consent screen (`501` if not configured) |
| GET | `/auth/google/callback` | No | — | Redirects to `FRONTEND_URL/dashboard` on success |
| GET | `/auth/me` | Auth | — | `{ user: User }` (`401` if not logged in) |
| POST | `/auth/logout` | No | — | `{ ok: true }`, destroys the session |
| GET | `/slack/connect` | Auth | — | Redirects to Slack's OAuth authorize screen (`501` if not configured) |
| GET | `/slack/callback` | No† | — | Redirects to `FRONTEND_URL/dashboard?slack=connected\|error` |
| GET | `/slack/status` | Auth | — | `{ connected: boolean, teamName: string \| null }` |
| POST | `/slack/disconnect` | Auth | — | `{ ok: true }` |
| POST | `/api/emails/schedule` | Auth | `{ senderId, subject, body, recipients: string[], startTime, delayBetweenEmailsMs, hourlyLimit? }` | `{ count, jobIds: string[] }` (`400` with `{ error, issues }` on validation failure) |
| GET | `/api/emails?status=&page=&pageSize=` | Auth | — | `{ results: EmailJob[], total, page, pageSize }` |
| GET | `/api/emails/search?q=&status=` | Auth | — | `{ results: EmailJob[] }` |
| GET | `/api/senders` | Auth | — | `{ senders: Sender[] }` |
| GET | `/admin/queues` | Auth | — | BullMQ live dashboard (HTML) |

† `/slack/callback` isn't gated by `requireAuth` since it's a redirect target
from Slack's servers — it instead verifies the signed `state` param (see
Architecture Overview → Authentication & Slack OAuth) to determine which
user to attach the integration to.

`status` on `GET /api/emails` accepts a comma-separated list (e.g.
`scheduled,delayed`) so the frontend can merge statuses into one tab.

The temporary `/debug/*` routes from Phases 1–3 have been removed now that
this real API exists.

## Features Implemented

_Placeholder — finalized in Phase 9._

## Assumptions & Trade-offs

_Placeholder — finalized in Phase 9._

## Demo Video

_Placeholder — link added after recording._
