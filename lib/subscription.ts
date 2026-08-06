// lib/subscription.ts

import { db } from "@/lib/db";
import { PLANS } from "@/lib/config";

// تعريف الأنواع المتوافقة مع أسماء الباقات الجديدة بداخل الموقع
type AppPlanType = keyof typeof PLANS;

/**
 * فحص ما إذا كان المستخدم يمتلك باقة احترافية نشطة (كل شيء عدا TRIAL)
 * @param userId - معرّف الـ Clerk أو معرّف قاعدة البيانات الخاص بالمستخدم
 */
export async function isProUser(userId: string): Promise<boolean> {
  if (!userId) return false;

  const user = await db.user.findFirst({
    where: {
      OR: [{ id: userId }, { clerkId: userId }],
    },
    select: { plan: true },
  });

  if (!user || !user.plan) return false;

  const userPlanLower = user.plan.toLowerCase();

  // ✅ مصحح: TRIAL أُزيلت عمداً من هذه القائمة.
  // التجربة المجانية (0$/3 أيام) ليست باقة احترافية — تبقى بجودة 720p + علامة مائية،
  // وكل الباقات المدفوعة الأربع فقط تُعتبر Pro.
  return (
    userPlanLower === "monthly" ||
    userPlanLower === "quarterly" ||
    userPlanLower === "biannually" ||
    userPlanLower === "business"
  );
}

/**
 * دالة مساعدة لجلب نوع الباقة الحرفي الحالي للمستخدم في الفرونت إند أو أثناء التوليد
 */
export async function getUserPlan(userId: string): Promise<string> {
  if (!userId) return "TRIAL";

  const user = await db.user.findFirst({
    where: {
      OR: [{ id: userId }, { clerkId: userId }],
    },
    select: { plan: true },
  });

  // ✅ مصحح: القيمة الافتراضية أصبحت TRIAL بدلاً من FREE،
  // لأن FREE لم تعد موجودة في enum الجديد (TRIAL و FREE أصبحتا باقة واحدة)
  return user?.plan || "TRIAL";
}
