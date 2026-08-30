import { NextResponse } from "next/server";
import Tesseract from "tesseract.js";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { PlanType } from "@prisma/client";

const PLAN_MAP: Record<string, PlanType> = {
  FREE: PlanType.TRIAL,
  TRIAL: PlanType.TRIAL,
  PRO: PlanType.MONTHLY,
  PREMIUM: PlanType.BUSINESS,
  MONTHLY: PlanType.MONTHLY,
  QUARTERLY: PlanType.QUARTERLY,
  BIANNUALLY: PlanType.BIANNUALLY,
  BUSINESS: PlanType.BUSINESS,
};
const CREDITS: Record<PlanType, number> = { TRIAL: 30, MONTHLY: 100, QUARTERLY: 300, BIANNUALLY: 900, BUSINESS: 2000 };

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  try {
    const { paymentId } = await req.json();
    if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });
    const payment = await db.manualPayment.findUnique({ where: { id: paymentId } });
    if (!payment || !payment.screenshotUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (payment.status === "COMPLETED") return NextResponse.json({ ok: true, status: "COMPLETED" });

    const result = await Tesseract.recognize(payment.screenshotUrl, "eng");
    const text = result.data.text.toLowerCase();
    const rip = process.env.BARIDIMOB_RIP?.toLowerCase() || "";
    const amount = payment.amount.toString();
    const hasRip = rip.length > 3 && text.includes(rip.slice(0, 6));
    const hasAmount = text.includes(amount);
    const duplicate = await db.manualPayment.findFirst({ where: { screenshotUrl: payment.screenshotUrl, id: { not: paymentId }, status: { in: ["PENDING", "COMPLETED"] } } });
    if (duplicate) {
      await db.manualPayment.update({ where: { id: paymentId }, data: { status: "REJECTED", aiScore: 0, verified: false } });
      return NextResponse.json({ ok: false, error: "Duplicate screenshot" });
    }

    const score = (hasRip ? 0.5 : 0) + (hasAmount ? 0.5 : 0);
    const status = score >= 0.8 ? "COMPLETED" : score < 0.5 ? "REJECTED" : "PENDING";
    const plan = PLAN_MAP[String(payment.plan).toUpperCase()];
    await db.$transaction(async (tx) => {
      await tx.manualPayment.update({ where: { id: paymentId }, data: { aiScore: score, verified: score >= 0.8, status } });
      if (status === "COMPLETED" && plan) {
        await tx.user.update({ where: { id: payment.userId }, data: { plan, credits: { increment: CREDITS[plan] } } });
      }
    });
    return NextResponse.json({ ok: true, score, status });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
