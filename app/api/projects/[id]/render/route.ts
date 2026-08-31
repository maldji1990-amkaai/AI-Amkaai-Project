import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudioUser } from "@/app/api/_studio-auth";
import { createQueuedVideoJob } from "@/lib/create-video-job";
import { startFinalComposition } from "@/lib/final-composer";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStudioUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const characterIds = Array.isArray(body?.characterIds) ? body.characterIds.map(String).slice(0, 20) : [];
    const voiceProfileId = typeof body?.voiceProfileId === "string" ? body.voiceProfileId : null;
    const project = await db.project.findFirst({ where: { id, userId: user.id }, include: { scenes: { orderBy: { index: "asc" } } } });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!project.scenes.length) return NextResponse.json({ error: "Project has no scenes" }, { status: 400 });

    const existing = await db.generation.findFirst({ where: { projectId: id, userId: user.id, status: { in: ["PENDING", "PROCESSING"] } }, orderBy: { createdAt: "desc" } });
    if (existing) return NextResponse.json({ generationId: existing.id, status: "already_processing" });

    const totalSeconds = project.scenes.reduce((sum, s) => sum + Math.max(1, s.duration), 0);
    const generation = await db.generation.create({
      data: {
        userId: user.id,
        projectId: id,
        type: "FILM",
        prompt: project.description || project.name,
        status: "PENDING",
        metadata: { totalSeconds, sceneCount: project.scenes.length, pipeline: ["storyboard", "video", "voice", "lip_sync", "music", "captions", "final_render"], characterIds, voiceProfileId, pricingMode: "included_in_video_seconds" },
      },
    });
    await db.generationStep.createMany({ data: [
      { generationId: generation.id, name: "Storyboard", status: "COMPLETED", progress: 100, finishedAt: new Date() },
      { generationId: generation.id, name: "Video Scenes", status: "PENDING", progress: 0, input: { sceneCount: project.scenes.length, totalSeconds } },
      { generationId: generation.id, name: "Voice", status: "PENDING", progress: 0 },
      { generationId: generation.id, name: "Lip Sync", status: "PENDING", progress: 0 },
      { generationId: generation.id, name: "Music", status: "PENDING", progress: 0 },
      { generationId: generation.id, name: "Captions", status: "PENDING", progress: 0 },
      { generationId: generation.id, name: "Final Render", status: "PENDING", progress: 0 },
    ] });

    const queued: any[] = [];
    for (const scene of project.scenes) {
      if (scene.status === "COMPLETED" && scene.videoUrl) continue;
      const metadata = scene.metadata && typeof scene.metadata === "object" ? scene.metadata as Record<string, unknown> : {};
      const result = await createQueuedVideoJob({
        userId: user.id,
        prompt: scene.prompt,
        duration: scene.duration,
        projectId: id,
        sceneId: scene.id,
        characterIds: scene.characterId ? [scene.characterId] : (characterIds.length ? characterIds : (Array.isArray(metadata.characterIds) ? metadata.characterIds.map(String) : [])),
        voiceProfileId: scene.voiceProfileId || voiceProfileId || (typeof metadata.voiceProfileId === "string" ? metadata.voiceProfileId : null),
        generationId: generation.id,
        referenceId: `film_${generation.id}_${scene.id}`,
        imageUrl: scene.imageUrl || null,
      });
      queued.push({ sceneId: scene.id, ...result });
      await db.scene.update({ where: { id: scene.id }, data: { status: "PROCESSING" } });
    }

    const allScenesAlreadyReady = queued.length === 0 && project.scenes.every((scene) => scene.videoUrl);
    await db.generation.update({ where: { id: generation.id }, data: { status: "PROCESSING" } });
    await db.generationStep.updateMany({ where: { generationId: generation.id, name: "Video Scenes" }, data: { status: allScenesAlreadyReady ? "COMPLETED" : "PROCESSING", progress: allScenesAlreadyReady ? 100 : 5, finishedAt: allScenesAlreadyReady ? new Date() : undefined } });
    await db.project.update({ where: { id }, data: { status: allScenesAlreadyReady ? "READY_FOR_POST" : "RENDERING" } });
    if (allScenesAlreadyReady) {
      try { await startFinalComposition(generation.id); } catch (error) { console.warn("Automatic final composition skipped:", error); }
    }
    return NextResponse.json({ generationId: generation.id, status: allScenesAlreadyReady ? "ready_for_post" : "processing", sceneCount: project.scenes.length, totalSeconds, queued });
  } catch (e: any) {
    if (String(e?.message || "").startsWith("VIDEO_DURATION_LIMIT:")) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e?.message === "NOT_ENOUGH_CREDITS") return NextResponse.json({ error: "Not enough credits to render this project." }, { status: 402 });
    return NextResponse.json({ error: "Unable to start project render" }, { status: 500 });
  }
}
