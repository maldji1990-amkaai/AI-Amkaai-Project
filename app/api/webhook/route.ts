import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";
import { PLANS, getPlanFromVariant } from "@/lib/config";
import crypto from "crypto";

const ALLOWED_EVENTS = new Set([
  "order_created",                 // 🆕 الدفعة الواحدة (Trial / Creator Pass)
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
    // 🆕 Lemon Squeezy يرسل "webhook_id" وليس "event_id" — نستخدمه كمعرّف فريد
    //    مع fallback لـ data.id لضمان عدم التكرار حتى لو تغيّر الشكل مستقبلاً
    const eventId: string | undefined =
      body?.meta?.webhook_id || body?.meta?.event_id || body?.data?.id;

    if (!eventName || !eventId) {
      console.error("❌ Invalid payload — missing eventName or eventId", { eventName, eventId });
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ ignored: true }, { status: 200 });
    }

    // 🔒 2. فحص التكرار (Idempotency Check)
    // ملاحظة: نجمع eventName مع eventId لأن نفس webhook_id قد يتكرر بين order و order arbitrary refire
    const idempotencyKey = `${eventName}:${eventId}`;
    const existingEvent = await db.webhookEvent.findUnique({
      where: { eventId: idempotencyKey },
    });

    if (existingEvent) {
      console.log("⚠️ Duplicate webhook ignored:", idempotencyKey);
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    const attributes = body?.data?.attributes;
    const email = attributes?.user_email;
    // 🆕 معرّف Clerk الذي أرسلناه كـ custom_data عند إنشاء رابط الدفع — أدق من البحث بالإيميل
    const customDataUserId: string | undefined = body?.meta?.custom_data?.user_id;

    if (!email && !customDataUserId) {
      return NextResponse.json({ error: "Missing user identifier" }, { status: 400 });
    }

    // 🔍 البحث عن المستخدم: أولوية لـ Clerk userId ثم fallback للإيميل
    const user = customDataUserId
      ? await db.user.findUnique({ where: { clerkId: customDataUserId } })
      : await db.user.findUnique({ where: { email } });

    if (!user) {
      console.error("❌ User not found", { customDataUserId, email });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    ////////////////////////////////////////////////////////////////
    // 🆕 الحالة الجديدة: طلب دفعة واحدة (One-time Order — مثل Trial Pass)
    ////////////////////////////////////////////////////////////////
    if (eventName === "order_created") {
      const orderStatus = attributes?.status; // "paid" | "pending" | "refunded" | ...
      const variantId = attributes?.first_order_item?.variant_id;

      if (orderStatus !== "paid") {
        console.log(`ℹ️ Order ${eventId} status is "${orderStatus}" — skipping credit grant`);
        await db.webhookEvent.create({ data: { eventId: idempotencyKey } });
        return NextResponse.json({ ignored: true, reason: "not_paid" }, { status: 200 });
      }

      const planName = getPlanFromVariant(variantId); // 'trial' | 'creator' | 'pro' | 'premium' | null

      if (!planName) {
        console.log("⚠️ Unknown variant ID for order:", variantId);
        return NextResponse.json({ error: "Unknown variant" }, { status: 400 });
      }

      const creditsToGrant = (PLANS[planName] as any)?.credits || 0;
      const planMap: Record<string, PlanType> = {
        trial: PlanType.CREATOR,
        quarterly: PlanType.PRO,
        biannually: PlanType.PREMIUM,
      };
      const dbPlan = planMap[planName] || PlanType.FREE;
      const lemonCustomerId = attributes?.customer_id?.toString() || null;

      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            plan: dbPlan,
            credits: { increment: creditsToGrant },
            lemonCustomerId,
          },
        }),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);

      console.log(`✅ ${user.email} paid for ${dbPlan} order (+${creditsToGrant} credits)`);
      return NextResponse.json({ success: true });
    }

    ////////////////////////////////////////////////////////////////
    // 🧠 هندسة أحداث الاشتراكات (Subscription Logic Handler)
    ////////////////////////////////////////////////////////////////

    const variantId = attributes?.variant_id;
    const planName = getPlanFromVariant(variantId); // سيعيد: 'trial' أو 'quarterly' أو 'biannually'

    if (!planName) {
      console.log("⚠️ Unknown variant ID:", variantId);
      return NextResponse.json({ error: "Unknown variant" }, { status: 400 });
    }

    const creditsToGrant = (PLANS[planName] as any)?.credits || 0;
    const subPlanMap: Record<string, PlanType> = {
      trial: PlanType.CREATOR,
      quarterly: PlanType.PRO,
      biannually: PlanType.PREMIUM,
    };
    const dbPlan = subPlanMap[planName] || PlanType.FREE;

    const lemonCustomerId = attributes?.customer_id?.toString() || null;
    const lemonSubscriptionId = body?.data?.id?.toString() || null;
    const subscriptionStatus = attributes?.status;
    const endsAt = attributes?.ends_at ? new Date(attributes.ends_at) : null;

    const existingSubscription = await db.subscription.findFirst({
      where: { userId: user.id },
    });

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
            ...(endsAt ? { endsAt } : {}),
          },
          create: {
            userId: user.id,
            status: subscriptionStatus,
            plan: dbPlan,
            ...(dbPlan ? { planType: dbPlan } : {}),
            ...(variantId ? {
              variantId: String(variantId),
              variant_id: String(variantId),
            } : {}),
            ...(lemonSubscriptionId ? {
              lemonSubscriptionId: lemonSubscriptionId,
              lemonSqueezyId: lemonSubscriptionId,
            } : {}),
            ...(endsAt ? { endsAt } : {}),
          },
        }),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);
      console.log(`✅ ${user.email} Subscribed to ${dbPlan} (+${creditsToGrant} credits)`);
    }

    // الحالة الثانية: نجاح التجديد الشهري التلقائي
    else if (eventName === "subscription_payment_success") {
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            plan: dbPlan,
            credits: { increment: creditsToGrant },
          },
        }),
        db.subscription.updateMany({
          where: { userId: user.id },
          data: {
            status: "active",
            ...(endsAt ? { endsAt: endsAt } : {}),
          },
        }),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);
      console.log(`🔄 ${user.email} Subscription renewed for ${dbPlan} (+${creditsToGrant} credits)`);
    }

    // الحالة الثالثة: تحديث حالة الاشتراك أو انتهاء صلاحيته بالكامل
    else if (eventName === "subscription_updated" || eventName === "subscription_expired") {
      const isEnded = ["expired", "unpaid", "past_due"].includes(subscriptionStatus);

      await db.$transaction([
        db.subscription.updateMany({
          where: { userId: user.id },
          data: {
            status: subscriptionStatus,
            ...(endsAt ? { endsAt: endsAt } : {}),
          },
        }),
        ...(isEnded ? [
          db.user.update({
            where: { id: user.id },
            data: {
              plan: PlanType.FREE,
              credits: 0,
            },
          }),
        ] : []),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);
      console.log(`ℹ️ ${user.email} Subscription updated status to: ${subscriptionStatus}. Is Ended: ${isEnded}`);
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
