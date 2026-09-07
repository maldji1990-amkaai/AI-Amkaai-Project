import { db } from "@/lib/db";
import { PLANS } from "@/lib/config";
import { getCurrentSubscription, effectiveSubscriptionActive } from "@/lib/billing";

type AppPlanType = keyof typeof PLANS;

export async function getEffectiveEntitlement(userId: string) {
  const user = await db.user.findFirst({
    where: { OR: [{ id: userId }, { clerkId: userId }] },
    select: { id: true, plan: true, trialEndsAt: true },
  });
  if (!user) return { active: false, plan: "trial" as AppPlanType, subscription: null };

  const now = new Date();
  if (user.plan === "TRIAL") {
    return { active: !!user.trialEndsAt && user.trialEndsAt >= now, plan: "trial" as AppPlanType, subscription: null };
  }

  const subscription = await getCurrentSubscription(user.id);
  const active = effectiveSubscriptionActive(subscription, now) && subscription?.plan === user.plan;
  return { active, plan: user.plan.toLowerCase() as AppPlanType, subscription };
}

export async function isProUser(userId: string): Promise<boolean> {
  const entitlement = await getEffectiveEntitlement(userId);
  return entitlement.active && entitlement.plan !== "trial";
}

export async function getUserPlan(userId: string): Promise<AppPlanType> {
  const entitlement = await getEffectiveEntitlement(userId);
  return entitlement.plan in PLANS ? entitlement.plan : "trial";
}
