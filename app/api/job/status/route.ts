import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const job = await db.videoJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (job.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({
      status: job.status,
      url: job.resultUrl,
      error: job.error,
      progress: job.progress,
    });
  } catch (error) {
    console.error("JOB STATUS ERROR", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
