import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { JobStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function mapStatus(status: JobStatus) {
  return ({ PENDING: "pending", PROCESSING: "processing", COMPLETED: "done", FAILED: "failed", CANCELLED: "cancelled" } as const)[status];
}

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: "jobId_required" }, { status: 400 });

    const dbUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const job = await db.videoJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    if (job.userId !== dbUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (job.status === "COMPLETED") return NextResponse.json({ status: "done", video: job.resultUrl, position: 0, estimatedTime: 0 });
    if (job.status === "FAILED") return NextResponse.json({ status: "failed", video: null, position: null, estimatedTime: 0, error: job.error ?? "Generation failed" });
    if (job.status === "CANCELLED") return NextResponse.json({ status: "cancelled", video: null, position: null, estimatedTime: 0 });

    const position = job.status === "PENDING"
      ? await db.videoJob.count({ where: { userId: dbUser.id, status: "PENDING", OR: [{ priority: { gt: job.priority } }, { priority: job.priority, createdAt: { lt: job.createdAt } }] } })
      : 0;
    const estimatedTime = position * 30;

    return NextResponse.json({
      status: mapStatus(job.status),
      video: null,
      position,
      estimatedTime: job.status === "PROCESSING" ? Math.max(estimatedTime, 5) : estimatedTime,
      progress: job.progress,
    });
  } catch (error) {
    console.error("STATUS API ERROR", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
