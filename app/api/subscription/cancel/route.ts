// app/api/subscription/cancel/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const LEMON_API_KEY = process.env.LEMONSQUEEZY_API_KEY!;

export async function POST() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.lemonSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found for this account." },
        { status: 400 }
      );
    }

    // أحدث Subscription record المرتبط بالمستخدم
    const latestSub = await db.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestSub) {
      return NextResponse.json(
        { error: "No subscription record found." },
        { status: 404 }
      );
    }

    if (latestSub.status === "cancelled") {
      return NextResponse.json(
        { error: "Subscription is already cancelled." },
        { status: 400 }
      );
    }

    // ── إلغاء الاشتراك فعلياً عبر Lemon Squeezy API ──
    // Lemon Squeezy: DELETE /v1/subscriptions/{id} يلغي الاشتراك في نهاية الفترة الحالية
    // (cancelled=true لكن يبقى active حتى renews_at/ends_at)
    const lemonRes = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${user.lemonSubscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          Authorization: `Bearer ${LEMON_API_KEY}`,
        },
      }
    );

    if (!lemonRes.ok) {
      const errBody = await lemonRes.text();
      console.error("[LEMON_CANCEL_FAILED]", lemonRes.status, errBody);
      return NextResponse.json(
        { error: "Failed to cancel subscription with payment provider. Please try again or contact support." },
        { status: 502 }
      );
    }

    // ── تحديث قاعدة البيانات محلياً ──
    // الحالة تتحول إلى "cancelled" لكن currentPeriodEnd يبقى كما هو
    // (الوصول يستمر حتى نهاية الفترة المدفوعة، الويبهوك subscription_cancelled سيؤكد لاحقاً)
    await db.subscription.update({
      where: { id: latestSub.id },
      data: { status: "cancelled" },
    });

    // إشعار للمستخدم
    await db.notification.create({
      data: {
        userId: user.id,
        title: "Subscription Cancelled",
        message: latestSub.currentPeriodEnd
          ? `Your subscription has been cancelled. You'll keep full access until ${new Date(latestSub.currentPeriodEnd).toLocaleDateString()}.`
          : "Your subscription has been cancelled.",
      },
    });

    return NextResponse.json({
      success: true,
      status: "cancelled",
      currentPeriodEnd: latestSub.currentPeriodEnd,
      message: "Subscription cancelled successfully. You'll retain access until the end of your billing period.",
    });
  } catch (error) {
    console.error("[SUBSCRIPTION_CANCEL]", error);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
