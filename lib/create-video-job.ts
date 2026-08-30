import { db } from "@/lib/db";
import { useCredits } from "@/lib/credits";
import { enqueueVideoJob } from "@/lib/queues/video.queue";
import { getVideoClipCount, normalizeVideoDuration, getVideoCreditCost } from "@/lib/video-cost";
import { VIDEO_CLIP_LENGTH_SECONDS, VIDEO_CREDITS_PER_SECOND } from "@/lib/config";
import { getPlanConfig, maxVideoDurationSeconds } from "@/lib/plan-config";
import { getUserPlan } from "@/lib/subscription";

export async function createQueuedVideoJob(args: {
  userId: string;
  clerkId?: string;
  prompt: string;
  duration: number;
  projectId?: string | null;
  sceneId?: string | null;
  characterIds?: string[];
  voiceProfileId?: string | null;
  generationId?: string | null;
  referenceId?: string;
}) {
  const durationSeconds = normalizeVideoDuration(args.duration);
  const plan = args.clerkId ? await getUserPlan(args.clerkId) : "trial";
  const planConfig = await getPlanConfig(plan);
  const maxDuration = maxVideoDurationSeconds(planConfig);
  if (durationSeconds > maxDuration) throw new Error(`VIDEO_DURATION_LIMIT:${maxDuration}`);

  const referenceId = args.referenceId || `vid_${crypto.randomUUID()}`;
  const creditResult = await useCredits(args.userId, "video", { reference: referenceId, duration: durationSeconds });
  const usage = await db.usage.findUnique({ where: { referenceId }, select: { id: true } });
  const clipCount = getVideoClipCount(durationSeconds);
  const model = planConfig.aiModel || process.env.DEFAULT_VIDEO_MODEL || "Wan2.2-TI2V-5B";

  const safeCharacterIds = Array.isArray(args.characterIds) ? [...new Set(args.characterIds.map(String).filter(Boolean))].slice(0, 6) : [];
  const characters = safeCharacterIds.length
    ? await db.character.findMany({ where: { id: { in: safeCharacterIds }, userId: args.userId }, select: { id: true, name: true, description: true, imageUrl: true, referenceId: true, style: true } })
    : [];
  if (characters.length !== safeCharacterIds.length) throw new Error("CHARACTER_NOT_FOUND");
  let voiceProfile: { id: string; name: string; language: string | null; audioUrl: string | null; provider: string | null; providerId: string | null } | null = null;
  if (args.voiceProfileId) {
    voiceProfile = await db.voiceProfile.findFirst({ where: { id: args.voiceProfileId, userId: args.userId }, select: { id: true, name: true, language: true, audioUrl: true, provider: true, providerId: true } });
    if (!voiceProfile) throw new Error("VOICE_PROFILE_NOT_FOUND");
  }

  try {
    if (args.projectId) {
      const project = await db.project.findFirst({ where: { id: args.projectId, userId: args.userId }, select: { id: true } });
      if (!project) throw new Error("PROJECT_NOT_FOUND");
    }
    if (args.sceneId && args.projectId) {
      const scene = await db.scene.findFirst({ where: { id: args.sceneId, projectId: args.projectId }, select: { id: true } });
      if (!scene) throw new Error("SCENE_NOT_FOUND");
    }

    const generationId = args.generationId || (await db.generation.create({
      data: {
        userId: args.userId,
        projectId: args.projectId || null,
        type: "VIDEO",
        prompt: args.prompt,
        status: "PENDING",
        metadata: {
          sceneId: args.sceneId || null,
          characterIds: safeCharacterIds,
          characterReferences: characters,
          voiceProfileId: voiceProfile?.id || null,
          voiceProfile,
          durationSeconds,
          clipCount,
          credits: creditResult.cost,
        },
      },
    })).id;

    await db.generationStep.create({
      data: {
        generationId,
        name: "Video Render",
        status: "PENDING",
        input: { prompt: args.prompt, durationSeconds, clipCount, clipLengthSeconds: VIDEO_CLIP_LENGTH_SECONDS, model },
      },
    });

    const job = await db.videoJob.create({
      data: {
        userId: args.userId,
        prompt: args.prompt,
        status: "PENDING",
        priority: planConfig.priority,
        usageId: usage?.id,
        generationId,
        durationSeconds,
        clipCount,
        model,
        input: {
          project_id: args.projectId || null,
          scene_id: args.sceneId || null,
          character_ids: safeCharacterIds,
          character_references: characters,
          voice_profile_id: voiceProfile?.id || null,
          voice_profile: voiceProfile,
        },
      },
    });

    try {
      await enqueueVideoJob(job.id, planConfig.priority);
    } catch (error) {
      await db.videoJob.update({ where: { id: job.id }, data: { status: "FAILED", error: String(error), finishedAt: new Date() } });
      await db.generation.update({ where: { id: generationId }, data: { status: "FAILED", error: "Queue unavailable" } });
      const { refundCredits } = await import("@/lib/credits");
      await refundCredits(referenceId);
      throw new Error("QUEUE_UNAVAILABLE");
    }

    return {
      jobId: job.id,
      generationId,
      usageId: usage?.id,
      durationSeconds,
      clipCount,
      cost: getVideoCreditCost(durationSeconds),
      creditsPerSecond: VIDEO_CREDITS_PER_SECOND,
      remainingCredits: creditResult.remainingCredits,
    };
  } catch (error) {
    if (!(error instanceof Error && error.message === "QUEUE_UNAVAILABLE")) {
      const { refundCredits } = await import("@/lib/credits");
      await refundCredits(referenceId).catch(() => undefined);
    }
    throw error;
  }
}
