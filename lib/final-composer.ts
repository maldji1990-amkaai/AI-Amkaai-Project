import { db } from "@/lib/db";

async function ensurePostProductionSteps(generationId: string) {
  const names = ["Voice", "Lip Sync", "Music", "Captions", "Final Render"];
  await Promise.all(
    names.map(async (name) => {
      const existing = await db.generationStep.findFirst({
        where: { generationId, name },
        select: { id: true },
      });

      if (existing) {
        await db.generationStep.update({
          where: { id: existing.id },
          data: {
            status: "PROCESSING",
            progress: 1,
            startedAt: new Date(),
            error: null,
          },
        });
      } else {
        await db.generationStep.create({
          data: {
            generationId,
            name,
            status: "PROCESSING",
            progress: 1,
            startedAt: new Date(),
          },
        });
      }
    }),
  );
}

export async function startFinalComposition(generationId: string) {
  const generation = await db.generation.findUnique({
    where: { id: generationId },
    include: {
      project: {
        include: {
          scenes: { orderBy: { index: "asc" } },
        },
      },
    },
  });

  if (!generation?.project) throw new Error("GENERATION_NOT_FOUND");

  const scenes = generation.project.scenes
    .filter((scene) => scene.videoUrl)
    .map((scene) => ({
      id: scene.id,
      index: scene.index,
      url: scene.videoUrl as string,
      // Voice generation stores the actual audio file here.
      // This is intentionally separate from a possible Wav2Lip video URL.
      audio_url: scene.audioUrl || null,
    }));

  if (!scenes.length || scenes.length !== generation.project.scenes.length) {
    throw new Error("SCENES_NOT_READY");
  }

  const endpointId = process.env.RUNPOD_COMPOSER_ENDPOINT_ID;
  const apiKey = process.env.RUNPOD_API_KEY;
  const secret = process.env.RUNPOD_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!endpointId || !apiKey || !secret || !appUrl) {
    return {
      status: "ready_for_composition",
      reason: "COMPOSER_NOT_CONFIGURED",
    } as const;
  }

  const meta =
    generation.metadata && typeof generation.metadata === "object"
      ? (generation.metadata as Record<string, unknown>)
      : {};

  if (typeof meta.composerJobId === "string") {
    return {
      status: "composing",
      composerJobId: meta.composerJobId,
    } as const;
  }

  const voiceProfileId =
    typeof meta.voiceProfileId === "string" ? meta.voiceProfileId : null;

  const characterIds = Array.isArray(meta.characterIds)
    ? meta.characterIds.map(String)
    : [];

  const voiceProfile = voiceProfileId
    ? await db.voiceProfile.findFirst({
        where: {
          id: voiceProfileId,
          userId: generation.userId,
        },
        select: {
          id: true,
          name: true,
          language: true,
          audioUrl: true,
          provider: true,
          providerId: true,
        },
      })
    : null;

  // The generated audio is stored independently of a lip-sync video.
  // Prefer the generation-level audio, then the linked voice profile, then
  // the first scene audio as a safe fallback for the composer.
  const voiceAudioUrl =
    typeof meta.voiceAudioUrl === "string"
      ? meta.voiceAudioUrl
      : voiceProfile?.audioUrl || scenes.find((scene) => scene.audio_url)?.audio_url || null;

  const webhook = `${appUrl.replace(/\/$/, "")}/api/webhook/runpod?generationId=${encodeURIComponent(
    generationId,
  )}&secret=${encodeURIComponent(secret)}`;

  const response = await fetch(
    `https://api.runpod.ai/v2/${endpointId}/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          type: "AMKAAI_FINAL_RENDER",
          project_id: generation.project.id,
          generation_id: generation.id,
          scene_urls: scenes,
          aspect_ratio: generation.project.aspectRatio,
          voice_profile_id: voiceProfileId,
          voice_profile: voiceProfile
            ? {
                id: voiceProfile.id,
                name: voiceProfile.name,
                language: voiceProfile.language,
                audio_url: voiceProfile.audioUrl || null,
                provider: voiceProfile.provider,
                provider_id: voiceProfile.providerId,
              }
            : null,
          voice_audio_url: voiceAudioUrl,
          character_ids: characterIds,
          pipeline: [
            "voice",
            "lip_sync",
            "music",
            "captions",
            "final_render",
          ],
          // Post-production is included in the generation price. No extra user credits are charged here.
          pricing_mode: "included_in_video_seconds",
        },
        webhook,
        custom_id: generation.id,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `COMPOSER_DISPATCH_FAILED:${(await response.text()).slice(0, 300)}`,
    );
  }

  const data = await response.json();
  if (!data?.id) throw new Error("COMPOSER_NO_JOB_ID");

  await ensurePostProductionSteps(generationId);

  await db.generation.update({
    where: { id: generationId },
    data: {
      status: "PROCESSING",
      metadata: {
        ...meta,
        composerJobId: data.id,
        compositionRequestedAt: new Date().toISOString(),
        postProductionIncluded: true,
        voiceAudioUrl: voiceAudioUrl || null,
        voiceProfileId: voiceProfileId || null,
      },
    },
  });

  await db.project.update({
    where: { id: generation.project.id },
    data: { status: "COMPOSING" },
  });

  return {
    status: "composing",
    composerJobId: data.id,
  } as const;
}
