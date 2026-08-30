import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const PLAN_ALIASES: Record<string, "MONTHLY" | "QUARTERLY" | "BIANNUALLY" | "BUSINESS"> = {
  PRO: "MONTHLY",
  PREMIUM: "BUSINESS",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  BIANNUALLY: "BIANNUALLY",
  BUSINESS: "BUSINESS",
};

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  const signature = req.headers.get("x-nowpayments-sig");
  if (secret) {
    if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const body = JSON.parse(raw);
    if (body.payment_status !== "finished") return NextResponse.json({ ok: true, ignored: true });
    const eventId = `nowpayments:${body.payment_id || body.order_id || body.invoice_id}`;
    if (await db.webhookEvent.findUnique({ where: { eventId } })) return NextResponse.json({ ok: true, duplicate: true });

    const clerkId = String(body.order_id || "");
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const description = String(body.order_description || "").toUpperCase();
    const plan = description.includes("BIANNUALLY") || description.includes("6 MONTH") ? "BIANNUALLY"
      : description.includes("QUARTERLY") ? "QUARTERLY"
      : description.includes("BUSINESS") ? "BUSINESS"
      : description.includes("PREMIUM") ? "BUSINESS"
      : description.includes("PRO") || description.includes("MONTHLY") ? "MONTHLY"
      : "MONTHLY";
    const credits = ({ MONTHLY: 100, QUARTERLY: 300, BIANNUALLY: 900, BUSINESS: 2000 } as const)[plan];
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { plan, credits: { increment: credits } } }),
      db.webhookEvent.create({ data: { eventId } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Crypto webhook error", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
