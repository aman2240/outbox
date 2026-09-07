import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { checkPostgresConnection } from "./config/postgres";
import { checkRedisConnection } from "./config/redis";
import { checkElasticsearchConnection } from "./config/elasticsearch";

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

async function start() {
  console.log("[boot] Checking Postgres connection...");
  const dbOk = await checkPostgresConnection();
  console.log(dbOk ? "[boot] Postgres OK" : "[boot] Postgres connection FAILED");

  console.log("[boot] Checking Redis connection...");
  const redisOk = await checkRedisConnection();
  console.log(redisOk ? "[boot] Redis OK" : "[boot] Redis connection FAILED");

  app.listen(env.port, () => {
    console.log(`[boot] Server listening on port ${env.port}`);
  });
}

start().catch((err) => {
  console.error("[boot] Fatal startup error:", err);
  process.exit(1);
});
