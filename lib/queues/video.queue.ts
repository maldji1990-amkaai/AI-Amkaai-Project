import { Queue } from "bullmq";
import { connection } from "@/lib/redis";

export const VIDEO_QUEUE_NAME = "video-queue";
let queue: Queue | null = null;

export function getVideoQueue() {
  if (!connection) throw new Error("REDIS_URL is missing in environment variables");
  if (!queue) {
    queue = new Queue(VIDEO_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return queue;
}

export async function enqueueVideoJob(videoJobId: string, priority = 0) {
  return getVideoQueue().add(
    "dispatch-video",
    { videoJobId },
    { priority: Math.max(0, 100 - Math.min(100, Math.max(0, priority))) }
  );
}
