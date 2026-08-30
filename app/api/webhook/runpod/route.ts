import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundCredits, markUsageSuccess } from "@/lib/credits";
import { startFinalComposition } from "@/lib/final-composer";
import { releaseVideoGpu } from "@/lib/runpod-pod-manager";

export const dynamic = "force-dynamic";

async function refreshGeneration(generationId: string) {
  const generation = await db.generation.findUnique({ where: { id: generationId }, include: { videoJobs: true, project: true } });
  if (!generation) return;
  const videoJobs = generation.videoJobs;
  const total = videoJobs.length;
  const completed = videoJobs.filter(j => j.status === "COMPLETED").length;
  const failed = videoJobs.some(j => j.status === "FAILED" || j.status === "CANCELLED");
  const progress = total ? Math.round((completed / total) * 100) : 0;

  await db.generationStep.updateMany({ where: { generationId, name: "Video Scenes" }, data: { progress, status: failed ? "FAILED" : completed === total ? "COMPLETED" : "PROCESSING", finishedAt: completed === total ? new Date() : undefined } });

  if (failed) {
    await db.generation.update({ where: { id: generationId }, data: { status: "FAILED", error: "One or more scene renders failed" } });
    if (generation.projectId) await db.project.update({ where: { id: generation.projectId }, data: { status: "ERROR" } }).catch(() => undefined);
    return;
  }
  if (total > 0 && completed === total) {
    await db.generation.update({ where: { id: generationId }, data: { status: "PROCESSING" } });
    if (generation.projectId) await db.project.update({ where: { id: generation.projectId }, data: { status: "READY_FOR_POST" } }).catch(() => undefined);
    // Automatically continue the same paid generation into post-production. No extra credits are charged.
    try {
      await startFinalComposition(generationId);
    } catch (error) {
      console.warn("Automatic post-production dispatch skipped:", error);
    }
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    const secret = url.searchParams.get("secret");
    if (!process.env.RUNPOD_WEBHOOK_SECRET || secret !== process.env.RUNPOD_WEBHOOK_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const generationId = url.searchParams.get("generationId");
    const body = await req.json();
    if (generationId) {
      const generation = await db.generation.findUnique({ where: { id: generationId }, include: { project: true } });
      if (!generation) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
      const status = String(body?.status || "").toUpperCase();
      const finalUrl = body?.output?.final_video_url || body?.output?.video_url || body?.output?.url;
      if (status === "COMPLETED" && finalUrl) {
        await db.generation.update({ where: { id: generationId }, data: { status: "COMPLETED", metadata: { ...(generation.metadata && typeof generation.metadata === "object" ? generation.metadata as Record<string, unknown> : {}), finalVideoUrl: String(finalUrl), completedAt: new Date().toISOString() } } });
        await db.generationStep.updateMany({ where: { generationId }, data: { status: "COMPLETED", progress: 100, finishedAt: new Date(), output: { finalVideoUrl: String(finalUrl) } } });
        if (generation.projectId) { await db.project.update({ where: { id: generation.projectId }, data: { status: "COMPLETED" } }); await db.asset.create({ data: { userId: generation.userId, projectId: generation.projectId, name: "Final video", type: "VIDEO", url: String(finalUrl), metadata: { generationId } } }); }
        return NextResponse.json({ success: true });
      }
      if (status === "FAILED" || body?.error || body?.output?.error) {
        const msg = String(body?.error || body?.output?.error || "Final render failed");
        await db.generation.update({ where: { id: generationId }, data: { status: "FAILED", error: msg } });
        await db.generationStep.updateMany({ where: { generationId }, data: { status: "FAILED", error: msg, finishedAt: new Date() } });
        if (generation.projectId) await db.project.update({ where: { id: generation.projectId }, data: { status: "ERROR" } });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: true, ignored: true });
    }
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const job = await db.videoJob.findUnique({ where: { id: jobId }, include: { generation: true } });
    if (!job) return NextResponse.json({ error: "VideoJob not found" }, { status: 404 });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) return NextResponse.json({ duplicate: true });

    const status = String(body?.status || "").toUpperCase();
    const externalId = typeof body?.id === "string" ? body.id : null;
    if (job.externalJobId && externalId && job.externalJobId !== externalId) return NextResponse.json({ error: "External job mismatch" }, { status: 409 });

    const input = job.input && typeof job.input === "object" ? job.input as Record<string, unknown> : {};
    const sceneId = typeof input.scene_id === "string" ? input.scene_id : (job.generation?.metadata && typeof job.generation.metadata === "object" ? (job.generation.metadata as any).sceneId : null);

    if (status === "COMPLETED" && body?.output?.video_url) {
      const videoUrl = String(body.output.video_url);
      await db.$transaction(async tx => {
        await tx.videoJob.updateMany({ where: { id: jobId, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "COMPLETED", resultUrl: videoUrl, finishedAt: new Date(), progress: 100, error: null } });
        if (job.generationId) {
          await tx.generationStep.updateMany({ where: { generationId: job.generationId, name: "Video Render" }, data: { status: "COMPLETED", progress: 100, finishedAt: new Date(), output: { videoUrl } } });
        }
        if (sceneId) {
          await tx.scene.updateMany({ where: { id: sceneId }, data: { status: "COMPLETED", videoUrl } });
          await tx.asset.create({ data: { userId: job.userId, projectId: job.generation?.projectId || null, sceneId, name: "Scene video", type: "VIDEO", url: videoUrl, duration: job.durationSeconds || undefined, metadata: { generationId: job.generationId || null, clipCount: job.clipCount || null } } });
        }
      });
      if (job.usageId) {
        const usage = await db.usage.findUnique({ where: { id: job.usageId }, select: { referenceId: true } });
        if (usage?.referenceId) await markUsageSuccess(usage.referenceId);
      }
      await releaseVideoGpu(job.id).catch(() => undefined);
      if (job.generationId) await refreshGeneration(job.generationId);
      return NextResponse.json({ success: true });
    }

    if (["FAILED", "CANCELLED"].includes(status) || body?.error || body?.output?.error) {
      const msg = String(body?.error || body?.output?.error || `RunPod status: ${status || "unknown"}`);
      await db.$transaction(async tx => {
        await tx.videoJob.updateMany({ where: { id: jobId, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED", error: msg, finishedAt: new Date() } });
        if (sceneId) await tx.scene.updateMany({ where: { id: sceneId }, data: { status: "FAILED" } });
        if (job.generationId) await tx.generationStep.updateMany({ where: { generationId: job.generationId, name: "Video Render" }, data: { status: "FAILED", error: msg, finishedAt: new Date() } });
      });
      if (job.usageId) {
        const usage = await db.usage.findUnique({ where: { id: job.usageId }, select: { referenceId: true } });
        if (usage?.referenceId) await refundCredits(usage.referenceId).catch(e => console.error("Webhook refund failed", e));
      }
      await releaseVideoGpu(job.id).catch(() => undefined);
      if (job.generationId) await refreshGeneration(job.generationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, ignored: true });
  } catch (e) {
    console.error("RUNPOD WEBHOOK ERROR", e);
    return NextResponse.json({ error: "Internal webhook error" }, { status: 500 });
  }
}
