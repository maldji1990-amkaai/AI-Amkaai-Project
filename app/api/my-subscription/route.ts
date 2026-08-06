// app/api/my-subscription/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true, // 🆕 أُضيف هنا لتفادي استعلام مكرر أدناه لجلب نفس المستخدم مرة ثانية
        plan: true,
        credits: true,
        createdAt: true,
        lemonSubscriptionId: true,
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // ✅ مصحح: نستخدم user.id المتوفر بالفعل بدل استعلام findUnique إضافي مكرر
    const latestSub = await db.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      plan: user.plan, // ✅ يعمل تلقائياً وصحيحاً مع enum الجديد (TRIAL/MONTHLY/QUARTERLY/BIANNUALLY/BUSINESS)
      credits: user.credits,
      createdAt: latestSub?.createdAt ?? user.createdAt,
      status: latestSub?.status ?? null,
      currentPeriodEnd: latestSub?.currentPeriodEnd ?? null,
      lemonSubscriptionId: user.lemonSubscriptionId,
    });
  } catch (error) {
    console.error("[MY_SUBSCRIPTION]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
