import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const clerkUser = await currentUser(); // جلب بيانات المستخدم الحالية من Clerk لضمان الحصول على البريد

    if (!userId || !clerkUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const plan = body?.plan;

    if (plan !== "pro" && plan !== "premium") {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    const baseCheckoutUrl =
      plan === "premium"
        ? process.env.LEMON_SQUEEZY_PREMIUM_URL
        : process.env.LEMON_SQUEEZY_PRO_URL;

    if (!baseCheckoutUrl) {
      return NextResponse.json(
        { error: "Missing checkout URL" },
        { status: 500 }
      );
    }

    // 👤 جلب بريد المستخدم الأساسي من Clerk
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress;

    // 🔍 جلب سجل المستخدم من قاعدة البيانات المحلية للحصول على الـ Local ID الفريد
    const user = await db.user.findUnique({
      where: {
        clerkId: userId, // تأكد أن اسم الحقل في جدولك هو clerkId (أو id حسب الـ Schema لديك)
      },
    });

    const dbUserId = user?.id || userId;

    ////////////////////////////////////////////////////////////////
    // 🔗 🚀 هندسة الرابط الديناميكي الآمن (Lemon Squeezy Dynamic Injection)
    ////////////////////////////////////////////////////////////////
    // نقوم بحقن البريد الإلكتروني وتمرير الـ ID عبر مصفوفة الـ custom (المعروفة بـ passthrough في ليمون)
    const checkoutParams = new URLSearchParams();
    
    if (userEmail) {
      checkoutParams.append("checkout[email]", userEmail); // تعبئة البريد تلقائياً في صفحة الدفع لمنع التلاعب
    }
    
    // تمرير الـ userId بداخل مصفوفة custom (بصيغة JSON مشفرة كـ string) لكي يعيدها الـ Webhook لنا فور نجاح الدفع
    const customData = JSON.stringify({ userId: dbUserId, plan });
    checkoutParams.append("checkout[custom][user_id]", dbUserId);
    checkoutParams.append("passthrough", customData); 

    // دمج المعاملات مع الرابط الأساسي
    const finalCheckoutUrl = `${baseCheckoutUrl}${baseCheckoutUrl.includes("?") ? "&" : "?"}${checkoutParams.toString()}`;

    // 📊 تسجيل محاولة الدفع المتروكة (Abandoned Checkout tracking)
    try {
      await db.abandonedCheckout.create({
        data: {
          userId: dbUserId,
          email: userEmail || user?.email || "unknown",
          checkoutUrl: finalCheckoutUrl,
          plan,
        },
      });
    } catch (e) {
      console.warn("Checkout tracking skipped:", e);
    }

    // إرجاع الرابط الديناميكي الجديد والآمن بنسبة 100%
    return NextResponse.json({
      url: finalCheckoutUrl,
    });
  } catch (error: any) {
    console.error("CHECKOUT ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Checkout failed",
      },
      {
        status: 500,
      }
    );
  }
}