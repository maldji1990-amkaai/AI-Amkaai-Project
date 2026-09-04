import { Worker } from "bullmq";
import { connection } from "@/lib/redis";
import { db } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { dispatchVideoJob } from "@/lib/video-dispatch";
import { VIDEO_QUEUE_NAME, getVideoQueue } from "@/lib/queues/video.queue";
import { createServer } from "node:http";

const concurrency = Math.max(1, Number(process.env.VIDEO_WORKER_CONCURRENCY || 1));
const healthPort = Number(process.env.VIDEO_WORKER_HEALTH_PORT || 0);
if (!connection) throw new Error("REDIS_URL is missing in environment variables");
const redisConnection = connection;

export const videoWorker = new Worker(
  VIDEO_QUEUE_NAME,
  async (job) => {
    const videoJobId = String(job.data.videoJobId);
    try {
      return await dispatchVideoJob(videoJobId);
    } catch (error) {
      const errorMessage = String(error);
      const gpuCapacityUnavailable =
        error instanceof Error &&
        error.message.startsWith("RUNPOD_GPU_CAPACITY_UNAVAILABLE:");

      // GPU capacity is transient: keep the video retryable and do not refund
      // credits just because RunPod has no compatible GPU at this moment.
      if (!gpuCapacityUnavailable) {
        const record = await db.videoJob.findUnique({ where: { id: videoJobId } });
        if (record && !record.externalJobId && job.attemptsMade + 1 >= (record.maxAttempts || 3)) {
          await db.videoJob.updateMany({
            where: { id: videoJobId, status: { in: ["PENDING", "PROCESSING"] } },
            data: { status: "FAILED", error: errorMessage, finishedAt: new Date() },
          });
          if (record.usageId) {
            const usage = await db.usage.findUnique({
              where: { id: record.usageId },
              select: { referenceId: true },
            });
            if (usage?.referenceId) await refundCredits(usage.referenceId).catch(() => undefined);
          }
        }
      }
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency,
    lockDuration: Number(process.env.VIDEO_WORKER_LOCK_DURATION_MS || 120_000),
    stalledInterval: Number(process.env.VIDEO_WORKER_STALLED_INTERVAL_MS || 30_000),
    maxStalledCount: 2,
  }
);

videoWorker.on("completed", job => console.log(`VIDEO_WORKER completed dispatch job=${job.id}`));
videoWorker.on("failed", (job, error) => console.error(`VIDEO_WORKER failed job=${job?.id}`, error));
videoWorker.on("error", error => console.error("VIDEO_WORKER error", error));

let healthServer: ReturnType<typeof createServer> | null = null;
if (healthPort > 0) {
  healthServer = createServer(async (_req, res) => {
    try {
      const counts = await getVideoQueue().getJobCounts();
      res.writeHead(videoWorker.isRunning() ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: videoWorker.isRunning(), worker: "video", counts, pid: process.pid, uptime: process.uptime() }));
    } catch (error) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(error) }));
    }
  });
  healthServer.listen(healthPort, "0.0.0.0", () => console.log(`VIDEO_WORKER health listening on :${healthPort}`));
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`VIDEO_WORKER shutting down (${signal})`);
  healthServer?.close();
  await videoWorker.close();
  await redisConnection.quit().catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", error => { console.error("VIDEO_WORKER uncaughtException", error); void shutdown("uncaughtException"); });
process.on("unhandledRejection", error => console.error("VIDEO_WORKER unhandledRejection", error));

console.log(`AmkaAI video worker started concurrency=${concurrency}`);
