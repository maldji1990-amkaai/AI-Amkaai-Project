import { db } from "@/lib/db";
import { PLANS, VIDEO_CLIP_LENGTH_SECONDS } from "@/lib/config";

export async function getPlanConfig(plan: string | null | undefined) {
  const key = String(plan || "trial").toLowerCase();
  const dbConfig = await db.planConfig.findUnique({ where: { planKey: key } }).catch(() => null);
  if (dbConfig) return dbConfig;
  const fallback = (PLANS as any)[key] || PLANS.trial;
  return {
    planKey: key,
    name: fallback.name,
    credits: fallback.credits,
    price: fallback.price,
    isPro: fallback.isPro,
    resolution: "720p",
    maxDurationSeconds: Number(process.env.VIDEO_MAX_DURATION_SECONDS || 120),
    aiModel: process.env.DEFAULT_VIDEO_MODEL || "Wan2.2-TI2V-5B",
    advancedSampling: false,
    watermarkEnabled: false,
    watermarkOpacity: 40,
    watermarkText: "AMKAAI.NET",
    priority: 0,
  };
}

export function maxVideoDurationSeconds(planConfig: { maxDurationSeconds?: number }) {
  const configured = Number(planConfig?.maxDurationSeconds || 0);
  const globalMax = Number(process.env.VIDEO_MAX_DURATION_SECONDS || 120);
  if (!Number.isFinite(globalMax) || globalMax < 1) return Math.max(1, configured || 120);
  if (!Number.isFinite(configured) || configured < 1) return globalMax;
  // A DB plan config of the old default (5s) must not silently cap the new pay-per-second model.
  if (configured <= VIDEO_CLIP_LENGTH_SECONDS) return globalMax;
  return Math.min(configured, globalMax);
}
