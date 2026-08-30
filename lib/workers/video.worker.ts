import { Worker } from "bullmq";
import { connection } from "@/lib/redis";
import { db } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { dispatchVideoJob } from "@/lib/video-dispatch";
import { VIDEO_QUEUE_NAME } from "@/lib/queues/video.queue";
import { releaseVideoGpu, reconcileVideoGpu } from "@/lib/runpod-pod-manager";

const concurrency = Math.max(1, Number(process.env.VIDEO_WORKER_CONCURRENCY || 2));

if (!connection) throw new Error("REDIS_URL is missing in environment variables");

export const videoWorker = new Worker(
  VIDEO_QUEUE_NAME,
  async (job) => {
    const videoJobId = String(job.data.videoJobId);
    try {
      return await dispatchVideoJob(videoJobId);
    } catch (error) {
      const record = await db.videoJob.findUnique({ where: { id: videoJobId } });
      if (!record?.externalJobId) await releaseVideoGpu().catch(() => undefined);
      if (record && !record.externalJobId && job.attemptsMade + 1 >= (record.maxAttempts || 3)) {
        await db.videoJob.update({
          where: { id: videoJobId },
          data: { status: "FAILED", error: String(error), finishedAt: new Date() },
        });
        if (record.usageId) {
          const usage = await db.usage.findUnique({ where: { id: record.usageId }, select: { referenceId: true } });
          if (usage?.referenceId) await refundCredits(usage.referenceId).catch(() => undefined);
        }
      }
      throw error;
    }
  },
  { connection, concurrency }
);

videoWorker.on("completed", (job) => console.log(`✅ Video dispatch queued: ${job.id}`));
videoWorker.on("failed", (job, error) => console.error(`❌ Video worker failed: ${job?.id}`, error));

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`🎬 AmkaAI video worker started (concurrency=${concurrency})`);
}

const gpuReconciler = setInterval(() => { reconcileVideoGpu().catch((error) => console.error("GPU reconciler failed", error)); }, 60_000);
if (typeof gpuReconciler.unref === "function") gpuReconciler.unref();
