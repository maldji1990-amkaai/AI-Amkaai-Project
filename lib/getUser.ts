import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";

/** Single user provisioning path for every authenticated request. */
export async function getOrCreateUser(clerkId: string, email?: string | null) {
  if (!clerkId) return null;

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) {
    if (email && existing.email !== email) {
      return db.user.update({ where: { id: existing.id }, data: { email } });
    }
    return existing;
  }

  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          clerkId,
          email: email || null,
          // Account creation must NOT start the trial or grant credits.
          // The PayPal subscription webhook is the single authority that
          // starts the 3-day trial and grants the 30 trial credits.
          plan: PlanType.TRIAL,
          credits: 0,
          trialStartedAt: null,
          trialEndsAt: null,
        },
      });

      return user;
    });
  } catch (error) {
    const raced = await db.user.findUnique({ where: { clerkId } });
    if (!raced) throw error;
    return raced;
  }
}
