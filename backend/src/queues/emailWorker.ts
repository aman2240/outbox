import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME } from "./emailQueue";
import { EmailJobData } from "../types";
import { processEmailJob } from "../jobs/processEmailJob";

let worker: Worker<EmailJobData> | null = null;

export function startEmailWorker(): Worker<EmailJobData> {
  if (worker) return worker;

  worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: env.workerConcurrency,
  });

  worker.on("completed", (job) => {
    console.log(`[worker] completed job ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    // Worker-level errors (e.g. Redis connection issues) — log but never crash
    // the process; a single bad job or blip must not take down the whole server.
    console.error("[worker] worker error:", err);
  });

  return worker;
}
