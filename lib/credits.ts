import { db } from "@/lib/db";
import { grantCredits, grantCreditsTx } from "@/lib/billing";
import { AI_COSTS, AIType } from "@/lib/config";
import { UsageStatus } from "@prisma/client";

type CreditOptions = {
  reference?: string | null;
  duration?: number;
};

type UseCreditsResult = {
  cost: number;
  remainingCredits: number;
  usageId: string;
  referenceId: string | null;
};

function calculateCreditCost(
  type: AIType,
  options?: CreditOptions,
): number {
  const baseCost = AI_COSTS[type];

  if (!Number.isFinite(baseCost) || baseCost <= 0) {
    throw new Error("INVALID_CREDIT_TYPE");
  }

  if (type === "video" && options?.duration !== undefined) {
    const duration = Number(options.duration);

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("INVALID_VIDEO_DURATION");
    }

    return baseCost * Math.max(1, Math.ceil(duration));
  }

  return baseCost;
}

/**
 * خصم credits بطريقة ذرية وآمنة.
 *
 * لا يتم فحص الاشتراك أو تاريخ انتهائه.
 * السماح بالتوليد يعتمد على الرصيد المتاح فقط.
 */
export async function useCredits(
  userId: string,
  type: AIType,
  options?: CreditOptions,
): Promise<UseCreditsResult> {
  const cost = calculateCreditCost(type, options);
  const referenceId = options?.reference?.trim() || null;

  return db.$transaction(async (tx) => {
    /*
     * منع الخصم المكرر عند إعادة إرسال نفس الطلب.
     */
    if (referenceId) {
      const existingUsage = await tx.usage.findUnique({
        where: {
          referenceId,
        },
        select: {
          id: true,
          userId: true,
          cost: true,
          referenceId: true,
        },
      });

      if (existingUsage) {
        if (existingUsage.userId !== userId) {
          throw new Error("REFERENCE_ALREADY_USED");
        }

        const user = await tx.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            credits: true,
          },
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        return {
          cost: existingUsage.cost,
          remainingCredits: user.credits,
          usageId: existingUsage.id,
          referenceId: existingUsage.referenceId,
        };
      }
    }

    /*
     * الخصم الذري يمنع الرصيد السالب عند الطلبات المتزامنة.
     */
    const updateResult = await tx.user.updateMany({
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

    if (updateResult.count !== 1) {
      const userExists = await tx.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
        },
      });

      if (!userExists) {
        throw new Error("USER_NOT_FOUND");
      }

      throw new Error("NOT_ENOUGH_CREDITS");
    }

    const userAfterDeduction = await tx.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        credits: true,
      },
    });

    if (!userAfterDeduction) {
      throw new Error("USER_NOT_FOUND");
    }

    const usage = await tx.usage.create({
      data: {
        userId,
        type,
        cost,
        status: UsageStatus.COMPLETED,
        refunded: false,
        referenceId,
      },
      select: {
        id: true,
        referenceId: true,
      },
    });

    return {
      cost,
      remainingCredits: userAfterDeduction.credits,
      usageId: usage.id,
      referenceId: usage.referenceId,
    };
  });
}

/**
 * تعليم Usage كمكتمل.
 *
 * الدالة idempotent:
 * إذا كان السجل مكتملًا، تعيده دون خصم جديد.
 * وإذا كان قد استُرجع، تمنع إعادته إلى COMPLETED.
 */
export async function markUsageSuccess(
  referenceId: string,
) {
  const normalizedReferenceId = referenceId.trim();

  if (!normalizedReferenceId) {
    throw new Error("USAGE_REFERENCE_REQUIRED");
  }

  const usage = await db.usage.findUnique({
    where: {
      referenceId: normalizedReferenceId,
    },
    select: {
      id: true,
      status: true,
      refunded: true,
    },
  });

  if (!usage) {
    throw new Error("USAGE_NOT_FOUND");
  }

  if (
    usage.refunded ||
    usage.status === UsageStatus.REFUNDED
  ) {
    throw new Error("USAGE_ALREADY_REFUNDED");
  }

  if (usage.status === UsageStatus.COMPLETED) {
    return usage;
  }

  return db.usage.update({
    where: {
      id: usage.id,
    },
    data: {
      status: UsageStatus.COMPLETED,
    },
    select: {
      id: true,
      status: true,
      refunded: true,
    },
  });
}

/**
 * رد credits بعد فشل عملية التوليد.
 */
export async function refundCredits(
  referenceId: string,
): Promise<{
  refunded: boolean;
  amount: number;
  remainingCredits: number;
}> {
  const normalizedReferenceId = referenceId.trim();

  if (!normalizedReferenceId) {
    throw new Error("INVALID_REFERENCE_ID");
  }

  return db.$transaction(async (tx) => {
    const usage = await tx.usage.findUnique({
      where: {
        referenceId: normalizedReferenceId,
      },
      select: {
        id: true,
        userId: true,
        cost: true,
        status: true,
        refunded: true,
      },
    });

    if (!usage) {
      throw new Error("USAGE_NOT_FOUND");
    }

    if (
      usage.refunded ||
      usage.status === UsageStatus.REFUNDED
    ) {
      const user = await tx.user.findUnique({
        where: {
          id: usage.userId,
        },
        select: {
          credits: true,
        },
      });

      return {
        refunded: false,
        amount: 0,
        remainingCredits: user?.credits ?? 0,
      };
    }

    await tx.usage.update({
      where: {
        id: usage.id,
      },
      data: {
        refunded: true,
        status: UsageStatus.REFUNDED,
      },
    });

    await grantCreditsTx(
      tx,
      usage.userId,
      usage.cost,
      `refund:${normalizedReferenceId}`,
      "REFUND",
      {
        reason: "VIDEO_GENERATION_REFUND",
        usageId: usage.id,
        referenceId: normalizedReferenceId,
      },
    );

    const userAfterRefund = await tx.user.findUnique({
      where: {
        id: usage.userId,
      },
      select: {
        credits: true,
      },
    });

    return {
      refunded: true,
      amount: usage.cost,
      remainingCredits: userAfterRefund?.credits ?? 0,
    };
  });
}

/**
 * إضافة credits يدويًا أو من خلال webhook الدفع.
 */
export async function addCredits(
  userId: string,
  amount: number,
  referenceId?: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("INVALID_CREDIT_AMOUNT");
  }

  return grantCredits(
    userId,
    amount,
    referenceId?.trim() || `manual:${crypto.randomUUID()}`,
    "CREDIT_PURCHASE",
  );
}