import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME } from "./emailQueue";
import { EmailJobData } from "../types";
import { processEmailJob } from "../jobs/processEmailJob";
import { updateEmailJobStatus } from "../db/emailJobs";

let worker: Worker<EmailJobData> | null = null;

export function startEmailWorker(): Worker<EmailJobData> {
  if (worker) return worker;

  worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: env.workerConcurrency,
    // Global send pacing: caps this worker to picking up at most 1 job per
    // MIN_DELAY_MS_BETWEEN_SENDS, regardless of concurrency. This is the
    // "minimum delay between individual sends" requirement — it throttles
    // overall throughput across the whole worker, not per-sender (that's
    // handled separately by the per-sender hourly cap in rateLimiter.ts).
    limiter: { max: 1, duration: env.minDelayMsBetweenSends },
  });

  worker.on("completed", (job) => {
    console.log(`[worker] completed job ${job.id}`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsExhausted = job.attemptsMade >= maxAttempts;
    if (attemptsExhausted) {
      console.error(`[worker] job ${job.id} exhausted all ${maxAttempts} attempts — marking failed permanently`);
      try {
        await updateEmailJobStatus(job.data.emailJobId, { status: "failed", error_message: err.message });
      } catch (updateErr) {
        console.error(`[worker] failed to persist terminal failure for job ${job.id}:`, updateErr);
      }
    }
  });

  worker.on("error", (err) => {
    // Worker-level errors (e.g. Redis connection issues) — log but never crash
    // the process; a single bad job or blip must not take down the whole server.
    console.error("[worker] worker error:", err);
  });

  return worker;
}
