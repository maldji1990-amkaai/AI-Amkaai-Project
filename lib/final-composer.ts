import { db } from "@/lib/db";

export async function startFinalComposition(generationId: string) {
  const generation = await db.generation.findUnique({
    where: { id: generationId },
    include: { project: { include: { scenes: { orderBy: { index: "asc" } } } } },
  });
  if (!generation?.project) throw new Error("GENERATION_NOT_FOUND");

  const scenes = generation.project.scenes.filter((s) => s.videoUrl).map((s) => ({ id: s.id, index: s.index, url: s.videoUrl }));
  if (!scenes.length || scenes.length !== generation.project.scenes.length) throw new Error("SCENES_NOT_READY");

  const endpointId = process.env.RUNPOD_COMPOSER_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  const secret = process.env.RUNPOD_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!endpointId || !apiKey || !secret || !appUrl) return { status: "ready_for_composition", reason: "COMPOSER_NOT_CONFIGURED" } as const;

  const meta = generation.metadata && typeof generation.metadata === "object" ? generation.metadata as Record<string, unknown> : {};
  if (typeof meta.composerJobId === "string") return { status: "composing", composerJobId: meta.composerJobId } as const;

  const voiceProfileId = typeof meta.voiceProfileId === "string" ? meta.voiceProfileId : null;
  const characterIds = Array.isArray(meta.characterIds) ? meta.characterIds.map(String) : [];
  const webhook = `${appUrl.replace(/\/$/, "")}/api/webhook/runpod?generationId=${encodeURIComponent(generationId)}&secret=${encodeURIComponent(secret)}`;
  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      input: {
        type: "AMKAAI_FINAL_RENDER",
        project_id: generation.project.id,
        generation_id: generation.id,
        scene_urls: scenes,
        aspect_ratio: generation.project.aspectRatio,
        voice_profile_id: voiceProfileId,
        character_ids: characterIds,
        pipeline: ["voice", "lip_sync", "music", "captions", "final_render"],
        // Post-production is included in the generation price. No extra user credits are charged here.
        pricing_mode: "included_in_video_seconds",
      },
      webhook,
      custom_id: generation.id,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`COMPOSER_DISPATCH_FAILED:${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  if (!data?.id) throw new Error("COMPOSER_NO_JOB_ID");

  await db.generation.update({ where: { id: generationId }, data: { status: "PROCESSING", metadata: { ...meta, composerJobId: data.id, compositionRequestedAt: new Date().toISOString(), postProductionIncluded: true } } });
  await db.generationStep.updateMany({ where: { generationId, name: { in: ["Voice", "Lip Sync", "Music", "Captions", "Final Render"] } }, data: { status: "PROCESSING", progress: 1, startedAt: new Date() } });
  await db.project.update({ where: { id: generation.project.id }, data: { status: "COMPOSING" } });
  return { status: "composing", composerJobId: data.id } as const;
}
