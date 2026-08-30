import { PlanType as PrismaPlanType } from "@prisma/client";

// Central configuration for AmkaAI. Keep video pricing here so the UI and API
// use the same number. Change this single value when the business model changes.
export const VIDEO_CREDITS_PER_SECOND = 5;

// Long videos are rendered as short clips and then composed by the RunPod pipeline.
// 30 seconds => 6 clips of 5 seconds. This keeps GPU jobs smaller and easier to retry.
export const VIDEO_CLIP_LENGTH_SECONDS = 5;

export const PLANS = {
  trial: { name: "3-Day Trial", credits: 30, price: 0, isPro: false },
  monthly: { name: "Monthly", credits: 100, price: 17.99, isPro: true },
  quarterly: { name: "Quarterly Saver", credits: 300, price: 44.97, isPro: true },
  biannually: { name: "6 Months Cinematic", credits: 900, price: 77.94, isPro: true },
  business: { name: "Business", credits: 2000, price: 0, isPro: true },
} as const;

export type ConfigPlanType = keyof typeof PLANS;

export const AI_COSTS = {
  image: 1,
  voice: 1,
  video: VIDEO_CREDITS_PER_SECOND,
} as const;

export type AIType = keyof typeof AI_COSTS;

export const LIMITS = {
  maxPromptLength: 1000,
  minPromptLength: 3,
  maxTextLength: 2000,
};

export const FEATURES = {
  enableVideoQueue: true,
  enableVoice: true,
  enableImage: true,
};

export function getPlanCredits(plan: ConfigPlanType) {
  return PLANS[plan]?.credits || 0;
}

export function isProPlan(plan: ConfigPlanType) {
  return PLANS[plan]?.isPro || false;
}

export function getAICost(type: AIType) {
  return AI_COSTS[type];
}

// Kept as an explicit type export for older imports in the project.
export type { PrismaPlanType };
