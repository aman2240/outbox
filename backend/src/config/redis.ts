import IORedis, { Redis } from "ioredis";
import { env } from "./env";

// BullMQ requires maxRetriesPerRequest: null on connections it manages.
export function createRedisConnection(): Redis {
  return new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
}

export const redis = createRedisConnection();

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (err) {
    console.error("[redis] connection check failed:", (err as Error).message);
    return false;
  }
}
