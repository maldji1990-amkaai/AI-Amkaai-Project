import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";
import { PLANS } from "@/lib/config";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  shouldBlockPaymentForSubscription,
} from "@/lib/subscription-guards";
import { grantCreditsTx } from "@/lib/billing";

export const dynamic = "force-dynamic";

const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

type PayPalPlanName =
  | "trial"
  | "monthly"
  | "quarterly"
  | "biannually"
  | "business";

function getPlanFromPayPalPlanId(
  planId: string | undefined | null
): PayPalPlanName | null {
  if (!planId) return null;

  if (planId === process.env.PAYPAL_PLAN_ID_TRIAL) {
    return "trial";
  }

  if (planId === process.env.PAYPAL_PLAN_ID_MONTHLY) {
    return "monthly";
  }

  if (planId === process.env.PAYPAL_PLAN_ID_QUARTERLY) {
    return "quarterly";
  }

  if (planId === process.env.PAYPAL_PLAN_ID_BIANNUALLY) {
    return "biannually";
  }

  if (planId === process.env.PAYPAL_PLAN_ID_BUSINESS) {
    return "business";
  }

  return null;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;

  if (!clientId || !secret) {
    throw new Error(
      "PayPal credentials are not configured"
    );
  }

  const basicAuth = Buffer.from(
    `${clientId}:${secret}`
  ).toString("base64");

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `Basic ${basicAuth}`,
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
      `PayPal auth failed (${response.status})`
    );
  }

  const data = await response.json();

  if (!data?.access_token) {
    throw new Error(
      "PayPal access token missing"
    );
  }

  return data.access_token as string;
}

