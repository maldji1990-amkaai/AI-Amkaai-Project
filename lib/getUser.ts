import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";

/**
 * جلب بيانات المستخدم الحالية من قاعدة البيانات،
 * وفي حال عدم وجود الحساب (أول تسجيل دخول) يتم إنشاؤه تلقائياً بصفر أخطاء برمجية.
 */
export async function getOrCreateUser(clerkId: string) {
  if (!clerkId) {
    return null;
  }

  // 1. محاولة جلب المستخدم من قاعدة البيانات بناءً على معرّف Clerk
  let user = await db.user.findUnique({
    where: { clerkId },
  });

  // 2. إذا لم يكن الحساب موجوداً، نقوم بإنشائه فوراً وتعيين الباقة الافتراضية
  if (!user) {
    try {
      user = await db.user.create({
        data: {
          clerkId,
          credits: 10, // الرصيد المجاني الأولي لبدء التجربة الفورية
          plan: PlanType.FREE,
        },
      });
      console.log(`🎯 [USER PROVISIONING] Account automatically provisioned for ClerkID: ${clerkId}`);
    } catch (error) {
      console.warn("⚠️ [RACE CONDITION SHIELD] Concurrent insertion detected, re-fetching user entry...");
      
      // صمام أمان: في حال تسجيل المستخدم لطلبات متزامنة في نفس الأجزاء من الثانية (Race Condition)
      // وفشل الـ create بسبب قيد التفرد الفريد (Unique Constraint)، نقوم بمحاولة جلب الحساب مرة أخرى
      user = await db.user.findUnique({
        where: { clerkId },
      });
      
      if (!user) throw error; // إذا استمر الخطأ لسبب آخر، يتم رميه لتتبعه في السيرفر
    }
  }

  return user;
}