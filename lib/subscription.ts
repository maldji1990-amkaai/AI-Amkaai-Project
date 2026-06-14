import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";

/**
 * فحص ما إذا كان المستخدم يمتلك باقة احترافية نشطة (PRO أو PREMIUM)
 * @param userId - معرّف الـ Clerk الخاص بالمستخدم
 */
export async function isProUser(userId: string) {
  if (!userId) return false;

  // 1. جلب بيانات خطة المستخدم الحالية من قاعدة البيانات بأمان
  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { plan: true }, // نطلب فقط حقل الـ plan لسرعة الأداء وتقليل الضغط على السيرفر
  });

  // 2. التحقق من استحقاق المستخدم للميزات الاحترافية
  // الخطة تعتبر PRO إذا كانت قيمتها PRO أو PREMIUM في الـ Enum الخاص بـ Prisma
  return user?.plan === PlanType.PRO || user?.plan === PlanType.PREMIUM;
}

/**
 * دالة مساعدة إضافية في حال احتجت لمعرفة نوع الباقة الحرفي للمستخدم في أي مكان بالتطبيق
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  if (!userId) return PlanType.FREE;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { plan: true },
  });

  return user?.plan || PlanType.FREE;
}