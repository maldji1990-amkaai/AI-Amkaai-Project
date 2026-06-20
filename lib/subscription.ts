// lib/subscription.ts

import { db } from "@/lib/db";
import { PLANS } from "@/lib/config";

// تعريف الأنواع المتوافقة مع أسماء الباقات الجديدة بداخل الموقع
type AppPlanType = keyof typeof PLANS | "FREE";

/**
 * فحص ما إذا كان المستخدم يمتلك باقة احترافية نشطة (TRIAL أو QUARTERLY أو BIANNUALLY)
 * @param userId - معرّف الـ Clerk أو معرّف قاعدة البيانات الخاص بالمستخدم
 */
export async function isProUser(userId: string): Promise<boolean> {
  if (!userId) return false;

  // 1. جلب بيانات خطة المستخدم الحالية من قاعدة البيانات بأمان
  // ملاحظة: تم ضبط الاستعلام ليفحص معرّف الـ id أو clerkId حسب الهيكل المستخدم لديك بمرونة
  const user = await db.user.findFirst({
    where: { 
      OR: [
        { id: userId },
        { clerkId: userId }
      ]
    },
    select: { plan: true }, // نطلب حقل الـ plan فقط لسرعة الأداء وتقليل استهلاك الـ RAM
  });

  if (!user || !user.plan) return false;

  // 2. التحقق من استحقاق المستخدم للميزات الاحترافية بناءً على الباقات الجديدة لـ Amkaai
  // إذا كانت خطة المستخدم هي trial أو quarterly أو biannually (قادمة من الـ Enum أو الـ String في قاعدة البيانات)
  const userPlanLower = user.plan.toLowerCase();
  
  return (
    userPlanLower === "trial" ||
    userPlanLower === "quarterly" ||
    userPlanLower === "biannually" ||
    userPlanLower === "premium" // صمام أمان لدعم المسميات القديمة في الـ Database إن وجدت
  );
}

/**
 * دالة مساعدة لجلب نوع الباقة الحرفي الحالي للمخدم في الفرونت إند أو أثناء التوليد
 */
export async function getUserPlan(userId: string): Promise<string> {
  if (!userId) return "FREE";

  const user = await db.user.findFirst({
    where: { 
      OR: [
        { id: userId },
        { clerkId: userId }
      ]
    },
    select: { plan: true },
  });

  return user?.plan || "FREE";
}