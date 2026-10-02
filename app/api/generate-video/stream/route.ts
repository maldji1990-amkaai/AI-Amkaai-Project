import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return new Response("jobId required", { status: 400 });

  const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) return new Response("User not found", { status: 404 });
  const ownedJob = await db.videoJob.findFirst({ where: { id: jobId, userId: user.id }, select: { id: true } });
  if (!ownedJob) return new Response("Not found", { status: 404 });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        while (true) {
          const job = await db.videoJob.findFirst({
            where: { id: jobId, userId: user.id },
            select: { status: true, progress: true, resultUrl: true, error: true, input: true },
          });
          if (!job) { send({ status: "not_found" }); break; }
          const input = job.input && typeof job.input === "object"
            ? (job.input as Record<string, unknown>)
            : {};
          const progress = job.status === "COMPLETED" ? 100 : job.status === "FAILED" || job.status === "CANCELLED" ? (job.progress ?? 0) : Math.max(5, job.progress ?? 5);
          send({
            status: job.status.toLowerCase(),
            progress,
            stage: typeof input.progress_stage === "string" ? input.progress_stage : null,
            clip: typeof input.progress_clip === "number" ? input.progress_clip : null,
            clipCount: typeof input.progress_clip_count === "number" ? input.progress_clip_count : null,
            step: typeof input.progress_step === "number" ? input.progress_step : null,
            totalSteps: typeof input.progress_total_steps === "number" ? input.progress_total_steps : null,
            video: job.resultUrl ?? null,
            error: job.error ?? null,
          });
          if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        send({ status: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
