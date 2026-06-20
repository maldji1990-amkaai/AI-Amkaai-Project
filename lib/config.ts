// lib/config.ts

import { PlanType as PrismaPlanType } from "@prisma/client";

//////////////////////////////////////////////////
// 💳 PLANS CONFIG (المصدر الوحيد للحقيقة - الباقات المحدثة بجودة Amkaai)
//////////////////////////////////////////////////

export const PLANS = {
  trial: {
    name: "3-Day Full Access",
    credits: 30, // 🌟 30 نقطة تجريبية كافية للفحص ومحميّة مالياً بـ Wan 2.5 Fast
    price: 1.99, // 1.99 USD
    isPro: true,
  },

  quarterly: {
    name: "Quarterly Saver",
    credits: 300, // 🌟 300 نقطة لتوليد فيديوهات مرنة بدقة 720p
    price: 44.97, // 44.97 USD (دفعة واحدة لـ 3 أشهر)
    isPro: true,
  },

  biannually: {
    name: "6 Months Cinematic",
    credits: 900, // 🌟 900 نقطة ضخمة وحصرية لجودة الـ 1080p الفاخرة عبر Kling 1.5
    price: 77.94, // 77.94 USD (دفعة واحدة لـ 6 أشهر)
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
  video: 1,  // نظام مرن وثابت: 1 نقطة لكل 1 ثانية توليد فيديو (Pay-Per-Second)
} as const;

export type AIType = keyof typeof AI_COSTS;

//////////////////////////////////////////////////
// 🍋 LEMON SQUEEZY CONFIG (المعرفات الجديدة للباقات)
//////////////////////////////////////////////////

export const LEMON_VARIANTS = {
  trial: process.env.LEMON_SQUEEZY_TRIAL_VARIANT_ID || "", 
  quarterly: process.env.LEMON_SQUEEZY_QUARTERLY_VARIANT_ID || "",
  premium: process.env.LEMON_SQUEEZY_PREMIUM_VARIANT_ID || "", // تركنا اسم المفتاح متوافقاً مع إعدادات سيرفر ليمون سكويزي القديمة
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
// ⚡ FEATURE FLAGS (التحكم في تشغيل الميزات برمجياً)
//////////////////////////////////////////////////

export const FEATURES = {
  enableVideoQueue: true,      
  enableVoice: true,           
  enableImage: true,           
};

//////////////////////////////////////////////////
// 🧠 HELPER FUNCTIONS
//////////////////////////////////////////////////

// ✅ جلب نقاط الخطة بناءً على نوعها بعد التحديث
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

  if (incomingVariantStr === LEMON_VARIANTS.trial) return "trial"; 
  if (incomingVariantStr === LEMON_VARIANTS.quarterly) return "quarterly";
  if (incomingVariantStr === LEMON_VARIANTS.premium) return "biannually"; // تحويل المعرف الفاخر تلقائياً للباقة نصف السنوية

  return null;
}