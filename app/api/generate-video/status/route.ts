import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const jobId = new URL(req.url).searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const job = await db.videoJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const position = job.status === "PENDING"
      ? await db.videoJob.count({ where: { userId: user.id, status: "PENDING", OR: [{ priority: { gt: job.priority } }, { priority: job.priority, createdAt: { lt: job.createdAt } }] } })
      : 0;
    const status = job.status.toLowerCase() === "completed" ? "done" : job.status.toLowerCase();
    return NextResponse.json({
      jobId: job.id,
      status,
      progress: job.status === "COMPLETED" ? 100 : job.progress,
      videoUrl: job.resultUrl,
      video: job.resultUrl,
      error: job.error,
      position,
      estimatedTime: job.status === "PENDING" ? position * 30 : job.status === "PROCESSING" ? 5 : 0,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    });
  } catch (error) {
    console.error("VIDEO STATUS ROUTE ERROR", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
