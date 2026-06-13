import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    //////////////////////////////////////////////////
    // 📥 INPUT SAFE PARSING
    //////////////////////////////////////////////////
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const paymentId = body?.paymentId;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId required" }, { status: 400 });
    }

    //////////////////////////////////////////////////
    // 🔎 GET PAYMENT (SAFE SELECT)
    //////////////////////////////////////////////////
    const payment = await db.manualPayment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        plan: true,
        status: true,
        verified: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    //////////////////////////////////////////////////
    // 🚫 PREVENT DOUBLE APPROVAL (CRITICAL)
    //////////////////////////////////////////////////
    if (payment.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        message: "Already approved",
      });
    }

    //////////////////////////////////////////////////
    // 👤 GET USER
    //////////////////////////////////////////////////
    const user = await db.user.findUnique({
      where: { id: payment.userId },
      select: { id: true, credits: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    //////////////////////////////////////////////////
    // 💰 CREDIT & PLAN CALCULATION
    //////////////////////////////////////////////////
    const PLAN_CREDITS: Record<string, number> = {
      FREE: 10,
      PRO: 100,
      PREMIUM: 300,
    };

    const creditsToAdd = PLAN_CREDITS[payment.plan.toUpperCase()] ?? 10;

    let targetPlan: PlanType = PlanType.FREE;
    if (payment.plan.toUpperCase() === "PRO") targetPlan = PlanType.PRO;
    if (payment.plan.toUpperCase() === "PREMIUM") targetPlan = PlanType.PREMIUM;

    //////////////////////////////////////////////////
    // 💾 TRANSACTION (ATOMIC + SAFE)
    //////////////////////////////////////////////////
    await db.$transaction(async (tx) => {
      const freshPayment = await tx.manualPayment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });

      if (freshPayment?.status === "COMPLETED") {
        return;
      }

      // 1. تحديث حالة الفاتورة اليدوية إلى COMPLETED
      await tx.manualPayment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          verified: true,
        },
      });

      // 2. تحديث خطة العميل الحالية + زيادة نقاط الإنتاج له
      await tx.user.update({
        where: { id: user.id },
        data: {
          plan: targetPlan,
          credits: { increment: creditsToAdd },
        },
      });

      // 3. إنشاء سجل اشتراك نشط لمدة 30 يوماً
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: targetPlan,
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
      activatedPlan: targetPlan,
    });

  } catch (error) {
    console.error("APPROVE PAYMENT ERROR:", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}