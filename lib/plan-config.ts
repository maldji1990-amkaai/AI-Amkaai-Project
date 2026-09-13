import { db } from "@/lib/db";
import {
  PLANS,
  VIDEO_CLIP_LENGTH_SECONDS,
  type ConfigPlanType,
} from "@/lib/config";

type PlanConfigRecord = {
  planKey: string;
  name: string;
  credits: number;
  price: number;
  isPro: boolean;
  resolution: string;
  maxDurationSeconds: number;
  aiModel: string;
  advancedSampling: boolean;
  watermarkEnabled: boolean;
  watermarkOpacity: number;
  watermarkText: string;
  priority: number;
};

type CachedPlanConfig = PlanConfigRecord;

const planConfigCache = new Map<string, CachedPlanConfig>();

function normalizePlanKey(
  plan: string | null | undefined,
): string {
  const key = String(plan || "trial")
    .trim()
    .toLowerCase();

  return key in PLANS ? key : "trial";
}

function getFallbackPlanConfig(
  plan: string,
): PlanConfigRecord {
  const fallback =
    PLANS[plan as ConfigPlanType] ?? PLANS.trial;

  const configuredMaxDuration = Number(
    process.env.VIDEO_MAX_DURATION_SECONDS || 120,
  );

  const maxDurationSeconds =
    Number.isFinite(configuredMaxDuration) &&
    configuredMaxDuration >= 1
      ? Math.floor(configuredMaxDuration)
      : 120;

  return {
    planKey: plan,
    name: fallback.name,
    credits: fallback.credits,
    price: fallback.price,
    isPro: fallback.isPro,
    resolution: "720p",
    maxDurationSeconds,
    aiModel:
      process.env.DEFAULT_VIDEO_MODEL ||
      "Wan2.2-TI2V-5B",
    advancedSampling: false,
    watermarkEnabled: false,
    watermarkOpacity: 40,
    watermarkText: "AMKAAI.NET",
    priority: 0,
  };
}

async function loadPlanConfig(
  plan: string,
): Promise<PlanConfigRecord> {
  const dbConfig = await db.planConfig
    .findUnique({
      where: {
        planKey: plan,
      },
    })
    .catch(() => null);

  if (!dbConfig) {
    return getFallbackPlanConfig(plan);
  }

  return {
    planKey: dbConfig.planKey,
    name: dbConfig.name,
    credits: dbConfig.credits,
    price: dbConfig.price,
    isPro: dbConfig.isPro,
    resolution: dbConfig.resolution,
    maxDurationSeconds: dbConfig.maxDurationSeconds,
    aiModel: dbConfig.aiModel,
    advancedSampling: dbConfig.advancedSampling,
    watermarkEnabled: dbConfig.watermarkEnabled,
    watermarkOpacity: dbConfig.watermarkOpacity,
    watermarkText: dbConfig.watermarkText,
    priority: dbConfig.priority,
  };
}

export function invalidatePlanConfigCache(
  plan?: string | null,
): void {
  if (plan) {
    planConfigCache.delete(
      normalizePlanKey(plan),
    );
    return;
  }

  planConfigCache.clear();
}

export async function getPlanConfig(
  plan: string | null | undefined,
): Promise<PlanConfigRecord> {
  const key = normalizePlanKey(plan);

  const cached = planConfigCache.get(key);

  if (cached) {
    return cached;
  }

  const config = await loadPlanConfig(key);

  planConfigCache.set(key, config);

  return config;
}

export function maxVideoDurationSeconds(
  planConfig: {
    maxDurationSeconds?: number | null;
  },
): number {
  const configured = Number(
    planConfig?.maxDurationSeconds ?? 0,
  );

  const globalMax = Number(
    process.env.VIDEO_MAX_DURATION_SECONDS || 120,
  );

  const safeGlobalMax =
    Number.isFinite(globalMax) && globalMax >= 1
      ? Math.floor(globalMax)
      : 120;

  /*
   * قيمة 5 ثوانٍ هي القيمة القديمة الخاصة بمقطع واحد.
   * لا نجعلها حدًا نهائيًا للفيديو الكامل في نظام
   * الدفع حسب الثانية.
   */
  if (
    Number.isFinite(configured) &&
    configured > VIDEO_CLIP_LENGTH_SECONDS
  ) {
    return Math.max(
      1,
      Math.min(
        Math.floor(configured),
        safeGlobalMax,
      ),
    );
  }

  return safeGlobalMax;
}