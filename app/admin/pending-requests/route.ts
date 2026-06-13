import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const ADMIN_EMAIL = "your-email@example.com";

export async function GET() {
  try {
    const authObj = await auth();
    const userId = authObj?.userId;

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminUser = await db.user.findUnique({ where: { clerkId: userId } });
    if (!adminUser || adminUser.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // جلب طلبات الـ PENDING مرتبة من الأحدث للأقدم
    const pendingRequests = await db.manualRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(pendingRequests);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}