import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";

export async function getOrCreateUser(clerkId: string) {
  let user = await db.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        clerkId,
        credits: 10,
        plan: PlanType.FREE,
      },
    });
  }

  return user;
}