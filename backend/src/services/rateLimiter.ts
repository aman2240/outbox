import { redis } from "../config/redis";

/**
 * Atomically checks-and-increments a per-sender, per-UTC-hour send counter in
 * Redis. Must be atomic because multiple worker processes/concurrent jobs can
 * race to increment the same counter — a plain GET then INCR from separate
 * calls would let two jobs both see "count < limit" and both proceed,
 * overshooting the cap. A single Lua script run server-side by Redis avoids
 * that race entirely.
 */
const CHECK_AND_INCREMENT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current < limit then
  local newVal = redis.call('INCR', KEYS[1])
  if newVal == 1 then
    redis.call('EXPIRE', KEYS[1], 3600)
  end
  return {1, newVal}
else
  return {0, current}
end
`;

export function getUtcHourBucket(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}`;
}

export function getNextUtcHourStart(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

export function getStartOfUtcHour(date: Date): Date {
  const start = new Date(date);
  start.setUTCMinutes(0, 0, 0);
  return start;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  count: number;
}

export async function checkAndIncrementSenderHourlyCount(senderId: string, limit: number): Promise<RateLimitCheckResult> {
  const bucket = getUtcHourBucket(new Date());
  const key = `ratelimit:${senderId}:${bucket}`;

  const [allowedFlag, count] = (await redis.eval(CHECK_AND_INCREMENT_SCRIPT, 1, key, limit)) as [number, number];

  return { allowed: allowedFlag === 1, count };
}

/**
 * Guards against sending one Slack message per overflowing job (there could
 * be hundreds queued for the same sender/hour). Returns true only for the
 * first caller in a given sender+hour window; every subsequent call within
 * that same window returns false until the TTL expires.
 */
export async function claimRateLimitNotification(senderId: string): Promise<boolean> {
  const bucket = getUtcHourBucket(new Date());
  const key = `ratelimit:notified:${senderId}:${bucket}`;

  const result = await redis.set(key, "1", "EX", 3600, "NX");
  return result === "OK";
}
