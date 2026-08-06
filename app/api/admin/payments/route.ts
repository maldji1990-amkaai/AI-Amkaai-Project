import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    //////////////////////////////////////////////////
    // 🔐 حماية المسار والتأكد من هوية المشرف (موحّد الآن عبر lib/admin-auth.ts)
    //////////////////////////////////////////////////
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    //////////////////////////////////////////////////
    // 📊 جلب طلبات الدفع المعلقة (PENDING) فقط
    //////////////////////////////////////////////////
    const payments = await db.manualPayment.findMany({
      where: {
        status: "PENDING",
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
      method: p.method,
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
