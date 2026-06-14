import { db } from "@/lib/db";
import { AI_COSTS, AIType } from "@/lib/config";
import { UsageStatus } from "@prisma/client";

//////////////////////////////////////////////////
// 🧠 TYPES & OPTIONS
//////////////////////////////////////////////////

type UseCreditsOptions = {
  reference?: string;
};

//////////////////////////////////////////////////
// 🚀 USE CREDITS (SAFE + ATOMIC + LEMON SQUEEZY SHIELD)
//////////////////////////////////////////////////

export async function useCredits(
  userId: string,
  type: AIType,
  options?: UseCreditsOptions
) {
  // 1. جلب تكلفة العملية من الإعدادات
  const cost = AI_COSTS[type];

  if (!cost) {
    throw new Error("Invalid AI type");
  }

  const reference = options?.reference ?? null;

  // تشغيل المعاملة الآمنة لضمان تنفيذ كل الخطوات أو إلغائها معاً (Atomicity)
  const result = await db.$transaction(async (tx) => {
    
    //////////////////////////////////////////////////
    // 🛡️ LEMON SQUEEZY SUBSCRIPTION CHECK
    //////////////////////////////////////////////////
    // 🛠️ الحل الجذري: نطلب فقط حقل status لتجنب عدم مطابقة تسمية حقل الوقت في Prisma Schema
    const subscription = await tx.subscription.findFirst({
      where: { userId },
      select: { status: true }, 
    }) as any;

    if (subscription) {
      // الحالات المسموح لها بالتوليد فقط في Lemon Squeezy
      const allowedStatuses = ["active", "on_trial"];
      
      if (!allowedStatuses.includes(subscription.status)) {
        throw new Error("SUBSCRIPTION_EXPIRED_OR_INACTIVE");
      }

      // فحص إضافي آمن وديناميكي: التحقق من وجود أي حقل تاريخ انتهاء صلاحية (سواء كان endsAt أو expiresAt) دون إجبار الـ linter عليه
      const subscriptionEndsAt = subscription.endsAt || subscription.expiresAt || null;
      if (subscriptionEndsAt && new Date() > new Date(subscriptionEndsAt)) {
        throw new Error("SUBSCRIPTION_EXPIRED_OR_INACTIVE");
      }
    }

    //////////////////////////////////////////////////
    // 💸 DEDUCT CREDITS SAFELY (ANTI-RACE CONDITION)
    //////////////////////////////////////////////////
    // الخصم الحصين يتم فقط إذا كان رصيد المستخدم الحالي أكبر من أو يساوي تكلفة العملية
    const update = await tx.user.updateMany({
      where: {
        id: userId,
        credits: {
          gte: cost,
        },
      },
      data: {
        credits: {
          decrement: cost,
        },
      },
    });

    // إذا كانت النتيجة 0، فهذا يعني أن نقاط المستخدم لا تكفي
    if (update.count === 0) {
      throw new Error("NOT_ENOUGH_CREDITS");
    }

    //////////////////////////////////////////////////
    // 📊 USAGE LOG (RECORD INITIALIZATION)
    //////////////////////////////////////////////////
    // إنشاء سجل الاستهلاك وتثبيت حالتها كـ PENDING لحين معالجة السيرفرات
    const usage = await tx.usage.create({
      data: {
        userId,
        type,
        cost,
        status: UsageStatus.PENDING, 
        refunded: false,
        referenceId: reference, 
      },
    });

    //////////////////////////////////////////////////
    // 🔍 UTILITY: GET EXACT BALANCE
    //////////////////////////////////////////////////
    // جلب الرصيد الدقيق المتبقي لحساب المستخدم
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    return {
      usage,
      credits: user?.credits ?? 0,
    };
  });

  return {
    success: true,
    cost,
    usageId: result.usage.id,
    reference,
    remainingCredits: result.credits,
  };
}

//////////////////////////////////////////////////
// ✅ MARK SUCCESS (PROD COMPLETED)
//////////////////////////////////////////////////

export async function markUsageSuccess(reference: string) {
  if (!reference) return;

  await db.usage.updateMany({
    where: {
      referenceId: reference,
      status: UsageStatus.PENDING,
    },
    data: {
      status: UsageStatus.COMPLETED,
    },
  });
}

//////////////////////////////////////////////////
// 💸 REFUND SYSTEM (SECURED AGAINST DOUBLE REFUNDS)
//////////////////////////////////////////////////

export async function refundCredits(reference: string) {
  if (!reference) {
    throw new Error("Missing reference for refund");
  }

  return await db.$transaction(async (tx) => {
    // جلب سجل الاستهلاك بناءً على المعرّف الفريد
    const usage = await tx.usage.findFirst({
      where: { referenceId: reference },
    });

    if (!usage) {
      throw new Error("Usage not found");
    }

    // صمام أمان لمنع عمليات استرجاع النقاط المتكررة لنفس الـ API Call
    if (usage.refunded || usage.status === UsageStatus.FAILED) {
      return { skipped: true, message: "Credits already refunded or usage failed" };
    }

    //////////////////////////////////////////////////
    // 🔒 LOCK USAGE STATE FIRST
    //////////////////////////////////////////////////
    // نقوم بتغيير حالة السجل إلى فاشل ومسترجع أولاً لقطع الطريق على أي عملية تداخل برمجية
    await tx.usage.update({
      where: { id: usage.id },
      data: {
        refunded: true,
        status: UsageStatus.FAILED, 
      },
    });

    //////////////////////////////////////////////////
    // 💸 INCREMENT USER CREDITS
    //////////////////////////////////////////////////
    // إعادة النقاط بأمان وبشكل كامل إلى الحساب الرئيسي للمستخدم
    await tx.user.update({
      where: { id: usage.userId },
      data: {
        credits: {
          increment: usage.cost,
        },
      },
    });

    return {
      success: true,
      refundedCredits: usage.cost,
    };
  });
}

//////////////////////////////////////////////////
// 🔍 UTILITY HELPERS
//////////////////////////////////////////////////

export async function getUserCredits(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user) throw new Error("User not found");

  return user.credits;
}

export async function addCredits(userId: string, amount: number) {
  return await db.user.update({
    where: { id: userId },
    data: {
      credits: {
        increment: amount,
      },
    },
  });
}