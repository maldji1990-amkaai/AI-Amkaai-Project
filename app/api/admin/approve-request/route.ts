import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";
import { PLANS, ConfigPlanType } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    //////////////////////////////////////////////////
    // 🔐 [إصلاح حرج] هذا الـ route كان بدون أي حماية إطلاقاً — أي زائر يقدر
    // يفعّل أي طلب دفع بدون أن يدفع فلساً واحداً. الآن محمي بنفس نمط الأدمن
    // المستخدم في باقي مسارات app/api/admin.
    //////////////////////////////////////////////////
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

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
    // ✅ مصحح: خريطة الباقات القديمة (FREE/PRO/PREMIUM) كانت مكسورة تماماً مع enum
    // الجديد ولا تحتوي حتى على MONTHLY أو BUSINESS. الآن نقرأ القيم مباشرة من
    // lib/config.ts (مصدر الحقيقة الوحيد لعدد نقاط كل باقة) بدل تكرارها هنا يدوياً.
    const planKeyLower = payment.plan.toLowerCase() as ConfigPlanType;
    const isValidPlanKey = planKeyLower in PLANS;

    if (!isValidPlanKey) {
      return NextResponse.json(
        { error: `Unknown plan "${payment.plan}" on this payment record` },
        { status: 400 }
      );
    }

    const creditsToAdd = PLANS[planKeyLower].credits;

    // تحويل مفتاح الباقة الصغير (trial/monthly/...) إلى قيمة enum الفعلية بقاعدة البيانات
    const PLAN_KEY_TO_ENUM: Record<ConfigPlanType, PlanType> = {
      trial: PlanType.TRIAL,
      monthly: PlanType.MONTHLY,
      quarterly: PlanType.QUARTERLY,
      biannually: PlanType.BIANNUALLY,
      business: PlanType.BUSINESS,
    };
    const targetPlan: PlanType = PLAN_KEY_TO_ENUM[planKeyLower];

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
          // 🆕 دفعة يدوية مُوافَق عليها = ليست trial بالتعريف، نُلغي أي أثر لفترة تجربة سابقة
          trialStartedAt: null,
          trialEndsAt: null,
        },
      });

      // 3. إنشاء سجل اشتراك نشط لمدة 30 يوماً
      await tx.subscription.create({
        data: {
          userId: user.id,
          plan: targetPlan,
          status: "active",
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
