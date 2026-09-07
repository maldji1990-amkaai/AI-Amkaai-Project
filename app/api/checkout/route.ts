import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAYPAL_PLAN_IDS: Record<string, string | undefined> = {
  trial: process.env.PAYPAL_PLAN_ID_TRIAL,
  monthly: process.env.PAYPAL_PLAN_ID_MONTHLY,
  quarterly: process.env.PAYPAL_PLAN_ID_QUARTERLY,
  biannually: process.env.PAYPAL_PLAN_ID_BIANNUALLY,
  business: process.env.PAYPAL_PLAN_ID_BUSINESS,
};

const ALLOWED_PLANS = ["trial", "monthly", "quarterly", "biannually", "business"] as const;
type PlanKey = (typeof ALLOWED_PLANS)[number];

const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;

  if (!clientId || !secret) {
    throw new Error("Missing PayPal credentials. Check NEXT_PUBLIC_PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY.");
  }

  const basicAuth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal authentication failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data?.access_token) {
    throw new Error("PayPal authentication succeeded but no access token was returned.");
  }

  return data.access_token as string;
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Clerk can't detect your session. Please sign in again.",
        },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const plan = (body as { plan?: unknown })?.plan;

    if (typeof plan !== "string" || !ALLOWED_PLANS.includes(plan as PlanKey)) {
      return NextResponse.json(
        { error: "Invalid plan", message: `Plan received: ${String(plan)}` },
        { status: 400 }
      );
    }

    // Business is intentionally not purchasable until its real price, credits,
    // limits and PayPal plan are finalized. Never allow a $0 placeholder to
    // become a live subscription through a direct API call.
    if (plan === "business") {
      return NextResponse.json(
        { error: "This plan is not available yet." },
        { status: 403 }
      );
    }

    const paypalPlanId = PAYPAL_PLAN_IDS[plan];

    if (!paypalPlanId) {
      return NextResponse.json(
        {
          error: "Missing PayPal plan ID",
          message: `Environment variable PAYPAL_PLAN_ID_${plan.toUpperCase()} is missing.`,
        },
        { status: 500 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        email: true,
        plan: true,
        paypalSubscriptionId: true,
        subscriptionCheckoutLockUntil: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const existingSubscription = await db.subscription.findFirst({
      where: {
        userId: user.id,
        status: { in: ["active", "activated", "APPROVAL_PENDING"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (existingSubscription) {
      return NextResponse.json({
        error: "An active or pending subscription already exists.",
        subscriptionId: existingSubscription.paypalSubscriptionId,
        plan: existingSubscription.plan,
      }, { status: 409 });
    }

    // Serialize checkout creation per user. This closes the race where two
    // browser tabs pass the subscription check at the same time and both ask
    // PayPal to create a subscription. The lock expires automatically after
    // 10 minutes so a crashed request cannot block the account forever.
    const lockUntil = new Date(Date.now() + 10 * 60 * 1000);
    const lockResult = await db.user.updateMany({
      where: {
        id: user.id,
        OR: [
          { subscriptionCheckoutLockUntil: null },
          { subscriptionCheckoutLockUntil: { lt: new Date() } },
        ],
      },
      data: { subscriptionCheckoutLockUntil: lockUntil },
    });
    if (lockResult.count !== 1) {
      return NextResponse.json(
        { error: "A subscription checkout is already in progress. Please finish or wait a few minutes before trying again." },
        { status: 409 },
      );
    }

    const clearCheckoutLock = async () => {
      await db.user.updateMany({
        where: { id: user.id },
        data: { subscriptionCheckoutLockUntil: null },
      });
    };

    let checkoutSucceeded = false;
    try {
      const accessToken = await getPayPalAccessToken();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.amkaai.net").replace(/\/$/, "");

    const requestBody: Record<string, unknown> = {
      plan_id: paypalPlanId,
      custom_id: user.id,
      application_context: {
        brand_name: "AMKAAI",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${appUrl}/dashboard?payment=success`,
        cancel_url: `${appUrl}/pricing?payment=cancelled`,
      },
    };

    // PayPal accepts the subscriber email when supplied. Do not send an empty value.
    if (user.email) {
      requestBody.subscriber = { email_address: user.email };
    }

    const subscriptionRes = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(requestBody),
        cache: "no-store",
      }
    );

    const subscriptionData = await subscriptionRes.json().catch(() => null);

    if (!subscriptionRes.ok) {
      console.error("[PAYPAL_SUBSCRIPTION_CREATE_FAILED]", {
        status: subscriptionRes.status,
        response: subscriptionData,
      });

      return NextResponse.json(
        {
          error: "PayPal subscription creation failed",
          message:
            subscriptionData?.message ||
            subscriptionData?.details?.[0]?.description ||
            "PayPal rejected the subscription request.",
        },
        { status: 502 }
      );
    }

    const subscriptionId = subscriptionData?.id as string | undefined;
    const approvalLink = subscriptionData?.links?.find(
      (link: { rel?: string; href?: string }) => link.rel === "approve"
    )?.href as string | undefined;

    if (!subscriptionId || !approvalLink) {
      console.error("[PAYPAL_INVALID_SUBSCRIPTION_RESPONSE]", subscriptionData);
      return NextResponse.json(
        { error: "PayPal returned an invalid subscription response." },
        { status: 502 }
      );
    }

    // Store the PayPal subscription immediately. The webhook remains the source
    // of truth for activation/payment status, but this prevents losing the ID
    // between checkout creation and webhook delivery.
    await db.user.update({
      where: { id: user.id },
      data: {
        paypalSubscriptionId: subscriptionId,
      },
    });

    await db.subscription.create({
      data: {
        userId: user.id,
        paypalSubscriptionId: subscriptionId,
        status: "APPROVAL_PENDING",
        plan: plan.toUpperCase() as "TRIAL" | "MONTHLY" | "QUARTERLY" | "BIANNUALLY" | "BUSINESS",
      },
    });

    // Do not record an abandoned checkout here: reaching the PayPal approval
    // page is not abandonment. Abandonment tracking, if enabled, must happen
    // only from an explicit client-side abandonment signal or a reconciliation job.

      checkoutSucceeded = true;
      await clearCheckoutLock();
      return NextResponse.json({
        success: true,
        url: approvalLink,
        subscriptionId,
        plan,
      });
    } finally {
      if (!checkoutSucceeded) await clearCheckoutLock();
    }
  } catch (error) {
    console.error("[PAYPAL_CHECKOUT_ERROR]", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
