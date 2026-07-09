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
function getPlanFromPayPalPlanId(planId: string | undefined | null): "trial" | "quarterly" | "biannually" | null {
  if (!planId) return null;
  if (planId === process.env.PAYPAL_PLAN_ID_TRIAL) return "trial";
  if (planId === process.env.PAYPAL_PLAN_ID_QUARTERLY) return "quarterly";
  if (planId === process.env.PAYPAL_PLAN_ID_BIANNUALLY) return "biannually";
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
      ? await db.user.findUnique({ where: { id: customDataUserId } }).catch(() => null) ||
        await db.user.findUnique({ where: { clerkId: customDataUserId } })
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

    const creditsToGrant = (PLANS[planName] as any)?.credits || 0;
    const subPlanMap: Record<string, PlanType> = {
      trial: PlanType.CREATOR,
      quarterly: PlanType.PRO,
      biannually: PlanType.PREMIUM,
    };
    const dbPlan = subPlanMap[planName] || PlanType.FREE;

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
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            plan: dbPlan,
            credits: { increment: creditsToGrant },
            ...(paypalCustomerId ? { lemonCustomerId: paypalCustomerId } : {}),
            ...(paypalSubscriptionId ? { lemonSubscriptionId: paypalSubscriptionId } : {}),
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
            ...(paypalSubscriptionId ? { lemonSubscriptionId: paypalSubscriptionId } : {}),
            ...(paypalCustomerId ? { lemonCustomerId: paypalCustomerId } : {}),
            ...(nextBillingTime ? { currentPeriodEnd: nextBillingTime } : {}),
          },
        }),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);
      console.log(`✅ ${user.email} Subscribed to ${dbPlan} (+${creditsToGrant} credits)`);
    }

    // الحالة الثانية: نجاح دفعة تجديد تلقائي
    else if (eventName === "PAYMENT.SALE.COMPLETED") {
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
            ...(nextBillingTime ? { currentPeriodEnd: nextBillingTime } : {}),
          },
        }),
        db.webhookEvent.create({ data: { eventId: idempotencyKey } }),
      ]);
      console.log(`🔄 ${user.email} Subscription renewed for ${dbPlan} (+${creditsToGrant} credits)`);
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
