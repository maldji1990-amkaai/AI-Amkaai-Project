import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) return NextResponse.json({ status: "NONE" });
  const payment = await db.manualPayment.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (!payment) return NextResponse.json({ status: "NONE" });
  return NextResponse.json({ status: payment.status, plan: payment.plan, amount: payment.amount });
}
