import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { checkPostgresConnection } from "./config/postgres";
import { checkRedisConnection } from "./config/redis";
import { checkElasticsearchConnection } from "./config/elasticsearch";
import { runMigrations } from "./db/migrate";
import { reconcileJobsOnStartup } from "./services/reconciliation";
import { startEmailWorker } from "./queues/emailWorker";
import { debugRouter } from "./routes/debug";

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());

app.get("/health", async (_req, res) => {
  const [db, redisOk, elasticsearch] = await Promise.all([
    checkPostgresConnection(),
    checkRedisConnection(),
    checkElasticsearchConnection(),
  ]);
  res.json({ status: "ok", db, redis: redisOk, elasticsearch });
});

app.use("/debug", debugRouter);

async function start() {
  console.log("[boot] Checking Postgres connection...");
  const dbOk = await checkPostgresConnection();
  console.log(dbOk ? "[boot] Postgres OK" : "[boot] Postgres connection FAILED");
  if (!dbOk) {
    console.error("[boot] Cannot continue without Postgres. Exiting.");
    process.exit(1);
  }

  console.log("[boot] Checking Redis connection...");
  const redisOk = await checkRedisConnection();
  console.log(redisOk ? "[boot] Redis OK" : "[boot] Redis connection FAILED");
  if (!redisOk) {
    console.error("[boot] Cannot continue without Redis. Exiting.");
    process.exit(1);
  }

  console.log("[boot] Running migrations...");
  await runMigrations();

  console.log("[boot] Reconciling jobs from before this boot...");
  await reconcileJobsOnStartup();

  console.log("[boot] Starting email worker...");
  startEmailWorker();

  app.listen(env.port, () => {
    console.log(`[boot] Server listening on port ${env.port}`);
  });
}

start().catch((err) => {
  console.error("[boot] Fatal startup error:", err);
  process.exit(1);
});
