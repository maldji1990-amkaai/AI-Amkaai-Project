import { db } from "@/lib/db";
import { AI_COSTS, AIType } from "@/lib/config";
import { UsageStatus } from "@prisma/client";

type UseCreditsOptions = { reference?: string; duration?: number };

export async function useCredits(userId: string, type: AIType, options?: UseCreditsOptions) {
  const baseCost = AI_COSTS[type];
  if (!baseCost) throw new Error("Invalid AI type");

  const cost = type === "video" && options?.duration
    ? baseCost * Math.max(1, Math.ceil(options.duration))
    : baseCost;
  const reference = options?.reference ?? null;

  const result = await db.$transaction(async (tx) => {
    if (reference) {
      const existing = await tx.usage.findUnique({ where: { referenceId: reference } });
      if (existing) {
        if (existing.userId !== userId) throw new Error("IDEMPOTENCY_KEY_REUSED");
        const existingUser = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
        return { usage: existing, credits: existingUser?.credits ?? 0 };
      }
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true, plan: true, trialEndsAt: true },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const subscription = await tx.subscription.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { status: true, currentPeriodEnd: true },
    });

    const now = Date.now();
    const isTrial = user.plan === "TRIAL";
    if (isTrial) {
      if (user.trialEndsAt && now > user.trialEndsAt.getTime()) {
        throw new Error("SUBSCRIPTION_EXPIRED_OR_INACTIVE");
      }
    } else if (subscription) {
      if (subscription.status.toLowerCase() !== "active") {
        throw new Error("SUBSCRIPTION_EXPIRED_OR_INACTIVE");
      }
      if (subscription.currentPeriodEnd && now > subscription.currentPeriodEnd.getTime()) {
        throw new Error("SUBSCRIPTION_EXPIRED_OR_INACTIVE");
      }
    }

    const update = await tx.user.updateMany({
      where: { id: userId, credits: { gte: cost } },
      data: { credits: { decrement: cost } },
    });
    if (update.count === 0) throw new Error("NOT_ENOUGH_CREDITS");

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

    const balance = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    return { usage, credits: balance?.credits ?? 0 };
  });

  return {
    success: true,
    cost,
    usageId: result.usage.id,
    reference,
    remainingCredits: result.credits,
  };
}

export async function markUsageSuccess(reference: string) {
  if (!reference) return;
  await db.usage.updateMany({
    where: { referenceId: reference, status: UsageStatus.PENDING },
    data: { status: UsageStatus.COMPLETED },
  });
}

export async function refundCredits(reference: string) {
  if (!reference) throw new Error("Missing reference for refund");
  return db.$transaction(async (tx) => {
    const usage = await tx.usage.findUnique({ where: { referenceId: reference } });
    if (!usage) throw new Error("Usage not found");
    if (usage.refunded || usage.status === UsageStatus.FAILED || usage.status === UsageStatus.REFUNDED) {
      return { skipped: true, message: "Credits already refunded" };
    }
    await tx.usage.update({
      where: { id: usage.id },
      data: { refunded: true, status: UsageStatus.REFUNDED },
    });
    await tx.user.update({ where: { id: usage.userId }, data: { credits: { increment: usage.cost } } });
    return { success: true, refundedCredits: usage.cost };
  });
}

export async function getUserCredits(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
  if (!user) throw new Error("User not found");
  return user.credits;
}

export async function addCredits(userId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid credit amount");
  return db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
}
