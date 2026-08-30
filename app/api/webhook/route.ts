import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";
import { PLANS } from "@/lib/config";

export const dynamic = "force-dynamic";

// 🌍 نفس القاعدة المستخدمة في checkout/route.ts
const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// ⚙️ خريطة عكسية: من PayPal Plan ID إلى اسم الخطة الداخلي في موقعك
function getPlanFromPayPalPlanId(
  planId: string | undefined | null
): "trial" | "monthly" | "quarterly" | "biannually" | "business" | null {
  if (!planId) return null;
  if (planId === process.env.PAYPAL_PLAN_ID_TRIAL) return "trial";
  if (planId === process.env.PAYPAL_PLAN_ID_MONTHLY) return "monthly";
  if (planId === process.env.PAYPAL_PLAN_ID_QUARTERLY) return "quarterly";
  if (planId === process.env.PAYPAL_PLAN_ID_BIANNUALLY) return "biannually";
  if (planId === process.env.PAYPAL_PLAN_ID_BUSINESS) return "business";
  return null;
}

// 🔑 جلب access token من PayPal (نفس منطق checkout)
async function getPayPalAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_SECRET_KEY!;
  const basicAuth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal auth failed: ${errText}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// 🔒 التحقق من صحة الـ Webhook باستخدام PayPal Verification API
async function verifyPayPalWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  try {
    const accessToken = await getPayPalAccessToken();

    const verificationPayload = {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    };

    const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(verificationPayload),
    });

    const data = await res.json();
    return data?.verification_status === "SUCCESS";
  } catch (e) {
    console.error("❌ Webhook verification failed:", e);
    return false;
  }
}

const ALLOWED_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "PAYMENT.SALE.COMPLETED",
]);

// 🆕 خريطة الحالة الأولى: عند أول تفعيل اشتراك (بداية Trial أو بداية باقة مدفوعة مباشرة)
const PLAN_MAP_ON_ACTIVATE: Record<string, PlanType> = {
  trial: PlanType.TRIAL,
  quarterly: PlanType.QUARTERLY,
  biannually: PlanType.BIANNUALLY,
  business: PlanType.BUSINESS,
  monthly: PlanType.MONTHLY,
};

