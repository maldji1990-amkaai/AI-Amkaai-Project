// lib/config.ts

import { PlanType as PrismaPlanType } from "@prisma/client";

//////////////////////////////////////////////////
// 💳 PLANS CONFIG (المصدر الوحيد للحقيقة - 3 باقات فقط)
//////////////////////////////////////////////////

export const PLANS = {
  creator: {
    name: "Creator Pass",
    credits: 70, // 🌟 70 نقطة = 70 ثانية توليد فيديو مرن
    price: 7,   // 7 USD
    isPro: true,
  },

  pro: {
    name: "Pro Pack",
    credits: 200, // 🌟 200 نقطة = 200 ثانية
    price: 15,   // 15 USD
    isPro: true,
  },

  premium: {
    name: "Premium Studio",
    credits: 400, // 🌟 400 نقطة = 400 ثانية
    price: 25,   // 25 USD
    isPro: true,
  },
} as const;

export type ConfigPlanType = keyof typeof PLANS;

//////////////////////////////////////////////////
// 🎯 AI COSTS (مكان واحد فقط لتحديد أسعار العمليات)
//////////////////////////////////////////////////

export const AI_COSTS = {
  image: 1,
  voice: 1,  
  video: 1,  // نظام مرن: 1 نقطة لكل 1 ثانية توليد فيديو (Pay-Per-Second)
} as const;

export type AIType = keyof typeof AI_COSTS;

//////////////////////////////////////////////////
// 🍋 LEMON SQUEEZY CONFIG
//////////////////////////////////////////////////

export const LEMON_VARIANTS = {
  creator: process.env.LEMON_SQUEEZY_CREATOR_VARIANT_ID || "", 
  pro: process.env.LEMON_SQUEEZY_PRO_VARIANT_ID || "",
  premium: process.env.LEMON_SQUEEZY_PREMIUM_VARIANT_ID || "",
};

//////////////////////////////////////////////////
// 🔐 SECURITY / LIMITS (المحددات الأمنية للمدخلات)
//////////////////////////////////////////////////

export const LIMITS = {
  maxPromptLength: 1000, 
  minPromptLength: 3,    
  maxTextLength: 2000,   
};

//////////////////////////////////////////////////
// ⚡ FEATURE FLAGS (التحكم في تشغيل الميزات برمجيًا)
//////////////////////////////////////////////////

export const FEATURES = {
  enableVideoQueue: true,      
  enableVoice: true,           
  enableImage: true,           
};

//////////////////////////////////////////////////
// 🧠 HELPER FUNCTIONS
//////////////////////////////////////////////////

// ✅ جلب نقاط الخطة بناءً على نوعها
export function getPlanCredits(plan: ConfigPlanType) {
  return PLANS[plan]?.credits || 0;
}

// ✅ التحقق مما إذا كانت الخطة مدفوعة/احترافية
export function isProPlan(plan: ConfigPlanType) {
  return PLANS[plan]?.isPro || false;
}

// ✅ جلب تكلفة عملية الـ AI (خصم النقاط)
export function getAICost(type: AIType) {
  return AI_COSTS[type];
}

// ✅ تحويل رقم الـ Variant القادم من الـ Webhook الخاص بـ Lemon Squeezy إلى اسم الخطة المقابلة
export function getPlanFromVariant(variantId: string | number | null): ConfigPlanType | null {
  if (!variantId) return null;

  const incomingVariantStr = String(variantId);

  if (incomingVariantStr === LEMON_VARIANTS.creator) return "creator"; 
  if (incomingVariantStr === LEMON_VARIANTS.pro) return "pro";
  if (incomingVariantStr === LEMON_VARIANTS.premium) return "premium";

  return null;
}