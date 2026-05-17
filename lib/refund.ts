import { db } from "@/lib/db";

export async function refundCredits(reference: string) {
  return await db.$transaction(async (tx) => {
    // 🔎 نجيب usage
    const usage = await tx.usage.findFirst({
      where: { referenceId: reference },
    });

    if (!usage) {
      throw new Error("Usage not found");
    }

    // 🛑 منع refund مرتين
    if (usage.refunded) {
      return { skipped: true };
    }

    // 💸 رجع credits
    await tx.user.update({
      where: { id: usage.userId },
      data: {
        credits: {
          increment: usage.cost,
        },
      },
    });

    // 🧾 update usage
    await tx.usage.update({
      where: { id: usage.id },
      data: {
        refunded: true,
        status: "FAILED",
      },
    });

    return {
      success: true,
      refundedCredits: usage.cost,
    };
  });
}