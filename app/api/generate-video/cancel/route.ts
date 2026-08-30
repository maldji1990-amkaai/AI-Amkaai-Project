import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { cancelVideoOnPod } from "@/lib/runpod-pod-manager";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: "jobId_required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const job = await db.videoJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    if (job.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) return NextResponse.json({ error: "job_already_finalized" }, { status: 400 });

    const updated = await db.videoJob.updateMany({
      where: { id: jobId, userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "CANCELLED", finishedAt: new Date(), error: "Cancelled by user" },
    });
    if (updated.count === 0) return NextResponse.json({ error: "job_already_finalized" }, { status: 409 });

    if (job.externalJobId) {
      try {
        const input = job.input && typeof job.input === "object" ? job.input as Record<string, unknown> : {};
        await cancelVideoOnPod(typeof input.runpod_pod_id === "string" ? input.runpod_pod_id : null, job.externalJobId);
      } catch (error) {
        console.error("RunPod cancellation failed", error);
      }
    }

    if (job.usageId) {
      const usage = await db.usage.findUnique({ where: { id: job.usageId }, select: { referenceId: true } });
      if (usage?.referenceId) await refundCredits(usage.referenceId).catch((error) => console.error("Cancel refund failed", error));
    }

    return NextResponse.json({ success: true, status: "cancelled" });
  } catch (error) {
    console.error("CANCEL JOB ERROR", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
