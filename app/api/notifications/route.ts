import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: true, data: [] });
    const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
    return NextResponse.json({ ok: true, data: notifications });
  } catch (error) {
    console.error("Notifications error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
