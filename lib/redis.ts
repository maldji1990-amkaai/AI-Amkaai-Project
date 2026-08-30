import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

// The connection is created lazily so importing a route during `next build`
// does not crash when REDIS_URL is intentionally absent. The first queue/worker
// operation will fail with a clear configuration error instead.
export function getRedisConnection() {
  if (!redisUrl) throw new Error("REDIS_URL is missing in environment variables");
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 5000),
    reconnectOnError: (err) => ["READONLY", "ECONNRESET", "ETIMEDOUT"].some((e) => err.message.includes(e)),
    keepAlive: 30000,
    family: 4,
    lazyConnect: false,
    enableOfflineQueue: true,
  });
}

// Backward-compatible singleton for workers/legacy code.
export const connection = redisUrl ? getRedisConnection() : undefined;
