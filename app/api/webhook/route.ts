import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";
import { PLANS, getPlanFromVariant } from "@/lib/config"; 
import crypto from "crypto";

const ALLOWED_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_payment_success",
  "subscription_expired"
]);

export async function POST(req: Request) {
  try {
    // 🔒 1. التحقق من توقيع Lemon Squeezy لمنع الطلبات الوهمية
    const rawBody = await req.text(); 
    const hmac = crypto.createHmac("sha256", process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "");
    const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
    const signature = Buffer.from(req.headers.get("X-Signature") || "", "utf8");

    if (signature.length !== digest.length || !crypto.timingSafeEqual(digest, signature)) {
      console.error("❌ Webhook unauthorized: Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("📩 Secure Webhook received");

    const eventName = body?.meta?.event_name;
    const eventId = body?.meta?.event_id;

    if (!eventName || !eventId) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ ignored: true }, { status: 200 });
    }

    // 🔒 2. فحص التكرار (Idempotency Check)
    const existingEvent = await db.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      console.log("⚠️ Duplicate webhook ignored:", eventId);
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    const attributes = body?.data?.attributes;
    const email = attributes?.user_email;

    if (!email) {
      return NextResponse.json({ error: "Missing user email" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const variantId = attributes?.variant_id;
    const planName = getPlanFromVariant(variantId); // سيعيد: 'creator' أو 'pro' أو 'premium'

    if (!planName) {
      console.log("⚠️ Unknown variant ID:", variantId);
      return NextResponse.json({ error: "Unknown variant" }, { status: 400 });
    }

    // تأمين جلب اسم الباقة وصيغتها لقاعدة البيانات وملف الـ Config
    const cleanPlanKey = planName.toLowerCase() as "creator" | "pro" | "premium";
    const dbPlan = planName.toUpperCase() as PlanType;
    
    // جلب عدد النقاط ديناميكياً بناءً على ما حددته في ملف الـ Config (70 أو 200 أو 400)
    const creditsToGrant = PLANS[cleanPlanKey]?.credits || 0;

    const lemonCustomerId = attributes?.customer_id?.toString() || null;
    const lemonSubscriptionId = body?.data?.id?.toString() || null; 
    const subscriptionStatus = attributes?.status; // active, cancelled, expired, past_due
    const endsAt = attributes?.ends_at ? new Date(attributes?.ends_at) : null;

    const existingSubscription = await db.subscription.findFirst({
      where: { userId: user.id }
    });

    ////////////////////////////////////////////////////////////////
    // 🧠 هندسة أحداث الاشتراكات (Subscription Logic Handler)
    ////////////////////////////////////////////////////////////////

    // الحالة الأولى: إنشاء اشتراك جديد لأول مرة (شحن رصيد الباقة المشتراة)
    if (eventName === "subscription_created") {
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            plan: dbPlan,
            credits: { increment: creditsToGrant }, 
            lemonCustomerId,
            lemonSubscriptionId,
          },
        }),
        db.subscription.upsert({
          where: { 
            id: existingSubscription?.id || "non_existent_id",
          },
          update: { 
            status: subscriptionStatus, 
            ...(endsAt ? { endsAt } : {}) 
          },
          create: { 
            userId: user.id, 
            status: subscriptionStatus, 
            plan: dbPlan, 
            ...(dbPlan ? { planType: dbPlan } : {}),
            ...(variantId ? {
              variantId: String(variantId),
              variant_id: String(variantId)
            } : {}),
            ...(lemonSubscriptionId ? {
              lemonSubscriptionId: lemonSubscriptionId,
              lemonSqueezyId: lemonSubscriptionId,
            } : {}),
            ...(endsAt ? { endsAt } : {})
          },
        }),
        db.webhookEvent.create({ data: { eventId } }),
      ]);
      console.log(`✅ ${email} Subscribed to ${dbPlan} (+${creditsToGrant} credits)`);
    }

    // الحالة الثانية: نجاح التجديد الشهري التلقائي (إعادة تزويد الحساب بالنقاط للشهر الجديد)
    else if (eventName === "subscription_payment_success") {
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            plan: dbPlan, // إعادة تأكيد الباقة لتفادي أي انقطاع
            credits: { increment: creditsToGrant }, // شحن رصيد الشهر الجديد
          },
        }),
        db.subscription.updateMany({
          where: { userId: user.id },
          data: { 
            status: "active",
            ...(endsAt ? { endsAt: endsAt } : {}) // 🎯 حفظ تاريخ انتهاء الشهر الجديد القادم
          }, 
        }),
        db.webhookEvent.create({ data: { eventId } }),
      ]);
      console.log(`🔄 ${email} Subscription renewed for ${dbPlan} (+${creditsToGrant} credits)`);
    }

    // الحالة الثالثة: تحديث حالة الاشتراك أو انتهاء صلاحيته بالكامل (إيقاف وحظر وتصفير)
    else if (eventName === "subscription_updated" || eventName === "subscription_expired") {
      const isEnded = ["expired", "unpaid", "past_due"].includes(subscriptionStatus);

      await db.$transaction([
        db.subscription.updateMany({
          where: { userId: user.id },
          data: { 
            status: subscriptionStatus,
            ...(endsAt ? { endsAt: endsAt } : {})
          },
        }),
        ...(isEnded ? [
          db.user.update({
            where: { id: user.id },
            data: { 
              plan: PlanType.FREE,
              credits: 0 // 🎯 حماية صلبة: تصفير النقاط فوراً لمنع التوليد غير المدفوع بعد انتهاء الباقة
            }
          })
        ] : []),
        db.webhookEvent.create({ data: { eventId } }),
      ]);
      console.log(`ℹ️ ${email} Subscription updated status to: ${subscriptionStatus}. Is Ended: ${isEnded}`);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("🔥 WEBHOOK ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Internal webhook error" },
      { status: 500 }
    );
  }
}