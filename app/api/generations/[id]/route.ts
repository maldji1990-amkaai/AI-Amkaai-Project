import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStudioUser();
    const { id } = await params;
    const generation = await db.generation.findFirst({ where: { id, userId: user.id }, include: { steps: { orderBy: { createdAt: "asc" } }, project: { include: { scenes: { orderBy: { index: "asc" } } } }, videoJobs: true } });
    if (!generation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const totalJobs = generation.videoJobs.length;
    const completedJobs = generation.videoJobs.filter(j => j.status === "COMPLETED").length;
    const sceneProgress = totalJobs ? Math.round((completedJobs / totalJobs) * 100) : 0;
    const stepProgress = generation.steps.length ? Math.round(generation.steps.reduce((sum, s) => sum + s.progress, 0) / generation.steps.length) : 0;
    const metadata = generation.metadata && typeof generation.metadata === "object" ? generation.metadata as Record<string, unknown> : {};
    return NextResponse.json({ generation, progress: Math.max(sceneProgress, stepProgress), sceneProgress, stepProgress, readyForComposition: generation.project?.scenes.length ? generation.project.scenes.every(s => Boolean(s.videoUrl)) : false, finalVideoUrl: typeof metadata.finalVideoUrl === "string" ? metadata.finalVideoUrl : null, postProductionIncluded: metadata.postProductionIncluded === true });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