// 🆕 خريطة حالة الدفع الفعلي: أول خصم حقيقي بعد انتهاء الـ 3 أيام يحوّل trial إلى monthly تلقائياً
const PLAN_MAP_ON_PAYMENT: Record<string, PlanType> = {
  trial: PlanType.MONTHLY,
  monthly: PlanType.MONTHLY, // 🔑 هذا هو التحويل التلقائي المطلوب بعد 3 أيام
  quarterly: PlanType.QUARTERLY,
  biannually: PlanType.BIANNUALLY,
  business: PlanType.BUSINESS,
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // 🔒 1. التحقق من صحة الإشعار القادم من PayPal
    const isValid = await verifyPayPalWebhook(req.headers, rawBody);

    if (!isValid) {
      console.error("❌ Webhook unauthorized: Invalid PayPal signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("📩 Secure PayPal Webhook received:", body?.event_type);

    const eventName: string | undefined = body?.event_type;
    const eventId: string | undefined = body?.id;

    if (!eventName || !eventId) {
      console.error("❌ Invalid payload — missing eventName or eventId", { eventName, eventId });
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ ignored: true }, { status: 200 });
    }

    // 🔒 2. فحص التكرار (Idempotency Check)
    const idempotencyKey = `${eventName}:${eventId}`;
    const existingEvent = await db.webhookEvent.findUnique({
      where: { eventId: idempotencyKey },
    });

    if (existingEvent) {
      console.log("⚠️ Duplicate webhook ignored:", idempotencyKey);
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    const resource = body?.resource;

    // 🆔 معرّف المستخدم أرسلناه كـ custom_id عند إنشاء الاشتراك في checkout/route.ts
    const customDataUserId: string | undefined = resource?.custom_id;
    const email: string | undefined =
      resource?.subscriber?.email_address || resource?.payer?.email_address;

    if (!email && !customDataUserId) {
      return NextResponse.json({ error: "Missing user identifier" }, { status: 400 });
    }

    // 🔍 البحث عن المستخدم: أولوية لمعرف قاعدة البيانات ثم fallback للإيميل
    const user = customDataUserId
      ? (await db.user.findUnique({ where: { id: customDataUserId } }).catch(() => null)) ||
        (await db.user.findUnique({ where: { clerkId: customDataUserId } }))
      : await db.user.findUnique({ where: { email } });

    if (!user) {
      console.error("❌ User not found", { customDataUserId, email });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    ////////////////////////////////////////////////////////////////
    // 🧠 هندسة أحداث الاشتراكات (Subscription Logic Handler)
    ////////////////////////////////////////////////////////////////

    const paypalPlanId: string | undefined = resource?.plan_id;
    const planName = getPlanFromPayPalPlanId(paypalPlanId);

    if (!planName) {
      console.log("⚠️ Unknown PayPal plan ID:", paypalPlanId);
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const paypalSubscriptionId: string | undefined = resource?.id;
    const subscriptionStatus: string | undefined = resource?.status?.toLowerCase();
    const paypalCustomerId: string | undefined =
      resource?.subscriber?.payer_id || resource?.subscriber?.email_address;
    const nextBillingTime = resource?.billing_info?.next_billing_time
      ? new Date(resource.billing_info.next_billing_time)
      : null;

    const existingSubscription = await db.subscription.findFirst({
      where: { userId: user.id },
    });

    // الحالة الأولى: تفعيل اشتراك جديد لأول مرة (شحن رصيد الباقة المشتراة)
    if (eventName === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const dbPlan = PLAN_MAP_ON_ACTIVATE[planName] || PlanType.TRIAL;
      const isTrial = planName === "trial";
      const creditsToGrant = (PLANS[planName] as any)?.credits || 0;

      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            plan: dbPlan,
            credits: { increment: creditsToGrant },
            // 🆕 عند بداية Trial: نضبط تاريخ البداية والنهاية (3 أيام بالضبط)
            // عند بداية أي باقة مدفوعة مباشرة (بدون المرور بـ trial): لا يوجد تاريخ trial
            ...(isTrial
              ? {
                  trialStartedAt: new Date(),
                  trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                }
              : {
                  trialStartedAt: null,
                  trialEndsAt: null,
                }),
            ...(paypalCustomerId ? { paypalCustomerId } : {}),
            ...(paypalSubscriptionId ? { paypalSubscriptionId } : {}),
          },
        }),
        db.subscription.upsert({
          where: {
            id: existingSubscription?.id || "non_existent_id",
          },
          update: {
            status: subscriptionStatus || "active",
            ...(nextBillingTime ? { currentPeriodEnd: nextBillingTime } : {}),
          },
          create: {
            userId: user.id,
            status: subscriptionStatus || "active",
            plan: dbPlan,
            ...(paypalSubscriptionId ? { paypalSubscriptionId } : {}),
            ...(paypalCustomerId ? { paypalCustomerId } : {}),
            ...(nextBillingTime ? { currentPeriodEnd: nextBillingTime } : {}),
          },
        }),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);
      console.log(`✅ ${user.email} Subscribed to ${dbPlan} (+${creditsToGrant} credits)`);
    }

    // الحالة الثانية: نجاح دفعة (أول دفعة حقيقية بعد trial، أو تجديد دوري لباقة مدفوعة)
    else if (eventName === "PAYMENT.SALE.COMPLETED") {
      const dbPlan = PLAN_MAP_ON_PAYMENT[planName] || PlanType.MONTHLY;
      // 🔑 إذا كانت planName === "trial"، فهذه أول دفعة حقيقية (0$ لا تُرسل PAYMENT.SALE.COMPLETED من PayPal)
      // لذلك نمنح نقاط باقة MONTHLY وليس نقاط trial
      const creditsToGrant =
        planName === "trial" ? (PLANS.monthly as any)?.credits || 0 : (PLANS[planName] as any)?.credits || 0;

      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            plan: dbPlan,
            credits: { increment: creditsToGrant },
            // 🆕 إلغاء أي أثر لفترة التجربة نهائياً بعد أول خصم حقيقي
            trialStartedAt: null,
            trialEndsAt: null,
          },
        }),
        db.subscription.updateMany({
          where: { userId: user.id },
          data: {
            status: "active",
            plan: dbPlan,
            ...(nextBillingTime ? { currentPeriodEnd: nextBillingTime } : {}),
            ...(paypalSubscriptionId ? { paypalSubscriptionId } : {}),
            ...(paypalCustomerId ? { paypalCustomerId } : {}),
          },
        }),
        db.payment.create({
          data: {
            userId: user.id,
            amount: Number(resource?.amount?.total || 0),
            currency: String(resource?.amount?.currency || "USD"),
            paypalOrderId: resource?.id ? `sale_${resource.id}` : undefined,
            paypalSubscriptionId: paypalSubscriptionId || undefined,
            provider: "paypal",
            status: "COMPLETED",
          },
        }),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);
      console.log(`🔄 ${user.email} Subscription payment completed -> ${dbPlan} (+${creditsToGrant} credits)`);
    }

    // الحالة الثالثة: تحديث حالة الاشتراك أو إلغاؤه/انتهاؤه/تعليقه
    else if (
      eventName === "BILLING.SUBSCRIPTION.UPDATED" ||
      eventName === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventName === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventName === "BILLING.SUBSCRIPTION.SUSPENDED"
    ) {
      const isEnded = ["expired", "cancelled", "suspended"].includes(subscriptionStatus || "");

      await db.$transaction([
        db.subscription.updateMany({
          where: { userId: user.id },
          data: {
            status: subscriptionStatus || "cancelled",
            ...(nextBillingTime ? { currentPeriodEnd: nextBillingTime } : {}),
          },
        }),
        // ✅ مصحح: لم تعد FREE موجودة في enum — عند انتهاء/إلغاء الاشتراك نعيد المستخدم إلى TRIAL
        // (بدون منحه نقاط تجربة جديدة، فقط لضمان عدم بقائه على باقة مدفوعة وهمياً)
        ...(isEnded
          ? [
              db.user.update({
                where: { id: user.id },
                data: {
                  plan: PlanType.TRIAL,
                  credits: 0,
                  trialStartedAt: null,
                  trialEndsAt: null,
                },
              }),
            ]
          : []),
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
