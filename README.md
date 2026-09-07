# ReachInbox Email Scheduler

A full-stack email scheduling system: schedule bulk emails for future delivery,
with restart-safe persistence, per-sender rate limiting, Slack notifications,
Google login, and searchable send history.

## Overview

_Placeholder — finalized in Phase 9._

## Setup Instructions

_Full instructions finalized in Phase 9._

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

_Filled in in Phase 3._

### Elasticsearch indexing

_Filled in in Phase 5._

## Features Implemented

_Placeholder — finalized in Phase 9._

## Assumptions & Trade-offs

_Placeholder — finalized in Phase 9._

## Demo Video

_Placeholder — link added after recording._
