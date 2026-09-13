import { db } from "@/lib/db";
import { useCredits, refundCredits } from "@/lib/credits";
import { enqueueVideoJob } from "@/lib/queues/video.queue";
import {
  getVideoClipCount,
  normalizeVideoDuration,
} from "@/lib/video-cost";
import {
  VIDEO_CLIP_LENGTH_SECONDS,
  VIDEO_CREDITS_PER_SECOND,
} from "@/lib/config";
import { getPlanConfig, maxVideoDurationSeconds } from "@/lib/plan-config";

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
  imageUrl?: string | null;
}) {
  const durationSeconds = normalizeVideoDuration(args.duration);

  /*
   * الاشتراك لا يقرر السماح بالتوليد.
   * السماح يعتمد فقط على credits الموجودة في حساب المستخدم.
   *
   * نستخدم monthly للحصول على إعدادات الفيديو.
   * الخصم الفعلي يتم من خلال useCredits().
   */
  const plan = "monthly";

  const planConfig = await getPlanConfig(plan);
  const maxDuration = maxVideoDurationSeconds(planConfig);

  if (durationSeconds > maxDuration) {
    throw new Error(`VIDEO_DURATION_LIMIT:${maxDuration}`);
  }

  if (!args.prompt || !args.prompt.trim()) {
    throw new Error("PROMPT_REQUIRED");
  }

  const referenceId =
    args.referenceId?.trim() || `vid_${crypto.randomUUID()}`;

  let refunded = false;

  const refundOnce = async () => {
    if (refunded) {
      return;
    }

    refunded = true;

    await refundCredits(referenceId).catch(() => undefined);
  };

  try {
    const clipCount = getVideoClipCount(durationSeconds);

    const model =
      planConfig.aiModel ||
      process.env.DEFAULT_VIDEO_MODEL ||
      "Wan2.2-TI2V-5B";

    const safeCharacterIds = Array.isArray(args.characterIds)
      ? [
          ...new Set(
            args.characterIds
              .map(String)
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        ].slice(0, 6)
      : [];

    const characters = safeCharacterIds.length
      ? await db.character.findMany({
          where: {
            id: {
              in: safeCharacterIds,
            },
            userId: args.userId,
          },
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            referenceId: true,
            style: true,
          },
        })
      : [];

    if (characters.length !== safeCharacterIds.length) {
      throw new Error("CHARACTER_NOT_FOUND");
    }

    let voiceProfile: {
      id: string;
      name: string;
      language: string | null;
      audioUrl: string | null;
      provider: string | null;
      providerId: string | null;
    } | null = null;

    if (args.voiceProfileId) {
      voiceProfile = await db.voiceProfile.findFirst({
        where: {
          id: args.voiceProfileId,
          userId: args.userId,
        },
        select: {
          id: true,
          name: true,
          language: true,
          audioUrl: true,
          provider: true,
          providerId: true,
        },
      });

      if (!voiceProfile) {
        throw new Error("VOICE_PROFILE_NOT_FOUND");
      }
    }

    if (args.projectId) {
      const project = await db.project.findFirst({
        where: {
          id: args.projectId,
          userId: args.userId,
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        throw new Error("PROJECT_NOT_FOUND");
      }
    }

    if (args.sceneId) {
      if (!args.projectId) {
        throw new Error("PROJECT_REQUIRED_FOR_SCENE");
      }

      const scene = await db.scene.findFirst({
        where: {
          id: args.sceneId,
          projectId: args.projectId,
        },
        select: {
          id: true,
        },
      });

      if (!scene) {
        throw new Error("SCENE_NOT_FOUND");
      }
    }

    if (args.generationId) {
      const existingGeneration = await db.generation.findFirst({
        where: {
          id: args.generationId,
          userId: args.userId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existingGeneration) {
        throw new Error("GENERATION_NOT_FOUND");
      }

      if (
        existingGeneration.status === "COMPLETED" ||
        existingGeneration.status === "PROCESSING"
      ) {
        throw new Error("GENERATION_ALREADY_RUNNING");
      }
    }

    /*
     * الخصم ذري داخل useCredits().
     * لا يتم فحص الاشتراك أو تاريخ انتهائه.
     */
    const creditResult = await useCredits(args.userId, "video", {
      reference: referenceId,
      duration: durationSeconds,
    });

    /*
     * useCredits يعيد usageId مباشرة.
     * لا حاجة لاستعلام إضافي إلى Usage.
     */
    const usageId = creditResult.usageId;

    if (!usageId) {
      throw new Error("USAGE_NOT_FOUND_AFTER_CREDIT_DEDUCTION");
    }

    const generationId =
      args.generationId ||
      (
        await db.generation.create({
          data: {
            userId: args.userId,
            projectId: args.projectId || null,
            type: "VIDEO",
            prompt: args.prompt.trim(),
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
              referenceId,
              model,
            },
          },
        })
      ).id;

    await db.generationStep.create({
      data: {
        generationId,
        name: "Video Render",
        status: "PENDING",
        input: {
          prompt: args.prompt.trim(),
          durationSeconds,
          clipCount,
          clipLengthSeconds: VIDEO_CLIP_LENGTH_SECONDS,
          model,
          referenceId,
        },
      },
    });

    const job = await db.videoJob.create({
      data: {
        userId: args.userId,
        prompt: args.prompt.trim(),
        status: "PENDING",
        priority: planConfig.priority,
        usageId,
        generationId,
        durationSeconds,
        clipCount,
        model,
        imageUrl: args.imageUrl || null,
        input: {
          project_id: args.projectId || null,
          scene_id: args.sceneId || null,
          character_ids: safeCharacterIds,
          character_references: characters,
          voice_profile_id: voiceProfile?.id || null,
          voice_profile: voiceProfile,
          reference_id: referenceId,
          duration_seconds: durationSeconds,
          clip_count: clipCount,
          model,
        },
      },
    });

    try {
      await enqueueVideoJob(job.id, planConfig.priority);
    } catch (queueError) {
      await db.videoJob
        .update({
          where: {
            id: job.id,
          },
          data: {
            status: "FAILED",
            error:
              queueError instanceof Error
                ? queueError.message
                : String(queueError),
            finishedAt: new Date(),
          },
        })
        .catch(() => undefined);

      await db.generation
        .update({
          where: {
            id: generationId,
          },
          data: {
            status: "FAILED",
            error: "Queue unavailable",
          },
        })
        .catch(() => undefined);

      await refundOnce();

      throw new Error("QUEUE_UNAVAILABLE");
    }

    return {
      jobId: job.id,
      generationId,
      usageId,
      durationSeconds,
      clipCount,
      cost: creditResult.cost,
      creditsPerSecond: VIDEO_CREDITS_PER_SECOND,
      remainingCredits: creditResult.remainingCredits,
    };
  } catch (error) {
    const isQueueUnavailable =
      error instanceof Error &&
      error.message === "QUEUE_UNAVAILABLE";

    if (!isQueueUnavailable) {
      await refundOnce();
    }

    throw error;
  }
}