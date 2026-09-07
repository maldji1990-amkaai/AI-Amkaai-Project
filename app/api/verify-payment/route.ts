import { NextResponse } from "next/server";
import Tesseract from "tesseract.js";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * OCR is only a verification aid. It NEVER activates a subscription or grants credits.
 * Final activation is performed atomically by /api/admin/approve-request.
 */
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
    const duplicate = await db.manualPayment.findFirst({
      where: { screenshotUrl: payment.screenshotUrl, id: { not: paymentId }, status: { in: ["PENDING", "COMPLETED"] } },
    });
    if (duplicate) {
      await db.manualPayment.update({ where: { id: paymentId }, data: { status: "REJECTED", aiScore: 0, verified: false } });
      return NextResponse.json({ ok: false, error: "Duplicate screenshot" });
    }

    const score = (hasRip ? 0.5 : 0) + (hasAmount ? 0.5 : 0);
    // Keep the request PENDING even with a strong OCR score. An OCR result is not proof of settlement.
    await db.manualPayment.update({
      where: { id: paymentId },
      data: { aiScore: score, verified: score >= 0.8, status: "PENDING" },
    });
    return NextResponse.json({ ok: true, score, status: "PENDING", suggestedApproval: score >= 0.8 });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
