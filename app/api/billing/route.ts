import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

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
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 🔍 جلب الاشتراك المرتبط بالمستخدم (نفس الحقول المستخدمة في webhook/route.ts)
    const subscription = await db.subscription.findFirst({
      where: { userId: user.id },
    });

    // ✅ PayPal: نستخدم lemonSubscriptionId كحقل مشترك (تم تسميته هكذا مسبقاً في قاعدة البيانات)
    const paypalSubscriptionId = subscription?.lemonSubscriptionId;

    if (!paypalSubscriptionId) {
      return NextResponse.json(
        { error: "No PayPal subscription found" },
        { status: 400 }
      );
    }

    // 🎯 PayPal لا يوفر "customer portal" مثل Lemon Squeezy — التوجيه يكون
    // إما إلى صفحة إدارة الاشتراكات في حساب PayPal الخاص بالمستخدم نفسه،
    // أو إلى صفحة الداشبورد في موقعك حيث يمكنه إلغاء الاشتراك يدوياً عبر زر مخصص.
    return NextResponse.json({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?manage_subscription=true`,
      paypalManageUrl: "https://www.paypal.com/myaccount/autopay/",
    });

  } catch (error) {
    console.error("❌ Billing API error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
