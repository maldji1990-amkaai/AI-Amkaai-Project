import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getEffectiveEntitlement } from "@/lib/subscription";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. نبحث عن المستخدم في قاعدة بياناتنا للحصول على الـ id الخاص به
    const user = await db.user.findUnique({
      where: { clerkId: clerkId }
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const entitlement = await getEffectiveEntitlement(user.id);

    return NextResponse.json({ 
      isSubscribed: entitlement.active,
      plan: entitlement.active ? entitlement.plan.toUpperCase() : null
    });

  } catch (error) {
    console.error("[CHECK_SUBSCRIPTION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}