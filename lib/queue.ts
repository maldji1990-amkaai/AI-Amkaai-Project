import { enqueueVideoJob } from "@/lib/queues/video.queue";

type JobType = "video" | "image" | "voice";

/**
 * Compatibility wrapper for older callers. Video jobs are now persisted in
 * BullMQ/Redis; image/voice legacy in-memory processing is intentionally not
 * started here.
 */
export async function addJob(input: { id: string; type: JobType; priority?: number }) {
  if (input.type !== "video") throw new Error("LEGACY_QUEUE_TYPE_DISABLED");
  return enqueueVideoJob(input.id, input.priority ?? 0);
}
