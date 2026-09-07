import { getScheduledJobsBeforeNow } from "../db/emailJobs";
import { emailQueue, scheduleEmailJob } from "../queues/emailQueue";

/**
 * Restart-safety, in one function.
 *
 * Postgres is the source of truth for "what should eventually be sent";
 * BullMQ/Redis is just the mechanism that fires it at the right time. If the
 * process crashes or Redis loses state between "we wrote the DB row" and
 * "we successfully called queue.add", or Redis itself is flushed/restarted,
 * we'd otherwise silently lose the send. This runs once on boot, before the
 * server accepts traffic, and reconciles the two:
 *
 *   - For every DB row still 'scheduled' or 'delayed', look up whether a
 *     BullMQ job with that same id (jobId = email_jobs.id, always) exists
 *     and is in a state that will still fire (waiting/delayed/active).
 *   - If yes: leave it alone. This is what prevents duplicates — we never
 *     blindly re-add.
 *   - If no (missing entirely, or stuck in a stale terminal state that
 *     disagrees with the DB): (re-)schedule it. If its scheduled_at has
 *     already passed, it fires immediately (delay=0) and we log loudly,
 *     since it means we missed the exact intended send time.
 */
export async function reconcileJobsOnStartup(): Promise<void> {
  const rows = await getScheduledJobsBeforeNow();

  let requeued = 0;
  let healthy = 0;

  for (const row of rows) {
    const existingJob = await emailQueue.getJob(row.id);

    if (existingJob) {
      const state = await existingJob.getState();
      if (state === "waiting" || state === "delayed" || state === "active" || state === "waiting-children") {
        healthy++;
        continue;
      }

      console.warn(
        `[reconciliation] job ${row.id} found in stale queue state '${state}' while DB says '${row.status}' — removing stale job and re-queueing`
      );
      await existingJob.remove();
    }

    const scheduledAtMs = new Date(row.scheduled_at).getTime();
    if (scheduledAtMs <= Date.now()) {
      console.warn(
        `[reconciliation] job ${row.id} missed its scheduled time (${row.scheduled_at.toString()}) while the server was down — sending immediately now`
      );
    }

    await scheduleEmailJob(row);
    requeued++;
  }

  console.log(`[reconciliation] Reconciliation: ${rows.length} jobs checked, ${requeued} re-queued, ${healthy} already healthy`);
}
