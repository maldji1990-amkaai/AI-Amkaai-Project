import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { useCredits, refundCredits, markUsageSuccess } from "@/lib/credits";
import { LIMITS, FEATURES } from "@/lib/config";
import Replicate from "replicate";

// تهيئة محرك اتصال Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  // 1. إنشاء معرف فريد للعملية لتتبع الاستهلاك والـ Refund تلقائياً
  const referenceId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    // 🔒 التحقق من هوية المستخدم عبر Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ⚡ التحقق من الـ Feature Flag (هل ميزة الفيديو مفعلة في الموقع؟)
    if (!FEATURES.enableVideoQueue) {
      return NextResponse.json({ error: "Video generation is temporarily disabled" }, { status: 503 });
    }

    // 📦 استقبال وقراءة البيانات القادمة من واجهة المستخدم (الـ Dashboard Control Desktop)
    const body = await req.json();
    const { prompt, aspectRatio, creativity, cameraMotion } = body;

    // 🔐 التحقق من قيود الـ Prompt الأمنية المحددة في ملف الـ Config
    if (!prompt || prompt.length < LIMITS.minPromptLength) {
      return NextResponse.json({ error: `Prompt too short. Minimum ${LIMITS.minPromptLength} characters.` }, { status: 400 });
    }
    if (prompt.length > LIMITS.maxPromptLength) {
      return NextResponse.json({ error: `Prompt too long. Maximum ${LIMITS.maxPromptLength} characters.` }, { status: 400 });
    }

    // 🛡️ محاولة حجز النقاط وفحص اشتراك Lemon Squeezy
    // إذا كان الاشتراك منتهياً أو النقاط لا تكفي، سيتوقف الكود فوراً هنا دون لمس سيرفرات الـ AI تلافياً للخسارة المادية.
    const creditResult = await useCredits(userId, "video", { reference: referenceId });

    try {
      
      //////////////////////////////////////////////////////////////////
      // 🎬 استدعاء سيرفر الذكاء الاصطناعي الفعلي (Kling AI / Luma)
      //////////////////////////////////////////////////////////////////
      
      // نقوم بإنشاء الـ Prediction لبدء عملية الريندر على سيرفرات الـ GPU الخارجة
      const prediction = await replicate.predictions.create({
        // استخدام نسق Kling AI المتقدم أو Luma Video Text-to-Video المستقر
        version: "kling-ai/kling-v1.5-video", 
        input: {
          prompt: prompt,
          aspect_ratio: aspectRatio || "16:9",
          camera_control: cameraMotion || "static", // تمرير الحركة المتجهة المختارة من قبل العميل ديناميكياً
          cfg_scale: creativity ? creativity * 10 : 7.5, // موازنة مدخل التوجيه الإبداعي
        },
      });

      // 🔄 حلقة الانتظار الذكي (Polling Loop) داخل السيرفر لحين انتهاء معالجة الفيديو بالكامل
      let result = await replicate.predictions.get(prediction.id);
      
      while (result.status !== "succeeded" && result.status !== "failed") {
        // ننتظر 3 ثوانٍ قبل إعادة التحقق لتجنب استهلاك معدل الطلبات (Rate Limit)
        await new Promise((resolve) => setTimeout(resolve, 3000));
        result = await replicate.predictions.get(prediction.id);
      }

      // في حال فشل معالجة الفيديو بداخل خوادم السيرفر الخارجي، نرفع خطأ لتشغيل الـ Refund فوراً
      if (result.status === "failed") {
        throw new Error("AI_SERVER_RENDER_FAILED");
      }

      // استخراج الرابط الحقيقي والنهائي لملف الـ MP4 الناتج عن المعالجة الذكية
      const finalVideoUrl = Array.isArray(result.output) ? result.output[0] : result.output;

      // 🎯 تثبيت نجاح العملية في قاعدة البيانات وتحويل حالة الـ Usage من PENDING إلى COMPLETED لخصم النقاط بثبات
      await markUsageSuccess(referenceId);

      return NextResponse.json({
        success: true,
        videoUrl: finalVideoUrl, // الرابط الفعلي القابل للتشغيل والتحميل في الفرونت إند
        remainingCredits: creditResult.remainingCredits,
      });

    } catch (aiError) {
      // 💸 [صمام أمان] إذا فشل سيرفر الـ AI الخارجي أو قطع الاتصال، يتم استرجاع نقاط المستخدم فوراً تلقائياً دون خسارة العميل
      console.error("🔥 AI Generation Call Failed, triggering automatic credit refund:", aiError);
      await refundCredits(referenceId);
      
      return NextResponse.json({ error: "Failed to communicate with AI generation engine. Your credits have been securely refunded." }, { status: 502 });
    }

  } catch (error: any) {
    console.error("🔥 GENERATE VIDEO ROUTE ERROR:", error);

    // معالجة الأخطاء القادمة من دالة useCredits لمنح واجهة المستخدم رسالة واضحة
    if (error.message === "SUBSCRIPTION_EXPIRED_OR_INACTIVE") {
      return NextResponse.json({ error: "Your subscription has expired or is past due. Please check your billing dashboard." }, { status: 403 });
    }
    if (error.message === "NOT_ENOUGH_CREDITS") {
      return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan to generate videos." }, { status: 402 });
    }

    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}