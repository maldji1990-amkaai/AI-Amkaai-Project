import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PayPal authentication failed: ${await response.text()}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("PayPal access token was not returned");
  }

  return data.access_token as string;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();

    const paymentId =
      typeof body.paymentId === "string" ? body.paymentId : "";

    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Admin refund";

    const requestedAmount =
      body.amount !== undefined ? Number(body.amount) : undefined;

    const revokeCredits =
      body.revokeCredits === undefined
        ? true
        : Boolean(body.revokeCredits);

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 }
      );
    }

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        status: true,
        paypalOrderId: true,
        refundedAmount: true,
        refundId: true,
        refundStatus: true,
        refundedAt: true,
        refundReason: true,
        user: {
          select: {
            id: true,
            credits: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    if (payment.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "Only completed payments can be refunded",
          status: payment.status,
        },
        { status: 400 }
      );
    }

    if (!payment.paypalOrderId) {
      return NextResponse.json(
        {
          error:
            "This payment has no PayPal order ID and cannot be refunded electronically.",
        },
        { status: 400 }
      );
    }

    const alreadyRefunded = Number(payment.refundedAmount ?? 0);
    const remainingAmount = Math.max(
      0,
      Number(payment.amount) - alreadyRefunded
    );

    if (remainingAmount <= 0) {
      return NextResponse.json(
        { error: "This payment has already been fully refunded." },
        { status: 400 }
      );
    }

    const refundAmount =
      requestedAmount === undefined
        ? remainingAmount
        : requestedAmount;

    if (
      !Number.isFinite(refundAmount) ||
      refundAmount <= 0 ||
      refundAmount > remainingAmount + 0.000001
    ) {
      return NextResponse.json(
        {
          error: "Invalid refund amount",
          remainingAmount,
        },
        { status: 400 }
      );
    }

    if (payment.currency.toUpperCase() !== "USD") {
      return NextResponse.json(
        {
          error: "PayPal refund currently supports USD payments only.",
        },
        { status: 400 }
      );
    }

    const accessToken = await getPayPalAccessToken();

    const orderResponse = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${payment.paypalOrderId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!orderResponse.ok) {
      return NextResponse.json(
        {
          error: "Unable to retrieve PayPal order",
          details: await orderResponse.text(),
        },
        { status: 502 }
      );
    }

    const order = await orderResponse.json();

    const captures =
      order?.purchase_units?.flatMap(
        (unit: {
          payments?: {
            captures?: Array<{
              id?: string;
              status?: string;
            }>;
          };
        }) => unit?.payments?.captures ?? []
      ) ?? [];

    const capture = captures.find(
      (item: { status?: string }) => item.status === "COMPLETED"
    );

    if (!capture?.id) {
      return NextResponse.json(
        {
          error:
            "No completed PayPal capture was found for this payment.",
        },
        { status: 400 }
      );
    }

    const refundResponse = await fetch(
      `${PAYPAL_BASE}/v2/payments/captures/${capture.id}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          amount: {
            value: refundAmount.toFixed(2),
            currency_code: payment.currency.toUpperCase(),
          },
          note_to_payer: reason.slice(0, 255),
        }),
        cache: "no-store",
      }
    );

    const refundData = await refundResponse.json().catch(() => null);

    if (!refundResponse.ok) {
      return NextResponse.json(
        {
          error: "PayPal refund failed",
          details: refundData,
        },
        { status: 502 }
      );
    }

    const providerRefundId =
      typeof refundData?.id === "string" ? refundData.id : null;

    const providerStatus =
      typeof refundData?.status === "string"
        ? refundData.status
        : "COMPLETED";

    const totalRefunded = alreadyRefunded + refundAmount;

    const isFullRefund =
      totalRefunded >= Number(payment.amount) - 0.000001;

    const result = await db.$transaction(async (tx) => {
      let newCredits = payment.user.credits;

      if (revokeCredits) {
        const revoke = Math.min(
          Math.max(0, payment.user.credits),
          Math.round(refundAmount)
        );

        if (revoke > 0) {
          const updatedUser = await tx.user.update({
            where: { id: payment.userId },
            data: {
              credits: {
                decrement: revoke,
              },
            },
            select: {
              credits: true,
            },
          });

          newCredits = updatedUser.credits;
        }
      }

            const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: totalRefunded,
          refundId: providerRefundId ?? payment.refundId,
          refundStatus: providerStatus,
          refundedAt: new Date(),
          refundReason: reason,
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          status: true,
          paypalOrderId: true,
          refundedAmount: true,
          refundId: true,
          refundStatus: true,
          refundedAt: true,
          refundReason: true,
        },
      });

      return {
        payment: updatedPayment,
        credits: newCredits,
      };
    });

    return NextResponse.json({
      success: true,
      payment: result.payment,
      credits: result.credits,
      refund: {
        id: providerRefundId,
        status: providerStatus,
        amount: refundAmount,
        currency: payment.currency,
        fullRefund: isFullRefund,
      },
    });
  } catch (error) {
    console.error("Admin refund error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}
