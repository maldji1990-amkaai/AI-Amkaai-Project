import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PlanType } from "@prisma/client";
import { PLANS } from "@/lib/config";

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

    const existingSubscription =
      paypalSubscriptionId
        ? await db.subscription.findFirst(
            {
              where: {
                paypalSubscriptionId,
              },
            }
          )
        : await db.subscription.findFirst(
            {
              where: {
                userId: user.id,
              },
              orderBy: {
                createdAt: "desc",
              },
            }
          );

    /*
     * =====================================================
     * SUBSCRIPTION ACTIVATED
     * =====================================================
     */
    if (
      eventName ===
      "BILLING.SUBSCRIPTION.ACTIVATED"
    ) {
      const dbPlan =
        PLAN_MAP_ON_ACTIVATE[
          planName
        ];

      const creditsToGrant =
        creditsForPlan(planName);

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

              credits: {
                increment:
                  creditsToGrant,
              },

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
      );

      /*
       * Use an interactive transaction instead
       * of pushing different Prisma promise types
       * into one array.
       */
      await db.$transaction(
        async (tx) => {
          await tx.user.update({
            where: {
              id: user.id,
            },
            data: {
              plan: dbPlan,

              credits: {
                increment:
                  creditsToGrant,
              },

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
           * IMPORTANT:
           * Do not add "provider" here because
           * the Payment model does not contain
           * a provider field.
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
      const isEnded = [
        "expired",
        "cancelled",
        "suspended",
      ].includes(
        subscriptionStatus
      );

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
              status:
                subscriptionStatus,

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
