import { db } from "@/lib/db";
import { PLANS, VIDEO_CLIP_LENGTH_SECONDS } from "@/lib/config";

type CachedPlanConfig = Awaited<ReturnType<typeof loadPlanConfig>>;

const planConfigCache = new Map<string, CachedPlanConfig>();

async function loadPlanConfig(plan: string) {
  const dbConfig = await db.planConfig
    .findUnique({ where: { planKey: plan } })
    .catch(() => null);

  if (dbConfig) return dbConfig;

  const fallback = (PLANS as any)[plan] || PLANS.trial;

  return {
    planKey: plan,
    name: fallback.name,
    credits: fallback.credits,
    price: fallback.price,
    isPro: fallback.isPro,
    resolution: "720p",
    maxDurationSeconds: Number(
      process.env.VIDEO_MAX_DURATION_SECONDS || 120
    ),
    aiModel: process.env.DEFAULT_VIDEO_MODEL || "Wan2.2-TI2V-5B",
    advancedSampling: false,
    watermarkEnabled: false,
    watermarkOpacity: 40,
    watermarkText: "AMKAAI.NET",
    priority: 0,
  };
}

export function invalidatePlanConfigCache(plan?: string | null) {
  if (plan) {
    planConfigCache.delete(String(plan).toLowerCase());
  } else {
    planConfigCache.clear();
  }
}

export async function getPlanConfig(plan: string | null | undefined) {
  const key = String(plan || "trial").toLowerCase();

  const cached = planConfigCache.get(key);
  if (cached) return cached;

  const config = await loadPlanConfig(key);

  planConfigCache.set(key, config);

  return config;
}

export function maxVideoDurationSeconds(planConfig: {
  maxDurationSeconds?: number;
}) {
  const configured = Number(planConfig?.maxDurationSeconds || 0);
  const globalMax = Number(process.env.VIDEO_MAX_DURATION_SECONDS || 120);

  if (!Number.isFinite(globalMax) || globalMax < 1) {
    return Math.max(1, configured || 120);
  }

  if (!Number.isFinite(configured) || configured < 1) {
    return globalMax;
  }

  // A DB plan config of the old default (5s) must not silently cap
  // the new pay-per-second model.
  if (configured <= VIDEO_CLIP_LENGTH_SECONDS) {
    return globalMax;
  }

  return Math.min(configured, globalMax);
}