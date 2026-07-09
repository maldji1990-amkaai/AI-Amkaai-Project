import { NextResponse } from "next/server";
import { auth, getAuth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ⚙️ خرائط الخطط إلى PayPal Plan IDs (استبدلها بالقيم الحقيقية من PayPal بعد إنشاء الخطط)
const PAYPAL_PLAN_IDS: Record<string, string | undefined> = {
  trial: process.env.PAYPAL_PLAN_ID_TRIAL,
  quarterly: process.env.PAYPAL_PLAN_ID_QUARTERLY,
  biannually: process.env.PAYPAL_PLAN_ID_BIANNUALLY,
};

// 🌍 استخدم api-m.paypal.com للحساب الحقيقي (Live) أو api-m.sandbox.paypal.com للتجربة
const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// 🔑 جلب access token من PayPal
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

export async function POST(req: Request) {
  try {
    let userId: string | null = null;

    try {
      const authObj = await auth();
      userId = authObj?.userId;
    } catch (e) {
      console.warn("Standard auth() failed, trying fallback getAuth(req)...", e);
    }

    if (!userId) {
      try {
        const authObjFallback = getAuth(req as any);
        userId = authObjFallback?.userId;
      } catch (fallbackError) {
        console.error("Both auth methods failed:", fallbackError);
      }
    }

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Clerk can't detect your session. Please clear cookies/cache and try again.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const plan = body?.plan;

    if (plan !== "trial" && plan !== "quarterly" && plan !== "biannually") {
      return NextResponse.json(
        { error: "Invalid plan", message: `Plan received: ${plan}` },
        { status: 400 }
      );
    }

    const paypalPlanId = PAYPAL_PLAN_IDS[plan];

    if (!paypalPlanId) {
      return NextResponse.json(
        {
          error: "Missing PayPal plan ID",
          message: `Environment variable for PayPal plan is missing for: ${plan}`,
        },
        { status: 500 }
      );
    }

    // 🔍 جلب بيانات المستخدم من قاعدة البيانات
    let dbUserId = userId;
    let fallbackEmail = "";

    try {
      const user = await db.user.findUnique({
        where: { clerkId: userId },
      });

      if (user) {
        dbUserId = user.id;
        fallbackEmail = user.email || "";
      }
    } catch (dbError: any) {
      console.warn("Database lookup failed:", dbError);
    }

    ////////////////////////////////////////////////////////////////
    // 🔗 🚀 إنشاء الاشتراك عبر PayPal API
    ////////////////////////////////////////////////////////////////
    const accessToken = await getPayPalAccessToken();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.amkaai.net";

    const subscriptionRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: paypalPlanId,
        subscriber: fallbackEmail ? { email_address: fallbackEmail } : undefined,
        custom_id: dbUserId,
        application_context: {
          brand_name: "AMKAAI",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${appUrl}/dashboard?payment=success`,
          cancel_url: `${appUrl}/pricing?payment=cancelled`,
        },
      }),
    });

    if (!subscriptionRes.ok) {
      const errText = await subscriptionRes.text();
      throw new Error(`PayPal subscription creation failed: ${errText}`);
    }

    const subscriptionData = await subscriptionRes.json();

    // 🔗 رابط الموافقة (approve) هو الذي يفتح نافذة الدفع للمستخدم
    const approvalLink = subscriptionData.links?.find(
      (link: any) => link.rel === "approve"
    )?.href;

    if (!approvalLink) {
      throw new Error("PayPal approval link not found in response");
    }

    // 📊 تسجيل محاولة الدفع المتروكة
    try {
      if (fallbackEmail) {
        await db.abandonedCheckout.create({
          data: {
            userId: dbUserId,
            email: fallbackEmail,
            checkoutUrl: approvalLink,
            plan,
          },
        });
      }
    } catch (e) {
      console.warn("Checkout tracking skipped inside database:", e);
    }

    return NextResponse.json({
      url: approvalLink,
      subscriptionId: subscriptionData.id,
    });
  } catch (error: any) {
    console.error("CRITICAL CHECKOUT ERROR:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error (500)",
        message: error?.message || String(error),
        stack: error?.stack || "No stack trace available",
      },
      { status: 500 }
    );
  }
}
