import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { demoAvatars } from "@/lib/demo";
import { PlanType } from "@prisma/client";
import Replicate from "replicate";

// تهيئة حزمة Replicate باستخدام مفتاح البيئة السري
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  // 🎯 إنشاء معرّف فريد للعملية لربط حجز النقاط وإرجاعها في حال الفشل
  const referenceId = `avt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    console.log("🚀 REAL AI AVATAR API HIT");

    // 🔐 AUTH (التحقق من Clerk)
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // القراءة الديناميكية للبيانات المرفوعة من واجهة المستخدم
    const { prompt, uploadedImage } = await request.json();

    // 👤 GET USER
    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    // ✅ إنشاء المستخدم تلقائياً إذا لم يكن مسجلاً في قاعدة البيانات
    if (!user) {
      user = await db.user.create({
        data: {
          clerkId: userId,
          credits: 10,
          plan: PlanType.FREE,
        },
      });
      console.log("✅ New user created on the fly:", user.id);
    }

    //////////////////////////////////////////////////
    // 💸 USE CREDITS & SUBSCRIPTION CHECK (آمن وصارم)
    //////////////////////////////////////////////////
    let creditResult;
    try {
      creditResult = await useCredits(user.id, "image", { reference: referenceId });
    } catch (err: any) {
      if (err.message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
        return NextResponse.json({ error: "Your subscription has expired. Please check your billing dashboard." }, { status: 403 });
      }
      return NextResponse.json({ error: err.message || "Not enough credits" }, { status: 402 });
    }

    //////////////////////////////////////////////////
    // 🧠 DEMO MODE (FREE USERS)
    //////////////////////////////////////////////////
    if (user.plan === PlanType.FREE) {
      const avatar = demoAvatars[Math.floor(Math.random() * demoAvatars.length)];

      // علم العملية كـ COMPLETED لأن الخدمة سلمت النتيجة الفورية للمستخدم
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        avatar, // سيعيد الرابط المؤقت للمستخدم المجاني
        demo: true,
        remainingCredits: creditResult.remainingCredits,
      });
    }

    //////////////////////////////////////////////////
    // 💎 PRO / PREMIUM (REAL AI ACTIVE)
    //////////////////////////////////////////////////
    try {
      if (!uploadedImage) {
        throw new Error("MISSING_SOURCE_IMAGE");
      }

      /* 💡 الربط الفعلي بموديل ذكاء اصطناعي متطور:
         سنستخدم هنا نموذج LivePortrait الشهير والخفيف القادر على بث الروح في الصور وتحريك الوجوه بدقة
      */
      const prediction = await replicate.predictions.create({
        version: "fofr/live-portrait:16ef6823", // معرف الموديل المستقر على Replicate
        input: {
          source_image: uploadedImage, // يقبل رابط مباشر أو صورة مشفرة Base64 قادمة من الفرونت إند
          prompt: prompt || "expression driving pattern",
        },
      });

      // 🔄 حلقة الانتظار الذكي (Polling Loop) لمتابعة ريندر الأفاتار في خوادم Replicate الخلفية
      let result = await replicate.predictions.get(prediction.id);
      while (result.status !== "succeeded" && result.status !== "failed") {
        // الانتظار لمدة ثانيتين قبل التحقق مرة أخرى لتجنب حظر الـ Rate-limit
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result = await replicate.predictions.get(prediction.id);
      }

      if (result.status === "failed") {
        throw new Error("AI_SERVER_RENDER_FAILED");
      }

      // استخراج الرابط الحقيقي النهائي للفيديو التوليدي الناتج عن الذكاء الاصطناعي
      const avatarUrl = Array.isArray(result.output) ? result.output[0] : result.output;

      // علم العملية كـ COMPLETED لنجاح توليد الأفاتار الحقيقي للمشتركين وترسيخ خصم النقاط
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        avatar: avatarUrl, // إرسال رابط الفيديو الحقيقي للأفاتار الناطق
        demo: false,
        remainingCredits: creditResult.remainingCredits,
      });

    } catch (aiError: any) {
      // 💸 صمام الأمان: في حال فشل السيرفر الخارجي أو لم يتم رفع صورة، يتم رد النقاط فوراً لحساب العميل
      console.error("🔥 Avatar AI pipeline failed, triggering refund...", aiError);
      await refundCredits(referenceId);

      const errorMessage = aiError.message === "MISSING_SOURCE_IMAGE" 
        ? "Avatar generation requires a base seed image to be uploaded."
        : "Avatar generation failed on cloud GPUs. Your credits have been securely refunded.";

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("🔥 AVATAR API FATAL ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}