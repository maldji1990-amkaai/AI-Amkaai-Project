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
    // 🔒 STRONG ATOMIC LOCK
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
      console.log("⛔ Already locked or processed:", jobId);
      return null;
    }

    //////////////////////////////////////////////////
    // 📦 LOAD JOB
    //////////////////////////////////////////////////

    const job = await db.videoJob.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      throw new Error("Job not found");
    }

    //////////////////////////////////////////////////
    // 🔄 UPDATE PROGRESS
    //////////////////////////////////////////////////

    await db.videoJob.update({
      where: { id: jobId },
      data: {
        progress: 10,
      },
    });

    console.log(`🚀 START VIDEO GENERATION: ${jobId}`);

    //////////////////////////////////////////////////
    // 🤖 GENERATE VIDEO
    //////////////////////////////////////////////////

    const resultUrl = await withTimeout(
      generateVideo(job.prompt),
      PROCESS_TIMEOUT
    );

    //////////////////////////////////////////////////
    // 💾 SUCCESS TRANSACTION
    //////////////////////////////////////////////////

    await db.$transaction(async (tx) => {
      await tx.videoJob.update({
        where: {
          id: jobId,
        },
        data: {
          status: "COMPLETED",
          resultUrl,
          finishedAt: new Date(),
          progress: 100,
          error: null,
        },
      });

      //////////////////////////////////////////////////
      // 💳 COMPLETE USAGE
      //////////////////////////////////////////////////

      if (job.usageId) {
        await tx.usage.update({
          where: {
            id: job.usageId,
          },
          data: {
            status: "COMPLETED",
          },
        });
      }
    });

    console.log(`✅ VIDEO COMPLETED: ${jobId}`);

    return {
      success: true,
      resultUrl,
    };
  } catch (error) {
    console.error("🔥 VIDEO WORKER ERROR:", error);

    await handleFailure(jobId, error);

    return {
      success: false,
      error: String(error),
    };
  }
}

//////////////////////////////////////////////////
// 🤖 AI GENERATION LAYER
//////////////////////////////////////////////////

async function generateVideo(prompt: string): Promise<string> {
  console.log("🤖 Generating AI Video:", prompt);

  //////////////////////////////////////////////////
  // 🔥 FUTURE PROVIDERS
  //////////////////////////////////////////////////

  // - RunwayML
  // - Kling AI
  // - Pika Labs
  // - Replicate
  // - Stability AI

  //////////////////////////////////////////////////
  // ⏳ SIMULATION
  //////////////////////////////////////////////////

  await new Promise((resolve) =>
    setTimeout(resolve, 4000)
  );

  //////////////////////////////////////////////////
  // 📦 RESULT
  //////////////////////////////////////////////////

  return `https://cdn.yoursaas.com/videos/${Date.now()}.mp4`;
}

//////////////////////////////////////////////////
// ⏱ SAFE TIMEOUT WRAPPER
//////////////////////////////////////////////////

function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return Promise.race([
    promise,

    new Promise<T>((_, reject) =>
      setTimeout(() => {
        reject(new Error("AI generation timeout"));
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
      where: {
        id: jobId,
      },
    });

    if (!job) {
      return;
    }

    const currentAttempts = job.attempts ?? 0;

    const canRetry =
      currentAttempts < MAX_RETRIES;

    //////////////////////////////////////////////////
    // 🔁 RETRY
    //////////////////////////////////////////////////

    if (canRetry) {
      const nextAttempt =
        currentAttempts + 1;

      const delay = Math.min(
        BASE_DELAY * 2 ** currentAttempts,
        15000
      );

      console.log(
        `🔁 RETRY ${jobId} (${nextAttempt}/${MAX_RETRIES}) in ${delay}ms`
      );

      //////////////////////////////////////////////////
      // RESET TO PENDING
      //////////////////////////////////////////////////

      await db.videoJob.update({
        where: {
          id: jobId,
        },
        data: {
          status: "PENDING",
          error: String(error),
          progress: 0,
        },
      });

      //////////////////////////////////////////////////
      // SAFE DELAY RETRY
      //////////////////////////////////////////////////

      setTimeout(async () => {
        try {
          await processVideoJob(jobId, {
            attemptsMade: nextAttempt,
          });
        } catch (retryError) {
          console.error(
            "Retry process failed:",
            retryError
          );
        }
      }, delay);

      return;
    }

    //////////////////////////////////////////////////
    // 💀 FINAL FAILURE
    //////////////////////////////////////////////////

    await db.videoJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: "FAILED",
        error: String(error),
        finishedAt: new Date(),
        progress: 0,
      },
    });

    //////////////////////////////////////////////////
    // 💳 REFUND USAGE
    //////////////////////////////////////////////////

    if (job.usageId) {
      await db.usage.update({
        where: {
          id: job.usageId,
        },
        data: {
          status: "FAILED",
          refunded: true,
        },
      });
    }

    console.error(
      `❌ FINAL FAILURE: ${jobId}`
    );
  } catch (fatalError) {
    console.error(
      "💀 FATAL FAILURE HANDLER ERROR:",
      fatalError
    );
  }
}