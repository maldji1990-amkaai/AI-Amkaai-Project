import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        paypalSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const subscription = await db.subscription.findFirst({
      where: {
        userId: user.id,
        paypalSubscriptionId: {
          not: null,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        paypalSubscriptionId: true,
      },
    });

    const paypalSubscriptionId =
      user.paypalSubscriptionId ??
      subscription?.paypalSubscriptionId ??
      null;

    if (!paypalSubscriptionId) {
      return NextResponse.json(
        { error: "No PayPal subscription found" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      paypalSubscriptionId,
      paypalManageUrl: "https://www.paypal.com/myaccount/autopay/",
      url: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?manage_subscription=true`
        : "/dashboard?manage_subscription=true",
    });
  } catch (error) {
    console.error("[BILLING_API_ERROR]", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}