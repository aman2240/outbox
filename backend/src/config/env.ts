import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  nodeEnv: optional("NODE_ENV") ?? "development",
  port: int("PORT", 4000),

  databaseUrl: required("DATABASE_URL", "postgres://reachinbox:reachinbox@localhost:5432/reachinbox"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),

  sessionSecret: required("SESSION_SECRET", "dev-only-insecure-secret"),

  googleClientId: optional("GOOGLE_CLIENT_ID"),
  googleClientSecret: optional("GOOGLE_CLIENT_SECRET"),
  googleCallbackUrl: optional("GOOGLE_CALLBACK_URL") ?? "http://localhost:4000/auth/google/callback",

  slackClientId: optional("SLACK_CLIENT_ID"),
  slackClientSecret: optional("SLACK_CLIENT_SECRET"),
  slackRedirectUri: optional("SLACK_REDIRECT_URI") ?? "http://localhost:4000/slack/callback",
  slackTestWebhookUrl: optional("SLACK_TEST_WEBHOOK_URL"),

  etherealUser: optional("ETHEREAL_USER"),
  etherealPass: optional("ETHEREAL_PASS"),

  elasticsearchUrl: optional("ELASTICSEARCH_URL") ?? "http://localhost:9200",

  workerConcurrency: int("WORKER_CONCURRENCY", 5),
  minDelayMsBetweenSends: int("MIN_DELAY_MS_BETWEEN_SENDS", 2000),
  maxEmailsPerHourPerSender: int("MAX_EMAILS_PER_HOUR_PER_SENDER", 100),

  frontendUrl: optional("FRONTEND_URL") ?? "http://localhost:3000",
};
