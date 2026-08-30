import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const PLAN_ALIASES: Record<string, string> = {
  FREE: "TRIAL",
  PRO: "MONTHLY",
  PREMIUM: "BUSINESS",
};
const PRICES: Record<string, number> = { TRIAL: 0, MONTHLY: 17.99, QUARTERLY: 44.97, BIANNUALLY: 77.94, BUSINESS: 0 };

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    const body = await req.json();
    const normalizedPlan = PLAN_ALIASES[String(body?.plan || "").toUpperCase()] || String(body?.plan || "").toUpperCase();
    if (!Object.hasOwn(PRICES, normalizedPlan) || normalizedPlan === "TRIAL") return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    const amount = Number(body?.amount ?? PRICES[normalizedPlan]);
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    const payment = await db.manualPayment.create({
      data: {
        userId: user.id,
        plan: normalizedPlan,
        method: String(body?.method || "").toLowerCase(),
        currency: String(body?.currency || "USD").toUpperCase(),
        amount,
        transactionId: body?.transactionId ? String(body.transactionId) : null,
        screenshotUrl: null,
        ipAddress: body?.rip ? String(body.rip).slice(0, 100) : null,
        status: "PENDING",
        verified: false,
      },
    });
    return NextResponse.json({ success: true, paymentId: payment.id, status: payment.status });
  } catch (error) {
    console.error("Manual payment error", error);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
