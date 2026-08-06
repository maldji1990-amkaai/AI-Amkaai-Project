import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidatePlanConfigCache } from "@/lib/plan-config";

export const dynamic = "force-dynamic";

//////////////////////////////////////////////////
// 📋 GET - عرض كل الباقات الحالية بإعداداتها الكاملة
//////////////////////////////////////////////////
export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  try {
    const plans = await db.planConfig.findMany({
      orderBy: { priority: "asc" },
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error("🔥 GET /api/admin/plans error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

//////////////////////////////////////////////////
// ✏️ PATCH - تعديل باقة موجودة (جزئي - أي حقل تريده فقط)
// Body: { planKey: "monthly", credits: 150, price: 19.99, ... }
//////////////////////////////////////////////////
export async function PATCH(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  try {
    const body = await req.json();
    const { planKey, ...updates } = body;

    if (!planKey) {
      return NextResponse.json({ error: "planKey is required" }, { status: 400 });
    }

    //////////////////////////////////////////////////
    // 🔐 السماح فقط بالحقول المعروفة والآمنة للتعديل
    // (لمنع تمرير أي حقل غير متوقع مثل id أو planKey نفسه بالخطأ عبر الـ body)
    //////////////////////////////////////////////////
    const ALLOWED_FIELDS = [
      "name",
      "credits",
      "price",
      "isPro",
      "resolution",
      "maxDurationSeconds",
      "aiModel",
      "advancedSampling",
      "watermarkEnabled",
      "watermarkOpacity",
      "watermarkText",
      "priority",
    ] as const;

    const safeUpdates: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in updates) {
        safeUpdates[field] = updates[field];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    //////////////////////////////////////////////////
    // 🧪 تحقق بسيط من سلامة القيم الحساسة قبل الحفظ
    //////////////////////////////////////////////////
    if (
      "watermarkOpacity" in safeUpdates &&
      (safeUpdates.watermarkOpacity < 0 || safeUpdates.watermarkOpacity > 100)
    ) {
      return NextResponse.json({ error: "watermarkOpacity must be between 0 and 100" }, { status: 400 });
    }
    if ("credits" in safeUpdates && safeUpdates.credits < 0) {
      return NextResponse.json({ error: "credits cannot be negative" }, { status: 400 });
    }
    if ("price" in safeUpdates && safeUpdates.price < 0) {
      return NextResponse.json({ error: "price cannot be negative" }, { status: 400 });
    }

    const updated = await db.planConfig.update({
      where: { planKey },
      data: safeUpdates,
    });

    // 🔄 مسح الـ cache فوراً حتى تنعكس التغييرات في الطلب القادم مباشرة
    invalidatePlanConfigCache();

    console.log(`✅ Admin (${adminCheck.email}) updated plan "${planKey}":`, safeUpdates);

    return NextResponse.json({ success: true, plan: updated });
  } catch (error: any) {
    console.error("🔥 PATCH /api/admin/plans error:", error);

    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
