import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";

export async function getOrCreateUser(clerkId: string) {
  if (!clerkId) return null;

  let user = await db.user.findUnique({ where: { clerkId } });
  if (user) return user;

  try {
    return await db.user.create({
      data: {
        clerkId,
        credits: 10,
        plan: PlanType.TRIAL,
      },
    });
  } catch (error) {
    user = await db.user.findUnique({ where: { clerkId } });
    if (!user) throw error;
    return user;
  }
}
