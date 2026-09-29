import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const user = await getOrCreateUser(clerkId);

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId")?.trim();

  if (!jobId) {
    return NextResponse.json(
      { error: "jobId is required" },
      { status: 400 },
    );
  }

  const job = await db.videoJob.findFirst({
    where: {
      id: jobId,
      userId: user.id,
    },
  });

  if (!job) {
    return NextResponse.json(
      { error: "Video job not found" },
      { status: 404 },
    );
  }

  const status = String(job.status).toUpperCase();

  return NextResponse.json(
    {
      success: true,
      jobId: job.id,
      generationId: job.generationId,
      status,
      progress: job.progress ?? 0,
      videoUrl: job.resultUrl ?? null,
      resultUrl: job.resultUrl ?? null,
      error: job.error ?? null,
      durationSeconds: job.durationSeconds,
      clipCount: job.clipCount,
      model: job.model,
      attempts: job.attempts,
      externalJobId: job.externalJobId ?? null,
      createdAt: job.createdAt,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
