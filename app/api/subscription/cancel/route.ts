import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAYPAL_CLIENT_ID =
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

const PAYPAL_SECRET_KEY =
  process.env.PAYPAL_SECRET_KEY;

const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
    throw new Error("Missing PayPal credentials.");
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`
  ).toString("base64");

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();

    console.error(
      "[PAYPAL_ACCESS_TOKEN_FAILED]",
      response.status,
      errorBody
    );

    throw new Error(
      "Failed to authenticate with PayPal."
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(
      "PayPal did not return an access token."
    );
  }

  return data.access_token as string;
}

export async function POST() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
      console.error(
        "[SUBSCRIPTION_CANCEL] Missing PayPal credentials."
      );

      return NextResponse.json(
        {
          error:
            "PayPal payment provider is not configured.",
        },
        { status: 500 }
      );
    }

    const user = await db.user.findUnique({
      where: {
        clerkId,
      },
      select: {
        id: true,
        paypalSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.paypalSubscriptionId) {
      return NextResponse.json(
        {
          error:
            "No active PayPal subscription found for this account.",
        },
        { status: 400 }
      );
    }

    const latestSub =
      await db.subscription.findFirst({
        where: {
          userId: user.id,
          paypalSubscriptionId:
            user.paypalSubscriptionId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!latestSub) {
      return NextResponse.json(
        {
          error:
            "No subscription record found for this PayPal subscription.",
        },
        { status: 404 }
      );
    }

    if (latestSub.status === "cancelled") {
      return NextResponse.json(
        {
          error: "Subscription is already cancelled.",
          status: "cancelled",
          currentPeriodEnd:
            latestSub.currentPeriodEnd,
        },
        { status: 400 }
      );
    }

    const accessToken =
      await getPayPalAccessToken();

    const paypalResponse = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/subscriptions/${encodeURIComponent(
        user.paypalSubscriptionId
      )}/cancel`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason:
            "Customer requested subscription cancellation.",
        }),
        cache: "no-store",
      }
    );

    if (!paypalResponse.ok) {
      const errorBody =
        await paypalResponse.text();

      console.error(
        "[PAYPAL_CANCEL_FAILED]",
        paypalResponse.status,
        errorBody
      );

      return NextResponse.json(
        {
          error:
            "Failed to cancel the PayPal subscription. Please try again or contact support.",
        },
        { status: 502 }
      );
    }

    const cancelledSub =
      await db.subscription.update({
        where: {
          id: latestSub.id,
        },
        data: {
          status: "cancelled",
        },
      });

    try {
      await db.notification.create({
        data: {
          userId: user.id,
          title: "Subscription Cancelled",
          message:
            cancelledSub.currentPeriodEnd
              ? `Your subscription has been cancelled. You'll keep full access until ${new Date(
                  cancelledSub.currentPeriodEnd
                ).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}.`
              : "Your subscription has been cancelled.",
        },
      });
    } catch (notificationError) {
      console.error(
        "[SUBSCRIPTION_CANCEL_NOTIFICATION_FAILED]",
        notificationError
      );
    }

    return NextResponse.json({
      success: true,
      status: "cancelled",
      currentPeriodEnd:
        cancelledSub.currentPeriodEnd,
      message:
        "Subscription cancelled successfully. You'll retain access until the end of your billing period.",
    });
  } catch (error) {
    console.error(
      "[SUBSCRIPTION_CANCEL]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Server error. Please try again.",
      },
      { status: 500 }
    );
  }
}