import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    //////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    // جلب معرف الـ id الداخلي للمستخدم من قاعدة البيانات لأن جدول ManualPayment مربوط بالـ id وليس الـ clerkId
    const dbUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 404 }
      );
    }

    //////////////////////////////////////////////////
    // 📥 INPUT
    //////////////////////////////////////////////////
    let body;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_json" },
        { status: 400 }
      );
    }

    // ❌ قمنا بنزع screenshotUrl من التحقق والمدخلات كما اتفقنا
    const { plan, rip, method, currency, transactionId } = body;

    if (!plan || !method || !currency) {
      return NextResponse.json(
        { error: "missing_fields" },
        { status: 400 }
      );
    }

    // التأكد من تطابق اسم الباقة مع الحروف الكبيرة للـ Schema
    const normalizedPlan = plan.toUpperCase();
    if (normalizedPlan !== "PRO" && normalizedPlan !== "PREMIUM") {
      return NextResponse.json(
        { error: "invalid_plan" },
        { status: 400 }
      );
    }

    //////////////////////////////////////////////////
    // 💰 PRICE LOGIC
    //////////////////////////////////////////////////
    // ضبط القيمة الرقمية (Float) حسب الباقة المحددة
    const amount = normalizedPlan === "PRO" ? 15.0 : 25.0;

    //////////////////////////////////////////////////
    // 💾 CREATE PAYMENT
    //////////////////////////////////////////////////
    const payment = await db.manualPayment.create({
      data: {
        userId: dbUser.id, // استخدام المعرف الداخلي المربوط بالعلاقة Cascade
        plan: normalizedPlan,
        method: method.toLowerCase(), // مثل "baridimob" أو "crypto"
        currency: currency.toUpperCase(), // "USD" أو "DA"
        amount: amount,
        transactionId: transactionId || null, // اختياري في حال كتب العميل رقم المعاملة
        screenshotUrl: null, // تركها فارغة نهائياً لأننا ألغينا رفع الصور
        ipAddress: rip || null,
        status: "PENDING",
        verified: false,
      },
    });

    //////////////////////////////////////////////////
    // 📤 RESPONSE
    //////////////////////////////////////////////////
    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
    });

  } catch (error) {
    console.error("Manual payment error:", error);

    return NextResponse.json(
      { error: "internal_server_error" },
      { status: 500 }
    );
  }
}