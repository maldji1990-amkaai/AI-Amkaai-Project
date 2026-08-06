// lib/config.ts

import { PlanType as PrismaPlanType } from "@prisma/client";

//////////////////////////////////////////////////
// 💳 PLANS CONFIG (المصدر الوحيد للحقيقة - الباقات المحدثة بجودة Amkaai)
//////////////////////////////////////////////////

export const PLANS = {
  trial: {
    name: "3-Day Trial",
    credits: 30, // 🌟 30 نقطة تجريبية كافية للفحص
    price: 0, // ✅ مصحح: التجربة 0$ فعلياً (كانت خطأً 1.99)
    isPro: false, // ✅ التجربة ليست باقة احترافية - فيها علامة مائية و720p فقط
  },

  // 🆕 باقة Monthly - تُفعَّل تلقائياً بعد انتهاء 3 أيام Trial (أول دفعة PayPal حقيقية)
  monthly: {
    name: "Monthly",
    credits: 100, // ⚠️ قيمة مؤقتة - سيتم الاتفاق عليها لاحقاً
    price: 17.99,
    isPro: true,
  },

  quarterly: {
    name: "Quarterly Saver",
    credits: 300, // 🌟 300 نقطة لتوليد فيديوهات مرنة بدقة 1080p
    price: 44.97, // 44.97 USD (دفعة واحدة لـ 3 أشهر)
    isPro: true,
  },

  biannually: {
    name: "6 Months Cinematic",
    credits: 900, // 🌟 900 نقطة ضخمة وحصرية لجودة الـ 1080p الفاخرة
    price: 77.94, // 77.94 USD (دفعة واحدة لـ 6 أشهر)
    isPro: true,
  },

  // 🆕 باقة Business - أقوى باقة، 1080p، حتى دقيقتين، أعلى أولوية في الطابور
  business: {
    name: "Business",
    credits: 2000, // ⚠️ قيمة مؤقتة كما طُلب - سيتم الاتفاق عليها لاحقاً
    price: 0, // ⚠️ السعر لم يُحدَّد بعد - ضعه هنا عند التأكيد
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
  video: 1, // نظام مرن وثابت: 1 نقطة لكل 1 ثانية توليد فيديو (Pay-Per-Second)
} as const;

export type AIType = keyof typeof AI_COSTS;

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

// 🗑️ ملاحظة: تم حذف LEMON_VARIANTS وgetPlanFromVariant لأن نظام الدفع الفعلي
// المستخدم في المشروع حالياً هو PayPal (راجع app/api/webhook/paypal/route.ts)
// وليس Lemon Squeezy. إذا كنت لا تزال تخطط لدعم Lemon Squeezy بالتوازي، أخبرني
// لأعيد إضافتها بشكل صحيح ومتوافق مع الأسماء الجديدة للباقات.
