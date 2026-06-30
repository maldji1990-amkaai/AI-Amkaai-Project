// app/api/my-subscription/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        plan: true,
        credits: true,
        createdAt: true,
        lemonSubscriptionId: true,
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // نجلب أحدث Subscription record للحصول على status و currentPeriodEnd
    const latestSub = await db.subscription.findFirst({
      where: { userId: (await db.user.findUnique({ where: { clerkId } }))!.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      plan: user.plan,
      credits: user.credits,
      createdAt: latestSub?.createdAt ?? user.createdAt,
      status: latestSub?.status ?? null,
      currentPeriodEnd: latestSub?.currentPeriodEnd ?? null,
      lemonSubscriptionId: user.lemonSubscriptionId,
    });
  } catch (error) {
    console.error("[MY_SUBSCRIPTION]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
