import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db"; 

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

    // 2. نستخدم findFirst للبحث عن أول اشتراك مرتبط بهذا المستخدم
    const userSubscription = await db.subscription.findFirst({
      where: {
        userId: user.id, // نستخدم الـ id الخاص بجدول User
      },
      orderBy: {
        createdAt: 'desc' // نأخذ أحدث اشتراك
      }
    });

    // 3. نتحقق من الحالة
    const isSubscribed = !!userSubscription && userSubscription.status === "active";

    return NextResponse.json({ 
      isSubscribed,
      plan: userSubscription?.plan || null 
    });

  } catch (error) {
    console.error("[CHECK_SUBSCRIPTION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}