import { db } from "@/lib/db";

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;
const PROCESS_TIMEOUT = 10 * 60 * 1000;

//////////////////////////////////////////////////
// 🚀 MAIN PROCESSOR (PRODUCTION-GRADE)
//////////////////////////////////////////////////

export async function processVideoJob(jobId: string) {
  try {
    // 🔒 ATOMIC LOCK (prevents double processing)
    const locked = await db.videoJob.updateMany({
      where: {
        id: jobId,
        status: "PENDING",
      },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    if (locked.count === 0) {
      console.log("⛔ SKIP (locked/already processed):", jobId);
      return;
    }

    const job = await db.videoJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return;

    console.log(`🎬 START VIDEO JOB: ${jobId}`);

    // ⏱ AI EXECUTION WITH SAFETY TIMEOUT
    const resultUrl = await withTimeout(
      generateVideo(job.prompt),
      PROCESS_TIMEOUT
    );

    // 💾 SUCCESS TRANSACTION (CONSISTENT STATE)
    await db.$transaction(async (tx) => {
      await tx.videoJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          resultUrl,
          finishedAt: new Date(),
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

    console.log(`✅ COMPLETED: ${jobId}`);

    return resultUrl;
  } catch (error) {
    console.error("🔥 PROCESS ERROR:", error);
    await handleFailure(jobId, error);
    throw error;
  }
}

//////////////////////////////////////////////////
// 🤖 AI LAYER (PLUG ANY PROVIDER)
//////////////////////////////////////////////////

async function generateVideo(prompt: string): Promise<string> {
  // 🔥 Replace later with:
  // - Replicate
  // - RunwayML
  // - Kling AI
  // - Pika Labs

  await new Promise((r) => setTimeout(r, 4000));

  return `https://cdn.yoursaas.com/videos/${Date.now()}.mp4`;
}

//////////////////////////////////////////////////
// ⏱ TIMEOUT WRAPPER (SAFE + CLEAN)
//////////////////////////////////////////////////

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), ms)
    ),
  ]);
}

//////////////////////////////////////////////////
// ❌ FAILURE HANDLER (NO INFINITE LOOP + SAFE RETRY)
//////////////////////////////////////////////////

async function handleFailure(jobId: string, error: any) {
  const job = await db.videoJob.findUnique({
    where: { id: jobId },
  });

  if (!job) return;

  // 🛑 HARD STOP SAFETY
  if (job.status === "COMPLETED" || job.status === "FAILED") {
    return;
  }

  const currentAttempts = job.attempts ?? 0;
  const canRetry = currentAttempts < MAX_RETRIES;

  if (canRetry) {
    const nextAttempt = currentAttempts + 1;

    const delay = Math.min(
      BASE_DELAY * Math.pow(2, currentAttempts),
      15000
    );

    console.log(
      `🔁 RETRY ${jobId} (${nextAttempt}/${MAX_RETRIES}) in ${delay}ms`
    );

    setTimeout(async () => {
      try {
        await db.videoJob.update({
          where: { id: jobId },
          data: {
            status: "PENDING",
            error: String(error),
          },
        });

        // re-run safely
        await processVideoJob(jobId);
      } catch (err) {
        console.error("Retry failed:", err);
      }
    }, delay);

    return;
  }

  // 💀 FINAL FAILURE
  await db.videoJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      error: String(error),
      finishedAt: new Date(),
    },
  });

  // 💳 SAFE REFUND (ONLY FINAL FAILURE)
  if (job.usageId) {
    await db.usage.update({
      where: { id: job.usageId },
      data: {
        status: "FAILED",
        refunded: true,
      },
    });
  }

  console.error(`❌ FINAL FAILURE: ${jobId}`);
}