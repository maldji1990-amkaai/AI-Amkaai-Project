import { db } from "@/lib/db";
import { VIDEO_CLIP_LENGTH_SECONDS } from "@/lib/config";
import { submitVideoToPod, releaseVideoGpu } from "@/lib/runpod-pod-manager";

export async function dispatchVideoJob(videoJobId: string) {
  const job = await db.videoJob.findUnique({ where: { id: videoJobId }, include: { generation: true } });
  if (!job) throw new Error("VIDEO_JOB_NOT_FOUND");
  if (["CANCELLED", "COMPLETED", "FAILED"].includes(job.status)) return job;
  if (job.externalJobId) return job;

  const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!webhookSecret || !appUrl) throw new Error("RUNPOD_CONFIGURATION_MISSING");

  const input = (job.input && typeof job.input === "object" ? job.input : {}) as Record<string, unknown>;
  const durationSeconds = job.durationSeconds || Number(input.duration_seconds) || VIDEO_CLIP_LENGTH_SECONDS;
  const characterReferences = Array.isArray(input.character_references) ? input.character_references : [];
  const voiceProfile = input.voice_profile && typeof input.voice_profile === "object" ? input.voice_profile : null;
  const continuityPrompt = characterReferences.length
    ? `\n\nCHARACTER CONTINUITY — keep these identities consistent across shots: ${JSON.stringify(characterReferences)}`
    : "";
  const voicePrompt = voiceProfile ? `\nVOICE PROFILE — use this saved voice profile when the post-production pipeline supports voice: ${JSON.stringify(voiceProfile)}` : "";
  const clipCount = job.clipCount || Number(input.clip_count) || Math.ceil(durationSeconds / VIDEO_CLIP_LENGTH_SECONDS);
  const model = job.model || String(input.model || process.env.DEFAULT_VIDEO_MODEL || "Wan2.2-TI2V-5B");
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhook/runpod?jobId=${encodeURIComponent(job.id)}&secret=${encodeURIComponent(webhookSecret)}`;

  if (process.env.RUNPOD_DIRECT_POD_ENABLED !== "true") throw new Error("RUNPOD_DIRECT_POD_DISABLED");

  const submission = await submitVideoToPod({
    job_id: job.id,
    custom_id: job.id,
    webhook_url: webhookUrl,
    prompt: job.prompt,
    idea: job.prompt,
    duration_seconds: durationSeconds,
    clip_length_seconds: Math.min(VIDEO_CLIP_LENGTH_SECONDS, durationSeconds),
    clip_count: clipCount,
    model,
    user_id: job.userId,
    ...(input.project_id ? { project_id: input.project_id } : {}),
    ...(input.scene_id ? { scene_id: input.scene_id } : {}),
    ...(Array.isArray(input.character_ids) ? { character_ids: input.character_ids, character_references: characterReferences } : {}),
    ...(input.voice_profile_id ? { voice_profile_id: input.voice_profile_id, voice_profile: voiceProfile } : {}),
  });
  const externalJobId = submission.id;

  try {
    return await db.videoJob.update({
      where: { id: job.id },
      data: {
        externalJobId,
        status: "PROCESSING",
        startedAt: new Date(),
        progress: 5,
        error: null,
        attempts: { increment: 1 },
        input: { ...input, runpod_pod_id: submission.podId },
      },
    });
  } catch (error) {
    await releaseVideoGpu().catch(() => undefined);
    throw error;
  }
}
