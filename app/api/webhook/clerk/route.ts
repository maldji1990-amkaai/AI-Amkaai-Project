import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Webhook } from "svix";

export async function POST(req: Request) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") || "",
    "svix-timestamp": req.headers.get("svix-timestamp") || "",
    "svix-signature": req.headers.get("svix-signature") || "",
  };

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");
  let event: any;

  try {
    event = wh.verify(payload, headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "user.created") {
    const { id, email_addresses } = event.data;
    const email = email_addresses?.[0]?.email_address;

    // ✅ مصحح: التسجيل عبر Clerk لا يمنح أي نقاط أو باقة تجربة فعلية.
    //
    // السبب: نموذج العمل يعتمد على أن PayPal هو من يدير فترة التجربة (3 أيام) والخصم
    // التلقائي بعدها (نفس نمط Netflix) — أي المستخدم يجب أن يُدخل بيانات بطاقته في PayPal
    // ويُفعَّل اشتراكه فعلياً هناك أولاً. فقط عندها يصلنا حدث BILLING.SUBSCRIPTION.ACTIVATED
    // من app/api/webhook/route.ts، وهو المكان الوحيد الذي يجب أن يمنح نقاط Trial (30 نقطة)
    // ويضبط trialStartedAt/trialEndsAt.
    //
    // لو منحنا النقاط هنا أيضاً عند مجرد التسجيل (كما كان سابقاً)، سيحصل المستخدم على
    // تجربة مجانية حقيقية بدون حتى الوصول لصفحة الدفع — وهذا يفتح ثغرة استغلال كبيرة
    // (تسجيل حسابات وهمية متعددة بإيميلات مختلفة للحصول على نقاط مجانية بلا حدود).
    //
    // plan يبقى TRIAL كقيمة افتراضية فقط (enum لا يقبل قيمة فارغة)، لكن credits=0
    // و trialStartedAt/trialEndsAt=null يعنيان عملياً: "مسجّل، لم يبدأ اشتراكه بعد".
    await db.user.upsert({
      where: { clerkId: id },
      update: {},
      create: {
        clerkId: id,
        email,
        plan: "TRIAL", // قيمة افتراضية فقط - لا تعني أن التجربة بدأت فعلياً
        credits: 0,     // صفر حتى يُفعَّل الاشتراك عبر PayPal
        trialStartedAt: null,
        trialEndsAt: null,
      },
    });

    console.log(`✅ User account created (no credits yet, pending PayPal subscription): ${email}`);
  }

  return NextResponse.json({ success: true });
}
