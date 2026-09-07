/**
 * Manual load-test script for demoing "behavior under load" without
 * needing 1000 real Ethereal sends: creates a sender with a deliberately
 * low hourly_limit, inserts ~1000 email_jobs rows directly into Postgres
 * (bulk INSERT, bypassing createEmailJob's per-row ES indexing for speed —
 * this is a one-off demo tool, not a code path that needs to stay in sync
 * with search), all scheduled at (almost) the same instant, then schedules
 * each through the normal scheduleEmailJob path so BullMQ and the rate
 * limiter see them exactly like any other batch.
 *
 * Run: npm run simulate-load (from /backend)
 *
 * Once the worker starts picking these up, only `hourly_limit` of them will
 * actually attempt to send within the first hour — the rest get pushed to
 * status='delayed' almost immediately, visible in the Scheduled Emails
 * table (as "Delayed" badges) or the BullMQ dashboard's delayed count.
 */
import { pool } from "../config/postgres";
import { createSender } from "../db/senders";
import { query } from "../db/client";
import { scheduleEmailJob } from "../queues/emailQueue";
import { EmailJob } from "../types";

const JOB_COUNT = 1000;
const LOW_HOURLY_LIMIT = 10;
const COLUMNS_PER_ROW = 5;

async function main() {
  console.log(`Creating a load-test sender with hourly_limit=${LOW_HOURLY_LIMIT}...`);
  const sender = await createSender({
    name: "Load Test Sender",
    email: "load-test@example.com",
    smtp_user: "load-test",
    smtp_pass: "load-test",
    hourly_limit: LOW_HOURLY_LIMIT,
  });
  console.log(`Sender created: ${sender.id}`);

  // A few seconds out, not immediate, so there's time to open the
  // dashboard before the worker starts tearing through the queue.
  const scheduledAt = new Date(Date.now() + 5000);

  console.log(`Inserting ${JOB_COUNT} email_jobs rows scheduled at ${scheduledAt.toISOString()}...`);

  const valuePlaceholders: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < JOB_COUNT; i++) {
    const base = i * COLUMNS_PER_ROW;
    valuePlaceholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 'scheduled')`
    );
    params.push(sender.id, `load-test-${i}@example.com`, "Load simulation test", "Load simulation test body", scheduledAt);
  }

  const inserted = await query<Pick<EmailJob, "id" | "scheduled_at">>(
    `INSERT INTO email_jobs (sender_id, recipient, subject, body, scheduled_at, status)
     VALUES ${valuePlaceholders.join(", ")}
     RETURNING id, scheduled_at`,
    params
  );
  console.log(`Inserted ${inserted.length} rows. Scheduling via BullMQ...`);

  let scheduled = 0;
  for (const row of inserted) {
    await scheduleEmailJob(row);
    scheduled++;
    if (scheduled % 100 === 0) console.log(`  scheduled ${scheduled}/${inserted.length}`);
  }

  console.log(`\nDone. ${scheduled} jobs scheduled for sender ${sender.id} (hourly_limit=${LOW_HOURLY_LIMIT}).`);
  console.log(`Watch the Scheduled Emails table or /admin/queues — most of these should flip to`);
  console.log(`status='delayed' within moments of the worker picking them up.`);

  await pool.end();
  // scheduleEmailJob holds open a BullMQ Queue (and its Redis connection),
  // which otherwise keeps this one-off script's process alive indefinitely.
  process.exit(0);
}

main().catch((err) => {
  console.error("Load simulation failed:", err);
  process.exit(1);
});
