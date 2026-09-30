import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/getUser";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const jobs = await db.videoJob.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      generation: {
        select: {
          status: true,
          metadata: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        generationId: job.generationId,
        prompt: job.prompt,
        status: job.status,
        progress: job.progress ?? 0,
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
        generationStatus: job.generation?.status ?? null,
        finalVideoUrl:
          job.generation?.metadata &&
          typeof job.generation.metadata === "object" &&
          typeof (job.generation.metadata as Record<string, unknown>).finalVideoUrl === "string"
            ? (job.generation.metadata as Record<string, unknown>).finalVideoUrl
            : null,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
