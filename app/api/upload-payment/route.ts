import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await db.user.findUnique({ where: { clerkId: clerkId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const body = await req.json();
    const amount = Number(body?.amount);
    if (!body?.plan || !body?.method || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    if (typeof body.screenshot === "string" && body.screenshot.length > 12_000_000) return NextResponse.json({ error: "Screenshot too large" }, { status: 413 });
    const payment = await db.manualPayment.create({
      data: {
        userId: user.id,
        plan: String(body.plan).toUpperCase(),
        method: String(body.method).toLowerCase(),
        amount,
        currency: String(body.currency || "DZD").toUpperCase(),
        screenshotUrl: typeof body.screenshot === "string" ? body.screenshot : null,
        status: "PENDING",
      },
    });
    return NextResponse.json({ success: true, paymentId: payment.id });
  } catch (error) {
    console.error("UPLOAD PAYMENT ERROR", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
