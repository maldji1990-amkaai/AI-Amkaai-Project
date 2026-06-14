type JobType = "video" | "image" | "voice";

export type Job = {
  id: string;
  type: JobType;
  retries: number;
  priority: number;
  createdAt: number;
  lastError?: string;
};

// =====================================
// 🧠 QUEUE STORAGE (In-Memory Heap Matrix)
// =====================================

const queue: Job[] = [];

// 🔒 صمامات الأمان والتحكم بالتوازي (Execution Safety Locks)
let isProcessing = false;
let activeJobs = 0;

// ⚡ إعدادات الجدولة والتحميل للإنتاجية (SaaS tuning)
const MAX_RETRIES = 3;
const CONCURRENCY = 2;
const MAX_QUEUE_SIZE = 500;

// =====================================
// 🚀 ADD JOB (SAFE ENTRY POINT)
// =====================================

export function addJob(input: {
  id: string;
  type: JobType;
  priority?: number;
}) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    console.warn("⚠️ [QUEUE OVERFLOW] Cluster full, rejecting job placement for:", input.id);
    return;
  }

  const job: Job = {
    id: input.id,
    type: input.type,
    retries: 0,
    priority: input.priority ?? 0,
    createdAt: Date.now(),
  };

  queue.push(job);

  sortQueue();
  trigger();
}

// =====================================
// ⚡ TRIGGER PROCESSING ENGINE
// =====================================

function trigger() {
  if (isProcessing) return;

  isProcessing = true;
  void processQueue();
}

// =====================================
// 🔄 MAIN LOOP (SAFE CONCURRENCY STEERING)
// =====================================

async function processQueue() {
  try {
    while (queue.length > 0) {
      if (activeJobs >= CONCURRENCY) {
        await sleep(100);
        continue;
      }

      const job = queue.shift();
      if (!job) continue;

      activeJobs++;

      executeJob(job).finally(() => {
        activeJobs--;
      });
    }
  } catch (err) { // 🛠️ تم التصحيح هنا من throws إلى catch ليعمل الـ Build بنجاح
    console.error("🔥 Critical failure inside cluster engine main-loop:", err);
  } finally {
    isProcessing = false;
  }
}

// =====================================
// 🧠 EXECUTE CORE JOB IN ISOLATION
// =====================================

async function executeJob(job: Job) {
  const start = Date.now();

  console.log(
    `🚀 [GPU MATRIX ENTRANCE] START job=${job.id} type=${job.type} retry=${job.retries}`
  );

  try {
    await handleJob(job);

    console.log(
      `✅ [GPU MATRIX SUCCESS] DONE job=${job.id} execution took ${Date.now() - start}ms`
    );
  } catch (err: any) {
    console.error(`❌ [GPU MATRIX FAILURE] FAIL job=${job.id}`, err?.message);

    await handleFailure(job, err);
  }
}

// =====================================
// 🔧 JOB ROUTER & DISPATCHER
// =====================================

async function handleJob(job: Job) {
  switch (job.type) {
    case "video": {
      const { processVideoJob } = await import("./workers/video.worker");
      return processVideoJob(job.id);
    }

    case "image": {
      const { processImageJob } = await import("./workers/image.worker");
      return processImageJob(job.id);
    }

    case "voice": {
      const { processVoiceJob } = await import("./workers/voice.worker");
      return processVoiceJob(job.id);
    }

    default:
      throw new Error(`Unknown pipeline assignment type: ${job.type}`);
  }
}

// =====================================
// ❌ FAILURE HANDLER WITH BACKOFF STRATEGY
// =====================================

async function handleFailure(job: Job, err: any) {
  const nextRetry = job.retries + 1;

  job.lastError = err?.message ?? "unknown cluster render failure";

  // 🔁 التحقق من إمكانية إعادة المحاولة برمجياً
  if (nextRetry <= MAX_RETRIES) {
    const delayMs = backoff(nextRetry);

    console.log(
      `🔁 [RETRY SCHEDULING] Re-injecting job=${job.id} sequence ${nextRetry}/${MAX_RETRIES} after delay ${delayMs}ms`
    );

    setTimeout(() => {
      queue.push({
        ...job,
        retries: nextRetry,
      });

      sortQueue();
      trigger();
    }, delayMs);

    return;
  }

  // 💀 الفشل النهائي وإغلاق المعاملة
  console.error(`💀 [FATAL RENDERING COLLAPSE] FINAL FAIL for job=${job.id}. Initiating safe fallback hooks.`);

  await markJobFailed(job);
}

// =====================================
// 💀 FINAL FAILURE HOOK & AUTO-REFUND SHIELD
// =====================================

async function markJobFailed(job: Job) {
  try {
    const { db } = await import("@/lib/db");
    const { refundCredits } = await import("@/lib/credits");

    // 1. تحديث حالة الـ Job المخصصة في قاعدة البيانات بناءً على نوعها
    if (job.type === "video") {
      await db.videoJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: job.lastError ?? "Unknown API Failure",
          finishedAt: new Date(),
        },
      });
    } else if (job.type === "voice") {
      await db.voiceJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: job.lastError ?? "Unknown Audio Failure",
          finishedAt: new Date(),
        },
      });
    }

    // 2. تفعيل صمام أمان استرجاع النقاط للمستخدم فوراً لحمايته
    console.log(`💸 [AUTO-REFUND PROTOCOL ACTIVATED] Triggering refund sequence for referenceId/jobId: ${job.id}`);
    await refundCredits(job.id);

  } catch (e) {
    console.error("⚠️ [CRITICAL EXTENSION ERROR] DB or Refund failure handling final job crash:", e);
  }
}

// =====================================
// 📊 PRIORITY SORTING ALGORITHM
// =====================================

function sortQueue() {
  queue.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }

    return a.createdAt - b.createdAt;
  });
}

// =====================================
// ⏱ BACKOFF EXPONENTIAL STRATEGY
// =====================================

function backoff(retry: number) {
  return Math.min(1000 * 2 ** retry, 30000);
}

// =====================================
// ⏱ UTIL HELPERS
// =====================================

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// =====================================
// 📡 CLUSTER MONITORING TERMINAL LOGS
// =====================================

if (process.env.NODE_ENV !== "production") {
  if (typeof global !== "undefined") {
    // منع تكرار الـ Intervals في وضع الـ Hot Reload الخاص بـ Next.js Dev Mode
    const globalObj = global as any;
    if (!globalObj.__queue_logger_attached__) {
      globalObj.__queue_logger_attached__ = true;
      setInterval(() => {
        if (queue.length > 0 || activeJobs > 0) {
          console.log(`📊 [CLUSTER ANALYTICS] Active render channels=${activeJobs} | Waiting in queue=${queue.length}`);
        }
      }, 7000);
    }
  }
}