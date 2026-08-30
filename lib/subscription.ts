import { db } from "@/lib/db";
import { PLANS } from "@/lib/config";

type AppPlanType = keyof typeof PLANS;

export async function isProUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const user = await db.user.findFirst({
    where: { OR: [{ id: userId }, { clerkId: userId }] },
    select: { plan: true },
  });
  if (!user) return false;
  return ["MONTHLY", "QUARTERLY", "BIANNUALLY", "BUSINESS"].includes(user.plan);
}

export async function getUserPlan(userId: string): Promise<AppPlanType> {
  if (!userId) return "trial";
  const user = await db.user.findFirst({
    where: { OR: [{ id: userId }, { clerkId: userId }] },
    select: { plan: true },
  });
  const plan = user?.plan?.toLowerCase() as AppPlanType | undefined;
  return plan && plan in PLANS ? plan : "trial";
}
