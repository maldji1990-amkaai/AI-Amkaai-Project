import { db } from "@/lib/db";

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;
const PROCESS_TIMEOUT = 10 * 60 * 1000;

//////////////////////////////////////////////////
// 🚀 MAIN PROCESSOR (PRODUCTION SAFE)
//////////////////////////////////////////////////

export async function processVideoJob(
  jobId: string,
  options?: {
    priority?: number;
    attemptsMade?: number;
  }
) {
  try {
    console.log("🎬 Processing:", {
      jobId,
      priority: options?.priority,
      attemptsMade: options?.attemptsMade,
    });

    //////////////////////////////////////////////////
    // 🔒 ATOMIC LOCK
    //////////////////////////////////////////////////

    const locked = await db.videoJob.updateMany({
      where: {
        id: jobId,
        status: "PENDING",
      },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    });

    if (locked.count === 0) {
      console.log("⛔ Already locked:", jobId);
      return null;
    }

    //////////////////////////////////////////////////
    // 📦 LOAD JOB
    //////////////////////////////////////////////////

    const job = await db.videoJob.findUnique({
      where: { id: jobId },
    });

    if (!job) throw new Error("Job not found");

    //////////////////////////////////////////////////
    // 📊 PROGRESS
    //////////////////////////////////////////////////

    await db.videoJob.update({
      where: { id: jobId },
      data: { progress: 10 },
    });

    console.log("🚀 START:", job.prompt);

    //////////////////////////////////////////////////
    // 🤖 GENERATE VIDEO
    //////////////////////////////////////////////////

    const resultUrl = await withTimeout(
      generateVideo(job.prompt),
      PROCESS_TIMEOUT
    );

    //////////////////////////////////////////////////
    // 💾 SUCCESS
    //////////////////////////////////////////////////

    await db.$transaction(async (tx) => {
      await tx.videoJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          resultUrl,
          finishedAt: new Date(),
          progress: 100,
          error: null,
        },
      });

      if (job.usageId) {
        await tx.usage.update({
          where: { id: job.usageId },
          data: {
            status: "COMPLETED",
          },
        });
      }
    });

    console.log("✅ DONE:", resultUrl);

    return {
      success: true,
      resultUrl,
    };

  } catch (error) {
    console.error("🔥 VIDEO ERROR:", error);

    await handleFailure(jobId, error);

    return {
      success: false,
      error: String(error),
    };
  }
}

//////////////////////////////////////////////////
// 🤖 AI GENERATION (🔥 FIX HERE)
//////////////////////////////////////////////////

async function generateVideo(prompt: string): Promise<string> {
  console.log("🤖 AI PROMPT:", prompt);

  //////////////////////////////////////////////////
  // ⏳ SIMULATION
  //////////////////////////////////////////////////
  await new Promise((r) => setTimeout(r, 4000));

  //////////////////////////////////////////////////
  // 🎯 DYNAMIC RESULT (IMPORTANT FIX)
  //////////////////////////////////////////////////

  const safePrompt = encodeURIComponent(prompt);

  return `https://dummyvideo.com/1280x720.mp4?prompt=${safePrompt}&id=${Date.now()}`;
}

//////////////////////////////////////////////////
// ⏱ TIMEOUT
//////////////////////////////////////////////////

function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        reject(new Error("AI timeout"));
      }, ms)
    ),
  ]);
}

//////////////////////////////////////////////////
// ❌ FAILURE HANDLER
//////////////////////////////////////////////////

async function handleFailure(
  jobId: string,
  error: unknown
) {
  try {
    const job = await db.videoJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return;

    const attempts = job.attempts ?? 0;
    const canRetry = attempts < MAX_RETRIES;

    //////////////////////////////////////////////////
    // 🔁 RETRY
    //////////////////////////////////////////////////

    if (canRetry) {
      const delay = Math.min(
        BASE_DELAY * 2 ** attempts,
        15000
      );

      console.log(`🔁 RETRY in ${delay}ms`);

      await db.videoJob.update({
        where: { id: jobId },
        data: {
          status: "PENDING",
          error: String(error),
          progress: 0,
        },
      });

      setTimeout(() => {
        processVideoJob(jobId, {
          attemptsMade: attempts + 1,
        });
      }, delay);

      return;
    }

    //////////////////////////////////////////////////
    // 💀 FINAL FAILURE
    //////////////////////////////////////////////////

    await db.videoJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: String(error),
        finishedAt: new Date(),
        progress: 0,
      },
    });

    if (job.usageId) {
      await db.usage.update({
        where: { id: job.usageId },
        data: {
          status: "FAILED",
          refunded: true,
        },
      });
    }

    console.error("❌ FINAL FAILURE:", jobId);

  } catch (fatalError) {
    console.error("💀 FATAL:", fatalError);
  }
}