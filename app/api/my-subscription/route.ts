import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentSubscription } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        plan: true,
        credits: true,
        createdAt: true,
        paypalSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const latestSub = await getCurrentSubscription(user.id);

    return NextResponse.json({
      plan: user.plan,
      credits: user.credits,
      createdAt: latestSub?.createdAt ?? user.createdAt,
      status: latestSub?.status ?? null,
      currentPeriodEnd: latestSub?.currentPeriodEnd ?? null,
      paypalSubscriptionId: user.paypalSubscriptionId,
      cancelAtPeriodEnd: latestSub?.cancelAtPeriodEnd ?? false,
    });
  } catch (error) {
    console.error("[MY_SUBSCRIPTION]", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
