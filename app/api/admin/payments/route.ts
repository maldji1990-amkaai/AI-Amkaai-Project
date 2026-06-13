import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    //////////////////////////////////////////////////
    // 🔐 حماية المسار والتأكد من هوية المشرف
    //////////////////////////////////////////////////
    const { userId } = await auth(); // ✅ إصلاح: إزالة الـ await المزدوجة المسببة للأخطاء
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const userEmail = user.emailAddresses[0]?.emailAddress;

    if (!adminEmail || userEmail !== adminEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    //////////////////////////////////////////////////
    // 📊 جلب طلبات الدفع المعلقة (PENDING) فقط
    //////////////////////////////////////////////////
    const payments = await db.manualPayment.findMany({
      where: {
        status: "PENDING", // 👈 ميزة إضافية: جلب الطلبات المعلقة فقط لتسريع وتحسين أداء اللوحة الحية
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    //////////////////////////////////////////////////
    // 🧹 تنظيف وتجهيز البيانات لواجهة الـ Admin Dashboard
    //////////////////////////////////////////////////
    const formatted = payments.map((p) => ({
      id: p.id,
      userId: p.userId,
      email: p.user?.email || "N/A",
      plan: p.plan,
      amount: p.amount,
      status: p.status,
      method: p.method, // 👈 تمرير طريقة الدفع (baridimob أو crypto) لتعرضها البطاقة أونلاين
      createdAt: p.createdAt,
    }));

    return NextResponse.json(formatted);

  } catch (error) {
    console.error("❌ Fetch payments error:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}