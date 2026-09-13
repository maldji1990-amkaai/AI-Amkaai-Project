import { db } from "@/lib/db";
import { PLANS, ConfigPlanType } from "@/lib/config";
import { PlanType, Prisma } from "@prisma/client";

export const PLAN_TO_ENUM: Record<ConfigPlanType, PlanType> = {
  trial: PlanType.TRIAL,
  monthly: PlanType.MONTHLY,
  quarterly: PlanType.QUARTERLY,
  biannually: PlanType.BIANNUALLY,
  business: PlanType.BUSINESS,
};

export const PLAN_ALIASES: Record<string, ConfigPlanType> = {
  FREE: "trial",
  TRIAL: "trial",
  PRO: "monthly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  BIANNUALLY: "biannually",
  PREMIUM: "business",
  BUSINESS: "business",
};

export function normalizePlan(
  value: unknown,
): ConfigPlanType | null {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();

  return PLAN_ALIASES[key] ?? null;
}

export function planCredits(
  plan: ConfigPlanType,
): number {
  return PLANS[plan].credits;
}

export function planPrice(
  plan: ConfigPlanType,
): number {
  return PLANS[plan].price;
}

export function planDurationMonths(
  plan: ConfigPlanType,
): number | null {
  switch (plan) {
    case "trial":
      return 0;

    case "monthly":
      return 1;

    case "quarterly":
      return 3;

    case "biannually":
      return 6;

    case "business":
      return null;

    default:
      return null;
  }
}

export function addMonths(
  from: Date,
  months: number,
): Date {
  const date = new Date(from);
  date.setMonth(date.getMonth() + months);
  return date;
}

export function effectiveSubscriptionActive(
  sub: {
    status: string;
    currentPeriodEnd: Date | null;
  } | null,
  now = new Date(),
): boolean {
  if (!sub) {
    return false;
  }

  const status = sub.status.toLowerCase();

  if (!["active", "activated"].includes(status)) {
    return false;
  }

  return (
    !sub.currentPeriodEnd ||
    sub.currentPeriodEnd.getTime() >= now.getTime()
  );
}

export async function getCurrentSubscription(
  userId: string,
) {
  const subscriptions = await db.subscription.findMany({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 20,
  });

  const now = new Date();

  return (
    subscriptions.find((subscription) =>
      effectiveSubscriptionActive(subscription, now),
    ) ??
    subscriptions[0] ??
    null
  );
}

/**
 * إضافة credits داخل transaction موجودة.
 *
 * reference يجب أن يكون unique في CreditTransaction.
 * إذا كانت العملية موجودة سابقًا، لا نضيف الرصيد مرة ثانية.
 */
export async function grantCreditsTx(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  reference: string,
  type: string,
  metadata?: Prisma.InputJsonValue,
) {
  const normalizedReference = reference.trim();

  if (!normalizedReference) {
    throw new Error("INVALID_CREDIT_REFERENCE");
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("INVALID_CREDIT_AMOUNT");
  }

  if (!type.trim()) {
    throw new Error("INVALID_CREDIT_TRANSACTION_TYPE");
  }

  const existing = await tx.creditTransaction.findUnique({
    where: {
      reference: normalizedReference,
    },
  });

  if (existing) {
    return existing;
  }

  const user = await tx.user.update({
    where: {
      id: userId,
    },
    data: {
      credits: {
        increment: amount,
      },
    },
    select: {
      credits: true,
    },
  });

  return tx.creditTransaction.create({
    data: {
      userId,
      amount,
      balanceAfter: user.credits,
      type,
      reference: normalizedReference,
      metadata: metadata ?? {},
    },
  });
}

/**
 * إضافة credits داخل transaction جديدة.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  reference: string,
  type: string,
  metadata?: Prisma.InputJsonValue,
) {
  return db.$transaction((tx) =>
    grantCreditsTx(
      tx,
      userId,
      amount,
      reference,
      type,
      metadata,
    ),
  );
}