// lib/config.ts

import { PlanType as PrismaPlanType } from "@prisma/client";

//////////////////////////////////////////////////
// 💳 PLANS CONFIG (المصدر الوحيد للحقيقة)
//////////////////////////////////////////////////

export const PLANS = {
  free: {
    name: "Free",
    credits: 10,
    price: 0,
    isPro: false,
  },

  pro: {
    name: "Pro",
    credits: 120, // 💡 يمكنك زيادتها مستقبلاً (مثلاً: 1200) لزيادة المبيعات
    price: 15, // USD
    isPro: true,
  },

  premium: {
    name: "Premium",
    credits: 320, // 💡 يمكنك زيادتها مستقبلاً (مثلاً: 3500)
    price: 25, // USD
    isPro: true,
  },
} as const;

export type ConfigPlanType = keyof typeof PLANS;

//////////////////////////////////////////////////
// 🎯 AI COSTS (مكان واحد فقط لتحديد أسعار العمليات)
//////////////////////////////////////////////////

export const AI_COSTS = {
  image: 1,
  voice: 3,
  video: 30, // تكلفة توليد الفيديو الواحد أو الأفاتار
} as const;

export type AIType = keyof typeof AI_COSTS;

//////////////////////////////////////////////////
// 🍋 LEMON SQUEEZY CONFIG
//////////////////////////////////////////////////

export const LEMON_VARIANTS = {
  pro: process.env.LEMON_SQUEEZY_PRO_VARIANT_ID || "",
  premium: process.env.LEMON_SQUEEZY_PREMIUM_VARIANT_ID || "",
};

//////////////////////////////////////////////////
// 🔐 SECURITY / LIMITS (المحددات الأمنية للمدخلات)
//////////////////////////////////////////////////

export const LIMITS = {
  maxPromptLength: 1000, // الحد الأقصى لوصف الفيديو النصي
  minPromptLength: 3,    // الحد الأدنى لحروف المدخلات لمنع الطلبات الفارغة
  maxTextLength: 2000,   // الحد الأقصى لنصوص استنساخ وتحويل الصوت
};

//////////////////////////////////////////////////
// ⚡ FEATURE FLAGS (التحكم في تشغيل الميزات برميًا)
//////////////////////////////////////////////////

export const FEATURES = {
  enableVideoQueue: true,      // تفعيل/تعطيل طابور إنتاج الفيديو بالكامل
  enableVoice: true,           // تشغيل ميزة استنساخ وهندسة الصوت AI
  enableImage: true,           // تشغيل محرك تحسين وتوليد الصور
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

  // تحويل القيمة القادمة إلى نص دائماً لضمان دقة المقارنة الصارمة
  const incomingVariantStr = String(variantId);

  if (incomingVariantStr === LEMON_VARIANTS.pro) return "pro";
  if (incomingVariantStr === LEMON_VARIANTS.premium) return "premium";

  return null;
}