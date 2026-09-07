import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizePlan, PLAN_TO_ENUM, planCredits, planPrice, planDurationMonths, addMonths, grantCreditsTx } from "@/lib/billing";

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    console.error("[NOWPAYMENTS] IPN secret is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  const signature = req.headers.get("x-nowpayments-sig");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const body = JSON.parse(raw);
    if (body.payment_status !== "finished") return NextResponse.json({ ok: true, ignored: true });
    const providerPaymentId = String(body.payment_id || body.order_id || body.invoice_id || "");
    if (!providerPaymentId) return NextResponse.json({ error: "Missing payment identifier" }, { status: 400 });
    const eventId = `nowpayments:${providerPaymentId}`;
    if (await db.webhookEvent.findUnique({ where: { eventId } })) return NextResponse.json({ ok: true, duplicate: true });

    const clerkId = String(body.order_id || "");
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const description = String(body.order_description || "").toUpperCase();
    const plan = normalizePlan(description) ||
      (description.includes("BIANNUALLY") || description.includes("6 MONTH") ? "biannually" :
       description.includes("QUARTERLY") || description.includes("3 MONTH") ? "quarterly" :
       description.includes("MONTHLY") ? "monthly" : null);
    if (!plan || plan === "trial" || plan === "business") {
      return NextResponse.json({ error: "Unknown or unavailable plan" }, { status: 400 });
    }

    const amount = Number(body.price_amount ?? body.pay_amount ?? 0);
    const currency = String(body.price_currency || body.pay_currency || "USD").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !currency) return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    if (["USD", "USDT"].includes(currency) && Math.abs(amount - planPrice(plan)) > 0.01) {
      return NextResponse.json({ error: "Payment amount does not match plan price" }, { status: 400 });
    }

    const targetPlan = PLAN_TO_ENUM[plan];
    const months = planDurationMonths(plan);
    const periodEnd = months ? addMonths(new Date(), months) : null;

    await db.$transaction(async (tx) => {
      const existingPayment = await tx.payment.findUnique({ where: { providerPaymentId } });
      if (existingPayment) return;

      await tx.payment.create({
        data: {
          userId: user.id,
          amount,
          currency,
          provider: "nowpayments",
          providerPaymentId,
          plan: targetPlan,
          status: "COMPLETED",
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { plan: targetPlan, trialStartedAt: null, trialEndsAt: null } });
      await grantCreditsTx(tx, user.id, planCredits(plan), `nowpayments:${providerPaymentId}:credits`, "SUBSCRIPTION_GRANT", { plan: targetPlan, providerPaymentId });

      const existingSub = await tx.subscription.findFirst({ where: { userId: user.id, status: { in: ["active", "activated"] } }, orderBy: { updatedAt: "desc" } });
      if (existingSub) {
        await tx.subscription.update({ where: { id: existingSub.id }, data: { plan: targetPlan, status: "active", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false } });
      } else {
        await tx.subscription.create({ data: { userId: user.id, plan: targetPlan, status: "active", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false } });
      }
      await tx.webhookEvent.create({ data: { eventId } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Crypto webhook error", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