async function verifyPayPalWebhook(
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  try {
    const webhookId =
      process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      console.error(
        "[PAYPAL_WEBHOOK] PAYPAL_WEBHOOK_ID is not configured"
      );

      return false;
    }

    const accessToken =
      await getPayPalAccessToken();

    const verificationPayload = {
      auth_algo: headers.get(
        "paypal-auth-algo"
      ),
      cert_url: headers.get(
        "paypal-cert-url"
      ),
      transmission_id: headers.get(
        "paypal-transmission-id"
      ),
      transmission_sig: headers.get(
        "paypal-transmission-sig"
      ),
      transmission_time: headers.get(
        "paypal-transmission-time"
      ),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    };

    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(
          verificationPayload
        ),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorBody =
        await response.text();

      console.error(
        "[PAYPAL_WEBHOOK_VERIFY_FAILED]",
        response.status,
        errorBody
      );

      return false;
    }

    const data = await response.json();

    return (
      data?.verification_status ===
      "SUCCESS"
    );
  } catch (error) {
    console.error(
      "[PAYPAL_WEBHOOK_VERIFY_ERROR]",
      error
    );

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

const PLAN_MAP_ON_ACTIVATE: Record<
  PayPalPlanName,
  PlanType
> = {
  trial: PlanType.TRIAL,
  monthly: PlanType.MONTHLY,
  quarterly: PlanType.QUARTERLY,
  biannually: PlanType.BIANNUALLY,
  business: PlanType.BUSINESS,
};

const PLAN_MAP_ON_PAYMENT: Record<
  PayPalPlanName,
  PlanType
> = {
  trial: PlanType.MONTHLY,
  monthly: PlanType.MONTHLY,
  quarterly: PlanType.QUARTERLY,
  biannually: PlanType.BIANNUALLY,
  business: PlanType.BUSINESS,
};

function creditsForPlan(
  plan: PayPalPlanName | string
): number {
  return Number(
    (
      PLANS as Record<
        string,
        { credits?: number }
      >
    )[plan]?.credits ?? 0
  );
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const isValid =
      await verifyPayPalWebhook(
        req.headers,
        rawBody
      );

    if (!isValid) {
      return NextResponse.json(
        {
          error:
            "Invalid signature",
        },
        { status: 401 }
      );
    }

    let body: any;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid JSON payload",
        },
        { status: 400 }
      );
    }

    const eventName =
      body?.event_type as
        | string
        | undefined;

    const eventId =
      body?.id as
        | string
        | undefined;

    if (!eventName || !eventId) {
      return NextResponse.json(
        {
          error:
            "Invalid webhook payload",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_EVENTS.has(eventName)
    ) {
      return NextResponse.json({
        ignored: true,
      });
    }

    const existingEvent =
      await db.webhookEvent.findUnique({
        where: {
          eventId,
        },
      });

    if (existingEvent) {
      return NextResponse.json({
        duplicate: true,
      });
    }

    const resource =
      body?.resource ?? {};

    /*
     * For subscription events, resource.id is
     * the PayPal subscription ID.
     *
     * For PAYMENT.SALE.COMPLETED,
     * resource.id is the sale ID and the
     * subscription ID is usually in
     * billing_agreement_id.
     */
    const resourceSubscriptionId =
      eventName ===
      "PAYMENT.SALE.COMPLETED"
        ? resource?.billing_agreement_id
        : resource?.id;

    const paypalSubscriptionId =
      resourceSubscriptionId
        ? String(resourceSubscriptionId)
        : undefined;

    const customDataUserId =
      resource?.custom_id
        ? String(resource.custom_id)
        : undefined;

    const email =
      resource?.subscriber
        ?.email_address ||
      resource?.payer
        ?.email_address ||
      resource?.payer_info
        ?.email;

    let user = customDataUserId
      ? await db.user.findUnique({
          where: {
            id: customDataUserId,
          },
        })
      : null;

    if (
      !user &&
      customDataUserId
    ) {
      user =
        await db.user.findUnique({
          where: {
            clerkId:
              customDataUserId,
          },
        });
    }

    if (!user && email) {
      user =
        await db.user.findUnique({
          where: {
            email: String(email),
          },
        });
    }

    /*
     * If this is a payment event and PayPal
     * did not provide the user directly,
     * try to locate the user through the
     * existing subscription.
     */
    if (
      !user &&
      paypalSubscriptionId
    ) {
      const existingSub =
        await db.subscription.findFirst({
          where: {
            paypalSubscriptionId,
          },
          include: {
            user: true,
          },
        });

      if (existingSub) {
        user = existingSub.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User not found",
        },
        { status: 404 }
      );
    }

    const paypalPlanId =
      resource?.plan_id as
        | string
        | undefined;

    let planName =
      getPlanFromPayPalPlanId(
        paypalPlanId
      );

    /*
     * PAYMENT.SALE.COMPLETED may not contain
     * plan_id. In that case use the user's
     * existing subscription plan.
     */
    if (
      !planName &&
      eventName ===
        "PAYMENT.SALE.COMPLETED"
    ) {
      const existingSub =
        paypalSubscriptionId
          ? await db.subscription.findFirst({
              where: {
                paypalSubscriptionId,
              },
            })
          : await db.subscription.findFirst({
              where: {
                userId: user.id,
              },
              orderBy: {
                createdAt: "desc",
              },
            });

      if (existingSub) {
        const reversePlanMap: Record<
          PlanType,
          PayPalPlanName
        > = {
          [PlanType.TRIAL]: "trial",
          [PlanType.MONTHLY]: "monthly",
          [PlanType.QUARTERLY]:
            "quarterly",
          [PlanType.BIANNUALLY]:
            "biannually",
          [PlanType.BUSINESS]:
            "business",
        };

        planName =
          reversePlanMap[
            existingSub.plan
          ] ?? null;
      }
    }

    if (!planName) {
      return NextResponse.json(
        {
          error:
            "Unknown PayPal plan",
        },
        { status: 400 }
      );
    }

    // Business remains disabled until its real commercial configuration is
    // finalized. This protects the webhook path even if a stale PayPal plan ID
    // is accidentally configured.
    if (planName === "business") {
      return NextResponse.json(
        { error: "Business plan is not available yet." },
        { status: 403 }
      );
    }

    const subscriptionStatus =
      String(
        resource?.status ?? ""
      ).toLowerCase() ||
      "active";

    const paypalCustomerId =
      resource?.subscriber
        ?.payer_id ||
      resource?.payer
        ?.payer_id ||
      resource?.payer_info
        ?.payer_id ||
      null;

    const nextBillingTime =
      resource?.billing_info
        ?.next_billing_time
        ? new Date(
            resource.billing_info
              .next_billing_time
          )
        : null;

    const existingSubscription = paypalSubscriptionId
      ? await db.subscription.findFirst({
          where: { paypalSubscriptionId },
        })
      : await db.subscription.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });

    // Never activate a second PayPal subscription for the same user.
    // The subscription ID lookup above only finds the incoming subscription;
    // this separate conflict query checks for another active/pending one.
    const conflictingSubscription =
      eventName === "BILLING.SUBSCRIPTION.ACTIVATED" && paypalSubscriptionId
        ? await db.subscription.findFirst({
            where: {
              userId: user.id,
              status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
              NOT: { paypalSubscriptionId },
            },
            orderBy: { updatedAt: "desc" },
          })
        : null;

    /*
     * =====================================================
     * SUBSCRIPTION ACTIVATED
     * =====================================================
     */
    if (
      eventName ===
      "BILLING.SUBSCRIPTION.ACTIVATED"
    ) {
      // A user may have reached PayPal with a stale checkout tab, or two
      // checkout requests may have raced. Do not replace the existing active
      // subscription or grant credits for the newcomer.
      if (conflictingSubscription) {
        await db.$transaction(async (tx) => {
          if (existingSubscription) {
            await tx.subscription.update({
              where: { id: existingSubscription.id },
              data: { status: "REJECTED_DUPLICATE" },
            });
          } else {
            await tx.subscription.create({
              data: {
                userId: user.id,
                paypalSubscriptionId,
                status: "REJECTED_DUPLICATE",
                plan: PLAN_MAP_ON_ACTIVATE[planName],
                ...(paypalCustomerId ? { paypalCustomerId } : {}),
              },
            });
          }
          await tx.webhookEvent.create({ data: { eventId } });
        });

        console.warn("[PAYPAL_DUPLICATE_SUBSCRIPTION_BLOCKED]", {
          userId: user.id,
          incomingSubscriptionId: paypalSubscriptionId,
          existingSubscriptionId: conflictingSubscription.paypalSubscriptionId,
        });
        return NextResponse.json({ ok: true, blocked: true, reason: "active_subscription_exists" });
      }

      const dbPlan =
        PLAN_MAP_ON_ACTIVATE[
          planName
        ];

      const creditsToGrant =
        planName === "trial" ? creditsForPlan(planName) : 0;

      const isTrial =
        planName === "trial";

      await db.$transaction(
        async (tx) => {
          await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              plan: dbPlan,

              trialStartedAt:
                isTrial
                  ? new Date()
                  : null,

              trialEndsAt:
                isTrial
                  ? new Date(
                      Date.now() +
                        3 *
                          24 *
                          60 *
                          60 *
                          1000
                    )
                  : null,

              ...(paypalCustomerId
                ? {
                    paypalCustomerId,
                  }
                : {}),

              ...(paypalSubscriptionId
                ? {
                    paypalSubscriptionId,
                  }
                : {}),
            },
          });

          if (creditsToGrant > 0) {
            await grantCreditsTx(tx, user.id, creditsToGrant, `paypal:subscription:${paypalSubscriptionId ?? eventId}:trial`, "TRIAL_GRANT", { plan: dbPlan, eventId });
          }

          if (existingSubscription) {
            await tx.subscription.update({
              where: {
                id:
                  existingSubscription.id,
              },
              data: {
                status:
                  subscriptionStatus,

                plan: dbPlan,

                ...(nextBillingTime
                  ? {
                      currentPeriodEnd:
                        nextBillingTime,
                    }
                  : {}),

                ...(paypalSubscriptionId
                  ? {
                      paypalSubscriptionId,
                    }
                  : {}),

                ...(paypalCustomerId
                  ? {
                      paypalCustomerId,
                    }
                  : {}),
              },
            });
          } else {
            await tx.subscription.create({
              data: {
                userId: user.id,
                status:
                  subscriptionStatus,
                plan: dbPlan,

                ...(paypalSubscriptionId
                  ? {
                      paypalSubscriptionId,
                    }
                  : {}),

                ...(paypalCustomerId
                  ? {
                      paypalCustomerId,
                    }
                  : {}),

                ...(nextBillingTime
                  ? {
                      currentPeriodEnd:
                        nextBillingTime,
                    }
                  : {}),
              },
            });
          }

          await tx.webhookEvent.create({
            data: {
              eventId,
            },
          });
        }
      );
    }

    /*
     * =====================================================
     * PAYMENT COMPLETED
     * =====================================================
     */
    else if (
      eventName ===
      "PAYMENT.SALE.COMPLETED"
    ) {
      const dbPlan =
        PLAN_MAP_ON_PAYMENT[
          planName
        ];

      const creditsToGrant =
        planName === "trial"
          ? creditsForPlan("monthly")
          : creditsForPlan(
              planName
            );

      const saleId =
        resource?.id
          ? String(resource.id)
          : undefined;

      const saleKey = saleId
        ? `sale_${saleId}`
        : null;

      const amount = Number(
        resource?.amount?.total ??
          resource?.amount?.value ??
          0
      );

      const currency = String(
        resource?.amount?.currency ??
          resource?.amount
            ?.currency_code ??
          "USD"
      ).toUpperCase();

      // A free trial must be activated by BILLING.SUBSCRIPTION.ACTIVATED.
      // A zero-value PAYMENT.SALE.COMPLETED must never grant the monthly paid
      // credits accidentally. A real recurring sale must match the canonical
      // server-side price before any plan/credit mutation occurs.
      if (planName === "trial" && amount <= 0) {
        return NextResponse.json({ ok: true, ignored: true, reason: "zero_value_trial_sale" });
      }

      const expectedAmount = creditsForPlan(planName) > 0
        ? PLANS[dbPlan.toLowerCase() as keyof typeof PLANS]?.price
        : 0;
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
      }
      if (currency !== "USD" || Math.abs(amount - expectedAmount) > 0.01) {
        return NextResponse.json({ error: "Payment amount does not match the canonical plan price" }, { status: 400 });
      }

      /*
       * A subscription rejected as a duplicate at ACTIVATED time remains
       * active on PayPal unless the user cancels it there. PayPal can therefore
       * continue sending PAYMENT.SALE.COMPLETED for that subscription.
       * Never let such a sale reactivate the local row or grant credits.
       * Also block a sale when another active/pending subscription exists for
       * the same user. This is the second webhook-level billing defense.
       */
      const paymentConflictingSubscription = paypalSubscriptionId
        ? await db.subscription.findFirst({
            where: {
              userId: user.id,
              status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
              NOT: { paypalSubscriptionId },
            },
            orderBy: { updatedAt: "desc" },
          })
        : await db.subscription.findFirst({
            where: {
              userId: user.id,
              status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
            },
            orderBy: { updatedAt: "desc" },
          });

      const blockRecurringPayment = shouldBlockPaymentForSubscription(
        existingSubscription?.status,
        Boolean(paymentConflictingSubscription),
      );

      if (blockRecurringPayment) {
        await db.webhookEvent.create({
          data: { eventId },
        });

        console.warn("[PAYPAL_DUPLICATE_PAYMENT_BLOCKED]", {
          userId: user.id,
          incomingSubscriptionId: paypalSubscriptionId,
          incomingSubscriptionStatus: existingSubscription?.status ?? null,
          existingSubscriptionId: paymentConflictingSubscription?.paypalSubscriptionId ?? null,
          saleId: saleId ?? null,
        });

        return NextResponse.json({
          ok: true,
          blocked: true,
          reason: "subscription_conflict",
        });
      }

      /*
       * Use an interactive transaction instead
       * of pushing different Prisma promise types
       * into one array.
       */
      await db.$transaction(
        async (tx) => {
          if (saleKey) {
            const existingPayment = await tx.payment.findFirst({
              where: { OR: [{ providerPaymentId: saleKey }, { paypalOrderId: saleKey }] },
            });
            if (existingPayment) return;
          }

          await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              plan: dbPlan,

              // Credits are granted exactly once below via the credit ledger.

              trialStartedAt: null,
              trialEndsAt: null,

              ...(paypalCustomerId
                ? {
                    paypalCustomerId,
                  }
                : {}),

              ...(paypalSubscriptionId
                ? {
                    paypalSubscriptionId,
                  }
                : {}),
            },
          });

          if (creditsToGrant > 0 && saleKey) {
            await grantCreditsTx(tx, user.id, creditsToGrant, `paypal:${saleKey}:credits`, "SUBSCRIPTION_GRANT", { plan: dbPlan, saleId: saleKey });
          }

          await tx.subscription.updateMany({
            where:
              paypalSubscriptionId
                ? {
                    paypalSubscriptionId,
                  }
                : {
                    userId: user.id,
                  },
            data: {
              status: "active",
              plan: dbPlan,

              ...(nextBillingTime
                ? {
                    currentPeriodEnd:
                      nextBillingTime,
                  }
                : {}),

              ...(paypalSubscriptionId
                ? {
                    paypalSubscriptionId,
                  }
                : {}),

              ...(paypalCustomerId
                ? {
                    paypalCustomerId,
                  }
                : {}),
            },
          });

          /*
           * Save the PayPal payment only when
           * PayPal supplied a sale ID.
           *
           * Payment records are stored with explicit provider
           * metadata so billing history and refund tooling
           * can distinguish PayPal from other providers.
           */
          if (saleKey) {
            await tx.payment.upsert({
              where: {
                paypalOrderId:
                  saleKey,
              },

              update: {
                status:
                  "COMPLETED",
                paypalSubscriptionId:
                  paypalSubscriptionId ??
                  undefined,
              },

              create: {
                userId: user.id,
                amount,
                currency,
                paypalOrderId:
                  saleKey,
                paypalSubscriptionId:
                  paypalSubscriptionId ??
                  undefined,
                provider: "paypal",
                providerPaymentId: saleKey,
                plan: dbPlan,
                status:
                  "COMPLETED",
              },
            });
          }

          await tx.webhookEvent.create({
            data: {
              eventId,
            },
          });
        }
      );
    }

    /*
     * =====================================================
     * SUBSCRIPTION UPDATED / CANCELLED /
     * EXPIRED / SUSPENDED
     * =====================================================
     */
    else {
      const isEnded = ["expired", "suspended"].includes(subscriptionStatus) ||
        (subscriptionStatus === "cancelled" && (!nextBillingTime || nextBillingTime <= new Date()));

      await db.$transaction(
        async (tx) => {
          await tx.subscription.updateMany({
            where:
              paypalSubscriptionId
                ? {
                    paypalSubscriptionId,
                  }
                : {
                    userId: user.id,
                  },
            data: {
              status: subscriptionStatus === "cancelled" && nextBillingTime && nextBillingTime > new Date() ? "active" : subscriptionStatus,
              cancelAtPeriodEnd: subscriptionStatus === "cancelled" && !!nextBillingTime && nextBillingTime > new Date(),

              ...(nextBillingTime
                ? {
                    currentPeriodEnd:
                      nextBillingTime,
                  }
                : {}),
            },
          });

          /*
           * Only reset the account for a truly
           * ended subscription.
           */
          if (isEnded) {
            await tx.user.update({
              where: {
                id: user.id,
              },
              data: {
                plan:
                  PlanType.TRIAL,
                credits: 0,
                trialStartedAt:
                  null,
                trialEndsAt:
                  null,
              },
            });
          }

          await tx.webhookEvent.create({
            data: {
              eventId,
            },
          });
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[PAYPAL_WEBHOOK_ERROR]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal webhook error",
      },
      { status: 500 }
    );
  }
}
