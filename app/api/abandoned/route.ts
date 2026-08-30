import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    if (!body?.checkoutUrl || !body?.plan) return NextResponse.json({ error: "Missing data" }, { status: 400 });
    const user = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true, email: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    await db.abandonedCheckout.create({ data: { userId: user.id, email: body.email || user.email || null, plan: String(body.plan), checkoutUrl: String(body.checkoutUrl), step: body.step || "checkout_started" } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ABANDONED ERROR", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const data = await db.abandonedCheckout.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ success: true, data });
}
